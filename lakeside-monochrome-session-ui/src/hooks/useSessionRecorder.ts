import { useState, useRef, useCallback } from 'react';
import { toast } from 'sonner';

interface UseSessionRecorderProps {
    // Array of all remote media streams to mix
    remoteStreams: MediaStream[];
    // The local user's microphone stream
    localStream: MediaStream | null;
}

export function useSessionRecorder({ remoteStreams, localStream }: UseSessionRecorderProps) {
    const [isRecording, setIsRecording] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const mixedStreamRef = useRef<MediaStreamAudioDestinationNode | null>(null);
    const chunksRef = useRef<Blob[]>([]);

    const startRecording = useCallback(async () => {
        try {
            // 1. Setup Audio Mixing
            const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
            const ctx = new AudioContextClass();
            audioContextRef.current = ctx;

            // Create a destination for the mixed audio
            const destination = ctx.createMediaStreamDestination();
            mixedStreamRef.current = destination;

            // Add Local Stream (Mic)
            if (localStream) {
                const localSource = ctx.createMediaStreamSource(localStream);
                // Connect local mic to destination ONLY (not to speakers to avoid echo)
                localSource.connect(destination);
            }

            // Add Remote Streams
            remoteStreams.forEach(stream => {
                if (stream.getAudioTracks().length > 0) {
                    const source = ctx.createMediaStreamSource(stream);
                    source.connect(destination);
                }
            });

            // 2. Start MediaRecorder with Mixed Audio
            const mixedAudioStream = destination.stream;
            // Prefer opus for audio-only
            const options = { mimeType: 'audio/webm;codecs=opus' };

            const recorder = new MediaRecorder(mixedAudioStream, options);
            mediaRecorderRef.current = recorder;
            chunksRef.current = [];

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    chunksRef.current.push(e.data);
                }
            };

            recorder.onstop = () => {
                // Generate Blob (Audio)
                const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
                const url = URL.createObjectURL(blob);

                // Auto-download
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = `session-audio-${new Date().toISOString()}.webm`;
                document.body.appendChild(a);
                a.click();

                // Cleanup URL
                setTimeout(() => {
                    document.body.removeChild(a);
                    window.URL.revokeObjectURL(url);
                }, 100);

                // Stop tracks? No, we don't own the input tracks, only the mix?
                // The mix destination stream tracks should be stopped.
                mixedAudioStream.getTracks().forEach(track => track.stop());

                // Close audio context
                if (audioContextRef.current) {
                    audioContextRef.current.close();
                }

                setIsRecording(false);
                toast.success("Audio recording saved!");
            };

            recorder.start(1000); // chunk every 1s
            setIsRecording(true);
            toast.info("Audio recording started.");

        } catch (err) {
            console.error("Failed to start recording", err);
            toast.error("Could not start recording");
        }
    }, [remoteStreams, localStream]);

    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }
    }, []);

    return {
        isRecording,
        startRecording,
        stopRecording
    };
}
