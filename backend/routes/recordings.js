/**
 * Recordings Routes
 * 
 * API endpoints for listing and managing user recordings from Supabase Storage.
 */

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
 * GET /api/recordings
 * List all recordings for the authenticated user
 */
router.get('/', authenticateUser, async (req, res) => {
    try {
        const userId = req.user.id;

        // List all folders in the bucket (each folder is a session)
        const { data: sessions, error: listError } = await supabase.storage
            .from(BUCKET_NAME)
            .list('', { limit: 100 });

        if (listError) {
            console.error('[Recordings] List error:', listError);
            return res.status(500).json({ error: 'Failed to list recordings' });
        }

        // Filter sessions that belong to this user (sessions contain userId in their structure)
        const userRecordings = [];

        for (const session of sessions || []) {
            // Check if this session folder contains user's recordings
            const { data: participants } = await supabase.storage
                .from(BUCKET_NAME)
                .list(session.name);

            // Check if user's folder exists in this session
            const userFolder = participants?.find(p => p.name === userId);

            if (userFolder) {
                // Get video fragments count
                const { data: videoFragments } = await supabase.storage
                    .from(BUCKET_NAME)
                    .list(`${session.name}/${userId}/video`);

                // Get signed URL for first video fragment (preview)
                let previewUrl = null;
                if (videoFragments && videoFragments.length > 0) {
                    const { data: signedData } = await supabase.storage
                        .from(BUCKET_NAME)
                        .createSignedUrl(`${session.name}/${userId}/video/${videoFragments[0].name}`, 3600);
                    previewUrl = signedData?.signedUrl;
                }

                userRecordings.push({
                    sessionId: session.name,
                    roomId: session.name.split('_')[0], // Extract roomId from sessionId
                    createdAt: session.created_at || new Date().toISOString(),
                    fragmentCount: videoFragments?.length || 0,
                    previewUrl,
                    status: 'available',
                });
            }
        }

        res.json({ recordings: userRecordings });
    } catch (error) {
        console.error('[Recordings] Error:', error);
        res.status(500).json({ error: 'Failed to fetch recordings' });
    }
});

/**
 * GET /api/recordings/:sessionId
 * Get download URLs for a specific recording session
 */
router.get('/:sessionId', authenticateUser, async (req, res) => {
    try {
        const { sessionId } = req.params;
        const userId = req.user.id;

        // Get all video fragments
        const { data: videoFragments, error } = await supabase.storage
            .from(BUCKET_NAME)
            .list(`${sessionId}/${userId}/video`, { sortBy: { column: 'name', order: 'asc' } });

        if (error) {
            return res.status(500).json({ error: 'Failed to list fragments' });
        }

        // Generate signed URLs for each fragment
        const fragments = [];
        for (const fragment of videoFragments || []) {
            const { data: signedData } = await supabase.storage
                .from(BUCKET_NAME)
                .createSignedUrl(`${sessionId}/${userId}/video/${fragment.name}`, 3600);

            if (signedData) {
                fragments.push({
                    name: fragment.name,
                    url: signedData.signedUrl,
                    size: fragment.metadata?.size || 0,
                });
            }
        }

        res.json({
            sessionId,
            fragments,
            totalFragments: fragments.length,
        });
    } catch (error) {
        console.error('[Recordings] Error:', error);
        res.status(500).json({ error: 'Failed to get recording' });
    }
});

/**
 * DELETE /api/recordings/:sessionId
 * Delete a recording session
 */
router.delete('/:sessionId', authenticateUser, async (req, res) => {
    try {
        const { sessionId } = req.params;
        const userId = req.user.id;

        // List all files in the user's session folder
        const { data: folders } = await supabase.storage
            .from(BUCKET_NAME)
            .list(`${sessionId}/${userId}`);

        for (const folder of folders || []) {
            const { data: files } = await supabase.storage
                .from(BUCKET_NAME)
                .list(`${sessionId}/${userId}/${folder.name}`);

            for (const file of files || []) {
                await supabase.storage
                    .from(BUCKET_NAME)
                    .remove([`${sessionId}/${userId}/${folder.name}/${file.name}`]);
            }
        }

        res.json({ ok: true, message: 'Recording deleted' });
    } catch (error) {
        console.error('[Recordings] Delete error:', error);
        res.status(500).json({ error: 'Failed to delete recording' });
    }
});

module.exports = router;
