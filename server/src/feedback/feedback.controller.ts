import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { FeedbackService } from './feedback.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

class CreateFeedbackDto {
  message: string;
  email?: string;
  name?: string;
}

@ApiTags('feedback')
@Controller('feedback')
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  // Public endpoint - anyone can submit feedback
  @Post()
  @ApiOperation({ summary: 'Submit feedback' })
  async create(@Body() dto: CreateFeedbackDto, @Request() req: any) {
    // If there's a user token, extract userId
    let userId: string | undefined;
    try {
      // Try to get user from request if authenticated
      userId = req.user?.id;
    } catch {
      // Not authenticated, continue without userId
    }

    return this.feedbackService.create({
      ...dto,
      userId,
    });
  }

  // Admin-only endpoints below
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all feedback (admin only)' })
  async findAll() {
    return this.feedbackService.findAll();
  }

  @Get('unread-count')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get unread feedback count (admin only)' })
  async getUnreadCount() {
    const count = await this.feedbackService.getUnreadCount();
    return { count };
  }

  @Patch(':id/read')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mark feedback as read (admin only)' })
  async markAsRead(@Param('id') id: string) {
    return this.feedbackService.markAsRead(id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete feedback (admin only)' })
  async delete(@Param('id') id: string) {
    return this.feedbackService.delete(id);
  }
}
