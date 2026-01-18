/**
 * IndexedDB Fragment Store
 * 
 * Stores recording fragments locally for crash recovery.
 * Fragments persist until successfully uploaded to cloud storage.
 */

const DB_NAME = 'lakeside-recordings';
const DB_VERSION = 1;
const FRAGMENTS_STORE = 'fragments';
const SESSIONS_STORE = 'sessions';

export interface RecordingFragment {
    id: string;
    sessionId: string;
    participantId: string;
    trackType: 'audio' | 'video';
    index: number;
    timestamp: number;
    duration: number;
    blob: Blob;
    uploaded: boolean;
    uploadAttempts: number;
    createdAt: number;
}

export interface RecordingSession {
    id: string;
    roomId: string;
    participantId: string;
    startedAt: number;
    endedAt?: number;
    fragmentCount: number;
    uploadedCount: number;
    status: 'recording' | 'uploading' | 'complete' | 'failed';
}

let db: IDBDatabase | null = null;

/**
 * Initialize the IndexedDB database
 */
export async function initFragmentDb(): Promise<IDBDatabase> {
    if (db) return db;

    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
            console.error('[FragmentDB] Failed to open database:', request.error);
            reject(request.error);
        };

        request.onsuccess = () => {
            db = request.result;
            console.log('[FragmentDB] Database opened successfully');
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const database = (event.target as IDBOpenDBRequest).result;

            // Fragments store
            if (!database.objectStoreNames.contains(FRAGMENTS_STORE)) {
                const fragmentStore = database.createObjectStore(FRAGMENTS_STORE, { keyPath: 'id' });
                fragmentStore.createIndex('sessionId', 'sessionId', { unique: false });
                fragmentStore.createIndex('uploaded', 'uploaded', { unique: false });
                fragmentStore.createIndex('sessionId_uploaded', ['sessionId', 'uploaded'], { unique: false });
            }

            // Sessions store
            if (!database.objectStoreNames.contains(SESSIONS_STORE)) {
                const sessionStore = database.createObjectStore(SESSIONS_STORE, { keyPath: 'id' });
                sessionStore.createIndex('roomId', 'roomId', { unique: false });
                sessionStore.createIndex('status', 'status', { unique: false });
            }

            console.log('[FragmentDB] Database schema created');
        };
    });
}

/**
 * Save a recording fragment
 */
export async function saveFragment(fragment: RecordingFragment): Promise<void> {
    const database = await initFragmentDb();

    return new Promise((resolve, reject) => {
        const transaction = database.transaction(FRAGMENTS_STORE, 'readwrite');
        const store = transaction.objectStore(FRAGMENTS_STORE);
        const request = store.put(fragment);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

/**
 * Get all fragments for a session
 */
export async function getSessionFragments(sessionId: string): Promise<RecordingFragment[]> {
    const database = await initFragmentDb();

    return new Promise((resolve, reject) => {
        const transaction = database.transaction(FRAGMENTS_STORE, 'readonly');
        const store = transaction.objectStore(FRAGMENTS_STORE);
        const index = store.index('sessionId');
        const request = index.getAll(sessionId);

        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
    });
}

/**
 * Get pending (not uploaded) fragments for a session
 */
export async function getPendingFragments(sessionId: string): Promise<RecordingFragment[]> {
    const database = await initFragmentDb();

    return new Promise((resolve, reject) => {
        const transaction = database.transaction(FRAGMENTS_STORE, 'readonly');
        const store = transaction.objectStore(FRAGMENTS_STORE);
        const index = store.index('sessionId');
        const request = index.getAll(sessionId);

        request.onsuccess = () => {
            // Filter for non-uploaded fragments
            const fragments = (request.result || []).filter((f: RecordingFragment) => !f.uploaded);
            resolve(fragments);
        };
        request.onerror = () => reject(request.error);
    });
}

/**
 * Mark a fragment as uploaded
 */
export async function markFragmentUploaded(fragmentId: string): Promise<void> {
    const database = await initFragmentDb();

    return new Promise((resolve, reject) => {
        const transaction = database.transaction(FRAGMENTS_STORE, 'readwrite');
        const store = transaction.objectStore(FRAGMENTS_STORE);
        const getRequest = store.get(fragmentId);

        getRequest.onsuccess = () => {
            const fragment = getRequest.result;
            if (fragment) {
                fragment.uploaded = true;
                const putRequest = store.put(fragment);
                putRequest.onsuccess = () => resolve();
                putRequest.onerror = () => reject(putRequest.error);
            } else {
                resolve();
            }
        };
        getRequest.onerror = () => reject(getRequest.error);
    });
}

/**
 * Increment upload attempt count for a fragment
 */
export async function incrementUploadAttempt(fragmentId: string): Promise<number> {
    const database = await initFragmentDb();

    return new Promise((resolve, reject) => {
        const transaction = database.transaction(FRAGMENTS_STORE, 'readwrite');
        const store = transaction.objectStore(FRAGMENTS_STORE);
        const getRequest = store.get(fragmentId);

        getRequest.onsuccess = () => {
            const fragment = getRequest.result;
            if (fragment) {
                fragment.uploadAttempts = (fragment.uploadAttempts || 0) + 1;
                const putRequest = store.put(fragment);
                putRequest.onsuccess = () => resolve(fragment.uploadAttempts);
                putRequest.onerror = () => reject(putRequest.error);
            } else {
                resolve(0);
            }
        };
        getRequest.onerror = () => reject(getRequest.error);
    });
}

/**
 * Delete all fragments for a session (after successful assembly)
 */
export async function deleteSessionFragments(sessionId: string): Promise<void> {
    const database = await initFragmentDb();
    const fragments = await getSessionFragments(sessionId);

    return new Promise((resolve, reject) => {
        const transaction = database.transaction(FRAGMENTS_STORE, 'readwrite');
        const store = transaction.objectStore(FRAGMENTS_STORE);

        let deleted = 0;
        fragments.forEach(fragment => {
            const request = store.delete(fragment.id);
            request.onsuccess = () => {
                deleted++;
                if (deleted === fragments.length) resolve();
            };
            request.onerror = () => reject(request.error);
        });

        if (fragments.length === 0) resolve();
    });
}

/**
 * Save or update a recording session
 */
export async function saveSession(session: RecordingSession): Promise<void> {
    const database = await initFragmentDb();

    return new Promise((resolve, reject) => {
        const transaction = database.transaction(SESSIONS_STORE, 'readwrite');
        const store = transaction.objectStore(SESSIONS_STORE);
        const request = store.put(session);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

/**
 * Get a recording session by ID
 */
export async function getSession(sessionId: string): Promise<RecordingSession | null> {
    const database = await initFragmentDb();

    return new Promise((resolve, reject) => {
        const transaction = database.transaction(SESSIONS_STORE, 'readonly');
        const store = transaction.objectStore(SESSIONS_STORE);
        const request = store.get(sessionId);

        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
    });
}

/**
 * Get all incomplete sessions (for recovery)
 */
export async function getIncompleteSessions(): Promise<RecordingSession[]> {
    const database = await initFragmentDb();

    return new Promise((resolve, reject) => {
        const transaction = database.transaction(SESSIONS_STORE, 'readonly');
        const store = transaction.objectStore(SESSIONS_STORE);
        const request = store.getAll();

        request.onsuccess = () => {
            const sessions = request.result || [];
            const incomplete = sessions.filter(s => s.status !== 'complete');
            resolve(incomplete);
        };
        request.onerror = () => reject(request.error);
    });
}

/**
 * Generate a unique fragment ID
 */
export function generateFragmentId(sessionId: string, trackType: string, index: number): string {
    return `${sessionId}_${trackType}_${index.toString().padStart(6, '0')}`;
}
