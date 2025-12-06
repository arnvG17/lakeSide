const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// ---------------------------------------------
// Prisma (Singleton)
// ---------------------------------------------
const prisma = require('../db/prisma');

// ---------------------------------------------
// Supabase Clients
// ---------------------------------------------
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY // anon key (public operations)
);



// ---------------------------------------------
// LOGIN LOG ENDPOINT
// ---------------------------------------------
const authenticateUser = require('../middleware/authMiddleware');

// ---------------------------------------------
// LOGIN LOG ENDPOINT
// ---------------------------------------------
router.post('/log-login', authenticateUser, async (req, res) => {
    const { userId, email, timestamp } = req.body;

    // Verify that the token user matches the requested user (optional security enhancement)
    if (req.user.id !== userId) {
        return res.status(403).json({ error: "Unauthorized: User ID mismatch" });
    }

    console.log(`[LOGIN LOG] User ${email} (${userId}) logged in at ${timestamp}`);

    // Insert login log into Supabase table
    const { error } = await supabase
        .from('login_logs')
        .insert({
            id: uuidv4(),
            user_id: userId,
            login_timestamp: timestamp
        });

    if (error) {
        console.error('[LOGIN LOG ERROR]', error);
        return res.status(500).json({ error: 'Failed to log login to database' });
    }

    res.status(200).json({ message: 'Login logged successfully' });
});

// ---------------------------------------------
// SECURE USER SYNC ENDPOINT
// Verifies JWT → Upserts user → Returns rooms + recordings
// ---------------------------------------------
router.post('/sync-user', authenticateUser, async (req, res) => {
    try {
        const supaUser = req.user; // Set by middleware
        const userId = supaUser.id;
        const email = supaUser.email;

        // 3️⃣ Upsert user into Prisma
        const user = await prisma.user.upsert({
            where: { id: userId },
            update: { email },
            create: { id: userId, email },
        });

        console.log(`[USER SYNC] Synced user: ${email} (${userId})`);

        // 4️⃣ Fetch user's rooms (recordings later)
        const rooms = await prisma.room.findMany({
            where: { ownerId: userId },
            orderBy: { createdAt: 'desc' },
        });

        const recordings = []; // placeholder until recording model is added

        // 5️⃣ Respond with user's data
        return res.status(200).json({
            ok: true,
            user,
            rooms,
            recordings,
        });

    } catch (error) {
        console.error('[USER SYNC ERROR]', error);
        return res.status(500).json({ error: 'Failed to sync user' });
    }
});

module.exports = router;
