import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkCurrentStatus() {
    const now = new Date();
    // Use fixed time for testing if needed, or real time
    // Current time from metadata: Wednesday 1:56 PM
    const day = 'WEDNESDAY'; // Hardcoded based on current time for verification
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const currentTime = hours * 60 + minutes;

    console.log(`\n=== Checking Status for ${day} at ${hours}:${minutes.toString().padStart(2, '0')} (${currentTime}) ===`);

    // 1. Find Occupied Rooms
    const occupiedSlots = await prisma.roomSlot.findMany({
        where: {
            day: day,
            startTime: { lte: currentTime },
            endTime: { gt: currentTime }
        },
        select: {
            roomNumber: true,
            building: true,
            startTime: true,
            endTime: true,
            section: {
                select: {
                    course: { select: { code: true } },
                    sectionNumber: true
                }
            }
        },
        orderBy: { roomNumber: 'asc' },
        take: 10 // Show sample
    });

    console.log(`\n🚫 OCCUPIED ROOMS (${occupiedSlots.length} found - showing top 10):`);
    occupiedSlots.forEach(slot => {
        console.log(`[${slot.building}-${slot.roomNumber}] Occupied by ${slot.section.course.code} Sec ${slot.section.sectionNumber}`);
        console.log(`   Time: ${formatTime(slot.startTime)} - ${formatTime(slot.endTime)} (Free in ${slot.endTime - currentTime} mins)`);
    });

    // 2. Find Next Class for a sample room that is NOT occupied
    // Let's pick a random room that is known to exist but not in occupied list
    // For simplicity, let's just find ALL upcoming slots for today
    const upcomingSlots = await prisma.roomSlot.findMany({
        where: {
            day: day,
            startTime: { gt: currentTime }
        },
        select: {
            roomNumber: true,
            building: true,
            startTime: true
        },
        orderBy: { startTime: 'asc' },
        take: 10
    });

    console.log(`\n✅ UPCOMING CLASSES (Free Until...) sample:`);
    upcomingSlots.forEach(slot => {
        console.log(`[${slot.building}-${slot.roomNumber}] Free until ${formatTime(slot.startTime)} (${slot.startTime - currentTime} mins from now)`);
    });
}

function formatTime(minutes: number) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
}

checkCurrentStatus()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
