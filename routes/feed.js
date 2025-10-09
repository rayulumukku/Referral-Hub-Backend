const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const feedService = require('../services/feedService');

/**
 * @route   GET /api/feed
 * @desc    Get personalized feed for current user
 * @access  Private
 */
router.get('/', auth, async (req, res) => {
  try {
    const { 
      limit = 20, 
      skip = 0, 
      feedType = 'following' 
    } = req.query;
    
    const result = await feedService.getFeed(req.user.id, {
      limit: parseInt(limit),
      skip: parseInt(skip),
      feedType
    });
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Error getting feed:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

/**
 * @route   GET /api/feed/following
 * @desc    Get feed from users the current user is following
 * @access  Private
 */
router.get('/following', auth, async (req, res) => {
  try {
    const { limit = 20, skip = 0 } = req.query;
    
    const posts = await feedService.getFollowingFeed(req.user.id, {
      limit: parseInt(limit),
      skip: parseInt(skip)
    });
    
    res.json({
      success: true,
      posts,
      hasMore: posts.length >= parseInt(limit)
    });
  } catch (error) {
    console.error('Error getting following feed:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

/**
 * @route   GET /api/feed/trending
 * @desc    Get trending posts
 * @access  Public
 */
router.get('/trending', async (req, res) => {
  try {
    const { limit = 20, skip = 0 } = req.query;
    
    const posts = await feedService.getTrendingFeed({
      limit: parseInt(limit),
      skip: parseInt(skip)
    });
    
    res.json({
      success: true,
      posts,
      hasMore: posts.length >= parseInt(limit)
    });
  } catch (error) {
    console.error('Error getting trending feed:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

/**
 * @route   GET /api/feed/recommended
 * @desc    Get recommended posts for current user
 * @access  Private
 */
router.get('/recommended', auth, async (req, res) => {
  try {
    const { limit = 20, skip = 0 } = req.query;
    
    const posts = await feedService.getRecommendedFeed(req.user.id, {
      limit: parseInt(limit),
      skip: parseInt(skip)
    });
    
    res.json({
      success: true,
      posts,
      hasMore: posts.length >= parseInt(limit)
    });
  } catch (error) {
    console.error('Error getting recommended feed:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

/**
 * @route   GET /api/feed/nearby
 * @desc    Get posts from nearby users
 * @access  Private
 */
router.get('/nearby', auth, async (req, res) => {
  try {
    const { limit = 20, skip = 0 } = req.query;
    
    const posts = await feedService.getNearbyFeed(req.user.id, {
      limit: parseInt(limit),
      skip: parseInt(skip)
    });
    
    res.json({
      success: true,
      posts,
      hasMore: posts.length >= parseInt(limit)
    });
  } catch (error) {
    console.error('Error getting nearby feed:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

/**
 * @route   POST /api/feed/generate
 * @desc    Generate/refresh feed for current user
 * @access  Private
 */
router.post('/generate', auth, async (req, res) => {
  try {
    const { feedType = 'following', limit = 20 } = req.body;
    
    const result = await feedService.generateFeed(req.user.id, {
      feedType,
      limit: parseInt(limit)
    });
    
    res.json({
      success: true,
      message: 'Feed generated successfully'
    });
  } catch (error) {
    console.error('Error generating feed:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

/**
 * @route   POST /api/feed/engagement
 * @desc    Track feed engagement
 * @access  Private
 */
router.post('/engagement', auth, async (req, res) => {
  try {
    const { postId, engagementType, value = 1 } = req.body;
    
    if (!postId || !engagementType) {
      return res.status(400).json({ 
        success: false, 
        message: 'Post ID and engagement type are required' 
      });
    }
    
    if (!['clicks', 'views', 'shares', 'timeSpent'].includes(engagementType)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid engagement type' 
      });
    }
    
    await feedService.trackEngagement(req.user.id, postId, engagementType, value);
    
    res.json({
      success: true,
      message: 'Engagement tracked successfully'
    });
  } catch (error) {
    console.error('Error tracking engagement:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

/**
 * @route   POST /api/feed/dismiss/:postId
 * @desc    Dismiss a post from feed
 * @access  Private
 */
router.post('/dismiss/:postId', auth, async (req, res) => {
  try {
    const { postId } = req.params;
    
    await feedService.dismissPost(req.user.id, postId);
    
    res.json({
      success: true,
      message: 'Post dismissed successfully'
    });
  } catch (error) {
    console.error('Error dismissing post:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

/**
 * @route   GET /api/feed/analytics
 * @desc    Get feed analytics for current user
 * @access  Private
 */
router.get('/analytics', auth, async (req, res) => {
  try {
    const analytics = await feedService.getFeedAnalytics(req.user.id);
    
    res.json({
      success: true,
      analytics
    });
  } catch (error) {
    console.error('Error getting feed analytics:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

module.exports = router;

