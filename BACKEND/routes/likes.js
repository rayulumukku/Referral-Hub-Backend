const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const likeService = require('../services/likeService');

/**
 * @route   POST /api/likes/toggle
 * @desc    Toggle like/reaction on a post or comment
 * @access  Private
 */
router.post('/toggle', auth, async (req, res) => {
  try {
    const { targetType, targetId, reactionType = 'like' } = req.body;
    
    if (!targetType || !targetId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Target type and ID are required' 
      });
    }
    
    if (!['post', 'comment'].includes(targetType)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid target type' 
      });
    }
    
    const metadata = {
      deviceType: req.deviceInfo?.device || 'unknown',
      browser: req.deviceInfo?.browser || 'unknown',
      location: req.location || {},
      ipAddress: req.ipAddress || req.ip
    };
    
    const result = await likeService.toggleLike(
      req.user.id,
      targetType,
      targetId,
      reactionType,
      metadata
    );
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Error toggling like:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

/**
 * @route   GET /api/likes/:targetType/:targetId/counts
 * @desc    Get like counts for a post or comment
 * @access  Public
 */
router.get('/:targetType/:targetId/counts', async (req, res) => {
  try {
    const { targetType, targetId } = req.params;
    
    const counts = await likeService.getLikeCounts(targetType, targetId);
    
    res.json({
      success: true,
      counts
    });
  } catch (error) {
    console.error('Error getting like counts:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

/**
 * @route   GET /api/likes/:targetType/:targetId/check
 * @desc    Check if current user has liked a post or comment
 * @access  Private
 */
router.get('/:targetType/:targetId/check', auth, async (req, res) => {
  try {
    const { targetType, targetId } = req.params;
    
    const result = await likeService.hasUserLiked(req.user.id, targetType, targetId);
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Error checking user like:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

/**
 * @route   GET /api/likes/:targetType/:targetId
 * @desc    Get all likes for a post or comment
 * @access  Public
 */
router.get('/:targetType/:targetId', async (req, res) => {
  try {
    const { targetType, targetId } = req.params;
    const { limit = 50, skip = 0 } = req.query;
    
    const result = await likeService.getLikes(targetType, targetId, {
      limit: parseInt(limit),
      skip: parseInt(skip)
    });
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Error getting likes:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

/**
 * @route   GET /api/likes/user/:userId/posts
 * @desc    Get posts liked by a user
 * @access  Public
 */
router.get('/user/:userId/posts', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 20, skip = 0 } = req.query;
    
    const posts = await likeService.getUserLikedPosts(userId, {
      limit: parseInt(limit),
      skip: parseInt(skip)
    });
    
    res.json({
      success: true,
      posts
    });
  } catch (error) {
    console.error('Error getting user liked posts:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

/**
 * @route   GET /api/likes/user/:userId/analytics
 * @desc    Get like analytics for a user
 * @access  Private
 */
router.get('/user/:userId/analytics', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Only allow users to see their own analytics or admins
    if (req.user.id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Unauthorized' 
      });
    }
    
    const analytics = await likeService.getUserLikeAnalytics(userId);
    
    res.json({
      success: true,
      analytics
    });
  } catch (error) {
    console.error('Error getting like analytics:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

module.exports = router;

