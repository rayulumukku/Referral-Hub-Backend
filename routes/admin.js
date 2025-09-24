const express = require('express');
const Activity = require('../models/Activity');
const Referral = require('../models/Referral');
const Post = require('../models/Post');
const User = require('../models/User');
const auth = require('../middleware/auth');
const ActivityService = require('../services/activityService');

const router = express.Router();

// Middleware to check if user is admin
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

// Get all activities for admin
router.get('/activities', auth, requireAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const activities = await ActivityService.getAllActivities(limit, skip);
    const total = await Activity.countDocuments();

    res.json({
      activities,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error getting admin activities:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all referral journey maps for admin
router.get('/referral-journeys', auth, requireAdmin, async (req, res) => {
  try {
    // Get all posts with their referral chains
    const posts = await Post.find({ status: 'active' })
      .populate('creator', 'username email type')
      .sort({ createdAt: -1 });

    const journeyMaps = await Promise.all(
      posts.map(async (post) => {
        const referrals = await Referral.find({ post: post._id })
          .populate('referrer', 'username email type')
          .sort({ createdAt: 1 });

        // Build referral chain
        const chain = referrals.map((ref, index) => ({
          level: index,
          user: ref.referrer,
          platform: ref.platform,
          location: ref.location,
          timestamp: ref.createdAt
        }));

        return {
          post: {
            _id: post._id,
            title: post.title,
            creator: post.creator,
            createdAt: post.createdAt
          },
          referralChain: chain,
          totalClicks: referrals.length,
          totalConversions: post.conversions || 0
        };
      })
    );

    res.json(journeyMaps);
  } catch (error) {
    console.error('Error getting referral journeys:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get detailed activity feed for users (enhanced version)
router.get('/activity-feed', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const activities = await ActivityService.getPlatformActivityFeed(userId);

    // Format activities for frontend display
    const formattedActivities = activities.map(activity => ({
      id: activity._id,
      type: activity.type,
      title: getActivityTitle(activity),
      message: activity.message,
      timestamp: activity.createdAt,
      user: activity.user,
      targetUser: activity.targetUser,
      post: activity.post,
      details: activity.details
    }));

    res.json(formattedActivities);
  } catch (error) {
    console.error('Error getting activity feed:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get platform statistics for admin
router.get('/platform-stats', auth, requireAdmin, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalPosts = await Post.countDocuments();
    const totalReferrals = await Referral.countDocuments();
    const totalActivities = await Activity.countDocuments();

    // Recent activity breakdown
    const recentActivities = await Activity.find()
      .sort({ createdAt: -1 })
      .limit(100);

    const activityBreakdown = {
      user_registrations: recentActivities.filter(a => a.type === 'user_registration').length,
      post_creations: recentActivities.filter(a => a.type === 'post_created').length,
      referral_shares: recentActivities.filter(a => a.type === 'referral_shared').length,
      referral_clicks: recentActivities.filter(a => a.type === 'referral_click').length,
      commission_earnings: recentActivities.filter(a => a.type === 'commission_earned').length
    };

    res.json({
      overview: {
        totalUsers,
        totalPosts,
        totalReferrals,
        totalActivities
      },
      recentActivityBreakdown: activityBreakdown
    });
  } catch (error) {
    console.error('Error getting platform stats:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get users list for admin
router.get('/users', auth, requireAdmin, async (req, res) => {
  try {
    const users = await User.find()
      .select('username email type credits status createdAt')
      .sort({ createdAt: -1 });

    res.json(users);
  } catch (error) {
    console.error('Error getting users:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

function getActivityTitle(activity) {
  switch (activity.type) {
    case 'user_registration':
      return 'New User Joined';
    case 'post_created':
      return 'New Post Created';
    case 'referral_shared':
      return 'Post Shared';
    case 'referral_click':
      return 'Referral Click';
    case 'commission_earned':
      return 'Commission Earned';
    default:
      return 'Activity';
  }
}

module.exports = router;