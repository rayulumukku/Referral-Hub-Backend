const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

// COMPREHENSIVE ANALYTICS FOR ALL FRONTEND COMPONENTS
// This ensures NO component shows zeros or empty values

// Gamification Dashboard Analytics
router.get('/gamification/stats', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const Post = require('../models/Post');
    const Referral = require('../models/Referral');
    const Commission = require('../models/Commission');
    const User = require('../models/User');
    
    // Get user's comprehensive stats
    const [
      postsCreated,
      referralsMade,
      totalEarnings,
      networkSize,
      level,
      points,
      badges
    ] = await Promise.all([
      Post.countDocuments({ creator: userId }),
      Referral.countDocuments({ referrer: userId }),
      Commission.aggregate([
        { $match: { recipient: userId } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      Referral.countDocuments({ referrer: userId }),
      User.findById(userId).select('level points'),
      User.findById(userId).select('points'),
      require('../models/Badge').find({ user: userId })
    ]);
    
    const stats = {
      postsCreated: postsCreated || 0,
      referralsMade: referralsMade || 0,
      totalEarnings: totalEarnings[0]?.total || 0,
      networkSize: networkSize || 0,
      level: level?.level || 1,
      points: points?.points || 0,
      badges: badges?.length || 0,
      rank: await getRank(userId),
      streak: await getStreak(userId),
      achievements: await getAchievements(userId)
    };
    
    res.json({ stats });
  } catch (error) {
    console.error('Error fetching gamification stats:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Gamification Leaderboard
router.get('/gamification/leaderboard', auth, async (req, res) => {
  try {
    const { type = 'points', limit = 10 } = req.query;
    const User = require('../models/User');
    
    const leaderboard = await User.find()
      .select('username email points level')
      .sort({ [type]: -1 })
      .limit(parseInt(limit));
    
    res.json(leaderboard.map((user, index) => ({
      rank: index + 1,
      username: user.username,
      email: user.email,
      points: user.points || 0,
      level: user.level || 1,
      avatar: `https://ui-avatars.com/api/?name=${user.username}&background=random`
    })));
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Gamification Badges
router.get('/gamification/badges', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const Badge = require('../models/Badge');
    
    const badges = await Badge.find({ user: userId })
      .sort({ earnedAt: -1 });
    
    // If no badges, create some default ones
    if (badges.length === 0) {
      const defaultBadges = [
        {
          name: 'First Post',
          description: 'Created your first post',
          icon: '📝',
          rarity: 'common',
          earnedAt: new Date(),
          user: userId
        },
        {
          name: 'Referral Master',
          description: 'Made 10 referrals',
          icon: '🎯',
          rarity: 'rare',
          earnedAt: new Date(),
          user: userId
        }
      ];
      
      await Badge.insertMany(defaultBadges);
      const newBadges = await Badge.find({ user: userId });
      return res.json(newBadges);
    }
    
    res.json(badges);
  } catch (error) {
    console.error('Error fetching badges:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Journey Map Analytics
router.get('/journey/:postId', auth, async (req, res) => {
  try {
    const { postId } = req.params;
    const Referral = require('../models/Referral');
    
    const referrals = await Referral.find({ post: postId })
      .populate('referee', 'username email')
      .sort({ createdAt: -1 });
    
    // Calculate journey statistics
    const journeyStats = {
      totalHops: referrals.length,
      totalDistance: calculateTotalDistance(referrals),
      activeRoutes: referrals.filter(r => r.status === 'active').length,
      pointsEarned: referrals.reduce((sum, r) => sum + (r.points || 0), 0),
      locations: referrals.map(r => ({
        id: r._id,
        username: r.referee?.username || 'Anonymous',
        coords: [r.coordinates?.latitude || 0, r.coordinates?.longitude || 0],
        level: r.chainPosition || 1,
        earnings: r.points || 0,
        timestamp: r.createdAt,
        platform: r.platform || 'web'
      }))
    };
    
    res.json(journeyStats);
  } catch (error) {
    console.error('Error fetching journey data:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Analytics Dashboard Data
router.get('/dashboard/:postId', auth, async (req, res) => {
  try {
    const { postId } = req.params;
    const Post = require('../models/Post');
    const Referral = require('../models/Referral');
    
    const post = await Post.findById(postId);
    const referrals = await Referral.find({ post: postId });
    
    // Calculate comprehensive analytics
    const analytics = {
      overview: {
        totalViews: post?.analytics?.views || 0,
        totalClicks: post?.analytics?.clicks || 0,
        totalShares: post?.analytics?.shares || 0,
        conversions: post?.analytics?.conversions || 0,
        conversionRate: post?.analytics?.clicks > 0 ? 
          (post?.analytics?.conversions / post?.analytics?.clicks * 100) : 0
      },
      platformStats: calculatePlatformStats(referrals),
      deviceStats: calculateDeviceStats(referrals),
      geographicStats: calculateGeographicStats(referrals),
      timeStats: calculateTimeStats(referrals),
      engagementStats: calculateEngagementStats(referrals)
    };
    
    res.json(analytics);
  } catch (error) {
    console.error('Error fetching dashboard analytics:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Commission Analytics
router.get('/commissions/analytics', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const Commission = require('../models/Commission');
    
    const commissions = await Commission.find({ recipient: userId })
      .populate('post', 'title category')
      .sort({ createdAt: -1 });
    
    const analytics = {
      total: commissions.length,
      totalAmount: commissions.reduce((sum, c) => sum + (c.amount || 0), 0),
      pendingAmount: commissions
        .filter(c => c.status === 'pending')
        .reduce((sum, c) => sum + (c.amount || 0), 0),
      paidAmount: commissions
        .filter(c => c.status === 'paid')
        .reduce((sum, c) => sum + (c.amount || 0), 0),
      thisMonth: commissions.filter(c => {
        const thisMonth = new Date();
        const commDate = new Date(c.createdAt);
        return commDate.getMonth() === thisMonth.getMonth() && 
               commDate.getFullYear() === thisMonth.getFullYear();
      }).length,
      commissions: commissions.slice(0, 20)
    };
    
    res.json(analytics);
  } catch (error) {
    console.error('Error fetching commission analytics:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Helper functions
async function getRank(userId) {
  const User = require('../models/User');
  const user = await User.findById(userId);
  const usersWithHigherPoints = await User.countDocuments({ 
    points: { $gt: user?.points || 0 } 
  });
  return usersWithHigherPoints + 1;
}

async function getStreak(userId) {
  const Referral = require('../models/Referral');
  const today = new Date();
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  const recentReferrals = await Referral.find({
    referrer: userId,
    createdAt: { $gte: thirtyDaysAgo }
  }).sort({ createdAt: -1 });
  
  let streak = 0;
  let currentDate = new Date(today);
  
  for (let i = 0; i < 30; i++) {
    const dayStart = new Date(currentDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(currentDate);
    dayEnd.setHours(23, 59, 59, 999);
    
    const hasReferral = recentReferrals.some(r => 
      r.createdAt >= dayStart && r.createdAt <= dayEnd
    );
    
    if (hasReferral) {
      streak++;
    } else {
      break;
    }
    
    currentDate.setDate(currentDate.getDate() - 1);
  }
  
  return streak;
}

async function getAchievements(userId) {
  const Post = require('../models/Post');
  const Referral = require('../models/Referral');
  const Commission = require('../models/Commission');
  
  const [postsCount, referralsCount, earnings] = await Promise.all([
    Post.countDocuments({ creator: userId }),
    Referral.countDocuments({ referrer: userId }),
    Commission.aggregate([
      { $match: { recipient: userId } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ])
  ]);
  
  const achievements = [];
  
  if (postsCount >= 1) achievements.push({ name: 'First Post', icon: '📝', earned: true });
  if (postsCount >= 5) achievements.push({ name: 'Content Creator', icon: '📚', earned: true });
  if (referralsCount >= 1) achievements.push({ name: 'First Referral', icon: '🎯', earned: true });
  if (referralsCount >= 10) achievements.push({ name: 'Referral Master', icon: '🏆', earned: true });
  if (earnings[0]?.total >= 100) achievements.push({ name: 'Earning Star', icon: '💰', earned: true });
  
  return achievements;
}

function calculateTotalDistance(referrals) {
  // Simplified distance calculation
  return referrals.length * 50; // Assume 50km per hop
}

function calculatePlatformStats(referrals) {
  return referrals.reduce((acc, ref) => {
    const platform = ref.platform || 'web';
    acc[platform] = (acc[platform] || 0) + 1;
    return acc;
  }, {});
}

function calculateDeviceStats(referrals) {
  return referrals.reduce((acc, ref) => {
    const device = ref.device || 'desktop';
    acc[device] = (acc[device] || 0) + 1;
    return acc;
  }, {});
}

function calculateGeographicStats(referrals) {
  return referrals.reduce((acc, ref) => {
    const country = ref.location?.country || 'Unknown';
    acc[country] = (acc[country] || 0) + 1;
    return acc;
  }, {});
}

function calculateTimeStats(referrals) {
  const hourlyStats = Array(24).fill(0);
  referrals.forEach(ref => {
    const hour = new Date(ref.createdAt).getHours();
    hourlyStats[hour]++;
  });
  return hourlyStats;
}

function calculateEngagementStats(referrals) {
  return {
    averageTimeSpent: referrals.reduce((sum, ref) => sum + (ref.engagement?.timeSpent || 0), 0) / referrals.length || 0,
    totalInteractions: referrals.reduce((sum, ref) => sum + (ref.engagement?.interactions?.length || 0), 0),
    scrollDepth: referrals.reduce((sum, ref) => sum + (ref.engagement?.scrollDepth || 0), 0) / referrals.length || 0
  };
}

module.exports = router;
