import { useState, useRef, useCallback } from 'react';

const SAMPLE_RATE = 16000;

interface TranscriptionState {
    isPlaying: boolean;
    transcript: string;
    isConnecting: boolean;
}

interface UseTranscriptionOptions {
    onAudioRecognized?: () => void;
    onTranscript?: (text: string) => void;
}

export function useTranscription(serverUrl: string = 'wss://lakeside-asr.onrender.com/ws/transcribe', options?: UseTranscriptionOptions) {
    const [state, setState] = useState<TranscriptionState>({
        isPlaying: false,
        transcript: '',
        isConnecting: false,
    });

    // Track if we have detected audio in this session
    const hasDetectedAudioRef = useRef(false);

    // Keep latest options in ref to avoid dependency issues/stale closures
    const optionsRef = useRef(options);

    // Update ref when options change
    if (optionsRef.current !== options) {
        optionsRef.current = options;
    }

    const socketRef = useRef<WebSocket | null>(null);
    const processorRef = useRef<ScriptProcessorNode | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const inputRef = useRef<MediaStreamAudioSourceNode | null>(null);

    // Resampler function: converts any sample rate to 16000Hz
    const downsampleBuffer = (buffer: Float32Array, inputSampleRate: number, outputSampleRate: number) => {
        if (outputSampleRate === inputSampleRate) {
            return buffer;
        }
        const sampleRateRatio = inputSampleRate / outputSampleRate;
        const newLength = Math.round(buffer.length / sampleRateRatio);
        const result = new Float32Array(newLength);
        let offsetResult = 0;
        let offsetBuffer = 0;
        while (offsetResult < result.length) {
            const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
            // Linear interpolation or simple averaging
            // Simple averging for downsampling
            let accum = 0, count = 0;
            for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
                accum += buffer[i];
                count++;
            }
            result[offsetResult] = count > 0 ? accum / count : 0;
            offsetResult++;
            offsetBuffer = nextOffsetBuffer;
        }
        return result;
    };

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
            console.log('[Transcription] Starting... connecting to:', serverUrl);
            hasDetectedAudioRef.current = false;
            setState(prev => ({ ...prev, isConnecting: true }));

            // Connect to WebSocket
            const ws = new WebSocket(serverUrl);
            socketRef.current = ws;

            ws.onopen = async () => {
                console.log('[Transcription] WebSocket connected! Setting up audio...');
                setState(prev => ({ ...prev, isPlaying: true, isConnecting: false }));
            };

            ws.onmessage = (event) => {
                const response = JSON.parse(event.data);
                if (response.type === 'partial' || response.type === 'final') {
                    if (response.text && response.text.trim()) {
                        if (!hasDetectedAudioRef.current) {
                            hasDetectedAudioRef.current = true;
                            optionsRef.current?.onAudioRecognized?.();
                        }
                        optionsRef.current?.onTranscript?.(response.text);
                    }
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

            // Get user media
            // Note: On mobile, this usually prompts permissions
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });

            // Audio Context setup
            // IMPORTANT: Do NOT force sampleRate here (Safari crashes). Let browser decide.
            const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
            const audioContext = new AudioContext();
            audioContextRef.current = audioContext;

            // IMPORTANT: Resume context for mobile browsers (they start suspended)
            if (audioContext.state === 'suspended') {
                await audioContext.resume();
            }

            const input = audioContext.createMediaStreamSource(stream);
            inputRef.current = input;

            // Processor
            // Buffer size 4096 is safer for mobile CPU usage than 2048 or 1024
            const processor = audioContext.createScriptProcessor(4096, 1, 1);
            processorRef.current = processor;

            processor.onaudioprocess = (e) => {
                if (ws.readyState === WebSocket.OPEN) {
                    const inputData = e.inputBuffer.getChannelData(0);

                    // Frontend VAD: Check amplitude before spending bandwidth
                    let sumSquares = 0.0;
                    for (const sample of inputData) {
                        sumSquares += sample * sample;
                    }
                    const amplitude = Math.sqrt(sumSquares / inputData.length);

                    // Threshold 0.01 (adjustable)
                    if (amplitude > 0.01) {
                        // Downsample if needed (e.g. 48k -> 16k)
                        const downsampled = downsampleBuffer(inputData, audioContext.sampleRate, 16000);
                        const pcmData = convertFloatTo16BitPCM(downsampled);
                        ws.send(pcmData);
                    }
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
            socketRef.current = null;
        }
        if (processorRef.current) {
            processorRef.current.disconnect();
            processorRef.current = null;
        }
        if (inputRef.current) {
            inputRef.current.disconnect();
            inputRef.current = null;
        }
        if (audioContextRef.current) {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }
        setState(prev => ({ ...prev, isPlaying: false, transcript: '' }));
    }, []);

    return {
        startTranscription,
        stopTranscription,
        ...state
    };
}
