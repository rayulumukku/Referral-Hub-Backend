const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ['http://localhost:3000'],
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Performance monitoring middleware
const performanceMonitor = (req, res, next) => {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const end = process.hrtime.bigint();
    const duration = Number(end - start) / 1_000_000; // Convert to milliseconds

    if (duration > 10000) { // Log very slow requests (>10 seconds)
      console.warn(`VERY SLOW REQUEST: ${req.method} ${req.originalUrl} - ${duration.toFixed(2)} ms`);
    } else if (duration > 2000) { // Log slow requests (>2 seconds)
      console.warn(`SLOW REQUEST: ${req.method} ${req.originalUrl} - ${duration.toFixed(2)} ms`);
    } else {
      console.log(`Request: ${req.method} ${req.originalUrl} - ${duration.toFixed(2)} ms`);
    }
  });

  next();
};

app.use('/api', performanceMonitor);

// Health check endpoint
app.get('/api/auth/health', (req, res) => {
  res.json({
    success: true,
    message: 'Backend server is running!',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Mock endpoints for testing
app.get('/api/users/profile', (req, res) => {
  res.json({
    success: true,
    user: {
      _id: 'mock-user-id',
      username: 'Demo User',
      email: 'demo@example.com',
      role: 'user'
    }
  });
});

app.get('/api/posts', (req, res) => {
  res.json({
    success: true,
    posts: [
      {
        _id: 'mock-post-1',
        title: 'Demo Post 1',
        category: 'Product',
        price: 99.99,
        creator: 'mock-user-id',
        createdAt: new Date().toISOString(),
        views: 150,
        shares: 25,
        conversions: 5
      }
    ]
  });
});

// Enhanced referral tracking endpoints (mock)
app.get('/api/enhanced-referrals/user-chains/:userId', (req, res) => {
  res.json({
    success: true,
    chains: [],
    totalChains: 0,
    message: 'Enhanced referral tracking is ready!'
  });
});

app.get('/api/enhanced-referrals/post-analytics/:postId', (req, res) => {
  res.json({
    success: true,
    analytics: {
      totalChains: 0,
      totalClicks: 0,
      totalShares: 0,
      totalViews: 0,
      totalConversions: 0,
      totalConversionValue: 0,
      platformDistribution: {},
      deviceDistribution: {},
      topPerformers: []
    }
  });
});

// Error handling
app.use('/*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.originalUrl
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Backend server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/auth/health`);
  console.log(`🔗 CORS enabled for: ${process.env.CORS_ORIGINS || 'http://localhost:3000'}`);
  console.log(`⚡ Enhanced referral tracking system ready!`);
});

module.exports = app;
