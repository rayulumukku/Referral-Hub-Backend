const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: ["http://localhost:3000", "https://referral-hub-frontend.vercel.app", "https://referral-hub-frontend.vercel.app/"],
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors({
  origin: ["http://localhost:3000", "https://referral-hub-frontend.vercel.app", "https://referral-hub-frontend.vercel.app/"],
  credentials: true
}));
app.set('trust proxy', 1);
app.use(express.json());

// Serve static files for uploads
app.use('/uploads', express.static('uploads'));

// Database connection with retry/backoff
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('MONGODB_URI is not set. Please configure the environment variable.');
}

let connectAttempts = 0;
async function connectWithRetry() {
  if (!MONGODB_URI) return; // Will cause readyState!=1 and routes can respond 503
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('MongoDB connected');
  } catch (err) {
    connectAttempts += 1;
    const delayMs = Math.min(30000, 1000 * Math.pow(2, Math.min(connectAttempts, 5)));
    console.error(`MongoDB connection failed (attempt ${connectAttempts}):`, err.message);
    console.log(`Retrying MongoDB connection in ${Math.round(delayMs/1000)}s...`);
    setTimeout(connectWithRetry, delayMs);
  }
}
connectWithRetry();

// Socket IO
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Join user room for personalized updates
  socket.on('join_user_room', (userId) => {
    if (userId) {
      socket.join(`user_${userId}`);
      console.log(`User ${userId} joined room user_${userId}`);
    }
  });

  // Join post room for post-specific updates
  socket.on('join_post_room', (postId) => {
    if (postId) {
      socket.join(`post_${postId}`);
      console.log(`User joined room post_${postId}`);
    }
  });

  // Join analytics room for global analytics
  socket.on('join_analytics_room', () => {
    socket.join('analytics');
    console.log('User joined analytics room');
  });

  // Join notifications room
  socket.on('join_notifications_room', (userId) => {
    if (userId) {
      socket.join(`notifications_${userId}`);
      console.log(`User ${userId} joined notifications room`);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const authRouter = require('./routes/auth');
authRouter.setIoInstance(io); // Pass io instance to auth router
app.use('/api/auth', authRouter);
const postsRouter = require('./routes/posts');
postsRouter.setIoInstance(io); // Pass io instance to posts router
app.use('/api/posts', postsRouter);
const referralsRouter = require('./routes/referrals');
referralsRouter.setIoInstance(io); // Pass io instance to referrals router
app.use('/api/referrals', referralsRouter);
const analyticsRouter = require('./routes/analytics');
analyticsRouter.setIoInstance && analyticsRouter.setIoInstance(io); // Pass io instance to analytics router if method exists
app.use('/api/analytics', analyticsRouter);
app.use('/api/admin', require('./routes/admin'));
app.use('/api/users', require('./routes/users'));
const notificationsRouter = require('./routes/notifications');
notificationsRouter.setIoInstance(io); // Pass io instance to notifications router
app.use('/api/notifications', notificationsRouter);
app.use('/api/post-analytics', require('./routes/postAnalytics'));
app.use('/api/engagement', require('./routes/engagement'));
app.use('/api/link-previews', require('./routes/linkPreviews'));
app.use('/api/tracking', require('./routes/tracking'));
app.use('/api/gamification', require('./routes/gamification'));
console.log('All routes loaded');

// Schedule engagement notifications every 1.5 hours (90 minutes)
const NotificationService = require('./services/notificationService');
setInterval(() => {
  console.log('Running scheduled engagement notifications...');
  NotificationService.sendEngagementNotifications();
}, 90 * 60 * 1000); // 90 minutes in milliseconds

// Run initial engagement notification check after 5 minutes
setTimeout(() => {
  console.log('Running initial engagement notifications...');
  NotificationService.sendEngagementNotifications();
}, 5 * 60 * 1000); // 5 minutes

const PORT = process.env.PORT || 5001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Export io instance for use in other modules
module.exports = { getIo: () => io };
