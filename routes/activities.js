const express = require('express');
const router = express.Router();
const Activity = require('../models/Activity');
const auth = require('../middleware/auth');

// Get recent activities with COMPLETE information
router.get('/recent', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    
    const activities = await Activity.find()
      .populate('user', 'username email profile')
      .populate('targetUser', 'username email')
      .populate('post', 'title category price')
      .sort({ createdAt: -1 })
      .limit(limit);

    // Format activities with complete data
    const formatted = activities.map(activity => ({
      _id: activity._id,
      type: activity.type,
      message: activity.message,
      user: {
        id: activity.user?._id,
        username: activity.user?.username,
        name: activity.user?.profile?.name
      },
      targetUser: activity.targetUser ? {
        id: activity.targetUser._id,
        username: activity.targetUser.username
      } : null,
      post: activity.post ? {
        id: activity.post._id,
        title: activity.post.title,
        category: activity.post.category
      } : null,
      metadata: activity.metadata || {},
      details: activity.details || {},
      timestamp: activity.createdAt,
      timeAgo: getTimeAgo(activity.createdAt)
    }));

    res.json({
      success: true,
      activities: formatted,
      count: formatted.length
    });
  } catch (error) {
    console.error('Error fetching activities:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching activities',
      error: error.message,
      activities: []
    });
  }
});

// Get user's activities
router.get('/user/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit) || 50;

    // Check access
    if (req.user.id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const activities = await Activity.find({ user: userId })
      .populate('user', 'username email profile')
      .populate('targetUser', 'username email')
      .populate('post', 'title category')
      .sort({ createdAt: -1 })
      .limit(limit);

    const formatted = activities.map(activity => ({
      _id: activity._id,
      type: activity.type,
      message: activity.message,
      user: {
        id: activity.user?._id,
        username: activity.user?.username
      },
      post: activity.post ? {
        id: activity.post._id,
        title: activity.post.title
      } : null,
      timestamp: activity.createdAt,
      timeAgo: getTimeAgo(activity.createdAt),
      metadata: activity.metadata || {}
    }));

    res.json({
      success: true,
      activities: formatted,
      count: formatted.length
    });
  } catch (error) {
    console.error('Error fetching user activities:', error);
    res.status(500).json({
      success: false,
      message: 'Error',
      activities: []
    });
  }
});

function getTimeAgo(date) {
  const now = new Date();
  const diff = now - new Date(date);
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString();
}

module.exports = router;

