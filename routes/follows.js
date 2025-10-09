const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const followService = require('../services/followService');

/**
 * @route   POST /api/follows/toggle
 * @desc    Toggle follow/unfollow a user
 * @access  Private
 */
router.post('/toggle', auth, async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        message: 'User ID is required' 
      });
    }
    
    const metadata = {
      deviceType: req.deviceInfo?.device || 'unknown',
      browser: req.deviceInfo?.browser || 'unknown',
      location: req.location || {},
      ipAddress: req.ipAddress || req.ip
    };
    
    const result = await followService.toggleFollow(req.user.id, userId, metadata);
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Error toggling follow:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

/**
 * @route   GET /api/follows/:userId/check
 * @desc    Check if current user is following another user
 * @access  Private
 */
router.get('/:userId/check', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    
    const isFollowing = await followService.isFollowing(req.user.id, userId);
    
    res.json({
      success: true,
      isFollowing
    });
  } catch (error) {
    console.error('Error checking follow status:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

/**
 * @route   GET /api/follows/:userId/followers
 * @desc    Get a user's followers
 * @access  Public
 */
router.get('/:userId/followers', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 20, skip = 0 } = req.query;
    
    const result = await followService.getFollowers(userId, {
      limit: parseInt(limit),
      skip: parseInt(skip)
    });
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Error getting followers:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

/**
 * @route   GET /api/follows/:userId/following
 * @desc    Get users that a user is following
 * @access  Public
 */
router.get('/:userId/following', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 20, skip = 0 } = req.query;
    
    const result = await followService.getFollowing(userId, {
      limit: parseInt(limit),
      skip: parseInt(skip)
    });
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Error getting following:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

/**
 * @route   GET /api/follows/mutual/:userId
 * @desc    Get mutual followers with another user
 * @access  Private
 */
router.get('/mutual/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    
    const mutualFollowers = await followService.getMutualFollowers(req.user.id, userId);
    
    res.json({
      success: true,
      mutualFollowers
    });
  } catch (error) {
    console.error('Error getting mutual followers:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

/**
 * @route   GET /api/follows/suggestions
 * @desc    Get follow suggestions for current user
 * @access  Private
 */
router.get('/suggestions', auth, async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    
    const suggestions = await followService.getSuggestions(req.user.id, {
      limit: parseInt(limit)
    });
    
    res.json({
      success: true,
      suggestions
    });
  } catch (error) {
    console.error('Error getting suggestions:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

/**
 * @route   PUT /api/follows/:userId/settings
 * @desc    Update follow settings (notifications, mute, etc.)
 * @access  Private
 */
router.put('/:userId/settings', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    const { notifications, status } = req.body;
    
    const settings = {};
    if (notifications !== undefined) settings.notifications = notifications;
    if (status) settings.status = status;
    
    const follow = await followService.updateFollowSettings(req.user.id, userId, settings);
    
    res.json({
      success: true,
      follow
    });
  } catch (error) {
    console.error('Error updating follow settings:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

/**
 * @route   POST /api/follows/:userId/block
 * @desc    Block a user
 * @access  Private
 */
router.post('/:userId/block', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    
    const result = await followService.blockUser(req.user.id, userId);
    
    res.json({
      success: true,
      message: 'User blocked successfully'
    });
  } catch (error) {
    console.error('Error blocking user:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

/**
 * @route   POST /api/follows/:userId/unblock
 * @desc    Unblock a user
 * @access  Private
 */
router.post('/:userId/unblock', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    
    const result = await followService.unblockUser(req.user.id, userId);
    
    res.json({
      success: true,
      message: 'User unblocked successfully'
    });
  } catch (error) {
    console.error('Error unblocking user:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

/**
 * @route   GET /api/follows/blocked
 * @desc    Get blocked users
 * @access  Private
 */
router.get('/blocked', auth, async (req, res) => {
  try {
    const blockedUsers = await followService.getBlockedUsers(req.user.id);
    
    res.json({
      success: true,
      blockedUsers
    });
  } catch (error) {
    console.error('Error getting blocked users:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

/**
 * @route   GET /api/follows/:userId/is-blocked
 * @desc    Check if a user is blocked
 * @access  Private
 */
router.get('/:userId/is-blocked', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    
    const isBlocked = await followService.isBlocked(req.user.id, userId);
    
    res.json({
      success: true,
      isBlocked
    });
  } catch (error) {
    console.error('Error checking block status:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

/**
 * @route   GET /api/follows/:userId/analytics
 * @desc    Get follow analytics for a user
 * @access  Private
 */
router.get('/:userId/analytics', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Only allow users to see their own analytics or admins
    if (req.user.id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Unauthorized' 
      });
    }
    
    const analytics = await followService.getFollowAnalytics(userId);
    
    res.json({
      success: true,
      analytics
    });
  } catch (error) {
    console.error('Error getting follow analytics:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

module.exports = router;

