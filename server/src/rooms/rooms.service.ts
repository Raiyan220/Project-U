import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RoomsService {
    private roomCache: { roomNumber: string; building: string }[] | null = null;
    private buildingCache: string[] | null = null;
    private lastCacheTime = 0;
    private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

    constructor(private readonly prisma: PrismaService) { }

    private async getCachedData() {
        const now = Date.now();
        if (!this.roomCache || !this.buildingCache || now - this.lastCacheTime > this.CACHE_TTL) {
            // Fetch fresh data
            const allSlots = await this.prisma.roomSlot.findMany({
                select: { roomNumber: true, building: true },
                distinct: ['roomNumber', 'building'],
                orderBy: { roomNumber: 'asc' }
            });

            this.roomCache = allSlots;
            this.buildingCache = [...new Set(allSlots.map(s => s.building))].sort();
            this.lastCacheTime = now;
        }
        return { rooms: this.roomCache, buildings: this.buildingCache };
    }

    async getBuildings() {
        const { buildings } = await this.getCachedData();
        return buildings;
    }

    async findAvailableRooms(day: string, time: number, building?: string) {
        // 1. Get all known rooms (from cache)
        const { rooms } = await this.getCachedData();

        let targetRooms = rooms;
        if (building) {
            targetRooms = rooms.filter(r => r.building === building);
        }

        // 2. Find rooms that have a class at this time (This must be real-time)
        const occupiedSlots = await this.prisma.roomSlot.findMany({
            where: {
                day: day.toUpperCase(),
                startTime: { lte: time },
                endTime: { gt: time },
                ...(building ? { building } : {}), // Add DB-level filter
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
