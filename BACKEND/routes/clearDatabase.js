const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Post = require('../models/Post');
const Referral = require('../models/Referral');
const ReferralChain = require('../models/ReferralChain');
const Commission = require('../models/Commission');
const Activity = require('../models/Activity');
const auth = require('../middleware/auth');

// DANGER: This will clear all data except admin users
router.post('/clear-all-data', auth, async (req, res) => {
  try {
    // Only allow admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin only' });
    }

    console.log('⚠️  CLEARING ALL DATA (except admin users)...');

    // Delete all collections except keep admin users
    await Post.deleteMany({});
    await Referral.deleteMany({});
    await ReferralChain.deleteMany({});
    await Commission.deleteMany({});
    await Activity.deleteMany({});
    
    // Delete non-admin users
    await User.deleteMany({ role: { $ne: 'admin' } });

    console.log('✅ All data cleared!');

    res.json({
      success: true,
      message: 'All data cleared. Fresh start!',
      remaining: {
        admins: await User.countDocuments({ role: 'admin' })
      }
    });
  } catch (error) {
    console.error('Error clearing data:', error);
    res.status(500).json({ message: 'Error clearing data', error: error.message });
  }
});

// Get REAL current stats
router.get('/real-stats', auth, async (req, res) => {
  try {
    const stats = {
      users: await User.countDocuments(),
      posts: await Post.countDocuments(),
      referrals: await Referral.countDocuments(),
      chains: await ReferralChain.countDocuments(),
      conversions: await Post.aggregate([
        { $group: { _id: null, total: { $sum: '$conversions' } } }
      ]),
      totalViews: await Post.aggregate([
        { $group: { _id: null, total: { $sum: '$analytics.views' } } }
      ]),
      totalShares: await Post.aggregate([
        { $group: { _id: null, total: { $sum: '$analytics.shares' } } }
      ]),
      recentPosts: await Post.find().sort({ createdAt: -1 }).limit(5).select('title createdAt analytics'),
      recentChains: await ReferralChain.find().sort({ createdAt: -1 }).limit(5).populate('originalSharer', 'username'),
      timestamp: new Date()
    };

    res.json({
      success: true,
      stats,
      message: 'These are REAL stats from database, not dummy data!'
    });
  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({ message: 'Error', error: error.message });
  }
});

module.exports = router;

