const express = require('express');
const mongoose = require('mongoose');
const Activity = require('../models/Activity');
const Referral = require('../models/Referral');
const Commission = require('../models/Commission');
const Post = require('../models/Post');
const User = require('../models/User');
const auth = require('../middleware/auth');
const ActivityService = require('../services/activityService');
const CommissionService = require('../services/commissionService');

const router = express.Router();


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
    const totalCommissions = await Commission.countDocuments();

    // Platform fees and earnings
    const platformCommissions = await Commission.find({ recipient: null });
    const totalPlatformFees = platformCommissions.reduce((sum, c) => sum + c.amount, 0);

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

    // Device and platform analytics
    const deviceStats = await Referral.aggregate([
      { $group: { _id: '$device', count: { $sum: 1 } } }
    ]);

    const platformStats = await Referral.aggregate([
      { $group: { _id: '$platform', count: { $sum: 1 } } }
    ]);

    res.json({
      overview: {
        totalUsers,
        totalPosts,
        totalReferrals,
        totalActivities,
        totalCommissions,
        totalPlatformFees
      },
      recentActivityBreakdown: activityBreakdown,
      deviceStats: deviceStats.map(d => ({ device: d._id, count: d.count })),
      platformStats: platformStats.map(p => ({ platform: p._id, count: p.count }))
    });
  } catch (error) {
    console.error('Error getting platform stats:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get detailed commission analytics
router.get('/commission-analytics', auth, requireAdmin, async (req, res) => {
  try {
    const commissions = await Commission.find()
      .populate('post', 'title pointsPool distributablePoints')
      .populate('recipient', 'username email')
      .populate('referral')
      .sort({ createdAt: -1 })
      .limit(100);

    const totalDistributed = await Commission.aggregate([
      { $match: { recipient: { $ne: null } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    const totalPlatformFees = await Commission.aggregate([
      { $match: { recipient: null } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    res.json({
      commissions,
      summary: {
        totalDistributed: totalDistributed[0]?.total || 0,
        totalPlatformFees: totalPlatformFees[0]?.total || 0,
        totalCommissions: commissions.length
      }
    });
  } catch (error) {
    console.error('Error getting commission analytics:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get detailed referral analytics
router.get('/referral-analytics', auth, requireAdmin, async (req, res) => {
  try {
    const referrals = await Referral.find()
      .populate('post', 'title')
      .populate('referrer', 'username email')
      .populate('referee', 'username email')
      .sort({ createdAt: -1 })
      .limit(200);

    // Geographic distribution
    const geoStats = await Referral.aggregate([
      {
        $group: {
          _id: { city: '$location.city', state: '$location.state' },
          count: { $sum: 1 },
          clicks: { $sum: '$clicks' }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 20 }
    ]);

    // Time-based analytics
    const timeStats = await Referral.aggregate([
      {
        $group: {
          _id: { $hour: '$timestamp' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id': 1 } }
    ]);

    res.json({
      referrals,
      geoStats,
      timeStats: timeStats.map(t => ({ hour: t._id, count: t.count }))
    });
  } catch (error) {
    console.error('Error getting referral analytics:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get post-specific analytics
router.get('/post-analytics/:postId', auth, requireAdmin, async (req, res) => {
  try {
    const { postId } = req.params;

    const post = await Post.findById(postId).populate('creator', 'username email');
    const referrals = await Referral.find({ post: new mongoose.Types.ObjectId(postId) })
      .populate('referrer', 'username email')
      .populate('referee', 'username email')
      .sort({ createdAt: 1 });

    const commissions = await Commission.find({ post: new mongoose.Types.ObjectId(postId) })
      .populate('recipient', 'username email')
      .populate('referral')
      .sort({ createdAt: -1 });

    // Build referral chains
    const chains = [];
    const processedReferrals = new Set();

    for (const referral of referrals) {
      if (!processedReferrals.has(referral._id.toString())) {
        const chain = [referral];
        let current = referral;

        // Build chain backwards
        while (current.parentReferral) {
          const parent = referrals.find(r => r._id.toString() === current.parentReferral.toString());
          if (parent && !processedReferrals.has(parent._id.toString())) {
            chain.unshift(parent);
            current = parent;
          } else {
            break;
          }
        }

        chains.push(chain);
        chain.forEach(r => processedReferrals.add(r._id.toString()));
      }
    }

    // Link performance metrics
    const linkClicks = referrals.length;
    const uniqueVisitors = new Set(referrals.map(r => r.sessionId)).size;
    const platformBreakdown = referrals.reduce((acc, r) => {
      acc[r.platform] = (acc[r.platform] || 0) + 1;
      return acc;
    }, {});

    const deviceBreakdown = referrals.reduce((acc, r) => {
      acc[r.device] = (acc[r.device] || 0) + 1;
      return acc;
    }, {});

    const geographicData = referrals.reduce((acc, r) => {
      const key = `${r.location.city || 'Unknown'}, ${r.location.state || 'Unknown'}`;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    res.json({
      post,
      referrals,
      commissions,
      chains,
      linkAnalytics: {
        totalClicks: linkClicks,
        uniqueVisitors,
        platformBreakdown,
        deviceBreakdown,
        geographicData,
        conversionRate: post.conversions > 0 ? ((commissions.length / linkClicks) * 100).toFixed(2) : 0
      },
      analytics: {
        totalReferrals: referrals.length,
        totalClicks: referrals.reduce((sum, r) => sum + r.clicks, 0),
        totalCommissions: commissions.length,
        totalDistributed: commissions.filter(c => c.recipient).reduce((sum, c) => sum + c.amount, 0),
        platformFee: commissions.find(c => !c.recipient)?.amount || 0
      }
    });
  } catch (error) {
    console.error('Error getting post analytics:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get link performance analytics
router.get('/link-analytics', auth, requireAdmin, async (req, res) => {
  try {
    const { postId, startDate, endDate } = req.query;

    let matchConditions = {};
    if (postId) matchConditions.post = postId;
    if (startDate && endDate) {
      matchConditions.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const linkClicks = await Referral.find(matchConditions).countDocuments();
    const uniqueSessions = await Referral.distinct('sessionId', matchConditions);
    const uniqueVisitors = uniqueSessions.length;

    // Platform performance
    const platformStats = await Referral.aggregate([
      { $match: matchConditions },
      { $group: { _id: '$platform', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Geographic performance
    const geoStats = await Referral.aggregate([
      { $match: matchConditions },
      {
        $group: {
          _id: { city: '$location.city', state: '$location.state' },
          count: { $sum: 1 },
          uniqueSessions: { $addToSet: '$sessionId' }
        }
      },
      {
        $project: {
          location: '$_id',
          clicks: '$count',
          uniqueVisitors: { $size: '$uniqueSessions' }
        }
      },
      { $sort: { clicks: -1 } },
      { $limit: 20 }
    ]);

    // Time-based performance
    const timeStats = await Referral.aggregate([
      { $match: matchConditions },
      {
        $group: {
          _id: { $hour: '$timestamp' },
          clicks: { $sum: 1 },
          uniqueSessions: { $addToSet: '$sessionId' }
        }
      },
      {
        $project: {
          hour: '$_id',
          clicks: '$clicks',
          uniqueVisitors: { $size: '$uniqueSessions' }
        }
      },
      { $sort: { hour: 1 } }
    ]);

    // Device performance
    const deviceStats = await Referral.aggregate([
      { $match: matchConditions },
      { $group: { _id: '$device', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Top performing posts
    const topPosts = await Referral.aggregate([
      { $match: matchConditions },
      { $group: { _id: '$post', clicks: { $sum: 1 } } },
      { $lookup: { from: 'posts', localField: '_id', foreignField: '_id', as: 'post' } },
      { $unwind: '$post' },
      {
        $project: {
          postId: '$_id',
          title: '$post.title',
          clicks: '$clicks',
          conversions: '$post.conversions'
        }
      },
      { $sort: { clicks: -1 } },
      { $limit: 10 }
    ]);

    res.json({
      overview: {
        totalClicks: linkClicks,
        uniqueVisitors,
        clickThroughRate: uniqueVisitors > 0 ? ((linkClicks / uniqueVisitors) * 100).toFixed(2) : 0
      },
      platformStats,
      geoStats,
      timeStats,
      deviceStats,
      topPosts
    });
  } catch (error) {
    console.error('Error getting link analytics:', error);
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

// Delete user (admin only)
router.delete('/users/:userId', auth, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;

    // Prevent admin from deleting themselves
    if (userId === req.user.id) {
      return res.status(400).json({ message: 'Cannot delete your own account' });
    }

    // Find user to delete
    const userToDelete = await User.findById(userId);
    if (!userToDelete) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Delete all posts by this user
    await Post.deleteMany({ creator: userId });

    // Delete all referrals by this user
    await Referral.deleteMany({ referrer: userId });

    // Delete all activities by this user
    await Activity.deleteMany({ user: userId });

    // Delete the user
    await User.findByIdAndDelete(userId);

    // Log admin action
    await ActivityService.trackAdminAction(
      req.user.id,
      'user_deleted',
      `Admin deleted user: ${userToDelete.username} (${userToDelete.email})`,
      { deletedUserId: userId, deletedUserEmail: userToDelete.email }
    );

    res.json({
      message: 'User and all associated data deleted successfully',
      deletedUser: {
        id: userId,
        username: userToDelete.username,
        email: userToDelete.email
      }
    });
  } catch (error) {
    console.error('Error deleting user:', error);
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