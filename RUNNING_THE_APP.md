# 🚀 Running the Full-Stack App

## Module 2 Auth Frontend - Complete! ✅

You now have a fully functional authentication system with:
- Beautiful Login & Register pages
- Protected Dashboard
- JWT token management
- Real-time error handling

---

## 📝 How to Run the Application

### Step 1: Start the Backend (NestJS)

```bash
cd server
npm run start:dev
```

You should see:
```
🚀 Server running on http://localhost:3000
📚 Swagger docs available at http://localhost:3000/api
```

### Step 2: Start the Frontend (React + Vite)

Open a **NEW terminal** window:

```bash
cd client
npm run dev
```

You should see:
```
VITE v7.3.1  ready in 500 ms

➜  Local:   http://localhost:5173/
```

### Step 3: Test the App!

1. Open your browser to **http://localhost:5173**
2. You'll see the stunning landing page
3. Click **"Get Started Free"**
4. Create an account
5. You'll be redirected to the Dashboard!

---

## 🧪 Testing the Authentication

### Create Your First User:

1. Go to http://localhost:5173/register
2. Fill in:
   - **Name:** Your Name
   - **Email:** test@university.edu
   - **Password:** password123
3. Click "Create Account"
4. You should be automatically logged in!

### Test Login:

1. Click "Logout" in the dashboard
2. Go to http://localhost:5173/login
3. Enter the same credentials
4. Click "Sign In"

### Test Protected Routes:

1. Logout from the dashboard
2. Try to manually visit http://localhost:5173/dashboard
3. You should be redirected to /login!

---

## 🔍 Viewing API Documentation (Swagger)

Once the backend is running, visit:
**http://localhost:3000/api**

You can test all API endpoints directly from the browser!

---

## 🐛 Troubleshooting

### "Network Error" when logging in?
- Make sure the backend is running on port 3000
- Check that CORS is enabled (it should be!)

### Frontend won't start?
- Make sure you ran `npm install` in the client folder
- Check if port 5173 is available

### Database connection error?
- Check your `.env` file in the `server` folder
- Make sure your Supabase connection string is correct

---

## 🎨 What's Special About This Frontend?

1. **Glassmorphism UI** - Modern frosted glass effects
2. **Smooth Animations** - Framer Motion for buttery transitions
3. **Gradient Magic** - Beautiful color combinations
4. **Responsive Design** - Looks great on all devices
5. **Type Safety** - Full TypeScript integration

---

## 📚 Next Module Preview

Once you've tested this, we'll build **Module 3: Course Management**, which will add:
- Course search functionality
- Section tracking
- Watchlist feature
- Empty classroom finder

---

**Ready to run it?** Start both servers and let me know what you think!
