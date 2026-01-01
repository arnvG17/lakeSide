const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

/**
 * POST /api/transcripts
 * Save a VTT transcript to the database
 */
router.post('/', authMiddleware, async (req, res) => {
    try {
        const { roomId, content, format = 'vtt' } = req.body;
        const userId = req.user.id;

        if (!roomId || !content) {
            return res.status(400).json({ error: 'roomId and content are required' });
        }

        const transcript = await prisma.transcript.create({
            data: {
                roomId,
                userId,
                content,
                format,
            },
        });

        res.status(201).json(transcript);
    } catch (error) {
        console.error('Error saving transcript:', error);
        res.status(500).json({ error: 'Failed to save transcript' });
    }
});

/**
 * GET /api/transcripts/:roomId
 * Get all transcripts for a room
 */
router.get('/:roomId', authMiddleware, async (req, res) => {
    try {
        const { roomId } = req.params;

        const transcripts = await prisma.transcript.findMany({
            where: { roomId },
            orderBy: { createdAt: 'desc' },
        });

        res.json(transcripts);
    } catch (error) {
        console.error('Error fetching transcripts:', error);
        res.status(500).json({ error: 'Failed to fetch transcripts' });
    }
});

/**
 * GET /api/transcripts/download/:id
 * Download a transcript as a VTT file
 */
router.get('/download/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;

        const transcript = await prisma.transcript.findUnique({
            where: { id },
        });

        if (!transcript) {
            return res.status(404).json({ error: 'Transcript not found' });
        }

        // Set headers for file download
        const filename = `transcript-${transcript.roomId}-${transcript.createdAt.toISOString().split('T')[0]}.${transcript.format}`;
        res.setHeader('Content-Type', 'text/vtt');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(transcript.content);
    } catch (error) {
        console.error('Error downloading transcript:', error);
        res.status(500).json({ error: 'Failed to download transcript' });
    }
});

/**
 * GET /api/transcripts/user/me
 * Get all transcripts for the current user
 */
router.get('/user/me', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;

        const transcripts = await prisma.transcript.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
        });

        res.json(transcripts);
    } catch (error) {
        console.error('Error fetching user transcripts:', error);
        res.status(500).json({ error: 'Failed to fetch transcripts' });
    }
});

module.exports = router;
