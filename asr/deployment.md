# Deployment & Testing Guide

This guide covers two ways to expose your ASR service:
1.  **Ngrok (Recommended for Development)**: Instantly share your local server with the world (e.g., test on mobile).
2.  **Render (Production)**: Deploy to a cloud provider using Docker.

---

## Option 1: Ngrok (Fastest for Testing)
If you want to test on your phone or with a friend while the code is still on your laptop, use `ngrok`. It creates a secure tunnel to your localhost.

### 1. Install Ngrok
*   **Mac/Linux**: `brew install ngrok`
*   **Windows**: [Download from ngrok.com](https://ngrok.com/download)

### 2. Start the Tunnel
Assuming your ASR service is running on port `8000`:
```bash
ngrok http 8000
```

### 3. Update Frontend
Ngrok will give you a URL like `https://abc-123.ngrok-free.app`.
Update your `Session-ui.tsx`:

```javascript
// Note: Use wss:// for secure WebSockets
const { ... } = useTranscription("wss://abc-123.ngrok-free.app/ws/transcribe");
```

---

## Option 2: Deploy to Render (Free Tier)
Render can host Docker containers. **Note:** The free tier might be slow for real-time AI, but it works for demos.

### 1. Create a `render.yaml` (Optional, or setup via UI)
You can simply connect your GitHub repo to Render.

### 2. Render Configuration
1.  Go to [dashboard.render.com](https://dashboard.render.com/).
2.  Click **New +** -> **Web Service**.
3.  Connect your GitHub repository.
4.  Select **Docker** as the Runtime.
5.  **Region**: Choose closest to you.
6.  **Instance Type**: Free (or Starter for better CPU).
7.  **Environment Variables**:
    *   `PORT`: `8000`

### 3. Build & Deploy
Render will auto-build your `Dockerfile`. This may take 5-10 minutes.

### 4. Get URL
Render provides a URL like `https://my-asr-service.onrender.com`.
Update your frontend:
```javascript
const { ... } = useTranscription("wss://my-asr-service.onrender.com/ws/transcribe");
```

---

## Troubleshooting
*   **Mixed Content Error**: If your frontend is `https`, your WebSocket MUST be `wss`. Both Ngrok and Render provide SSL automatically, so always use `wss://`.
*   **Lag**: Localhost/Ngrok will be faster than Render Free Tier because your laptop CPU is likely more powerful than the shared free cloud web service.
