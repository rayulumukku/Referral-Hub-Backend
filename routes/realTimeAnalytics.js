const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const RealTimeAnalyticsService = require('../services/realTimeAnalyticsService');

// Get user's real analytics
router.get('/user/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Handle undefined userId
    if (!userId || userId === 'undefined') {
      return res.status(400).json({ 
        success: false, 
        message: 'User ID is required' 
      });
    }
    
    // Check if user is accessing their own data or is admin
    if (req.user.id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const analytics = await RealTimeAnalyticsService.getUserAnalytics(userId);
    
    res.json({
      success: true,
      analytics
    });
  } catch (error) {
    console.error('Error getting user analytics:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error getting user analytics',
      error: error.message 
    });
  }
});

// Get admin analytics for all users
router.get('/admin/overview', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const analytics = await RealTimeAnalyticsService.getAdminAnalytics();
    
    res.json({
      success: true,
      analytics
    });
  } catch (error) {
    console.error('Error getting admin analytics:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error getting admin analytics',
      error: error.message 
    });
  }
});

// Get specific post analytics (for admin or post owner)
router.get('/post/:postId', auth, async (req, res) => {
  try {
    const { postId } = req.params;
    
    // Check if user owns the post or is admin
    const Post = require('../models/Post');
    const post = await Post.findById(postId);
    
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    if (post.creator.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Get comprehensive post analytics
    const analytics = await RealTimeAnalyticsService.getPostAnalytics([postId]);
    const referralChains = await RealTimeAnalyticsService.getReferralChains([postId]);
    
    res.json({
      success: true,
      analytics: {
        post: {
          id: post._id,
          title: post.title,
          category: post.category,
          price: post.price,
          status: post.status,
          creator: post.creator,
          createdAt: post.createdAt
        },
        analytics,
        referralChains,
        lastUpdated: new Date()
      }
    });
  } catch (error) {
    console.error('Error getting post analytics:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error getting post analytics',
      error: error.message 
    });
  }
});

// Get user's network growth
router.get('/network/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (req.user.id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const networkGrowth = await RealTimeAnalyticsService.getNetworkGrowth(userId);
    
    res.json({
      success: true,
      networkGrowth
    });
  } catch (error) {
    console.error('Error getting network growth:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error getting network growth',
      error: error.message 
    });
  }
});

// Get user's recent activities
router.get('/activities/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 50, offset = 0 } = req.query;
    
    if (req.user.id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const Activity = require('../models/Activity');
    const activities = await Activity.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset));

    res.json({
      success: true,
      activities
    });
  } catch (error) {
    console.error('Error getting activities:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error getting activities',
      error: error.message 
    });
  }
});

// Get user's notifications
router.get('/notifications/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 20, offset = 0 } = req.query;
    
    if (req.user.id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const Notification = require('../models/Notification');
    const notifications = await Notification.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset));

    res.json({
      success: true,
      notifications
    });
  } catch (error) {
    console.error('Error getting notifications:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error getting notifications',
      error: error.message 
    });
  }
});

// Get user's referral history
router.get('/referrals/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    const { type = 'all' } = req.query; // 'made', 'received', 'all'
    
    if (req.user.id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const Referral = require('../models/Referral');
    let referrals = [];

    if (type === 'made' || type === 'all') {
      const madeReferrals = await Referral.find({ referrer: userId })
        .populate('referee', 'username email')
        .populate('post', 'title category')
        .sort({ createdAt: -1 });
      referrals = referrals.concat(madeReferrals);
    }

    if (type === 'received' || type === 'all') {
      const receivedReferrals = await Referral.find({ referee: userId })
        .populate('referrer', 'username email')
        .populate('post', 'title category')
        .sort({ createdAt: -1 });
      referrals = referrals.concat(receivedReferrals);
    }

    res.json({
      success: true,
      referrals
    });
  } catch (error) {
    console.error('Error getting referrals:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error getting referrals',
      error: error.message 
    });
  }
});

// Get user's commission history
router.get('/commissions/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (req.user.id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const Commission = require('../models/Commission');
    const commissions = await Commission.find({ recipient: userId })
      .populate('post', 'title category')
      .sort({ createdAt: -1 });

    const summary = {
      totalEarned: commissions.reduce((sum, c) => sum + (c.amount || 0), 0),
      pendingAmount: commissions
        .filter(c => c.status === 'pending')
        .reduce((sum, c) => sum + (c.amount || 0), 0),
      paidAmount: commissions
        .filter(c => c.status === 'paid')
        .reduce((sum, c) => sum + (c.amount || 0), 0),
      totalCommissions: commissions.length
    };

    res.json({
      success: true,
      commissions,
      summary
    });
  } catch (error) {
    console.error('Error getting commissions:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error getting commissions',
      error: error.message 
    });
  }
});

// Track activity
router.post('/track-activity', auth, async (req, res) => {
  try {
    const { type, description, metadata } = req.body;
    
    const activity = await RealTimeAnalyticsService.trackActivity(
      req.user.id, 
      type, 
      description, 
      metadata
    );

    res.json({
      success: true,
      activity
    });
  } catch (error) {
    console.error('Error tracking activity:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error tracking activity',
      error: error.message 
    });
  }
});

// Mark notification as read
router.put('/notifications/:notificationId/read', auth, async (req, res) => {
  try {
    const { notificationId } = req.params;
    
    const Notification = require('../models/Notification');
    const notification = await Notification.findById(notificationId);
    
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    if (notification.user.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    notification.read = true;
    await notification.save();

    res.json({
      success: true,
      notification
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error marking notification as read',
      error: error.message 
    });
  }
});

// Get tracking events for a post
router.get('/tracking/:postId', auth, async (req, res) => {
  try {
    const { postId } = req.params;
    
    // Check if user owns the post or is admin
    const Post = require('../models/Post');
    const post = await Post.findById(postId);
    
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    if (post.creator.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const TrackingEvent = require('../models/TrackingEvent');
    const trackingEvents = await TrackingEvent.find({ postId })
      .sort({ timestamp: -1 })
      .limit(100);

    res.json({
      success: true,
      trackingEvents
    });
  } catch (error) {
    console.error('Error getting tracking events:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error getting tracking events',
      error: error.message 
    });
  }
});

module.exports = router;
