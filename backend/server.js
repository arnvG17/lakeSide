const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');
const http = require('http');
require('dotenv').config(); // Load env from current dir
const { router: roomRoutes, roomSocketHandler } = require('./routes/room');
const authRoutes = require('./routes/auth');
const transcriptRoutes = require('./routes/transcript');
const uploadRoutes = require('./routes/upload');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST"]
    }
});

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/transcripts', transcriptRoutes);
app.use('/api/upload', uploadRoutes);

// Basic Route
app.get('/', (req, res) => {
    res.send('Lakeside Backend Running');
});

// Socket.io Connection
roomSocketHandler(io);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
