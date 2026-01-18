/**
 * Upload Routes - Supabase Storage
 * 
 * Uses Supabase Storage for recording fragments.
 * Free tier: 1GB storage, no credit card required.
 */

const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const authenticateUser = require('../middleware/authMiddleware');

const router = express.Router();

// Initialize Supabase client
const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY // Use service role for server-side uploads
);

const BUCKET_NAME = 'recordings';

/**
 * POST /api/upload/presign
 * Generate a signed upload URL for Supabase Storage
 */
router.post('/presign', authenticateUser, async (req, res) => {
    try {
        const { sessionId, participantId, trackType, fragmentIndex, contentType } = req.body;
        const userId = req.user.id;

        // Validate input
        if (!sessionId || !participantId || !trackType || fragmentIndex === undefined) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Verify user owns this participant slot
        if (participantId !== userId) {
            return res.status(403).json({ error: 'Cannot upload for another user' });
        }

        // Generate storage path
        const extension = getExtensionForMimeType(contentType || 'video/webm');
        const paddedIndex = String(fragmentIndex).padStart(6, '0');
        const filePath = `${sessionId}/${participantId}/${trackType}/chunk_${paddedIndex}.${extension}`;

        // Create signed upload URL (valid for 1 hour)
        const { data, error } = await supabase.storage
            .from(BUCKET_NAME)
            .createSignedUploadUrl(filePath);

        if (error) {
            console.error('[Upload] Supabase error:', error);
            return res.status(500).json({ error: 'Failed to generate upload URL' });
        }

        console.log(`[Upload] Generated signed URL for ${filePath}`);

        res.json({
            uploadUrl: data.signedUrl,
            key: filePath,
            token: data.token,
            expiresIn: 3600,
        });
    } catch (error) {
        console.error('[Upload] Error generating signed URL:', error);
        res.status(500).json({ error: 'Failed to generate upload URL' });
    }
});

/**
 * POST /api/upload/direct
 * Direct upload endpoint (alternative if signed URLs don't work)
 */
router.post('/direct', authenticateUser, async (req, res) => {
    try {
        const { sessionId, participantId, trackType, fragmentIndex } = req.body;

        // This would handle multipart form data
        // For now, just acknowledge
        res.status(501).json({ error: 'Direct upload not yet implemented. Use presigned URL.' });
    } catch (error) {
        console.error('[Upload] Direct upload error:', error);
        res.status(500).json({ error: 'Upload failed' });
    }
});

/**
 * POST /api/upload/complete
 * Mark a recording session as complete
 */
router.post('/complete', authenticateUser, async (req, res) => {
    try {
        const { sessionId } = req.body;
        const userId = req.user.id;

        if (!sessionId) {
            return res.status(400).json({ error: 'sessionId required' });
        }

        console.log(`[Upload] Session ${sessionId} marked complete by ${userId}`);

        res.json({
            ok: true,
            message: 'Session marked for assembly',
            sessionId,
        });
    } catch (error) {
        console.error('[Upload] Error completing session:', error);
        res.status(500).json({ error: 'Failed to complete session' });
    }
});

/**
 * GET /api/upload/fragments/:sessionId
 * List all fragments for a session
 */
router.get('/fragments/:sessionId', authenticateUser, async (req, res) => {
    try {
        const { sessionId } = req.params;

        const { data, error } = await supabase.storage
            .from(BUCKET_NAME)
            .list(sessionId, { sortBy: { column: 'name', order: 'asc' } });

        if (error) {
            return res.status(500).json({ error: 'Failed to list fragments' });
        }

        res.json({ fragments: data || [] });
    } catch (error) {
        console.error('[Upload] Error listing fragments:', error);
        res.status(500).json({ error: 'Failed to list fragments' });
    }
});

/**
 * Get file extension for mime type
 */
function getExtensionForMimeType(mimeType) {
    const types = {
        'video/webm': 'webm',
        'video/mp4': 'mp4',
        'audio/webm': 'webm',
        'audio/mp4': 'm4a',
        'audio/wav': 'wav',
        'audio/ogg': 'ogg',
    };
    return types[mimeType] || 'webm';
}

module.exports = router;
