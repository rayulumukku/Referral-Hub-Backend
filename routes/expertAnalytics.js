const express = require('express');
const ExpertAnalyticsService = require('../services/expertAnalyticsService');
const ComprehensiveTracking = require('../models/ComprehensiveTracking');
const auth = require('../middleware/auth');

const router = express.Router();

// Get io instance from server.js
let io;
const setIoInstance = (ioInstance) => {
  io = ioInstance;
};

// Attach setIoInstance to router
router.setIoInstance = setIoInstance;

// Expert dashboard endpoint
router.get('/expert-dashboard', auth, async (req, res) => {
  try {
    const dashboardData = await ExpertAnalyticsService.getRealTimeDashboard(req.user.id);
    
    // Emit real-time update
    if (io) {
      io.to(`user_${req.user.id}`).emit('dashboard_update', {
        type: 'dashboard_refresh',
        timestamp: new Date(),
        data: dashboardData
      });
    }
    
    res.json(dashboardData);
  } catch (error) {
    console.error('Error getting expert dashboard:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Comprehensive tracking endpoint
router.get('/comprehensive/:postId', auth, async (req, res) => {
  try {
    const { postId } = req.params;
    const { timeRange = 24 } = req.query;
    
    const startDate = new Date(Date.now() - timeRange * 60 * 60 * 1000);
    
    const trackingData = await ComprehensiveTracking.find({
      postId,
      'session.startTime': { $gte: startDate }
    })
    .populate('userId', 'username email')
    .sort({ 'session.startTime': -1 });

    // Process analytics data
    const analytics = {
      totalSessions: trackingData.length,
      uniqueUsers: [...new Set(trackingData.map(t => t.userId._id))].length,
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

    res.json(analytics);
  } catch (error) {
    console.error('Error getting comprehensive tracking:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Real-time analytics endpoint
router.get('/real-time', auth, async (req, res) => {
  try {
    const last5Minutes = new Date(Date.now() - 5 * 60 * 1000);
    
    const realTimeData = await ComprehensiveTracking.aggregate([
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

    const result = realTimeData[0] || {
      activeSessions: 0,
      uniqueUsers: 0,
      totalEngagement: 0,
      conversions: 0,
      avgPerformance: 0
    };

    // Emit real-time update
    if (io) {
      io.emit('real_time_analytics', {
        type: 'analytics_update',
        timestamp: new Date(),
        data: result
      });
    }

    res.json(result);
  } catch (error) {
    console.error('Error getting real-time analytics:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// User journey analytics
router.get('/user-journey/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    const { timeRange = 30 } = req.query;
    
    const journeyData = await ComprehensiveTracking.getUserJourney(userId, timeRange);
    
    res.json({
      userId,
      timeRange,
      journey: journeyData,
      insights: await ExpertAnalyticsService.getJourneyInsights(userId)
    });
  } catch (error) {
    console.error('Error getting user journey:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Post analytics
router.get('/post-analytics/:postId', auth, async (req, res) => {
  try {
    const { postId } = req.params;
    const { timeRange = 30 } = req.query;
    
    const postAnalytics = await ComprehensiveTracking.getPostAnalytics(postId, timeRange);
    
    res.json({
      postId,
      timeRange,
      analytics: postAnalytics[0] || {},
      insights: await ExpertAnalyticsService.getPostInsights(postId)
    });
  } catch (error) {
    console.error('Error getting post analytics:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// AI insights endpoint
router.get('/ai-insights/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    const { timeRange = 30 } = req.query;
    
    const startDate = new Date(Date.now() - timeRange * 24 * 60 * 60 * 1000);
    
    const trackingData = await ComprehensiveTracking.find({
      userId,
      'session.startTime': { $gte: startDate }
    });

    const aiInsights = {
      userIntent: trackingData.reduce((acc, t) => {
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
      }, {}),
      predictions: [...new Set(trackingData.map(t => t.ai?.nextActionPrediction).filter(Boolean))],
      recommendations: await ExpertAnalyticsService.getAIRecommendations(userId),
      insights: await ExpertAnalyticsService.getAIInsights(userId)
    };

    res.json(aiInsights);
  } catch (error) {
    console.error('Error getting AI insights:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Performance analytics
router.get('/performance/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    const { timeRange = 7 } = req.query;
    
    const startDate = new Date(Date.now() - timeRange * 24 * 60 * 60 * 1000);
    
    const performanceData = await ComprehensiveTracking.find({
      userId,
      'session.startTime': { $gte: startDate }
    });

    const performance = {
      avgPageLoadTime: performanceData.length > 0 ? 
        performanceData.reduce((sum, t) => sum + (t.performance.pageLoadTime || 0), 0) / performanceData.length : 0,
      avgFirstContentfulPaint: performanceData.length > 0 ? 
        performanceData.reduce((sum, t) => sum + (t.performance.firstContentfulPaint || 0), 0) / performanceData.length : 0,
      avgLargestContentfulPaint: performanceData.length > 0 ? 
        performanceData.reduce((sum, t) => sum + (t.performance.largestContentfulPaint || 0), 0) / performanceData.length : 0,
      avgTimeToInteractive: performanceData.length > 0 ? 
        performanceData.reduce((sum, t) => sum + (t.performance.timeToInteractive || 0), 0) / performanceData.length : 0,
      avgCumulativeLayoutShift: performanceData.length > 0 ? 
        performanceData.reduce((sum, t) => sum + (t.performance.cumulativeLayoutShift || 0), 0) / performanceData.length : 0,
      performanceScore: await ExpertAnalyticsService.calculatePerformanceScore(userId),
      optimizationSuggestions: await ExpertAnalyticsService.getOptimizationSuggestions(userId)
    };

    res.json(performance);
  } catch (error) {
    console.error('Error getting performance analytics:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
