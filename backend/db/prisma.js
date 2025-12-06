const { PrismaClient } = require('@prisma/client');

// Singleton pattern to prevent multiple Prisma Client instances
// This is especially important in serverless/Render deployments
let prisma;

if (process.env.NODE_ENV === 'production') {
    prisma = new PrismaClient({
        log: ['error', 'warn'],
    });
} else {
    // In development, use a global variable to preserve the instance across hot reloads
    if (!global.prisma) {
        global.prisma = new PrismaClient({
            log: ['query', 'error', 'warn'],
        });
    }
    prisma = global.prisma;
}

module.exports = prisma;
