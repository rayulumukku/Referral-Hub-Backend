const express = require('express');
const router = express.Router();
const TrackingEvent = require('../models/TrackingEvent');
const Post = require('../models/Post');
const User = require('../models/User');
const auth = require('../middleware/auth');

// Bulk tracking endpoint
router.post('/bulk', async (req, res) => {
  try {
    const { events } = req.body;

    if (!Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ message: 'Events array is required' });
    }

    // Get user ID from token if available
    let userId = null;
    if (req.headers.authorization) {
      try {
        const jwt = require('jsonwebtoken');
        const token = req.headers.authorization.replace('Bearer ', '');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded.id;
      } catch (err) {
        // Ignore invalid token
      }
    }

    // Process and validate events
    const processedEvents = events.map(event => ({
      ...event,
      userId: userId || event.userId,
      data: {
        ...event.data,
        ipAddress: req.ip,
        // Add geolocation data if available
        ...getGeoData(req),
      },
    }));

    // Insert events in bulk
    const insertedEvents = await TrackingEvent.insertMany(processedEvents);

    // Process events asynchronously (don't wait for response)
    processEventsAsync(insertedEvents);

    res.status(200).json({
      message: 'Tracking events recorded',
      count: insertedEvents.length
    });
  } catch (error) {
    console.error('Bulk tracking error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get tracking analytics for a post
router.get('/analytics/:postId', auth, async (req, res) => {
  try {
    const { postId } = req.params;
    const { startDate, endDate, groupBy = 'day' } = req.query;

    // Verify user owns the post or is admin
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    if (post.creator.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    const analytics = await TrackingEvent.getPostAnalytics(postId, start, end);

    // Get detailed breakdown
    const detailedStats = await TrackingEvent.aggregate([
      {
        $match: {
          postId: require('mongoose').Types.ObjectId(postId),
          timestamp: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: {
            type: '$type',
            date: {
              $dateToString: {
                format: groupBy === 'hour' ? '%Y-%m-%d %H' : '%Y-%m-%d',
                date: '$timestamp'
              }
            }
          },
          count: { $sum: 1 },
          uniqueSessions: { $addToSet: '$data.sessionId' },
          avgTimeSpent: { $avg: '$data.timeSpent' },
        }
      },
      {
        $sort: { '_id.date': 1 }
      }
    ]);

    res.json({
      summary: analytics,
      detailed: detailedStats,
      period: { start, end }
    });
  } catch (error) {
    console.error('Analytics fetch error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user tracking data
router.get('/user/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;

    // Only allow users to see their own data or admins
    if (userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { startDate, endDate, type } = req.query;
    const match = { userId };

    if (startDate && endDate) {
      match.timestamp = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    if (type) {
      match.type = type;
    }

    const events = await TrackingEvent.find(match)
      .populate('postId', 'title')
      .sort({ timestamp: -1 })
      .limit(100);

    res.json(events);
  } catch (error) {
    console.error('User tracking fetch error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get global tracking statistics (admin only)
router.get('/global', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { startDate, endDate } = req.query;
    const match = {};

    if (startDate && endDate) {
      match.timestamp = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    const stats = await TrackingEvent.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          uniqueUsers: { $addToSet: '$userId' },
          uniqueSessions: { $addToSet: '$data.sessionId' },
          devices: { $addToSet: '$data.device' },
          platforms: { $addToSet: '$platform' },
        }
      }
    ]);

    res.json(stats);
  } catch (error) {
    console.error('Global tracking stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Process events asynchronously
async function processEventsAsync(events) {
  try {
    for (const event of events) {
      await event.process();
    }
  } catch (error) {
    console.error('Error processing events asynchronously:', error);
  }
}

// Get geo data from request
function getGeoData(req) {
  // This would typically use a geo-IP service
  // For now, return basic location data if available
  return {
    // Add geo data here when implementing geo-IP service
  };
}

module.exports = router;