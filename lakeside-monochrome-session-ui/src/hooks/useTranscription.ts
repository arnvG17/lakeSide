import { useState, useRef, useCallback } from 'react';

const SAMPLE_RATE = 16000;

interface TranscriptionState {
    isPlaying: boolean;
    transcript: string;
    isConnecting: boolean;
}

export function useTranscription(serverUrl: string = 'https://lakeside-asr.onrender.com/ws/transcribe') {
    const [state, setState] = useState<TranscriptionState>({
        isPlaying: false,
        transcript: '',
        isConnecting: false,
    });

    const socketRef = useRef<WebSocket | null>(null);
    const processorRef = useRef<ScriptProcessorNode | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const inputRef = useRef<MediaStreamAudioSourceNode | null>(null);

    const convertFloatTo16BitPCM = (input: Float32Array) => {
        const output = new Int16Array(input.length);
        for (let i = 0; i < input.length; i++) {
            const s = Math.max(-1, Math.min(1, input[i]));
            output[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        return output.buffer;
    };

    const startTranscription = useCallback(async () => {
        try {
            setState(prev => ({ ...prev, isConnecting: true }));

            // Connect to WebSocket
            const ws = new WebSocket(serverUrl);
            socketRef.current = ws;

            ws.onopen = () => {
                console.log('Connected to ASR service');
                setState(prev => ({ ...prev, isPlaying: true, isConnecting: false }));
            };

            ws.onmessage = (event) => {
                const response = JSON.parse(event.data);
                if (response.type === 'partial' || response.type === 'final') {
                    setState(prev => ({ ...prev, transcript: response.text }));
                }
            };

            ws.onerror = (error) => {
                console.error('ASR WebSocket error:', error);
                setState(prev => ({ ...prev, isConnecting: false, isPlaying: false }));
            };

            ws.onclose = () => {
                console.log('ASR WebSocket closed');
                setState(prev => ({ ...prev, isPlaying: false }));
            };

            // Get user media specifically for transcription (or reuse existing stream if passed)
            // For simplicity, we request a new stream here, but you could modify to accept a MediaStream
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            // Audio Context setup
            const audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
            audioContextRef.current = audioContext;

            const input = audioContext.createMediaStreamSource(stream);
            inputRef.current = input;

            // Processor
            // Note: AudioWorklet is better for production, ScriptProcessor is easier for simple drop-in
            const processor = audioContext.createScriptProcessor(4096, 1, 1);
            processorRef.current = processor;

            processor.onaudioprocess = (e) => {
                if (ws.readyState === WebSocket.OPEN) {
                    const inputData = e.inputBuffer.getChannelData(0);
                    const pcmData = convertFloatTo16BitPCM(inputData);
                    ws.send(pcmData);
                }
            };

            input.connect(processor);
            processor.connect(audioContext.destination);

        } catch (error) {
            console.error('Failed to start transcription:', error);
            setState(prev => ({ ...prev, isConnecting: false }));
        }
    }, [serverUrl]);

    const stopTranscription = useCallback(() => {
        if (socketRef.current) {
            socketRef.current.close();
        }
        if (processorRef.current) {
            processorRef.current.disconnect();
        }
        if (inputRef.current) {
            inputRef.current.disconnect();
        }
        if (audioContextRef.current) {
            audioContextRef.current.close();
        }
        setState(prev => ({ ...prev, isPlaying: false, transcript: '' }));
    }, []);

    return {
        startTranscription,
        stopTranscription,
        ...state
    };
}
