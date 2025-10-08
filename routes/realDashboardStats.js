const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Post = require('../models/Post');
const ReferralChain = require('../models/ReferralChain');
const Referral = require('../models/Referral');
const Commission = require('../models/Commission');
const auth = require('../middleware/auth');

// Get REAL dashboard stats for a user
router.get('/user-stats', auth, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get user's posts
    const userPosts = await Post.find({ creator: userId });
    const postIds = userPosts.map(p => p._id);

    // Calculate REAL stats
    const stats = {
      // User's posts
      totalPosts: userPosts.length,
      
      // Views and Shares from user's posts
      totalViews: userPosts.reduce((sum, post) => sum + (post.analytics?.views || 0), 0),
      totalShares: userPosts.reduce((sum, post) => sum + (post.analytics?.shares || 0), 0),
      totalConversions: userPosts.reduce((sum, post) => sum + (post.conversions || 0), 0),
      
      // Referral chains where user is involved
      chainsAsOriginalSharer: await ReferralChain.countDocuments({ originalSharer: userId }),
      chainsAsParticipant: await ReferralChain.countDocuments({ 'chain.userId': userId }),
      
      // Total people in user's chains
      totalPeopleReferred: await ReferralChain.aggregate([
        { $match: { originalSharer: userId } },
        { $project: { chainLength: { $size: '$chain' } } },
        { $group: { _id: null, total: { $sum: '$chainLength' } } }
      ]),
      
      // Referrals
      totalReferrals: await Referral.countDocuments({ referrer: userId }),
      
      // ✅ COMMISSION EARNINGS (in points/credits)
      totalCommissionEarnings: await Commission.aggregate([
        { $match: { recipient: userId } },
        { $group: { _id: null, totalEarned: { $sum: '$amount' } } }
      ]).then(result => result[0]?.totalEarned || 0),
      
      totalCommissions: await Commission.countDocuments({ recipient: userId }),
      
      // Recent posts
      recentPosts: await Post.find({ creator: userId })
        .sort({ createdAt: -1 })
        .limit(10)
        .select('title createdAt analytics conversions status photos category price originalPrice'),
      
      // Platform wide stats (for reference)
      platformStats: {
        totalUsers: await User.countDocuments(),
        totalPosts: await Post.countDocuments(),
        totalChains: await ReferralChain.countDocuments()
      }
    };

    // Calculate conversion rate
    stats.conversionRate = stats.totalViews > 0 
      ? ((stats.totalConversions / stats.totalViews) * 100).toFixed(2)
      : '0.00';

    res.json({
      success: true,
      stats,
      message: 'Real stats from database - NO dummy data!',
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Error getting user stats:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching stats',
      error: error.message 
    });
  }
});

module.exports = router;

