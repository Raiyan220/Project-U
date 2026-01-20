-- AlterTable
ALTER TABLE "RoomSlot" ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'CLASS';

-- AlterTable
ALTER TABLE "Section" ADD COLUMN     "examDate" TEXT,
ADD COLUMN     "facultyInitials" TEXT,
ADD COLUMN     "labExamDate" TEXT,
ADD COLUMN     "labFacultyInitials" TEXT,
ADD COLUMN     "prerequisites" TEXT;

-- AlterTable
ALTER TABLE "Tracking" ADD COLUMN     "lastNotifiedAt" TIMESTAMP(3),
ADD COLUMN     "notifyIntervalMinutes" INTEGER NOT NULL DEFAULT 5;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "profilePicture" TEXT,
ADD COLUMN     "resetOtp" TEXT,
ADD COLUMN     "resetOtpExpires" TIMESTAMP(3);
