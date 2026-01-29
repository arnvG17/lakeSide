/**
 * Recordings Routes
 * 
 * API endpoints for listing and managing user recordings from Supabase Storage.
 */

const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const authenticateUser = require('../middleware/authMiddleware');

const prisma = require('../db/prisma');

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

        // 1. Fetch recordings from the database
        const dbRecordings = await prisma.recording.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
        });

        // 2. Fetch all folders from storage to check for processing sessions
        const { data: storageSessions } = await supabase.storage
            .from(BUCKET_NAME)
            .list('', { limit: 100 });

        const recordingsList = [];
        const seenSessionIds = new Set();

        // Process DB recordings first
        for (const rec of dbRecordings) {
            // Get a proxy URL for the video
            let videoUrl = rec.videoUrl;
            if (videoUrl && videoUrl.includes(BUCKET_NAME)) {
                // If it's a relative path in storage: BUCKET_NAME/sessionId/userId/final_...
                const parts = videoUrl.split('/');
                // Format: recordings/:sessionId/:userId/:fileName
                // We assume videoUrl in DB is either a full URL or a path like "session_123/user_456/final_video.webm"
                const relativePath = videoUrl.includes(`${BUCKET_NAME}/`) ? videoUrl.split(`${BUCKET_NAME}/`)[1] : videoUrl;

                // Construct our internal proxy URL
                // The frontend will prepend the backend URL if needed
                videoUrl = `/api/video/stream/${relativePath}`;
            }

            recordingsList.push({
                id: rec.id,
                sessionId: rec.id, // Fallback for UI
                roomId: 'Unknown',
                createdAt: rec.createdAt,
                name: rec.name,
                videoUrl: videoUrl,
                previewUrl: videoUrl,
                status: 'completed',
                duration: rec.duration,
            });
            // Try to extract sessionId from videoUrl if it follows pattern sessionId/userId/final_...
            if (rec.videoUrl) {
                const parts = rec.videoUrl.split('/');
                if (parts.length > 0) seenSessionIds.add(parts[0]);
            }
        }

        // Add processing sessions from storage that aren't in DB yet
        for (const session of storageSessions || []) {
            if (seenSessionIds.has(session.name)) continue;

            const { data: sessionRootFiles } = await supabase.storage
                .from(BUCKET_NAME)
                .list(session.name);

            // 1. Check for Multi-View (Grid) video in root
            const multiView = sessionRootFiles?.find(f => f.name === 'multi_view.webm');
            if (multiView) {
                recordingsList.push({
                    sessionId: session.name,
                    roomId: session.name.split('_')[0],
                    createdAt: session.created_at || new Date().toISOString(),
                    name: `Multi-View Recording`,
                    videoUrl: `/api/video/root-stream/${session.name}/multi_view.webm`,
                    previewUrl: `/api/video/root-stream/${session.name}/multi_view.webm`,
                    status: 'completed',
                });
                continue;
            }

            // 2. Check for user-specific fragments or results
            const { data: participants } = await supabase.storage
                .from(BUCKET_NAME)
                .list(session.name);

            const userFolder = participants?.find(p => p.name === userId);

            if (userFolder) {
                // Check if user has a final video (already assembled)
                const { data: userFiles } = await supabase.storage
                    .from(BUCKET_NAME)
                    .list(`${session.name}/${userId}`);

                const finalVideo = userFiles?.find(f => f.name === 'final_video.webm');
                if (finalVideo) {
                    recordingsList.push({
                        sessionId: session.name,
                        roomId: session.name.split('_')[0],
                        createdAt: session.created_at || new Date().toISOString(),
                        name: `Meeting Recording`,
                        videoUrl: `/api/video/stream/${session.name}/${userId}/final_video.webm`,
                        previewUrl: `/api/video/stream/${session.name}/${userId}/final_video.webm`,
                        status: 'completed',
                    });
                    continue;
                }

                const { data: videoFragments } = await supabase.storage
                    .from(BUCKET_NAME)
                    .list(`${session.name}/${userId}/video`);

                if (videoFragments && videoFragments.length > 0) {
                    // This is a session that is still in fragments
                    recordingsList.push({
                        sessionId: session.name,
                        roomId: session.name.split('_')[0],
                        createdAt: session.created_at || new Date().toISOString(),
                        fragmentCount: videoFragments.length,
                        previewUrl: `/api/video/stream/${session.name}/${userId}/video/${videoFragments[0].name}`,
                        status: 'processing',
                    });
                }
            }
        }

        res.json({ recordings: recordingsList });
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

        // Generate proxy URLs for each fragment
        const fragments = [];
        for (const fragment of videoFragments || []) {
            fragments.push({
                name: fragment.name,
                url: `/api/video/stream/${sessionId}/${userId}/video/${fragment.name}`,
                size: fragment.metadata?.size || 0,
            });
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
