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
            // 1. Capture Video (Screen/Window of the meeting)
            // We ask the user to select the meeting tab/window to record exactly what they see.
            const displayStream = await navigator.mediaDevices.getDisplayMedia({
                video: { width: 1920, height: 1080 },
                audio: false // We mix audio manually
            });

            // 2. Setup Audio Mixing
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

            // 3. Combine Video + Mixed Audio
            const combinedStream = new MediaStream([
                ...displayStream.getVideoTracks(),
                ...destination.stream.getAudioTracks()
            ]);

            // 4. Start MediaRecorder
            const options = { mimeType: 'video/webm;codecs=vp9,opus' };
            // Fallback for Safari/others if needed, but Chrome/FF support webm

            const recorder = new MediaRecorder(combinedStream, options);
            mediaRecorderRef.current = recorder;
            chunksRef.current = [];

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    chunksRef.current.push(e.data);
                }
            };

            recorder.onstop = () => {
                // Generate Blob
                const blob = new Blob(chunksRef.current, { type: 'video/webm' });
                const url = URL.createObjectURL(blob);

                // Auto-download
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = `session-recording-${new Date().toISOString()}.webm`;
                document.body.appendChild(a);
                a.click();

                // Cleanup URL
                setTimeout(() => {
                    document.body.removeChild(a);
                    window.URL.revokeObjectURL(url);
                }, 100);

                // Stop all tracks in the combined stream (including screen share)
                combinedStream.getTracks().forEach(track => track.stop());

                // Close audio context
                if (audioContextRef.current) {
                    audioContextRef.current.close();
                }

                setIsRecording(false);
                toast.success("Recording saved!");
            };

            // If user stops sharing screen via browser UI, stop recording
            displayStream.getVideoTracks()[0].onended = () => {
                stopRecording();
            };

            recorder.start(1000); // chunk every 1s
            setIsRecording(true);
            toast.info("Recording started. Keep this tab active.");

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
