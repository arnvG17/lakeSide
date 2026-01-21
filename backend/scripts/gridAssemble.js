const { createClient } = require('@supabase/supabase-js');
const { exec } = require('child_process');
const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const { promisify } = require('util');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const execPromise = promisify(exec);

// Initialize Supabase
const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BUCKET_NAME = 'recordings';

/**
 * Stitches individual participant videos into a single grid video.
 * Uses FFmpeg xstack filter for visual merging and amix for audio.
 */
async function gridAssemble(sessionId) {
    console.log(`[Grid] Starting grid assembly for session ${sessionId}`);

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lakeside-grid-'));

    try {
        // 1. List participants in this session
        const { data: participants } = await supabase.storage
            .from(BUCKET_NAME)
            .list(sessionId);

        if (!participants || participants.length === 0) {
            console.log(`[Grid] No participants found for session ${sessionId}`);
            return;
        }

        const videoFiles = [];

        // 2. Download each participant's final video
        for (const p of participants) {
            if (p.name === 'multi_view.webm') continue; // Skip existing grid

            const userId = p.name;
            const { data: files } = await supabase.storage
                .from(BUCKET_NAME)
                .list(`${sessionId}/${userId}`);

            const finalVideo = files?.find(f => f.name === 'final_video.webm');
            if (finalVideo) {
                const localPath = path.join(tempDir, `${userId}.webm`);
                console.log(`[Grid] Downloading video for user ${userId}...`);

                const { data, error } = await supabase.storage
                    .from(BUCKET_NAME)
                    .download(`${sessionId}/${userId}/final_video.webm`);

                if (data) {
                    await fs.writeFile(localPath, Buffer.from(await data.arrayBuffer()));
                    videoFiles.push({ userId, path: localPath });
                }
            }
        }

        if (videoFiles.length <= 1) {
            console.log(`[Grid] Not enough videos (${videoFiles.length}) to create a grid for ${sessionId}.`);
            return;
        }

        // 3. FFmpeg Grid Assembly
        const outputVideo = path.join(tempDir, 'multi_view.webm');
        const inputArgs = videoFiles.map(v => `-i "${v.path}"`).join(' ');

        // Layouts for xstack:
        // 2 videos: 0_0|w0_0 (side by side)
        // 3 videos: 0_0|w0_0|0_h0 (2 top, 1 bottom left)
        // 4 videos: 0_0|w0_0|0_h0|w0_h0 (2x2)
        const layout = getLayout(videoFiles.length);
        const filter = `"[0:v]scale=640:360[v0];` +
            videoFiles.slice(1).map((_, i) => `[${i + 1}:v]scale=640:360[v${i + 1}];`).join('') +
            videoFiles.map((_, i) => `[v${i}]`).join('') +
            `xstack=inputs=${videoFiles.length}:layout=${layout}[v];` +
            `amix=inputs=${videoFiles.length}[a]"`;

        // We use libvpx-vp9 for high quality webm
        const ffmpegCmd = `ffmpeg -y ${inputArgs} -filter_complex ${filter} -map "[v]" -map "[a]" -c:v libvpx-vp9 -b:v 2M -crf 30 -c:a libopus "${outputVideo}"`;

        console.log(`[Grid] Running FFmpeg...`);
        await execPromise(ffmpegCmd);

        // 4. Upload resulting multi-view
        console.log(`[Grid] Uploading multi_view.webm...`);
        const fileContent = await fs.readFile(outputVideo);
        const { error: uploadError } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(`${sessionId}/multi_view.webm`, fileContent, {
                contentType: 'video/webm',
                upsert: true
            });

        if (uploadError) throw uploadError;

        console.log(`[Grid] COMPLETED for session ${sessionId}`);

    } catch (err) {
        console.error(`[Grid] FAILED for session ${sessionId}:`, err);
    } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
    }
}

/**
 * Generates xstack layout string based on number of inputs
 * Assumes all videos are scaled to 640x360
 */
function getLayout(n) {
    if (n === 2) return '0_0|640_0';
    if (n === 3) return '0_0|640_0|0_360';
    if (n === 4) return '0_0|640_0|0_360|640_360';
    return '0_0';
}

/**
 * Process all sessions in the bucket
 */
async function processAll() {
    console.log("[Grid] Scanning all sessions...");
    const { data: sessions, error } = await supabase.storage
        .from(BUCKET_NAME)
        .list('');

    if (error) {
        console.error("[Grid] Error listing sessions:", error);
        return;
    }

    for (const session of sessions || []) {
        if (session.name.includes('.')) continue; // Skip files
        await gridAssemble(session.name);
    }
}

// Execution
if (require.main === module) {
    const targetSession = process.argv[2];
    if (targetSession) {
        gridAssemble(targetSession);
    } else {
        processAll();
    }
}

module.exports = gridAssemble;
