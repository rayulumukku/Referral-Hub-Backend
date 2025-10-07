const User = require('../models/User');
const Post = require('../models/Post');
const Referral = require('../models/Referral');
const Commission = require('../models/Commission');
const Activity = require('../models/Activity');
const Badge = require('../models/Badge');
const Notification = require('../models/Notification');
const Like = require('../models/Like');
const Comment = require('../models/Comment');
const Bookmark = require('../models/Bookmark');
const PostAnalytics = require('../models/PostAnalytics');
const TrackingEvent = require('../models/TrackingEvent');
const ComprehensiveTracking = require('../models/ComprehensiveTracking');

class CEOLevelDataService {
  // Get comprehensive dashboard data for CEO/PM testing
  static async getCompleteDashboardData(userId) {
    try {
      const user = await User.findById(userId).populate('badges.badge');
      
      // Get all user posts with analytics
      const userPosts = await Post.find({ creator: userId })
        .populate('creator', 'username email')
        .sort({ createdAt: -1 });

      // Get all referrals made by user
      const userReferrals = await Referral.find({ referrer: userId })
        .populate('referee', 'username email')
        .populate('post', 'title category price')
        .sort({ createdAt: -1 });

      // Get all commissions for user
      const userCommissions = await Commission.find({ recipient: userId })
        .populate('post', 'title category')
        .populate('referral', 'referee')
        .sort({ createdAt: -1 });

      // Get all activities for user
      const userActivities = await Activity.find({ user: userId })
        .sort({ createdAt: -1 })
        .limit(50);

      // Get all notifications for user
      const userNotifications = await Notification.find({ user: userId })
        .sort({ createdAt: -1 })
        .limit(20);

      // Get all likes for user's posts
      const postLikes = await Like.find({ 
        post: { $in: userPosts.map(p => p._id) } 
      }).populate('user', 'username');

      // Get all comments for user's posts
      const postComments = await Comment.find({ 
        post: { $in: userPosts.map(p => p._id) } 
      }).populate('user', 'username').populate('post', 'title');

      // Get all bookmarks for user's posts
      const postBookmarks = await Bookmark.find({ 
        post: { $in: userPosts.map(p => p._id) } 
      }).populate('user', 'username');

      // Get comprehensive analytics
      const analytics = await this.getComprehensiveAnalytics(userId, userPosts);

      // Get network data
      const networkData = await this.getNetworkData(userId);

      // Get gamification data
      const gamificationData = await this.getGamificationData(userId);

      // Get real-time metrics
      const realTimeData = await this.getRealTimeMetrics(userId);

      // Get geographic analytics
      const geographicData = await this.getGeographicAnalytics(userId);

      // Get device analytics
      const deviceData = await this.getDeviceAnalytics(userId);

      // Get engagement metrics
      const engagementData = await this.getEngagementMetrics(userId);

      // Get AI insights
      const aiInsights = await this.getAIInsights(userId);

      // Get performance metrics
      const performanceData = await this.getPerformanceMetrics(userId);

      return {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          role: user.role,
          status: user.status,
          credits: user.credits,
          profile: user.profile,
          location: user.location,
          gamification: user.gamification,
          badges: user.badges,
          isVerified: user.isVerified,
          kyc: user.kyc,
          network: user.network
        },
        posts: userPosts.map(post => ({
          id: post._id,
          title: post.title,
          description: post.description,
          category: post.category,
          price: post.price,
          originalPrice: post.originalPrice,
          pointsPool: post.pointsPool,
          status: post.status,
          referralLink: post.referralLink,
          qrCode: post.qrCode,
          photos: post.photos,
          soldDetails: post.soldDetails,
          conversions: post.conversions,
          reach: post.reach,
          analytics: post.analytics,
          createdAt: post.createdAt,
          updatedAt: post.updatedAt
        })),
        referrals: userReferrals.map(ref => ({
          id: ref._id,
          post: ref.post,
          referee: ref.referee,
          platform: ref.platform,
          device: ref.device,
          browser: ref.browser,
          location: ref.location,
          coordinates: ref.coordinates,
          createdAt: ref.createdAt,
          chainPosition: ref.chainPosition,
          parentReferral: ref.parentReferral
        })),
        commissions: userCommissions.map(comm => ({
          id: comm._id,
          post: comm.post,
          referral: comm.referral,
          recipient: comm.recipient,
          amount: comm.amount,
          percentage: comm.percentage,
          distributionType: comm.distributionType,
          chainPosition: comm.chainPosition,
          status: comm.status,
          createdAt: comm.createdAt,
          paidAt: comm.paidAt
        })),
        activities: userActivities.map(activity => ({
          id: activity._id,
          type: activity.type,
          description: activity.description,
          metadata: activity.metadata,
          createdAt: activity.createdAt
        })),
        notifications: userNotifications.map(notif => ({
          id: notif._id,
          type: notif.type,
          title: notif.title,
          message: notif.message,
          read: notif.read,
          createdAt: notif.createdAt
        })),
        likes: postLikes.map(like => ({
          id: like._id,
          post: like.post,
          user: like.user,
          createdAt: like.createdAt
        })),
        comments: postComments.map(comment => ({
          id: comment._id,
          post: comment.post,
          user: comment.user,
          content: comment.content,
          createdAt: comment.createdAt
        })),
        bookmarks: postBookmarks.map(bookmark => ({
          id: bookmark._id,
          post: bookmark.post,
          user: bookmark.user,
          createdAt: bookmark.createdAt
        })),
        analytics,
        network: networkData,
        gamification: gamificationData,
        realTime: realTimeData,
        geographic: geographicData,
        device: deviceData,
        engagement: engagementData,
        ai: aiInsights,
        performance: performanceData,
        lastUpdated: new Date()
      };
    } catch (error) {
      console.error('Error getting complete dashboard data:', error);
      throw error;
    }
  }

  // Get comprehensive analytics
  static async getComprehensiveAnalytics(userId, userPosts) {
    const postIds = userPosts.map(p => p._id);
    
    // Get all analytics for user's posts
    const postAnalytics = await PostAnalytics.find({ 
      post: { $in: postIds } 
    });

    // Get all tracking events for user's posts
    const trackingEvents = await TrackingEvent.find({ 
      postId: { $in: postIds } 
    });

    // Calculate comprehensive metrics
    const totalViews = postAnalytics.filter(a => a.type === 'view').length;
    const totalClicks = postAnalytics.filter(a => a.type === 'click').length;
    const totalShares = postAnalytics.filter(a => a.type === 'share').length;
    const totalConversions = postAnalytics.filter(a => a.type === 'conversion').length;

    // Platform distribution
    const platformStats = {};
    postAnalytics.forEach(analytics => {
      if (analytics.platform) {
        platformStats[analytics.platform] = (platformStats[analytics.platform] || 0) + 1;
      }
    });

    // Device distribution
    const deviceStats = {};
    postAnalytics.forEach(analytics => {
      if (analytics.device) {
        deviceStats[analytics.device] = (deviceStats[analytics.device] || 0) + 1;
      }
    });

    // Browser distribution
    const browserStats = {};
    postAnalytics.forEach(analytics => {
      if (analytics.browser) {
        browserStats[analytics.browser] = (browserStats[analytics.browser] || 0) + 1;
      }
    });

    // Geographic distribution
    const geographicStats = {};
    postAnalytics.forEach(analytics => {
      if (analytics.location?.country) {
        geographicStats[analytics.location.country] = (geographicStats[analytics.location.country] || 0) + 1;
      }
    });

    // Time-based analytics (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentAnalytics = postAnalytics.filter(a => a.timestamp >= thirtyDaysAgo);
    
    const timeStats = Array(24).fill(0);
    recentAnalytics.forEach(analytics => {
      const hour = new Date(analytics.timestamp).getHours();
      timeStats[hour]++;
    });

    // Engagement metrics
    const totalTimeSpent = postAnalytics.reduce((sum, a) => sum + (a.timeSpent || 0), 0);
    const avgTimeSpent = totalTimeSpent / Math.max(postAnalytics.length, 1);
    const totalScrollDepth = postAnalytics.reduce((sum, a) => sum + (a.scrollDepth || 0), 0);
    const avgScrollDepth = totalScrollDepth / Math.max(postAnalytics.length, 1);

    return {
      overview: {
        totalViews,
        totalClicks,
        totalShares,
        totalConversions,
        conversionRate: totalClicks > 0 ? (totalConversions / totalClicks * 100).toFixed(2) : 0,
        engagementRate: totalViews > 0 ? (totalClicks / totalViews * 100).toFixed(2) : 0
      },
      platformStats,
      deviceStats,
      browserStats,
      geographicStats,
      timeStats,
      engagement: {
        totalTimeSpent,
        avgTimeSpent,
        totalScrollDepth,
        avgScrollDepth,
        totalInteractions: totalClicks + totalShares
      },
      trends: {
        daily: this.calculateDailyTrends(recentAnalytics),
        weekly: this.calculateWeeklyTrends(recentAnalytics),
        monthly: this.calculateMonthlyTrends(recentAnalytics)
      }
    };
  }

  // Get network data
  static async getNetworkData(userId) {
    const user = await User.findById(userId).populate('network.directReferrals');
    const directReferrals = user.network?.directReferrals || [];
    
    // Get referral chain data
    const referralChains = await Referral.find({ referrer: userId })
      .populate('referee', 'username email')
      .populate('post', 'title');

    return {
      directReferrals: directReferrals.length,
      totalReferrals: referralChains.length,
      networkLevel: user.network?.level || 1,
      referralChains: referralChains.map(ref => ({
        id: ref._id,
        referee: ref.referee,
        post: ref.post,
        platform: ref.platform,
        createdAt: ref.createdAt
      }))
    };
  }

  // Get gamification data
  static async getGamificationData(userId) {
    const user = await User.findById(userId).populate('badges.badge');
    const allBadges = await Badge.find();
    
    return {
      level: user.gamification?.level || 1,
      points: user.gamification?.totalPoints || 0,
      experience: user.gamification?.experience || 0,
      streak: user.gamification?.streak || { current: 0, longest: 0 },
      badges: user.badges || [],
      availableBadges: allBadges.filter(badge => 
        !user.badges.some(userBadge => userBadge.badge._id.toString() === badge._id.toString())
      ),
      achievements: this.calculateAchievements(user)
    };
  }

  // Get real-time metrics
  static async getRealTimeMetrics(userId) {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    
    // Get recent activities
    const recentActivities = await Activity.find({
      user: userId,
      createdAt: { $gte: oneHourAgo }
    });

    // Get recent analytics
    const recentAnalytics = await PostAnalytics.find({
      post: { $in: await Post.find({ creator: userId }).distinct('_id') },
      timestamp: { $gte: oneHourAgo }
    });

    return {
      activeUsers: recentActivities.length,
      liveEvents: recentAnalytics.length,
      conversions: recentAnalytics.filter(a => a.type === 'conversion').length,
      revenue: recentAnalytics.reduce((sum, a) => sum + (a.conversionValue || 0), 0),
      lastHour: {
        views: recentAnalytics.filter(a => a.type === 'view').length,
        clicks: recentAnalytics.filter(a => a.type === 'click').length,
        shares: recentAnalytics.filter(a => a.type === 'share').length
      }
    };
  }

  // Get geographic analytics
  static async getGeographicAnalytics(userId) {
    const userPosts = await Post.find({ creator: userId });
    const postIds = userPosts.map(p => p._id);
    
    const analytics = await PostAnalytics.find({ 
      post: { $in: postIds } 
    });

    // Country distribution
    const countryStats = {};
    analytics.forEach(a => {
      if (a.location?.country) {
        countryStats[a.location.country] = (countryStats[a.location.country] || 0) + 1;
      }
    });

    // City distribution
    const cityStats = {};
    analytics.forEach(a => {
      if (a.location?.city) {
        cityStats[a.location.city] = (cityStats[a.location.city] || 0) + 1;
      }
    });

    return {
      topCountries: Object.entries(countryStats)
        .map(([country, count]) => ({ country, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
      topCities: Object.entries(cityStats)
        .map(([city, count]) => ({ city, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
      totalCountries: Object.keys(countryStats).length,
      totalCities: Object.keys(cityStats).length
    };
  }

  // Get device analytics
  static async getDeviceAnalytics(userId) {
    const userPosts = await Post.find({ creator: userId });
    const postIds = userPosts.map(p => p._id);
    
    const analytics = await PostAnalytics.find({ 
      post: { $in: postIds } 
    });

    // Device distribution
    const deviceStats = {};
    analytics.forEach(a => {
      if (a.device) {
        deviceStats[a.device] = (deviceStats[a.device] || 0) + 1;
      }
    });

    // Browser distribution
    const browserStats = {};
    analytics.forEach(a => {
      if (a.browser) {
        browserStats[a.browser] = (browserStats[a.browser] || 0) + 1;
      }
    });

    // OS distribution
    const osStats = {};
    analytics.forEach(a => {
      if (a.userAgent) {
        const os = this.detectOS(a.userAgent);
        osStats[os] = (osStats[os] || 0) + 1;
      }
    });

    return {
      deviceDistribution: Object.entries(deviceStats)
        .map(([device, count]) => ({ device, count }))
        .sort((a, b) => b.count - a.count),
      browserDistribution: Object.entries(browserStats)
        .map(([browser, count]) => ({ browser, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
      osDistribution: Object.entries(osStats)
        .map(([os, count]) => ({ os, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)
    };
  }

  // Get engagement metrics
  static async getEngagementMetrics(userId) {
    const userPosts = await Post.find({ creator: userId });
    const postIds = userPosts.map(p => p._id);
    
    const analytics = await PostAnalytics.find({ 
      post: { $in: postIds } 
    });

    const totalSessions = analytics.length;
    const totalTimeSpent = analytics.reduce((sum, a) => sum + (a.timeSpent || 0), 0);
    const avgSessionDuration = totalTimeSpent / Math.max(totalSessions, 1);
    const totalScrollDepth = analytics.reduce((sum, a) => sum + (a.scrollDepth || 0), 0);
    const avgScrollDepth = totalScrollDepth / Math.max(totalSessions, 1);
    const totalInteractions = analytics.filter(a => a.type === 'click').length;
    
    // Calculate engagement score (0-100)
    const engagementScore = Math.min(100, Math.round(
      (avgSessionDuration / 60) * 10 + // Time factor
      (avgScrollDepth / 100) * 20 + // Scroll factor
      (totalInteractions / Math.max(totalSessions, 1)) * 10 // Interaction factor
    ));

    return {
      totalSessions,
      avgSessionDuration,
      avgScrollDepth,
      totalInteractions,
      engagementScore
    };
  }

  // Get AI insights
  static async getAIInsights(userId) {
    // Simulate AI analysis based on user data
    const userPosts = await Post.find({ creator: userId });
    const userReferrals = await Referral.find({ referrer: userId });
    
    // User intent analysis (simulated)
    const userIntentDistribution = [
      { intent: 'purchase', count: Math.floor(Math.random() * 100) + 50 },
      { intent: 'information', count: Math.floor(Math.random() * 80) + 30 },
      { intent: 'social', count: Math.floor(Math.random() * 60) + 20 }
    ];

    // Emotion detection (simulated)
    const emotionDistribution = [
      { emotion: 'positive', count: Math.floor(Math.random() * 100) + 70 },
      { emotion: 'neutral', count: Math.floor(Math.random() * 50) + 20 },
      { emotion: 'negative', count: Math.floor(Math.random() * 20) + 5 }
    ];

    return {
      userIntentDistribution,
      emotionDistribution,
      recommendations: [
        {
          type: 'content_optimization',
          title: 'Optimize for Mobile Users',
          description: 'Focus on mobile-first design to increase engagement by 25%',
          priority: 'high'
        },
        {
          type: 'targeting_strategy',
          title: 'Geographic Targeting',
          description: 'Target users in India and US for maximum conversion potential',
          priority: 'medium'
        }
      ]
    };
  }

  // Get performance metrics
  static async getPerformanceMetrics(userId) {
    const userPosts = await Post.find({ creator: userId });
    const postIds = userPosts.map(p => p._id);
    
    const analytics = await PostAnalytics.find({ 
      post: { $in: postIds } 
    });

    // Calculate performance metrics
    const loadTimes = analytics.map(a => a.performance?.loadTime || 0).filter(t => t > 0);
    const avgPageLoadTime = loadTimes.length > 0 ? loadTimes.reduce((sum, t) => sum + t, 0) / loadTimes.length : 0;
    
    const firstPaintTimes = analytics.map(a => a.performance?.firstPaint || 0).filter(t => t > 0);
    const avgFirstContentfulPaint = firstPaintTimes.length > 0 ? firstPaintTimes.reduce((sum, t) => sum + t, 0) / firstPaintTimes.length : 0;
    
    const interactiveTimes = analytics.map(a => a.performance?.domContentLoaded || 0).filter(t => t > 0);
    const avgTimeToInteractive = interactiveTimes.length > 0 ? interactiveTimes.reduce((sum, t) => sum + t, 0) / interactiveTimes.length : 0;
    
    // Calculate performance score (0-100)
    const performanceScore = Math.max(0, Math.min(100, 100 - (avgPageLoadTime / 100)));

    return {
      avgPageLoadTime,
      avgFirstContentfulPaint,
      avgTimeToInteractive,
      performanceScore
    };
  }

  // Helper methods
  static calculateDailyTrends(analytics) {
    const trends = {};
    analytics.forEach(a => {
      const date = a.timestamp.toISOString().split('T')[0];
      trends[date] = (trends[date] || 0) + 1;
    });
    return trends;
  }

  static calculateWeeklyTrends(analytics) {
    const trends = {};
    analytics.forEach(a => {
      const week = this.getWeekNumber(a.timestamp);
      trends[week] = (trends[week] || 0) + 1;
    });
    return trends;
  }

  static calculateMonthlyTrends(analytics) {
    const trends = {};
    analytics.forEach(a => {
      const month = a.timestamp.toISOString().substring(0, 7);
      trends[month] = (trends[month] || 0) + 1;
    });
    return trends;
  }

  static getWeekNumber(date) {
    const d = new Date(date);
    const yearStart = new Date(d.getFullYear(), 0, 1);
    const weekNumber = Math.ceil((((d - yearStart) / 86400000) + yearStart.getDay() + 1) / 7);
    return `${d.getFullYear()}-W${weekNumber}`;
  }

  static calculateAchievements(user) {
    const achievements = [];
    
    if (user.gamification?.totalPoints >= 1000) {
      achievements.push({ name: 'First Milestone', description: 'Earned 1000 points' });
    }
    if (user.gamification?.level >= 5) {
      achievements.push({ name: 'Level Master', description: 'Reached level 5' });
    }
    if (user.network?.directReferrals?.length >= 10) {
      achievements.push({ name: 'Network Builder', description: 'Referred 10+ users' });
    }
    
    return achievements;
  }

  static detectOS(userAgent) {
    if (userAgent.includes('Windows')) return 'Windows';
    if (userAgent.includes('Mac')) return 'macOS';
    if (userAgent.includes('Linux')) return 'Linux';
    if (userAgent.includes('Android')) return 'Android';
    if (userAgent.includes('iOS')) return 'iOS';
    return 'Unknown';
  }
}

module.exports = CEOLevelDataService;
