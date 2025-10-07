const express = require('express');
const User = require('../models/User');
const Post = require('../models/Post');
const Referral = require('../models/Referral');
const Commission = require('../models/Commission');
const Activity = require('../models/Activity');
const Notification = require('../models/Notification');
const Like = require('../models/Like');
const Comment = require('../models/Comment');
const Bookmark = require('../models/Bookmark');
const auth = require('../middleware/auth');

const router = express.Router();

// User profile endpoint
router.get('/users/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// User posts endpoint
router.get('/posts/user-posts', auth, async (req, res) => {
  try {
    const posts = await Post.find({ creator: req.user.id })
      .populate('creator', 'username email type')
      .sort({ createdAt: -1 });
    res.json(posts);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// User referrals endpoint
router.get('/referrals/user-referrals', auth, async (req, res) => {
  try {
    const referrals = await Referral.find({ referrer: req.user.id })
      .populate('post', 'title description creator')
      .populate('referee', 'username email')
      .sort({ createdAt: -1 });
    
    // Get referral analytics
    const analytics = {
      totalReferrals: referrals.length,
      totalClicks: referrals.reduce((sum, r) => sum + (r.engagement?.totalClicks || 0), 0),
      totalShares: referrals.reduce((sum, r) => sum + (r.engagement?.shares || 0), 0),
      conversions: referrals.filter(r => r.conversion?.converted).length,
      platforms: {},
      locations: {},
      devices: {}
    };

    // Process analytics data
    referrals.forEach(ref => {
      if (ref.platform) {
        analytics.platforms[ref.platform] = (analytics.platforms[ref.platform] || 0) + 1;
      }
      if (ref.location?.city) {
        const key = `${ref.location.city}, ${ref.location.state || ref.location.country}`;
        analytics.locations[key] = (analytics.locations[key] || 0) + 1;
      }
      if (ref.device) {
        analytics.devices[ref.device] = (analytics.devices[ref.device] || 0) + 1;
      }
    });

    res.json({ referrals, analytics });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// User commissions endpoint
router.get('/commissions/user-commissions', auth, async (req, res) => {
  try {
    const commissions = await Commission.find({ recipient: req.user.id })
      .populate('post', 'title description')
      .populate('referral')
      .sort({ createdAt: -1 });
    res.json(commissions);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// User activities endpoint
router.get('/activities/user-activities', auth, async (req, res) => {
  try {
    const activities = await Activity.find({ user: req.user.id })
      .populate('post', 'title')
      .populate('targetUser', 'username')
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(activities);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// User notifications endpoint
router.get('/notifications/user-notifications', auth, async (req, res) => {
  try {
    const notifications = await Notification.find({ recipient: req.user.id })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Expert dashboard endpoint
router.get('/analytics/expert-dashboard', auth, async (req, res) => {
  try {
    const ExpertAnalyticsService = require('../services/expertAnalyticsService');
    const dashboardData = await ExpertAnalyticsService.getRealTimeDashboard(req.user.id);
    res.json(dashboardData);
  } catch (error) {
    console.error('Error getting expert dashboard:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Comprehensive analytics endpoint
router.get('/analytics/comprehensive', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get user's posts
    const posts = await Post.find({ creator: userId });
    
    // Get user's referrals
    const referrals = await Referral.find({ referrer: userId });
    
    // Get user's commissions
    const commissions = await Commission.find({ recipient: userId });
    
    // Calculate analytics
    const analytics = {
      totalPosts: posts.length,
      totalReferrals: referrals.length,
      totalCommissions: commissions.length,
      totalEarnings: commissions.reduce((sum, c) => sum + c.amount, 0),
      locations: {},
      devices: {},
      platforms: {},
      timeAnalysis: {
        hourly: {},
        daily: {}
      }
    };
    
    // Process location data
    referrals.forEach(ref => {
      if (ref.location?.city) {
        const key = `${ref.location.city}, ${ref.location.state || ref.location.country}`;
        analytics.locations[key] = (analytics.locations[key] || 0) + 1;
      }
    });
    
    // Process device data
    referrals.forEach(ref => {
      if (ref.device) {
        analytics.devices[ref.device] = (analytics.devices[ref.device] || 0) + 1;
      }
    });
    
    // Process platform data
    referrals.forEach(ref => {
      if (ref.platform) {
        analytics.platforms[ref.platform] = (analytics.platforms[ref.platform] || 0) + 1;
      }
    });
    
    res.json(analytics);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin endpoints
router.get('/admin/users', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    const users = await User.find({}).select('-password').sort({ createdAt: -1 }).limit(50);
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ status: { $ne: 'inactive' } });
    const verifiedUsers = await User.countDocuments({ isVerified: true });
    
    res.json({
      users,
      totalUsers,
      activeUsers,
      verifiedUsers,
      newUsers: await User.countDocuments({ 
        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      })
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/admin/posts', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    const posts = await Post.find({}).populate('creator', 'username email').sort({ createdAt: -1 }).limit(50);
    const totalPosts = await Post.countDocuments();
    const activePosts = await Post.countDocuments({ status: 'active' });
    const soldPosts = await Post.countDocuments({ status: 'sold' });
    
    res.json({
      posts,
      totalPosts,
      activePosts,
      soldPosts,
      trendingPosts: await Post.countDocuments({ 
        conversions: { $gt: 0 },
        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      })
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/admin/activities', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    const activities = await Activity.find({}).sort({ createdAt: -1 }).limit(100);
    res.json(activities);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/admin/analytics', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    const analytics = {
      totalUsers: await User.countDocuments(),
      totalPosts: await Post.countDocuments(),
      totalReferrals: await Referral.countDocuments(),
      totalCommissions: await Commission.countDocuments(),
      topPosts: await Post.find({}).sort({ conversions: -1 }).limit(5),
      userGrowth: {
        thisWeek: await User.countDocuments({ 
          createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
        }),
        thisMonth: await User.countDocuments({ 
          createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
        }),
        total: await User.countDocuments()
      }
    };
    
    res.json(analytics);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/admin/system', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    const system = {
      totalUsers: await User.countDocuments(),
      totalPosts: await Post.countDocuments(),
      totalReferrals: await Referral.countDocuments(),
      totalCommissions: await Commission.countDocuments(),
      totalActivities: await Activity.countDocuments(),
      totalNotifications: await Notification.countDocuments()
    };
    
    res.json(system);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Tracking endpoints
router.get('/tracking/post/:postId/analytics', auth, async (req, res) => {
  try {
    const { postId } = req.params;
    const post = await Post.findById(postId);
    
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }
    
    const analytics = {
      totalViews: post.analytics?.views || 0,
      uniqueViews: post.analytics?.uniqueViewers?.length || 0,
      totalClicks: post.analytics?.shares || 0,
      totalShares: post.analytics?.shares || 0,
      avgTimeSpent: post.analytics?.totalTimeSpent || 0,
      maxScrollDepth: post.analytics?.maxScrollDepth || 0,
      deviceStats: {
        devices: {},
        browsers: {}
      },
      geographicStats: []
    };
    
    res.json(analytics);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/tracking/track', auth, async (req, res) => {
  try {
    const { postId, type, data } = req.body;
    
    // Create tracking event
    const trackingEvent = {
      type,
      postId,
      userId: req.user.id,
      data: {
        ...data,
        timestamp: new Date()
      }
    };
    
    res.json({ message: 'Tracking event recorded' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Engagement endpoints
router.get('/engagement/posts/:postId/likes', async (req, res) => {
  try {
    const { postId } = req.params;
    const likes = await Like.find({ post: postId }).populate('user', 'username');
    const userLiked = req.user ? await Like.findOne({ post: postId, user: req.user.id }) : null;
    
    res.json({ likes, userLiked: !!userLiked });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/engagement/posts/:postId/comments', async (req, res) => {
  try {
    const { postId } = req.params;
    const comments = await Comment.find({ post: postId, isDeleted: false })
      .populate('author', 'username')
      .sort({ createdAt: -1 });
    
    res.json({ comments });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/engagement/posts/:postId/bookmarks', async (req, res) => {
  try {
    const { postId } = req.params;
    const bookmarks = await Bookmark.find({ post: postId }).populate('user', 'username');
    const userBookmarked = req.user ? await Bookmark.findOne({ post: postId, user: req.user.id }) : null;
    
    res.json({ bookmarks, userBookmarked: !!userBookmarked });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/engagement/posts/:postId/like', auth, async (req, res) => {
  try {
    const { postId } = req.params;
    const result = await Like.toggleLike(req.user.id, postId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/engagement/posts/:postId/bookmark', auth, async (req, res) => {
  try {
    const { postId } = req.params;
    const result = await Bookmark.toggleBookmark(req.user.id, postId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/engagement/posts/:postId/comments', auth, async (req, res) => {
  try {
    const { postId } = req.params;
    const { content } = req.body;
    
    const comment = new Comment({
      post: postId,
      author: req.user.id,
      content
    });
    
    await comment.save();
    await comment.populate('author', 'username');
    
    res.json(comment);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/engagement/comments/:commentId/like', auth, async (req, res) => {
  try {
    const { commentId } = req.params;
    const comment = await Comment.findById(commentId);
    
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }
    
    await comment.addLike(req.user.id);
    res.json({ message: 'Comment liked' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Notification endpoints
router.put('/notifications/:notificationId/read', auth, async (req, res) => {
  try {
    const { notificationId } = req.params;
    const notification = await Notification.findById(notificationId);
    
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    
    if (notification.recipient.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    
    await notification.markAsRead();
    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// User network endpoint
router.get('/users/network/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Get user's network data
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Get direct referrals
    const directReferrals = await User.find({ referrer: userId })
      .select('username email type location')
      .limit(20);
    
    // Get network statistics
    const networkData = {
      totalMembers: directReferrals.length,
      directReferrals: directReferrals.length,
      maxDepth: 1, // Simplified for now
      activeMembers: directReferrals.length,
      levels: [directReferrals],
      totalReferrals: await Referral.countDocuments({ referrer: userId }),
      totalClicks: 0,
      totalShares: 0,
      conversionRate: 0,
      topLocations: []
    };
    
    res.json(networkData);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Referral analytics endpoint
router.get('/referrals/analytics/:postId', auth, async (req, res) => {
  try {
    const { postId } = req.params;
    
    const referrals = await Referral.find({ post: postId })
      .populate('referrer', 'username email')
      .populate('referee', 'username email')
      .sort({ createdAt: -1 });
    
    const analytics = {
      totalReferrals: referrals.length,
      totalClicks: referrals.reduce((sum, r) => sum + (r.engagement?.totalClicks || 0), 0),
      totalShares: referrals.reduce((sum, r) => sum + (r.engagement?.shares || 0), 0),
      conversions: referrals.filter(r => r.conversion?.converted).length,
      platforms: {},
      locations: {},
      devices: {}
    };
    
    // Process analytics data
    referrals.forEach(ref => {
      if (ref.platform) {
        analytics.platforms[ref.platform] = (analytics.platforms[ref.platform] || 0) + 1;
      }
      if (ref.location?.city) {
        const key = `${ref.location.city}, ${ref.location.state || ref.location.country}`;
        analytics.locations[key] = (analytics.locations[key] || 0) + 1;
      }
      if (ref.device) {
        analytics.devices[ref.device] = (analytics.devices[ref.device] || 0) + 1;
      }
    });
    
    res.json(analytics);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
