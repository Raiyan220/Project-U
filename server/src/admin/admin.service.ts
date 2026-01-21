import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalUsers, totalTracks, totalSections, emailsToday] =
      await Promise.all([
        this.prisma.user.count(),
        this.prisma.tracking.count({ where: { active: true } }),
        this.prisma.section.count(),
        this.prisma.emailLog.count({
          where: { sentAt: { gte: today } },
        }),
      ]);

    return {
      totalUsers,
      totalTracks,
      totalSections,
      emailsToday,
    };
  }

  async getEmailStats() {
    // Get email counts for the last 7 days
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      days.push(date);
    }

    const stats = await Promise.all(
      days.map(async (date) => {
        const nextDay = new Date(date);
        nextDay.setDate(nextDay.getDate() + 1);

        const count = await this.prisma.emailLog.count({
          where: {
            sentAt: {
              gte: date,
              lt: nextDay,
            },
          },
        });

        return {
          date: date.toISOString().split('T')[0],
          count,
        };
      }),
    );

    const total = await this.prisma.emailLog.count();
    const sent = await this.prisma.emailLog.count({
      where: { status: 'SENT' },
    });
    const failed = await this.prisma.emailLog.count({
      where: { status: 'FAILED' },
    });

    return {
      dailyStats: stats,
      total,
      sent,
      failed,
    };
  }

  async getAllUsers(search?: string) {
    const where = search
      ? {
          OR: [
            { email: { contains: search, mode: 'insensitive' as const } },
            { name: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const users = await this.prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        profilePicture: true,
        _count: {
          select: { tracks: { where: { active: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return users.map((user) => ({
      ...user,
      trackCount: user._count.tracks,
      _count: undefined,
    }));
  }

  async getUserTracks(userId: string) {
    return this.prisma.tracking.findMany({
      where: { userId, active: true },
      include: {
        section: {
          include: {
            course: true,
          },
        },
      },
    });
  }

  async terminateTrack(trackId: string) {
    const track = await this.prisma.tracking.findUnique({
      where: { id: trackId },
      include: {
        user: { select: { email: true } },
        section: {
          include: { course: { select: { code: true } } },
        },
      },
    });

    if (!track) {
      throw new Error('Track not found');
    }

    await this.prisma.tracking.delete({
      where: { id: trackId },
    });

    this.logger.log(
      `Admin terminated track: ${track.user.email} -> ${track.section.course.code} Sec ${track.section.sectionNumber}`,
    );

    return { message: 'Track terminated successfully' };
  }

  async toggleUserStatus(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, role: true, isActive: true },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Prevent banning admins
    if (user.role === 'ADMIN') {
      throw new Error('Cannot ban admin users');
    }

    const newStatus = !user.isActive;

    await this.prisma.user.update({
      where: { id: userId },
      data: { isActive: newStatus },
    });

    this.logger.log(
      `Admin ${newStatus ? 'activated' : 'banned'} user: ${user.email}`,
    );

    return {
      message: `User ${newStatus ? 'activated' : 'banned'} successfully`,
      isActive: newStatus,
    };
  }

  async deleteUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, role: true },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Prevent deleting admins
    if (user.role === 'ADMIN') {
      throw new Error('Cannot delete admin users');
    }

    // Manually delete related records first because onDelete cascade is not set in schema
    // Delete all tracking records
    await this.prisma.tracking.deleteMany({
      where: { userId },
    });

    // Delete user
    await this.prisma.user.delete({
      where: { id: userId },
    });

    this.logger.log(`Admin deleted user: ${user.email}`);

    return { message: 'User deleted successfully' };
  }
}
