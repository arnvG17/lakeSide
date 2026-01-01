from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from asr import FasterWhisperASR
import logging
import asyncio
import json

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
    
    try:
        while True:
            # Receive audio chunk
            # Expecting bytes (raw PCM)
            data = await websocket.receive_bytes()
            
            # Process audio
            asr_model.process_audio_chunk(data)
            
            # Trigger transcription periodically or based on buffer size
            # For this simple streaming example, we'll try to transcribe after every chunk 
            # BUT: In a real app, you'd buffer more and use a separate task/thread loop
            # to avoid blocking the receiving loop.
            
            # HACK: For demo, just transcribe every 1 second worth of data roughly
            # This is blocking, production should use asyncio.to_thread
            transcript = await asyncio.to_thread(asr_model.transcribe)
            
            if transcript:
                # LOGGING: Print the actual text so user can verify it in console
                logger.info(f"Transcript: {transcript}")
                
                response = {
                    "type": "partial", # or final logic
                    "text": transcript
                }
                await websocket.send_text(json.dumps(response))
                
                # Simple strategy: clear buffer after some time or silence?
                # For continuous streaming, we need a better sliding window.
                # Here we just keep appending which is memory leak eventually 
                # and gets slower. 
                # A proper implementation needs a ring buffer or context window management.
                
                # Reset buffer if it gets too long (e.g. 10MB) to prevent OOM in this demo
                if len(asr_model.audio_buffer) > 16000 * 30: # 30 seconds
                     # In a real app, you would keep the last few seconds for context
                     # and discard the rest.
                     logger.info("Buffer limit reached, clearing...")
                     asr_model.clear_buffer()

    except WebSocketDisconnect:
        logger.info("Client disconnected")
    except Exception as e:
        logger.error(f"Error: {e}")
        await websocket.close()
