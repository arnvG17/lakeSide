from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from asr import FasterWhisperASR
import logging
import asyncio
import json
import time

app = FastAPI()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ASRService")

# Enable CORS for any app to use this service
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

# Initialize ASR model (Global for simplicity, or per-worker)
# Using base.en for better accuracy (trade-off with speed)
asr_model = FasterWhisperASR(model_size="base.en", device="cpu", compute_type="int8")

@app.websocket("/ws/transcribe")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    logger.info("WebSocket connection established.")
    
    # Track timestamps for subtitle generation
    session_start_time = time.time()
    last_transcript_end_time = 0.0
    
    try:
        while True:
            # Receive audio chunk
            # Expecting bytes (raw PCM)
            data = await websocket.receive_bytes()
            
            # Process audio
            asr_model.process_audio_chunk(data)
            
            # Calculate current time offset from session start
            current_time = time.time() - session_start_time
            
            # Trigger transcription periodically or based on buffer size
            transcript = await asyncio.to_thread(asr_model.transcribe)
            
            if transcript:
                # Calculate timestamps for this segment
                start_time = last_transcript_end_time
                end_time = current_time
                last_transcript_end_time = end_time
                
                # LOGGING: Print the actual text so user can verify it in console
                logger.info(f"Transcript [{start_time:.2f}s - {end_time:.2f}s]: {transcript}")
                
                response = {
                    "type": "final",
                    "text": transcript,
                    "startTime": round(start_time, 3),
                    "endTime": round(end_time, 3)
                }
                await websocket.send_text(json.dumps(response))
                
                # Reset buffer if it gets too long to prevent OOM
                if len(asr_model.audio_buffer) > 16000 * 30: # 30 seconds
                     logger.info("Buffer limit reached, clearing...")
                     asr_model.clear_buffer()

    except WebSocketDisconnect:
        logger.info("Client disconnected")
    except Exception as e:
        logger.error(f"Error: {e}")
        await websocket.close()
