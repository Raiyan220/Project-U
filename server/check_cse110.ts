import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
    // Find CSE110 Section 01
    const section = await prisma.section.findFirst({
        where: {
            course: { code: 'CSE110' },
            sectionNumber: '01'
        },
        include: { slots: true, course: true }
    });

    if (section) {
        console.log('Course:', section.course.code);
        console.log('Section:', section.sectionNumber);
        console.log('Faculty:', (section as any).facultyInitials);
        console.log('Total Slots:', section.slots.length);

        section.slots.forEach((s, i) => {
            console.log(`Slot ${i + 1}: ${s.day} ${s.startTime}-${s.endTime} Room: ${s.roomNumber} Type: ${(s as any).type}`);
        });
    } else {
        console.log('Section not found');
    }

    await prisma.$disconnect();
}

check();
