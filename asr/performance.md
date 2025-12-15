# Performance & Scaling Notes

## Hardware Requirements
*   **CPU**: Faster-Whisper is highly optimized for CPU. A modern dual-core CPU can handle real-time `tiny` or `base` models.
*   **GPU**: For higher quality models (`small`, `medium`) or higher concurrency, a GPU (NVIDIA) is recommended. Pass `device="cuda"` in `asr.py`.
*   **RAM**: ~1GB per worker for `tiny` model.

## Concurrency
*   We use `asyncio` for the WebSocket loop, but `asr_model.transcribe` is a blocking CPU-bound operation.
*   To scale, you run **multiple workers** using Gunicorn/Uvicorn or multiple replicas in Kubernetes/Docker Swarm.

`uvicorn main:app --workers 4`

## Latency
*   **Network**: ~50-100ms
*   **Buffering**: We wait for ~1s of audio. This is the main latency floor.
*   **Inference**: `tiny` model on CPU takes ~100-300ms for 1s of audio.
*   **Total Latency**: ~1.5s (acceptable for live captions).

## Tuning
*   **Chunk Size**: Sending smaller chunks (100ms) over WebSocket is fine, but the ASR model needs context (at least 1s, ideally more).
*   **Voice Activity Detection (VAD)**: The current implementation sends everything to Whisper. Using a dedicated lightweight VAD (like Silero VAD) *before* Whisper can save massive compute by skipping silence.

## Scaling Strategy
1.  **Load Balancer**: Nginx/Traefik in front of multiple Python containers.
2.  **Queue**: For *offline* transcription, use RabbitMQ/Celery. For *real-time*, direct WebSocket connection to a stateful worker is best.
