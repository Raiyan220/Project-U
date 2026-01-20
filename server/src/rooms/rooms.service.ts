import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RoomsService {
    private roomCache: { roomNumber: string; building: string }[] | null = null;
    private buildingCache: string[] | null = null;
    private floorCache: string[] | null = null;
    private lastCacheTime = 0;
    private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

    constructor(private readonly prisma: PrismaService) { }

    // Check if a building code is valid (starts with digits like "07A", "10B", or is "UB"/"TBA")
    private isValidBuilding(building: string): boolean {
        if (!building) return false;
        if (building === 'UB' || building === 'TBA') return true;
        // Valid building codes start with digits (e.g., "07A", "10B", "7A")
        return /^\d+[A-Za-z]?$/.test(building);
    }

    // Extract floor number from building code (e.g., "07A" -> "7", "10B" -> "10", "UB" -> "UB")
    private extractFloor(building: string): string | null {
        if (building === 'UB' || building === 'TBA') return 'UB';
        // Match building codes that start with digits (e.g., "07A", "10B")
        const match = building.match(/^(\d+)/);
        if (match) {
            // Remove leading zeros (e.g., "07" -> "7")
            return parseInt(match[1], 10).toString();
        }
        return null; // Invalid building code
    }

    private async getCachedData() {
        const now = Date.now();
        if (!this.roomCache || !this.buildingCache || now - this.lastCacheTime > this.CACHE_TTL) {
            // Fetch fresh data
            const allSlots = await this.prisma.roomSlot.findMany({
                select: { roomNumber: true, building: true },
                distinct: ['roomNumber', 'building'],
                orderBy: { roomNumber: 'asc' }
            });

            // Filter out invalid building codes (like schedule strings)
            const validSlots = allSlots.filter(s => this.isValidBuilding(s.building));

            this.roomCache = validSlots;
            this.buildingCache = [...new Set(validSlots.map(s => s.building))].sort();

            // Create unique floors list (e.g., ["7", "8", "9", "10", "UB"])
            const floors = new Set<string>();
            validSlots.forEach(s => {
                const floor = this.extractFloor(s.building);
                if (floor) floors.add(floor);
            });
            this.floorCache = [...floors].sort((a, b) => {
                // Sort numerically, with "UB" at the end
                if (a === 'UB') return 1;
                if (b === 'UB') return -1;
                return parseInt(a) - parseInt(b);
            });

            this.lastCacheTime = now;
        }
        return { rooms: this.roomCache, buildings: this.buildingCache, floors: this.floorCache };
    }

    async getBuildings() {
        // Now returns floor numbers instead of building codes
        const { floors } = await this.getCachedData();
        return floors;
    }

    async findAvailableRooms(day: string, time: number, floor?: string) {
        // 1. Get all known rooms (from cache)
        const { rooms } = await this.getCachedData();

        let targetRooms = rooms;
        if (floor && floor !== 'UB') {
            // Filter by floor prefix (e.g., floor "7" matches buildings "07A", "07B", "7A", "7B", etc.)
            const floorNum = parseInt(floor, 10);
            targetRooms = rooms.filter(r => {
                const roomFloor = this.extractFloor(r.building);
                return roomFloor !== null && parseInt(roomFloor, 10) === floorNum;
            });
        } else if (floor === 'UB') {
            targetRooms = rooms.filter(r => r.building === 'UB' || r.building === 'TBA');
        }

        // 2. Find rooms that have a class at this time (This must be real-time)
        // Build the building filter based on floor
        let buildingFilter: any = {};
        if (floor && floor !== 'UB') {
            const floorNum = parseInt(floor, 10);
            // Match buildings that start with the floor number (with or without leading zero)
            const paddedFloor = floorNum.toString().padStart(2, '0');
            buildingFilter = {
                OR: [
                    { building: { startsWith: paddedFloor } },
                    { building: { startsWith: floorNum.toString() } },
                ]
            };
        } else if (floor === 'UB') {
            buildingFilter = {
                OR: [
                    { building: 'UB' },
                    { building: 'TBA' },
                ]
            };
        }

        const occupiedSlots = await this.prisma.roomSlot.findMany({
            where: {
                day: day.toUpperCase(),
                startTime: { lte: time },
                endTime: { gt: time },
                ...(floor ? buildingFilter : {}),
            },
            select: {
                roomNumber: true,
                building: true,
            },
        });

        const occupiedSet = new Set(
            occupiedSlots.map((s) => `${s.building}-${s.roomNumber}`),
        );

        // 3. Filter out occupied rooms
        return targetRooms.filter(
            (room) => !occupiedSet.has(`${room.building}-${room.roomNumber}`),
        );
    }
}

