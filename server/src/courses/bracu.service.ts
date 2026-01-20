import {
  Injectable,
  Logger,
  OnModuleInit,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { HttpService } from '@nestjs/axios';
import { PrismaService } from '../prisma/prisma.service';
import { firstValueFrom } from 'rxjs';
import { CoursesGateway } from './courses.gateway';
import { MailService } from '../mail/mail.service';
import { TrackingService } from './tracking.service';

interface BracuSection {
  courseCode: string;
  academicDegree: string;
  sectionId: number;
  sectionName: string;
  capacity: number;
  consumedSeat: number;
  faculties: string;
  roomNumber: string | null;
  roomName: string | null;
  sectionSchedule: {
    finalExamDetail: string;
    classSchedules: {
      startTime: string;
      endTime: string;
      day: string;
      roomNo?: string;
    }[];
  };
  labSchedules:
  | {
    startTime: string;
    endTime: string;
    day: string;
    roomNo?: string;
  }[]
  | null;
  labFaculties: string | null;
  labRoomName: string | null;
  prerequisiteCourses: string | null;
  preRegSchedule: string;
  preRegLabSchedule: string | null;
}

@Injectable()
export class BracuService implements OnModuleInit {
  private readonly logger = new Logger(BracuService.name);
  private readonly CDN_URL = 'https://usis-cdn.eniamza.com/connect.json';
  private previousSeatData = new Map<
    string,
    { enrolled: number; capacity: number; slotCount: number }
  >();
  private upsertedCourses = new Set<string>(); // Cache to avoid redundant course upserts
  private isSyncing = false; // Lock to prevent concurrent syncs

  constructor(
    private readonly httpService: HttpService,
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => CoursesGateway))
    private readonly coursesGateway: CoursesGateway,
    private readonly mailService: MailService,
    private readonly trackingService: TrackingService,
  ) { }

  async onModuleInit() {
    // Load existing seat data to detect changes
    const existingSections = await this.prisma.section.findMany({
      select: {
        id: true,
        enrolled: true,
        capacity: true,
        _count: { select: { slots: true } }
      },
    });
    existingSections.forEach((s) => {
      this.previousSeatData.set(s.id, {
        enrolled: s.enrolled,
        capacity: s.capacity,
        slotCount: s._count.slots,
      });
    });
    // Run initial sync asynchronously to not block startup
    void this.syncCourses();
  }

  // Sync every 30 seconds for near real-time updates (fastest safe option)
  @Cron('*/30 * * * * *')
  async handleCron() {
    this.logger.debug('Running scheduled course sync (every 30 seconds)...');
    await this.syncCourses();
  }

  // Periodic reminder for stay-available seats every 1 minute
  @Cron('0 * * * * *')
  async processTrackedReminders() {
    try {
      this.logger.log('Cron Trigger: Checking for periodic seat reminders...');

      // Get all active tracks with their custom intervals
      const tracksToCheck = await (this.prisma.tracking as any).findMany({
        where: {
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

      if (tracksToCheck.length === 0) {
        this.logger.log('Cron: No active tracks found.');
        return;
      }

      this.logger.log(`Cron: Found ${tracksToCheck.length} active tracks to check.`);

      const now = Date.now();
      let notifiedCount = 0;

      for (const track of tracksToCheck as any[]) {
        // Use user's custom interval (default: 5 minutes)
        const intervalMinutes = track.notifyIntervalMinutes || 5;
        const intervalMs = intervalMinutes * 60 * 1000;
        const intervalAgo = new Date(now - intervalMs);

        // Check if enough time has passed since last notification
        const shouldNotify = !track.lastNotifiedAt || new Date(track.lastNotifiedAt) < intervalAgo;

        if (!shouldNotify) {
          continue; // Skip - still in cooldown period
        }

        const available = Math.max(0, track.section.capacity - track.section.enrolled);

        if (available > 0 && track.user.email) {
          this.logger.log(`Cron: Sending reminder to ${track.user.email} for ${track.section.course.code} (interval: ${intervalMinutes}min)`);
          notifiedCount++;

          void this.mailService.sendSeatAvailableEmail(
            track.user.email,
            track.section.course.code,
            track.section.sectionNumber,
            available,
          ).then(() => {
            this.trackingService.updateLastNotified(track.id).catch((e) => {
              this.logger.error(`Cron: Failed to update lastNotifiedAt for ${track.id}: ${e.message}`);
            });
          }).catch(err => {
            const msg = err instanceof Error ? err.message : String(err);
            this.logger.error(`Cron: Reminder failed for ${track.user.email}: ${msg}`);
          });
        }
      }

      this.logger.log(`Cron: Sent ${notifiedCount} reminder notifications.`);
    } catch (error) {
      this.logger.error(`Cron: Error in processTrackedReminders: ${error.message}`);
    }
  }

  async syncCourses() {
    // Prevent concurrent syncs
    if (this.isSyncing) {
      this.logger.warn('Sync already in progress, skipping...');
      return { success: false, message: 'Sync already in progress' };
    }

    this.isSyncing = true;
    this.logger.log('Starting BracU course synchronization...');
    try {
      const response = await firstValueFrom(this.httpService.get(this.CDN_URL));
      const sections = response.data as BracuSection[];

      if (!Array.isArray(sections)) {
        throw new Error('Invalid data format from CDN');
      }

      this.logger.log(`Fetched ${sections.length} sections. Processing...`);

      // 1. Extract and Upsert All Courses First (Prevent Race Conditions)
      const uniqueCourses = new Set<string>();
      const courseDetails = new Map<string, { title: string; dept: string }>();

      sections.forEach((s) => {
        uniqueCourses.add(s.courseCode);
        if (!courseDetails.has(s.courseCode)) {
          courseDetails.set(s.courseCode, {
            title: s.courseCode,
            dept: s.academicDegree,
          });
        }
      });

      this.logger.log(
        `Found ${uniqueCourses.size} unique courses. Upserting...`,
      );
      const courseCodeToIdMap = new Map<string, string>();

      for (const code of uniqueCourses) {
        // Only upsert if not already cached in this session
        if (this.upsertedCourses.has(code)) continue;

        const details = courseDetails.get(code);
        try {
          const course = await this.prisma.course.upsert({
            where: { code: code },
            update: {
              title: details?.title,
              department: details?.dept,
            },
            create: {
              code: code,
              title: details?.title || code,
              department: details?.dept || 'Unknown',
            },
          });
          courseCodeToIdMap.set(code, course.id);
          this.upsertedCourses.add(code); // Mark as done
        } catch (e) {
          this.logger.error(`Failed to upsert course ${code}: ${e}`);
        }
      }

      this.logger.log('Courses upserted. Processing sections...');

      // 2. Collect sections that need updates and bulk delete their slots
      const sectionsToUpdate = sections.filter((item) => {
        const sectionIdStr = item.sectionId.toString();
        const prev = this.previousSeatData.get(sectionIdStr);
        return (
          !prev ||
          prev.slotCount === 0 ||
          prev.enrolled !== item.consumedSeat ||
          prev.capacity !== item.capacity
        );
      });

      // Bulk delete slots for all sections that need updates (HUGE performance gain)
      if (sectionsToUpdate.length > 0) {
        const sectionIdsToDelete = sectionsToUpdate.map((s) => s.sectionId.toString());
        await this.prisma.roomSlot.deleteMany({
          where: { sectionId: { in: sectionIdsToDelete } },
        });
        this.logger.log(`Bulk deleted slots for ${sectionsToUpdate.length} sections`);
      }

      // 3. Upsert Sections
      const BATCH_SIZE = 100; // Increased from 20 for better performance
      for (let i = 0; i < sectionsToUpdate.length; i += BATCH_SIZE) {
        const batch = sectionsToUpdate.slice(i, i + BATCH_SIZE);
        await Promise.all(
          batch.map(async (item) => {
            const courseId = courseCodeToIdMap.get(item.courseCode);
            if (!courseId) return;

            try {
              const sectionIdStr = item.sectionId.toString();

              // Upsert Section
              await this.prisma.section.upsert({
                where: { id: sectionIdStr },
                update: {
                  sectionNumber: item.sectionName,
                  capacity: item.capacity,
                  enrolled: item.consumedSeat,
                  status:
                    item.consumedSeat >= item.capacity ? 'CLOSED' : 'OPEN',
                  // @ts-ignore
                  facultyInitials: item.faculties,
                  // @ts-ignore
                  examDate: item.sectionSchedule?.finalExamDetail,
                  // @ts-ignore
                  labFacultyInitials: item.labFaculties,
                  // @ts-ignore
                  prerequisites: item.prerequisiteCourses,
                  lastUpdated: new Date(),
                },
                create: {
                  id: sectionIdStr,
                  courseId: courseId,
                  sectionNumber: item.sectionName,
                  capacity: item.capacity,
                  enrolled: item.consumedSeat,
                  status:
                    item.consumedSeat >= item.capacity ? 'CLOSED' : 'OPEN',
                  // @ts-ignore
                  facultyInitials: item.faculties,
                  // @ts-ignore
                  examDate: item.sectionSchedule?.finalExamDetail,
                  // @ts-ignore
                  labFacultyInitials: item.labFaculties,
                  // @ts-ignore
                  prerequisites: item.prerequisiteCourses,
                },
              });

              // Parse and collect slot data (slots already deleted in bulk above)

              const parseTime12h = (time12h: string): number => {
                if (!time12h) return 0;
                // Handle formats like "3:30 PM", "3:30PM", "03:30 PM"
                const cleaned = time12h.trim().replace(/\s+/g, ' ');
                const match = cleaned.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
                if (!match) return 0;
                let h = parseInt(match[1], 10);
                const m = match[2];
                const ampm = match[3].toUpperCase();
                if (ampm === 'PM' && h < 12) h += 12;
                if (ampm === 'AM' && h === 12) h = 0;
                return parseInt(
                  `${h.toString().padStart(2, '0')}${m.padStart(2, '0')}`,
                  10,
                );
              };

              const parseTime24 = (timeStr: string): number => {
                if (!timeStr) return 0;
                const parts = timeStr.split(':');
                return parseInt(
                  `${parts[0].padStart(2, '0')}${parts[1].padStart(2, '0')}`,
                  10,
                );
              };

              // Helper to parse "DAY(TIME-TIME-ROOM)" format
              // Example: "MONDAY(3:30 PM-4:50 PM-10A-04C)"
              const parseScheduleString = (
                str: string,
                type: 'CLASS' | 'LAB',
              ) => {
                if (!str) return [];
                const lines = str.split(/[\r\n]+/).filter((line) => line.trim());
                const results: any[] = [];

                for (const line of lines) {
                  // Match: DAY(content)
                  const match = line.match(/^([A-Z]+)\s*\(([^)]+)\)$/i);
                  if (match) {
                    const day = match[1].toUpperCase();
                    const content = match[2];

                    // Use regex to extract times with AM/PM and the room
                    // Format: "3:30 PM-4:50 PM-10A-04C"
                    // Fixed: [AP]M instead of [APM]{2}
                    const timeMatch = content.match(
                      /(\d{1,2}:\d{2}\s*[AP]M)\s*-\s*(\d{1,2}:\d{2}\s*[AP]M)\s*-\s*(.+)/i,
                    );

                    if (timeMatch) {
                      results.push({
                        day,
                        startTime: parseTime12h(timeMatch[1]),
                        endTime: parseTime12h(timeMatch[2]),
                        roomNumber: timeMatch[3].trim() || 'TBA',
                        type,
                      });
                    }
                  }
                }
                return results;
              };

              // Collect all slots to create in bulk
              const slotsToCreate: any[] = [];

              // 1. Process Class Slots
              let classSlotsProcessed = false;
              const classSlotsFromStr = parseScheduleString(
                item.preRegSchedule || '',
                'CLASS',
              );
              if (classSlotsFromStr.length > 0) {
                for (const slot of classSlotsFromStr) {
                  const roomStr = slot.roomNumber || 'TBA';
                  const floorMatch = roomStr.match(/^([^-]+)/);
                  const floorCode = floorMatch ? floorMatch[1] : 'UB';
                  slotsToCreate.push({
                    day: slot.day,
                    startTime: slot.startTime,
                    endTime: slot.endTime,
                    roomNumber: roomStr,
                    building: floorCode,
                    type: 'CLASS',
                    sectionId: item.sectionId.toString(),
                  });
                }
                classSlotsProcessed = true;
              }

              if (!classSlotsProcessed && item.sectionSchedule?.classSchedules) {
                for (const slot of item.sectionSchedule.classSchedules) {
                  const roomStr = slot.roomNo || item.roomNumber || item.roomName || 'TBA';
                  const floorMatch = roomStr.match(/^([^-]+)/);
                  const floorCode = floorMatch ? floorMatch[1] : 'UB';
                  slotsToCreate.push({
                    day: slot.day,
                    startTime: parseTime24(slot.startTime),
                    endTime: parseTime24(slot.endTime),
                    roomNumber: roomStr,
                    building: floorCode,
                    type: 'CLASS',
                    sectionId: item.sectionId.toString(),
                  });
                }
              }

              // 2. Process Lab Slots
              let labSlotsProcessed = false;
              const labSlotsFromStr = parseScheduleString(
                item.preRegLabSchedule || '',
                'LAB',
              );
              if (labSlotsFromStr.length > 0) {
                for (const slot of labSlotsFromStr) {
                  const roomStr = slot.roomNumber || 'TBA';
                  const floorMatch = roomStr.match(/^([^-]+)/);
                  const floorCode = floorMatch ? floorMatch[1] : 'UB';
                  slotsToCreate.push({
                    day: slot.day,
                    startTime: slot.startTime,
                    endTime: slot.endTime,
                    roomNumber: roomStr,
                    building: floorCode,
                    type: 'LAB',
                    sectionId: item.sectionId.toString(),
                  });
                }
                labSlotsProcessed = true;
              }

              // Fallback to labSchedules or labRoomName if string parsing yielded nothing
              if (!labSlotsProcessed && (item.labSchedules || item.labRoomName)) {
                if (item.labSchedules && item.labSchedules.length > 0) {
                  for (const slot of item.labSchedules) {
                    const roomStr = slot.roomNo || item.labRoomName || item.roomName || 'TBA';
                    const floorMatch = roomStr.match(/^([^-]+)/);
                    const floorCode = floorMatch ? floorMatch[1] : 'UB';
                    slotsToCreate.push({
                      day: slot.day,
                      startTime: parseTime24(slot.startTime),
                      endTime: parseTime24(slot.endTime),
                      roomNumber: roomStr,
                      building: floorCode,
                      type: 'LAB',
                      sectionId: item.sectionId.toString(),
                    });
                  }
                }
              }

              // Bulk create all slots at once (HUGE performance improvement)
              // Deduplicate slots before insertion to prevent DB duplicates
              if (slotsToCreate.length > 0) {
                const dedupMap = new Map<string, any>();
                slotsToCreate.forEach(slot => {
                  const key = `${slot.sectionId}-${slot.day}-${slot.startTime}-${slot.endTime}-${slot.roomNumber}-${slot.type}`;
                  if (!dedupMap.has(key)) {
                    dedupMap.set(key, slot);
                  }
                });

                const uniqueSlots = Array.from(dedupMap.values());
                this.logger.debug(`Section ${item.sectionId}: ${slotsToCreate.length} slots -> ${uniqueSlots.length} unique`);

                await this.prisma.roomSlot.createMany({
                  data: uniqueSlots,
                  skipDuplicates: true,
                });
              }

              const totalSlotsCreated = slotsToCreate.length;

              // Mark as processed to ensure cache is updated with correct slotCount
              (item as any)._slotCount = totalSlotsCreated;
              (item as any)._processed = true;
            } catch (err) {
              this.logger.error(
                `Failed to process section ${item.sectionId}: ${(err as Error).message}`,
              );
            }
          }),
        );
      }

      // 3. Detect seat changes and broadcast via WebSocket
      const seatUpdates: {
        sectionId: string;
        courseCode: string;
        sectionNumber: string;
        enrolled: number;
        capacity: number;
        available: number;
        status: string;
      }[] = [];

      for (const item of sections) {
        const sectionId = item.sectionId.toString();
        const prevData = this.previousSeatData.get(sectionId);
        const newEnrolled = item.consumedSeat;
        const newCapacity = item.capacity;

        // Check if seat data changed
        if (
          !prevData ||
          prevData.enrolled !== newEnrolled ||
          prevData.capacity !== newCapacity ||
          prevData.slotCount === 0
        ) {
          seatUpdates.push({
            sectionId,
            courseCode: item.courseCode,
            sectionNumber: item.sectionName,
            enrolled: newEnrolled,
            capacity: newCapacity,
            available: Math.max(0, newCapacity - newEnrolled),
            status: newEnrolled >= newCapacity ? 'CLOSED' : 'OPEN',
          });

          // Update cache
          this.previousSeatData.set(sectionId, {
            enrolled: newEnrolled,
            capacity: newCapacity,
            slotCount: (item as any)._processed ? (item as any)._slotCount : (prevData?.slotCount || 0)
          });

          // NEW: Notification Logic
          // Trigger email if there are available seats.
          // The handleSeatOpening method will handle the 5-minute cooldown per user.
          const newAvailable = Math.max(0, newCapacity - newEnrolled);

          if (newAvailable > 0) {
            await this.handleSeatOpening(
              sectionId,
              item.courseCode,
              item.sectionName,
              newAvailable,
            );
          }
        }
      }

      // Broadcast seat updates to all connected clients
      if (seatUpdates.length > 0) {
        this.logger.log(
          `Detected ${seatUpdates.length} seat changes, broadcasting...`,
        );
        this.coursesGateway.broadcastSeatUpdate(seatUpdates);
      }

      // Broadcast sync complete
      this.coursesGateway.broadcastSyncComplete({
        totalSections: sections.length,
        updatedSections: seatUpdates.length,
      });

      // Update precomputed stats for fast dashboard loads
      await this.updateCourseStats(sections);

      this.logger.log('Synchronization complete!');
      return {
        success: true,
        count: sections.length,
        updatedSections: seatUpdates.length,
      };
    } catch (error) {
      this.logger.error(`Synchronization failed: ${(error as Error).message}`);
      throw error;
    } finally {
      this.isSyncing = false; // Always release the lock
    }
  }

  private async updateCourseStats(sections: any[]) {
    try {
      const totalCourses = await this.prisma.course.count();
      const totalSections = sections.length;
      const totalAvailableSeats = sections.reduce(
        (acc, section) => acc + Math.max(0, section.capacity - section.consumedSeat),
        0,
      );

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

      this.logger.debug(`Stats updated: ${totalCourses} courses, ${totalSections} sections, ${totalAvailableSeats} available seats`);
    } catch (error) {
      this.logger.error(`Failed to update course stats: ${(error as Error).message}`);
    }
  }

  private async handleSeatOpening(
    sectionId: string,
    courseCode: string,
    sectionNumber: string,
    available: number,
  ) {
    try {
      const trackers =
        await this.trackingService.getTrackersForSection(sectionId);
      if (trackers.length === 0) return;

      this.logger.log(
        `Notifying ${trackers.length} trackers for ${courseCode} Sec ${sectionNumber}`,
      );

      for (const track of trackers as any[]) {
        // 5-minute cooldown check
        const fiveMinutesAgo = new Date(Date.now() - 4.5 * 60 * 1000); // 4.5 min to avoid strict edge cases
        const shouldNotify = !track.lastNotifiedAt || track.lastNotifiedAt < fiveMinutesAgo;

        if (track.user.email && shouldNotify) {
          this.logger.log(`Sync: Sending seat opening notification to ${track.user.email} for ${courseCode}`);
          // Send email asynchronously
          void this.mailService.sendSeatAvailableEmail(
            track.user.email,
            courseCode,
            sectionNumber,
            available
          ).then(() => {
            // Update last notified time
            this.trackingService.updateLastNotified(track.id).catch(() => { });
          }).catch(err => {
            const msg = err instanceof Error ? err.message : String(err);
            this.logger.error(`Sync: Notification failed for ${track.user.email}: ${msg}`);
          });
        } else if (track.user.email) {
          this.logger.debug(`Sync: Cooldown active for ${track.user.email} (${courseCode}). Skipping.`);
        }
      }

      // Optional: Mark tracks as inactive?
      // User might want to be notified every time it opens, or just once.
      // Usually "one-shot" is better to avoid spamming.
      // Let's stick to notifying as long as they track it for now.
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error in handleSeatOpening for ${sectionId}: ${errorMessage}`);
    }
  }
}
