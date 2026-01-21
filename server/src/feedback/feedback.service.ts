import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface CreateFeedbackDto {
  message: string;
  email?: string;
  name?: string;
  userId?: string;
}

@Injectable()
export class FeedbackService {
  private readonly logger = new Logger(FeedbackService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateFeedbackDto) {
    const feedback = await this.prisma.feedback.create({
      data: {
        message: dto.message,
        email: dto.email,
        name: dto.name,
        userId: dto.userId,
      },
    });

    this.logger.log(
      `New feedback received from ${dto.email || dto.name || 'anonymous'}`,
    );
    return feedback;
  }

  async findAll() {
    return this.prisma.feedback.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async markAsRead(id: string) {
    return this.prisma.feedback.update({
      where: { id },
      data: { isRead: true },
    });
  }

  async delete(id: string) {
    return this.prisma.feedback.delete({
      where: { id },
    });
  }

  async getUnreadCount() {
    return this.prisma.feedback.count({
      where: { isRead: false },
    });
  }
}
