Video Architecture: Under the Hood
This document explains "how the video gets through" in your application, detailing the journey from the camera lens to the video tile on the screen.

1. The Big Picture: Mesh Network
Your application uses a WebRTC Mesh topology.

There is no central media server processing the video.
Every participant connects directly to every other participant (Peer-to-Peer).
If there are 3 users (A, B, C):
A connects to B
A connects to C
B connects to C
2. Signaling Layer (Socket.io)
Before video can flow, browsers need to find each other. This is "Signaling".

The Handshake Sequence
Join Room: User A joins. Server tells everyone "User A is here".
Offer (WebRTC): User A creates a "Session Description" (Offer) saying:
"I have these video codecs (VP8/H.264)."
"I have these audio codecs (Opus)."
"Here is my fingerprint." User A sends this to User B via the Socket server.
Answer (WebRTC): User B receives the Offer, accepts it, and creates an "Answer".
"I also support these codecs."
"Here is my fingerprint." User B sends this back to User A via Socket.
ICE Candidates: Both sides exchange network info (IP addresses, ports) called ICE Candidates.
"I am at 192.168.1.5"
"I am reachable via this TURN server."
Relevant Functions in Code:

socket.emit("webrtc-offer", ...)
socket.on("webrtc-answer", ...)
socket.on("webrtc-ice-candidate", ...)
3. WebRTC Layer (The Pipe)
Once the handshake is complete, a RTCPeerConnection is open. This is the direct pipe between computers.

Media Tracks
Inside this pipe, we put "Tracks".

Video Track: The actual stream of images from the camera.
Audio Track: The stream of sound from the mic.
How it works in 
Session-ui.tsx
:

Capture: navigator.mediaDevices.getUserMedia grabs the camera.
Add to Pipe: pc.addTrack(track, stream) puts it into the connection.
Receive: pc.ontrack fires on the other side when a new track arrives.
// Receiver Side (Session-ui.tsx)
pc.ontrack = (ev) => {
    // A remote stream just arrived!
    const remoteStream = ev.streams[0];
    // Save it to React State
    addStreamToParticipant(remoteUserId, remoteStream);
};
4. Rendering Layer (React)
This is how the video actually appears in the tile.

The "Tile" Logic
State Update: The 
addStreamToParticipant
 function updates the participants array in React state.

Re-render: React detects the change and re-renders the 
SessionRoom
 component.

The Loop:

{participants.map(p => (
    <div key={p.userId}>
         <video ref={el => attachStreamToVideo(el, p.streams[0])} />
    </div>
))}
The Magic Function: 
attachStreamToVideo
 This is the final step. HTML <video> tags don't understand React props directly for streams. We must use the DOM API srcObject.

const attachStreamToVideo = (el, stream) => {
    // Direct DOM manipulation
    el.srcObject = stream;
    el.play(); // Start the video
}
Summary Checklist
 Camera: Captured via getUserMedia.
 Signaling: Sockets exchanged Offer/Answer/ICE.
 Connection: RTCPeerConnection established P2P.
 Transport: Tracks added to connection.
 State: pc.ontrack updated React state.
 DOM: srcObject assigned to <video> tag.

# 5. The Recording Pipeline: From Fragments to Final Video

This section details how your application records meetings, handles network instability, and produces a final high-quality video file.

## Architecture Overview

Current web recording is fragile. Browser crashes or network drops can lose the entire file. To fix this, we use a **Fragmented Recording & Upload Strategy**.

1.  **Client-Side**: Split recording into small 5-second chunks (Blobs).
2.  **Storage**: Save chunks immediately to IndexedDB (prevent data loss).
3.  **Upload**: Background queue uploads chunks to Supabase Storage.
4.  **Server-Side**: A worker process downloads all chunks and stitches them together using FFmpeg.

---

## Part 1: Client-Side Capture & Fragmentation
**File**: `frontend/src/hooks/useFragmentedRecorder.ts`

### The Setup
We don't just "record". We composite a stream that represents the "Full Meeting View".

1.  **Tab Capture**: We use `navigator.mediaDevices.getDisplayMedia` to capture the entire browser tab.
2.  **Audio Mixing**: We use the Web Audio API (`AudioContext`) to mix:
    *   **Mic Input**: The user's local microphone stream.
    *   **System Audio**: The audio captured from the tab (remote participants).

### The Recorder Loop
We use the `MediaRecorder` API with a `timeslice` of 5000ms.

```typescript
// useFragmentedRecorder.ts
recorder.start(5000); // Trigger 'ondataavailable' every 5 seconds

recorder.ondataavailable = async (event) => {
    // 1. Receive a 5-second video blob
    const blob = event.data;
    
    // 2. Generate a unique ID (sessionId_trackType_index)
    const fragmentId = generateFragmentId(sessionId, 'video', index);

    // 3. Save to Local DB (IndexedDB) immediately
    await saveFragment({
        id: fragmentId,
        blob: blob,
        ...metadata
    });
};
```

## Part 2: Background Upload Queue
**File**: `frontend/src/hooks/useFragmentUploader.ts`

To prevent blocking the UI, a separate hook manages uploads. It functions like a robust background worker.

1.  **Polling**: Checks IndexedDB every 2 seconds for fragments marked `uploaded: false`.
2.  **Uploading**: Sends fragments to `backend/routes/upload.js`.
3.  **Retry Logic**: If an upload fails, it stays in IndexedDB to be retried later.

**Queue Flushing**: When the user clicks "Stop", we call `flushQueue()`, which forces a final upload of all remaining pending fragments before notifying the server.

---

## Part 3: Backend Assembly (The "Stitching")
**File**: `backend/workers/assemblyWorker.js`

Once the recording ends, the frontend calls `/api/upload/complete`. This triggers the default assembly worker.

### Phase 1: Preparation
1.  **Download**: The worker lists all files in the session folder on Supabase (`sessionId/userId/video/*`).
2.  **Local Storage**: It creates a temporary directory (e.g., `/tmp/lakeside-assembly-1234`).
3.  **Manifest Creation**: FFmpeg needs a list of files to join. We generate a text file (`concat_list.txt`):
    ```text
    file 'chunk_000.webm'
    file 'chunk_001.webm'
    file 'chunk_002.webm'
    ...
    ```

### Phase 2: FFmpeg Concatenation
We use the FFmpeg `concat` demuxer. This is efficient because it streams the bits directly without re-encoding (copy mode).

**Command**:
```bash
ffmpeg -f concat -safe 0 -i concat_list.txt -c copy final_output.webm
```
*   `-f concat`: Use fragmentation mode.
*   `-c copy`: **Crucial**. Copies video/audio streams directly. Zero quality loss, incredibly fast.

### Phase 3: Finalization
1.  **Upload**: The stitched `final_video.webm` is uploaded back to the session folder.
2.  **Cleanup**: Temporary files are deleted.

---

## Part 4: Grid Assembly (Legacy Support)
**File**: `backend/scripts/gridAssemble.js`

For older recordings where we only captured individual faces, we use a more complex FFmpeg filter to create a "Zoom-style" grid.

**The Complexity**: Unlike simple concatenation, this requires **re-encoding** because we are altering the video frames (scaling and positioning).

### The Logic
1.  **Inputs**: We download `final_video.webm` for every participant.
2.  **Layout Calculation**:
    *   2 Users: Split screen (Left/Right).
    *   4 Users: 2x2 Grid.
3.  **Filter Graph (`-filter_complex`)**:

**Example (2 Users)**:
```bash
"[0:v]scale=640:360[v0]; [1:v]scale=640:360[v1]; [v0][v1]xstack=inputs=2:layout=0_0|640_0[v]"
```
*   `scale`: Resize everyone to uniform 640x360.
*   `xstack`: The magic filter. Stacks inputs horizontally/vertically based on coordinate layout (`0_0` is top-left, `640_0` is top-right).
*   `amix`: Mixes all audio tracks into one.

This produces a new `multi_view.webm` which is verified and served by the API.