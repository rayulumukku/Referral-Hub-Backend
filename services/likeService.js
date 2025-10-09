const Like = require('../models/Like');
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const User = require('../models/User');
const notificationService = require('./notificationService');
const socialSocketHandler = require('./socialSocketHandler');

class LikeService {
  /**
   * Toggle like on a post or comment
   */
  async toggleLike(userId, targetType, targetId, reactionType = 'like', metadata = {}) {
    try {
      // Toggle the like
      const result = await Like.toggleLike(userId, targetType, targetId, reactionType, metadata);
      
      // Update the target's like count
      await this.updateLikeCount(targetType, targetId);
      
      // Create notification if it's a new like
      if (result.action === 'liked' || result.action === 'reacted') {
        await this.createLikeNotification(userId, targetType, targetId, reactionType);
        
        // Emit real-time event
        socialSocketHandler.emitNewLike(targetType, targetId, result.like);
      } else if (result.action === 'unliked') {
        // Emit like removed event
        socialSocketHandler.emitLikeRemoved(targetType, targetId, userId);
      }
      
      return result;
    } catch (error) {
      throw new Error(`Error toggling like: ${error.message}`);
    }
  }
  
  /**
   * Update like count on the target (post or comment)
   */
  async updateLikeCount(targetType, targetId) {
    try {
      const count = await Like.countDocuments({ 
        targetType, 
        targetId 
      });
      
      if (targetType === 'post') {
        await Post.findByIdAndUpdate(targetId, {
          'analytics.engagement.likes': count
        });
      } else if (targetType === 'comment') {
        const comment = await Comment.findById(targetId);
        if (comment) {
          await comment.updateLikeCount();
        }
      }
    } catch (error) {
      console.error('Error updating like count:', error);
    }
  }
  
  /**
   * Create notification for like
   */
  async createLikeNotification(userId, targetType, targetId, reactionType) {
    try {
      let target;
      let recipientId;
      let message;
      
      if (targetType === 'post') {
        target = await Post.findById(targetId).select('creator title');
        recipientId = target.creator;
        message = `reacted ${reactionType} to your post "${target.title}"`;
      } else if (targetType === 'comment') {
        target = await Comment.findById(targetId).populate('author', '_id').select('author content');
        recipientId = target.author._id;
        message = `reacted ${reactionType} to your comment`;
      }
      
      // Don't notify if user liked their own content
      if (recipientId && recipientId.toString() !== userId.toString()) {
        await notificationService.createNotification({
          recipient: recipientId,
          sender: userId,
          type: 'like',
          message,
          data: {
            targetType,
            targetId,
            reactionType
          }
        });
      }
    } catch (error) {
      console.error('Error creating like notification:', error);
    }
  }
  
  /**
   * Get like counts for a target
   */
  async getLikeCounts(targetType, targetId) {
    try {
      return await Like.getLikeCounts(targetType, targetId);
    } catch (error) {
      throw new Error(`Error getting like counts: ${error.message}`);
    }
  }
  
  /**
   * Check if user has liked a target
   */
  async hasUserLiked(userId, targetType, targetId) {
    try {
      return await Like.hasUserLiked(userId, targetType, targetId);
    } catch (error) {
      throw new Error(`Error checking user like: ${error.message}`);
    }
  }
  
  /**
   * Get all likes for a target with user details
   */
  async getLikes(targetType, targetId, options = {}) {
    try {
      const limit = options.limit || 50;
      const skip = options.skip || 0;
      
      const likes = await Like.find({ targetType, targetId })
        .populate('user', 'username firstName lastName avatar')
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(skip)
        .lean();
      
      const total = await Like.countDocuments({ targetType, targetId });
      
      return {
        likes,
        total,
        hasMore: total > skip + limit
      };
    } catch (error) {
      throw new Error(`Error getting likes: ${error.message}`);
    }
  }
  
  /**
   * Get user's liked posts
   */
  async getUserLikedPosts(userId, options = {}) {
    try {
      const limit = options.limit || 20;
      const skip = options.skip || 0;
      
      const likes = await Like.find({ 
        user: userId, 
        targetType: 'post' 
      })
        .populate({
          path: 'targetId',
          model: 'Post',
          populate: {
            path: 'creator',
            select: 'username firstName lastName avatar'
          }
        })
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(skip)
        .lean();
      
      const posts = likes.map(like => like.targetId).filter(post => post !== null);
      
      return posts;
    } catch (error) {
      throw new Error(`Error getting user liked posts: ${error.message}`);
    }
  }
  
  /**
   * Get like analytics for a user
   */
  async getUserLikeAnalytics(userId) {
    try {
      const totalLikesGiven = await Like.countDocuments({ user: userId });
      
      const likesReceived = await Like.aggregate([
        {
          $lookup: {
            from: 'posts',
            localField: 'targetId',
            foreignField: '_id',
            as: 'post'
          }
        },
        {
          $match: {
            targetType: 'post',
            'post.creator': userId
          }
        },
        {
          $count: 'total'
        }
      ]);
      
      const totalLikesReceived = likesReceived.length > 0 ? likesReceived[0].total : 0;
      
      const reactionBreakdown = await Like.aggregate([
        { $match: { user: userId } },
        { $group: { _id: '$reactionType', count: { $sum: 1 } } }
      ]);
      
      return {
        totalLikesGiven,
        totalLikesReceived,
        reactionBreakdown: reactionBreakdown.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {})
      };
    } catch (error) {
      throw new Error(`Error getting like analytics: ${error.message}`);
    }
  }
}

module.exports = new LikeService();

