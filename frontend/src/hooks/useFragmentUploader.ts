/**
 * Fragment Uploader Hook
 * 
 * Manages uploading fragments to cloud storage via presigned URLs.
 * Handles retry logic, parallel uploads, and state tracking.
 */

import { useCallback, useRef, useState, useEffect } from 'react';
import {
    RecordingFragment,
    markFragmentUploaded,
    incrementUploadAttempt,
    getPendingFragments,
    saveSession,
    getSession,
} from '@/lib/fragmentDb';

const MAX_RETRY_ATTEMPTS = 3;
const MAX_CONCURRENT_UPLOADS = 3;
const RETRY_DELAYS = [1000, 3000, 10000]; // Exponential backoff

export interface UploadProgress {
    total: number;
    uploaded: number;
    failed: number;
    inProgress: number;
}

export interface UseFragmentUploaderReturn {
    progress: UploadProgress;
    isUploading: boolean;
    enqueueFragment: (fragment: RecordingFragment) => void;
    retryFailed: () => Promise<void>;
    flushQueue: () => Promise<void>;
}

interface QueuedFragment {
    fragment: RecordingFragment;
    retryCount: number;
}

export function useFragmentUploader(
    sessionId: string | null,
    backendUrl: string = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001'
): UseFragmentUploaderReturn {
    const [progress, setProgress] = useState<UploadProgress>({
        total: 0,
        uploaded: 0,
        failed: 0,
        inProgress: 0,
    });
    const [isUploading, setIsUploading] = useState(false);

    const uploadQueueRef = useRef<QueuedFragment[]>([]);
    const activeUploadsRef = useRef<Set<string>>(new Set());
    const failedFragmentsRef = useRef<RecordingFragment[]>([]);
    const processingRef = useRef(false);

    /**
     * Get presigned URL from backend
     */
    const getPresignedUrl = useCallback(async (fragment: RecordingFragment): Promise<{ uploadUrl: string; key: string }> => {
        const response = await fetch(`${backendUrl}/api/upload/presign`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                sessionId: fragment.sessionId,
                participantId: fragment.participantId,
                trackType: fragment.trackType,
                fragmentIndex: fragment.index,
                contentType: fragment.blob.type,
            }),
        });

        if (!response.ok) {
            throw new Error(`Failed to get presigned URL: ${response.statusText}`);
        }

        return response.json();
    }, [backendUrl]);

    /**
     * Upload a single fragment
     */
    const uploadFragment = useCallback(async (fragment: RecordingFragment): Promise<boolean> => {
        try {
            // Get presigned URL
            const { uploadUrl } = await getPresignedUrl(fragment);

            // Upload directly to storage
            const uploadResponse = await fetch(uploadUrl, {
                method: 'PUT',
                body: fragment.blob,
                headers: {
                    'Content-Type': fragment.blob.type,
                },
            });

            if (!uploadResponse.ok) {
                throw new Error(`Upload failed: ${uploadResponse.statusText}`);
            }

            // Mark as uploaded in IndexedDB
            await markFragmentUploaded(fragment.id);

            console.log(`[FragmentUploader] Uploaded fragment ${fragment.index}`);
            return true;
        } catch (error) {
            console.error(`[FragmentUploader] Failed to upload fragment ${fragment.index}:`, error);
            return false;
        }
    }, [getPresignedUrl]);

    /**
     * Process the upload queue
     */
    const processQueue = useCallback(async () => {
        if (processingRef.current) return;
        processingRef.current = true;

        while (uploadQueueRef.current.length > 0 && activeUploadsRef.current.size < MAX_CONCURRENT_UPLOADS) {
            const queued = uploadQueueRef.current.shift();
            if (!queued) break;

            const { fragment, retryCount } = queued;

            // Skip if already being uploaded
            if (activeUploadsRef.current.has(fragment.id)) continue;

            activeUploadsRef.current.add(fragment.id);
            setProgress(prev => ({ ...prev, inProgress: activeUploadsRef.current.size }));

            // Upload in background
            (async () => {
                const success = await uploadFragment(fragment);

                activeUploadsRef.current.delete(fragment.id);

                if (success) {
                    setProgress(prev => ({
                        ...prev,
                        uploaded: prev.uploaded + 1,
                        inProgress: activeUploadsRef.current.size,
                    }));

                    // Update session
                    if (sessionId) {
                        const session = await getSession(sessionId);
                        if (session) {
                            session.uploadedCount++;
                            await saveSession(session);
                        }
                    }
                } else {
                    // Handle retry
                    await incrementUploadAttempt(fragment.id);

                    if (retryCount < MAX_RETRY_ATTEMPTS) {
                        // Re-queue with delay
                        setTimeout(() => {
                            uploadQueueRef.current.push({ fragment, retryCount: retryCount + 1 });
                            processQueue();
                        }, RETRY_DELAYS[retryCount] || RETRY_DELAYS[RETRY_DELAYS.length - 1]);
                    } else {
                        // Mark as failed
                        failedFragmentsRef.current.push(fragment);
                        setProgress(prev => ({
                            ...prev,
                            failed: prev.failed + 1,
                            inProgress: activeUploadsRef.current.size,
                        }));
                    }
                }

                // Continue processing
                processQueue();
            })();
        }

        processingRef.current = false;
        setIsUploading(activeUploadsRef.current.size > 0 || uploadQueueRef.current.length > 0);
    }, [uploadFragment, sessionId]);

    /**
     * Add a fragment to the upload queue
     */
    const enqueueFragment = useCallback((fragment: RecordingFragment) => {
        uploadQueueRef.current.push({ fragment, retryCount: 0 });
        setProgress(prev => ({ ...prev, total: prev.total + 1 }));
        setIsUploading(true);
        processQueue();
    }, [processQueue]);

    /**
     * Retry all failed uploads
     */
    const retryFailed = useCallback(async () => {
        const failed = failedFragmentsRef.current;
        failedFragmentsRef.current = [];

        setProgress(prev => ({
            ...prev,
            failed: 0,
        }));

        for (const fragment of failed) {
            enqueueFragment(fragment);
        }
    }, [enqueueFragment]);

    /**
     * Flush the queue - wait for all uploads to complete
     */
    const flushQueue = useCallback(async (): Promise<void> => {
        return new Promise((resolve) => {
            const checkComplete = () => {
                if (uploadQueueRef.current.length === 0 && activeUploadsRef.current.size === 0) {
                    resolve();
                } else {
                    setTimeout(checkComplete, 500);
                }
            };
            checkComplete();
        });
    }, []);

    /**
     * Resume uploads on mount (crash recovery)
     */
    useEffect(() => {
        if (sessionId) {
            (async () => {
                const pending = await getPendingFragments(sessionId);
                if (pending.length > 0) {
                    console.log(`[FragmentUploader] Resuming ${pending.length} pending uploads`);
                    for (const fragment of pending) {
                        enqueueFragment(fragment);
                    }
                }
            })();
        }
    }, [sessionId, enqueueFragment]);

    return {
        progress,
        isUploading,
        enqueueFragment,
        retryFailed,
        flushQueue,
    };
}
