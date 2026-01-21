import {
  Controller,
  Get,
  Delete,
  Patch,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@ApiBearerAuth()
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get platform statistics' })
  async getStats() {
    return this.adminService.getStats();
  }

  @Get('emails/stats')
  @ApiOperation({ summary: 'Get email statistics for last 7 days' })
  async getEmailStats() {
    return this.adminService.getEmailStats();
  }

  @Get('users')
  @ApiOperation({ summary: 'Get all users with track counts' })
  async getAllUsers(@Query('search') search?: string) {
    return this.adminService.getAllUsers(search);
  }

  @Get('users/:id/tracks')
  @ApiOperation({ summary: 'Get all tracks for a specific user' })
  async getUserTracks(@Param('id') id: string) {
    return this.adminService.getUserTracks(id);
  }

  @Patch('users/:id/status')
  @ApiOperation({ summary: 'Toggle user active status (ban/unban)' })
  async toggleUserStatus(@Param('id') id: string) {
    return this.adminService.toggleUserStatus(id);
  }

  @Delete('tracks/:id')
  @ApiOperation({ summary: 'Terminate a specific track' })
  async terminateTrack(@Param('id') id: string) {
    return this.adminService.terminateTrack(id);
  }

  @Delete('users/:id')
  @ApiOperation({ summary: 'Delete a user and their data' })
  async deleteUser(@Param('id') id: string) {
    return this.adminService.deleteUser(id);
  }
}
