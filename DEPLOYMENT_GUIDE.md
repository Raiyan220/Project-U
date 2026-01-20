# 🚀 UniFlow Deployment Guide - Vercel + Render

Complete guide to deploy your UniFlow application to production.

---

## **📋 Prerequisites**

Before starting, ensure you have:
- ✅ GitHub account
- ✅ Vercel account (free) - https://vercel.com
- ✅ Render account (free) - https://render.com
- ✅ Your code committed to GitHub
- ✅ Supabase database ready

---

## **Part 1: Prepare for Deployment** ⏱️ 10 minutes

### **1.1 Backend Environment Variables (Render)**

You'll need these ready:

```
DATABASE_URL=postgresql://postgres.[project]:[password]@[host]:5432/postgres
DIRECT_URL=postgresql://postgres.[project]:[password]@[host]:5432/postgres
JWT_SECRET=make-this-very-long-and-random-string
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=your-smtp-email
SMTP_PASS=your-smtp-password
SMTP_FROM=noreply@uniflow.com
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-secret
GOOGLE_CALLBACK_URL=https://your-app.onrender.com/auth/google/callback
CLIENT_URL=https://your-app.vercel.app
PORT=3000
NODE_ENV=production
```

### **1.2 Frontend Environment Variable (Vercel)**

```
VITE_API_URL=https://your-backend.onrender.com
```

---

## **Part 2: Deploy Backend to Render** ⏱️ 15 min

### **Step 1: Push to GitHub**
```bash
cd "d:\Project U"
git add .
git commit -m "Ready for deployment"
git push origin main
```

### **Step 2: Create Render Service**

1. Go to https://dashboard.render.com
2. Click **New +** → **Web Service**
3. Connect your GitHub repo
4. Select your repository

### **Step 3: Configure**

**Service Name**: `uniflow-backend`  
**Region**: **Singapore** (closest to Bangladesh)  
**Branch**: `main`  
**Root Directory**: `server`  
**Runtime**: **Node**

**Build Command**:
```bash
npm install && npx prisma generate && npx prisma migrate deploy && npm run build
```

**Start Command**:
```bash
npm run start:prod
```

**Instance Type**: **Free**

### **Step 4: Add Environment Variables**

Click **Advanced** → Add each variable from **Part 1.1**

⚠️ **Important**: Temporarily set `CLIENT_URL=http://localhost:5173` (we'll update after Vercel deploy)

### **Step 5: Deploy!**

Click **Create Web Service**  
Wait 5-10 minutes for build

Your backend will be at: `https://uniflow-backend.onrender.com`

---

## **Part 3: Deploy Frontend to Vercel** ⏱️ 10 min

### **Step 1: Go to Vercel**

1. Visit https://vercel.com/new
2. Import your GitHub repository

### **Step 2: Configure**

**Framework Preset**: **Vite**  
**Root Directory**: `client`  
**Build Command**: `npm run build`  
**Output Directory**: `dist`

### **Step 3: Environment Variables**

Add:
```
VITE_API_URL = https://uniflow-backend.onrender.com
```
(Replace with your actual Render URL)

### **Step 4: Deploy!**

Click **Deploy**  
Wait 2-3 minutes

Your frontend will be at: `https://your-app.vercel.app`

---

## **Part 4: Update Backend CORS** ⏱️ 2 min

### Go back to Render

1. Your service → **Environment**
2. Update `CLIENT_URL` to your Vercel URL:
   ```
   CLIENT_URL=https://your-app.vercel.app
   ```
3. Save (auto-redeploys)

### Update Google OAuth (if using)

1. Google Cloud Console → Credentials
2. Edit OAuth Client
3. **Authorized JavaScript origins**: Add `https://your-app.vercel.app`
4. **Authorized redirect URIs**: Add `https://uniflow-backend.onrender.com/auth/google/callback`

---

## **Part 5: Test Everything** ✅

Visit your Vercel URL: `https://your-app.vercel.app`

**Test:**
- [ ] Website loads
- [ ] Can register
- [ ] Can login
- [ ] Dashboard shows stats
- [ ] Course data loads
- [ ] Can track sections
- [ ] Email notifications work

---

## **🎉 You're Live!**

**Frontend**: `https://your-app.vercel.app`  
**Backend**: `https://uniflow-backend.onrender.com`  
**Cost**: $0/month (Free tier)

---

## **Common Issues & Fixes**

### Backend won't start
- Check Render logs
- Verify all environment variables are set
- Run migration: `npx prisma migrate deploy`

### Frontend can't connect
- Check `VITE_API_URL` in Vercel
- Must match your Render URL
- No trailing slash

### CORS errors
- Update `CLIENT_URL` in Render
- Must match your Vercel URL exactly

### Database errors
- Check `DATABASE_URL` is correct
- Run `npx prisma migrate deploy` in Render Shell

---

## **Optional: Custom Domain**

**Vercel**: Settings → Domains → Add your domain  
**Render**: Settings → Custom Domain → Add your domain

---

## **Tip: Keep Backend Awake**

Render free tier sleeps after 15 min inactivity.

**Solution**: Use cron-job.org to ping every 10 minutes:
```
https://uniflow-backend.onrender.com/health
```

---

**Next Steps:**
1. Share with classmates! 🎓
2. Add to your resume/portfolio 📝
3. Monitor with Render dashboard 📊
4. Updates auto-deploy via git push! 🚀
