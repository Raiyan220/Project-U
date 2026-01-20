// cleanup-duplicate-slots.js
// Run this script to remove duplicate room slots from the database

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanupDuplicateSlots() {
    console.log('🔍 Finding duplicate room slots...');

    // Get all room slots
    const allSlots = await prisma.roomSlot.findMany({
        orderBy: [
            { sectionId: 'asc' },
            { day: 'asc' },
            { startTime: 'asc' }
        ]
    });

    console.log(`📊 Total slots found: ${allSlots.length}`);

    // Track unique slots and duplicates
    const seen = new Map();
    const duplicatesToDelete = [];

    for (const slot of allSlots) {
        const key = `${slot.sectionId}-${slot.day}-${slot.startTime}-${slot.endTime}-${slot.roomNumber}-${slot.type}`;

        if (seen.has(key)) {
            // This is a duplicate, mark for deletion
            duplicatesToDelete.push(slot.id);
        } else {
            // First occurrence, keep it
            seen.set(key, slot.id);
        }
    }

    console.log(`🎯 Found ${duplicatesToDelete.length} duplicate slots to delete`);
    console.log(`✅ Keeping ${seen.size} unique slots`);

    if (duplicatesToDelete.length > 0) {
        console.log('🗑️  Deleting duplicates...');
        const result = await prisma.roomSlot.deleteMany({
            where: {
                id: { in: duplicatesToDelete }
            }
        });
        console.log(`✨ Deleted ${result.count} duplicate slots`);
    }

    const finalCount = await prisma.roomSlot.count();
    console.log(`📊 Final slot count: ${finalCount}`);
    console.log('✅ Cleanup complete!');

    await prisma.$disconnect();
}

cleanupDuplicateSlots().catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
});
