const Follow = require('../models/Follow');
const User = require('../models/User');
const notificationService = require('./notificationService');
const socialSocketHandler = require('./socialSocketHandler');

class FollowService {
  /**
   * Toggle follow/unfollow a user
   */
  async toggleFollow(followerId, followingId, metadata = {}) {
    try {
      if (followerId === followingId || followerId.toString() === followingId.toString()) {
        throw new Error('Users cannot follow themselves');
      }
      
      const result = await Follow.toggleFollow(followerId, followingId, metadata);
      
      // Create notification and emit real-time event if followed
      if (result.action === 'followed') {
        await notificationService.createNotification({
          recipient: followingId,
          sender: followerId,
          type: 'follow',
          message: 'started following you',
          data: {
            followId: result.follow._id
          }
        });
        
        // Emit real-time event
        const follower = await User.findById(followerId).select('username firstName lastName avatar socialStats');
        socialSocketHandler.emitNewFollower(followingId, follower);
      } else if (result.action === 'unfollowed') {
        // Emit unfollowed event
        socialSocketHandler.emitUnfollowed(followingId, followerId);
      }
      
      return result;
    } catch (error) {
      throw new Error(`Error toggling follow: ${error.message}`);
    }
  }
  
  /**
   * Check if user is following another user
   */
  async isFollowing(followerId, followingId) {
    try {
      return await Follow.isFollowing(followerId, followingId);
    } catch (error) {
      throw new Error(`Error checking follow status: ${error.message}`);
    }
  }
  
  /**
   * Get user's followers
   */
  async getFollowers(userId, options = {}) {
    try {
      const limit = options.limit || 20;
      const skip = options.skip || 0;
      
      const follows = await Follow.find({ following: userId, status: 'active' })
        .populate('follower', 'username firstName lastName avatar socialStats bio')
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(skip)
        .lean();
      
      const total = await Follow.countDocuments({ following: userId, status: 'active' });
      
      const followers = follows.map(f => f.follower);
      
      return {
        followers,
        total,
        hasMore: total > skip + limit
      };
    } catch (error) {
      throw new Error(`Error getting followers: ${error.message}`);
    }
  }
  
  /**
   * Get users that a user is following
   */
  async getFollowing(userId, options = {}) {
    try {
      const limit = options.limit || 20;
      const skip = options.skip || 0;
      
      const follows = await Follow.find({ follower: userId, status: 'active' })
        .populate('following', 'username firstName lastName avatar socialStats bio')
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(skip)
        .lean();
      
      const total = await Follow.countDocuments({ follower: userId, status: 'active' });
      
      const following = follows.map(f => f.following);
      
      return {
        following,
        total,
        hasMore: total > skip + limit
      };
    } catch (error) {
      throw new Error(`Error getting following: ${error.message}`);
    }
  }
  
  /**
   * Get mutual followers (users who follow each other)
   */
  async getMutualFollowers(userId1, userId2) {
    try {
      const mutualIds = await Follow.getMutualFollowers(userId1, userId2);
      
      const users = await User.find({ _id: { $in: mutualIds } })
        .select('username firstName lastName avatar socialStats')
        .lean();
      
      return users;
    } catch (error) {
      throw new Error(`Error getting mutual followers: ${error.message}`);
    }
  }
  
  /**
   * Get follow suggestions for a user
   */
  async getSuggestions(userId, options = {}) {
    try {
      const limit = options.limit || 10;
      
      const suggestions = await Follow.getSuggestions(userId, limit);
      
      return suggestions;
    } catch (error) {
      throw new Error(`Error getting suggestions: ${error.message}`);
    }
  }
  
  /**
   * Update follow settings (notifications, mute, etc.)
   */
  async updateFollowSettings(followerId, followingId, settings) {
    try {
      const follow = await Follow.findOne({ follower: followerId, following: followingId });
      
      if (!follow) {
        throw new Error('Follow relationship not found');
      }
      
      if (settings.notifications !== undefined) {
        follow.notifications = settings.notifications;
      }
      
      if (settings.status && ['active', 'blocked', 'muted'].includes(settings.status)) {
        follow.status = settings.status;
      }
      
      await follow.save();
      
      return follow;
    } catch (error) {
      throw new Error(`Error updating follow settings: ${error.message}`);
    }
  }
  
  /**
   * Block a user
   */
  async blockUser(userId, targetUserId) {
    try {
      // Remove any existing follow relationships
      await Follow.deleteMany({
        $or: [
          { follower: userId, following: targetUserId },
          { follower: targetUserId, following: userId }
        ]
      });
      
      // Create a blocked follow entry
      await Follow.create({
        follower: userId,
        following: targetUserId,
        status: 'blocked'
      });
      
      return { success: true };
    } catch (error) {
      throw new Error(`Error blocking user: ${error.message}`);
    }
  }
  
  /**
   * Unblock a user
   */
  async unblockUser(userId, targetUserId) {
    try {
      await Follow.deleteOne({
        follower: userId,
        following: targetUserId,
        status: 'blocked'
      });
      
      return { success: true };
    } catch (error) {
      throw new Error(`Error unblocking user: ${error.message}`);
    }
  }
  
  /**
   * Get blocked users
   */
  async getBlockedUsers(userId) {
    try {
      const blocks = await Follow.find({ follower: userId, status: 'blocked' })
        .populate('following', 'username firstName lastName avatar')
        .lean();
      
      return blocks.map(b => b.following);
    } catch (error) {
      throw new Error(`Error getting blocked users: ${error.message}`);
    }
  }
  
  /**
   * Check if a user is blocked
   */
  async isBlocked(userId, targetUserId) {
    try {
      const block = await Follow.findOne({
        follower: userId,
        following: targetUserId,
        status: 'blocked'
      });
      
      return !!block;
    } catch (error) {
      throw new Error(`Error checking block status: ${error.message}`);
    }
  }
  
  /**
   * Get follow analytics for a user
   */
  async getFollowAnalytics(userId) {
    try {
      const followerCount = await Follow.countDocuments({ 
        following: userId, 
        status: 'active' 
      });
      
      const followingCount = await Follow.countDocuments({ 
        follower: userId, 
        status: 'active' 
      });
      
      // Get follower growth over time (last 30 days)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const recentFollowers = await Follow.countDocuments({
        following: userId,
        status: 'active',
        createdAt: { $gte: thirtyDaysAgo }
      });
      
      // Get mutual followers count
      const followers = await Follow.find({ following: userId }).select('follower');
      const followerIds = followers.map(f => f.follower.toString());
      
      const following = await Follow.find({ follower: userId }).select('following');
      const followingIds = following.map(f => f.following.toString());
      
      const mutualCount = followerIds.filter(id => followingIds.includes(id)).length;
      
      return {
        followerCount,
        followingCount,
        mutualCount,
        recentFollowers,
        followerToFollowingRatio: followingCount > 0 ? (followerCount / followingCount).toFixed(2) : 0
      };
    } catch (error) {
      throw new Error(`Error getting follow analytics: ${error.message}`);
    }
  }
}

module.exports = new FollowService();

