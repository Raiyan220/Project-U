import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';

@Injectable()
export class TrackingService {
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
      if (available > 0 && tracking.user.email) {
        // Send email asynchronously
        this.mailService
          .sendSeatAvailableEmail(
            tracking.user.email,
            section.course.code,
            section.sectionNumber,
            available,
          )
          .then(() => {
            this.updateLastNotified(tracking.id);
          })
          .catch(() => { });
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
    return this.prisma.tracking.update({
      where: { id: trackingId },
      data: { lastNotifiedAt: new Date() },
    });
  }
}
