const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { v4: uuidv4 } = require('uuid');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// ---------------------------------------------
// Prisma
// ---------------------------------------------
const prisma = new PrismaClient();

// ---------------------------------------------
// Supabase Clients
// ---------------------------------------------
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY // anon key (public operations)
);

const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY, // service role (secure operations)
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        }
    }
);

// ---------------------------------------------
// LOGIN LOG ENDPOINT
// ---------------------------------------------
router.post('/log-login', async (req, res) => {
    const { userId, email, timestamp } = req.body;

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
router.post('/sync-user', async (req, res) => {
    try {
        // 1️⃣ Extract bearer token
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ error: "Missing Authorization header" });
        }

        const token = authHeader.split(" ")[1];
        if (!token) {
            return res.status(401).json({ error: "Invalid Authorization header format" });
        }

        // 2️⃣ Verify and extract Supabase user
        const { data, error } = await supabaseAdmin.auth.getUser(token);
        if (error || !data.user) {
            return res.status(401).json({ error: "Invalid or expired token" });
        }

        const supaUser = data.user; // this is the REAL authenticated user
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
