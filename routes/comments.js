const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const commentService = require('../services/commentService');

/**
 * @route   POST /api/comments
 * @desc    Create a new comment
 * @access  Private
 */
router.post('/', auth, async (req, res) => {
  try {
    const { postId, content, parentCommentId } = req.body;
    
    if (!postId || !content) {
      return res.status(400).json({ 
        success: false, 
        message: 'Post ID and content are required' 
      });
    }
    
    if (content.trim().length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Comment cannot be empty' 
      });
    }
    
    const metadata = {
      deviceType: req.deviceInfo?.device || 'unknown',
      browser: req.deviceInfo?.browser || 'unknown',
      location: req.location || {},
      ipAddress: req.ipAddress || req.ip
    };
    
    const comment = await commentService.createComment(
      postId,
      req.user.id,
      content,
      parentCommentId || null,
      metadata
    );
    
    res.status(201).json({
      success: true,
      comment
    });
  } catch (error) {
    console.error('Error creating comment:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

/**
 * @route   PUT /api/comments/:commentId
 * @desc    Update a comment
 * @access  Private
 */
router.put('/:commentId', auth, async (req, res) => {
  try {
    const { commentId } = req.params;
    const { content } = req.body;
    
    if (!content || content.trim().length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Content is required' 
      });
    }
    
    const comment = await commentService.updateComment(commentId, req.user.id, content);
    
    res.json({
      success: true,
      comment
    });
  } catch (error) {
    console.error('Error updating comment:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

/**
 * @route   DELETE /api/comments/:commentId
 * @desc    Delete a comment
 * @access  Private
 */
router.delete('/:commentId', auth, async (req, res) => {
  try {
    const { commentId } = req.params;
    
    const result = await commentService.deleteComment(commentId, req.user.id);
    
    res.json({
      success: true,
      message: 'Comment deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

/**
 * @route   GET /api/comments/post/:postId
 * @desc    Get comments for a post
 * @access  Public
 */
router.get('/post/:postId', async (req, res) => {
  try {
    const { postId } = req.params;
    const { limit = 20, skip = 0, sortBy = 'createdAt', sortOrder = -1 } = req.query;
    
    const result = await commentService.getPostComments(postId, {
      limit: parseInt(limit),
      skip: parseInt(skip),
      sortBy,
      sortOrder: parseInt(sortOrder)
    });
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Error getting post comments:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

/**
 * @route   GET /api/comments/:commentId/replies
 * @desc    Get replies for a comment
 * @access  Public
 */
router.get('/:commentId/replies', async (req, res) => {
  try {
    const { commentId } = req.params;
    const { limit = 10, skip = 0 } = req.query;
    
    const result = await commentService.getCommentReplies(commentId, {
      limit: parseInt(limit),
      skip: parseInt(skip)
    });
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Error getting comment replies:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

/**
 * @route   GET /api/comments/user/:userId
 * @desc    Get comments by a user
 * @access  Public
 */
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 20, skip = 0 } = req.query;
    
    const result = await commentService.getUserComments(userId, {
      limit: parseInt(limit),
      skip: parseInt(skip)
    });
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Error getting user comments:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

/**
 * @route   GET /api/comments/user/:userId/analytics
 * @desc    Get comment analytics for a user
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
    
    const analytics = await commentService.getUserCommentAnalytics(userId);
    
    res.json({
      success: true,
      analytics
    });
  } catch (error) {
    console.error('Error getting comment analytics:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

module.exports = router;

