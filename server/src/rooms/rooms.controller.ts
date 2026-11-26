import { Controller, Get, Query } from '@nestjs/common';
import { RoomsService } from './rooms.service';

@Controller('rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Get('buildings')
  async getBuildings() {
    return this.roomsService.getBuildings();
  }

  @Get('available')
  async getAvailableRooms(
    @Query('day') day?: string,
    @Query('time') time?: string, // Format: HHMM (e.g. 0830)
    @Query('building') building?: string,
  ) {
    // Always default to Bangladesh Standard Time (Asia/Dhaka, UTC+6) instead of server UTC
    const now = new Date();
    const dhakaParts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Dhaka',
      weekday: 'long',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(now);

    const partMap = Object.fromEntries(
      dhakaParts.map((p) => [p.type, p.value]),
    );
    const currentDay = (day || partMap.weekday || 'SUNDAY').toUpperCase();

    let currentTime: number;
    if (time) {
      currentTime = parseInt(time, 10);
    } else {
      const hours = parseInt(partMap.hour || '0', 10);
      const minutes = parseInt(partMap.minute || '0', 10);
      currentTime = hours * 100 + minutes;
    }

    return this.roomsService.findAvailableRooms(
      currentDay,
      currentTime,
      building,
    );
  }
}
