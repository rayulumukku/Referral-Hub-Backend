const express = require('express');
const PostAnalytics = require('../models/PostAnalytics');
const Post = require('../models/Post');
const auth = require('../middleware/auth');

const router = express.Router();

// Track post event (view, click, interaction, etc.)
router.post('/track', async (req, res) => {
  try {
    const {
      postId,
      type,
      sessionId,
      platform,
      device,
      browser,
      userAgent,
      screenSize,
      location,
      ipAddress,
      referrer,
      language,
      networkInfo,
      performance,
      interaction,
      timeSpent,
      scrollDepth,
      metadata,
    } = req.body;

    // Verify post exists
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // Get user ID from token if available
    let userId = null;
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token) {
      try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded.id;
      } catch (err) {
        // ignore invalid token
      }
    }

    // Track the event
    const event = await PostAnalytics.trackEvent({
      post: postId,
      user: userId,
      sessionId,
      type,
      platform,
      device,
      browser,
      userAgent,
      screenSize,
      location,
      ipAddress,
      referrer,
      language,
      networkInfo,
      performance,
      interaction,
      timeSpent,
      scrollDepth,
      metadata,
    });

    // Update post stats based on event type
    const updateField = {};
    switch (type) {
      case 'view':
        updateField.$inc = { reach: 1 };
        break;
      case 'conversion':
        updateField.$inc = { conversions: 1 };
        break;
    }

    if (Object.keys(updateField).length > 0) {
      await Post.findByIdAndUpdate(postId, updateField);
    }

    res.status(201).json({ message: 'Event tracked successfully', eventId: event._id });
  } catch (error) {
    console.error('Error tracking event:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get post analytics
router.get('/post/:postId', auth, async (req, res) => {
  try {
    const { postId } = req.params;
    const { startDate, endDate, type, realtime } = req.query;

    // Verify user owns the post or is admin
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    if (post.creator.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    let analytics;

    if (realtime === 'true') {
      // Get real-time stats for the last hour
      analytics = await PostAnalytics.getRealtimeStats(postId);
    } else {
      // Get comprehensive stats
      const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate) : new Date();

      analytics = await PostAnalytics.getPostStats(postId, start, end);
    }

    res.json({
      postId,
      analytics,
      period: realtime === 'true' ? 'last_hour' : `${startDate || '30_days_ago'} to ${endDate || 'now'}`,
    });
  } catch (error) {
    console.error('Error fetching post analytics:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get geographic analytics
router.get('/post/:postId/geographic', auth, async (req, res) => {
  try {
    const { postId } = req.params;

    // Verify user owns the post or is admin
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    if (post.creator.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    const geographicData = await PostAnalytics.getGeographicStats(postId);

    res.json({
      postId,
      geographic: geographicData,
    });
  } catch (error) {
    console.error('Error fetching geographic analytics:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get device/browser analytics
router.get('/post/:postId/devices', auth, async (req, res) => {
  try {
    const { postId } = req.params;

    // Verify user owns the post or is admin
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    if (post.creator.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    const deviceData = await PostAnalytics.getDeviceStats(postId);

    res.json({
      postId,
      devices: deviceData,
    });
  } catch (error) {
    console.error('Error fetching device analytics:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get conversion funnel
router.get('/post/:postId/funnel', auth, async (req, res) => {
  try {
    const { postId } = req.params;

    // Verify user owns the post or is admin
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    if (post.creator.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    // Get funnel data: views -> clicks -> conversions
    const mongoose = require('mongoose');
    const funnel = await PostAnalytics.aggregate([
      { $match: { post: mongoose.Types.ObjectId(postId) } },
      {
        $group: {
          _id: '$sessionId',
          views: { $sum: { $cond: [{ $eq: ['$type', 'view'] }, 1, 0] } },
          clicks: { $sum: { $cond: [{ $eq: ['$type', 'click'] }, 1, 0] } },
          conversions: { $sum: { $cond: [{ $eq: ['$type', 'conversion'] }, 1, 0] } },
        },
      },
      {
        $group: {
          _id: null,
          totalSessions: { $sum: 1 },
          sessionsWithViews: { $sum: { $cond: [{ $gt: ['$views', 0] }, 1, 0] } },
          sessionsWithClicks: { $sum: { $cond: [{ $gt: ['$clicks', 0] }, 1, 0] } },
          sessionsWithConversions: { $sum: { $cond: [{ $gt: ['$conversions', 0] }, 1, 0] } },
        },
      },
    ]);

    res.json({
      postId,
      funnel: funnel[0] || {
        totalSessions: 0,
        sessionsWithViews: 0,
        sessionsWithClicks: 0,
        sessionsWithConversions: 0,
      },
    });
  } catch (error) {
    console.error('Error fetching funnel analytics:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get heat map data for clicks
router.get('/post/:postId/heatmap', auth, async (req, res) => {
  try {
    const { postId } = req.params;

    // Verify user owns the post or is admin
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    if (post.creator.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    // Get click positions for heatmap
    const clicks = await PostAnalytics.find({
      post: postId,
      type: 'click',
      'interaction.element': { $exists: true },
    }).select('interaction screenSize timestamp');

    res.json({
      postId,
      clicks: clicks.map(click => ({
        element: click.interaction.element,
        x: click.interaction.x,
        y: click.interaction.y,
        screenSize: click.screenSize,
        timestamp: click.timestamp,
      })),
    });
  } catch (error) {
    console.error('Error fetching heatmap data:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;