const ComprehensiveTracking = require('../models/ComprehensiveTracking');
const User = require('../models/User');
const Post = require('../models/Post');
const Referral = require('../models/Referral');

class ComprehensiveTrackingService {
  // Track comprehensive user activity
  static async trackUserActivity(data) {
    try {
      const {
        userId,
        postId,
        sessionId,
        device,
        location,
        engagement,
        performance,
        social,
        conversion,
        ai,
        security,
        customEvents
      } = data;

      // Create comprehensive tracking record
      const tracking = new ComprehensiveTracking({
        sessionId: sessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId,
        postId,
        device,
        location,
        engagement,
        performance,
        social,
        conversion,
        ai,
        security,
        customEvents,
        session: {
          startTime: new Date(),
          isActive: true
        },
        metadata: {
          userAgent: data.userAgent || 'Unknown',
          referrer: data.referrer || '',
          language: data.language || 'en',
          timezone: data.timezone || 'UTC'
        }
      });

      await tracking.save();

      // Emit real-time updates
      const io = require('../server').getIo();
      if (io) {
        io.to(`user_${userId}`).emit('tracking_update', {
          type: 'activity_tracked',
          sessionId: tracking.sessionId,
          timestamp: new Date(),
          data: {
            device: tracking.device?.type,
            location: tracking.location?.address?.city,
            engagement: tracking.engagement?.attentionScore
          }
        });

        if (postId) {
          io.to(`post_${postId}`).emit('post_tracking_update', {
            type: 'post_activity',
            postId,
            sessionId: tracking.sessionId,
            timestamp: new Date()
          });
        }
      }

      return tracking;
    } catch (error) {
      console.error('Error tracking user activity:', error);
      throw error;
    }
  }

  // Track page view
  static async trackPageView(data) {
    try {
      const {
        userId,
        postId,
        page,
        referrer,
        userAgent,
        location,
        device
      } = data;

      const sessionId = data.sessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const tracking = await this.trackUserActivity({
        userId,
        postId,
        sessionId,
        device,
        location,
        engagement: {
          clicks: [],
          scrollEvents: [],
          maxScrollDepth: 0,
          avgScrollSpeed: 0,
          mouseMovements: [],
          touchEvents: [],
          focusTime: 0,
          attentionScore: 0,
          distractionEvents: [],
          formInteractions: [],
          mediaInteractions: []
        },
        performance: {
          pageLoadTime: data.pageLoadTime || 0,
          domContentLoaded: data.domContentLoaded || 0,
          firstContentfulPaint: data.firstContentfulPaint || 0,
          largestContentfulPaint: data.largestContentfulPaint || 0,
          firstInputDelay: data.firstInputDelay || 0,
          cumulativeLayoutShift: data.cumulativeLayoutShift || 0,
          timeToInteractive: data.timeToInteractive || 0,
          totalBlockingTime: data.totalBlockingTime || 0,
          memoryUsage: data.memoryUsage || 0,
          cpuUsage: data.cpuUsage || 0,
          networkLatency: data.networkLatency || 0,
          bandwidth: data.bandwidth || 0
        },
        social: {
          shares: [],
          likes: [],
          comments: [],
          mentions: []
        },
        conversion: {
          funnelStage: 'awareness',
          conversionValue: 0,
          conversionType: null,
          conversionTimestamp: null,
          attribution: {
            source: referrer || 'direct',
            medium: 'web',
            campaign: null,
            content: null,
            term: null
          },
          revenue: {
            amount: 0,
            currency: 'USD',
            tax: 0,
            discount: 0
          }
        },
        ai: {
          userIntent: 'browse',
          engagementLevel: 'medium',
          churnRisk: 0.1,
          lifetimeValue: 0,
          nextActionPrediction: 'continue_browsing',
          recommendedContent: [],
          sentimentScore: 0,
          emotionDetection: {
            primary: 'neutral',
            confidence: 0.5,
            secondary: []
          }
        },
        security: {
          riskScore: 0.1,
          fraudIndicators: [],
          botDetection: {
            isBot: false,
            confidence: 0.1,
            botType: null
          },
          suspiciousActivity: []
        },
        customEvents: [],
        userAgent,
        referrer,
        language: data.language || 'en',
        timezone: data.timezone || 'UTC'
      });

      return tracking;
    } catch (error) {
      console.error('Error tracking page view:', error);
      throw error;
    }
  }

  // Track user interaction
  static async trackInteraction(data) {
    try {
      const {
        sessionId,
        userId,
        postId,
        interactionType,
        element,
        position,
        duration,
        context
      } = data;

      const tracking = await ComprehensiveTracking.findOne({ sessionId });
      if (!tracking) {
        throw new Error('Session not found');
      }

      // Add interaction to engagement
      if (!tracking.engagement.clicks) {
        tracking.engagement.clicks = [];
      }

      tracking.engagement.clicks.push({
        element,
        position,
        timestamp: new Date(),
        duration,
        context
      });

      // Update attention score
      tracking.engagement.attentionScore = Math.min(100, tracking.engagement.attentionScore + 1);

      await tracking.save();

      // Emit real-time update
      const io = require('../server').getIo();
      if (io) {
        io.to(`user_${userId}`).emit('interaction_update', {
          type: 'interaction_tracked',
          sessionId,
          interactionType,
          timestamp: new Date()
        });
      }

      return tracking;
    } catch (error) {
      console.error('Error tracking interaction:', error);
      throw error;
    }
  }

  // Track scroll behavior
  static async trackScroll(data) {
    try {
      const {
        sessionId,
        userId,
        postId,
        position,
        direction,
        speed
      } = data;

      const tracking = await ComprehensiveTracking.findOne({ sessionId });
      if (!tracking) {
        throw new Error('Session not found');
      }

      // Add scroll event
      if (!tracking.engagement.scrollEvents) {
        tracking.engagement.scrollEvents = [];
      }

      tracking.engagement.scrollEvents.push({
        position,
        direction,
        timestamp: new Date(),
        speed
      });

      // Update max scroll depth
      tracking.engagement.maxScrollDepth = Math.max(tracking.engagement.maxScrollDepth, position);

      await tracking.save();

      return tracking;
    } catch (error) {
      console.error('Error tracking scroll:', error);
      throw error;
    }
  }

  // Track social sharing
  static async trackShare(data) {
    try {
      const {
        sessionId,
        userId,
        postId,
        platform,
        method,
        success,
        reach
      } = data;

      const tracking = await ComprehensiveTracking.findOne({ sessionId });
      if (!tracking) {
        throw new Error('Session not found');
      }

      // Add share event
      if (!tracking.social.shares) {
        tracking.social.shares = [];
      }

      tracking.social.shares.push({
        platform,
        timestamp: new Date(),
        method,
        success,
        reach
      });

      await tracking.save();

      // Emit real-time update
      const io = require('../server').getIo();
      if (io) {
        io.to(`user_${userId}`).emit('share_update', {
          type: 'share_tracked',
          sessionId,
          platform,
          timestamp: new Date()
        });

        if (postId) {
          io.to(`post_${postId}`).emit('post_share_update', {
            type: 'post_shared',
            postId,
            platform,
            timestamp: new Date()
          });
        }
      }

      return tracking;
    } catch (error) {
      console.error('Error tracking share:', error);
      throw error;
    }
  }

  // Track conversion
  static async trackConversion(data) {
    try {
      const {
        sessionId,
        userId,
        postId,
        conversionType,
        conversionValue,
        revenue
      } = data;

      const tracking = await ComprehensiveTracking.findOne({ sessionId });
      if (!tracking) {
        throw new Error('Session not found');
      }

      // Update conversion data
      tracking.conversion = {
        funnelStage: 'purchase',
        conversionValue,
        conversionType,
        conversionTimestamp: new Date(),
        attribution: tracking.conversion?.attribution || {},
        revenue: {
          amount: revenue || 0,
          currency: 'USD',
          tax: 0,
          discount: 0
        }
      };

      await tracking.save();

      // Emit real-time update
      const io = require('../server').getIo();
      if (io) {
        io.to(`user_${userId}`).emit('conversion_update', {
          type: 'conversion_tracked',
          sessionId,
          conversionType,
          conversionValue,
          timestamp: new Date()
        });

        if (postId) {
          io.to(`post_${postId}`).emit('post_conversion_update', {
            type: 'post_conversion',
            postId,
            conversionType,
            conversionValue,
            timestamp: new Date()
          });
        }
      }

      return tracking;
    } catch (error) {
      console.error('Error tracking conversion:', error);
      throw error;
    }
  }

  // Track AI insights
  static async trackAIInsights(data) {
    try {
      const {
        sessionId,
        userId,
        userIntent,
        engagementLevel,
        emotion,
        prediction,
        recommendation
      } = data;

      const tracking = await ComprehensiveTracking.findOne({ sessionId });
      if (!tracking) {
        throw new Error('Session not found');
      }

      // Update AI data
      tracking.ai = {
        userIntent,
        engagementLevel,
        churnRisk: tracking.ai?.churnRisk || 0.1,
        lifetimeValue: tracking.ai?.lifetimeValue || 0,
        nextActionPrediction: prediction,
        recommendedContent: recommendation ? [recommendation] : [],
        sentimentScore: tracking.ai?.sentimentScore || 0,
        emotionDetection: {
          primary: emotion,
          confidence: 0.8,
          secondary: []
        }
      };

      await tracking.save();

      return tracking;
    } catch (error) {
      console.error('Error tracking AI insights:', error);
      throw error;
    }
  }

  // Get comprehensive analytics
  static async getComprehensiveAnalytics(userId, timeRange = 30) {
    try {
      const startDate = new Date(Date.now() - timeRange * 24 * 60 * 60 * 1000);
      
      const trackingData = await ComprehensiveTracking.find({
        userId,
        'session.startTime': { $gte: startDate }
      });

      const analytics = {
        totalSessions: trackingData.length,
        uniqueUsers: [...new Set(trackingData.map(t => t.userId))].length,
        totalTimeSpent: trackingData.reduce((sum, t) => sum + (t.session.duration || 0), 0),
        avgSessionDuration: trackingData.length > 0 ? 
          trackingData.reduce((sum, t) => sum + (t.session.duration || 0), 0) / trackingData.length : 0,
        
        // Device analytics
        devices: trackingData.reduce((acc, t) => {
          if (t.device?.type) {
            acc[t.device.type] = (acc[t.device.type] || 0) + 1;
          }
          return acc;
        }, {}),
        
        browsers: trackingData.reduce((acc, t) => {
          if (t.device?.browser) {
            acc[t.device.browser] = (acc[t.device.browser] || 0) + 1;
          }
          return acc;
        }, {}),
        
        // Location analytics
        locations: {
          countries: trackingData.reduce((acc, t) => {
            if (t.location?.address?.country) {
              acc[t.location.address.country] = (acc[t.location.address.country] || 0) + 1;
            }
            return acc;
          }, {}),
          cities: trackingData.reduce((acc, t) => {
            if (t.location?.address?.city) {
              acc[t.location.address.city] = (acc[t.location.address.city] || 0) + 1;
            }
            return acc;
          }, {})
        },
        
        // Engagement analytics
        engagement: {
          totalClicks: trackingData.reduce((sum, t) => sum + (t.engagement.clicks?.length || 0), 0),
          totalScrolls: trackingData.reduce((sum, t) => sum + (t.engagement.scrollEvents?.length || 0), 0),
          avgScrollDepth: trackingData.length > 0 ? 
            trackingData.reduce((sum, t) => sum + (t.engagement.maxScrollDepth || 0), 0) / trackingData.length : 0,
          attentionScore: trackingData.length > 0 ? 
            trackingData.reduce((sum, t) => sum + (t.engagement.attentionScore || 0), 0) / trackingData.length : 0
        },
        
        // Performance analytics
        performance: {
          avgPageLoadTime: trackingData.length > 0 ? 
            trackingData.reduce((sum, t) => sum + (t.performance.pageLoadTime || 0), 0) / trackingData.length : 0,
          avgFirstContentfulPaint: trackingData.length > 0 ? 
            trackingData.reduce((sum, t) => sum + (t.performance.firstContentfulPaint || 0), 0) / trackingData.length : 0,
          avgTimeToInteractive: trackingData.length > 0 ? 
            trackingData.reduce((sum, t) => sum + (t.performance.timeToInteractive || 0), 0) / trackingData.length : 0
        },
        
        // Conversion analytics
        conversions: trackingData.filter(t => t.conversion?.conversionTimestamp).length,
        conversionRate: trackingData.length > 0 ? 
          (trackingData.filter(t => t.conversion?.conversionTimestamp).length / trackingData.length) * 100 : 0,
        
        // AI insights
        ai: {
          userIntents: trackingData.reduce((acc, t) => {
            if (t.ai?.userIntent) {
              acc[t.ai.userIntent] = (acc[t.ai.userIntent] || 0) + 1;
            }
            return acc;
          }, {}),
          emotions: trackingData.reduce((acc, t) => {
            if (t.ai?.emotionDetection?.primary) {
              acc[t.ai.emotionDetection.primary] = (acc[t.ai.emotionDetection.primary] || 0) + 1;
            }
            return acc;
          }, {}),
          engagementLevels: trackingData.reduce((acc, t) => {
            if (t.ai?.engagementLevel) {
              acc[t.ai.engagementLevel] = (acc[t.ai.engagementLevel] || 0) + 1;
            }
            return acc;
          }, {})
        }
      };

      return analytics;
    } catch (error) {
      console.error('Error getting comprehensive analytics:', error);
      throw error;
    }
  }

  // Get real-time stats
  static async getRealTimeStats() {
    try {
      const last5Minutes = new Date(Date.now() - 5 * 60 * 1000);
      
      const stats = await ComprehensiveTracking.aggregate([
        {
          $match: {
            'session.startTime': { $gte: last5Minutes }
          }
        },
        {
          $group: {
            _id: null,
            activeSessions: { $sum: 1 },
            uniqueUsers: { $addToSet: '$userId' },
            totalEngagement: { $sum: '$engagement.attentionScore' },
            conversions: {
              $sum: {
                $cond: [{ $ne: ['$conversion.conversionTimestamp', null] }, 1, 0]
              }
            },
            avgPerformance: { $avg: '$performance.pageLoadTime' }
          }
        }
      ]);

      return stats[0] || {
        activeSessions: 0,
        uniqueUsers: 0,
        totalEngagement: 0,
        conversions: 0,
        avgPerformance: 0
      };
    } catch (error) {
      console.error('Error getting real-time stats:', error);
      throw error;
    }
  }
}

module.exports = ComprehensiveTrackingService;
