# Node.js Integration Guide

This guide explains how to integrate the Python ASR microservice into your existing Node.js + WebRTC application.

## Architecture

1.  **Client (Browser)**: Captures audio, downsamples it to 16kHz mono PCM, and streams it.
2.  **ASR Service (Python/FastAPI)**: Receives PCM chunks via WebSocket, runs Faster-Whisper, and returns text.
3.  **Application Server (Node.js)**: Orchestrates rooms and user sessions.

## Integration Options

### Option A: Direct Client -> ASR Service (Recommended for Low Latency)
The browser connects directly to the ASR service WebSocket (`ws://asr-service:8000/ws/transcribe`).

**Pros**: Lowest latency, less load on Node.js server.
**Cons**: Requires exposing the ASR port to the public internet or handling CORS/Auth carefully.

**Implementation**:
1. Run the ASR Docker container exposing port 8000.
2. In your React frontend, use the `AudioStreamer` class provided in `frontend_capture.js`.
3. Point WebSockets to `ws://localhost:8000/ws/transcribe` (or your public IP).

### Option B: Node.js Proxy (Better Security/Control)
The browser sends audio to the Node.js server (e.g., via existing Socket.io or a custom WebSocket), and the Node.js server forwards it to the Python ASR service.

**Pros**: Centralized authentication, single public endpoint.
**Cons**: Higher latency (double hop), higher CPU load on Node.js.

## Attaching Transcripts to Rooms
Regardless of the connection method, you likely want to broadcast transcripts to all users in a room.

1.  **Client-Side Broadcast**: When the client receives a transcript from the ASR service (Option A), it emits a socket event to the Node.js server:
    ```javascript
    socket.emit('send-transcript', { roomId, text: transcript.text });
    ```
2.  **Server-Side Broadcast**: The Node.js server relays this text to other room participants:
    ```javascript
    // In your Node.js socket handler
    socket.on('send-transcript', (data) => {
      socket.to(data.roomId).emit('transcript-received', {
        userId: socket.id,
        text: data.text,
        timestamp: Date.now()
      });
    });
    ```

## Handling Auth
For a production app, the ASR service should verify a token.
*   **Simple**: Pass a query param `?token=xyz` in the WebSocket URL.
*   **FastAPI**: Add a dependency to validate the token against your DB or JWT secret.
