/**
 * Fragmented Recorder Hook
 * 
 * Records audio/video locally and splits into small fragments.
 * Each fragment is stored in IndexedDB and queued for upload.
 */

import { useCallback, useRef, useState } from 'react';
import {
    RecordingFragment,
    RecordingSession,
    saveFragment,
    saveSession,
    getSession,
    getPendingFragments,
    generateFragmentId,
} from '@/lib/fragmentDb';

const FRAGMENT_DURATION_MS = 5000; // 5 seconds per fragment
const VIDEO_BITRATE = 2500000; // 2.5 Mbps
const AUDIO_BITRATE = 128000; // 128 kbps

export interface FragmentedRecorderState {
    isRecording: boolean;
    sessionId: string | null;
    fragmentCount: number;
    uploadedCount: number;
    error: string | null;
}

export interface UseFragmentedRecorderReturn {
    state: FragmentedRecorderState;
    startRecording: (stream: MediaStream, roomId: string, participantId: string) => Promise<void>;
    stopRecording: () => Promise<RecordingFragment[]>;
    getUnuploadedFragments: () => Promise<RecordingFragment[]>;
}

export function useFragmentedRecorder(
    onFragmentReady?: (fragment: RecordingFragment) => void
): UseFragmentedRecorderReturn {
    const [state, setState] = useState<FragmentedRecorderState>({
        isRecording: false,
        sessionId: null,
        fragmentCount: 0,
        uploadedCount: 0,
        error: null,
    });

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const sessionRef = useRef<RecordingSession | null>(null);
    const fragmentIndexRef = useRef<number>(0);
    const recordingStartTimeRef = useRef<number>(0);

    /**
     * Start recording with fragmentation
     */
    const startRecording = useCallback(async (
        stream: MediaStream,
        roomId: string,
        participantId: string
    ) => {
        try {
            // Generate unique session ID
            const sessionId = `${roomId}_${participantId}_${Date.now()}`;

            // Create session record
            const session: RecordingSession = {
                id: sessionId,
                roomId,
                participantId,
                startedAt: Date.now(),
                fragmentCount: 0,
                uploadedCount: 0,
                status: 'recording',
            };

            await saveSession(session);
            sessionRef.current = session;
            fragmentIndexRef.current = 0;
            recordingStartTimeRef.current = Date.now();

            // Determine best codec
            const mimeType = getSupportedMimeType();
            console.log(`[FragmentedRecorder] Using codec: ${mimeType}`);

            // Create MediaRecorder
            const recorder = new MediaRecorder(stream, {
                mimeType,
                videoBitsPerSecond: VIDEO_BITRATE,
                audioBitsPerSecond: AUDIO_BITRATE,
            });

            // Handle data available (called every FRAGMENT_DURATION_MS)
            recorder.ondataavailable = async (event) => {
                if (event.data.size === 0) return;

                const index = fragmentIndexRef.current++;
                const timestamp = recordingStartTimeRef.current + (index * FRAGMENT_DURATION_MS);

                // Determine track type based on stream
                const hasVideo = stream.getVideoTracks().length > 0;
                const trackType = hasVideo ? 'video' : 'audio';

                // Create fragment
                const fragment: RecordingFragment = {
                    id: generateFragmentId(sessionId, trackType, index),
                    sessionId,
                    participantId,
                    trackType,
                    index,
                    timestamp,
                    duration: FRAGMENT_DURATION_MS,
                    blob: event.data,
                    uploaded: false,
                    uploadAttempts: 0,
                    createdAt: Date.now(),
                };

                // Save to IndexedDB
                await saveFragment(fragment);

                // Update session
                if (sessionRef.current) {
                    sessionRef.current.fragmentCount++;
                    await saveSession(sessionRef.current);
                }

                // Update state
                setState(prev => ({
                    ...prev,
                    fragmentCount: prev.fragmentCount + 1,
                }));

                // Notify callback (for upload queue)
                if (onFragmentReady) {
                    onFragmentReady(fragment);
                }

                console.log(`[FragmentedRecorder] Fragment ${index} saved (${(event.data.size / 1024).toFixed(1)} KB)`);
            };

            recorder.onerror = (event) => {
                console.error('[FragmentedRecorder] Error:', event);
                setState(prev => ({ ...prev, error: 'Recording error occurred' }));
            };

            recorder.onstop = () => {
                console.log('[FragmentedRecorder] MediaRecorder stopped');
            };

            // Start recording with timeslice for fragmentation
            recorder.start(FRAGMENT_DURATION_MS);
            mediaRecorderRef.current = recorder;

            setState({
                isRecording: true,
                sessionId,
                fragmentCount: 0,
                uploadedCount: 0,
                error: null,
            });

            console.log(`[FragmentedRecorder] Started recording session: ${sessionId}`);
        } catch (error) {
            console.error('[FragmentedRecorder] Failed to start:', error);
            setState(prev => ({
                ...prev,
                error: error instanceof Error ? error.message : 'Failed to start recording',
            }));
            throw error;
        }
    }, [onFragmentReady]);

    /**
     * Stop recording and return pending fragments
     */
    const stopRecording = useCallback(async (): Promise<RecordingFragment[]> => {
        const recorder = mediaRecorderRef.current;
        const session = sessionRef.current;

        if (recorder && recorder.state !== 'inactive') {
            recorder.stop();
        }

        mediaRecorderRef.current = null;

        // Update session status
        if (session) {
            session.endedAt = Date.now();
            session.status = 'uploading';
            await saveSession(session);
        }

        // Get pending fragments
        const pendingFragments = session
            ? await getPendingFragments(session.id)
            : [];

        setState({
            isRecording: false,
            sessionId: session?.id || null,
            fragmentCount: session?.fragmentCount || 0,
            uploadedCount: session?.uploadedCount || 0,
            error: null,
        });

        console.log(`[FragmentedRecorder] Stopped. ${pendingFragments.length} fragments pending upload.`);
        return pendingFragments;
    }, []);

    /**
     * Get all unuploaded fragments for current session
     */
    const getUnuploadedFragments = useCallback(async (): Promise<RecordingFragment[]> => {
        if (!sessionRef.current) return [];
        return getPendingFragments(sessionRef.current.id);
    }, []);

    return {
        state,
        startRecording,
        stopRecording,
        getUnuploadedFragments,
    };
}

/**
 * Get the best supported video codec
 */
function getSupportedMimeType(): string {
    const types = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm;codecs=h264,opus',
        'video/webm',
        'video/mp4',
    ];

    for (const type of types) {
        if (MediaRecorder.isTypeSupported(type)) {
            return type;
        }
    }

    return 'video/webm';
}
