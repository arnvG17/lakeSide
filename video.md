Video Architecture: Under the Hood
This document explains "how the video gets through" in your application, detailing the journey from the camera lens to the video tile on the screen.

1. The Big Picture: Mesh Network
Your application uses a WebRTC Mesh topology.

There is no central media server processing the video.
Every participant connects directly to every other participant (Peer-to-Peer).
If there are 3 users (A, B, C):
A connects to B
A connects to C
B connects to C
2. Signaling Layer (Socket.io)
Before video can flow, browsers need to find each other. This is "Signaling".

The Handshake Sequence
Join Room: User A joins. Server tells everyone "User A is here".
Offer (WebRTC): User A creates a "Session Description" (Offer) saying:
"I have these video codecs (VP8/H.264)."
"I have these audio codecs (Opus)."
"Here is my fingerprint." User A sends this to User B via the Socket server.
Answer (WebRTC): User B receives the Offer, accepts it, and creates an "Answer".
"I also support these codecs."
"Here is my fingerprint." User B sends this back to User A via Socket.
ICE Candidates: Both sides exchange network info (IP addresses, ports) called ICE Candidates.
"I am at 192.168.1.5"
"I am reachable via this TURN server."
Relevant Functions in Code:

socket.emit("webrtc-offer", ...)
socket.on("webrtc-answer", ...)
socket.on("webrtc-ice-candidate", ...)
3. WebRTC Layer (The Pipe)
Once the handshake is complete, a RTCPeerConnection is open. This is the direct pipe between computers.

Media Tracks
Inside this pipe, we put "Tracks".

Video Track: The actual stream of images from the camera.
Audio Track: The stream of sound from the mic.
How it works in 
Session-ui.tsx
:

Capture: navigator.mediaDevices.getUserMedia grabs the camera.
Add to Pipe: pc.addTrack(track, stream) puts it into the connection.
Receive: pc.ontrack fires on the other side when a new track arrives.
// Receiver Side (Session-ui.tsx)
pc.ontrack = (ev) => {
    // A remote stream just arrived!
    const remoteStream = ev.streams[0];
    // Save it to React State
    addStreamToParticipant(remoteUserId, remoteStream);
};
4. Rendering Layer (React)
This is how the video actually appears in the tile.

The "Tile" Logic
State Update: The 
addStreamToParticipant
 function updates the participants array in React state.

Re-render: React detects the change and re-renders the 
SessionRoom
 component.

The Loop:

{participants.map(p => (
    <div key={p.userId}>
         <video ref={el => attachStreamToVideo(el, p.streams[0])} />
    </div>
))}
The Magic Function: 
attachStreamToVideo
 This is the final step. HTML <video> tags don't understand React props directly for streams. We must use the DOM API srcObject.

const attachStreamToVideo = (el, stream) => {
    // Direct DOM manipulation
    el.srcObject = stream;
    el.play(); // Start the video
}
Summary Checklist
 Camera: Captured via getUserMedia.
 Signaling: Sockets exchanged Offer/Answer/ICE.
 Connection: RTCPeerConnection established P2P.
 Transport: Tracks added to connection.
 State: pc.ontrack updated React state.
 DOM: srcObject assigned to <video> tag.