const Post = require('../models/Post');
const User = require('../models/User');
const Referral = require('../models/Referral');
const Commission = require('../models/Commission');
const Activity = require('../models/Activity');
const Notification = require('../models/Notification');

class RealTimeAnalyticsService {
  // Emit real-time analytics update
  static async emitAnalyticsUpdate(userId, type, data) {
    try {
      const io = require('../server').getIo();
      if (io) {
        io.to(`user_${userId}`).emit('analytics_update', {
          type,
          data,
          timestamp: new Date()
        });
        
        // Also emit global update
        io.emit('global_analytics_update', {
          type,
          userId,
          timestamp: new Date()
        });
      }
    } catch (error) {
      console.error('Error emitting analytics update:', error);
    }
  }

  // Get comprehensive real-time dashboard data
  static async getRealTimeDashboard(userId) {
    try {
      const [
        userStats,
        postStats,
        referralStats,
        commissionStats,
        activityStats,
        networkStats
      ] = await Promise.all([
        this.getUserStats(userId),
        this.getPostStats(userId),
        this.getReferralStats(userId),
        this.getCommissionStats(userId),
        this.getActivityStats(userId),
        this.getNetworkStats(userId)
      ]);

      return {
        user: userStats,
        posts: postStats,
        referrals: referralStats,
        commissions: commissionStats,
        activities: activityStats,
        network: networkStats,
        lastUpdated: new Date()
      };
    } catch (error) {
      console.error('Error getting real-time dashboard:', error);
      throw error;
    }
  }

  // Get user statistics
  static async getUserStats(userId) {
    const user = await User.findById(userId);
    const totalPosts = await Post.countDocuments({ creator: userId });
    const totalReferrals = await Referral.countDocuments({ referrer: userId });
    const totalCommissions = await Commission.countDocuments({ recipient: userId });
    
    return {
      id: user._id,
      username: user.username,
      email: user.email,
      type: user.type,
      credits: user.credits,
      status: user.status,
      totalPosts,
      totalReferrals,
      totalCommissions,
      joinDate: user.createdAt
    };
  }

  // Get post statistics
  static async getPostStats(userId) {
    const posts = await Post.find({ creator: userId }).sort({ createdAt: -1 });
    const totalViews = posts.reduce((sum, post) => sum + (post.analytics?.views || 0), 0);
    const totalShares = posts.reduce((sum, post) => sum + (post.analytics?.shares || 0), 0);
    const totalClicks = posts.reduce((sum, post) => sum + (post.analytics?.clicks || 0), 0);
    const totalConversions = posts.reduce((sum, post) => sum + (post.analytics?.conversions || 0), 0);
    
    return {
      total: posts.length,
      active: posts.filter(p => p.status === 'active').length,
      sold: posts.filter(p => p.status === 'sold').length,
      totalViews,
      totalShares,
      totalClicks,
      totalConversions,
      posts: posts.slice(0, 10) // Latest 10 posts
    };
  }

  // Get referral statistics
  static async getReferralStats(userId) {
    const referrals = await Referral.find({ referrer: userId })
      .populate('post', 'title category')
      .populate('referee', 'username email')
      .sort({ createdAt: -1 });
    
    const platformStats = referrals.reduce((acc, ref) => {
      const platform = ref.platform || 'unknown';
      acc[platform] = (acc[platform] || 0) + 1;
      return acc;
    }, {});
    
    const deviceStats = referrals.reduce((acc, ref) => {
      const device = ref.device || 'unknown';
      acc[device] = (acc[device] || 0) + 1;
      return acc;
    }, {});
    
    return {
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
      platformStats,
      deviceStats,
      referrals: referrals.slice(0, 10) // Latest 10 referrals
    };
  }

  // Get commission statistics
  static async getCommissionStats(userId) {
    const commissions = await Commission.find({ recipient: userId })
      .populate('post', 'title category')
      .populate('referral', 'referee')
      .sort({ createdAt: -1 });
    
    const totalAmount = commissions.reduce((sum, c) => sum + (c.amount || 0), 0);
    const pendingAmount = commissions
      .filter(c => c.status === 'pending')
      .reduce((sum, c) => sum + (c.amount || 0), 0);
    const paidAmount = commissions
      .filter(c => c.status === 'paid')
      .reduce((sum, c) => sum + (c.amount || 0), 0);
    
    return {
      total: commissions.length,
      totalAmount,
      pendingAmount,
      paidAmount,
      today: commissions.filter(c => {
        const today = new Date();
        const commDate = new Date(c.createdAt);
        return commDate.toDateString() === today.toDateString();
      }).length,
      commissions: commissions.slice(0, 10) // Latest 10 commissions
    };
  }

  // Get activity statistics
  static async getActivityStats(userId) {
    const activities = await Activity.find({ user: userId })
      .populate('post', 'title')
      .populate('referral', 'referrer')
      .sort({ createdAt: -1 })
      .limit(50);
    
    const activityTypes = activities.reduce((acc, activity) => {
      const type = activity.type || 'unknown';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});
    
    return {
      total: activities.length,
      today: activities.filter(a => {
        const today = new Date();
        const actDate = new Date(a.createdAt);
        return actDate.toDateString() === today.toDateString();
      }).length,
      activityTypes,
      activities: activities.slice(0, 20) // Latest 20 activities
    };
  }

  // Get network statistics
  static async getNetworkStats(userId) {
    const level1 = await Referral.countDocuments({ referrer: userId });
    const level1Referees = await Referral.distinct('referee', { referrer: userId });
    const level2 = await Referral.countDocuments({ 
      referrer: { $in: level1Referees }
    });
    const level2Referees = await Referral.distinct('referee', { 
      referrer: { $in: level1Referees }
    });
    const level3 = await Referral.countDocuments({ 
      referrer: { $in: level2Referees }
    });
    
    return {
      level1,
      level2,
      level3,
      total: level1 + level2 + level3,
      networkGrowth: {
        today: await Referral.countDocuments({
          referrer: userId,
          createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) }
        }),
        thisWeek: await Referral.countDocuments({
          referrer: userId,
          createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
        })
      }
    };
  }

  // Update analytics when new referral is created
  static async onNewReferral(referralId) {
    try {
      const referral = await Referral.findById(referralId)
        .populate('post', 'creator')
        .populate('referrer', 'username');
      
      if (referral) {
        // Emit to post creator
        await this.emitAnalyticsUpdate(referral.post.creator._id, 'new_referral', {
          referralId: referral._id,
          referrer: referral.referrer.username,
          platform: referral.platform,
          timestamp: referral.createdAt
        });
        
        // Emit to referrer
        await this.emitAnalyticsUpdate(referral.referrer._id, 'referral_created', {
          referralId: referral._id,
          post: referral.post.title,
          platform: referral.platform,
          timestamp: referral.createdAt
        });
      }
    } catch (error) {
      console.error('Error updating analytics for new referral:', error);
    }
  }

  // Update analytics when commission is created
  static async onNewCommission(commissionId) {
    try {
      const commission = await Commission.findById(commissionId)
        .populate('recipient', 'username')
        .populate('post', 'title');
      
      if (commission) {
        await this.emitAnalyticsUpdate(commission.recipient._id, 'new_commission', {
          commissionId: commission._id,
          amount: commission.amount,
          post: commission.post.title,
          timestamp: commission.createdAt
        });
      }
    } catch (error) {
      console.error('Error updating analytics for new commission:', error);
    }
  }
}

module.exports = RealTimeAnalyticsService;
