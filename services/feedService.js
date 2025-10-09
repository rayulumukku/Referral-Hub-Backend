const SocialFeed = require('../models/SocialFeed');
const Post = require('../models/Post');
const Follow = require('../models/Follow');
const User = require('../models/User');
const Like = require('../models/Like');
const Comment = require('../models/Comment');

class FeedService {
  /**
   * Generate personalized feed for a user
   */
  async generateFeed(userId, options = {}) {
    try {
      const feedType = options.feedType || 'following';
      const limit = options.limit || 20;
      
      await SocialFeed.generateFeed(userId, { feedType, limit });
      
      return { success: true };
    } catch (error) {
      throw new Error(`Error generating feed: ${error.message}`);
    }
  }
  
  /**
   * Get personalized feed for a user
   */
  async getFeed(userId, options = {}) {
    try {
      const limit = options.limit || 20;
      const skip = options.skip || 0;
      const feedType = options.feedType || 'following';
      
      let posts = [];
      
      if (feedType === 'following') {
        posts = await this.getFollowingFeed(userId, { limit, skip });
      } else if (feedType === 'trending') {
        posts = await this.getTrendingFeed({ limit, skip });
      } else if (feedType === 'recommended') {
        posts = await this.getRecommendedFeed(userId, { limit, skip });
      } else if (feedType === 'nearby') {
        posts = await this.getNearbyFeed(userId, { limit, skip });
      } else {
        posts = await this.getFollowingFeed(userId, { limit, skip });
      }
      
      // Enrich posts with user interaction data
      const enrichedPosts = await this.enrichPostsWithUserData(posts, userId);
      
      return {
        posts: enrichedPosts,
        hasMore: enrichedPosts.length >= limit
      };
    } catch (error) {
      throw new Error(`Error getting feed: ${error.message}`);
    }
  }
  
  /**
   * Get feed from users the current user is following
   */
  async getFollowingFeed(userId, options = {}) {
    try {
      const limit = options.limit || 20;
      const skip = options.skip || 0;
      
      const following = await Follow.find({ follower: userId, status: 'active' })
        .select('following');
      
      const followingIds = following.map(f => f.following);
      
      if (followingIds.length === 0) {
        // If not following anyone, return trending posts
        return await this.getTrendingFeed({ limit, skip });
      }
      
      const posts = await Post.find({
        creator: { $in: followingIds },
        status: 'active',
        isDeleted: { $ne: true }
      })
        .populate('creator', 'username firstName lastName avatar socialStats')
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(skip)
        .lean();
      
      return posts;
    } catch (error) {
      throw new Error(`Error getting following feed: ${error.message}`);
    }
  }
  
  /**
   * Get trending posts (high engagement)
   */
  async getTrendingFeed(options = {}) {
    try {
      const limit = options.limit || 20;
      const skip = options.skip || 0;
      
      // Get posts from last 7 days
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      
      const posts = await Post.find({
        status: 'active',
        isDeleted: { $ne: true },
        createdAt: { $gte: sevenDaysAgo }
      })
        .populate('creator', 'username firstName lastName avatar socialStats')
        .sort({ 
          'analytics.engagement.likes': -1,
          'analytics.engagement.comments': -1,
          'analytics.totalViews': -1
        })
        .limit(limit)
        .skip(skip)
        .lean();
      
      return posts;
    } catch (error) {
      throw new Error(`Error getting trending feed: ${error.message}`);
    }
  }
  
  /**
   * Get recommended posts based on user interests
   */
  async getRecommendedFeed(userId, options = {}) {
    try {
      const limit = options.limit || 20;
      const skip = options.skip || 0;
      
      // Get user's liked posts to understand interests
      const userLikes = await Like.find({ user: userId, targetType: 'post' })
        .limit(50)
        .select('targetId');
      
      const likedPostIds = userLikes.map(like => like.targetId);
      
      // Get categories of liked posts
      const likedPosts = await Post.find({ _id: { $in: likedPostIds } })
        .select('category');
      
      const preferredCategories = [...new Set(likedPosts.map(p => p.category))];
      
      // Get posts from preferred categories that user hasn't liked
      const posts = await Post.find({
        status: 'active',
        isDeleted: { $ne: true },
        _id: { $nin: likedPostIds },
        ...(preferredCategories.length > 0 && { category: { $in: preferredCategories } })
      })
        .populate('creator', 'username firstName lastName avatar socialStats')
        .sort({ 
          'analytics.engagement.likes': -1,
          createdAt: -1 
        })
        .limit(limit)
        .skip(skip)
        .lean();
      
      return posts;
    } catch (error) {
      throw new Error(`Error getting recommended feed: ${error.message}`);
    }
  }
  
  /**
   * Get posts from nearby users
   */
  async getNearbyFeed(userId, options = {}) {
    try {
      const limit = options.limit || 20;
      const skip = options.skip || 0;
      
      const user = await User.findById(userId).select('location');
      
      if (!user || !user.location || !user.location.city) {
        return await this.getTrendingFeed({ limit, skip });
      }
      
      // Find users in the same city
      const nearbyUsers = await User.find({ 
        'location.city': user.location.city,
        _id: { $ne: userId }
      }).select('_id');
      
      const nearbyUserIds = nearbyUsers.map(u => u._id);
      
      const posts = await Post.find({
        creator: { $in: nearbyUserIds },
        status: 'active',
        isDeleted: { $ne: true }
      })
        .populate('creator', 'username firstName lastName avatar socialStats location')
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(skip)
        .lean();
      
      return posts;
    } catch (error) {
      throw new Error(`Error getting nearby feed: ${error.message}`);
    }
  }
  
  /**
   * Enrich posts with user-specific data (likes, comments, etc.)
   */
  async enrichPostsWithUserData(posts, userId) {
    try {
      const enrichedPosts = await Promise.all(posts.map(async (post) => {
        // Check if user has liked this post
        const userLike = await Like.findOne({
          user: userId,
          targetType: 'post',
          targetId: post._id
        });
        
        // Get like counts
        const likeCounts = await Like.getLikeCounts('post', post._id);
        
        // Get comment count
        const commentCount = await Comment.countDocuments({
          post: post._id,
          isDeleted: false
        });
        
        // Check if user is following the post creator
        const isFollowing = await Follow.isFollowing(userId, post.creator._id);
        
        return {
          ...post,
          userHasLiked: !!userLike,
          userReaction: userLike ? userLike.reactionType : null,
          likeCounts,
          commentCount,
          isFollowingCreator: isFollowing
        };
      }));
      
      return enrichedPosts;
    } catch (error) {
      console.error('Error enriching posts:', error);
      return posts;
    }
  }
  
  /**
   * Track feed engagement
   */
  async trackEngagement(userId, postId, engagementType, value = 1) {
    try {
      await SocialFeed.trackEngagement(userId, postId, engagementType, value);
      return { success: true };
    } catch (error) {
      throw new Error(`Error tracking engagement: ${error.message}`);
    }
  }
  
  /**
   * Dismiss a post from feed
   */
  async dismissPost(userId, postId) {
    try {
      await SocialFeed.dismissPost(userId, postId);
      return { success: true };
    } catch (error) {
      throw new Error(`Error dismissing post: ${error.message}`);
    }
  }
  
  /**
   * Get feed analytics
   */
  async getFeedAnalytics(userId) {
    try {
      const totalShown = await SocialFeed.countDocuments({
        user: userId,
        shown: true
      });
      
      const totalDismissed = await SocialFeed.countDocuments({
        user: userId,
        dismissed: true
      });
      
      const avgEngagement = await SocialFeed.aggregate([
        { $match: { user: userId } },
        {
          $group: {
            _id: null,
            avgClicks: { $avg: '$engagement.clicks' },
            avgViews: { $avg: '$engagement.views' },
            avgShares: { $avg: '$engagement.shares' },
            avgTimeSpent: { $avg: '$engagement.timeSpent' }
          }
        }
      ]);
      
      const feedByType = await SocialFeed.aggregate([
        { $match: { user: userId } },
        { $group: { _id: '$feedType', count: { $sum: 1 } } }
      ]);
      
      return {
        totalShown,
        totalDismissed,
        avgEngagement: avgEngagement.length > 0 ? avgEngagement[0] : {},
        feedByType: feedByType.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {})
      };
    } catch (error) {
      throw new Error(`Error getting feed analytics: ${error.message}`);
    }
  }
}

module.exports = new FeedService();

