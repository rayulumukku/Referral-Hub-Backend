const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const CEOLevelDataService = require('../services/ceoLevelDataService');

// Get complete dashboard data for CEO/PM testing
router.get('/complete-dashboard', auth, async (req, res) => {
  try {
    const data = await CEOLevelDataService.getCompleteDashboardData(req.user.id);
    res.json(data);
  } catch (error) {
    console.error('Error getting complete dashboard data:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get comprehensive analytics
router.get('/analytics/comprehensive', auth, async (req, res) => {
  try {
    const userPosts = await require('../models/Post').find({ creator: req.user.id });
    const analytics = await CEOLevelDataService.getComprehensiveAnalytics(req.user.id, userPosts);
    res.json(analytics);
  } catch (error) {
    console.error('Error getting comprehensive analytics:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get network data
router.get('/network/complete', auth, async (req, res) => {
  try {
    const networkData = await CEOLevelDataService.getNetworkData(req.user.id);
    res.json(networkData);
  } catch (error) {
    console.error('Error getting network data:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get gamification data
router.get('/gamification/complete', auth, async (req, res) => {
  try {
    const gamificationData = await CEOLevelDataService.getGamificationData(req.user.id);
    res.json(gamificationData);
  } catch (error) {
    console.error('Error getting gamification data:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get real-time metrics
router.get('/realtime/complete', auth, async (req, res) => {
  try {
    const realTimeData = await CEOLevelDataService.getRealTimeMetrics(req.user.id);
    res.json(realTimeData);
  } catch (error) {
    console.error('Error getting real-time data:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get geographic analytics
router.get('/geographic/complete', auth, async (req, res) => {
  try {
    const geographicData = await CEOLevelDataService.getGeographicAnalytics(req.user.id);
    res.json(geographicData);
  } catch (error) {
    console.error('Error getting geographic data:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get device analytics
router.get('/device/complete', auth, async (req, res) => {
  try {
    const deviceData = await CEOLevelDataService.getDeviceAnalytics(req.user.id);
    res.json(deviceData);
  } catch (error) {
    console.error('Error getting device data:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get engagement metrics
router.get('/engagement/complete', auth, async (req, res) => {
  try {
    const engagementData = await CEOLevelDataService.getEngagementMetrics(req.user.id);
    res.json(engagementData);
  } catch (error) {
    console.error('Error getting engagement data:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get AI insights
router.get('/ai/complete', auth, async (req, res) => {
  try {
    const aiData = await CEOLevelDataService.getAIInsights(req.user.id);
    res.json(aiData);
  } catch (error) {
    console.error('Error getting AI data:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get performance metrics
router.get('/performance/complete', auth, async (req, res) => {
  try {
    const performanceData = await CEOLevelDataService.getPerformanceMetrics(req.user.id);
    res.json(performanceData);
  } catch (error) {
    console.error('Error getting performance data:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all posts with complete analytics
router.get('/posts/complete', auth, async (req, res) => {
  try {
    const Post = require('../models/Post');
    const PostAnalytics = require('../models/PostAnalytics');
    
    const posts = await Post.find({ creator: req.user.id })
      .populate('creator', 'username email')
      .sort({ createdAt: -1 });

    const postsWithAnalytics = await Promise.all(posts.map(async (post) => {
      const analytics = await PostAnalytics.find({ post: post._id });
      const views = analytics.filter(a => a.type === 'view').length;
      const clicks = analytics.filter(a => a.type === 'click').length;
      const shares = analytics.filter(a => a.type === 'share').length;
      const conversions = analytics.filter(a => a.type === 'conversion').length;
      
      return {
        ...post.toObject(),
        analytics: {
          views,
          clicks,
          shares,
          conversions,
          conversionRate: clicks > 0 ? (conversions / clicks * 100).toFixed(2) : 0,
          engagementRate: views > 0 ? (clicks / views * 100).toFixed(2) : 0
        }
      };
    }));

    res.json(postsWithAnalytics);
  } catch (error) {
    console.error('Error getting posts with analytics:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all referrals with complete data
router.get('/referrals/complete', auth, async (req, res) => {
  try {
    const Referral = require('../models/Referral');
    const referrals = await Referral.find({ referrer: req.user.id })
      .populate('referee', 'username email')
      .populate('post', 'title category price')
      .sort({ createdAt: -1 });

    res.json(referrals);
  } catch (error) {
    console.error('Error getting referrals:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all commissions with complete data
router.get('/commissions/complete', auth, async (req, res) => {
  try {
    const Commission = require('../models/Commission');
    const commissions = await Commission.find({ recipient: req.user.id })
      .populate('post', 'title category')
      .populate('referral', 'referee')
      .sort({ createdAt: -1 });

    const totalAmount = commissions.reduce((sum, c) => sum + (c.amount || 0), 0);
    const pendingAmount = commissions
      .filter(c => c.status === 'pending')
      .reduce((sum, c) => sum + (c.amount || 0), 0);
    const paidAmount = commissions
      .filter(c => c.status === 'paid')
      .reduce((sum, c) => sum + (c.amount || 0), 0);

    res.json({
      commissions,
      summary: {
        totalAmount,
        pendingAmount,
        paidAmount,
        totalCount: commissions.length
      }
    });
  } catch (error) {
    console.error('Error getting commissions:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all activities
router.get('/activities/complete', auth, async (req, res) => {
  try {
    const Activity = require('../models/Activity');
    const activities = await Activity.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .limit(100);

    res.json(activities);
  } catch (error) {
    console.error('Error getting activities:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all notifications
router.get('/notifications/complete', auth, async (req, res) => {
  try {
    const Notification = require('../models/Notification');
    const notifications = await Notification.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .limit(50);

    const unreadCount = notifications.filter(n => !n.read).length;

    res.json({
      notifications,
      unreadCount,
      totalCount: notifications.length
    });
  } catch (error) {
    console.error('Error getting notifications:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all likes for user's posts
router.get('/likes/complete', auth, async (req, res) => {
  try {
    const Post = require('../models/Post');
    const Like = require('../models/Like');
    
    const userPosts = await Post.find({ creator: req.user.id });
    const postIds = userPosts.map(p => p._id);
    
    const likes = await Like.find({ post: { $in: postIds } })
      .populate('user', 'username email')
      .populate('post', 'title')
      .sort({ createdAt: -1 });

    res.json(likes);
  } catch (error) {
    console.error('Error getting likes:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all comments for user's posts
router.get('/comments/complete', auth, async (req, res) => {
  try {
    const Post = require('../models/Post');
    const Comment = require('../models/Comment');
    
    const userPosts = await Post.find({ creator: req.user.id });
    const postIds = userPosts.map(p => p._id);
    
    const comments = await Comment.find({ post: { $in: postIds } })
      .populate('user', 'username email')
      .populate('post', 'title')
      .sort({ createdAt: -1 });

    res.json(comments);
  } catch (error) {
    console.error('Error getting comments:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all bookmarks for user's posts
router.get('/bookmarks/complete', auth, async (req, res) => {
  try {
    const Post = require('../models/Post');
    const Bookmark = require('../models/Bookmark');
    
    const userPosts = await Post.find({ creator: req.user.id });
    const postIds = userPosts.map(p => p._id);
    
    const bookmarks = await Bookmark.find({ post: { $in: postIds } })
      .populate('user', 'username email')
      .populate('post', 'title')
      .sort({ createdAt: -1 });

    res.json(bookmarks);
  } catch (error) {
    console.error('Error getting bookmarks:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get comprehensive tracking data
router.get('/tracking/complete', auth, async (req, res) => {
  try {
    const Post = require('../models/Post');
    const TrackingEvent = require('../models/TrackingEvent');
    const PostAnalytics = require('../models/PostAnalytics');
    
    const userPosts = await Post.find({ creator: req.user.id });
    const postIds = userPosts.map(p => p._id);
    
    const trackingEvents = await TrackingEvent.find({ postId: { $in: postIds } })
      .sort({ timestamp: -1 })
      .limit(1000);

    const postAnalytics = await PostAnalytics.find({ post: { $in: postIds } })
      .sort({ timestamp: -1 })
      .limit(1000);

    res.json({
      trackingEvents,
      postAnalytics,
      summary: {
        totalEvents: trackingEvents.length,
        totalAnalytics: postAnalytics.length,
        lastUpdated: new Date()
      }
    });
  } catch (error) {
    console.error('Error getting tracking data:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
