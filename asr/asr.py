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
        self.model = WhisperModel(model_size, device=device, compute_type=compute_type)
        logger.info("Model loaded successfully.")
        
        # Buffer to hold audio data
        # We expect 16kHz mono audio. 
        self.audio_buffer = np.array([], dtype=np.float32)
        
        # Configuration for VAD and transcription
        self.sample_rate = 16000
        self.vad_threshold = 0.5 # Simple energy-based or we rely on Whisper's VAD
        
    def process_audio_chunk(self, audio_chunk_bytes: bytes):
        """
        Process a raw PCM audio chunk (16-bit signed integer, 16kHz mono).
        """
        # Convert bytes to numpy array (int16)
        audio_int16 = np.frombuffer(audio_chunk_bytes, dtype=np.int16)
        
        # Convert to float32 and normalize to [-1, 1]
        audio_float32 = audio_int16.astype(np.float32) / 32768.0
        
        # Append to buffer
        self.audio_buffer = np.concatenate((self.audio_buffer, audio_float32))
        
    def transcribe(self):
        """
        Transcribe the current buffer and return segments.
        This is a generator that yields partial/final results.
        For simplicity in this streaming demo, we will transcribe the whole buffer 
        each time sufficient data is available, or use a sliding window.
        
        Real-time streaming with Whisper is tricky because it expects a full context.
        A common simple strategy:
        1. Accumulate audio.
        2. Transcribe the last N seconds (plus context).
        3. Diff with previous result (optional) or just send latest.
        """
        
        if len(self.audio_buffer) < self.sample_rate * 1.0: 
            # Wait until we have at least 1 second of audio
            return
            
        # Run transcription on the current buffer
        # beam_size=5 is good for accuracy, but slower. 1 is faster.
        segments, info = self.model.transcribe(
            self.audio_buffer, 
            beam_size=5, 
            language="en", 
            condition_on_previous_text=False,
            vad_filter=True,
            vad_parameters=dict(min_silence_duration_ms=500)
        )
        
        # Collect text from segments
        full_text = ""
        for segment in segments:
            full_text += segment.text + " "
            
        return full_text.strip()
        
    def clear_buffer(self):
        """
        Clear the audio buffer.
        """
        self.audio_buffer = np.array([], dtype=np.float32)
