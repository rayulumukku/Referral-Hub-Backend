const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Comment = require('../models/Comment');
const Like = require('../models/Like');
const Bookmark = require('../models/Bookmark');
const Post = require('../models/Post');
const NotificationService = require('../services/notificationService');

// Get comments for a post
router.get('/posts/:postId/comments', async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const postId = req.params.postId;

    const comments = await Comment.find({
      post: postId,
      isDeleted: false,
      parentComment: null // Only top-level comments
    })
    .populate('author', 'username')
    .populate({
      path: 'replies',
      populate: { path: 'author', select: 'username' }
    })
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

    const total = await Comment.countDocuments({
      post: postId,
      isDeleted: false,
      parentComment: null
    });

    res.json({
      comments,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalComments: total,
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create a comment
router.post('/posts/:postId/comments', auth, async (req, res) => {
  try {
    const { content, parentCommentId } = req.body;
    const postId = req.params.postId;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ message: 'Comment content is required' });
    }

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const comment = new Comment({
      post: postId,
      author: req.user.id,
      content: content.trim(),
      parentComment: parentCommentId || null,
      metadata: {
        platform: req.headers['user-agent']?.split(' ')[0] || 'unknown',
        device: req.headers['user-agent']?.includes('Mobile') ? 'mobile' : 'desktop',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    await comment.save();

    // If it's a reply, add to parent comment's replies
    if (parentCommentId) {
      await Comment.findByIdAndUpdate(parentCommentId, {
        $push: { replies: comment._id }
      });
    }

    // Populate author info
    await comment.populate('author', 'username');

    // Send notification to post creator (if not the commenter)
    if (post.creator.toString() !== req.user.id) {
      await NotificationService.notifyCommentReceived(post, req.user, content);
    }

    res.status(201).json(comment);
  } catch (error) {
    console.error('Error creating comment:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update a comment
router.put('/comments/:commentId', auth, async (req, res) => {
  try {
    const { content } = req.body;
    const commentId = req.params.commentId;

    const comment = await Comment.findOne({
      _id: commentId,
      author: req.user.id,
      isDeleted: false
    });

    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    comment.content = content.trim();
    comment.isEdited = true;
    comment.editedAt = new Date();

    await comment.save();
    await comment.populate('author', 'username');

    res.json(comment);
  } catch (error) {
    console.error('Error updating comment:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete a comment
router.delete('/comments/:commentId', auth, async (req, res) => {
  try {
    const commentId = req.params.commentId;

    const comment = await Comment.findOne({
      _id: commentId,
      author: req.user.id,
      isDeleted: false
    });

    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    comment.isDeleted = true;
    comment.deletedAt = new Date();
    await comment.save();

    res.json({ message: 'Comment deleted' });
  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Like/Unlike a comment
router.post('/comments/:commentId/like', auth, async (req, res) => {
  try {
    const commentId = req.params.commentId;
    const userId = req.user.id;

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    const isLiked = comment.isLikedBy(userId);

    if (isLiked) {
      await comment.removeLike(userId);
      res.json({ action: 'unliked', likeCount: comment.likes.length });
    } else {
      await comment.addLike(userId);
      res.json({ action: 'liked', likeCount: comment.likes.length });
    }
  } catch (error) {
    console.error('Error toggling comment like:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Like/Unlike a post
router.post('/posts/:postId/like', auth, async (req, res) => {
  try {
    const postId = req.params.postId;
    const userId = req.user.id;
    const { type = 'like' } = req.body;

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const result = await Like.toggleLike(userId, postId, type);
    const likeCount = await Like.getLikeCount(postId);

    // Send notification if liked (not unliked)
    if (result.action === 'added' && post.creator.toString() !== userId) {
      await NotificationService.notifyLikeReceived(post, req.user);
    }

    res.json({
      action: result.action,
      likeCount,
      like: result.like
    });
  } catch (error) {
    console.error('Error toggling post like:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Check if user liked a post
router.get('/posts/:postId/like', auth, async (req, res) => {
  try {
    const postId = req.params.postId;
    const userId = req.user.id;

    const hasLiked = await Like.hasLiked(userId, postId);
    const likeCount = await Like.getLikeCount(postId);

    res.json({ hasLiked, likeCount });
  } catch (error) {
    console.error('Error checking like status:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Bookmark/Unbookmark a post
router.post('/posts/:postId/bookmark', auth, async (req, res) => {
  try {
    const postId = req.params.postId;
    const userId = req.user.id;
    const { collection = 'default', notes = '', tags = [] } = req.body;

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const result = await Bookmark.toggleBookmark(userId, postId, collection, notes, tags);

    res.json({
      action: result.action,
      bookmark: result.bookmark
    });
  } catch (error) {
    console.error('Error toggling bookmark:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Check if user bookmarked a post
router.get('/posts/:postId/bookmark', auth, async (req, res) => {
  try {
    const postId = req.params.postId;
    const userId = req.user.id;

    const hasBookmarked = await Bookmark.hasBookmarked(userId, postId);

    res.json({ hasBookmarked });
  } catch (error) {
    console.error('Error checking bookmark status:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user's bookmarks
router.get('/bookmarks', auth, async (req, res) => {
  try {
    const { collection, page = 1, limit = 10 } = req.query;
    const userId = req.user.id;

    const bookmarks = await Bookmark.getUserBookmarks(userId, collection)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Bookmark.countDocuments(
      collection ? { user: userId, collection } : { user: userId }
    );

    res.json({
      bookmarks,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalBookmarks: total,
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    console.error('Error fetching bookmarks:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user's bookmark collections
router.get('/bookmarks/collections', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const collections = await Bookmark.getUserCollections(userId);

    res.json({ collections });
  } catch (error) {
    console.error('Error fetching bookmark collections:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;