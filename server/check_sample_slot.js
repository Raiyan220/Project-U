const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkSample() {
    const count = await prisma.roomSlot.count({
        where: { day: 'WEDNESDAY', startTime: { lte: 1412 }, endTime: { gt: 1412 } }
    });
    console.log('Occupied count at 1412 WEDNESDAY:', count);
}

checkSample().finally(() => prisma.$disconnect());
