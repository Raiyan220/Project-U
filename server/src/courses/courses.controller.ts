import { Controller, Get, Post, Query, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { CoursesService } from './courses.service';
import { BracuService } from './bracu.service';
import { TrackingService } from './tracking.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Delete, Request } from '@nestjs/common';

@ApiTags('courses')
@Controller('courses')
export class CoursesController {
  constructor(
    private readonly coursesService: CoursesService,
    private readonly bracuService: BracuService,
    private readonly trackingService: TrackingService,
  ) { }

  @Post('sync')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Sync courses from BracU CDN' })
  async syncCourses() {
    return this.bracuService.syncCourses();
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get course statistics' })
  async getStats() {
    return this.coursesService.getStats();
  }

  @Get()
  @ApiOperation({ summary: 'Get all courses or search by query' })
  @ApiQuery({ name: 'q', required: false })
  async findAll(@Query('q') q?: string) {
    if (q) {
      return this.coursesService.search(q);
    }
    return this.coursesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get course details by ID' })
  async findOne(@Param('id') id: string) {
    return this.coursesService.findOne(id);
  }

  @Post('track/:sectionId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Track a section for seat notifications' })
  async trackSection(
    @CurrentUser() user: any,
    @Param('sectionId') sectionId: string,
  ) {
    return this.trackingService.trackSection(user.id, sectionId);
  }

  @Delete('track/:sectionId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Untrack a section' })
  async untrackSection(
    @CurrentUser() user: any,
    @Param('sectionId') sectionId: string,
  ) {
    return this.trackingService.untrackSection(user.id, sectionId);
  }

  @Get('tracking/my')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get all tracked sections for the current user' })
  async getMyTracks(@CurrentUser() user: any) {
    return this.trackingService.getUserTracks(user.id);
  }
}
