/**
 * Social Socket Handler Service
 * Handles real-time updates for social features (likes, comments, follows)
 */

class SocialSocketHandler {
  constructor() {
    this.io = null;
  }

  /**
   * Initialize Socket.IO instance
   */
  initialize(io) {
    this.io = io;
    console.log('✅ Social Socket Handler initialized');
  }

  /**
   * Emit new like event
   */
  emitNewLike(targetType, targetId, likeData) {
    if (!this.io) return;

    try {
      // Emit to post/comment room
      this.io.to(`${targetType}_${targetId}`).emit('new_like', {
        targetType,
        targetId,
        like: likeData
      });

      console.log(`Emitted new like for ${targetType} ${targetId}`);
    } catch (error) {
      console.error('Error emitting new like:', error);
    }
  }

  /**
   * Emit like removed event
   */
  emitLikeRemoved(targetType, targetId, userId) {
    if (!this.io) return;

    try {
      this.io.to(`${targetType}_${targetId}`).emit('like_removed', {
        targetType,
        targetId,
        userId
      });

      console.log(`Emitted like removed for ${targetType} ${targetId}`);
    } catch (error) {
      console.error('Error emitting like removed:', error);
    }
  }

  /**
   * Emit new comment event
   */
  emitNewComment(postId, commentData) {
    if (!this.io) return;

    try {
      // Emit to post room
      this.io.to(`post_${postId}`).emit('new_comment', {
        postId,
        comment: commentData
      });

      console.log(`Emitted new comment for post ${postId}`);
    } catch (error) {
      console.error('Error emitting new comment:', error);
    }
  }

  /**
   * Emit new reply event
   */
  emitNewReply(postId, parentCommentId, replyData) {
    if (!this.io) return;

    try {
      this.io.to(`post_${postId}`).emit('new_reply', {
        postId,
        parentCommentId,
        reply: replyData
      });

      console.log(`Emitted new reply for comment ${parentCommentId}`);
    } catch (error) {
      console.error('Error emitting new reply:', error);
    }
  }

  /**
   * Emit comment deleted event
   */
  emitCommentDeleted(postId, commentId) {
    if (!this.io) return;

    try {
      this.io.to(`post_${postId}`).emit('comment_deleted', {
        postId,
        commentId
      });

      console.log(`Emitted comment deleted for post ${postId}`);
    } catch (error) {
      console.error('Error emitting comment deleted:', error);
    }
  }

  /**
   * Emit new follower event
   */
  emitNewFollower(userId, followerData) {
    if (!this.io) return;

    try {
      // Emit to user's room
      this.io.to(`user_${userId}`).emit('new_follower', {
        follower: followerData
      });

      console.log(`Emitted new follower for user ${userId}`);
    } catch (error) {
      console.error('Error emitting new follower:', error);
    }
  }

  /**
   * Emit unfollowed event
   */
  emitUnfollowed(userId, followerId) {
    if (!this.io) return;

    try {
      this.io.to(`user_${userId}`).emit('unfollowed', {
        followerId
      });

      console.log(`Emitted unfollowed for user ${userId}`);
    } catch (error) {
      console.error('Error emitting unfollowed:', error);
    }
  }

  /**
   * Emit follower count update
   */
  emitFollowerCountUpdate(userId, followerCount) {
    if (!this.io) return;

    try {
      this.io.to(`user_${userId}`).emit('follower_count_update', {
        followerCount
      });
    } catch (error) {
      console.error('Error emitting follower count update:', error);
    }
  }

  /**
   * Emit following count update
   */
  emitFollowingCountUpdate(userId, followingCount) {
    if (!this.io) return;

    try {
      this.io.to(`user_${userId}`).emit('following_count_update', {
        followingCount
      });
    } catch (error) {
      console.error('Error emitting following count update:', error);
    }
  }

  /**
   * Emit like count update
   */
  emitLikeCountUpdate(targetType, targetId, likeCounts) {
    if (!this.io) return;

    try {
      this.io.to(`${targetType}_${targetId}`).emit('like_count_update', {
        targetType,
        targetId,
        likeCounts
      });
    } catch (error) {
      console.error('Error emitting like count update:', error);
    }
  }

  /**
   * Emit comment count update
   */
  emitCommentCountUpdate(postId, commentCount) {
    if (!this.io) return;

    try {
      this.io.to(`post_${postId}`).emit('comment_count_update', {
        postId,
        commentCount
      });
    } catch (error) {
      console.error('Error emitting comment count update:', error);
    }
  }

  /**
   * Emit feed update (new post from followed user)
   */
  emitFeedUpdate(userId, postData) {
    if (!this.io) return;

    try {
      this.io.to(`user_${userId}`).emit('feed_update', {
        post: postData
      });

      console.log(`Emitted feed update for user ${userId}`);
    } catch (error) {
      console.error('Error emitting feed update:', error);
    }
  }

  /**
   * Broadcast to all connected users
   */
  broadcast(event, data) {
    if (!this.io) return;

    try {
      this.io.emit(event, data);
      console.log(`Broadcasted event: ${event}`);
    } catch (error) {
      console.error('Error broadcasting event:', error);
    }
  }

  /**
   * Emit to specific user
   */
  emitToUser(userId, event, data) {
    if (!this.io) return;

    try {
      this.io.to(`user_${userId}`).emit(event, data);
    } catch (error) {
      console.error('Error emitting to user:', error);
    }
  }

  /**
   * Emit to specific room
   */
  emitToRoom(room, event, data) {
    if (!this.io) return;

    try {
      this.io.to(room).emit(event, data);
    } catch (error) {
      console.error('Error emitting to room:', error);
    }
  }
}

module.exports = new SocialSocketHandler();

