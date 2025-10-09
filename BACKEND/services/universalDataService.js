const Post = require('../models/Post');
const User = require('../models/User');
const Referral = require('../models/Referral');
const Commission = require('../models/Commission');
const Activity = require('../models/Activity');
const Notification = require('../models/Notification');
const Badge = require('../models/Badge');
const Like = require('../models/Like');
const Comment = require('../models/Comment');
const Bookmark = require('../models/Bookmark');

class UniversalDataService {
  // Get comprehensive user dashboard data
  static async getUserDashboard(userId) {
    try {
      const [
        user,
        posts,
        referrals,
        commissions,
        activities,
        notifications,
        badges,
        likes,
        comments,
        bookmarks
      ] = await Promise.all([
        User.findById(userId),
        Post.find({ creator: userId }).populate('creator', 'username email'),
        Referral.find({ referrer: userId }).populate('referee', 'username email'),
        Commission.find({ recipient: userId }).populate('post', 'title category'),
        Activity.find({ user: userId }).sort({ createdAt: -1 }).limit(20),
        Notification.find({ user: userId }).sort({ createdAt: -1 }).limit(10),
        Badge.find({ user: userId }),
        Like.find({ user: userId }).populate('post', 'title'),
        Comment.find({ user: userId }).populate('post', 'title'),
        Bookmark.find({ user: userId }).populate('post', 'title')
      ]);

      // Calculate comprehensive analytics
      const analytics = {
        posts: {
          total: posts.length,
          active: posts.filter(p => p.status === 'active').length,
          sold: posts.filter(p => p.status === 'sold').length,
          totalViews: posts.reduce((sum, p) => sum + (p.analytics?.views || 0), 0),
          totalClicks: posts.reduce((sum, p) => sum + (p.analytics?.clicks || 0), 0),
          totalShares: posts.reduce((sum, p) => sum + (p.analytics?.shares || 0), 0),
          totalEarnings: posts.reduce((sum, p) => sum + (p.analytics?.earnings || 0), 0)
        },
        referrals: {
          total: referrals.length,
          today: referrals.filter(r => {
            const today = new Date();
            const refDate = new Date(r.createdAt);
            return refDate.toDateString() === today.toDateString();
          }).length,
          thisWeek: referrals.filter(r => {
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            return new Date(r.createdAt) >= weekAgo;
          }).length,
          platformStats: referrals.reduce((acc, ref) => {
            const platform = ref.platform || 'unknown';
            acc[platform] = (acc[platform] || 0) + 1;
            return acc;
          }, {}),
          deviceStats: referrals.reduce((acc, ref) => {
            const device = ref.device || 'unknown';
            acc[device] = (acc[device] || 0) + 1;
            return acc;
          }, {}),
          locationStats: referrals.reduce((acc, ref) => {
            const country = ref.location?.country || 'Unknown';
            acc[country] = (acc[country] || 0) + 1;
            return acc;
          }, {})
        },
        commissions: {
          total: commissions.length,
          totalAmount: commissions.reduce((sum, c) => sum + (c.amount || 0), 0),
          pendingAmount: commissions.filter(c => c.status === 'pending').reduce((sum, c) => sum + (c.amount || 0), 0),
          paidAmount: commissions.filter(c => c.status === 'paid').reduce((sum, c) => sum + (c.amount || 0), 0),
          thisMonth: commissions.filter(c => {
            const thisMonth = new Date();
            const commDate = new Date(c.createdAt);
            return commDate.getMonth() === thisMonth.getMonth() && 
                   commDate.getFullYear() === thisMonth.getFullYear();
          }).length
        },
        engagement: {
          totalLikes: likes.length,
          totalComments: comments.length,
          totalBookmarks: bookmarks.length,
          recentActivity: activities.slice(0, 10)
        },
        gamification: {
          level: user?.level || 1,
          points: user?.points || 0,
          badges: badges.length,
          rank: await this.calculateRank(userId),
          streak: await this.calculateStreak(userId)
        }
      };

      return {
        user,
        posts: posts.slice(0, 10),
        referrals: referrals.slice(0, 20),
        commissions: commissions.slice(0, 20),
        activities: activities.slice(0, 20),
        notifications: notifications.slice(0, 10),
        badges: badges.slice(0, 10),
        analytics,
        lastUpdated: new Date()
      };
    } catch (error) {
      console.error('Error getting user dashboard:', error);
      throw error;
    }
  }

  // Get comprehensive analytics for a specific post
  static async getPostAnalytics(postId, userId) {
    try {
      const post = await Post.findById(postId).populate('creator', 'username email');
      if (!post) {
        throw new Error('Post not found');
      }

      const [
        referrals,
        commissions,
        likes,
        comments,
        bookmarks,
        activities
      ] = await Promise.all([
        Referral.find({ post: postId }).populate('referrer referee', 'username email'),
        Commission.find({ post: postId }).populate('recipient', 'username'),
        Like.find({ post: postId }).populate('user', 'username'),
        Comment.find({ post: postId }).populate('user', 'username'),
        Bookmark.find({ post: postId }).populate('user', 'username'),
        Activity.find({ metadata: { postId } }).sort({ createdAt: -1 })
      ]);

      const analytics = {
        post: {
          id: post._id,
          title: post.title,
          description: post.description,
          category: post.category,
          price: post.price,
          status: post.status,
          createdAt: post.createdAt,
          creator: post.creator
        },
        overview: {
          totalViews: post.analytics?.views || 0,
          totalClicks: post.analytics?.clicks || 0,
          totalShares: post.analytics?.shares || 0,
          totalLikes: likes.length,
          totalComments: comments.length,
          totalBookmarks: bookmarks.length,
          conversionRate: post.analytics?.clicks > 0 ? 
            ((post.analytics?.conversions || 0) / post.analytics.clicks * 100) : 0
        },
        referrals: {
          total: referrals.length,
          today: referrals.filter(r => {
            const today = new Date();
            const refDate = new Date(r.createdAt);
            return refDate.toDateString() === today.toDateString();
          }).length,
          platformStats: referrals.reduce((acc, ref) => {
            const platform = ref.platform || 'unknown';
            acc[platform] = (acc[platform] || 0) + 1;
            return acc;
          }, {}),
          deviceStats: referrals.reduce((acc, ref) => {
            const device = ref.device || 'unknown';
            acc[device] = (acc[device] || 0) + 1;
            return acc;
          }, {}),
          locationStats: referrals.reduce((acc, ref) => {
            const country = ref.location?.country || 'Unknown';
            acc[country] = (acc[country] || 0) + 1;
            return acc;
          }, {}),
          recentReferrals: referrals.slice(0, 20)
        },
        commissions: {
          total: commissions.length,
          totalAmount: commissions.reduce((sum, c) => sum + (c.amount || 0), 0),
          pendingAmount: commissions.filter(c => c.status === 'pending').reduce((sum, c) => sum + (c.amount || 0), 0),
          paidAmount: commissions.filter(c => c.status === 'paid').reduce((sum, c) => sum + (c.amount || 0), 0),
          recentCommissions: commissions.slice(0, 20)
        },
        engagement: {
          likes: likes.slice(0, 10),
          comments: comments.slice(0, 10),
          bookmarks: bookmarks.slice(0, 10),
          activities: activities.slice(0, 20)
        }
      };

      return analytics;
    } catch (error) {
      console.error('Error getting post analytics:', error);
      throw error;
    }
  }

  // Get comprehensive network analytics
  static async getNetworkAnalytics(userId) {
    try {
      const [
        directReferrals,
        indirectReferrals,
        networkStats
      ] = await Promise.all([
        Referral.find({ referrer: userId, level: 1 }).populate('referee', 'username email'),
        Referral.find({ referrer: userId, level: { $gt: 1 } }).populate('referee', 'username email'),
        this.calculateNetworkStats(userId)
      ]);

      return {
        directReferrals: directReferrals.length,
        indirectReferrals: indirectReferrals.length,
        totalNetwork: directReferrals.length + indirectReferrals.length,
        networkStats,
        recentReferrals: directReferrals.slice(0, 20),
        networkGrowth: await this.calculateNetworkGrowth(userId)
      };
    } catch (error) {
      console.error('Error getting network analytics:', error);
      throw error;
    }
  }

  // Get comprehensive gamification data
  static async getGamificationData(userId) {
    try {
      const [
        user,
        badges,
        achievements,
        leaderboard
      ] = await Promise.all([
        User.findById(userId),
        Badge.find({ user: userId }),
        this.getAchievements(userId),
        this.getLeaderboard()
      ]);

      return {
        user: {
          level: user?.level || 1,
          points: user?.points || 0,
          rank: await this.calculateRank(userId),
          streak: await this.calculateStreak(userId)
        },
        badges: badges.slice(0, 20),
        achievements: achievements,
        leaderboard: leaderboard.slice(0, 10)
      };
    } catch (error) {
      console.error('Error getting gamification data:', error);
      throw error;
    }
  }

  // Helper methods
  static async calculateRank(userId) {
    const user = await User.findById(userId);
    const usersWithHigherPoints = await User.countDocuments({ 
      points: { $gt: user?.points || 0 } 
    });
    return usersWithHigherPoints + 1;
  }

  static async calculateStreak(userId) {
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

  static async getAchievements(userId) {
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

  static async getLeaderboard() {
    return await User.find()
      .select('username email points level')
      .sort({ points: -1 })
      .limit(10);
  }

  static async calculateNetworkStats(userId) {
    const referrals = await Referral.find({ referrer: userId });
    return {
      level1: referrals.filter(r => r.level === 1).length,
      level2: referrals.filter(r => r.level === 2).length,
      level3: referrals.filter(r => r.level === 3).length,
      total: referrals.length
    };
  }

  static async calculateNetworkGrowth(userId) {
    const now = new Date();
    const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const lastMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [thisWeek, lastWeekCount, lastMonthCount] = await Promise.all([
      Referral.countDocuments({ referrer: userId, createdAt: { $gte: lastWeek } }),
      Referral.countDocuments({ referrer: userId, createdAt: { $gte: lastMonth, $lt: lastWeek } }),
      Referral.countDocuments({ referrer: userId, createdAt: { $lt: lastMonth } })
    ]);

    return {
      thisWeek,
      lastWeek: lastWeekCount,
      lastMonth: lastMonthCount,
      growth: lastWeekCount > 0 ? ((thisWeek - lastWeekCount) / lastWeekCount * 100) : 0
    };
  }
}

module.exports = UniversalDataService;
