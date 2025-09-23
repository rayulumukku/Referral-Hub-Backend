const express = require('express');
const User = require('../models/User');
const Post = require('../models/Post');
const Referral = require('../models/Referral');
const Commission = require('../models/Commission');
const auth = require('../middleware/auth');

const router = express.Router();

// Middleware to check if user is admin
const adminAuth = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin role required.' });
    }
    next();
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Get all users (admin only)
router.get('/users', auth, adminAuth, async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get platform statistics (admin only)
router.get('/platform-stats', auth, adminAuth, async (req, res) => {
  try {
    // Platform distribution
    const platformStats = await Referral.aggregate([
      {
        $group: {
          _id: '$platform',
          count: { $sum: 1 },
          uniqueUsers: { $addToSet: '$referrer' }
        }
      },
      {
        $project: {
          platform: '$_id',
          totalClicks: '$count',
          uniqueUsers: { $size: '$uniqueUsers' },
          _id: 0
        }
      }
    ]);

    // Device distribution
    const deviceStats = await Referral.aggregate([
      {
        $group: {
          _id: '$device',
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          device: '$_id',
          count: '$count',
          _id: 0
        }
      }
    ]);

    // Geographic distribution
    const geoStats = await Referral.aggregate([
      {
        $group: {
          _id: { city: '$location.city', state: '$location.state' },
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          city: '$_id.city',
          state: '$_id.state',
          count: '$count',
          _id: 0
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    // User growth over time
    const userGrowth = await User.aggregate([
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id': 1 }
      }
    ]);

    // Post performance
    const postStats = await Post.aggregate([
      {
        $lookup: {
          from: 'referrals',
          localField: '_id',
          foreignField: 'post',
          as: 'referrals'
        }
      },
      {
        $lookup: {
          from: 'commissions',
          localField: '_id',
          foreignField: 'referral.post',
          as: 'commissions'
        }
      },
      {
        $project: {
          title: 1,
          creator: 1,
          reach: 1,
          conversions: 1,
          totalCommissions: { $sum: '$commissions.amount' },
          referralCount: { $size: '$referrals' }
        }
      },
      { $sort: { reach: -1 } },
      { $limit: 10 }
    ]);

    res.json({
      platformStats,
      deviceStats,
      geoStats,
      userGrowth,
      postStats
    });
  } catch (error) {
    console.error('Platform stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update user role (admin only)
router.put('/users/:userId/role', auth, adminAuth, async (req, res) => {
  try {
    const { role } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.userId,
      { role },
      { new: true }
    ).select('-password');
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get detailed user analytics (admin only)
router.get('/users/:userId/analytics', auth, adminAuth, async (req, res) => {
  try {
    const { userId } = req.params;

    const userPosts = await Post.find({ creator: userId });
    const userReferrals = await Referral.find({ referrer: userId });
    const userCommissions = await Commission.find({ recipient: userId });

    res.json({
      posts: userPosts,
      referrals: userReferrals,
      commissions: userCommissions,
      stats: {
        totalPosts: userPosts.length,
        totalReferrals: userReferrals.length,
        totalEarnings: userCommissions.reduce((sum, c) => sum + c.amount, 0),
        totalClicks: userReferrals.length
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all referrals for a specific post (admin only)
router.get('/post-referrals/:postId', auth, adminAuth, async (req, res) => {
  try {
    const { postId } = req.params;
    const referrals = await Referral.find({ post: postId })
      .populate('referrer', 'email profile.name')
      .populate('post', 'title')
      .sort({ createdAt: 1 });

    res.json(referrals);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all commissions for a specific post (admin only)
router.get('/post-commissions/:postId', auth, adminAuth, async (req, res) => {
  try {
    const { postId } = req.params;
    const commissions = await Commission.find()
      .populate({
        path: 'referral',
        match: { post: postId },
        populate: { path: 'referrer', select: 'email profile.name' }
      })
      .populate('recipient', 'email profile.name')
      .sort({ createdAt: 1 });

    // Filter out commissions where referral doesn't match the post
    const filteredCommissions = commissions.filter(c => c.referral);

    res.json(filteredCommissions);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get comprehensive analytics for a specific post (admin only)
router.get('/post-analytics/:postId', auth, adminAuth, async (req, res) => {
  try {
    const { postId } = req.params;

    // Get post details
    const post = await Post.findById(postId).populate('creator', 'email profile.name type');

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // Get all referrals for this post
    const referrals = await Referral.find({ post: postId })
      .populate('referrer', 'email profile.name')
      .sort({ createdAt: 1 });

    // Get all commissions for this post
    const commissions = await Commission.find()
      .populate({
        path: 'referral',
        match: { post: postId }
      })
      .populate('recipient', 'email profile.name')
      .sort({ createdAt: 1 });

    const postCommissions = commissions.filter(c => c.referral);

    // Platform analytics
    const platformStats = await Referral.aggregate([
      { $match: { post: require('mongoose').Types.ObjectId(postId) } },
      { $group: { _id: '$platform', count: { $sum: 1 } } },
      { $project: { platform: '$_id', clicks: '$count', _id: 0 } }
    ]);

    // Geographic analytics
    const geoStats = await Referral.aggregate([
      { $match: { post: require('mongoose').Types.ObjectId(postId) } },
      {
        $group: {
          _id: { city: '$location.city', state: '$location.state' },
          count: { $sum: 1 },
          uniqueUsers: { $addToSet: '$referrer' }
        }
      },
      {
        $project: {
          city: '$_id.city',
          state: '$_id.state',
          clicks: '$count',
          uniqueUsers: { $size: '$uniqueUsers' },
          _id: 0
        }
      },
      { $sort: { clicks: -1 } },
      { $limit: 10 }
    ]);

    // Device analytics
    const deviceStats = await Referral.aggregate([
      { $match: { post: require('mongoose').Types.ObjectId(postId) } },
      { $group: { _id: '$device', count: { $sum: 1 } } },
      { $project: { device: '$_id', clicks: '$count', _id: 0 } }
    ]);

    // Time-based analytics
    const timeStats = await Referral.aggregate([
      { $match: { post: require('mongoose').Types.ObjectId(postId) } },
      {
        $group: {
          _id: {
            $switch: {
              branches: [
                { case: { $and: [{ $gte: [{ $hour: '$createdAt' }, 9] }, { $lt: [{ $hour: '$createdAt' }, 12] }] }, then: '9-12' },
                { case: { $and: [{ $gte: [{ $hour: '$createdAt' }, 12] }, { $lt: [{ $hour: '$createdAt' }, 15] }] }, then: '12-15' },
                { case: { $and: [{ $gte: [{ $hour: '$createdAt' }, 15] }, { $lt: [{ $hour: '$createdAt' }, 18] }] }, then: '15-18' },
                { case: { $and: [{ $gte: [{ $hour: '$createdAt' }, 18] }, { $lt: [{ $hour: '$createdAt' }, 21] }] }, then: '18-21' },
                { case: { $and: [{ $gte: [{ $hour: '$createdAt' }, 21] }, { $lt: [{ $hour: '$createdAt' }, 24] }] }, then: '21-24' }
              ],
              default: 'Other'
            }
          },
          count: { $sum: 1 }
        }
      },
      { $project: { timeSlot: '$_id', clicks: '$count', _id: 0 } }
    ]);

    // Calculate total earnings for this post
    const totalEarnings = postCommissions.reduce((sum, c) => sum + c.amount, 0);

    // Build referral chain
    const referralChain = [];
    referrals.forEach((ref, index) => {
      const commission = postCommissions.find(c => c.referral._id.toString() === ref._id.toString());
      referralChain.push({
        level: index + 1,
        referrer: ref.referrer,
        location: ref.location,
        platform: ref.platform,
        device: ref.device,
        browser: ref.browser,
        timestamp: ref.createdAt,
        commission: commission ? {
          amount: commission.amount,
          percentage: commission.percentage,
          paidAt: commission.createdAt
        } : null
      });
    });

    res.json({
      post: {
        id: post._id,
        title: post.title,
        description: post.description,
        category: post.category,
        price: post.price,
        creator: post.creator,
        createdAt: post.createdAt,
        status: post.status,
        referralLink: post.referralLink,
        reach: post.reach || 0,
        conversions: post.conversions || 0
      },
      analytics: {
        totalReferrals: referrals.length,
        totalClicks: referrals.length,
        totalConversions: post.conversions || 0,
        totalEarnings: totalEarnings,
        conversionRate: post.reach > 0 ? ((post.conversions || 0) / post.reach * 100).toFixed(2) : 0,
        platformStats,
        geoStats,
        deviceStats,
        timeStats
      },
      referralChain,
      commissions: postCommissions
    });
  } catch (error) {
    console.error('Post analytics error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;