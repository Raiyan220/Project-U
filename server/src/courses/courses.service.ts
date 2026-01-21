import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CoursesService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.course.findMany({
      include: {
        sections: {
          include: {
            slots: true,
          },
          orderBy: {
            sectionNumber: 'asc',
          },
        },
        _count: {
          select: { sections: true },
        },
      },
      take: 20, // Limit initial load for performance
    });
  }

  async findOne(id: string) {
    return this.prisma.course.findUnique({
      where: { id },
      include: {
        sections: {
          include: {
            slots: true,
          },
        },
      },
    });
  }

  async search(query: string) {
    return this.prisma.course.findMany({
      where: {
        OR: [
          { code: { contains: query, mode: 'insensitive' } },
          { title: { contains: query, mode: 'insensitive' } },
        ],
      },
      include: {
        sections: {
          include: {
            slots: true,
          },
          orderBy: {
            sectionNumber: 'asc',
          },
        },
        _count: {
          select: { sections: true },
        },
      },
    });
  }

  async getStats() {
    // Try to get precomputed stats first (FAST!)
    const cachedStats = await this.prisma.courseStats.findUnique({
      where: { id: 1 },
    });

    if (cachedStats) {
      return {
        totalCourses: cachedStats.totalCourses,
        totalSections: cachedStats.totalSections,
        totalAvailableSeats: cachedStats.totalAvailableSeats,
      };
    }

    // Fallback: Calculate stats if not yet precomputed (first run)
    const totalCourses = await this.prisma.course.count();
    const sections = await this.prisma.section.findMany({
      select: {
        capacity: true,
        enrolled: true,
      },
    });

    const totalSections = sections.length;
    const totalAvailableSeats = sections.reduce(
      (acc, section) => acc + Math.max(0, section.capacity - section.enrolled),
      0,
    );

    // Save for next time
    await this.prisma.courseStats.upsert({
      where: { id: 1 },
      create: {
        id: 1,
        totalCourses,
        totalSections,
        totalAvailableSeats,
      },
      update: {
        totalCourses,
        totalSections,
        totalAvailableSeats,
        lastUpdated: new Date(),
      },
    });

    return {
      totalCourses,
      totalSections,
      totalAvailableSeats,
    };
  }
}
