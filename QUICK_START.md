# 🚀 Quick Start - Fix Connection Error

## ❌ Error: ERR_CONNECTION_REFUSED

This error means the backend server is NOT running on port 5001.

---

## ✅ Solution - Start Backend Server

### Step 1: Check if MongoDB URI is set

Open PowerShell/CMD in the BACKEND folder and run:

```bash
cd BACKEND
```

Check if you have a `.env` file:
```bash
dir .env
```

If NO .env file exists, create it now:

```bash
# Create .env file with notepad
notepad .env
```

Add this content (replace with YOUR MongoDB details):
```env
PORT=5001
MONGODB_URI=mongodb+srv://your_username:your_password@cluster.mongodb.net/refhub?retryWrites=true&w=majority
JWT_SECRET=my_super_secret_key_12345
FRONTEND_URL=http://localhost:3000
NODE_ENV=development
```

**IMPORTANT:** Replace `your_username`, `your_password`, and `cluster` with your actual MongoDB Atlas credentials!

Save and close.

---

### Step 2: Install Dependencies (First Time Only)

```bash
npm install
```

Wait for installation to complete.

---

### Step 3: Start Backend Server

```bash
npm start
```

**You should see:**
```
Server running on port 5001
MongoDB connected
Demo users seeded successfully
All routes loaded
```

✅ **Backend is now running!**

---

### Step 4: Test Backend is Working

Open browser and go to:
```
http://localhost:5001/api/posts
```

You should see JSON response (not an error page).

---

### Step 5: Start Frontend (New Terminal)

Open a NEW terminal/PowerShell window:

```bash
cd FRONTEND
npm install
npm start
```

Frontend will open at `http://localhost:3000`

---

## 🧪 Quick Test

1. Go to `http://localhost:3000/login`
2. Login with demo user:
   - Email: `premium@demo.com`
   - Password: `demo123`
3. Create a post
4. Share it
5. Check the tracking data!

---

## ❌ Common Issues

### Issue 1: Port 5001 Already in Use

**Error:** `Error: listen EADDRINUSE: address already in use :::5001`

**Fix:**
```bash
# Windows PowerShell
Get-Process -Id (Get-NetTCPConnection -LocalPort 5001).OwningProcess | Stop-Process -Force
```

Then start again: `npm start`

---

### Issue 2: MongoDB Connection Failed

**Error:** `MongooseServerSelectionError: connect ETIMEDOUT`

**Fix:**
1. Go to MongoDB Atlas website
2. Click "Network Access"
3. Click "Add IP Address"
4. Click "Allow Access from Anywhere" (0.0.0.0/0)
5. Save and try again

---

### Issue 3: Cannot find module

**Error:** `Cannot find module 'express'`

**Fix:**
```bash
npm install
```

---

## ✅ All Working Checklist

- [ ] Backend running (see "Server running on port 5001")
- [ ] MongoDB connected (see "MongoDB connected")
- [ ] http://localhost:5001/api/posts shows JSON
- [ ] Frontend running on http://localhost:3000
- [ ] Can login with premium@demo.com / demo123
- [ ] No ERR_CONNECTION_REFUSED errors

---

## 📞 Still Having Issues?

Run this diagnostic script:

```bash
cd BACKEND
node -e "console.log('Node version:', process.version); console.log('Port:', process.env.PORT || 5001);"
```

Check MongoDB connection:
```bash
node -e "require('dotenv').config(); console.log('MongoDB URI exists:', !!process.env.MONGODB_URI);"
```

