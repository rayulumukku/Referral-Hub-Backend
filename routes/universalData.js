const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const UniversalDataService = require('../services/universalDataService');

// Universal dashboard endpoint - provides ALL data
router.get('/dashboard', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const dashboardData = await UniversalDataService.getUserDashboard(userId);
    
    // Emit real-time update
    const io = require('../server').getIo();
    if (io) {
      io.to(`user_${userId}`).emit('dashboard_update', {
        type: 'full_dashboard_update',
        userId,
        timestamp: new Date()
      });
    }
    
    res.json(dashboardData);
  } catch (error) {
    console.error('Error getting universal dashboard:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Post analytics endpoint
router.get('/post/:postId', auth, async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.id;
    
    const analytics = await UniversalDataService.getPostAnalytics(postId, userId);
    
    // Emit real-time update
    const io = require('../server').getIo();
    if (io) {
      io.to(`user_${userId}`).emit('post_analytics_update', {
        type: 'post_analytics_updated',
        postId,
        userId,
        timestamp: new Date()
      });
    }
    
    res.json(analytics);
  } catch (error) {
    console.error('Error getting post analytics:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Network analytics endpoint
router.get('/network', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const networkData = await UniversalDataService.getNetworkAnalytics(userId);
    
    // Emit real-time update
    const io = require('../server').getIo();
    if (io) {
      io.to(`user_${userId}`).emit('network_update', {
        type: 'network_analytics_updated',
        userId,
        timestamp: new Date()
      });
    }
    
    res.json(networkData);
  } catch (error) {
    console.error('Error getting network analytics:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Gamification data endpoint
router.get('/gamification', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const gamificationData = await UniversalDataService.getGamificationData(userId);
    
    // Emit real-time update
    const io = require('../server').getIo();
    if (io) {
      io.to(`user_${userId}`).emit('gamification_update', {
        type: 'gamification_updated',
        userId,
        timestamp: new Date()
      });
    }
    
    res.json(gamificationData);
  } catch (error) {
    console.error('Error getting gamification data:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Real-time updates endpoint
router.get('/realtime', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get all real-time data
    const [dashboard, network, gamification] = await Promise.all([
      UniversalDataService.getUserDashboard(userId),
      UniversalDataService.getNetworkAnalytics(userId),
      UniversalDataService.getGamificationData(userId)
    ]);
    
    const realtimeData = {
      dashboard,
      network,
      gamification,
      lastUpdated: new Date()
    };
    
    res.json(realtimeData);
  } catch (error) {
    console.error('Error getting real-time data:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
