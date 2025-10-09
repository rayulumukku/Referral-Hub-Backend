const Comment = require('../models/Comment');
const Post = require('../models/Post');
const User = require('../models/User');
const notificationService = require('./notificationService');
const socialSocketHandler = require('./socialSocketHandler');

class CommentService {
  /**
   * Create a new comment
   */
  async createComment(postId, authorId, content, parentCommentId = null, metadata = {}) {
    try {
      // Validate post exists
      const post = await Post.findById(postId);
      if (!post) {
        throw new Error('Post not found');
      }
      
      // Validate parent comment if provided
      if (parentCommentId) {
        const parentComment = await Comment.findById(parentCommentId);
        if (!parentComment) {
          throw new Error('Parent comment not found');
        }
        if (parentComment.post.toString() !== postId) {
          throw new Error('Parent comment does not belong to this post');
        }
      }
      
      // Create comment
      const comment = await Comment.create({
        post: postId,
        author: authorId,
        content,
        parentComment: parentCommentId,
        metadata
      });
      
      // Populate author
      await comment.populate('author', 'username firstName lastName avatar');
      
      // Update post comment count
      await this.updatePostCommentCount(postId);
      
      // Update user comment count
      await User.findByIdAndUpdate(authorId, {
        $inc: { 'socialStats.commentCount': 1 }
      });
      
      // Create notifications
      await this.createCommentNotifications(comment, parentCommentId);
      
      // Emit real-time event
      if (parentCommentId) {
        socialSocketHandler.emitNewReply(postId, parentCommentId, comment);
      } else {
        socialSocketHandler.emitNewComment(postId, comment);
      }
      
      return comment;
    } catch (error) {
      throw new Error(`Error creating comment: ${error.message}`);
    }
  }
  
  /**
   * Update comment
   */
  async updateComment(commentId, userId, content) {
    try {
      const comment = await Comment.findById(commentId);
      
      if (!comment) {
        throw new Error('Comment not found');
      }
      
      if (comment.author.toString() !== userId.toString()) {
        throw new Error('Unauthorized to update this comment');
      }
      
      comment.content = content;
      comment.isEdited = true;
      comment.editedAt = new Date();
      await comment.save();
      
      await comment.populate('author', 'username firstName lastName avatar');
      
      return comment;
    } catch (error) {
      throw new Error(`Error updating comment: ${error.message}`);
    }
  }
  
  /**
   * Delete comment (soft delete)
   */
  async deleteComment(commentId, userId) {
    try {
      const comment = await Comment.findById(commentId);
      
      if (!comment) {
        throw new Error('Comment not found');
      }
      
      if (comment.author.toString() !== userId.toString()) {
        throw new Error('Unauthorized to delete this comment');
      }
      
      await comment.softDelete();
      
      // Update post comment count
      await this.updatePostCommentCount(comment.post);
      
      // Update user comment count
      await User.findByIdAndUpdate(userId, {
        $inc: { 'socialStats.commentCount': -1 }
      });
      
      // Emit real-time event
      socialSocketHandler.emitCommentDeleted(comment.post, commentId);
      
      return { success: true };
    } catch (error) {
      throw new Error(`Error deleting comment: ${error.message}`);
    }
  }
  
  /**
   * Get comments for a post
   */
  async getPostComments(postId, options = {}) {
    try {
      const limit = options.limit || 20;
      const skip = options.skip || 0;
      const sortBy = options.sortBy || 'createdAt';
      const sortOrder = options.sortOrder || -1;
      
      const comments = await Comment.getCommentTree(postId, { limit, skip });
      
      const total = await Comment.countDocuments({ 
        post: postId, 
        parentComment: null,
        isDeleted: false 
      });
      
      return {
        comments,
        total,
        hasMore: total > skip + limit
      };
    } catch (error) {
      throw new Error(`Error getting comments: ${error.message}`);
    }
  }
  
  /**
   * Get replies for a comment
   */
  async getCommentReplies(commentId, options = {}) {
    try {
      const limit = options.limit || 10;
      const skip = options.skip || 0;
      
      const replies = await Comment.find({ 
        parentComment: commentId,
        isDeleted: false 
      })
        .populate('author', 'username firstName lastName avatar')
        .sort({ createdAt: 1 })
        .limit(limit)
        .skip(skip)
        .lean();
      
      const total = await Comment.countDocuments({ 
        parentComment: commentId,
        isDeleted: false 
      });
      
      return {
        replies,
        total,
        hasMore: total > skip + limit
      };
    } catch (error) {
      throw new Error(`Error getting replies: ${error.message}`);
    }
  }
  
  /**
   * Get user's comments
   */
  async getUserComments(userId, options = {}) {
    try {
      const limit = options.limit || 20;
      const skip = options.skip || 0;
      
      const comments = await Comment.find({ 
        author: userId,
        isDeleted: false 
      })
        .populate('post', 'title category')
        .populate('author', 'username firstName lastName avatar')
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(skip)
        .lean();
      
      const total = await Comment.countDocuments({ 
        author: userId,
        isDeleted: false 
      });
      
      return {
        comments,
        total,
        hasMore: total > skip + limit
      };
    } catch (error) {
      throw new Error(`Error getting user comments: ${error.message}`);
    }
  }
  
  /**
   * Update post comment count
   */
  async updatePostCommentCount(postId) {
    try {
      const count = await Comment.countDocuments({ 
        post: postId,
        isDeleted: false 
      });
      
      await Post.findByIdAndUpdate(postId, {
        'analytics.engagement.comments': count
      });
    } catch (error) {
      console.error('Error updating post comment count:', error);
    }
  }
  
  /**
   * Create notifications for comment
   */
  async createCommentNotifications(comment, parentCommentId) {
    try {
      const post = await Post.findById(comment.post).select('creator title');
      
      // Notify post author
      if (post.creator.toString() !== comment.author._id.toString()) {
        await notificationService.createNotification({
          recipient: post.creator,
          sender: comment.author._id,
          type: 'comment',
          message: `commented on your post "${post.title}"`,
          data: {
            postId: comment.post,
            commentId: comment._id
          }
        });
      }
      
      // Notify parent comment author if it's a reply
      if (parentCommentId) {
        const parentComment = await Comment.findById(parentCommentId).select('author');
        if (parentComment && parentComment.author.toString() !== comment.author._id.toString()) {
          await notificationService.createNotification({
            recipient: parentComment.author,
            sender: comment.author._id,
            type: 'reply',
            message: `replied to your comment`,
            data: {
              postId: comment.post,
              commentId: comment._id,
              parentCommentId
            }
          });
        }
      }
      
      // Notify mentioned users
      if (comment.mentions && comment.mentions.length > 0) {
        for (const mentionedUserId of comment.mentions) {
          if (mentionedUserId.toString() !== comment.author._id.toString()) {
            await notificationService.createNotification({
              recipient: mentionedUserId,
              sender: comment.author._id,
              type: 'mention',
              message: `mentioned you in a comment`,
              data: {
                postId: comment.post,
                commentId: comment._id
              }
            });
          }
        }
      }
    } catch (error) {
      console.error('Error creating comment notifications:', error);
    }
  }
  
  /**
   * Get comment analytics for a user
   */
  async getUserCommentAnalytics(userId) {
    try {
      const totalComments = await Comment.countDocuments({ 
        author: userId,
        isDeleted: false 
      });
      
      const totalReplies = await Comment.countDocuments({ 
        author: userId,
        parentComment: { $ne: null },
        isDeleted: false 
      });
      
      const totalTopLevelComments = totalComments - totalReplies;
      
      const avgLikesPerComment = await Comment.aggregate([
        { $match: { author: userId, isDeleted: false } },
        { $group: { _id: null, avgLikes: { $avg: '$likeCount' } } }
      ]);
      
      return {
        totalComments,
        totalReplies,
        totalTopLevelComments,
        avgLikesPerComment: avgLikesPerComment.length > 0 ? Math.round(avgLikesPerComment[0].avgLikes) : 0
      };
    } catch (error) {
      throw new Error(`Error getting comment analytics: ${error.message}`);
    }
  }
}

module.exports = new CommentService();

