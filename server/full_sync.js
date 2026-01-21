const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const prisma = new PrismaClient();

const CONNECT_SLMS_URL = 'https://usis-cdn.eniamza.com/connect.json';

// Time parsing utilities
const parseTime12h = (time12h) => {
    if (!time12h) return 0;
    const cleaned = time12h.trim().replace(/\s+/g, ' ');
    const match = cleaned.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (!match) return 0;
    let h = parseInt(match[1], 10);
    const m = match[2];
    const ampm = match[3].toUpperCase();
    if (ampm === 'PM' && h < 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;
    return parseInt(`${h.toString().padStart(2, '0')}${m.padStart(2, '0')}`, 10);
};

const parseTime24 = (timeStr) => {
    if (!timeStr) return 0;
    const parts = timeStr.split(':');
    if (parts.length < 2) return 0;
    return parseInt(`${parts[0].padStart(2, '0')}${parts[1].padStart(2, '0')}`, 10);
};

// Parse string-based schedule like "MONDAY(3:30 PM-4:50 PM-10A-04C)"
const parseScheduleString = (str, type) => {
    if (!str) return [];
    const lines = str.split(/[\r\n]+/).filter(line => line.trim());
    const results = [];
    for (const line of lines) {
        const match = line.match(/^([A-Z]+)\s*\(([^)]+)\)$/i);
        if (match) {
            const day = match[1].toUpperCase();
            const content = match[2];
            const timeMatch = content.match(/(\d{1,2}:\d{2}\s*[AP]M)\s*-\s*(\d{1,2}:\d{2}\s*[AP]M)\s*-\s*(.+)/i);
            if (timeMatch) {
                const room = timeMatch[3].trim() || 'TBA';
                const floor = room.split('-')[0] || 'UB';
                results.push({
                    day,
                    startTime: parseTime12h(timeMatch[1]),
                    endTime: parseTime12h(timeMatch[2]),
                    roomNumber: room,
                    building: floor,
                    type
                });
            }
        }
    }
    return results;
};

async function fullSync() {
    console.log('🚀 Starting FULL course sync...');
    console.log('📡 Fetching data from CDN...');

    const response = await axios.get(CONNECT_SLMS_URL);
    const sections = response.data;
    console.log(`📦 Fetched ${sections.length} sections from CDN`);

    // Extract unique courses
    const courseMap = new Map();
    sections.forEach(s => {
        if (!courseMap.has(s.courseCode)) {
            courseMap.set(s.courseCode, {
                code: s.courseCode,
                title: s.courseCode, // Will be updated if we have better data
                department: s.academicDegree || 'UNDERGRADUATE'
            });
        }
    });

    console.log(`📚 Found ${courseMap.size} unique courses`);

    // Upsert all courses
    const courseIdMap = new Map();
    for (const [code, details] of courseMap) {
        const course = await prisma.course.upsert({
            where: { code },
            update: {},
            create: { code, title: details.title, department: details.department }
        });
        courseIdMap.set(code, course.id);
    }
    console.log('✅ Courses synced');

    // Process sections in batches
    let processedCount = 0;
    let errorCount = 0;
    let slotsCreated = 0;

    for (const item of sections) {
        const courseId = courseIdMap.get(item.courseCode);
        if (!courseId) continue;

        const sectionId = item.sectionId.toString();

        try {
            // Upsert section
            await prisma.section.upsert({
                where: { id: sectionId },
                update: {
                    sectionNumber: item.sectionName,
                    capacity: item.capacity,
                    enrolled: item.consumedSeat,
                    status: item.consumedSeat >= item.capacity ? 'CLOSED' : 'OPEN',
                    facultyInitials: item.faculties || 'TBA',
                    labFacultyInitials: item.labFaculties || null,
                    examDate: item.sectionSchedule?.finalExamDetail || null,
                    prerequisites: item.prerequisiteCourses || null,
                    lastUpdated: new Date()
                },
                create: {
                    id: sectionId,
                    courseId,
                    sectionNumber: item.sectionName,
                    capacity: item.capacity,
                    enrolled: item.consumedSeat,
                    status: item.consumedSeat >= item.capacity ? 'CLOSED' : 'OPEN',
                    facultyInitials: item.faculties || 'TBA',
                    labFacultyInitials: item.labFaculties || null,
                    examDate: item.sectionSchedule?.finalExamDetail || null,
                    prerequisites: item.prerequisiteCourses || null
                }
            });

            // Delete existing slots for this section
            await prisma.roomSlot.deleteMany({ where: { sectionId } });

            // --- PROCESS CLASS SLOTS ---
            // Try string-based first (preRegSchedule)
            let classSlots = parseScheduleString(item.preRegSchedule || '', 'CLASS');

            // Fallback to array-based (classSchedules)
            if (classSlots.length === 0 && item.sectionSchedule?.classSchedules) {
                for (const slot of item.sectionSchedule.classSchedules) {
                    const room = slot.roomNo || item.roomNumber || item.roomName || 'TBA';
                    const floor = room.split('-')[0] || 'UB';
                    classSlots.push({
                        day: slot.day,
                        startTime: parseTime24(slot.startTime),
                        endTime: parseTime24(slot.endTime),
                        roomNumber: room,
                        building: floor,
                        type: 'CLASS'
                    });
                }
            }

            // Create class slots
            for (const slot of classSlots) {
                await prisma.roomSlot.create({
                    data: { ...slot, sectionId }
                });
                slotsCreated++;
            }

            // --- PROCESS LAB SLOTS ---
            // Try string-based first (preRegLabSchedule)
            let labSlots = parseScheduleString(item.preRegLabSchedule || '', 'LAB');

            // Fallback to array-based (labSchedules)
            if (labSlots.length === 0 && item.labSchedules && item.labSchedules.length > 0) {
                for (const slot of item.labSchedules) {
                    const room = slot.roomNo || item.labRoomName || 'TBA';
                    const floor = room.split('-')[0] || 'UB';
                    labSlots.push({
                        day: slot.day,
                        startTime: parseTime24(slot.startTime),
                        endTime: parseTime24(slot.endTime),
                        roomNumber: room,
                        building: floor,
                        type: 'LAB'
                    });
                }
            }

            // Create lab slots
            for (const slot of labSlots) {
                await prisma.roomSlot.create({
                    data: { ...slot, sectionId }
                });
                slotsCreated++;
            }

            processedCount++;
            if (processedCount % 100 === 0) {
                console.log(`⏳ Processed ${processedCount}/${sections.length} sections...`);
            }
        } catch (err) {
            errorCount++;
            console.error(`❌ Error processing section ${sectionId}: ${err.message}`);
        }
    }

    console.log('\n========================================');
    console.log('🎉 FULL SYNC COMPLETE!');
    console.log(`✅ Processed: ${processedCount} sections`);
    console.log(`📋 Created: ${slotsCreated} room slots`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log('========================================\n');

    // Verify CSE110-04 specifically
    const cse110_04 = await prisma.section.findFirst({
        where: {
            course: { code: 'CSE110' },
            sectionNumber: '04'
        },
        include: { slots: true }
    });

    if (cse110_04) {
        console.log('🔍 Verification - CSE110-[04]:');
        console.log(`   Section ID: ${cse110_04.id}`);
        console.log(`   Total Slots: ${cse110_04.slots.length}`);
        console.log('   Slots:');
        cse110_04.slots.forEach(slot => {
            console.log(`     - ${slot.type}: ${slot.day} ${slot.startTime}-${slot.endTime} [${slot.roomNumber}]`);
        });
    }

    await prisma.$disconnect();
}

fullSync().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
