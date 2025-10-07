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
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Handle preflight requests
app.options('*', cors());

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

// Global error handling middleware
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);
  
  // Handle CORS errors
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({
      message: 'CORS policy violation',
      error: 'Origin not allowed'
    });
  }
  
  // Handle validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      message: 'Validation error',
      errors: Object.keys(err.errors).reduce((acc, key) => {
        acc[key] = err.errors[key].message;
        return acc;
      }, {})
    });
  }
  
  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      message: 'Invalid token',
      error: 'Authentication failed'
    });
  }
  
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      message: 'Token expired',
      error: 'Please login again'
    });
  }
  
  // Default error response
  res.status(err.status || 500).json({
    message: err.message || 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.stack : 'Something went wrong'
  });
});

// Handle 404 errors
app.use('*', (req, res) => {
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
