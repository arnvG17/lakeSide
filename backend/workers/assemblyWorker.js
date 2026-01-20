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

const { createClient } = require('@supabase/supabase-js');
const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

// Initialize Supabase client
const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BUCKET_NAME = 'recordings';

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
 * List fragments for a participant from Supabase Storage
 */
async function listFragments(sessionId, participantId, trackType) {
    const folderPath = `${sessionId}/${participantId}/${trackType}`;

    const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .list(folderPath, { sortBy: { column: 'name', order: 'asc' } });

    if (error) {
        console.error(`[Assembly] Error listing fragments at ${folderPath}:`, error);
        return [];
    }

    // Filter for chunk files and return full paths
    return (data || [])
        .filter(file => file.name.includes('chunk_'))
        .map(file => `${folderPath}/${file.name}`);
}

/**
 * Download a fragment from Supabase Storage
 */
async function downloadFragment(filePath, destPath) {
    const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .download(filePath);

    if (error) {
        throw new Error(`Failed to download ${filePath}: ${error.message}`);
    }

    const buffer = Buffer.from(await data.arrayBuffer());
    await fs.writeFile(destPath, buffer);
}

/**
 * Concatenate fragments using FFmpeg
 */
async function concatenateFragments(fragmentPaths, tempDir, trackType, sessionId) {
    // Download all fragments
    const localPaths = [];
    for (let i = 0; i < fragmentPaths.length; i++) {
        const localPath = path.join(tempDir, `${trackType}_${String(i).padStart(6, '0')}.webm`);
        await downloadFragment(fragmentPaths[i], localPath);
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
 * Upload final assembled file to Supabase Storage
 */
async function uploadFinalFile(localPath, sessionId, participantId, trackType) {
    const extension = path.extname(localPath);
    const filePath = `${sessionId}/${participantId}/final_${trackType}${extension}`;

    const fileContent = await fs.readFile(localPath);
    const contentType = trackType === 'video' ? 'video/webm' : 'audio/wav';

    const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(filePath, fileContent, {
            contentType,
            upsert: true
        });

    if (error) {
        console.error(`[Assembly] Failed to upload ${filePath}:`, error);
        throw error;
    }

    // Get public URL for the uploaded file
    const { data: urlData } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(filePath);

    return urlData?.publicUrl || filePath;
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
