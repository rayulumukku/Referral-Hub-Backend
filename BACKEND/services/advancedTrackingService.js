const Post = require('../models/Post');
const Referral = require('../models/Referral');
const User = require('../models/User');

class AdvancedTrackingService {
  // Track post view with detailed analytics
  static async trackPostView(postId, userId, trackingData = {}) {
    try {
      const updateData = {
        $inc: { 'analytics.views': 1 },
        $push: {
          'analytics.viewHistory': {
            userId,
            timestamp: new Date(),
            ...trackingData
          }
        }
      };

      // Update post analytics
      await Post.findByIdAndUpdate(postId, updateData);

      // Track unique views (if user provided)
      if (userId) {
        await Post.findByIdAndUpdate(postId, {
          $addToSet: { 'analytics.uniqueViewers': userId }
        });
      }

      // Emit real-time update
      const io = require('../server').getIo();
      if (io) {
        const post = await Post.findById(postId).populate('creator');
        if (post && post.creator) {
          io.to(`user_${post.creator._id}`).emit('post_analytics_update', {
            postId,
            type: 'view_increase',
            newViews: (post.analytics?.views || 0) + 1,
            timestamp: new Date()
          });
        }
      }

      return true;
    } catch (error) {
      console.error('Error tracking post view:', error);
      return false;
    }
  }

  // Track link click with advanced analytics
  static async trackLinkClick(referralId, clickData = {}) {
    try {
      const updateData = {
        $inc: { clicks: 1 },
        $push: {
          clickHistory: {
            timestamp: new Date(),
            ...clickData
          }
        }
      };

      const referral = await Referral.findByIdAndUpdate(referralId, updateData, { new: true });

      // Update post reach if this is the first click from this referral
      if (referral && referral.clicks === 1) {
        await Post.findByIdAndUpdate(referral.post, { $inc: { reach: 1 } });
      }

      // Emit real-time updates
      const io = require('../server').getIo();
      if (io && referral) {
        // Notify referrer
        if (referral.referrer) {
          io.to(`user_${referral.referrer}`).emit('referral_update', {
            type: 'click',
            referral: {
              _id: referral._id,
              post: referral.post,
              clicks: referral.clicks,
              timestamp: new Date()
            }
          });
        }

        // Update post analytics
        const post = await Post.findById(referral.post).populate('creator');
        if (post && post.creator) {
          io.to(`user_${post.creator._id}`).emit('post_analytics_update', {
            postId: referral.post,
            type: 'click_increase',
            newClicks: referral.clicks,
            timestamp: new Date()
          });
        }
      }

      return referral;
    } catch (error) {
      console.error('Error tracking link click:', error);
      return null;
    }
  }

  // Track share action with platform analytics
  static async trackShare(postId, userId, platform, shareData = {}) {
    try {
      const updateData = {
        $inc: { 'analytics.shares': 1 },
        $push: {
          'analytics.shareHistory': {
            userId,
            platform,
            timestamp: new Date(),
            ...shareData
          }
        }
      };

      // Update share count by platform
      updateData.$inc[`analytics.sharesByPlatform.${platform}`] = 1;

      await Post.findByIdAndUpdate(postId, updateData);

      // Emit real-time update
      const io = require('../server').getIo();
      if (io) {
        const post = await Post.findById(postId).populate('creator');
        if (post && post.creator) {
          io.to(`user_${post.creator._id}`).emit('post_analytics_update', {
            postId,
            type: 'share_increase',
            platform,
            newShares: (post.analytics?.shares || 0) + 1,
            timestamp: new Date()
          });
        }
      }

      return true;
    } catch (error) {
      console.error('Error tracking share:', error);
      return false;
    }
  }

  // Track conversion with detailed attribution
  static async trackConversion(postId, userId, conversionData = {}) {
    try {
      const updateData = {
        $inc: { 'analytics.conversions': 1 },
        $push: {
          'analytics.conversionHistory': {
            userId,
            timestamp: new Date(),
            ...conversionData
          }
        }
      };

      await Post.findByIdAndUpdate(postId, updateData);

      // Emit real-time update
      const io = require('../server').getIo();
      if (io) {
        const post = await Post.findById(postId).populate('creator');
        if (post && post.creator) {
          io.to(`user_${post.creator._id}`).emit('post_analytics_update', {
            postId,
            type: 'conversion_increase',
            newConversions: (post.analytics?.conversions || 0) + 1,
            timestamp: new Date()
          });
        }
      }

      return true;
    } catch (error) {
      console.error('Error tracking conversion:', error);
      return false;
    }
  }

  // Track user engagement metrics
  static async trackEngagement(postId, userId, engagementType, engagementData = {}) {
    try {
      const updateData = {
        $inc: { [`analytics.engagement.${engagementType}`]: 1 },
        $push: {
          'analytics.engagementHistory': {
            userId,
            type: engagementType,
            timestamp: new Date(),
            ...engagementData
          }
        }
      };

      await Post.findByIdAndUpdate(postId, updateData);

      // Emit real-time update for engagement
      const io = require('../server').getIo();
      if (io) {
        const post = await Post.findById(postId).populate('creator');
        if (post && post.creator) {
          io.to(`user_${post.creator._id}`).emit('post_analytics_update', {
            postId,
            type: 'engagement_increase',
            engagementType,
            newEngagement: (post.analytics?.engagement?.[engagementType] || 0) + 1,
            timestamp: new Date()
          });
        }
      }

      return true;
    } catch (error) {
      console.error('Error tracking engagement:', error);
      return false;
    }
  }

  // Track time spent on post
  static async trackTimeSpent(postId, userId, timeSpent, sessionData = {}) {
    try {
      const updateData = {
        $inc: { 'analytics.totalTimeSpent': timeSpent },
        $push: {
          'analytics.timeTracking': {
            userId,
            timeSpent,
            timestamp: new Date(),
            ...sessionData
          }
        }
      };

      await Post.findByIdAndUpdate(postId, updateData);

      return true;
    } catch (error) {
      console.error('Error tracking time spent:', error);
      return false;
    }
  }

  // Track scroll depth
  static async trackScrollDepth(postId, userId, scrollDepth, scrollData = {}) {
    try {
      const updateData = {
        $push: {
          'analytics.scrollTracking': {
            userId,
            scrollDepth,
            timestamp: new Date(),
            ...scrollData
          }
        }
      };

      // Update max scroll depth if higher
      const post = await Post.findById(postId);
      if (post && (!post.analytics?.maxScrollDepth || scrollDepth > post.analytics.maxScrollDepth)) {
        updateData.$set = { 'analytics.maxScrollDepth': scrollDepth };
      }

      await Post.findByIdAndUpdate(postId, updateData);

      return true;
    } catch (error) {
      console.error('Error tracking scroll depth:', error);
      return false;
    }
  }

  // Get comprehensive analytics for a post
  static async getPostAnalytics(postId, timeframe = 'all') {
    try {
      const post = await Post.findById(postId).populate('creator');

      if (!post) return null;

      const analytics = post.analytics || {};
      let filteredHistory = {};

      // Filter by timeframe if specified
      if (timeframe !== 'all') {
        const now = new Date();
        const timeLimit = new Date();

        switch (timeframe) {
          case 'hour':
            timeLimit.setHours(now.getHours() - 1);
            break;
          case 'day':
            timeLimit.setDate(now.getDate() - 1);
            break;
          case 'week':
            timeLimit.setDate(now.getDate() - 7);
            break;
          case 'month':
            timeLimit.setMonth(now.getMonth() - 1);
            break;
        }

        // Filter history arrays
        Object.keys(analytics).forEach(key => {
          if (Array.isArray(analytics[key])) {
            filteredHistory[key] = analytics[key].filter(item =>
              new Date(item.timestamp) >= timeLimit
            );
          }
        });
      }

      return {
        postId,
        basic: {
          views: analytics.views || 0,
          uniqueViews: analytics.uniqueViewers?.length || 0,
          shares: analytics.shares || 0,
          conversions: analytics.conversions || 0,
          reach: post.reach || 0,
        },
        engagement: analytics.engagement || {},
        platform: analytics.sharesByPlatform || {},
        timing: {
          totalTimeSpent: analytics.totalTimeSpent || 0,
          averageTimeSpent: analytics.totalTimeSpent && analytics.views ?
            analytics.totalTimeSpent / analytics.views : 0,
          maxScrollDepth: analytics.maxScrollDepth || 0,
        },
        history: timeframe === 'all' ? analytics : filteredHistory,
        demographics: await this.getDemographicsData(postId, timeframe),
      };
    } catch (error) {
      console.error('Error getting post analytics:', error);
      return null;
    }
  }

  // Get demographic data for analytics
  static async getDemographicsData(postId, timeframe = 'all') {
    try {
      let matchCondition = { post: postId };

      if (timeframe !== 'all') {
        const now = new Date();
        const timeLimit = new Date();

        switch (timeframe) {
          case 'hour':
            timeLimit.setHours(now.getHours() - 1);
            break;
          case 'day':
            timeLimit.setDate(now.getDate() - 1);
            break;
          case 'week':
            timeLimit.setDate(now.getDate() - 7);
            break;
          case 'month':
            timeLimit.setMonth(now.getMonth() - 1);
            break;
        }

        matchCondition.createdAt = { $gte: timeLimit };
      }

      const demographics = await Referral.aggregate([
        { $match: matchCondition },
        {
          $group: {
            _id: null,
            totalClicks: { $sum: '$clicks' },
            uniqueReferrers: { $addToSet: '$referrer' },
            platforms: {
              $push: {
                platform: '$platform',
                clicks: '$clicks'
              }
            },
            locations: {
              $push: {
                city: '$location.city',
                state: '$location.state',
                country: '$location.country'
              }
            },
            devices: { $push: '$device' },
            browsers: { $push: '$browser' }
          }
        }
      ]);

      if (demographics.length === 0) return {};

      const data = demographics[0];

      // Process platform distribution
      const platformStats = {};
      data.platforms.forEach(item => {
        if (!platformStats[item.platform]) {
          platformStats[item.platform] = 0;
        }
        platformStats[item.platform] += item.clicks;
      });

      // Process location distribution
      const locationStats = {};
      data.locations.forEach(loc => {
        if (loc.country) {
          if (!locationStats[loc.country]) {
            locationStats[loc.country] = 0;
          }
          locationStats[loc.country]++;
        }
      });

      // Process device distribution
      const deviceStats = {};
      data.devices.forEach(device => {
        if (device) {
          deviceStats[device] = (deviceStats[device] || 0) + 1;
        }
      });

      return {
        totalClicks: data.totalClicks,
        uniqueReferrers: data.uniqueReferrers.length,
        platforms: platformStats,
        locations: locationStats,
        devices: deviceStats,
      };
    } catch (error) {
      console.error('Error getting demographics data:', error);
      return {};
    }
  }

  // Track user journey through referral chain
  static async trackUserJourney(referralId, userId, journeyData = {}) {
    try {
      const updateData = {
        $push: {
          userJourney: {
            userId,
            timestamp: new Date(),
            ...journeyData
          }
        }
      };

      await Referral.findByIdAndUpdate(referralId, updateData);

      return true;
    } catch (error) {
      console.error('Error tracking user journey:', error);
      return false;
    }
  }
}

module.exports = AdvancedTrackingService;