import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
    // Check total slots to see if new ones are being added
    const totalSlots = await prisma.roomSlot.count();
    console.log('Total slots in DB:', totalSlots);

    // Check slots by type
    const classSlots = await prisma.roomSlot.count({
        where: { type: 'CLASS' }
    });
    const labSlots = await prisma.roomSlot.count({
        where: { type: 'LAB' }
    });
    console.log('CLASS slots:', classSlots);
    console.log('LAB slots:', labSlots);

    // Find sections with multiple slots
    const sectionsWithMultipleSlots = await prisma.section.findMany({
        where: {
            slots: {
                some: {}
            }
        },
        include: {
            slots: true,
            course: true
        },
        take: 5
    });

    console.log('\n=== Sample sections with slots ===');
    for (const sec of sectionsWithMultipleSlots) {
        console.log(`${sec.course.code} Sec ${sec.sectionNumber}: ${sec.slots.length} slots`);
        sec.slots.forEach(s => console.log(`  - ${s.day} ${s.startTime}-${s.endTime} [${(s as any).type}]`));
    }

    await prisma.$disconnect();
}

check();
