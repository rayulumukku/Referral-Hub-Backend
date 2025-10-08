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
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Get allowed origins from environment variable or use defaults
    const envOrigins = process.env.CORS_ORIGINS;
    const allowedOrigins = envOrigins ? 
      envOrigins.split(',').map(origin => origin.trim()) : 
      [
        "http://localhost:3000",
        "http://localhost:3001", 
        "https://referral-hub-frontend.vercel.app",
        "https://referral-hub-frontend.vercel.app/",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        "https://*.vercel.app",
        "https://*.netlify.app"
      ];
    
    // Check if origin matches any allowed pattern
    const isAllowed = allowedOrigins.some(allowedOrigin => {
      if (allowedOrigin.includes('*')) {
        const pattern = allowedOrigin.replace('*', '.*');
        const regex = new RegExp(`^${pattern}$`);
        return regex.test(origin);
      }
      return allowedOrigin === origin;
    });
    
    if (isAllowed) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      console.log('Allowed origins:', allowedOrigins);
      // For now, allow all origins to fix the 400 error
      callback(null, true);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Handle preflight requests (Express 5 compatible)
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    cors()(req, res, next);
  } else {
    next();
  }
});

// Additional CORS middleware for all requests
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Referer');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

app.set('trust proxy', 1);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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

    // Seed demo users if they don't exist
    await seedDemoUsersIfNeeded();
  } catch (err) {
    connectAttempts += 1;
    const delayMs = Math.min(30000, 1000 * Math.pow(2, Math.min(connectAttempts, 5)));
    console.error(`MongoDB connection failed (attempt ${connectAttempts}):`, err.message);
    console.log(`Retrying MongoDB connection in ${Math.round(delayMs/1000)}s...`);
    setTimeout(connectWithRetry, delayMs);
  }
}
connectWithRetry();

async function seedDemoUsersIfNeeded() {
  try {
    const User = require('./models/User');
    const bcrypt = require('bcryptjs');

    // Always recreate demo users to ensure they have correct passwords
    await User.deleteMany({ email: { $in: ['premium@demo.com', 'superpremium@demo.com'] } });
    console.log('Deleted existing demo users (if any)');

    console.log('Seeding demo users...');

    // Create premium user
    const salt1 = await bcrypt.genSalt(10);
    const hashedPassword1 = await bcrypt.hash('demo123', salt1);

    const premiumUser = new User({
      email: 'premium@demo.com',
      username: 'premium_user',
      password: hashedPassword1,
      type: 'enterprise',
      status: 'premium',
      isVerified: true,
      profile: { name: 'Premium Demo User', company: 'Tech Innovators Inc.' },
      credits: 2500,
      gamification: { totalPoints: 2500, level: 15, experience: 12500 },
      location: { city: 'Mumbai', state: 'Maharashtra', country: 'India', timezone: 'Asia/Kolkata' },
      coordinates: { lat: 19.0760, lng: 72.8777 },
      deviceInfo: { browser: 'Chrome', os: 'Windows', device: 'desktop', userAgent: 'Mozilla/5.0' },
      network: { directReferrals: [], level: 1 }
    });

    await premiumUser.save();
    console.log('Premium demo user created');

    // Create super premium user
    const salt2 = await bcrypt.genSalt(10);
    const hashedPassword2 = await bcrypt.hash('demo123', salt2);

    const superPremiumUser = new User({
      email: 'superpremium@demo.com',
      username: 'super_premium',
      password: hashedPassword2,
      type: 'enterprise',
      status: 'super-premium',
      isVerified: true,
      profile: { name: 'Super Premium Demo', company: 'Global Solutions Ltd.' },
      credits: 5000,
      gamification: { totalPoints: 5000, level: 25, experience: 25000 },
      location: { city: 'Mumbai', state: 'Maharashtra', country: 'India', timezone: 'Asia/Kolkata' },
      coordinates: { lat: 19.0760, lng: 72.8777 },
      deviceInfo: { browser: 'Chrome', os: 'Windows', device: 'desktop', userAgent: 'Mozilla/5.0' },
      network: { directReferrals: [], level: 1 }
    });

    await superPremiumUser.save();
    console.log('Super premium demo user created');

    console.log('Demo users seeded successfully');
  } catch (error) {
    console.error('Error seeding demo users:', error);
  }
}

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

// ✅ Pass io instance to ActivityService for real-time updates
const ActivityService = require('./services/activityService');
ActivityService.setIoInstance(io);

// ✅ Pass io instance to ComprehensiveReferralChainService for real-time updates
const ComprehensiveReferralChainService = require('./services/comprehensiveReferralChainService');
ComprehensiveReferralChainService.setIoInstance(io);

const authRouter = require('./routes/auth');
authRouter.setIoInstance(io); // Pass io instance to auth router
app.use('/api/auth', authRouter);
app.use('/auth', authRouter); // Also support /auth routes for compatibility
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

// Performance monitoring middleware
const performanceMonitor = require('./middleware/performanceMonitor');
app.use('/api', performanceMonitor);

// Real-time tracking middleware
const realTimeTracker = require('./middleware/realTimeTracker');
app.use('/api', realTimeTracker);

app.use('/api', require('./routes/missingEndpoints'));
app.use('/api/referral-tracking', require('./routes/referralTracking'));
app.use('/api/analytics', require('./routes/expertAnalytics'));
app.use('/api/complete', require('./routes/completeAnalytics'));
app.use('/api/universal', require('./routes/universalData'));
app.use('/api/ceo', require('./routes/ceoLevelData')); // CEO-LEVEL DATA
app.use('/api/tree-commission', require('./routes/treeCommission')); // TREE COMMISSION SYSTEM
app.use('/api/real-time-analytics', require('./routes/realTimeAnalytics')); // REAL-TIME ANALYTICS
app.use('/api/enhanced-referrals', require('./routes/enhancedReferralTracking')); // ENHANCED REFERRAL TRACKING

// COMPREHENSIVE REFERRAL CHAIN SYSTEM
const comprehensiveReferralsRouter = require('./routes/comprehensiveReferrals');
comprehensiveReferralsRouter.setIoInstance(io);
app.use('/api/comprehensive-referrals', comprehensiveReferralsRouter);

// CLEAR DATABASE & REAL STATS (Admin only)
app.use('/api/admin/database', require('./routes/clearDatabase'));

// REAL DASHBOARD STATS (for all users)
app.use('/api/dashboard', require('./routes/realDashboardStats'));

// COMMISSIONS ENDPOINT
app.use('/api/commissions', require('./routes/commissions'));

// ACTIVITIES ENDPOINT
app.use('/api/activities', require('./routes/activities'));
app.use('/api/post-analytics-detail', require('./routes/postAnalyticsDetail'));

// TEMPORARY FIX: Add missing routes directly to server.js
// Dashboard user stats endpoint
app.get('/api/dashboard/user-stats', async (req, res) => {
  try {
    const auth = require('./middleware/auth');
    await new Promise((resolve, reject) => {
      auth(req, res, (err) => err ? reject(err) : resolve());
    });

    const User = require('./models/User');
    const Post = require('./models/Post');
    const ReferralChain = require('./models/ReferralChain');
    const Referral = require('./models/Referral');
    const Commission = require('./models/Commission');

    const userId = req.user.id;

    // Get user's posts
    const userPosts = await Post.find({ creator: userId });
    const postIds = userPosts.map(p => p._id);

    // Calculate stats
    const stats = {
      totalPosts: userPosts.length,
      totalViews: userPosts.reduce((sum, post) => sum + (post.analytics?.views || 0), 0),
      totalShares: userPosts.reduce((sum, post) => sum + (post.analytics?.shares || 0), 0),
      totalConversions: userPosts.reduce((sum, post) => sum + (post.conversions || 0), 0),
      chainsAsOriginalSharer: await ReferralChain.countDocuments({ originalSharer: userId }),
      chainsAsParticipant: await ReferralChain.countDocuments({ 'chain.userId': userId }),
      totalPeopleReferred: await ReferralChain.aggregate([
        { $match: { originalSharer: userId } },
        { $project: { chainLength: { $size: '$chain' } } },
        { $group: { _id: null, total: { $sum: '$chainLength' } } }
      ]),
      totalReferrals: await Referral.countDocuments({ referrer: userId }),
      totalCommissionEarnings: await Commission.aggregate([
        { $match: { recipient: userId } },
        { $group: { _id: null, totalEarned: { $sum: '$amount' } } }
      ]).then(result => result[0]?.totalEarned || 0),
      totalCommissions: await Commission.countDocuments({ recipient: userId }),
      recentPosts: await Post.find({ creator: userId })
        .sort({ createdAt: -1 })
        .limit(10)
        .select('title createdAt analytics conversions status photos category price originalPrice'),
      platformStats: {
        totalUsers: await User.countDocuments(),
        totalPosts: await Post.countDocuments(),
        totalChains: await ReferralChain.countDocuments()
      }
    };

    stats.totalPeopleReferred = stats.totalPeopleReferred[0]?.total || 0;
    stats.conversionRate = stats.totalViews > 0
      ? ((stats.totalConversions / stats.totalViews) * 100).toFixed(2)
      : '0.00';

    res.json({
      success: true,
      stats,
      message: 'Dashboard stats from server.js',
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// Activities user endpoint
app.get('/api/activities/user/:userId', async (req, res) => {
  try {
    const auth = require('./middleware/auth');
    await new Promise((resolve, reject) => {
      auth(req, res, (err) => err ? reject(err) : resolve());
    });

    const { userId } = req.params;
    const limit = parseInt(req.query.limit) || 50;

    const Activity = require('./models/Activity');
    const activities = await Activity.find({ user: userId })
      .populate('user', 'username email profile')
      .populate('targetUser', 'username email')
      .populate('post', 'title category')
      .sort({ createdAt: -1 })
      .limit(limit);

    const formatted = activities.map(activity => ({
      _id: activity._id,
      type: activity.type,
      message: activity.message,
      user: {
        id: activity.user?._id,
        username: activity.user?.username,
        name: activity.user?.profile?.name
      },
      targetUser: activity.targetUser ? {
        id: activity.targetUser._id,
        username: activity.targetUser.username
      } : null,
      post: activity.post ? {
        id: activity.post._id,
        title: activity.post.title,
        category: activity.post.category
      } : null,
      metadata: activity.metadata || {},
      details: activity.details || {},
      timestamp: activity.createdAt,
      timeAgo: getTimeAgo(activity.createdAt)
    }));

    res.json({
      success: true,
      activities: formatted,
      count: formatted.length
    });
  } catch (error) {
    console.error('Activities error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching activities',
      error: error.message,
      activities: []
    });
  }
});

// Helper function for time ago
function getTimeAgo(date) {
  const now = new Date();
  const diff = now - new Date(date);
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString();
}

// REMOVE DUPLICATE - Only one dashboard route
// app.use('/api/dashboard', require('./routes/realDashboardStats'));

console.log('All routes loaded');

// Enhanced error handling middleware
const errorHandler = require('./middleware/errorHandler');
app.use(errorHandler);

// Handle 404 errors
app.use((req, res) => {
  res.status(404).json({
    message: 'Route not found',
    error: `Cannot ${req.method} ${req.originalUrl}`
  });
});

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
