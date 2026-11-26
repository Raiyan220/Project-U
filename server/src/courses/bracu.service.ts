import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { HttpService } from '@nestjs/axios';
import * as https from 'https';
import type { ClientRequest, IncomingMessage } from 'http';
import { PrismaService } from '../prisma/prisma.service';
import { firstValueFrom } from 'rxjs';
import { CoursesGateway } from './courses.gateway';
import { MailService } from '../mail/mail.service';
import { TrackingService } from './tracking.service';

interface BracuSection {
  courseCode: string;
  courseName?: string;
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

interface ConnectMigrateResponse {
  metadata?: {
    currentSemester?: string;
    lastUpdated?: string;
    totalSections?: number;
    totalUniqueCourses?: number;
    totalLabs?: number;
  };
  courses: BracuSection[];
}

interface MercureSeatPayload {
  timestamp?: string;
  seatStatus?: Record<string, string | number>;
}

export interface RecentSeatDrop {
  sectionId: string;
  courseCode: string;
  sectionNumber: string;
  available: number;
  timestamp: string;
}

@Injectable()
export class BracuService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BracuService.name);
  private readonly CONNECT_SLMS_URL =
    'https://usis-cdn.eniamza.com/connect-migrate.json';
  private readonly MERCURE_URL =
    'https://mercure.eniamza.com/.well-known/mercure?topic=seatstatus';
  private previousSeatData = new Map<
    string,
    { enrolled: number; capacity: number; slotCount: number; scheduleHash: string }
  >();
  private courseCodeToIdCache = new Map<string, string>(); // Cache courseCode -> courseId
  private recentSeatDrops: RecentSeatDrop[] = [];
  private isSyncing = false; // Lock to prevent concurrent syncs
  private isFirstSync = true; // Optimization flag for startup
  private mercureRequest: ClientRequest | null = null;
  private mercureResponse: IncomingMessage | null = null;
  private startupTimer: ReturnType<typeof setTimeout> | null = null;
  private mercureTimer: ReturnType<typeof setTimeout> | null = null;
  private isShuttingDown = false;

  constructor(
    private readonly httpService: HttpService,
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => CoursesGateway))
    private readonly coursesGateway: CoursesGateway,
    private readonly mailService: MailService,
    private readonly trackingService: TrackingService,
  ) { }

  onModuleInit() {
    // Do not block NestJS port binding during startup; initialize sync & Mercure after boot
    this.logger.log('Scheduled initial course sync in 5 seconds...');
    this.startupTimer = setTimeout(() => {
      void this.initializeAndSync();
    }, 5000);
  }

  private async initializeAndSync() {
    if (this.isShuttingDown) return;
    try {
      const existingSections = await this.prisma.section.findMany({
        select: {
          id: true,
          enrolled: true,
          capacity: true,
          _count: { select: { slots: true } },
        },
      });
      existingSections.forEach((s) => {
        this.previousSeatData.set(s.id, {
          enrolled: s.enrolled,
          capacity: s.capacity,
          slotCount: s._count.slots,
          scheduleHash: '', // Force signature check on first sync
        });
      });
    } catch (err) {
      this.logger.error(
        `Failed to preload section cache: ${(err as Error).message}`,
      );
    }

    try {
      await this.syncCourses();
    } catch (err) {
      this.logger.error(
        `Initial syncCourses failed: ${(err as Error).message}`,
      );
    }

    if (!this.isShuttingDown) {
      this.mercureTimer = setTimeout(() => {
        void this.startMercureStream();
      }, 2000);
    }
  }

  onModuleDestroy() {
    this.isShuttingDown = true;
    if (this.startupTimer) clearTimeout(this.startupTimer);
    if (this.mercureTimer) clearTimeout(this.mercureTimer);
    this.mercureResponse?.destroy();
    this.mercureRequest?.destroy();
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
      const tracksToCheck = await this.prisma.tracking.findMany({
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

      this.logger.log(
        `Cron: Found ${tracksToCheck.length} active tracks to check.`,
      );

      const now = Date.now();
      let notifiedCount = 0;

      for (const track of tracksToCheck) {
        // Use user's custom interval (default: 5 minutes)
        const intervalMinutes = track.notifyIntervalMinutes || 5;
        const intervalMs = intervalMinutes * 60 * 1000;
        const intervalAgo = new Date(now - intervalMs);

        // Check if enough time has passed since last notification
        const shouldNotify =
          !track.lastNotifiedAt || new Date(track.lastNotifiedAt) < intervalAgo;

        if (!shouldNotify) {
          continue; // Skip - still in cooldown period
        }

        const available = Math.max(
          0,
          track.section.capacity - track.section.enrolled,
        );

        if (available > 0 && track.user.email) {
          this.logger.log(
            `Cron: Sending reminder to ${track.user.email} for ${track.section.course.code} (interval: ${intervalMinutes}min)`,
          );
          notifiedCount++;

          void this.mailService
            .sendSeatAvailableEmail(
              track.user.email,
              track.section.course.code,
              track.section.sectionNumber,
              available,
            )
            .then(() => {
              this.trackingService.updateLastNotified(track.id).catch((e) => {
                this.logger.error(
                  `Cron: Failed to update lastNotifiedAt for ${track.id}: ${e.message}`,
                );
              });
            })
            .catch((err) => {
              const msg = err instanceof Error ? err.message : String(err);
              this.logger.error(
                `Cron: Reminder failed for ${track.user.email}: ${msg}`,
              );
            });
        }
      }

      this.logger.log(`Cron: Sent ${notifiedCount} reminder notifications.`);
    } catch (error) {
      this.logger.error(
        `Cron: Error in processTrackedReminders: ${error.message}`,
      );
    }
  }

  // Generate a signature string to detect if schedule/rooms have changed
  private getScheduleSignature(s: BracuSection): string {
    return JSON.stringify({
      cls: s.sectionSchedule?.classSchedules,
      lab: s.labSchedules,
      pr: s.preRegSchedule,
      pl: s.preRegLabSchedule,
      r: s.roomNumber,
      rn: s.roomName,
      lr: s.labRoomName,
      ex: s.sectionSchedule?.finalExamDetail,
    });
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
      const response = await firstValueFrom(
        this.httpService.get<ConnectMigrateResponse | BracuSection[]>(
          this.CONNECT_SLMS_URL,
        ),
      );
      const rawData = response.data;
      const sections = Array.isArray(rawData) ? rawData : rawData?.courses;

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
            title: s.courseName || s.courseCode,
            dept: s.academicDegree,
          });
        }
      });

      this.logger.log(
        `Found ${uniqueCourses.size} unique courses. Upserting...`,
      );
      const courseCodeToIdMap = new Map<string, string>();

      for (const code of uniqueCourses) {
        const cachedId = this.courseCodeToIdCache.get(code);
        if (cachedId) {
          courseCodeToIdMap.set(code, cachedId);
          continue;
        }

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
          this.courseCodeToIdCache.set(code, course.id);
        } catch (e) {
          this.logger.error(`Failed to upsert course ${code}: ${e}`);
        }
      }

      this.logger.log('Courses upserted. Processing sections...');

      // 2. Identify changes and classify updates
      const sectionsToUpdate: BracuSection[] = [];
      const sectionsNeedingSlotReset = new Set<string>();

      for (const item of sections) {
        const sectionIdStr = item.sectionId.toString();
        const prev = this.previousSeatData.get(sectionIdStr);
        const currentHash = this.getScheduleSignature(item);

        let needsUpdate = false;
        let needsSlotReset = false;

        if (!prev) {
          // New section found
          needsUpdate = true;
          needsSlotReset = true;
        } else {
          // Check for seat changes
          if (
            prev.enrolled !== item.consumedSeat ||
            prev.capacity !== item.capacity
          ) {
            needsUpdate = true;
          }
          // Check for schedule/room changes
          if (prev.scheduleHash !== currentHash) {
            // Optimization: On first sync, if slots exist, assume they are correct to avoid massive DB churn
            if (this.isFirstSync && prev.slotCount > 0) {
              // Skip update
            } else {
              needsUpdate = true;
              needsSlotReset = true;
            }
          }
          // Force fix if we have a valid schedule but 0 slots recorded
          if (prev.slotCount === 0 && currentHash.length > 20) {
            needsUpdate = true;
            needsSlotReset = true;
          }
        }

        if (needsUpdate) {
          // Store hash temporarily on the item for use in the loop
          (item as any)._currentHash = currentHash;
          sectionsToUpdate.push(item);
          if (item.courseCode === 'CSE110' && item.sectionName === '01') {
            this.logger.log(`DEBUG: CSE110-01 Updates - Enrolled: ${item.consumedSeat}/${item.capacity} (Prev: ${prev?.enrolled})`);
          }
          if (needsSlotReset) {
            sectionsNeedingSlotReset.add(sectionIdStr);
          }
        }
      }

      // Bulk delete slots ONLY for sections that need slot reset (schedule changed)
      // This is a massive optimization: we don't delete slots if only seats changed.
      if (sectionsNeedingSlotReset.size > 0) {
        const sectionIdsToDelete = Array.from(sectionsNeedingSlotReset);
        // Process deletions in chunks to avoid "too many parameters" error if huge
        const DELETE_CHUNK_SIZE = 2000;
        for (let i = 0; i < sectionIdsToDelete.length; i += DELETE_CHUNK_SIZE) {
          const chunk = sectionIdsToDelete.slice(i, i + DELETE_CHUNK_SIZE);
          await this.prisma.roomSlot.deleteMany({
            where: { sectionId: { in: chunk } },
          });
        }
        this.logger.log(
          `Refreshed slots for ${sectionsNeedingSlotReset.size} sections (Schedule/Room changed)`,
        );
      }

      // 3. Upsert Sections
      const BATCH_SIZE = 10; // Reduced to 10 for better stability on low-resource environments
      for (let i = 0; i < sectionsToUpdate.length; i += BATCH_SIZE) {
        const batch = sectionsToUpdate.slice(i, i + BATCH_SIZE);
        await Promise.all(
          batch.map(async (item) => {
            const courseId = courseCodeToIdMap.get(item.courseCode);
            if (!courseId) return;

            try {
              const sectionIdStr = item.sectionId.toString();
              const needsSlotReset = sectionsNeedingSlotReset.has(sectionIdStr);

              // Upsert Section (Always update basic info + stats)
              await this.prisma.section.upsert({
                where: { id: sectionIdStr },
                update: {
                  sectionNumber: item.sectionName,
                  capacity: item.capacity,
                  enrolled: item.consumedSeat,
                  status:
                    item.consumedSeat >= item.capacity ? 'CLOSED' : 'OPEN',
                  facultyInitials: item.faculties,
                  examDate: item.sectionSchedule?.finalExamDetail,
                  labFacultyInitials: item.labFaculties,
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
                  facultyInitials: item.faculties,
                  examDate: item.sectionSchedule?.finalExamDetail,
                  labFacultyInitials: item.labFaculties,
                  prerequisites: item.prerequisiteCourses,
                },
              });

              let totalSlotsCreated = 0;

              // ONLY recreate slots if explicitly needed (Schedule changed)
              if (needsSlotReset) {
                // Parse and collect slot data

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
                  try {
                    const parts = timeStr.split(':');
                    if (parts.length < 2) return 0;
                    return parseInt(
                      `${parts[0].trim().padStart(2, '0')}${parts[1].trim().padStart(2, '0')}`,
                      10,
                    );
                  } catch (e) {
                    return 0; // Fallback
                  }
                };

                // Helper to parse "DAY(TIME-TIME-ROOM)" format
                const parseScheduleString = (
                  str: string,
                  type: 'CLASS' | 'LAB',
                ) => {
                  if (!str || str === 'TBA') return [];
                  const lines = str
                    .split(/[\r\n]+/)
                    .filter((line) => line.trim());
                  const results: any[] = [];

                  for (const line of lines) {
                    // Match "DAY (TIME - TIME - ROOM)"
                    // Handles standard dash (-), en-dash (–), and em-dash (—)
                    const match = line.match(/^([A-Z]+)\s*\(([^)]+)\)$/i);
                    if (match) {
                      const day = match[1].toUpperCase();
                      const content = match[2];

                      // Regex to find "Time - Time - Room"
                      // Supports 12h format (AM/PM) and various dash separators
                      const timeMatch = content.match(
                        /(\d{1,2}:\d{2}\s*[AP]M)\s*[-–—]\s*(\d{1,2}:\d{2}\s*[AP]M)\s*[-–—]\s*(.+)/i,
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
                  if (str && results.length === 0) {
                    this.logger.warn(`Failed to parse schedule: "${str}"`);
                  }
                  return results;
                };

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

                if (
                  !classSlotsProcessed &&
                  item.sectionSchedule?.classSchedules
                ) {
                  for (const slot of item.sectionSchedule.classSchedules) {
                    const roomStr =
                      slot.roomNo || item.roomNumber || item.roomName || 'TBA';
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

                if (
                  !labSlotsProcessed &&
                  (item.labSchedules || item.labRoomName)
                ) {
                  if (item.labSchedules && item.labSchedules.length > 0) {
                    for (const slot of item.labSchedules) {
                      const roomStr =
                        slot.roomNo || item.labRoomName || item.roomName || 'TBA';
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

                // Bulk create slots
                if (slotsToCreate.length > 0) {
                  const dedupMap = new Map<string, any>();
                  slotsToCreate.forEach((slot) => {
                    const key = `${slot.sectionId}-${slot.day}-${slot.startTime}-${slot.endTime}-${slot.roomNumber}-${slot.type}`;
                    if (!dedupMap.has(key)) {
                      dedupMap.set(key, slot);
                    }
                  });

                  const uniqueSlots = Array.from(dedupMap.values());
                  await this.prisma.roomSlot.createMany({
                    data: uniqueSlots,
                    skipDuplicates: true,
                  });
                  totalSlotsCreated = uniqueSlots.length;
                }
              }

              // Update processing metadata
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
        const currentHash =
          (item as any)._currentHash || this.getScheduleSignature(item);

        const slotCount = (item as any)._processed
          ? (item as any)._slotCount
          : prevData?.slotCount || 0;

        // Check if seat data changed OR schedule changed
        if (
          !prevData ||
          prevData.enrolled !== newEnrolled ||
          prevData.capacity !== newCapacity ||
          prevData.slotCount === 0 ||
          prevData.scheduleHash !== currentHash
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
            slotCount: slotCount,
            scheduleHash: currentHash,
          });

          // NEW: Notification Logic
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
      this.isFirstSync = false;
    }
  }

  private async updateCourseStats(sections: any[]) {
    try {
      const totalCourses = await this.prisma.course.count();
      const totalSections = sections.length;
      const totalAvailableSeats = sections.reduce(
        (acc, section) =>
          acc + Math.max(0, section.capacity - section.consumedSeat),
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

      this.logger.debug(
        `Stats updated: ${totalCourses} courses, ${totalSections} sections, ${totalAvailableSeats} available seats`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to update course stats: ${(error as Error).message}`,
      );
    }
  }

  getRecentSeatDrops(): RecentSeatDrop[] {
    return this.recentSeatDrops;
  }

  private recordSeatDrop(
    sectionId: string,
    courseCode: string,
    sectionNumber: string,
    available: number,
  ) {
    this.recentSeatDrops.unshift({
      sectionId,
      courseCode,
      sectionNumber,
      available,
      timestamp: new Date().toISOString(),
    });
    if (this.recentSeatDrops.length > 25) {
      this.recentSeatDrops.length = 25;
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

      for (const track of trackers) {
        // 5-minute cooldown check
        const fiveMinutesAgo = new Date(Date.now() - 4.5 * 60 * 1000); // 4.5 min to avoid strict edge cases
        const shouldNotify =
          !track.lastNotifiedAt || track.lastNotifiedAt < fiveMinutesAgo;

        if (track.user.email && shouldNotify) {
          this.logger.log(
            `Sync: Sending seat opening notification to ${track.user.email} for ${courseCode}`,
          );
          // Send email asynchronously
          void this.mailService
            .sendSeatAvailableEmail(
              track.user.email,
              courseCode,
              sectionNumber,
              available,
            )
            .then(() => {
              // Update last notified time
              this.trackingService
                .updateLastNotified(track.id)
                .catch(() => { });
            })
            .catch((err) => {
              const msg = err instanceof Error ? err.message : String(err);
              this.logger.error(
                `Sync: Notification failed for ${track.user.email}: ${msg}`,
              );
            });
        } else if (track.user.email) {
          this.logger.debug(
            `Sync: Cooldown active for ${track.user.email} (${courseCode}). Skipping.`,
          );
        }
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Error in handleSeatOpening for ${sectionId}: ${errorMessage}`,
      );
    }
  }

  /**
   * Subscribe to Eniamza's Mercure SSE stream using Node's native https stream
   * (lightweight memory footprint, avoids undici WebStream issues).
   */
  private async startMercureStream() {
    let backoffMs = 2000;

    while (!this.isShuttingDown) {
      try {
        this.logger.log(`Connecting to Mercure SSE stream: ${this.MERCURE_URL}`);
        await this.consumeMercureOnce(() => {
          backoffMs = 2000;
        });
      } catch (err) {
        if (this.isShuttingDown) break;
        this.logger.warn(
          `Mercure SSE stream disconnected (${(err as Error).message}), reconnecting in ${backoffMs}ms...`,
        );
      }

      if (this.isShuttingDown) break;
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
      backoffMs = Math.min(backoffMs * 2, 30000);
    }
  }

  private consumeMercureOnce(onConnected: () => void): Promise<void> {
    return new Promise((resolve, reject) => {
      const req = https.get(
        this.MERCURE_URL,
        { headers: { Accept: 'text/event-stream' } },
        (res) => {
          this.mercureResponse = res;
          if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
            res.resume();
            reject(new Error(`Mercure HTTP ${res.statusCode ?? 'unknown'}`));
            return;
          }

          onConnected();
          this.logger.log('Connected to Mercure SSE seatstatus stream');

          let buffer = '';
          let processingQueue = Promise.resolve();

          res.setEncoding('utf8');
          res.on('data', (chunk: string) => {
            if (this.isShuttingDown) return;
            buffer += chunk;
            const frames = buffer.split(/\r?\n\r?\n/);
            buffer = frames.pop() ?? '';

            for (const frame of frames) {
              const dataLines = frame
                .split(/\r?\n/)
                .filter((line) => line.startsWith('data:'))
                .map((line) => line.slice(5).trimStart());

              if (dataLines.length === 0) continue;

              const rawJson = dataLines.join('\n');
              processingQueue = processingQueue.then(async () => {
                try {
                  const payload = JSON.parse(rawJson) as MercureSeatPayload;
                  if (
                    payload?.seatStatus &&
                    Object.keys(payload.seatStatus).length > 0
                  ) {
                    await this.handleMercureSeatStatus(payload.seatStatus);
                  }
                } catch (parseErr) {
                  this.logger.warn(
                    `Failed to parse Mercure SSE payload: ${(parseErr as Error).message}`,
                  );
                }
              });
            }
          });

          res.on('end', () => {
            void processingQueue.finally(resolve);
          });

          res.on('error', (err) => {
            reject(err);
          });
        },
      );

      this.mercureRequest = req;
      req.on('error', (err) => {
        reject(err);
      });
    });
  }

  private async handleMercureSeatStatus(
    seatStatus: Record<string, string | number>,
  ) {
    const entries = Object.entries(seatStatus)
      .map(([sectionId, val]) => ({
        sectionId,
        newEnrolled: typeof val === 'number' ? val : parseInt(val, 10),
      }))
      .filter(({ newEnrolled }) => !Number.isNaN(newEnrolled));

    if (entries.length === 0) return;

    const changedIds = entries
      .filter(({ sectionId, newEnrolled }) => {
        const prev = this.previousSeatData.get(sectionId);
        return !prev || prev.enrolled !== newEnrolled;
      })
      .map((e) => e.sectionId);

    if (changedIds.length === 0) return;

    const dbSections = await this.prisma.section.findMany({
      where: { id: { in: changedIds } },
      include: { course: { select: { code: true } } },
    });

    const sectionMap = new Map(dbSections.map((s) => [s.id, s]));
    const seatUpdates: {
      sectionId: string;
      courseCode: string;
      sectionNumber: string;
      enrolled: number;
      capacity: number;
      available: number;
      status: string;
    }[] = [];
    const dbUpdates: Promise<unknown>[] = [];

    for (const { sectionId, newEnrolled } of entries) {
      const dbSec = sectionMap.get(sectionId);
      if (!dbSec || dbSec.enrolled === newEnrolled) continue;

      const newStatus = newEnrolled >= dbSec.capacity ? 'CLOSED' : 'OPEN';
      dbUpdates.push(
        this.prisma.section.update({
          where: { id: sectionId },
          data: {
            enrolled: newEnrolled,
            status: newStatus,
            lastUpdated: new Date(),
          },
        }),
      );

      const prev = this.previousSeatData.get(sectionId);
      this.previousSeatData.set(sectionId, {
        enrolled: newEnrolled,
        capacity: dbSec.capacity,
        slotCount: prev?.slotCount ?? 1,
        scheduleHash: prev?.scheduleHash ?? '',
      });

      const available = Math.max(0, dbSec.capacity - newEnrolled);
      seatUpdates.push({
        sectionId,
        courseCode: dbSec.course.code,
        sectionNumber: dbSec.sectionNumber,
        enrolled: newEnrolled,
        capacity: dbSec.capacity,
        available,
        status: newStatus,
      });

      if (available > 0) {
        if (newEnrolled < dbSec.enrolled) {
          this.recordSeatDrop(
            sectionId,
            dbSec.course.code,
            dbSec.sectionNumber,
            available,
          );
        }
        void this.handleSeatOpening(
          sectionId,
          dbSec.course.code,
          dbSec.sectionNumber,
          available,
        );
      }
    }

    if (seatUpdates.length > 0) {
      await Promise.all(dbUpdates);
      this.logger.log(
        `Mercure SSE: Updated & broadcasting ${seatUpdates.length} real-time seat changes`,
      );
      this.coursesGateway.broadcastSeatUpdate(seatUpdates);
    }
  }
}
