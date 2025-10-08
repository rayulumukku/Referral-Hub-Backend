const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 5001;

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true
}));

app.use(express.json());

// Health check
app.get('/api/auth/health', (req, res) => {
  res.json({
    success: true,
    message: 'Backend server is running!',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Mock user profile
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

// Mock posts
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

// Mock enhanced referral endpoints
app.get('/api/enhanced-referrals/user-chains/:userId', (req, res) => {
  res.json({
    success: true,
    chains: [],
    totalChains: 0,
    message: 'Enhanced referral tracking ready!'
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

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Simple server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/auth/health`);
  console.log(`✅ All endpoints ready!`);
});

module.exports = app;
