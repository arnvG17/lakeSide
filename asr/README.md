# Open Real-Time ASR Service

A free, high-performance, self-hosted speech-to-text microservice built with **Faster-Whisper** and **FastAPI**.

Designed as a **general-purpose backend** that any application can use for real-time transcription.

## Key Features
*   **Universal**: Usable by Web, Mobile, or Desktop apps via standard WebSockets.
*   **No Auth**: Zero barriers to entry; plug and play.
*   **Real-Time**: Low latency streaming transcription.
*   **Free**: runs on commodity CPU/GPU hardware.

## Directory Structure
*   `main.py`: FastAPI entry point and WebSocket handler.
*   `asr.py`: Transcription logic and audio buffering.
*   `frontend_capture.js`: Sample client-side code for capturing microphone audio and sending it to the service.
*   `Dockerfile`: Container definition for easy deployment.

## Getting Started

### 1. Run using Docker (Recommended)
```bash
docker build -t asr-service .
docker run -p 8000:8000 asr-service
```

### 2. Run Locally
```bash
pip install -r requirements.txt
python -m uvicorn main:app --reload
```

## Testing
You can use the provided `frontend_capture.js` to create a simple test client.
1. Copy the code from `frontend_capture.js` into your browser console or a simple HTML file.
2. Initialize `const streamer = new AudioStreamer('ws://localhost:8000/ws/transcribe');`
3. Call `streamer.start()` and speak into your microphone.
4. Watch the console or `transcript-update` events for live captions.

## Integration
See [integration.md](integration.md) for details on how to use this with your Node.js application.

## Performance
See [performance.md](performance.md) for scaling and hardware notes.
