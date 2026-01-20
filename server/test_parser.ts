// Test the FIXED parsing logic
const testString1 = "MONDAY(3:30 PM-4:50 PM-10A-04C)\nWEDNESDAY(3:30 PM-4:50 PM-10A-04C)";
const testString2 = "THURSDAY(8:00 AM-10:50 AM-09B-08L)";

const parseTime12h = (time12h: string): number => {
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

// FIXED: Using [AP]M instead of [APM]{2}
const parseScheduleString = (str: string, type: 'CLASS' | 'LAB') => {
    if (!str) return [];
    const lines = str.split('\n').filter(line => line.trim());
    const results: any[] = [];

    for (const line of lines) {
        const match = line.match(/^([A-Z]+)\s*\(([^)]+)\)$/i);
        if (match) {
            const day = match[1].toUpperCase();
            const content = match[2];

            // FIXED REGEX: [AP]M instead of [APM]{2}
            const timeMatch = content.match(/(\d{1,2}:\d{2}\s*[AP]M)\s*-\s*(\d{1,2}:\d{2}\s*[AP]M)\s*-\s*(.+)/i);

            if (timeMatch) {
                results.push({
                    day,
                    startTime: parseTime12h(timeMatch[1]),
                    endTime: parseTime12h(timeMatch[2]),
                    roomNumber: timeMatch[3].trim(),
                    type
                });
            }
        }
    }
    return results;
};

console.log('=== Testing Class Schedule (should find 2 slots) ===');
const classSlots = parseScheduleString(testString1, 'CLASS');
console.log('Found', classSlots.length, 'slots');
classSlots.forEach((s, i) => console.log(`Slot ${i + 1}:`, s));

console.log('\n=== Testing Lab Schedule (should find 1 slot) ===');
const labSlots = parseScheduleString(testString2, 'LAB');
console.log('Found', labSlots.length, 'slots');
labSlots.forEach((s, i) => console.log(`Slot ${i + 1}:`, s));
