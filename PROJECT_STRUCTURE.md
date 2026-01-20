# UniFlow Project Structure

## 📁 Backend (NestJS)

```
server/
├── prisma/
│   ├── schema.prisma          # Database schema with User, Course, Section, etc.
│   └── migrations/            # Database version history
│
├── src/
│   ├── auth/                  # ✅ COMPLETED - Authentication Module
│   │   ├── decorators/
│   │   │   ├── current-user.decorator.ts    # Get logged-in user info
│   │   │   └── roles.decorator.ts           # Specify required roles
│   │   ├── dto/
│   │   │   └── auth.dto.ts                  # Login/Register validation
│   │   ├── guards/
│   │   │   ├── jwt-auth.guard.ts            # Require login
│   │   │   └── roles.guard.ts               # Require specific role
│   │   ├── strategies/
│   │   │   └── jwt.strategy.ts              # JWT validation logic
│   │   ├── auth.controller.ts               # /auth/login, /auth/register
│   │   ├── auth.service.ts                  # Password hashing, token generation
│   │   └── auth.module.ts
│   │
│   ├── prisma/                # ✅ COMPLETED - Database Service
│   │   ├── prisma.service.ts
│   │   └── prisma.module.ts
│   │
│   ├── courses/               # 🚧 TODO - Course Management
│   ├── sections/              # 🚧 TODO - Section Tracking
│   ├── notifications/         # 🚧 TODO - Email Notifications
│   │
│   ├── app.module.ts
│   └── main.ts
│
└── .env                       # DATABASE_URL, JWT_SECRET

```

## 📁 Frontend (React + Vite)

```
client/
├── src/
│   ├── components/            # Reusable UI components
│   ├── pages/                 # Page-level components
│   │   ├── LandingPage.tsx
│   │   ├── Dashboard.tsx
│   │   ├── Login.tsx
│   │   └── Register.tsx
│   ├── services/              # API calls
│   ├── hooks/                 # Custom React hooks
│   ├── types/                 # TypeScript interfaces
│   ├── lib/                   # Utilities
│   ├── App.tsx
│   └── main.tsx
│
├── tailwind.config.js
└── vite.config.ts
```

## 🔄 Current Progress

### ✅ Phase 1: Foundation (DONE)
- [x] NestJS + Vite setup
- [x] Prisma schema design
- [x] Supabase connection
- [x] Database migrations

### ✅ Phase 2: Authentication (DONE)
- [x] Role-based access (STUDENT, ADMIN)
- [x] JWT token generation
- [x] Password hashing
- [x] Guards and Decorators

### 🚧 Phase 3: Core Features (NEXT)
- [ ] Course & Section CRUD
- [ ] Room availability tracking
- [ ] Search functionality
- [ ] Student watchlist

### 🚧 Phase 4: Real-Time Updates
- [ ] Cron job for university scraper
- [ ] Email notifications
- [ ] WebSocket for live seat updates

### 🚧 Phase 5: Frontend
- [ ] Beautiful landing page
- [ ] Login/Register forms
- [ ] Student dashboard
- [ ] Admin panel

## 🎯 Next Steps

Ready to move to **Module 3: Course & Section Management** where we'll:
1. Create endpoints to add/view courses
2. Track section capacities
3. Build the "empty room" finder
4. Allow students to add sections to their watchlist

---
**Your mission (if you choose to accept it):** Review MODULE_2_AUTH_GUIDE.md to understand how authentication works, then we'll build the fun stuff—course tracking!
