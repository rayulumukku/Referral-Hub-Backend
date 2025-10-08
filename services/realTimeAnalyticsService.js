const User = require('../models/User');
const Post = require('../models/Post');
const Referral = require('../models/Referral');
const ReferralChain = require('../models/ReferralChain');
const Commission = require('../models/Commission');
const Activity = require('../models/Activity');
const Notification = require('../models/Notification');
const PostAnalytics = require('../models/PostAnalytics');
const TrackingEvent = require('../models/TrackingEvent');
const dashboardCache = require('./dashboardCache');

class RealTimeAnalyticsService {
  // Get real user analytics - OPTIMIZED VERSION WITH CACHE
  static async getUserAnalytics(userId) {
    try {
      // Check cache first
      const cachedData = dashboardCache.get(userId);
      if (cachedData) {
        console.log(`Cache hit for user ${userId}`);
        return cachedData;
      }

      console.log(`Cache miss for user ${userId}, fetching from database...`);
      
      // Use aggregation pipeline for better performance
      const user = await User.findById(userId).select('username email gamification network');
      if (!user) throw new Error('User not found');

      // Execute all queries in parallel with limits
      const [
        userPosts,
        referralsMade,
        referralsReceived,
        commissions,
        activities,
        notifications,
        networkStats
      ] = await Promise.all([
        // User posts with basic info only
        Post.find({ creator: userId })
          .select('title category price status analytics createdAt')
          .sort({ createdAt: -1 })
          .limit(20),
        
        // Referrals made with minimal data
        Referral.find({ referrer: userId })
          .select('referee post platform device location createdAt')
        .populate('referee', 'username email')
        .populate('post', 'title category')
          .sort({ createdAt: -1 })
          .limit(10),

        // Referrals received with minimal data
        Referral.find({ referee: userId })
          .select('referrer post platform device location createdAt')
        .populate('referrer', 'username email')
        .populate('post', 'title category')
          .sort({ createdAt: -1 })
          .limit(10),

        // Commissions with minimal data
        Commission.find({ recipient: userId })
          .select('post amount percentage status createdAt')
        .populate('post', 'title category')
          .sort({ createdAt: -1 })
          .limit(20),

        // Activities with limit
        Activity.find({ user: userId })
          .select('type description metadata createdAt')
        .sort({ createdAt: -1 })
          .limit(20),

        // Notifications with limit
        Notification.find({ user: userId })
          .select('type title message read createdAt')
        .sort({ createdAt: -1 })
          .limit(10),
        
        // Simplified network stats
        this.getNetworkStatsOptimized(userId)
      ]);

      const postIds = userPosts.map(p => p._id);
      
      // Get simplified analytics for posts (parallel)
      const [postAnalytics, referralChains] = await Promise.all([
        this.getPostAnalyticsOptimized(postIds),
        this.getReferralChainsOptimized(postIds)
      ]);

      // Calculate total earnings efficiently
      const totalEarnings = commissions.reduce((sum, c) => sum + (c.amount || 0), 0);

      return {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          level: user.gamification?.level || 1,
          points: user.gamification?.totalPoints || 0,
          networkSize: networkStats.directReferrals,
          totalEarnings
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
        networkGrowth: networkStats,
        postAnalytics,
        referralChains,
        lastUpdated: new Date()
      };

      // Cache the result
      dashboardCache.set(userId, result);
      console.log(`Cached analytics for user ${userId}`);

      return result;
    } catch (error) {
      console.error('Error getting user analytics:', error);
      throw error;
    }
  }

  // Optimized network stats - no recursive calls
  static async getNetworkStatsOptimized(userId) {
    try {
      // Get only direct referrals count (much faster)
      const directReferralsCount = await User.countDocuments({ referrer: userId });
      
      // Get recent growth (last 7 days)
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const recentReferralsCount = await User.countDocuments({
        referrer: userId,
        createdAt: { $gte: oneWeekAgo }
      });

      return {
        directReferrals: directReferralsCount,
        indirectReferrals: 0, // Skip for performance
        totalNetwork: directReferralsCount,
        networkLevel: 1, // Simplified
        recentGrowth: {
          thisWeek: recentReferralsCount,
          lastWeek: 0, // Skip for performance
          growthRate: 0 // Skip for performance
        }
      };
    } catch (error) {
      console.error('Error getting optimized network stats:', error);
      return {
        directReferrals: 0,
        indirectReferrals: 0,
        totalNetwork: 0,
        networkLevel: 1,
        recentGrowth: { thisWeek: 0, lastWeek: 0, growthRate: 0 }
      };
    }
  }

  // Get network growth data (original method - kept for compatibility)
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

  // Optimized post analytics - simplified version
  static async getPostAnalyticsOptimized(postIds) {
    try {
      if (!postIds || postIds.length === 0) {
        return {
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
      }

      // Use aggregation pipeline for better performance
      const analytics = await PostAnalytics.aggregate([
        { $match: { post: { $in: postIds } } },
        {
          $group: {
            _id: null,
            totalViews: { $sum: { $cond: [{ $eq: ['$type', 'view'] }, 1, 0] } },
            totalClicks: { $sum: { $cond: [{ $eq: ['$type', 'click'] }, 1, 0] } },
            totalShares: { $sum: { $cond: [{ $eq: ['$type', 'share'] }, 1, 0] } },
            totalConversions: { $sum: { $cond: [{ $eq: ['$type', 'conversion'] }, 1, 0] } },
            platforms: { $push: '$platform' },
            devices: { $push: '$device' },
            browsers: { $push: '$browser' }
          }
        }
      ]);

      const result = analytics[0] || {
        totalViews: 0,
        totalClicks: 0,
        totalShares: 0,
        totalConversions: 0,
        platforms: [],
        devices: [],
        browsers: []
      };

      // Calculate distributions efficiently
      const platformDistribution = {};
      result.platforms.forEach(p => {
        if (p) platformDistribution[p] = (platformDistribution[p] || 0) + 1;
      });

      const deviceDistribution = {};
      result.devices.forEach(d => {
        if (d) deviceDistribution[d] = (deviceDistribution[d] || 0) + 1;
      });

      const browserDistribution = {};
      result.browsers.forEach(b => {
        if (b) browserDistribution[b] = (browserDistribution[b] || 0) + 1;
      });

      return {
        totalViews: result.totalViews,
        totalClicks: result.totalClicks,
        totalShares: result.totalShares,
        totalConversions: result.totalConversions,
        platformDistribution,
        deviceDistribution,
        browserDistribution,
        locationDistribution: {},
        timeDistribution: {},
        engagementMetrics: {
          averageTimeSpent: 0,
          averageScrollDepth: 0,
          totalInteractions: result.totalClicks + result.totalShares,
          engagementRate: result.totalViews > 0 ? (result.totalClicks / result.totalViews) * 100 : 0,
          conversionRate: result.totalClicks > 0 ? (result.totalConversions / result.totalClicks) * 100 : 0
        }
      };
    } catch (error) {
      console.error('Error getting optimized post analytics:', error);
      return {
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
    }
  }

  // Get post analytics (original method - kept for compatibility)
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

  // Optimized referral chains - simplified version
  static async getReferralChainsOptimized(postIds) {
    try {
      if (!postIds || postIds.length === 0) {
        return [];
      }

      // Get only basic chain info without heavy population
      const chains = await ReferralChain.find({ post: { $in: postIds } })
        .select('post originalCreator chainHead totalClicks totalShares conversionOccurred status createdAt')
        .sort({ createdAt: -1 })
        .limit(10); // Limit for performance

      return chains.map(chain => ({
        id: chain._id,
        postId: chain.post,
        originalCreator: chain.originalCreator,
        chainHead: chain.chainHead,
        members: [], // Skip for performance
        totalClicks: chain.totalClicks || 0,
        totalShares: chain.totalShares || 0,
        conversionOccurred: chain.conversionOccurred || false,
        status: chain.status || 'active',
        createdAt: chain.createdAt
      }));
    } catch (error) {
      console.error('Error getting optimized referral chains:', error);
      return [];
    }
  }

  // Get referral chains (original method - kept for compatibility)
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

      // Invalidate cache for this user
      dashboardCache.invalidate(userId);

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

  // Cache invalidation methods
  static invalidateUserCache(userId) {
    dashboardCache.invalidate(userId);
  }

  static clearAllCache() {
    dashboardCache.clear();
  }

  static getCacheStats() {
    return dashboardCache.getStats();
  }
}

module.exports = RealTimeAnalyticsService;