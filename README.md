# UniFlow (`Project-U`) — Academic Course Tracking & Routine Platform

**UniFlow** is a full-stack university academic workflow platform built with **React**, **TypeScript**, **NestJS**, **Prisma**, and **PostgreSQL**. It helps students discover course sections, track seat availability in real time, locate empty classrooms, build conflict-free class routines, and calculate CGPA — backed by role-based admin moderation and feedback management.

---

## Features

### Student Workflows
- **Course & Section Explorer (`/courses`, `/courses/:id`):** Browse courses and sections with live capacity/enrollment counts, faculty initials, lab details, exam dates, and prerequisites.
- **Real-Time Seat Tracking & Alerts:** Subscribe to full or high-demand sections (`Tracking`) with customizable notification intervals (`notifyIntervalMinutes`), WebSocket updates (`Socket.IO`), and automated email alerts (`EmailLog`).
- **Routine Maker (`/routine-maker`):** Build and preview weekly class/lab schedules from `RoomSlot` timings and export routines (`html2canvas`).
- **Open Rooms Finder (`/open-rooms`):** Query available classrooms and labs by day, time slot, and building.
- **CGPA Calculator (`/cgpa-calculator`):** Interactive GPA/CGPA planning and calculation.
- **Authentication & Profile (`/login`, `/register`, `/forgot-password`, `/profile`):** Email/password JWT auth, Google OAuth2 sign-in, OTP-based password reset, and user profile management.

### Admin & Operations
- **Admin Dashboard (`/admin`):** System overview and operational controls.
- **User Management (`/admin/users`):** Manage user accounts and active/banned status (`Role`: `STUDENT` / `ADMIN`).
- **User Feedback Inbox (`/admin/feedback`):** Collect and review in-app user feedback (`FeedbackButton` → `Feedback` model).

---

## Tech Stack

- **Frontend (`client/`):** React 19, TypeScript, Vite 7, Tailwind CSS, React Router v7, TanStack React Query, Axios, Framer Motion, Socket.IO Client, Zod
- **Backend (`server/`):** NestJS 11, TypeScript, Prisma ORM, PostgreSQL, Passport (JWT + Google OAuth2), Socket.IO, `@nestjs/schedule`, Swagger (`/api`), Nodemailer

---

## Project Structure

```text
├── client/                  # React + Vite + TypeScript frontend
│   └── src/
│       ├── pages/           # Landing, Dashboard, Courses, RoutineMaker, OpenRooms, CGPA, Admin
│       ├── components/      # ProtectedRoute, ErrorBoundary, FeedbackButton, UI components
│       ├── contexts/        # AuthContext
│       └── services/        # API & WebSocket clients
├── server/                  # NestJS + Prisma backend
│   ├── prisma/              # schema.prisma & database migrations
│   └── src/
│       ├── auth/            # JWT & Google OAuth2, OTP password reset, guards & decorators
│       ├── courses/         # Course catalog & stats
│       ├── sections/        # Section tracking & seat updates
│       ├── rooms/           # Open room slot queries
│       ├── notifications/   # Scheduled checks & WebSocket/email alerts
│       ├── admin/           # Admin endpoints
│       ├── feedback/        # Feedback submission & review
│       └── mail/            # SMTP mail service
├── PROJECT_STRUCTURE.md
├── RUNNING_THE_APP.md
└── DEPLOYMENT_GUIDE.md
```

---

## Running Locally

### 1. Backend (`server/`)
```bash
cd server
npm install
npx prisma generate
npx prisma migrate deploy
npm run start:dev
```
Backend runs on `http://localhost:3000` (Swagger docs at `http://localhost:3000/api`).

### 2. Frontend (`client/`)
```bash
cd client
npm install
npm run dev
```
Frontend runs on `http://localhost:5173`. See [RUNNING_THE_APP.md](RUNNING_THE_APP.md) and [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) for environment variables and deployment steps.
