/**
 * Frontend Audio Capture & Streaming Logic
 * 
 * This module handles:
 * 1. Accessing the microphone via getUserMedia
 * 2. Setting up an AudioWorklet or ScriptProcessor (simpler for this demo) for raw access
 * 3. Downsampling to 16kHz mono
 * 4. Converting to Int16 PCM
 * 5. Streaming via WebSocket to the ASR service
 */

const SAMPLE_RATE = 16000;

class AudioStreamer {
    constructor(socketUrl) {
        this.socketUrl = socketUrl;
        this.socket = null;
        this.audioContext = null;
        this.processor = null;
        this.input = null;
    }

    async start() {
        try {
            this.socket = new WebSocket(this.socketUrl);

            this.socket.onopen = () => {
                console.log("Connected to ASR service");
            };

            this.socket.onmessage = (event) => {
                const response = JSON.parse(event.data);
                console.log("Transcript received:", response);
                // Dispatch custom event or callback to update UI
                document.dispatchEvent(new CustomEvent('transcript-update', { detail: response }));
            };

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
            this.input = this.audioContext.createMediaStreamSource(stream);

            // Using ScriptProcessor for wider compatibility in older browsers/simpler demo
            // In production, prefer AudioWorklet
            this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

            this.processor.onaudioprocess = (e) => {
                if (this.socket && this.socket.readyState === WebSocket.OPEN) {
                    const inputData = e.inputBuffer.getChannelData(0);
                    const pcmData = this.floatTo16BitPCM(inputData);
                    this.socket.send(pcmData);
                }
            };

            this.input.connect(this.processor);
            this.processor.connect(this.audioContext.destination);

        } catch (error) {
            console.error("Error starting audio stream:", error);
        }
    }

    stop() {
        if (this.processor) {
            this.processor.disconnect();
            this.input.disconnect();
        }
        if (this.audioContext) {
            this.audioContext.close();
        }
        if (this.socket) {
            this.socket.close();
        }
    }

    floatTo16BitPCM(input) {
        const output = new Int16Array(input.length);
        for (let i = 0; i < input.length; i++) {
            const s = Math.max(-1, Math.min(1, input[i]));
            output[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        return output.buffer;
    }
}

// Usage Example:
// const streamer = new AudioStreamer('ws://localhost:8000/ws/transcribe');
// document.getElementById('start-btn').onclick = () => streamer.start();
// document.getElementById('stop-btn').onclick = () => streamer.stop();
