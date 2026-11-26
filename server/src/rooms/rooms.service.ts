import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface RoomInfo {
  roomNumber: string;
  building: string;
  roomType: 'LAB' | 'THEORY';
}

@Injectable()
export class RoomsService {
  private roomCache: RoomInfo[] | null = null;
  private buildingCache: string[] | null = null;
  private floorCache: string[] | null = null;
  private lastCacheTime = 0;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(private readonly prisma: PrismaService) { }

  // Check if a building code is valid (main floors "07A", ANNEX "AN1"/"ANG", "AS1"/"ASG", or "UB"/"TBA")
  private isValidBuilding(building: string): boolean {
    if (!building) return false;
    if (building === 'UB' || building === 'TBA') return true;
    if (/^(AN|AS)[0-9G]+$/i.test(building)) return true;
    // Valid main-building floor codes start with digits (e.g., "07A", "10B", "7A")
    return /^\d+[A-Za-z]?$/.test(building);
  }

  // Extract floor/building group from building code (e.g., "07A" -> "7", "AN1" -> "ANNEX", "AS1" -> "AS", "UB" -> "UB")
  private extractFloor(building: string): string | null {
    if (building === 'UB' || building === 'TBA') return 'UB';
    if (/^AN[0-9G]+$/i.test(building)) return 'ANNEX';
    if (/^AS[0-9G]+$/i.test(building)) return 'AS';
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
    if (
      !this.roomCache ||
      !this.buildingCache ||
      now - this.lastCacheTime > this.CACHE_TTL
    ) {
      // Fetch fresh data including slot type to classify LAB vs THEORY rooms
      const allSlots = await this.prisma.roomSlot.findMany({
        select: { roomNumber: true, building: true, type: true },
        distinct: ['roomNumber', 'building', 'type'],
        orderBy: { roomNumber: 'asc' },
      });

      // Filter out invalid building codes and merge into unique rooms
      const roomMap = new Map<string, RoomInfo>();
      for (const s of allSlots) {
        if (!this.isValidBuilding(s.building)) continue;
        const key = `${s.building}-${s.roomNumber}`;
        const isLab = s.type === 'LAB' || /L$/i.test(s.roomNumber.trim());
        const existing = roomMap.get(key);
        if (!existing) {
          roomMap.set(key, {
            roomNumber: s.roomNumber,
            building: s.building,
            roomType: isLab ? 'LAB' : 'THEORY',
          });
        } else if (isLab) {
          existing.roomType = 'LAB';
        }
      }

      const validSlots = Array.from(roomMap.values());
      this.roomCache = validSlots;
      this.buildingCache = [
        ...new Set(validSlots.map((s) => s.building)),
      ].sort();

      // Create unique floors list (e.g., ["7", "8", "9", "10", "UB"])
      const floors = new Set<string>();
      validSlots.forEach((s) => {
        const floor = this.extractFloor(s.building);
        if (floor) floors.add(floor);
      });
      this.floorCache = [...floors].sort((a, b) => {
        // Put ANNEX first among named buildings, numeric floors sorted ascending, AS & UB at the end
        const order = (val: string) => {
          if (val === 'ANNEX') return 1000;
          if (val === 'AS') return 1001;
          if (val === 'UB') return 1002;
          return parseInt(val, 10);
        };
        return order(a) - order(b);
      });

      this.lastCacheTime = now;
    }
    return {
      rooms: this.roomCache,
      buildings: this.buildingCache,
      floors: this.floorCache,
    };
  }

  async getBuildings() {
    // Now returns floor numbers instead of building codes
    const { floors } = await this.getCachedData();
    return floors;
  }

  private toMinutes(hhmm: number): number {
    const h = Math.floor(hhmm / 100);
    const m = hhmm % 100;
    return h * 60 + m;
  }

  async findAvailableRooms(day: string, time: number, floor?: string) {
    // 1. Get all known rooms (from cache)
    const { rooms } = await this.getCachedData();
    const timeInMins = this.toMinutes(time);
    const normalizedFloor = floor?.toUpperCase();

    let targetRooms = rooms;
    if (normalizedFloor === 'MAIN') {
      targetRooms = rooms.filter((r) => !/^AN/i.test(r.building));
    } else if (normalizedFloor === 'ANNEX') {
      targetRooms = rooms.filter((r) => /^AN/i.test(r.building));
    } else if (/^AN[0-9G]+$/i.test(normalizedFloor || '')) {
      targetRooms = rooms.filter(
        (r) => r.building.toUpperCase() === normalizedFloor,
      );
    } else if (normalizedFloor === 'AS') {
      targetRooms = rooms.filter((r) => /^AS/i.test(r.building));
    } else if (normalizedFloor === 'UB') {
      targetRooms = rooms.filter(
        (r) => r.building === 'UB' || r.building === 'TBA',
      );
    } else if (normalizedFloor) {
      // Filter by numeric floor prefix (e.g., floor "7" matches buildings "07A", "07B", "7A", "7B", etc.)
      const floorNum = parseInt(normalizedFloor, 10);
      targetRooms = rooms.filter((r) => {
        const roomFloor = this.extractFloor(r.building);
        return (
          roomFloor !== null &&
          /^\d+$/.test(roomFloor) &&
          parseInt(roomFloor, 10) === floorNum
        );
      });
    }

    // University operates 08:00 AM (0800) to 08:20 PM (2020); outside those hours every room is free
    const isUniversityClosed = time < 800 || time >= 2020;
    if (isUniversityClosed) {
      return targetRooms.map((room) => ({
        ...room,
        status: 'FREE' as const,
        freeUntil: null,
        freeMinutes: 720,
      }));
    }

    // 2. Build the building filter based on floor/building selection
    let buildingFilter: any = {};
    if (normalizedFloor === 'MAIN') {
      buildingFilter = { NOT: { building: { startsWith: 'AN' } } };
    } else if (normalizedFloor === 'ANNEX') {
      buildingFilter = { building: { startsWith: 'AN' } };
    } else if (/^AN[0-9G]+$/i.test(normalizedFloor || '')) {
      buildingFilter = { building: normalizedFloor };
    } else if (normalizedFloor === 'AS') {
      buildingFilter = { building: { startsWith: 'AS' } };
    } else if (normalizedFloor === 'UB') {
      buildingFilter = {
        OR: [{ building: 'UB' }, { building: 'TBA' }],
      };
    } else if (normalizedFloor) {
      const floorNum = parseInt(normalizedFloor, 10);
      const paddedFloor = floorNum.toString().padStart(2, '0');
      buildingFilter = {
        OR: [
          { building: { startsWith: paddedFloor } },
          { building: { startsWith: floorNum.toString() } },
        ],
      };
    }

    // Run occupied and future slot queries in parallel for faster response
    const [occupiedSlots, futureSlots] = await Promise.all([
      this.prisma.roomSlot.findMany({
        where: {
          day: day.toUpperCase(),
          startTime: { lte: time },
          endTime: { gt: time },
          ...(normalizedFloor ? buildingFilter : {}),
        },
        select: {
          roomNumber: true,
          building: true,
          endTime: true,
          section: {
            select: {
              course: { select: { code: true } },
              sectionNumber: true,
            },
          },
        },
      }),
      this.prisma.roomSlot.findMany({
        where: {
          day: day.toUpperCase(),
          startTime: { gt: time }, // Starts AFTER now
          ...(normalizedFloor ? buildingFilter : {}),
        },
        select: {
          roomNumber: true,
          building: true,
          startTime: true,
        },
        orderBy: { startTime: 'asc' },
      }),
    ]);

    const occupiedMap = new Map<string, any>();
    occupiedSlots.forEach((s) => {
      occupiedMap.set(`${s.building}-${s.roomNumber}`, s);
    });

    // Map next class time per room
    const roomNextClassMap = new Map<string, number>();
    for (const slot of futureSlots) {
      const key = `${slot.building}-${slot.roomNumber}`;
      if (!roomNextClassMap.has(key)) {
        roomNextClassMap.set(key, slot.startTime);
      }
    }

    // 4. Combine data for all target rooms
    const END_OF_DAY_MINS = 20 * 60 + 20; // 8:20 PM latest Fall '26 class end time
    const result = targetRooms.map((room) => {
      const key = `${room.building}-${room.roomNumber}`;
      const occupied = occupiedMap.get(key);
      const nextClassStart = roomNextClassMap.get(key);

      if (occupied) {
        const courseLabel = occupied.section?.course?.code
          ? `${occupied.section.course.code} (${occupied.section.sectionNumber})`
          : 'Scheduled Class';
        return {
          ...room,
          status: 'BUSY',
          currentClass: courseLabel,
          busyUntil: occupied.endTime,
          freeMinutes: 0,
        };
      } else {
        const freeUntilMins = nextClassStart
          ? this.toMinutes(nextClassStart)
          : Math.max(END_OF_DAY_MINS, timeInMins);
        const freeMinutes = Math.max(0, freeUntilMins - timeInMins);
        return {
          ...room,
          status: 'FREE',
          freeUntil: nextClassStart || null, // null means free for rest of day
          freeMinutes,
        };
      }
    });

    return result;
  }
}
