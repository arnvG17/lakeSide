const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function addSampleRecordings() {
    try {
        // Get all users
        const users = await prisma.user.findMany();

        console.log(`Found ${users.length} users`);

        if (users.length === 0) {
            console.log('No users found. Please login first to create users.');
            return;
        }

        // Sample video URLs (using placeholder videos)
        const sampleVideos = [
            {
                name: 'Team Meeting Recording',
                videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
                duration: '9:56'
            },
            {
                name: 'Project Demo Session',
                videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
                duration: '10:53'
            },
            {
                name: 'Client Presentation',
                videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
                duration: '0:15'
            }
        ];

        // Add recordings for each user
        for (const user of users) {
            console.log(`\nAdding recordings for user: ${user.email}`);

            // Pick a random video for this user
            const randomVideo = sampleVideos[Math.floor(Math.random() * sampleVideos.length)];

            const recording = await prisma.recording.create({
                data: {
                    userId: user.id,
                    name: randomVideo.name,
                    videoUrl: randomVideo.videoUrl,
                    duration: randomVideo.duration
                }
            });

            console.log(`✅ Created recording: ${recording.name} (${recording.duration})`);
        }

        console.log('\n✨ Sample recordings added successfully!');
    } catch (error) {
        console.error('Error adding recordings:', error);
    } finally {
        await prisma.$disconnect();
    }
}

addSampleRecordings();
