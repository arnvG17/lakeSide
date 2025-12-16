import numpy as np
from faster_whisper import WhisperModel
import logging
import io

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("FasterWhisperASR")

class FasterWhisperASR:
    def __init__(self, model_size="tiny", device="cpu", compute_type="int8"):
        """
        Initialize the Faster-Whisper model.
        """
        logger.info(f"Loading Faster-Whisper model: {model_size} on {device} with {compute_type}...")
        # OPTIMIZATION: cpu_threads=1 reduces memory overhead significantly
        self.model = WhisperModel(model_size, device=device, compute_type=compute_type, cpu_threads=1)
        logger.info("Model loaded successfully.")
        
        # Buffer to hold audio data
        # OPTIMIZATION: Store as int16 (2 bytes) instead of float32 (4 bytes) to save 50% RAM
        self.audio_buffer = np.array([], dtype=np.int16)
        
        # Configuration for VAD and transcription
        self.sample_rate = 16000
        
    def process_audio_chunk(self, audio_chunk_bytes: bytes):
        """
        Process a raw PCM audio chunk (16-bit signed integer, 16kHz mono).
        """
        # Convert bytes to numpy array (int16)
        audio_int16 = np.frombuffer(audio_chunk_bytes, dtype=np.int16)
        
        # Append directly as int16
        self.audio_buffer = np.concatenate((self.audio_buffer, audio_int16))
        
    def transcribe(self):
        """
        Transcribe the current buffer.
        """
        # SLIDING WINDOW: Keep only last 30s (16k * 30 = 480k samples)
        MAX_SAMPLES = 480000
        if len(self.audio_buffer) > MAX_SAMPLES:
            self.audio_buffer = self.audio_buffer[-MAX_SAMPLES:]

        # Wait for at least 3 seconds of audio for better accuracy
        if len(self.audio_buffer) < self.sample_rate * 3.0: 
            return

        # OPTIMIZATION: Energy-based VAD (Skip inference if silent)
        # Check last 1 second amplitude
        last_second = self.audio_buffer[-16000:]
        # Convert to float just for check (cheap)
        max_amp = np.max(np.abs(last_second.astype(np.float32) / 32768.0))
        
        if max_amp < 0.01:
            # DEBUG level to avoid spamming the console
            logger.debug(f"Silence ({max_amp:.4f})")
            return ""

        # logger.info(f"Processing audio chunk (Amp: {max_amp:.4f})")

        # Convert to float32 only when needed for model
        audio_float32 = self.audio_buffer.astype(np.float32) / 32768.0

        # beam_size=5 for accuracy (slower but better)
        segments, info = self.model.transcribe(
            audio_float32, 
            beam_size=5, 
            best_of=5,
            language="en", 
            condition_on_previous_text=False,
            vad_filter=True,
            vad_parameters=dict(min_silence_duration_ms=700)
        )
        
        full_text = ""
        for segment in segments:
            full_text += segment.text + " "
        
        result = full_text.strip()
        
        # IMPORTANT: Clear buffer after successful transcription to prevent repeats
        if result:
            self.audio_buffer = np.array([], dtype=np.int16)
            
        return result
        
    def clear_buffer(self):
        self.audio_buffer = np.array([], dtype=np.int16)
