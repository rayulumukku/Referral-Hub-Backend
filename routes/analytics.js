const express = require('express');
const mongoose = require('mongoose');
const Referral = require('../models/Referral');
const Commission = require('../models/Commission');
const User = require('../models/User');
const Post = require('../models/Post');
const auth = require('../middleware/auth');
const ActivityService = require('../services/activityService');
const NetworkService = require('../services/networkService');

const router = express.Router();

// Get io instance from server.js
let io;
const setIoInstance = (ioInstance) => {
  io = ioInstance;
};

// Export the function to be called from server.js
module.exports.setIoInstance = setIoInstance;

// Get user analytics
router.get('/user/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;

    // Total referrals
    const totalReferrals = await Referral.countDocuments({ referrer: userId });

    // Total commissions
    const commissions = await Commission.find({ recipient: userId });
    const totalEarnings = commissions.reduce((sum, c) => sum + c.amount, 0);

    // Platform distribution
    const platformStats = await Referral.aggregate([
      { $match: { referrer: new mongoose.Types.ObjectId(userId) } },
      { $group: { _id: '$platform', count: { $sum: 1 } } }
    ]);

    // Geographic distribution
    const geoStats = await Referral.aggregate([
      { $match: { referrer: new mongoose.Types.ObjectId(userId) } },
      { $group: { _id: '$location.city', count: { $sum: 1 } } }
    ]);

    res.json({
      totalReferrals,
      totalEarnings,
      platformStats,
      geoStats,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get global analytics
router.get('/global', async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalPosts = await Post.countDocuments();
    const totalReferrals = await Referral.countDocuments();

    // Total conversions and reach from posts
    let postStats = [];
    try {
      postStats = await Post.aggregate([
        {
          $group: {
            _id: null,
            totalConversions: { $sum: '$conversions' },
            totalReach: { $sum: '$reach' }
          }
        }
      ]);
    } catch (err) {
      console.error('Post stats aggregation error:', err);
    }

    const totalConversions = postStats[0]?.totalConversions || 0;
    const totalReach = postStats[0]?.totalReach || 0;
    const averageConversionRate = totalReach > 0 ? ((totalConversions / totalReach) * 100).toFixed(2) : 0;

    let totalCommissions = [];
    try {
      totalCommissions = await Commission.aggregate([
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]);
    } catch (err) {
      console.error('Commission aggregation error:', err);
    }

    // Platform distribution
    let platformStats = [];
    try {
      platformStats = await Referral.aggregate([
        { $group: { _id: '$platform', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]);
    } catch (err) {
      console.error('Platform stats aggregation error:', err);
    }

    // Device distribution
    let deviceStats = [];
    try {
      deviceStats = await Referral.aggregate([
        { $group: { _id: '$device', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]);
    } catch (err) {
      console.error('Device stats aggregation error:', err);
    }

    // Geographic distribution
    let geoStats = [];
    try {
      geoStats = await Referral.aggregate([
        { $group: { _id: { city: '$location.city', state: '$location.state' }, count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]);
    } catch (err) {
      console.error('Geo stats aggregation error:', err);
    }

    // Time-based stats (simplified)
    const timeStats = [
      { hour: '9-12', conversions: Math.floor(totalConversions * 0.28) },
      { hour: '12-15', conversions: Math.floor(totalConversions * 0.225) },
      { hour: '15-18', conversions: Math.floor(totalConversions * 0.202) },
      { hour: '18-21', conversions: Math.floor(totalConversions * 0.169) },
      { hour: '21-24', conversions: Math.floor(totalConversions * 0.124) }
    ];

    const totalEarnings = totalCommissions[0]?.total || 0;

    // Get network growth data
    const networkGrowth = await NetworkService.getNetworkGrowthData();

    // Calculate total network stats
    const totalLevel1 = networkGrowth.reduce((sum, month) => sum + month.level1, 0);
    const totalLevel2 = networkGrowth.reduce((sum, month) => sum + month.level2, 0);
    const totalLevel3 = networkGrowth.reduce((sum, month) => sum + month.level3, 0);

    res.json({
      totalUsers,
      totalPosts,
      totalReferrals,
      totalConversions,
      totalReach,
      totalEarnings,
      kmTravelled: 0, // Would need to calculate distances
      conversionRate: parseFloat(averageConversionRate),
      platformStats: platformStats.map(p => ({ platform: p._id, count: p.count })),
      deviceStats: deviceStats.map(d => ({ device: d._id, count: d.count })),
      geographicStats: geoStats.map(g => ({ city: g._id.city, state: g._id.state, users: g.count, conversions: Math.floor(g.count * parseFloat(averageConversionRate) / 100) })),
      timeStats,
      earningsForecast: {
        currentMonth: totalEarnings,
        nextMonth: Math.round(totalEarnings * 1.259),
        growthRate: 25.9
      },
      networkGrowth: {
        level1: totalLevel1,
        level2: totalLevel2,
        level3: totalLevel3,
        total: totalLevel1 + totalLevel2 + totalLevel3,
        monthlyData: networkGrowth
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get post analytics (referrals for a specific post)
router.get('/post/:postId', auth, async (req, res) => {
  try {
    const { postId } = req.params;
    console.log('Analytics /post: Request for postId:', postId, 'by user:', req.user.id, 'role:', req.user.role);

    // Validate postId
    if (!postId || postId.length !== 24) {
      console.log('Analytics /post: Invalid post ID');
      return res.status(400).json({ message: 'Invalid post ID' });
    }

    // Check if user owns this post or is admin
    const post = await Post.findById(postId);
    if (!post) {
      console.log('Analytics /post: Post not found');
      return res.status(404).json({ message: 'Post not found' });
    }

    console.log('Analytics /post: Post creator:', post.creator.toString(), 'Requesting user:', req.user.id, 'User role:', req.user.role);

    if (post.creator.toString() !== req.user.id && req.user.role !== 'admin') {
      console.log('Analytics /post: Access denied - user is not creator and not admin');
      return res.status(403).json({ message: 'Access denied' });
    }

    console.log('Analytics /post: Access granted');

    const referrals = await Referral.find({ post: postId }).sort({ createdAt: 1 });

    const totalClicks = referrals.length;
    const totalConversions = await Commission.countDocuments({ referral: { $in: referrals.map(r => r._id) } });

    // Platform distribution
    const platformStats = {};
    referrals.forEach(r => {
      platformStats[r.platform] = (platformStats[r.platform] || 0) + 1;
    });

    // Device distribution
    const deviceStats = {};
    referrals.forEach(r => {
      deviceStats[r.device] = (deviceStats[r.device] || 0) + 1;
    });

    // Geographic distribution
    const geoStats = {};
    referrals.forEach(r => {
      const key = `${r.location.city}, ${r.location.state}`;
      geoStats[key] = (geoStats[key] || 0) + 1;
    });

    res.json({
      totalClicks,
      totalConversions,
      referrals: referrals.map(r => ({
        _id: r._id,
        referrer: r.referrer.toString(), // Convert ObjectId to string
        platform: r.platform,
        device: r.device,
        location: r.location,
        createdAt: r.createdAt
      })),
      platformStats,
      deviceStats,
      geoStats
    });
  } catch (error) {
    console.error('Analytics post error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get post analytics for post creator (simplified version for Journey page)
router.get('/my-post/:postId', auth, async (req, res) => {
  try {
    const { postId } = req.params;
    console.log('Analytics /my-post: Request for postId:', postId, 'by user:', req.user.id, 'role:', req.user.role);

    // Validate postId
    if (!postId || postId.length !== 24) {
      console.log('Analytics /my-post: Invalid post ID');
      return res.status(400).json({ message: 'Invalid post ID' });
    }

    // Check if user owns this post
    const post = await Post.findById(postId);
    if (!post) {
      console.log('Analytics /my-post: Post not found');
      return res.status(404).json({ message: 'Post not found' });
    }

    console.log('Analytics /my-post: Post creator:', post.creator.toString(), 'Requesting user:', req.user.id, 'User role:', req.user.role);

    if (post.creator.toString() !== req.user.id && req.user.role !== 'admin') {
      console.log('Analytics /my-post: Access denied - user is not creator and not admin');
      return res.status(403).json({ message: 'Access denied' });
    }

    console.log('Analytics /my-post: Access granted for creator');

    const referrals = await Referral.find({ post: postId })
      .populate('referrer', 'username email')
      .sort({ createdAt: 1 });

    const commissions = await Commission.find({ post: postId })
      .populate('recipient', 'username email')
      .sort({ createdAt: -1 });

    // Build referral chain
    const referralChain = referrals.map((ref, index) => ({
      level: 1, // All post referrals are level 1 (direct clicks)
      referrer: ref.referrer,
      location: ref.location,
      platform: ref.platform,
      device: ref.device,
      timestamp: ref.createdAt,
      commission: commissions.find(c => c.referral.toString() === ref._id.toString())
    }));

    // Calculate analytics
    const totalReferrals = referrals.length;
    const totalClicks = referrals.length;
    const totalEarnings = commissions.filter(c => c.recipient).reduce((sum, c) => sum + c.amount, 0);

    // Platform stats
    const platformStats = Object.entries(
      referrals.reduce((acc, r) => {
        acc[r.platform] = (acc[r.platform] || 0) + 1;
        return acc;
      }, {})
    ).map(([platform, clicks]) => ({ platform, clicks }));

    // Geo stats
    const geoStats = Object.entries(
      referrals.reduce((acc, r) => {
        const key = `${r.location.city || 'Unknown'}, ${r.location.state || 'Unknown'}`;
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {})
    ).map(([location, clicks]) => ({ city: location.split(',')[0], state: location.split(',')[1]?.trim(), clicks }));

    // Device stats
    const deviceStats = Object.entries(
      referrals.reduce((acc, r) => {
        acc[r.device] = (acc[r.device] || 0) + 1;
        return acc;
      }, {})
    ).map(([device, clicks]) => ({ device, clicks }));

    // Time stats (simplified)
    const timeStats = [
      { hour: '9-12', conversions: Math.floor(totalClicks * 0.3) },
      { hour: '12-15', conversions: Math.floor(totalClicks * 0.25) },
      { hour: '15-18', conversions: Math.floor(totalClicks * 0.2) },
      { hour: '18-21', conversions: Math.floor(totalClicks * 0.15) },
      { hour: '21-24', conversions: Math.floor(totalClicks * 0.1) }
    ];

    res.json({
      post,
      analytics: {
        totalReferrals,
        totalClicks,
        totalEarnings,
        totalConversions: commissions.length,
        platformStats,
        geoStats,
        deviceStats,
        timeStats,
        conversionRate: totalClicks > 0 ? ((commissions.length / totalClicks) * 100).toFixed(2) : 0
      },
      referralChain,
      commissions
    });
  } catch (error) {
    console.error('My post analytics error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user network stats
router.get('/network/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;

    const networkStats = await NetworkService.calculateNetworkLevels(userId);

    res.json(networkStats);
  } catch (error) {
    console.error('Network stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user activities
router.get('/activities/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;

    // Get activities for this user using the new ActivityService
    const activities = await ActivityService.getUserActivities(userId);

    // Format for frontend compatibility
    const formattedActivities = activities.map(activity => ({
      type: activity.type,
      title: getActivityTitle(activity),
      description: activity.message,
      date: activity.createdAt,
      details: activity.details
    }));

    res.json(formattedActivities);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

function getActivityTitle(activity) {
  switch (activity.type) {
    case 'user_registration':
      return 'User Registration';
    case 'user_login':
      return 'Login';
    case 'post_created':
      return 'Post Created';
    case 'referral_shared':
      return 'Referral Shared';
    case 'referral_click':
      return 'Referral Click';
    case 'commission_earned':
      return 'Commission Earned';
    default:
      return 'Activity';
  }
}

// Get user referrals
router.get('/referrals/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;

    const referrals = await Referral.find({ referrer: userId }).populate('post').sort({ createdAt: -1 });

    // For each referral, get commission if any
    const referralsWithCommissions = await Promise.all(
      referrals.map(async (ref) => {
        const commission = await Commission.findOne({ referral: ref._id });
        return {
          _id: ref._id,
          post: ref.post,
          platform: ref.platform,
          location: ref.location,
          createdAt: ref.createdAt,
          commission: commission ? commission.amount : 0
        };
      })
    );

    res.json(referralsWithCommissions);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user commissions
router.get('/commissions/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;

    const commissions = await Commission.find({ recipient: userId }).populate('referral').sort({ createdAt: -1 });

    res.json(commissions);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get referral chain for visualization
router.get('/referral-chain/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;

    const referralChain = await NetworkService.getReferralChain(userId);

    res.json(referralChain);
  } catch (error) {
    console.error('Referral chain error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get platform performance stats for admin
router.get('/platform-stats', async (req, res) => {
  try {
    // Get platform distribution from referral activities
    const platformStats = await ActivityService.getPlatformStats();

    // Get device distribution from all activities with device info
    const deviceStats = await ActivityService.getDeviceStats();

    // Get post creation platform stats
    const postCreationStats = await ActivityService.getPostCreationStats();

    // Calculate percentages
    const totalReferrals = platformStats.reduce((sum, stat) => sum + stat.count, 0);
    const totalDevices = deviceStats.reduce((sum, stat) => sum + stat.count, 0);
    const totalPosts = postCreationStats.reduce((sum, stat) => sum + stat.count, 0);

    const platformPercentages = platformStats.map(stat => ({
      platform: stat.platform || 'unknown',
      count: stat.count,
      percentage: totalReferrals > 0 ? Math.round((stat.count / totalReferrals) * 100) : 0
    }));

    const devicePercentages = deviceStats.map(stat => ({
      device: stat.device || 'unknown',
      count: stat.count,
      percentage: totalDevices > 0 ? Math.round((stat.count / totalDevices) * 100) : 0
    }));

    const postPlatformPercentages = postCreationStats.map(stat => ({
      platform: stat.platform || 'unknown',
      count: stat.count,
      percentage: totalPosts > 0 ? Math.round((stat.count / totalPosts) * 100) : 0
    }));

    res.json({
      overview: {
        totalUsers: await User.countDocuments(),
        totalPosts: await Post.countDocuments(),
        totalReferrals: totalReferrals,
        totalEarnings: 0 // Would need to calculate from commissions
      },
      platformStats: platformPercentages,
      deviceStats: devicePercentages,
      postCreationStats: postPlatformPercentages
    });
  } catch (error) {
    console.error('Error getting platform stats:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;