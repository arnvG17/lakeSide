/**
 * Assembly Worker
 * 
 * Reassembles recording fragments into final audio/video files.
 * Uses FFmpeg for concatenation and format conversion.
 * 
 * This can be run as:
 * - A scheduled job (cron)
 * - A queue worker (Bull/Redis)
 * - Triggered via API endpoint
 */

const { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

// S3-compatible client (works with R2, S3, B2)
const s3Client = new S3Client({
    region: process.env.S3_REGION || 'auto',
    endpoint: process.env.S3_ENDPOINT,
    credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
    },
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'lakeside-recordings';

/**
 * Assemble a recording session
 * @param {string} sessionId - The session to assemble
 * @param {string} participantId - The participant whose recording to assemble
 * @returns {Promise<{audioUrl: string, videoUrl: string}>}
 */
async function assembleSession(sessionId, participantId) {
    console.log(`[Assembly] Starting assembly for session ${sessionId}, participant ${participantId}`);

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lakeside-assembly-'));

    try {
        // 1. List all fragments
        const audioFragments = await listFragments(sessionId, participantId, 'audio');
        const videoFragments = await listFragments(sessionId, participantId, 'video');

        console.log(`[Assembly] Found ${audioFragments.length} audio, ${videoFragments.length} video fragments`);

        const results = {};

        // 2. Process video if available
        if (videoFragments.length > 0) {
            const videoOutput = await concatenateFragments(videoFragments, tempDir, 'video', sessionId);
            results.videoUrl = await uploadFinalFile(videoOutput, sessionId, participantId, 'video');
        }

        // 3. Process audio (extract from video or use separate audio)
        if (audioFragments.length > 0) {
            const audioOutput = await concatenateFragments(audioFragments, tempDir, 'audio', sessionId);
            results.audioUrl = await uploadFinalFile(audioOutput, sessionId, participantId, 'audio');
        } else if (results.videoUrl) {
            // Extract audio from video
            const audioOutput = await extractAudioFromVideo(
                path.join(tempDir, `${sessionId}_video.webm`),
                tempDir,
                sessionId
            );
            results.audioUrl = await uploadFinalFile(audioOutput, sessionId, participantId, 'audio');
        }

        console.log(`[Assembly] Complete for ${sessionId}/${participantId}:`, results);
        return results;

    } finally {
        // Cleanup temp directory
        await fs.rm(tempDir, { recursive: true, force: true });
    }
}

/**
 * List fragments for a participant
 */
async function listFragments(sessionId, participantId, trackType) {
    const prefix = `recordings/${sessionId}/${participantId}/${trackType}/`;

    const command = new ListObjectsV2Command({
        Bucket: BUCKET_NAME,
        Prefix: prefix,
    });

    const response = await s3Client.send(command);
    const contents = response.Contents || [];

    // Sort by key (chunk_000001.webm, chunk_000002.webm, etc.)
    return contents
        .map(obj => obj.Key)
        .filter(key => key.includes('chunk_'))
        .sort();
}

/**
 * Download a fragment from S3
 */
async function downloadFragment(key, destPath) {
    const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
    });

    const response = await s3Client.send(command);
    const chunks = [];

    for await (const chunk of response.Body) {
        chunks.push(chunk);
    }

    await fs.writeFile(destPath, Buffer.concat(chunks));
}

/**
 * Concatenate fragments using FFmpeg
 */
async function concatenateFragments(fragmentKeys, tempDir, trackType, sessionId) {
    // Download all fragments
    const localPaths = [];
    for (let i = 0; i < fragmentKeys.length; i++) {
        const localPath = path.join(tempDir, `${trackType}_${String(i).padStart(6, '0')}.webm`);
        await downloadFragment(fragmentKeys[i], localPath);
        localPaths.push(localPath);
    }

    // Create concat file for FFmpeg
    const concatFilePath = path.join(tempDir, `${trackType}_concat.txt`);
    const concatContent = localPaths.map(p => `file '${p}'`).join('\n');
    await fs.writeFile(concatFilePath, concatContent);

    // Output path
    const outputPath = path.join(tempDir, `${sessionId}_${trackType}.webm`);

    // Run FFmpeg
    await runFFmpeg([
        '-f', 'concat',
        '-safe', '0',
        '-i', concatFilePath,
        '-c', 'copy',
        outputPath
    ]);

    return outputPath;
}

/**
 * Extract audio from video file
 */
async function extractAudioFromVideo(videoPath, tempDir, sessionId) {
    const outputPath = path.join(tempDir, `${sessionId}_audio.wav`);

    await runFFmpeg([
        '-i', videoPath,
        '-vn',              // No video
        '-acodec', 'pcm_s16le',
        '-ar', '44100',     // 44.1kHz
        '-ac', '2',         // Stereo
        outputPath
    ]);

    return outputPath;
}

/**
 * Run FFmpeg command
 */
function runFFmpeg(args) {
    return new Promise((resolve, reject) => {
        const ffmpeg = spawn('ffmpeg', ['-y', ...args]);

        let stderr = '';
        ffmpeg.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        ffmpeg.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`FFmpeg exited with code ${code}: ${stderr}`));
            }
        });

        ffmpeg.on('error', (err) => {
            reject(new Error(`FFmpeg failed to start: ${err.message}`));
        });
    });
}

/**
 * Upload final assembled file
 */
async function uploadFinalFile(localPath, sessionId, participantId, trackType) {
    const extension = path.extname(localPath);
    const key = `recordings/${sessionId}/${participantId}/final_${trackType}${extension}`;

    const fileContent = await fs.readFile(localPath);

    const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: fileContent,
        ContentType: trackType === 'video' ? 'video/webm' : 'audio/wav',
    });

    await s3Client.send(command);

    // Return public URL (if bucket is public) or just the key
    return key;
}

/**
 * Process all incomplete sessions (for batch processing)
 */
async function processAllIncompleteSessions() {
    // In production: Query database for incomplete sessions
    // For now, this is a placeholder
    console.log('[Assembly] Batch processing not yet implemented');
}

module.exports = {
    assembleSession,
    listFragments,
    processAllIncompleteSessions,
};
