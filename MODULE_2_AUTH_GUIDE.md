# Module 2: Role-Based Authentication - Learning Guide

## 🎯 What We Just Built

We implemented a complete **JWT-based authentication system** with role-based access control. This is production-grade security similar to what you'd find in enterprise applications.

## 📚 Key Concepts Explained

### 1. **Password Hashing** (bcrypt)
- **Why?** We NEVER store plain passwords. If someone hacks our database, they can't see passwords.
- **How it works:** `bcrypt.hash(password, 10)` creates a one-way encrypted version.
- **Verification:** `bcrypt.compare(inputPassword, hashedPassword)` checks if they match without decrypting.

### 2. **JWT (JSON Web Tokens)**
- **What is it?** A digitally signed "ticket" that proves the user is logged in.
- **Structure:** Contains 3 parts: `header.payload.signature`
  - **Payload:** `{ userId, email, role }` - This is what we embedded!
  - **Signature:** Proves the token wasn't tampered with using our `JWT_SECRET`.
- **Lifespan:** Our tokens last 7 days, then users must log in again.

### 3. **Role-Based Access Control (RBAC)**
- **The Database:** We added a `role` field to the User table (STUDENT or ADMIN).
- **The Guard:** `RolesGuard` checks if the user has the required role before allowing access.
- **Usage:** Just add `@Roles(Role.ADMIN)` above any protected route!

## 🔐 How to Use This System

### For Students (Frontend Will Call These):

#### **Register**
```http
POST http://localhost:3000/auth/register
Content-Type: application/json

{
  "email": "student@university.edu",
  "password": "myPassword123",
  "name": "John Doe"
}
```

**Response:**
```json
{
  "user": {
    "id": "uuid-here",
    "email": "student@university.edu",
    "name": "John Doe",
    "role": "STUDENT",
    "createdAt": "2026-01-19T..."
  },
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### **Login**
```http
POST http://localhost:3000/auth/login
Content-Type: application/json

{
  "email": "student@university.edu",
  "password": "myPassword123"
}
```

**Response:** Same as Register

### For Backend Developers (Protecting Routes):

#### **Protect Any Route** (Require Login)
```typescript
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Get('my-watchlist')
getMyWatchlist(@CurrentUser() user) {
  console.log(user.userId, user.email, user.role);
  // Only logged-in users can access this
}
```

#### **Admin-Only Routes**
```typescript
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { Roles } from './auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Post('trigger-scraper')
triggerScraper() {
  // Only ADMIN users can access this
}
```

## 🧪 Testing the Authentication

### Step 1: Start the Server
```bash
cd server
npm run start:dev
```

###Step 2: Test with a Tool (Postman, Insomnia, or Thunder Client)

1. **Register a user** using the endpoint above.
2. **Copy the** `access_token` from the response.
3. **Make a protected request:**
   - Add header: `Authorization: Bearer <paste-your-token-here>`

## 🏗️ Architecture Flow

1. User sends email + password to `/auth/login`
2. `AuthController` receives it and passes to `AuthService`
3. `AuthService` checks the database using `PrismaService`
4. If valid, generates a JWT with `JwtService.sign({ userId, email, role })`
5. Frontend stores this token (in localStorage or cookie)
6. For every protected request, frontend sends: `Authorization: Bearer <token>`
7. `JwtStrategy` validates the token and attaches `user` object to the request
8. `RolesGuard` checks if user.role matches the required role

## 🎓 What You Learned

- ✅ How to hash passwords securely
- ✅ How JWT tokens work and why they're stateless
- ✅ How to implement role-based permissions
- ✅ How to use NestJS Guards and Decorators
- ✅ How to integrate Prisma with authentication

## 🚀 Next Module Preview

In the next module, we'll create the **Courses & Sections API** where students can:
- Search for courses
- View section details (capacity, enrolled, room numbers)
- Add sections to their watchlist (Protected with JwtAuthGuard!)

---
**Question:** Want to see an admin dashboard route, or should we move on to the Courses module?
