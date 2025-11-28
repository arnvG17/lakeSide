const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const { Server } = require('socket.io');
const http = require('http');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config(); // Load env from current dir

const prisma = new PrismaClient();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "http://localhost:3000", // Allow Next.js frontend
        methods: ["GET", "POST"]
    }
});

// Middleware
app.use(cors());
app.use(express.json());

// Supabase Client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY; // Using the key from .env
const supabase = createClient(supabaseUrl, supabaseKey);

// Basic Route
app.get('/', (req, res) => {
    res.send('Lakeside Backend Running');
});

// Login Logging Endpoint
app.post('/api/log-login', async (req, res) => {
    const { userId, email, timestamp } = req.body;
    console.log(`[LOGIN LOG] User ${email} (${userId}) logged in at ${timestamp}`);

    // Import uuid at the top if not already imported
    const { v4: uuidv4 } = require('uuid');

    // Insert into database
    const { error } = await supabase
        .from('login_logs')
        .insert({
            id: uuidv4(), // Generate UUID for the id field
            user_id: userId,
            login_timestamp: timestamp
        });

    if (error) {
        console.error('[LOGIN LOG ERROR]', error);
        return res.status(500).json({ error: 'Failed to log login to database' });
    }

    res.status(200).json({ message: 'Login logged successfully' });
});

// User Sync Endpoint - Create or get user
app.post('/api/sync-user', async (req, res) => {
    const { userId, email } = req.body;

    try {
        // Check if user exists
        let user = await prisma.user.findUnique({
            where: { id: userId }
        });

        if (!user) {
            // Create new user
            user = await prisma.user.create({
                data: {
                    id: userId,
                    email: email
                }
            });
            console.log(`[USER SYNC] Created new user: ${email} (${userId})`);
        } else {
            console.log(`[USER SYNC] Existing user: ${email} (${userId})`);
        }

        // Fetch user's data
        const [recordings, rooms] = await Promise.all([
            prisma.recording.findMany({
                where: { userId: userId },
                orderBy: { createdAt: 'desc' }
            }),
            prisma.room.findMany({
                where: { ownerId: userId },
                orderBy: { createdAt: 'desc' }
            })
        ]);

        res.status(200).json({
            user,
            recordings,
            rooms
        });
    } catch (error) {
        console.error('[USER SYNC ERROR]', error);
        res.status(500).json({ error: 'Failed to sync user' });
    }
});

// Socket.io Connection
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
