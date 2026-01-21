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
    const now = new Date();

    // Default to current day and time if not provided
    const days = [
      'SUNDAY',
      'MONDAY',
      'TUESDAY',
      'WEDNESDAY',
      'THURSDAY',
      'FRIDAY',
      'SATURDAY',
    ];
    const currentDay = day || days[now.getDay()];

    let currentTime: number;
    if (time) {
      currentTime = parseInt(time, 10);
    } else {
      const hours = now.getHours();
      const minutes = now.getMinutes();
      currentTime = hours * 100 + minutes;
    }

    return this.roomsService.findAvailableRooms(
      currentDay,
      currentTime,
      building,
    );
  }
}
