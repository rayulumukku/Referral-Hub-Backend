# 🔧 Fix 401 Unauthorized Error

## ❌ The Error
```
Failed to load resource: 401 (Unauthorized)
Error fetching user profile: AxiosError
```

## ✅ The Fix

### Option 1: Logout and Login Again (EASIEST)
1. Click "Logout" in the app
2. Go to `http://localhost:3000/login`
3. Login with:
   - Email: `premium@demo.com`
   - Password: `demo123`

Done! Token refreshed.

### Option 2: Clear Local Storage (if logout doesn't work)
1. Press **F12** to open DevTools
2. Go to **Application** tab
3. Click **Local Storage** → `http://localhost:3000`
4. Click "Clear All"
5. Refresh page
6. Login again

### Option 3: Quick Console Fix
Press F12, go to Console, paste:
```javascript
localStorage.clear();
window.location.href = '/login';
```

---

## Why This Happened

The JWT token in localStorage expired or is invalid. This happens when:
- Token expires after some time
- Backend was restarted with different JWT_SECRET
- localStorage was corrupted

---

## ✅ After Login

You'll see:
- ✅ Dashboard loads properly
- ✅ Your posts displayed
- ✅ Real activity feed
- ✅ All tracking working
- ✅ NO MORE 401 errors!

