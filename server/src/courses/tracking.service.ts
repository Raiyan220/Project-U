import {
  Injectable,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';

@Injectable()
export class TrackingService {
  private readonly logger = new Logger(TrackingService.name);

  constructor(
    private prisma: PrismaService,
    private mailService: MailService,
  ) { }

  async trackSection(userId: string, sectionId: string) {
    // Check if section exists
    const section = await this.prisma.section.findUnique({
      where: { id: sectionId },
      include: { course: true },
    });

    if (!section) {
      throw new NotFoundException('Section not found');
    }

    try {
      const tracking = await this.prisma.tracking.upsert({
        where: {
          userId_sectionId: {
            userId,
            sectionId,
          },
        },
        update: {
          active: true,
        },
        create: {
          userId,
          sectionId,
          active: true,
        },
        include: {
          user: true,
          section: {
            include: {
              course: true,
            },
          },
        },
      });

      // If seats are already available, send email immediately
      const available = Math.max(0, section.capacity - section.enrolled);
      this.logger.log(`[TRACK] User ${tracking.user.email} tracking ${section.course.code} Sec ${section.sectionNumber} - Available: ${available}`);

      if (available > 0 && tracking.user.email) {
        this.logger.log(`[EMAIL] Attempting to send immediate notification to ${tracking.user.email}`);
        // Send email asynchronously
        this.mailService
          .sendSeatAvailableEmail(
            tracking.user.email,
            section.course.code,
            section.sectionNumber,
            available,
          )
          .then(() => {
            this.logger.log(`[EMAIL] ✅ Successfully sent to ${tracking.user.email}`);
            this.updateLastNotified(tracking.id);
          })
          .catch((error) => {
            const msg = error instanceof Error ? error.message : String(error);
            this.logger.error(`[EMAIL] ❌ Failed to send to ${tracking.user.email}: ${msg}`);
          });
      } else {
        this.logger.log(`[EMAIL] Skipped - No seats available or no user email`);
      }

      return tracking;
    } catch (error) {
      if (error.code === 'P2002') {
        throw new ConflictException('Already tracking this section');
      }
      throw error;
    }
  }

  async untrackSection(userId: string, sectionId: string) {
    return this.prisma.tracking
      .delete({
        where: {
          userId_sectionId: {
            userId,
            sectionId,
          },
        },
      })
      .catch(() => {
        throw new NotFoundException('Tracking not found');
      });
  }

  async getUserTracks(userId: string) {
    return this.prisma.tracking.findMany({
      where: {
        userId,
        active: true,
      },
      include: {
        section: {
          include: {
            course: true,
            slots: true,
          },
        },
      },
    });
  }

  async getTrackersForSection(sectionId: string) {
    return this.prisma.tracking.findMany({
      where: {
        sectionId,
        active: true,
      },
      include: {
        user: {
          select: {
            email: true,
          },
        },
      },
    });
  }

  async updateLastNotified(trackingId: string) {
    // Check if record exists before updating to prevent "Record not found" errors
    const exists = await this.prisma.tracking.findUnique({
      where: { id: trackingId },
      select: { id: true },
    });

    if (!exists) {
      // Record was deleted, skip update silently
      return null;
    }

    return this.prisma.tracking.update({
      where: { id: trackingId },
      data: { lastNotifiedAt: new Date() },
    });
  }

  async updateNotifyInterval(userId: string, sectionId: string, intervalMinutes: number) {
    // Validate interval (allowed values: 1, 2, 3, 5, 10, 15, 30, 60)
    const allowedIntervals = [1, 2, 3, 5, 10, 15, 30, 60];
    if (!allowedIntervals.includes(intervalMinutes)) {
      throw new Error(`Invalid interval. Allowed values: ${allowedIntervals.join(', ')}`);
    }

    return this.prisma.tracking.update({
      where: {
        userId_sectionId: {
          userId,
          sectionId,
        },
      },
      data: { notifyIntervalMinutes: intervalMinutes },
      include: {
        section: {
          include: {
            course: true,
          },
        },
      },
    });
  }
}
