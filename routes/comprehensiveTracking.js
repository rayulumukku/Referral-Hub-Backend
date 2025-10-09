const express = require('express');
const router = express.Router();
const ComprehensiveTracking = require('../models/ComprehensiveTracking');
const auth = require('../middleware/auth');
const UAParser = require('ua-parser-js');
const geoip = require('geoip-lite');

// Track comprehensive user data
router.post('/comprehensive', async (req, res) => {
  try {
    const trackingData = req.body;
    const clientIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.ip;
    
    // Parse user agent for additional server-side data
    const parser = new UAParser(req.headers['user-agent']);
    const uaResult = parser.getResult();
    
    // Get IP-based location (backup if client geolocation fails)
    const ipLocation = geoip.lookup(clientIp.replace('::ffff:', ''));
    
    // Enhance device info with server-side parsing
    if (!trackingData.device || !trackingData.device.os) {
      trackingData.device = {
        ...trackingData.device,
        os: uaResult.os.name || 'Unknown',
        osVersion: uaResult.os.version || 'Unknown',
        browser: uaResult.browser.name || 'Unknown',
        browserVersion: uaResult.browser.version || 'Unknown',
        deviceModel: uaResult.device.model || 'Unknown'
      };
    }
    
    // Enhance location with IP-based data if geolocation not available
    if (!trackingData.location || !trackingData.location.coordinates) {
      if (ipLocation) {
        trackingData.location = {
          ...trackingData.location,
          ipInfo: {
            ip: clientIp,
            country: ipLocation.country,
            region: ipLocation.region,
            city: ipLocation.city,
            timezone: ipLocation.timezone,
            ll: ipLocation.ll
          },
          address: {
            ...trackingData.location?.address,
            country: ipLocation.country,
            city: ipLocation.city,
            timezone: ipLocation.timezone
          }
        };
      }
    } else if (ipLocation) {
      // Add IP info even if we have geolocation
      trackingData.location.ipInfo = {
        ip: clientIp,
        country: ipLocation.country,
        region: ipLocation.region,
        city: ipLocation.city,
        timezone: ipLocation.timezone
      };
    }
    
    // Create tracking record
    const tracking = new ComprehensiveTracking(trackingData);
    await tracking.save();
    
    res.json({
      success: true,
      message: 'Comprehensive tracking data saved',
      trackingId: tracking._id,
      dataPoints: Object.keys(trackingData).length
    });
  } catch (error) {
    console.error('Error saving comprehensive tracking:', error);
    res.status(500).json({
      success: false,
      message: 'Error saving tracking data',
      error: error.message
    });
  }
});

// Get comprehensive tracking data for a user
router.get('/user/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    const { timeRange = 30, limit = 100 } = req.query;
    
    const startDate = new Date(Date.now() - timeRange * 24 * 60 * 60 * 1000);
    
    const trackingData = await ComprehensiveTracking.find({
      userId,
      'session.startTime': { $gte: startDate }
    })
    .sort({ 'session.startTime': -1 })
    .limit(parseInt(limit));
    
    // Calculate aggregated metrics
    const totalSessions = trackingData.length;
    const avgAttentionScore = trackingData.reduce((sum, t) => sum + (t.engagement?.attentionScore || 0), 0) / totalSessions || 0;
    const avgSessionDuration = trackingData.reduce((sum, t) => sum + (t.session?.duration || 0), 0) / totalSessions || 0;
    
    // Device breakdown
    const deviceBreakdown = {};
    trackingData.forEach(t => {
      const deviceType = t.device?.type || 'unknown';
      deviceBreakdown[deviceType] = (deviceBreakdown[deviceType] || 0) + 1;
    });
    
    // Browser breakdown
    const browserBreakdown = {};
    trackingData.forEach(t => {
      const browser = t.device?.browser || 'unknown';
      browserBreakdown[browser] = (browserBreakdown[browser] || 0) + 1;
    });
    
    // Location breakdown
    const locationBreakdown = {};
    trackingData.forEach(t => {
      const city = t.location?.address?.city || t.location?.ipInfo?.city || 'unknown';
      locationBreakdown[city] = (locationBreakdown[city] || 0) + 1;
    });
    
    // Platform breakdown (entry points)
    const platformBreakdown = {};
    trackingData.forEach(t => {
      const platform = t.journey?.entryPoint || 'direct';
      platformBreakdown[platform] = (platformBreakdown[platform] || 0) + 1;
    });
    
    res.json({
      success: true,
      data: trackingData,
      summary: {
        totalSessions,
        avgAttentionScore: Math.round(avgAttentionScore),
        avgSessionDuration: Math.round(avgSessionDuration),
        deviceBreakdown,
        browserBreakdown,
        locationBreakdown,
        platformBreakdown
      }
    });
  } catch (error) {
    console.error('Error fetching user tracking data:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching tracking data',
      error: error.message
    });
  }
});

// Get comprehensive tracking data for a post
router.get('/post/:postId', auth, async (req, res) => {
  try {
    const { postId } = req.params;
    const { timeRange = 30, limit = 200 } = req.query;
    
    const startDate = new Date(Date.now() - timeRange * 24 * 60 * 60 * 1000);
    
    const trackingData = await ComprehensiveTracking.find({
      postId,
      'session.startTime': { $gte: startDate }
    })
    .sort({ 'session.startTime': -1 })
    .limit(parseInt(limit));
    
    // Calculate comprehensive post metrics
    const totalViews = trackingData.length;
    const uniqueUsers = [...new Set(trackingData.map(t => t.userId?.toString()).filter(Boolean))].length;
    
    const avgAttentionScore = trackingData.reduce((sum, t) => sum + (t.engagement?.attentionScore || 0), 0) / totalViews || 0;
    const avgSessionDuration = trackingData.reduce((sum, t) => sum + (t.session?.duration || 0), 0) / totalViews || 0;
    const avgScrollDepth = trackingData.reduce((sum, t) => sum + (t.engagement?.maxScrollDepth || 0), 0) / totalViews || 0;
    
    // Performance metrics
    const avgLoadTime = trackingData.reduce((sum, t) => sum + (t.performance?.pageLoadTime || 0), 0) / totalViews || 0;
    const avgFCP = trackingData.reduce((sum, t) => sum + (t.performance?.firstContentfulPaint || 0), 0) / totalViews || 0;
    
    // Device breakdown
    const deviceStats = {};
    trackingData.forEach(t => {
      const device = t.device?.type || 'unknown';
      if (!deviceStats[device]) {
        deviceStats[device] = {
          count: 0,
          avgAttention: 0,
          avgDuration: 0
        };
      }
      deviceStats[device].count++;
      deviceStats[device].avgAttention += t.engagement?.attentionScore || 0;
      deviceStats[device].avgDuration += t.session?.duration || 0;
    });
    
    // Calculate averages for device stats
    Object.keys(deviceStats).forEach(device => {
      deviceStats[device].avgAttention = Math.round(deviceStats[device].avgAttention / deviceStats[device].count);
      deviceStats[device].avgDuration = Math.round(deviceStats[device].avgDuration / deviceStats[device].count);
    });
    
    // Browser breakdown
    const browserStats = {};
    trackingData.forEach(t => {
      const browser = t.device?.browser || 'unknown';
      browserStats[browser] = (browserStats[browser] || 0) + 1;
    });
    
    // Location breakdown with coordinates
    const locationStats = [];
    const locationMap = {};
    trackingData.forEach(t => {
      const lat = t.location?.coordinates?.latitude || t.location?.ipInfo?.ll?.[0];
      const lng = t.location?.coordinates?.longitude || t.location?.ipInfo?.ll?.[1];
      const city = t.location?.address?.city || t.location?.ipInfo?.city || 'Unknown';
      const country = t.location?.address?.country || t.location?.ipInfo?.country || 'Unknown';
      
      if (lat && lng) {
        const key = `${city},${country}`;
        if (!locationMap[key]) {
          locationMap[key] = {
            city,
            country,
            lat,
            lng,
            count: 0
          };
        }
        locationMap[key].count++;
      }
    });
    
    locationStats.push(...Object.values(locationMap));
    
    // User intent breakdown
    const intentBreakdown = {};
    trackingData.forEach(t => {
      const intent = t.ai?.userIntent || 'browse';
      intentBreakdown[intent] = (intentBreakdown[intent] || 0) + 1;
    });
    
    // Engagement level breakdown
    const engagementBreakdown = {};
    trackingData.forEach(t => {
      const level = t.ai?.engagementLevel || 'low';
      engagementBreakdown[level] = (engagementBreakdown[level] || 0) + 1;
    });
    
    // Network type breakdown
    const networkBreakdown = {};
    trackingData.forEach(t => {
      const networkType = t.network?.effectiveType || 'unknown';
      networkBreakdown[networkType] = (networkBreakdown[networkType] || 0) + 1;
    });
    
    res.json({
      success: true,
      postId,
      timeRange,
      summary: {
        totalViews,
        uniqueUsers,
        avgAttentionScore: Math.round(avgAttentionScore),
        avgSessionDuration: Math.round(avgSessionDuration),
        avgScrollDepth: Math.round(avgScrollDepth),
        avgLoadTime: Math.round(avgLoadTime),
        avgFCP: Math.round(avgFCP)
      },
      breakdowns: {
        devices: deviceStats,
        browsers: browserStats,
        locations: locationStats,
        intents: intentBreakdown,
        engagement: engagementBreakdown,
        network: networkBreakdown
      },
      recentSessions: trackingData.slice(0, 10).map(t => ({
        sessionId: t.sessionId,
        userId: t.userId,
        device: t.device?.type,
        browser: t.device?.browser,
        location: t.location?.address?.city || t.location?.ipInfo?.city,
        duration: t.session?.duration,
        attentionScore: t.engagement?.attentionScore,
        scrollDepth: t.engagement?.maxScrollDepth,
        timestamp: t.session?.startTime
      }))
    });
  } catch (error) {
    console.error('Error fetching post tracking data:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching tracking data',
      error: error.message
    });
  }
});

// Get real-time analytics (last hour)
router.get('/real-time', auth, async (req, res) => {
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    const recentTracking = await ComprehensiveTracking.find({
      'session.startTime': { $gte: oneHourAgo }
    }).sort({ 'session.startTime': -1 });
    
    const activeSessions = recentTracking.filter(t => t.session?.isActive).length;
    const uniqueUsers = [...new Set(recentTracking.map(t => t.userId?.toString()).filter(Boolean))].length;
    
    // Active pages
    const activePages = {};
    recentTracking.forEach(t => {
      const page = t.journey?.landingPage || 'unknown';
      activePages[page] = (activePages[page] || 0) + 1;
    });
    
    // Recent conversions
    const recentConversions = recentTracking.filter(t => 
      t.conversion?.conversionTimestamp && 
      new Date(t.conversion.conversionTimestamp) >= oneHourAgo
    );
    
    res.json({
      success: true,
      realTime: {
        activeSessions,
        uniqueUsers,
        totalPageViews: recentTracking.length,
        activePages: Object.entries(activePages).slice(0, 10).map(([page, count]) => ({ page, count })),
        recentConversions: recentConversions.length,
        lastUpdate: new Date()
      },
      recentActivity: recentTracking.slice(0, 20).map(t => ({
        userId: t.userId,
        postId: t.postId,
        device: t.device?.type,
        location: t.location?.address?.city || t.location?.ipInfo?.city,
        timestamp: t.session?.startTime,
        duration: t.session?.duration
      }))
    });
  } catch (error) {
    console.error('Error fetching real-time analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching real-time analytics',
      error: error.message
    });
  }
});

// Get journey map data
router.get('/journey-map/:postId', auth, async (req, res) => {
  try {
    const { postId } = req.params;
    
    const trackingData = await ComprehensiveTracking.find({
      postId,
      'location.coordinates.latitude': { $exists: true }
    })
    .sort({ 'session.startTime': -1 })
    .limit(500);
    
    // Create journey connections
    const journeyConnections = [];
    const locationPoints = [];
    
    trackingData.forEach(t => {
      const lat = t.location?.coordinates?.latitude;
      const lng = t.location?.coordinates?.longitude;
      const city = t.location?.address?.city || t.location?.ipInfo?.city;
      const country = t.location?.address?.country || t.location?.ipInfo?.country;
      
      if (lat && lng) {
        locationPoints.push({
          lat,
          lng,
          city,
          country,
          userId: t.userId,
          device: t.device?.type,
          browser: t.device?.browser,
          timestamp: t.session?.startTime,
          attentionScore: t.engagement?.attentionScore,
          sessionDuration: t.session?.duration
        });
      }
    });
    
    res.json({
      success: true,
      postId,
      journeyConnections,
      locationPoints,
      totalPoints: locationPoints.length
    });
  } catch (error) {
    console.error('Error fetching journey map:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching journey map',
      error: error.message
    });
  }
});

module.exports = router;

