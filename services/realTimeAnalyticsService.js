const User = require('../models/User');
const Post = require('../models/Post');
const Referral = require('../models/Referral');
const ReferralChain = require('../models/ReferralChain');
const Commission = require('../models/Commission');
const Activity = require('../models/Activity');
const Notification = require('../models/Notification');
const PostAnalytics = require('../models/PostAnalytics');
const TrackingEvent = require('../models/TrackingEvent');

class RealTimeAnalyticsService {
  // Get real user analytics
  static async getUserAnalytics(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) throw new Error('User not found');

      // Get user's posts
      const userPosts = await Post.find({ creator: userId });
      const postIds = userPosts.map(p => p._id);

      // Get user's referrals (both made and received)
      const referralsMade = await Referral.find({ referrer: userId })
        .populate('referee', 'username email')
        .populate('post', 'title category')
        .sort({ createdAt: -1 });

      const referralsReceived = await Referral.find({ referee: userId })
        .populate('referrer', 'username email')
        .populate('post', 'title category')
        .sort({ createdAt: -1 });

      // Get user's commissions
      const commissions = await Commission.find({ recipient: userId })
        .populate('post', 'title category')
        .sort({ createdAt: -1 });

      // Get user's activities
      const activities = await Activity.find({ user: userId })
        .sort({ createdAt: -1 })
        .limit(50);

      // Get user's notifications
      const notifications = await Notification.find({ user: userId })
        .sort({ createdAt: -1 })
        .limit(20);

      // Get network growth (direct referrals)
      const networkGrowth = await this.getNetworkGrowth(userId);

      // Get real-time analytics for user's posts
      const postAnalytics = await this.getPostAnalytics(postIds);

      // Get referral chains for user's posts
      const referralChains = await this.getReferralChains(postIds);

      return {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          level: user.gamification?.level || 1,
          points: user.gamification?.totalPoints || 0,
          networkSize: networkGrowth.directReferrals,
          totalEarnings: commissions.reduce((sum, c) => sum + (c.amount || 0), 0)
        },
        posts: userPosts.map(post => ({
          id: post._id,
          title: post.title,
          category: post.category,
          price: post.price,
          status: post.status,
          views: post.analytics?.views || 0,
          clicks: post.analytics?.clicks || 0,
          shares: post.analytics?.shares || 0,
          conversions: post.analytics?.conversions || 0,
          createdAt: post.createdAt
        })),
        referrals: {
          made: referralsMade.map(ref => ({
            id: ref._id,
            referee: ref.referee,
            post: ref.post,
            platform: ref.platform,
            device: ref.device,
            location: ref.location,
            createdAt: ref.createdAt
          })),
          received: referralsReceived.map(ref => ({
            id: ref._id,
            referrer: ref.referrer,
            post: ref.post,
            platform: ref.platform,
            device: ref.device,
            location: ref.location,
            createdAt: ref.createdAt
          }))
        },
        commissions: commissions.map(comm => ({
          id: comm._id,
          post: comm.post,
          amount: comm.amount,
          percentage: comm.percentage,
          status: comm.status,
          createdAt: comm.createdAt
        })),
        activities: activities.map(activity => ({
          id: activity._id,
          type: activity.type,
          description: activity.description,
          metadata: activity.metadata,
          createdAt: activity.createdAt
        })),
        notifications: notifications.map(notif => ({
          id: notif._id,
          type: notif.type,
          title: notif.title,
          message: notif.message,
          read: notif.read,
          createdAt: notif.createdAt
        })),
        networkGrowth,
        postAnalytics,
        referralChains,
        lastUpdated: new Date()
      };
    } catch (error) {
      console.error('Error getting user analytics:', error);
      throw error;
    }
  }

  // Get network growth data
  static async getNetworkGrowth(userId) {
    try {
      // Get direct referrals (level 1)
      const directReferrals = await User.find({ referrer: userId });
      
      // Get indirect referrals (level 2+)
      const indirectReferrals = await this.getIndirectReferrals(userId);

      // Get referral chains
      const referralChains = await ReferralChain.find({
        $or: [
          { originalCreator: userId },
          { chainHead: userId },
          { 'chainMembers.user': userId }
        ]
      }).populate('chainMembers.user', 'username email');

      return {
        directReferrals: directReferrals.length,
        indirectReferrals: indirectReferrals.length,
        totalNetwork: directReferrals.length + indirectReferrals.length,
        referralChains: referralChains.length,
        networkLevel: await this.calculateNetworkLevel(userId),
        recentGrowth: await this.getRecentGrowth(userId)
      };
    } catch (error) {
      console.error('Error getting network growth:', error);
      throw error;
    }
  }

  // Get indirect referrals
  static async getIndirectReferrals(userId, level = 2, maxLevel = 5) {
    if (level > maxLevel) return [];

    const directReferrals = await User.find({ referrer: userId });
    let indirectReferrals = [];

    for (const directRef of directReferrals) {
      const nextLevelRefs = await this.getIndirectReferrals(directRef._id, level + 1, maxLevel);
      indirectReferrals = indirectReferrals.concat(nextLevelRefs);
    }

    return indirectReferrals;
  }

  // Calculate network level
  static async calculateNetworkLevel(userId) {
    const directReferrals = await User.find({ referrer: userId });
    if (directReferrals.length === 0) return 0;
    
    let maxLevel = 1;
    for (const ref of directReferrals) {
      const refLevel = await this.calculateNetworkLevel(ref._id);
      maxLevel = Math.max(maxLevel, refLevel + 1);
    }
    
    return maxLevel;
  }

  // Get recent growth
  static async getRecentGrowth(userId) {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    const recentReferrals = await User.find({
      referrer: userId,
      createdAt: { $gte: oneWeekAgo }
    });

    return {
      thisWeek: recentReferrals.length,
      lastWeek: await this.getLastWeekGrowth(userId),
      growthRate: await this.calculateGrowthRate(userId)
    };
  }

  // Get last week growth
  static async getLastWeekGrowth(userId) {
    const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    const lastWeekReferrals = await User.find({
      referrer: userId,
      createdAt: { $gte: twoWeeksAgo, $lt: oneWeekAgo }
    });

    return lastWeekReferrals.length;
  }

  // Calculate growth rate
  static async calculateGrowthRate(userId) {
    const thisWeek = await this.getRecentGrowth(userId);
    const lastWeek = thisWeek.lastWeek;
    
    if (lastWeek === 0) return thisWeek.thisWeek > 0 ? 100 : 0;
    return ((thisWeek.thisWeek - lastWeek) / lastWeek) * 100;
  }

  // Get post analytics
  static async getPostAnalytics(postIds) {
    try {
      const analytics = {
        totalViews: 0,
        totalClicks: 0,
        totalShares: 0,
        totalConversions: 0,
        platformDistribution: {},
        deviceDistribution: {},
        browserDistribution: {},
        locationDistribution: {},
        timeDistribution: {},
        engagementMetrics: {}
      };

      // Get all analytics for these posts
      const postAnalytics = await PostAnalytics.find({ post: { $in: postIds } });
      
      // Get tracking events
      const trackingEvents = await TrackingEvent.find({ postId: { $in: postIds } });

      // Aggregate data
      postAnalytics.forEach(analytics => {
        analytics.totalViews += analytics.type === 'view' ? 1 : 0;
        analytics.totalClicks += analytics.type === 'click' ? 1 : 0;
        analytics.totalShares += analytics.type === 'share' ? 1 : 0;
        analytics.totalConversions += analytics.type === 'conversion' ? 1 : 0;

        // Platform distribution
        if (analytics.platform) {
          analytics.platformDistribution[analytics.platform] = 
            (analytics.platformDistribution[analytics.platform] || 0) + 1;
        }

        // Device distribution
        if (analytics.device) {
          analytics.deviceDistribution[analytics.device] = 
            (analytics.deviceDistribution[analytics.device] || 0) + 1;
        }

        // Browser distribution
        if (analytics.browser) {
          analytics.browserDistribution[analytics.browser] = 
            (analytics.browserDistribution[analytics.browser] || 0) + 1;
        }

        // Location distribution
        if (analytics.location?.country) {
          analytics.locationDistribution[analytics.location.country] = 
            (analytics.locationDistribution[analytics.location.country] || 0) + 1;
        }

        // Time distribution
        const hour = new Date(analytics.timestamp).getHours();
        analytics.timeDistribution[hour] = (analytics.timeDistribution[hour] || 0) + 1;
      });

      // Calculate engagement metrics
      analytics.engagementMetrics = {
        averageTimeSpent: postAnalytics.reduce((sum, a) => sum + (a.timeSpent || 0), 0) / Math.max(postAnalytics.length, 1),
        averageScrollDepth: postAnalytics.reduce((sum, a) => sum + (a.scrollDepth || 0), 0) / Math.max(postAnalytics.length, 1),
        totalInteractions: analytics.totalClicks + analytics.totalShares,
        engagementRate: analytics.totalViews > 0 ? (analytics.totalClicks / analytics.totalViews) * 100 : 0,
        conversionRate: analytics.totalClicks > 0 ? (analytics.totalConversions / analytics.totalClicks) * 100 : 0
      };

      return analytics;
    } catch (error) {
      console.error('Error getting post analytics:', error);
      throw error;
    }
  }

  // Get referral chains
  static async getReferralChains(postIds) {
    try {
      const chains = await ReferralChain.find({ post: { $in: postIds } })
        .populate('chainMembers.user', 'username email')
        .populate('originalCreator', 'username email')
        .populate('chainHead', 'username email')
        .sort({ createdAt: -1 });

      return chains.map(chain => ({
        id: chain._id,
        postId: chain.post,
        originalCreator: chain.originalCreator,
        chainHead: chain.chainHead,
        members: chain.chainMembers.map(member => ({
          user: member.user,
          position: member.position,
          platform: member.platform,
          device: member.device,
          browser: member.browser,
          location: member.location,
          clickCount: member.clickCount,
          shareCount: member.shareCount,
          engagementScore: member.engagementScore,
          joinedAt: member.joinedAt
        })),
        totalClicks: chain.totalClicks,
        totalShares: chain.totalShares,
        conversionOccurred: chain.conversionOccurred,
        status: chain.status,
        createdAt: chain.createdAt
      }));
    } catch (error) {
      console.error('Error getting referral chains:', error);
      throw error;
    }
  }

  // Get admin analytics for all posts
  static async getAdminAnalytics() {
    try {
      // Get all posts
      const allPosts = await Post.find().populate('creator', 'username email');
      
      // Get all users
      const allUsers = await User.find();
      
      // Get all referrals
      const allReferrals = await Referral.find()
        .populate('referrer', 'username email')
        .populate('referee', 'username email')
        .populate('post', 'title category');

      // Get all commissions
      const allCommissions = await Commission.find()
        .populate('recipient', 'username email')
        .populate('post', 'title category');

      // Get all activities
      const allActivities = await Activity.find()
        .populate('user', 'username email')
        .sort({ createdAt: -1 })
        .limit(100);

      // Get platform-wide analytics
      const platformAnalytics = await this.getPlatformAnalytics();

      return {
        overview: {
          totalUsers: allUsers.length,
          totalPosts: allPosts.length,
          totalReferrals: allReferrals.length,
          totalCommissions: allCommissions.length,
          totalRevenue: allCommissions.reduce((sum, c) => sum + (c.amount || 0), 0)
        },
        posts: allPosts.map(post => ({
          id: post._id,
          title: post.title,
          creator: post.creator,
          category: post.category,
          price: post.price,
          status: post.status,
          views: post.analytics?.views || 0,
          clicks: post.analytics?.clicks || 0,
          shares: post.analytics?.shares || 0,
          conversions: post.analytics?.conversions || 0,
          createdAt: post.createdAt
        })),
        users: allUsers.map(user => ({
          id: user._id,
          username: user.username,
          email: user.email,
          level: user.gamification?.level || 1,
          points: user.gamification?.totalPoints || 0,
          networkSize: user.network?.directReferrals?.length || 0,
          totalEarnings: 0 // Will be calculated separately
        })),
        referrals: allReferrals,
        commissions: allCommissions,
        activities: allActivities,
        platformAnalytics,
        lastUpdated: new Date()
      };
    } catch (error) {
      console.error('Error getting admin analytics:', error);
      throw error;
    }
  }

  // Get platform analytics
  static async getPlatformAnalytics() {
    try {
      const analytics = {
        totalViews: 0,
        totalClicks: 0,
        totalShares: 0,
        totalConversions: 0,
        platformDistribution: {},
        deviceDistribution: {},
        browserDistribution: {},
        locationDistribution: {},
        timeDistribution: {},
        engagementMetrics: {}
      };

      // Get all post analytics
      const allPostAnalytics = await PostAnalytics.find();
      
      // Get all tracking events
      const allTrackingEvents = await TrackingEvent.find();

      // Aggregate data
      allPostAnalytics.forEach(analytics => {
        analytics.totalViews += analytics.type === 'view' ? 1 : 0;
        analytics.totalClicks += analytics.type === 'click' ? 1 : 0;
        analytics.totalShares += analytics.type === 'share' ? 1 : 0;
        analytics.totalConversions += analytics.type === 'conversion' ? 1 : 0;

        // Platform distribution
        if (analytics.platform) {
          analytics.platformDistribution[analytics.platform] = 
            (analytics.platformDistribution[analytics.platform] || 0) + 1;
        }

        // Device distribution
        if (analytics.device) {
          analytics.deviceDistribution[analytics.device] = 
            (analytics.deviceDistribution[analytics.device] || 0) + 1;
        }

        // Browser distribution
        if (analytics.browser) {
          analytics.browserDistribution[analytics.browser] = 
            (analytics.browserDistribution[analytics.browser] || 0) + 1;
        }

        // Location distribution
        if (analytics.location?.country) {
          analytics.locationDistribution[analytics.location.country] = 
            (analytics.locationDistribution[analytics.location.country] || 0) + 1;
        }

        // Time distribution
        const hour = new Date(analytics.timestamp).getHours();
        analytics.timeDistribution[hour] = (analytics.timeDistribution[hour] || 0) + 1;
      });

      // Calculate engagement metrics
      analytics.engagementMetrics = {
        averageTimeSpent: allPostAnalytics.reduce((sum, a) => sum + (a.timeSpent || 0), 0) / Math.max(allPostAnalytics.length, 1),
        averageScrollDepth: allPostAnalytics.reduce((sum, a) => sum + (a.scrollDepth || 0), 0) / Math.max(allPostAnalytics.length, 1),
        totalInteractions: analytics.totalClicks + analytics.totalShares,
        engagementRate: analytics.totalViews > 0 ? (analytics.totalClicks / analytics.totalViews) * 100 : 0,
        conversionRate: analytics.totalClicks > 0 ? (analytics.totalConversions / analytics.totalClicks) * 100 : 0
      };

      return analytics;
    } catch (error) {
      console.error('Error getting platform analytics:', error);
      throw error;
    }
  }

  // Create notification for new post
  static async createPostNotification(postId, creatorId) {
    try {
      // Get all users except the creator
      const allUsers = await User.find({ _id: { $ne: creatorId } });
      
      // Create notifications for all users
      const notifications = allUsers.map(user => ({
        user: user._id,
        type: 'new_post',
        title: 'New Post Available',
        message: 'A new post has been created on the platform',
        metadata: {
          postId,
          creatorId
        }
      }));

      await Notification.insertMany(notifications);
      
      // Emit real-time notification
      const io = require('../server').getIo();
      if (io) {
        io.emit('new_post_notification', {
          postId,
          creatorId,
          timestamp: new Date()
        });
      }
    } catch (error) {
      console.error('Error creating post notification:', error);
      throw error;
    }
  }

  // Track real-time activity
  static async trackActivity(userId, type, description, metadata = {}) {
    try {
      const activity = new Activity({
        user: userId,
        type,
        description,
        metadata
      });

      await activity.save();

      // Emit real-time update
      const io = require('../server').getIo();
      if (io) {
        io.to(`user_${userId}`).emit('activity_update', {
          type: 'new_activity',
          activity: {
            id: activity._id,
            type: activity.type,
            description: activity.description,
            timestamp: activity.createdAt
          }
        });
      }

      return activity;
    } catch (error) {
      console.error('Error tracking activity:', error);
      throw error;
    }
  }
}

module.exports = RealTimeAnalyticsService;