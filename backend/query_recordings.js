const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const recordings = await prisma.recording.findMany({
            take: 10,
            orderBy: { createdAt: 'desc' }
        });
        console.log(JSON.stringify(recordings, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
