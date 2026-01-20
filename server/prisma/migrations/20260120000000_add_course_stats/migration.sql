-- CreateTable
CREATE TABLE "CourseStats" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "totalCourses" INTEGER NOT NULL DEFAULT 0,
    "totalSections" INTEGER NOT NULL DEFAULT 0,
    "totalAvailableSeats" INTEGER NOT NULL DEFAULT 0,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseStats_pkey" PRIMARY KEY ("id")
);
