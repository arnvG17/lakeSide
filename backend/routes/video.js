const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const authenticateUser = require('../middleware/authMiddleware');
const router = express.Router();

// Initialize Supabase client
const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BUCKET_NAME = 'recordings';

/**
 * GET /api/video/stream/:sessionId/:userId/:fileName
 * Proxy the video stream from Supabase Storage
 */
router.get('/stream/:sessionId/:userId/:fileName', authenticateUser, async (req, res) => {
    try {
        const { sessionId, userId: requestedUserId, fileName } = req.params;
        const currentUserId = req.user.id;

        // Security check: Only allow users to access their own recordings
        // (Unless they are an admin, etc., but for now strictly own)
        if (requestedUserId !== currentUserId) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const filePath = `${sessionId}/${requestedUserId}/${fileName}`;
        console.log(`[Video Proxy] Streaming ${filePath}`);

        // Get the file from storage
        const { data, error } = await supabase.storage
            .from(BUCKET_NAME)
            .download(filePath);

        if (error) {
            console.error('[Video Proxy] Download error:', error);
            return res.status(404).json({ error: 'Video not found' });
        }

        // Set response headers
        res.setHeader('Content-Type', fileName.endsWith('.webm') ? 'video/webm' : 'video/mp4');
        res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour

        // Send the data
        const buffer = Buffer.from(await data.arrayBuffer());
        res.send(buffer);

    } catch (error) {
        console.error('[Video Proxy] Error:', error);
        res.status(500).json({ error: 'Stream failure' });
    }
});

/**
 * GET /api/video/root-stream/:sessionId/:fileName
 * Proxy the video stream from root folder (e.g. multi_view.webm)
 */
router.get('/root-stream/:sessionId/:fileName', authenticateUser, async (req, res) => {
    try {
        const { sessionId, fileName } = req.params;

        // Note: For root-level videos like multi_view, we might need 
        // a different check to see if user has access to this room.
        // For now, allowing authenticated users.

        const filePath = `${sessionId}/${fileName}`;
        console.log(`[Video Proxy] Streaming root ${filePath}`);

        const { data, error } = await supabase.storage
            .from(BUCKET_NAME)
            .download(filePath);

        if (error) {
            return res.status(404).json({ error: 'Video not found' });
        }

        res.setHeader('Content-Type', fileName.endsWith('.webm') ? 'video/webm' : 'video/mp4');
        res.send(Buffer.from(await data.arrayBuffer()));

    } catch (error) {
        res.status(500).json({ error: 'Stream failure' });
    }
});

module.exports = router;
