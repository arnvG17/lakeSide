const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const authenticateUser = require('../middleware/authMiddleware');
const { supabaseAdmin } = require('../middleware/joinRoomAuth');
const RoomStore = require('../store/roomStore');
const registerChatHandlers = require('./chat');
const registerScreenShareHandlers = require('./screenShare');
const registerSignalingHandlers = require('./signaling');

// ---------------------------------------------
// Prisma (Singleton)
// ---------------------------------------------
const prisma = require('../db/prisma');

// ------------------------------------------------------------
// POST /api/rooms/create
// Protected route → requires Supabase JWT
// ------------------------------------------------------------
router.post("/create", authenticateUser, async (req, res) => {
    try {
        // req.user is now guaranteed to exist
        const supaUser = req.user;
        const { roomName } = req.body;

        // Create room owned by this user
        const room = await prisma.room.create({
            data: {
                roomName: roomName,
                ownerId: supaUser.id,
            }
        });

        const roomUrl = `${process.env.FRONTEND_URL}/room/${room.id}`;

        console.log(`[ROOM CREATED] ${supaUser.email} -> Room ${room.id}`);

        return res.status(200).json({
            ok: true,
            room,
            roomUrl
        });

    } catch (err) {
        console.error("[CREATE ROOM ERROR]", err);
        return res.status(500).json({ error: "Failed to create room" });
    }
});

const roomSocketHandler = (io) => {
    // Socket.io Middleware for Authentication
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth.token;

            if (!token) {
                return next(new Error("Authentication error: Token missing"));
            }

            const { data, error } = await supabaseAdmin.auth.getUser(token);

            if (error || !data.user) {
                return next(new Error("Authentication error: Invalid token"));
            }

            // Attach user to socket
            socket.user = data.user;
            next();
        } catch (err) {
            next(new Error("Authentication error"));
        }
    });

    // Socket.io Connection
    io.on('connection', (socket) => {
        console.log(`User connected: ${socket.user.email} (${socket.id})`);

        // Register Chat Handlers
        registerChatHandlers(io, socket);

        // Register Screen Share Handlers
        registerScreenShareHandlers(io, socket);

        // Register Signaling Handlers
        registerSignalingHandlers(io, socket);

        socket.on('join-room', async ({ roomId, initialState = { micOn: false, cameraOn: false } }) => {
            // Join the socket room
            socket.join(roomId);
            socket.roomId = roomId; // Store room ID for disconnect handling

            // Add user to RoomStore
            const newUser = {
                userId: socket.user.id,
                email: socket.user.email,
                socketId: socket.id,
                userState: initialState
            };
            RoomStore.addUser(roomId, newUser);

            // Get all participants from store
            const allParticipants = RoomStore.getUsers(roomId);
            const existingParticipants = allParticipants.filter(p => p.userId !== socket.user.id);

            // 1. Send existing participants to the NEW user
            const currentScreenSharers = RoomStore.getScreenSharers(roomId);
            socket.emit('existing-participants', {
                users: existingParticipants,
                screenSharers: currentScreenSharers
            });

            // 2. Broadcast to everyone ELSE in the room that a new user joined
            socket.to(roomId).emit('user-joined', newUser);

            console.log(`User ${socket.user.email} joined room ${roomId}`);
        });

        socket.on('toggle-mic', ({ micOn }) => {
            console.log(`[${Date.now()}] toggle-mic received from ${socket.user.email}`);
            if (socket.roomId) {
                // Update store
                RoomStore.updateUser(socket.roomId, socket.user.id, { micOn });

                socket.to(socket.roomId).emit('user-toggled-mic', {
                    userId: socket.user.id,
                    micOn
                });
                console.log(`[${Date.now()}] user-toggled-mic broadcast to ${socket.roomId}`);
            }
        });

        socket.on('toggle-camera', ({ cameraOn }) => {
            console.log(`[${Date.now()}] toggle-camera received from ${socket.user.email}`);
            if (socket.roomId) {
                // Update store
                RoomStore.updateUser(socket.roomId, socket.user.id, { cameraOn });

                socket.to(socket.roomId).emit('user-toggled-camera', {
                    userId: socket.user.id,
                    cameraOn
                });
                console.log(`[${Date.now()}] user-toggled-camera broadcast to ${socket.roomId}`);
            }
        });

        socket.on('disconnect', () => {
            if (socket.roomId) {
                // Remove from store
                RoomStore.removeUser(socket.roomId, socket.user.id);

                socket.to(socket.roomId).emit('user-left', {
                    userId: socket.user.id,
                    socketId: socket.id
                });
                console.log(`User disconnected: ${socket.user.email} from room ${socket.roomId}`);
            } else {
                console.log(`User disconnected: ${socket.user.email}`);
            }
        });
    });
};

module.exports = { router, roomSocketHandler };
