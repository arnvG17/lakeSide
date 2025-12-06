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
# ⭐ APPENDED SECTION: HOW LAKESIDE SCREEN SHARING WORKS
----------------------------------------------------------------

Screen sharing has **two layers**:

----------------------------------------------------------------
# 🔵 1. SIGNALING LAYER (Socket.IO + RoomStore)
----------------------------------------------------------------

This is responsible for:

- Tracking who is sharing  
- Allowing only one sharer at a time (Meet-style)  
- Broadcasting start/stop events  
- Cleaning up when users disconnect  

Events include:

- start-screen-share  
- screen-share-started  
- screen-share-stopped  
- screen-share-denied  

RoomStore stores:

    screenSharer: userId

This allows the UI to always know:

- Who is currently sharing  
- Whether sharing is allowed  
- Whether to highlight a tile  
- Whether to show sharing controls  

----------------------------------------------------------------
# 🔵 2. MEDIA LAYER (WebRTC)
----------------------------------------------------------------

This is implemented later and handles:

- getDisplayMedia()  
- Sending the screen video track  
- Replacing webcam video track  
- Receiving screen video on other clients  

The important thing:

**The signaling layer enables the WebRTC layer.  
Without signaling, video streams cannot start.**

----------------------------------------------------------------
# 🔵 SCREEN SHARE LIFECYCLE

User clicks Share Screen
        ↓
Frontend: socket.emit("start-screen-share")
        ↓
Server checks if someone is already sharing
        ↓
If free → RoomStore.setScreenSharer(userId)
        ↓
Server broadcasts: "screen-share-started"
        ↓
Frontend updates UI (highlight the sharer)
        ↓
Later: WebRTC sends actual screen video

----------------------------------------------------------------

# ⭐ FINAL SUMMARY (AUTH + CHAT + SCREENSHARE)

Lakeside now supports:

✔ Full Supabase OAuth → JWT → Backend Auth  
✔ Prisma user syncing  
✔ Room presence  
✔ Real-time chat with history  
✔ Single-person screen sharing signaling  
✔ Refresh-safe persistent room state  
✔ Scalable architecture ready for Redis + WebRTC  

This architecture is the same used by professional platforms like:

- Google Meet  
- Zoom Web  
- Riverside.fm  
- Discord RTC  

----------------------------------------------------------------
END OF FILE
