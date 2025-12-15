# Generic ASR Service API Documentation

This service provides a real-time speech-to-text API via WebSocket. It is designed to be consumed by **any** application (Web, Mobile, Desktop) that can stream raw audio.

## Base URL
```
ws://<YOUR_SERVER_IP>:8000/ws/transcribe
```

## Authentication
**None**. This service is open and does not require headers, tokens, or API keys.

---

## Protocol Specification

### 1. Connection
*   Connect to the WebSocket URL.
*   The connection remains open for streaming audio.

### 2. Input Format (Client -> Server)
*   **Data Type**: Binary Message (Blob/ArrayBuffer).
*   **Format**: Raw PCM (Pulse Code Modulation).
*   **Sample Rate**: 16000 Hz.
*   **Channels**: Mono (1 channel).
*   **Bit Depth**: 16-bit signed integer (Little Endian).

**JavaScript Example (Browser):**
```javascript
// Assuming you have a Float32Array from AudioContext/ScriptProcessor
const pcm16 = new Int16Array(inputData.length);
for (let i = 0; i < inputData.length; i++) {
    // Clamp to [-1, 1] and scale to Int16
    const s = Math.max(-1, Math.min(1, inputData[i]));
    pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
}
socket.send(pcm16.buffer);
```

### 3. Output Format (Server -> Client)
*   **Data Type**: Text Message (JSON String).
*   **Structure**:
    ```json
    {
      "type": "partial" | "final",
      "text": "The transcribed text..."
    }
    ```

*   `type`: 
    *   `partial`: Interim result (e.g., while the user is still speaking).
    *   `final`: Completed sentence/phrase.
*   `text`: The actual transcription string.

**Example Response:**
```json
{"type": "partial", "text": "Hello world"}
```

---

## Usage Examples

### Python (Client)
Using `websockets` library:
```python
import asyncio
import websockets

async def stream_audio():
    async with websockets.connect("ws://localhost:8000/ws/transcribe") as websocket:
        # Send raw PCM bytes
        with open("audio_16k.pcm", "rb") as f:
            while chunk := f.read(4096):
                await websocket.send(chunk)
                
                # Check for response (non-blocking in real app)
                try:
                    response = await asyncio.wait_for(websocket.recv(), timeout=0.1)
                    print(response)
                except:
                    pass

asyncio.run(stream_audio())
```

### React / JS
See `frontend_capture.js` for a complete example using `AudioWorklet` or `ScriptProcessor`.
