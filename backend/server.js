const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');
const http = require('http');
require('dotenv').config(); // Load env from current dir

const authRoutes = require('./routes/auth');

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

// Routes
app.use('/api/auth', authRoutes);

// Basic Route
app.get('/', (req, res) => {
    res.send('Lakeside Backend Running');
});

// Socket.io Connection

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
