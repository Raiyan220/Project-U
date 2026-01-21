const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkCurrentStatus() {
    const now = new Date();
    // Use fixed time for testing to match user's context if needed
    // But let's use the actual system time for accurate verification
    const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    const day = days[now.getDay()];
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
    if (occupiedSlots.length === 0) {
        console.log("   No rooms currently occupied.");
    }
    occupiedSlots.forEach(slot => {
        console.log(`[${slot.building}-${slot.roomNumber}] Occupied by ${slot.section.course.code} Sec ${slot.section.sectionNumber}`);
        console.log(`   Time: ${formatTime(slot.startTime)} - ${formatTime(slot.endTime)} (Free in ${slot.endTime - currentTime} mins)`);
    });

    // 2. Find Next Class for a sample room that is NOT occupied
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
    if (upcomingSlots.length === 0) {
        console.log("   No more classes today.");
    }
    upcomingSlots.forEach(slot => {
        console.log(`[${slot.building}-${slot.roomNumber}] Free until ${formatTime(slot.startTime)} (${slot.startTime - currentTime} mins from now)`);
    });
}

function formatTime(minutes) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
}

checkCurrentStatus()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
