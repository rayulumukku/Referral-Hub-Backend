const Badge = require('../models/Badge');
const User = require('../models/User');
const NotificationService = require('./notificationService');

class GamificationService {
  // Initialize default badges
  static async initializeBadges() {
    const defaultBadges = [
      {
        name: 'First Steps',
        description: 'Create your first post',
        icon: '🎯',
        category: 'achievement',
        criteria: { type: 'posts_created', value: 1 },
        rarity: 'common',
        points: 10,
      },
      {
        name: 'Social Butterfly',
        description: 'Get your first referral',
        icon: '🦋',
        category: 'referral',
        criteria: { type: 'referrals_count', value: 1 },
        rarity: 'common',
        points: 15,
      },
      {
        name: 'Network Builder',
        description: 'Build a network of 5 referrals',
        icon: '🌐',
        category: 'referral',
        criteria: { type: 'network_size', value: 5 },
        rarity: 'rare',
        points: 50,
      },
      {
        name: 'Commission Collector',
        description: 'Earn your first commission',
        icon: '💰',
        category: 'earning',
        criteria: { type: 'earnings_amount', value: 1 },
        rarity: 'common',
        points: 25,
      },
      {
        name: 'Top Earner',
        description: 'Earn 1000 credits in commissions',
        icon: '🏆',
        category: 'earning',
        criteria: { type: 'earnings_amount', value: 1000 },
        rarity: 'epic',
        points: 200,
      },
      {
        name: 'Conversion Master',
        description: 'Achieve 10 successful conversions',
        icon: '🎯',
        category: 'achievement',
        criteria: { type: 'conversions_count', value: 10 },
        rarity: 'rare',
        points: 75,
      },
      {
        name: 'Legendary Network',
        description: 'Build a network of 50 referrals',
        icon: '👑',
        category: 'referral',
        criteria: { type: 'network_size', value: 50 },
        rarity: 'legendary',
        points: 500,
      },
    ];

    for (const badgeData of defaultBadges) {
      await Badge.findOneAndUpdate(
        { name: badgeData.name },
        badgeData,
        { upsert: true, new: true }
      );
    }
  }

  // Check and award badges for user
  static async checkAndAwardBadges(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) return;

      const allBadges = await Badge.find({ isActive: true });
      const earnedBadgeIds = user.badges.map(b => b.badge.toString());

      for (const badge of allBadges) {
        // Skip if already earned
        if (earnedBadgeIds.includes(badge._id.toString())) continue;

        // Check if user qualifies
        const qualifies = await Badge.checkQualification(userId, badge._id);
        if (qualifies) {
          // Award badge
          user.badges.push({
            badge: badge._id,
            earnedAt: new Date(),
          });

          // Add points
          user.gamification.totalPoints += badge.points;

          // Check for level up
          const newLevel = Math.floor(user.gamification.totalPoints / 100) + 1;
          if (newLevel > user.gamification.level) {
            const oldLevel = user.gamification.level;
            user.gamification.level = newLevel;

            // Notify level up
            await NotificationService.notifyLevelUp(user, newLevel);
          }

          await user.save();

          // Send notification
          await NotificationService.notifyBadgeEarned(user, badge.name);

          console.log(`User ${userId} earned badge: ${badge.name}`);
        }
      }
    } catch (error) {
      console.error('Error checking badges:', error);
    }
  }

  // Get leaderboard
  static async getLeaderboard(type = 'points', period = 'all_time', limit = 10) {
    try {
      let pipeline = [];

      switch (type) {
        case 'points':
          pipeline = [
            {
              $project: {
                username: 1,
                email: 1,
                profile: 1,
                score: '$gamification.totalPoints',
                level: '$gamification.level',
                badgesCount: { $size: '$badges' },
              },
            },
            { $sort: { score: -1 } },
            { $limit: limit },
          ];
          break;

        case 'referrals':
          pipeline = [
            {
              $project: {
                username: 1,
                email: 1,
                profile: 1,
                score: { $size: '$network.directReferrals' },
                level: '$gamification.level',
                badgesCount: { $size: '$badges' },
              },
            },
            { $sort: { score: -1 } },
            { $limit: limit },
          ];
          break;

        case 'earnings':
          // This would need to aggregate commissions
          pipeline = [
            {
              $lookup: {
                from: 'commissions',
                localField: '_id',
                foreignField: 'recipient',
                as: 'commissions',
              },
            },
            {
              $project: {
                username: 1,
                email: 1,
                profile: 1,
                score: { $sum: '$commissions.amount' },
                level: '$gamification.level',
                badgesCount: { $size: '$badges' },
              },
            },
            { $sort: { score: -1 } },
            { $limit: limit },
          ];
          break;

        default:
          return [];
      }

      const leaderboard = await User.aggregate(pipeline);
      return leaderboard;
    } catch (error) {
      console.error('Error getting leaderboard:', error);
      return [];
    }
  }

  // Update user streak
  static async updateStreak(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) return;

      const now = new Date();
      const lastActivity = user.gamification.streak.lastActivity;

      if (!lastActivity) {
        // First activity
        user.gamification.streak.current = 1;
        user.gamification.streak.longest = 1;
      } else {
        const daysDiff = Math.floor((now - lastActivity) / (1000 * 60 * 60 * 24));

        if (daysDiff === 1) {
          // Consecutive day
          user.gamification.streak.current += 1;
          if (user.gamification.streak.current > user.gamification.streak.longest) {
            user.gamification.streak.longest = user.gamification.streak.current;
          }
        } else if (daysDiff > 1) {
          // Streak broken
          user.gamification.streak.current = 1;
        }
        // If daysDiff === 0, same day, no change
      }

      user.gamification.streak.lastActivity = now;
      await user.save();
    } catch (error) {
      console.error('Error updating streak:', error);
    }
  }

  // Get user stats for gamification
  static async getUserStats(userId) {
    try {
      const user = await User.findById(userId).populate('badges.badge');
      if (!user) return null;

      // Calculate additional stats
      const Post = require('../models/Post');
      const Referral = require('../models/Referral');
      const Commission = require('../models/Commission');

      const postsCount = await Post.countDocuments({ creator: userId });
      const referralsCount = await Referral.countDocuments({ referrer: userId });
      const commissionsTotal = await Commission.aggregate([
        { $match: { recipient: user._id } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]);

      return {
        user: {
          _id: user._id,
          username: user.username,
          email: user.email,
          profile: user.profile,
        },
        gamification: user.gamification,
        badges: user.badges,
        stats: {
          postsCreated: postsCount,
          referralsMade: referralsCount,
          totalEarnings: commissionsTotal[0]?.total || 0,
          networkSize: user.network.directReferrals.length,
        },
      };
    } catch (error) {
      console.error('Error getting user stats:', error);
      return null;
    }
  }
}

module.exports = GamificationService;