# ⭐ LAKESIDE AUTH SYSTEM — FULL SUMMARY (VERY EASY EXPLANATION)

Below is the full story of what happens from the moment a user clicks “Sign in with Google” to the moment they appear inside your app dashboard with a synced Prisma user.

----------------------------------------------------------------

# 🔵 STEP 1 — User clicks “Sign in with Google” on Next.js

Frontend calls:

supabase.auth.signInWithOAuth({ provider: "google" })

What happens:

1. User is redirected to Google OAuth.
2. Google asks email permission.
3. Google returns user → redirects the browser to:

    /auth/callback?code=12345

This `code` is useless by itself.
It must be exchanged for a session.

----------------------------------------------------------------

# 🔵 STEP 2 — Next.js `/auth/callback` route receives the `code`

Your callback file:

const { data } = await supabase.auth.exchangeCodeForSession(code);

What happens here:

✔ Supabase verifies the Google OAuth code  
✔ Supabase creates a session  
✔ Supabase sets secure HTTP-only cookies in Next.js  
   - sb-access-token  
   - sb-refresh-token  
✔ You now have:  
   - data.session.access_token  
   - data.user.id  
   - data.user.email  

➡️ The user is now officially logged into the frontend.

----------------------------------------------------------------

# 🔵 STEP 3 — Next.js logs login to your backend

Next.js calls:

POST /api/auth/log-login

with:

{
  "userId": "...",
  "email": "...",
  "timestamp": "..."
}

Your backend inserts a row into `login_logs` (Supabase DB).

----------------------------------------------------------------

# 🔵 STEP 4 — Next.js securely syncs user to backend Prisma

This is the MOST IMPORTANT PART.

Your Next.js frontend calls:

POST /api/auth/sync-user  
Authorization: Bearer <access_token>

⚠️ This is where authentication is verified.

Backend receives:

Authorization: Bearer eyJhbGciOiJIUz...

----------------------------------------------------------------

# 🔵 STEP 5 — Backend verifies access token using “Service Role Key”

Backend code:

const { data, error } = await supabaseAdmin.auth.getUser(token);

What happens:

✔ Supabase decodes the JWT token  
✔ Checks signature  
✔ Confirms token is valid  
✔ Confirms user identity  
✔ Returns:

{
  "id": "user-uuid",
  "email": "user@gmail.com"
}

⚠️ THIS is how backend knows which user is real.
No body data is trusted.
Only the JWT token is trusted.

----------------------------------------------------------------

# 🔵 STEP 6 — Backend updates your own Prisma `User` table

Backend does:

await prisma.user.upsert({
  where: { id: supaUser.id },
  update: { email: supaUser.email },
  create: { id: supaUser.id, email: supaUser.email }
});

Meaning:

✔ If user exists → update email  
✔ If new user → create first record  
✔ No duplicates ever  

Finally backend returns user data + rooms list.

----------------------------------------------------------------

# 🔵 STEP 7 — User officially enters Lakeside dashboard

At this moment:

Frontend knows the user (Supabase cookies)

Backend knows the user (Prisma upsert)

Your system is ready to:

- Create rooms  
- Join rooms  
- Authenticate sockets  
- Track recordings  
- Build dashboards  
- Manage teams  

This is how professional systems work.

----------------------------------------------------------------

# 🔥 SUPER SIMPLE FLOW DIAGRAM

(User clicks Login)
        ↓
[1] Next.js → Google OAuth
        ↓
[2] Google sends ?code=XYZ to Next.js
        ↓
[3] Next.js → exchangeCodeForSession() → Supabase creates session
        ↓
[4] Supabase sets cookies → user logged in on FRONTEND
        ↓
[5] Next.js → POST /log-login → backend logs login
        ↓
[6] Next.js → POST /sync-user (Bearer token)
        ↓
[7] Backend verifies token using SERVICE ROLE KEY
        ↓
[8] Backend → Upsert user in Prisma DB
        ↓
[9] Backend returns user dashboard data
        ↓
[10] User enters Lakeside dashboard

----------------------------------------------------------------

# ⭐ TL;DR — ULTIMATE SUMMARY

- Google authenticates the user  
- Supabase creates a session  
- Frontend logs user into Next.js (cookies)  
- Frontend sends JWT token to backend  
- Backend verifies token using service role key  
- Backend inserts user into Prisma  
- Backend loads user's rooms/recordings  
- Dashboard loads  

----------------------------------------------------------------
# ⭐ APPENDED SECTION: HOW LAKESIDE CHAT WORKS
----------------------------------------------------------------

# 🔵 CHAT SYSTEM OVERVIEW

The chat system uses:

✔ Socket.IO for real-time messages  
✔ RoomStore for chat history  

This ensures new users get past messages instantly, and all users receive messages in real time.

----------------------------------------------------------------

# 🔵 STEP 1 — User joins room → receives chat history

The frontend sends `join-room`, and then the server sends:

    socket.emit("chat-history", RoomStore.getMessages(roomId));

The user immediately sees all past messages.

----------------------------------------------------------------

# 🔵 STEP 2 — User sends a chat message

Frontend:

    socket.emit("send-message", { roomId, text });

Backend:

    RoomStore.addMessage(roomId, message);

Messages include:

- userId  
- email  
- text  
- timestamp  

----------------------------------------------------------------

# 🔵 STEP 3 — Backend broadcasts the message

    io.to(roomId).emit("receive-message", message);

All participants update instantly.

----------------------------------------------------------------

# 🔵 CHAT SUMMARY

✔ Real-time messaging  
✔ Chat history stored in memory  
✔ New participants see previous messages  
✔ UI stays synced on refresh  
✔ Upgradable to Redis with zero code changes in handlers  

----------------------------------------------------------------
# ⭐ APPENDED SECTION: HOW LAKESIDE SCREEN SHARING WORKS (DETAILED)
----------------------------------------------------------------

Screen sharing in Lakeside uses a **two-layer architecture**: the **Signaling Layer** (coordination) and the **Media Layer** (actual video transmission via WebRTC).

---

## 🏗️ HIGH-LEVEL ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────┐
│                    SCREEN SHARE SYSTEM                       │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Layer 1: SIGNALING (Socket.IO + RoomStore)                 │
│  ├─ Tracks who is sharing                                    │
│  ├─ Broadcasts start/stop events                            │
│  └─ Manages permissions & state                             │
│                                                               │
│  Layer 2: MEDIA (WebRTC)                                     │
│  ├─ Captures screen via getDisplayMedia()                    │
│  ├─ Creates peer connections                                │
│  ├─ Sends video tracks to other users                       │
│  └─ Receives & displays remote screen streams              │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

The **Signaling Layer** enables the **Media Layer** by coordinating WHO can share and WHEN.

---

## 📁 FILE STRUCTURE

### Backend Files

#### 1. `backend/routes/screenShare.js` (66 lines)
**Purpose**: Socket.IO event handlers for screen sharing signaling

**Key Exports**: 
- `registerScreenShareHandlers(io, socket)` - Main handler registration function

**Events Handled**:
- `start-screen-share` - User wants to start sharing
- `stop-screen-share` - User wants to stop sharing  
- `disconnect` - Cleanup when user disconnects

---

#### 2. `backend/store/roomStore.js` (96 lines)
**Purpose**: In-memory state management for rooms

**Screen Share Methods**:
- `addScreenSharer(roomId, userId)` - Add user to sharer set
- `removeScreenSharer(roomId, userId)` - Remove user from sharer set
- `getScreenSharers(roomId)` - Get array of current sharers

**Data Structure**:
```javascript
{
  roomId: {
    users: {},
    chat: [],
    screenSharers: Set<userId>  // Multiple users can share
  }
}
```

---

### Frontend Files

#### 3. `lakeside-monochrome-session-ui/src/components/pages/Session-ui.tsx` (830 lines)
**Purpose**: Main session UI component with WebRTC logic

**Screen Share Functions**:
- `startScreenShare()` - Initiate screen sharing
- `stopScreenShare()` - End screen sharing
- `handleScreenShare()` - Button click handler
- `createPeerConnection(userId)` - Create WebRTC peer connection
- `attachStreamToVideo(el, stream)` - Attach MediaStream to video element

**State Variables**:
- `screenSharers` - Set of user IDs currently sharing
- `localScreenRef` - Reference to local screen MediaStream
- `peersRef` - Map of userId → RTCPeerConnection
- `featuredTile` - Which stream is displayed in main view

---

## 🔧 DETAILED FUNCTION BREAKDOWN

### Backend Functions

#### `registerScreenShareHandlers(io, socket)`
**File**: `backend/routes/screenShare.js`

Registers three event listeners on each socket connection.

---

#### Event: `start-screen-share`
**Triggered by**: User clicks "Share Screen" button  
**Receives**: `{ roomId }`

**Logic**:
1. Extract `roomId` from event payload
2. Call `RoomStore.addScreenSharer(roomId, socket.user.id)`
3. Broadcast to room: `io.to(roomId).emit("screen-share-started", { userId, email })`

**Result**: All users in room receive notification that sharing started

```javascript
socket.on("start-screen-share", ({ roomId }) => {
    RoomStore.addScreenSharer(roomId, socket.user.id);
    io.to(roomId).emit("screen-share-started", {
        userId: socket.user.id,
        email: socket.user.email
    });
});
```

---

#### Event: `stop-screen-share`
**Triggered by**: User clicks "Stop Share" or closes share  
**Receives**: `{ roomId }`

**Logic**:
1. Verify user is actually sharing: `RoomStore.getScreenSharers(roomId).includes(userId)`
2. If yes, call `RoomStore.removeScreenSharer(roomId, userId)`
3. Broadcast: `io.to(roomId).emit("screen-share-stopped", { userId })`

**Result**: All users notified that sharing stopped

```javascript
socket.on("stop-screen-share", ({ roomId }) => {
    const sharers = RoomStore.getScreenSharers(roomId);
    if (!sharers.includes(socket.user.id)) return;
    
    RoomStore.removeScreenSharer(roomId, socket.user.id);
    io.to(roomId).emit("screen-share-stopped", { userId: socket.user.id });
});
```

---

#### Event: `disconnect`
**Triggered by**: User closes tab, loses connection, or leaves room  

**Logic**:
1. Check if disconnecting user was sharing
2. If yes, clean up: remove from RoomStore
3. Notify room that sharing stopped

**Result**: Screen share auto-stops when user disconnects

```javascript
socket.on("disconnect", () => {
    const sharers = RoomStore.getScreenSharers(roomId);
    if (sharers.includes(socket.user.id)) {
        RoomStore.removeScreenSharer(roomId, socket.user.id);
        io.to(roomId).emit("screen-share-stopped", { userId: socket.user.id });
    }
});
```

---

### Frontend Functions

#### `startScreenShare()`
**File**: `Session-ui.tsx` (lines 195-260)  
**Trigger**: User clicks screen share button

**Step-by-Step Flow**:

1. **Check socket connection**
   ```typescript
   if (!socketRef.current) {
       toast.error("Socket not connected");
       return;
   }
   ```

2. **Emit signaling event to backend**
   ```typescript
   socketRef.current.emit("start-screen-share", { roomId });
   ```

3. **Request screen capture from browser**
   ```typescript
   const screenStream = await navigator.mediaDevices.getDisplayMedia({ 
       video: true, 
       audio: false 
   });
   localScreenRef.current = screenStream;
   ```

4. **Attach to local preview video element**
   ```typescript
   if (localPreviewRef.current) {
       localPreviewRef.current.srcObject = screenStream;
       await localPreviewRef.current.play();
   }
   ```

5. **Auto-stop when user stops sharing from browser**
   ```typescript
   const vtrack = screenStream.getVideoTracks()[0];
   vtrack.onended = () => stopScreenShare();
   ```

6. **Create/update peer connections for each participant**
   ```typescript
   for (const p of participants) {
       if (p.isLocal) continue;
       
       const pc = createPeerConnection(p.userId);
       screenStream.getTracks().forEach(track => 
           pc.addTrack(track, screenStream)
       );
       
       const offer = await pc.createOffer();
       await pc.setLocalDescription(offer);
       
       socketRef.current.emit("webrtc-offer", {
           roomId,
           targetUserId: p.userId,
           offer: pc.localDescription
       });
   }
   ```

**Error Handling**:
- If `getDisplayMedia()` fails (user denies permission), emit `stop-screen-share`
- Prevents orphaned server state

---

#### `stopScreenShare()`
**File**: `Session-ui.tsx` (lines 265-300)  
**Trigger**: User clicks "Stop Share" or browser share ends

**Step-by-Step Flow**:

1. **Stop all screen tracks**
   ```typescript
   if (localScreenRef.current) {
       localScreenRef.current.getTracks().forEach(t => t.stop());
   }
   ```

2. **Remove screen stream from local participant state**
   ```typescript
   setParticipants(prev => prev.map(p => 
       p.userId === myId 
           ? { ...p, streams: p.streams?.filter(s => s.active) } 
           : p
   ));
   ```

3. **Remove video senders from all peer connections**
   ```typescript
   Object.values(peersRef.current).forEach(pc => {
       pc.getSenders().forEach(sender => {
           if (sender.track?.kind === "video") {
               pc.removeTrack(sender);
           }
       });
   });
   ```

4. **Notify backend**
   ```typescript
   socketRef.current.emit("stop-screen-share", { roomId });
   ```

5. **Clear local references**
   ```typescript
   localPreviewRef.current.srcObject = null;
   localScreenRef.current = null;
   ```

---

#### `createPeerConnection(remoteUserId)`
**File**: `Session-ui.tsx` (lines 148-190)  
**Purpose**: Factory function for RTCPeerConnection instances

**Logic**:

1. **Return existing connection if already created**
   ```typescript
   if (peersRef.current[remoteUserId]) 
       return peersRef.current[remoteUserId];
   ```

2. **Create new peer connection**
   ```typescript
   const pc = new RTCPeerConnection(ICE_CONFIG);
   peersRef.current[remoteUserId] = pc;
   ```

3. **Add local screen tracks (if sharing)**
   ```typescript
   if (localScreenRef.current) {
       localScreenRef.current.getTracks().forEach(track =>
           pc.addTrack(track, localScreenRef.current!)
       );
   }
   ```

4. **Setup ICE candidate handler**
   ```typescript
   pc.onicecandidate = (ev) => {
       if (ev.candidate && socketRef.current) {
           socketRef.current.emit("webrtc-ice-candidate", {
               roomId,
               targetUserId: remoteUserId,
               candidate: ev.candidate
           });
       }
   };
   ```

5. **Setup remote track handler**
   ```typescript
   pc.ontrack = (ev) => {
       const remoteStream = ev.streams[0];
       addStreamToParticipant(remoteUserId, remoteStream);
   };
   ```

6. **Setup connection state cleanup**
   ```typescript
   pc.onconnectionstatechange = () => {
       if (pc.connectionState === "failed" || 
           pc.connectionState === "closed") {
           pc.close();
           delete peersRef.current[remoteUserId];
       }
   };
   ```

---

#### `handleScreenShare()`
**File**: `Session-ui.tsx` (lines 318-332)  
**Purpose**: Toggle button handler

**Logic**: Simple toggle based on current state
```typescript
const handleScreenShare = () => {
    if (localScreenRef.current) {
        stopScreenShare();  // Currently sharing → stop
    } else {
        startScreenShare(); // Not sharing → start
    }
};
```

---

## 🔄 COMPLETE DATA FLOW DIAGRAMS

### Flow 1: Starting Screen Share

```
User A (Sharer)                Frontend A              Backend                 Frontend B              User B (Viewer)
     |                              |                      |                         |                        |
     |--[Click Share Screen]------->|                      |                         |                        |
     |                              |                      |                         |                        |
     |                              |--start-screen-share->|                         |                        |
     |                              |                      |                         |                        |
     |                              |                      |--addScreenSharer(A)     |                        |
     |                              |                      |                         |                        |
     |                              |                      |--screen-share-started-->|                        |
     |                              |                      |                         |                        |
     |<--[Browser Share Prompt]-----|                      |                         |                        |
     |                              |                      |                         |                        |
     |--[Select Screen & Allow]---->|                      |                         |                        |
     |                              |                      |                         |                        |
     |                              |--getDisplayMedia()--->                         |                        |
     |                              |<--MediaStream---------|                         |                        |
     |                              |                      |                         |                        |
     |                              |--createPeerConnection(B)                       |                        |
     |                              |--addTrack(screen)    |                         |                        |
     |                              |--createOffer()       |                         |                        |
     |                              |                      |                         |                        |
     |                              |--webrtc-offer------->|                         |                        |
     |                              |                      |--webrtc-offer---------->|                        |
     |                              |                      |                         |                        |
     |                              |                      |                         |--setRemoteDescription()|
     |                              |                      |                         |--createAnswer()        |
     |                              |                      |                         |                        |
     |                              |                      |<--webrtc-answer---------|                        |
     |                              |<--webrtc-answer------|                         |                        |
     |                              |                      |                         |                        |
     |                              |--setRemoteDescription()                        |                        |
     |                              |                      |                         |                        |
     |                              |<==ICE Candidates===>|<====ICE Candidates=====>|                        |
     |                              |                      |                         |                        |
     |                              |                      |                         |<--ontrack(screenStream)|
     |                              |                      |                         |                        |
     |                              |                      |                         |--attachStreamToVideo()->|
     |                              |                      |                         |                        |
     |                              |                      |                         |                        |--[Sees Screen]
```

### Flow 2: Stopping Screen Share

```
User A (Sharer)                Frontend A              Backend                 Frontend B              User B (Viewer)
     |                              |                      |                         |                        |
     |--[Click Stop Share]--------->|                      |                         |                        |
     |                              |                      |                         |                        |
     |                              |--stopAllTracks()     |                         |                        |
     |                              |                      |                         |                        |
     |                              |--removeSenders()     |                         |                        |
     |                              |                      |                         |                        |
     |                              |--stop-screen-share-->|                         |                        |
     |                              |                      |                         |                        |
     |                              |                      |--removeScreenSharer(A)  |                        |
     |                              |                      |                         |                        |
     |                              |                      |--screen-share-stopped-->|                        |
     |                              |                      |                         |                        |
     |                              |                      |                         |--removeStream()        |
     |                              |                      |                         |                        |
     |                              |                      |                         |                        |--[Screen Gone]
```

### Flow 3: Sharer Disconnects Unexpectedly

```
User A (Sharer)                Frontend A              Backend                 Frontend B              User B (Viewer)
     |                              |                      |                         |                        |
     |--[Closes Tab]--------------->|                      |                         |                        |
     |                              X                      |                         |                        |
     |                              |                      |<--disconnect event      |                        |
     |                              |                      |                         |                        |
     |                              |                      |--getScreenSharers()     |                        |
     |                              |                      |--includes(A)? YES       |                        |
     |                              |                      |                         |                        |
     |                              |                      |--removeScreenSharer(A)  |                        |
     |                              |                      |                         |                        |
     |                              |                      |--screen-share-stopped-->|                        |
     |                              |                      |                         |                        |
     |                              |                      |                         |--removeStream()        |
     |                              |                      |                         |                        |
     |                              |                      |                         |                        |--[Screen Gone]
```

---

## 🎯 KEY DESIGN DECISIONS

### 1. Multiple Sharers Allowed
Unlike Google Meet (single sharer), Lakeside uses a **Set** to track sharers:
```javascript
screenSharers: Set<userId>
```
This allows multiple participants to share simultaneously.

### 2. Signaling Before Media
The backend doesn't verify if media actually started - it trusts the signaling:
- **PRO**: Simpler backend logic
- **CON**: State can desync if frontend fails after signaling

### 3. Auto-Cleanup on Disconnect
The `disconnect` event handler ensures:
- No orphaned sharers in RoomStore
- Other users notified immediately
- Clean room state

### 4. WebRTC Renegotiation for Late Joiners
When a new user joins while someone is sharing:
```typescript
s.on("user-joined", (u) => {
    if (localScreenRef.current) {
        const pc = createPeerConnection(u.userId);
        const offer = await pc.createOffer();
        s.emit("webrtc-offer", { targetUserId: u.userId, offer });
    }
});
```
This ensures late joiners see the screen share.

---

## 📊 STATE SYNCHRONIZATION

### Backend State (RoomStore)
```javascript
{
  "room-123": {
    screenSharers: Set { "user-A-id", "user-B-id" }
  }
}
```

### Frontend State (Session-ui.tsx)
```typescript
// React state
screenSharers: Set<string>  // { "user-A-id", "user-B-id" }

// Ref
localScreenRef.current: MediaStream | null

// Participant state
participants: [
  {
    userId: "user-A-id",
    streams: [MediaStream],  // Contains screen stream
    email: "userA@example.com"
  }
]
```

### How They Stay Synced

1. **On join**: `existing-participants` includes `screenSharers` array
2. **On start**: `screen-share-started` adds to frontend Set
3. **On stop**: `screen-share-stopped` removes from frontend Set
4. **On disconnect**: Server auto-removes and broadcasts

---

## 🧪 TESTING CHECKLIST

### Single User
- [ ] Click "Share Screen" → browser picker appears
- [ ] Select screen → preview shows locally
- [ ] Click "Stop Share" → screen stops
- [ ] Share, then close picker → auto-stops

### Two Users
- [ ] User A shares → User B sees screen
- [ ] User A stops → User B screen disappears
- [ ] User A shares, refreshes page → User B screen stops

### Late Joiners
- [ ] User A shares
- [ ] User B joins
- [ ] User B sees User A's screen immediately

### Multiple Sharers
- [ ] User A shares
- [ ] User B also shares
- [ ] Both screens visible in grid
- [ ] Each user can stop independently

---

## 🚀 FUTURE ENHANCEMENTS

1. **Audio Sharing**: Add `audio: true` to `getDisplayMedia()`
2. **Screen + Camera**: Combine screen and webcam streams
3. **Presenter Mode**: Auto-feature screen sharers
4. **Recording**: Capture screen shares to recordings
5. **Quality Control**: Adjust bitrate based on network
6. **Annotations**: Draw on shared screens

---

## ⭐ SUMMARY

Lakeside screen sharing uses:

✔ **Signaling Layer**: Socket.IO + RoomStore track state  
✔ **Media Layer**: WebRTC sends actual video  
✔ **Multiple sharers**: Set-based tracking  
✔ **Auto-cleanup**: On disconnect  
✔ **Renegotiation**: For late joiners  
✔ **Google Meet-style UI**: Featured view + thumbnails  

This architecture matches production systems like:
- Google Meet
- Zoom Web
- Microsoft Teams
- Discord

----------------------------------------------------------------
END OF FILE

