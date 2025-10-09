const ComprehensiveTracking = require('../models/ComprehensiveTracking');
const User = require('../models/User');
const Post = require('../models/Post');
const Referral = require('../models/Referral');
const Commission = require('../models/Commission');

class ExpertAnalyticsService {
  // Real-time dashboard analytics
  static async getRealTimeDashboard(userId) {
    try {
      const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      // Get comprehensive analytics
      const [
        userStats,
        postStats,
        referralStats,
        commissionStats,
        engagementStats,
        locationStats,
        deviceStats,
        performanceStats,
        conversionFunnel,
        aiInsights
      ] = await Promise.all([
        this.getUserStats(userId, last24Hours),
        this.getPostStats(userId, last24Hours),
        this.getReferralStats(userId, last24Hours),
        this.getCommissionStats(userId, last24Hours),
        this.getEngagementStats(userId, last24Hours),
        this.getLocationStats(userId, last24Hours),
        this.getDeviceStats(userId, last24Hours),
        this.getPerformanceStats(userId, last24Hours),
        this.getConversionFunnel(userId, last24Hours),
        this.getAIInsights(userId, last24Hours)
      ]);

      return {
        overview: {
          totalUsers: userStats.totalUsers,
          activeUsers: userStats.activeUsers,
          newUsers: userStats.newUsers,
          totalPosts: postStats.totalPosts,
          activePosts: postStats.activePosts,
          totalReferrals: referralStats.totalReferrals,
          totalCommissions: commissionStats.totalCommissions,
          totalRevenue: commissionStats.totalRevenue
        },
        engagement: engagementStats,
        location: locationStats,
        device: deviceStats,
        performance: performanceStats,
        conversion: conversionFunnel,
        ai: aiInsights,
        realTime: {
          activeSessions: await this.getActiveSessions(),
          liveEvents: await this.getLiveEvents(),
          trendingContent: await this.getTrendingContent(),
          hotSpots: await this.getHotSpots()
        }
      };
    } catch (error) {
      console.error('Error getting real-time dashboard:', error);
      throw error;
    }
  }

  // User statistics
  static async getUserStats(userId, timeRange) {
    const user = await User.findById(userId);
    const network = await this.calculateUserNetwork(userId);
    
    return {
      totalUsers: await User.countDocuments(),
      activeUsers: await User.countDocuments({ 
        lastActive: { $gte: timeRange } 
      }),
      newUsers: await User.countDocuments({ 
        createdAt: { $gte: timeRange } 
      }),
      userNetwork: network,
      userProfile: {
        level: user?.level || 1,
        credits: user?.credits || 0,
        badges: user?.badges?.length || 0,
        totalEarnings: user?.totalEarnings || 0,
        networkSize: network.totalMembers,
        influenceScore: await this.calculateInfluenceScore(userId)
      }
    };
  }

  // Post statistics
  static async getPostStats(userId, timeRange) {
    const userPosts = await Post.find({ creator: userId });
    const totalViews = userPosts.reduce((sum, post) => sum + (post.analytics?.views || 0), 0);
    const totalShares = userPosts.reduce((sum, post) => sum + (post.analytics?.shares || 0), 0);
    const totalConversions = userPosts.reduce((sum, post) => sum + (post.conversions || 0), 0);
    
    return {
      totalPosts: userPosts.length,
      activePosts: userPosts.filter(p => p.status === 'active').length,
      totalViews,
      totalShares,
      totalConversions,
      avgEngagement: totalViews > 0 ? (totalShares / totalViews) * 100 : 0,
      topPerformingPosts: await this.getTopPerformingPosts(userId),
      postCategories: await this.getPostCategories(userId),
      postPerformance: await this.getPostPerformance(userId)
    };
  }

  // Referral statistics
  static async getReferralStats(userId, timeRange) {
    const referrals = await Referral.find({ referrer: userId });
    const totalClicks = referrals.reduce((sum, r) => sum + (r.engagement?.totalClicks || 0), 0);
    const totalShares = referrals.reduce((sum, r) => sum + (r.engagement?.shares || 0), 0);
    const conversions = referrals.filter(r => r.conversion?.converted).length;
    
    return {
      totalReferrals: referrals.length,
      totalClicks,
      totalShares,
      conversions,
      conversionRate: referrals.length > 0 ? (conversions / referrals.length) * 100 : 0,
      referralChains: await this.getReferralChains(userId),
      topReferrers: await this.getTopReferrers(userId),
      referralSources: await this.getReferralSources(userId),
      referralJourney: await this.getReferralJourney(userId)
    };
  }

  // Commission statistics
  static async getCommissionStats(userId, timeRange) {
    const commissions = await Commission.find({ recipient: userId });
    const totalEarnings = commissions.reduce((sum, c) => sum + c.amount, 0);
    const pendingCommissions = commissions.filter(c => c.status === 'pending');
    const paidCommissions = commissions.filter(c => c.status === 'paid');
    
    return {
      totalCommissions: commissions.length,
      totalRevenue: totalEarnings,
      pendingAmount: pendingCommissions.reduce((sum, c) => sum + c.amount, 0),
      paidAmount: paidCommissions.reduce((sum, c) => sum + c.amount, 0),
      avgCommission: commissions.length > 0 ? totalEarnings / commissions.length : 0,
      commissionTrend: await this.getCommissionTrend(userId),
      topEarningPosts: await this.getTopEarningPosts(userId),
      commissionDistribution: await this.getCommissionDistribution(userId)
    };
  }

  // Engagement statistics
  static async getEngagementStats(userId, timeRange) {
    const trackingData = await ComprehensiveTracking.find({
      userId,
      'session.startTime': { $gte: timeRange }
    });

    const totalSessions = trackingData.length;
    const totalTimeSpent = trackingData.reduce((sum, t) => sum + (t.session.duration || 0), 0);
    const avgSessionDuration = totalSessions > 0 ? totalTimeSpent / totalSessions : 0;
    const totalInteractions = trackingData.reduce((sum, t) => sum + (t.engagement.clicks?.length || 0), 0);
    const avgScrollDepth = trackingData.reduce((sum, t) => sum + (t.engagement.maxScrollDepth || 0), 0) / totalSessions;

    return {
      totalSessions,
      totalTimeSpent,
      avgSessionDuration,
      totalInteractions,
      avgScrollDepth,
      engagementScore: await this.calculateEngagementScore(userId),
      userBehavior: await this.getUserBehavior(userId),
      contentEngagement: await this.getContentEngagement(userId),
      socialEngagement: await this.getSocialEngagement(userId)
    };
  }

  // Location statistics
  static async getLocationStats(userId, timeRange) {
    const trackingData = await ComprehensiveTracking.find({
      userId,
      'session.startTime': { $gte: timeRange }
    });

    const locations = {};
    const countries = {};
    const cities = {};
    const timezones = {};

    trackingData.forEach(track => {
      if (track.location?.address?.country) {
        countries[track.location.address.country] = (countries[track.location.address.country] || 0) + 1;
      }
      if (track.location?.address?.city) {
        cities[track.location.address.city] = (cities[track.location.address.city] || 0) + 1;
      }
      if (track.location?.address?.timezone) {
        timezones[track.location.address.timezone] = (timezones[track.location.address.timezone] || 0) + 1;
      }
    });

    return {
      topCountries: Object.entries(countries)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([country, count]) => ({ country, count })),
      topCities: Object.entries(cities)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([city, count]) => ({ city, count })),
      timezoneDistribution: Object.entries(timezones)
        .sort(([,a], [,b]) => b - a)
        .map(([timezone, count]) => ({ timezone, count })),
      geographicHeatmap: await this.getGeographicHeatmap(userId),
      locationInsights: await this.getLocationInsights(userId)
    };
  }

  // Device statistics
  static async getDeviceStats(userId, timeRange) {
    const trackingData = await ComprehensiveTracking.find({
      userId,
      'session.startTime': { $gte: timeRange }
    });

    const devices = {};
    const browsers = {};
    const operatingSystems = {};
    const screenSizes = {};

    trackingData.forEach(track => {
      if (track.device?.type) {
        devices[track.device.type] = (devices[track.device.type] || 0) + 1;
      }
      if (track.device?.browser) {
        browsers[track.device.browser] = (browsers[track.device.browser] || 0) + 1;
      }
      if (track.device?.os) {
        operatingSystems[track.device.os] = (operatingSystems[track.device.os] || 0) + 1;
      }
      if (track.device?.screenResolution) {
        const size = `${track.device.screenResolution.width}x${track.device.screenResolution.height}`;
        screenSizes[size] = (screenSizes[size] || 0) + 1;
      }
    });

    return {
      deviceDistribution: Object.entries(devices)
        .sort(([,a], [,b]) => b - a)
        .map(([device, count]) => ({ device, count })),
      browserDistribution: Object.entries(browsers)
        .sort(([,a], [,b]) => b - a)
        .map(([browser, count]) => ({ browser, count })),
      osDistribution: Object.entries(operatingSystems)
        .sort(([,a], [,b]) => b - a)
        .map(([os, count]) => ({ os, count })),
      screenSizeDistribution: Object.entries(screenSizes)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([size, count]) => ({ size, count })),
      deviceInsights: await this.getDeviceInsights(userId),
      performanceByDevice: await this.getPerformanceByDevice(userId)
    };
  }

  // Performance statistics
  static async getPerformanceStats(userId, timeRange) {
    const trackingData = await ComprehensiveTracking.find({
      userId,
      'session.startTime': { $gte: timeRange }
    });

    const performanceMetrics = trackingData.reduce((acc, track) => {
      if (track.performance) {
        acc.pageLoadTime.push(track.performance.pageLoadTime || 0);
        acc.firstContentfulPaint.push(track.performance.firstContentfulPaint || 0);
        acc.largestContentfulPaint.push(track.performance.largestContentfulPaint || 0);
        acc.timeToInteractive.push(track.performance.timeToInteractive || 0);
        acc.cumulativeLayoutShift.push(track.performance.cumulativeLayoutShift || 0);
      }
      return acc;
    }, {
      pageLoadTime: [],
      firstContentfulPaint: [],
      largestContentfulPaint: [],
      timeToInteractive: [],
      cumulativeLayoutShift: []
    });

    return {
      avgPageLoadTime: this.calculateAverage(performanceMetrics.pageLoadTime),
      avgFirstContentfulPaint: this.calculateAverage(performanceMetrics.firstContentfulPaint),
      avgLargestContentfulPaint: this.calculateAverage(performanceMetrics.largestContentfulPaint),
      avgTimeToInteractive: this.calculateAverage(performanceMetrics.timeToInteractive),
      avgCumulativeLayoutShift: this.calculateAverage(performanceMetrics.cumulativeLayoutShift),
      performanceScore: await this.calculatePerformanceScore(userId),
      performanceTrend: await this.getPerformanceTrend(userId),
      optimizationSuggestions: await this.getOptimizationSuggestions(userId)
    };
  }

  // Conversion funnel
  static async getConversionFunnel(userId, timeRange) {
    const trackingData = await ComprehensiveTracking.find({
      userId,
      'session.startTime': { $gte: timeRange }
    });

    const funnelStages = {
      awareness: 0,
      interest: 0,
      consideration: 0,
      intent: 0,
      evaluation: 0,
      purchase: 0
    };

    trackingData.forEach(track => {
      if (track.conversion?.funnelStage) {
        funnelStages[track.conversion.funnelStage]++;
      }
    });

    return {
      funnelStages,
      conversionRate: await this.calculateConversionRate(userId),
      dropOffPoints: await this.getDropOffPoints(userId),
      conversionPath: await this.getConversionPath(userId),
      revenueAttribution: await this.getRevenueAttribution(userId)
    };
  }

  // AI insights
  static async getAIInsights(userId, timeRange) {
    const trackingData = await ComprehensiveTracking.find({
      userId,
      'session.startTime': { $gte: timeRange }
    });

    const userIntents = {};
    const engagementLevels = {};
    const emotions = {};
    const predictions = [];

    trackingData.forEach(track => {
      if (track.ai?.userIntent) {
        userIntents[track.ai.userIntent] = (userIntents[track.ai.userIntent] || 0) + 1;
      }
      if (track.ai?.engagementLevel) {
        engagementLevels[track.ai.engagementLevel] = (engagementLevels[track.ai.engagementLevel] || 0) + 1;
      }
      if (track.ai?.emotionDetection?.primary) {
        emotions[track.ai.emotionDetection.primary] = (emotions[track.ai.emotionDetection.primary] || 0) + 1;
      }
      if (track.ai?.nextActionPrediction) {
        predictions.push(track.ai.nextActionPrediction);
      }
    });

    return {
      userIntentDistribution: Object.entries(userIntents)
        .sort(([,a], [,b]) => b - a)
        .map(([intent, count]) => ({ intent, count })),
      engagementLevelDistribution: Object.entries(engagementLevels)
        .sort(([,a], [,b]) => b - a)
        .map(([level, count]) => ({ level, count })),
      emotionDistribution: Object.entries(emotions)
        .sort(([,a], [,b]) => b - a)
        .map(([emotion, count]) => ({ emotion, count })),
      predictions: [...new Set(predictions)],
      recommendations: await this.getAIRecommendations(userId),
      insights: await this.getAIInsights(userId)
    };
  }

  // Helper methods
  static calculateAverage(array) {
    return array.length > 0 ? array.reduce((sum, val) => sum + val, 0) / array.length : 0;
  }

  static async calculateUserNetwork(userId) {
    const directReferrals = await User.find({ referrer: userId });
    const level2 = await User.find({ referrer: { $in: directReferrals.map(u => u._id) } });
    const level3 = await User.find({ referrer: { $in: level2.map(u => u._id) } });

    return {
      level1: directReferrals.length,
      level2: level2.length,
      level3: level3.length,
      totalMembers: directReferrals.length + level2.length + level3.length
    };
  }

  static async calculateInfluenceScore(userId) {
    const user = await User.findById(userId);
    const network = await this.calculateUserNetwork(userId);
    const posts = await Post.find({ creator: userId });
    const totalViews = posts.reduce((sum, post) => sum + (post.analytics?.views || 0), 0);
    const totalShares = posts.reduce((sum, post) => sum + (post.analytics?.shares || 0), 0);

    // Calculate influence score based on network size, content performance, and engagement
    const networkScore = network.totalMembers * 0.3;
    const contentScore = (totalViews * 0.4) + (totalShares * 0.6);
    const engagementScore = totalViews > 0 ? (totalShares / totalViews) * 100 : 0;

    return Math.round((networkScore + contentScore + engagementScore) / 3);
  }

  static async getActiveSessions() {
    const last5Minutes = new Date(Date.now() - 5 * 60 * 1000);
    return await ComprehensiveTracking.countDocuments({
      'session.startTime': { $gte: last5Minutes },
      'session.isActive': true
    });
  }

  static async getLiveEvents() {
    const last10Minutes = new Date(Date.now() - 10 * 60 * 1000);
    return await ComprehensiveTracking.find({
      'session.startTime': { $gte: last10Minutes }
    })
    .sort({ 'session.startTime': -1 })
    .limit(50)
    .populate('userId', 'username email')
    .populate('postId', 'title')
    .lean();
  }

  static async getTrendingContent() {
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return await Post.find({
      createdAt: { $gte: last24Hours },
      status: 'active'
    })
    .sort({ 'analytics.views': -1 })
    .limit(10)
    .populate('creator', 'username')
    .lean();
  }

  static async getHotSpots() {
    const lastHour = new Date(Date.now() - 60 * 60 * 1000);
    return await ComprehensiveTracking.aggregate([
      {
        $match: {
          'session.startTime': { $gte: lastHour },
          'location.coordinates.latitude': { $exists: true },
          'location.coordinates.longitude': { $exists: true }
        }
      },
      {
        $group: {
          _id: {
            lat: { $round: ['$location.coordinates.latitude', 2] },
            lng: { $round: ['$location.coordinates.longitude', 2] }
          },
          count: { $sum: 1 },
          city: { $first: '$location.address.city' },
          country: { $first: '$location.address.country' }
        }
      },
      {
        $sort: { count: -1 }
      },
      {
        $limit: 20
      }
    ]);
  }

  // Additional helper methods would be implemented here...
  static async getTopPerformingPosts(userId) { return []; }
  static async getPostCategories(userId) { return []; }
  static async getPostPerformance(userId) { return []; }
  static async getReferralChains(userId) { return []; }
  static async getTopReferrers(userId) { return []; }
  static async getReferralSources(userId) { return []; }
  static async getReferralJourney(userId) { return []; }
  static async getCommissionTrend(userId) { return []; }
  static async getTopEarningPosts(userId) { return []; }
  static async getCommissionDistribution(userId) { return []; }
  static async calculateEngagementScore(userId) { return 0; }
  static async getUserBehavior(userId) { return []; }
  static async getContentEngagement(userId) { return []; }
  static async getSocialEngagement(userId) { return []; }
  static async getGeographicHeatmap(userId) { return []; }
  static async getLocationInsights(userId) { return []; }
  static async getDeviceInsights(userId) { return []; }
  static async getPerformanceByDevice(userId) { return []; }
  static async calculatePerformanceScore(userId) { return 0; }
  static async getPerformanceTrend(userId) { return []; }
  static async getOptimizationSuggestions(userId) { return []; }
  static async calculateConversionRate(userId) { return 0; }
  static async getDropOffPoints(userId) { return []; }
  static async getConversionPath(userId) { return []; }
  static async getRevenueAttribution(userId) { return []; }
  static async getAIRecommendations(userId) { return []; }
  static async getAIInsights(userId) { return []; }
}

module.exports = ExpertAnalyticsService;
