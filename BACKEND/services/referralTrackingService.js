const ReferralChain = require('../models/ReferralChain');
const Post = require('../models/Post');
const User = require('../models/User');

class ReferralTrackingService {
  constructor() {
    this.io = null;
  }

  /**
   * Initialize Socket.IO instance
   */
  initialize(io) {
    this.io = io;
    console.log('✅ Referral Tracking Service initialized with Socket.IO');
  }

  /**
   * Track referral click and create chain node
   */
  async trackReferralClick(data) {
    try {
      const {
        postId,
        userId,
        referrerId,
        parentChainId,
        platform,
        deviceInfo,
        location,
        clickData,
        engagement,
        metadata
      } = data;

      // Verify post exists
      const post = await Post.findById(postId);
      if (!post) {
        throw new Error('Post not found');
      }

      // Create referral chain node
      const chainNode = await ReferralChain.create({
        post: postId,
        user: userId,
        referrer: referrerId,
        parentChain: parentChainId,
        platform: platform || 'direct',
        deviceInfo: deviceInfo || {},
        location: location || {},
        clickData: clickData || { timestamp: new Date() },
        engagement: engagement || {},
        metadata: metadata || {}
      });

      // Populate user and referrer data
      await chainNode.populate('user', 'username firstName lastName avatar');
      await chainNode.populate('referrer', 'username firstName lastName avatar');

      // Update post analytics
      await this.updatePostAnalytics(postId, chainNode);

      // Emit real-time update via Socket.IO
      this.emitReferralUpdate(postId, chainNode);

      return chainNode;
    } catch (error) {
      throw new Error(`Error tracking referral: ${error.message}`);
    }
  }

  /**
   * Update post analytics with new referral data
   */
  async updatePostAnalytics(postId, chainNode) {
    try {
      const post = await Post.findById(postId);
      if (!post) return;

      // Initialize analytics if not exists
      if (!post.analytics) {
        post.analytics = {
          totalClicks: 0,
          totalShares: 0,
          totalViews: 0,
          platforms: {},
          deviceDistribution: {},
          browserDistribution: {},
          geographicDistribution: {}
        };
      }

      // Update total clicks
      post.analytics.totalClicks = (post.analytics.totalClicks || 0) + 1;

      // Update platform distribution
      const platform = chainNode.platform || 'direct';
      post.analytics.platforms = post.analytics.platforms || {};
      post.analytics.platforms[platform] = (post.analytics.platforms[platform] || 0) + 1;

      // Update device distribution
      const deviceType = chainNode.deviceInfo?.type || 'unknown';
      post.analytics.deviceDistribution = post.analytics.deviceDistribution || {};
      post.analytics.deviceDistribution[deviceType] = (post.analytics.deviceDistribution[deviceType] || 0) + 1;

      // Update browser distribution
      const browser = chainNode.deviceInfo?.browser || 'unknown';
      post.analytics.browserDistribution = post.analytics.browserDistribution || {};
      post.analytics.browserDistribution[browser] = (post.analytics.browserDistribution[browser] || 0) + 1;

      // Update geographic distribution
      const country = chainNode.location?.country || 'unknown';
      post.analytics.geographicDistribution = post.analytics.geographicDistribution || {};
      post.analytics.geographicDistribution[country] = (post.analytics.geographicDistribution[country] || 0) + 1;

      await post.save();
    } catch (error) {
      console.error('Error updating post analytics:', error);
    }
  }

  /**
   * Get referral tree structure for a post
   */
  async getReferralTree(postId, options = {}) {
    try {
      const tree = await ReferralChain.getTreeStructure(postId);
      return tree;
    } catch (error) {
      throw new Error(`Error getting referral tree: ${error.message}`);
    }
  }

  /**
   * Get hub-and-spoke visualization data
   */
  async getHubAndSpokeData(postId) {
    try {
      const data = await ReferralChain.getHubAndSpokeData(postId);
      return data;
    } catch (error) {
      throw new Error(`Error getting hub-and-spoke data: ${error.message}`);
    }
  }

  /**
   * Get analytics for a post
   */
  async getAnalytics(postId, timeRange = null, filters = {}) {
    try {
      let analytics = await ReferralChain.getAnalytics(postId, timeRange);

      // Apply filters if provided
      if (filters.platform || filters.deviceType || filters.browser) {
        const filterQuery = { post: postId };
        
        if (filters.platform) filterQuery.platform = filters.platform;
        if (filters.deviceType) filterQuery['deviceInfo.type'] = filters.deviceType;
        if (filters.browser) filterQuery['deviceInfo.browser'] = filters.browser;

        const filteredAnalytics = await ReferralChain.getAnalytics(postId, timeRange);
        analytics = filteredAnalytics;
      }

      return analytics;
    } catch (error) {
      throw new Error(`Error getting analytics: ${error.message}`);
    }
  }

  /**
   * Get top referrers for a post
   */
  async getTopReferrers(postId, limit = 10) {
    try {
      const topReferrers = await ReferralChain.aggregate([
        { $match: { post: new mongoose.Types.ObjectId(postId), referrer: { $exists: true } } },
        { $group: { _id: '$referrer', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: limit },
        { $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }},
        { $unwind: '$user' },
        { $project: {
          userId: '$_id',
          count: 1,
          username: '$user.username',
          firstName: '$user.firstName',
          lastName: '$user.lastName',
          avatar: '$user.avatar'
        }}
      ]);

      return topReferrers;
    } catch (error) {
      throw new Error(`Error getting top referrers: ${error.message}`);
    }
  }

  /**
   * Calculate commission preview for each node
   */
  async calculateCommissionPreview(postId) {
    try {
      const post = await Post.findById(postId);
      if (!post) {
        throw new Error('Post not found');
      }

      const chains = await ReferralChain.find({ post: postId })
        .populate('user', 'username firstName lastName')
        .lean();

      const pointsPool = post.distributablePoints || 0;
      const commissionPreview = [];

      // Get all root chains (depth 0)
      const rootChains = chains.filter(c => c.chainDepth === 0);

      for (const rootChain of rootChains) {
        // Get all descendants for this root
        const descendants = chains.filter(c => {
          // Find if this chain is in the same tree as rootChain
          let current = c;
          while (current && current.chainDepth > 0) {
            if (current.parentChain?.toString() === rootChain._id.toString()) {
              return true;
            }
            current = chains.find(ch => ch._id.toString() === current.parentChain?.toString());
          }
          return false;
        });

        const chainLength = descendants.length + 1; // Including root

        if (chainLength > 0) {
          // Commission distribution logic
          const platformFee = pointsPool * 0.10; // 10% platform fee
          const distributable = pointsPool - platformFee;

          // First person (root) gets 30%
          const firstPersonShare = distributable * 0.30;
          
          // Last person gets 30%
          const lastPerson = descendants[descendants.length - 1] || rootChain;
          const lastPersonShare = distributable * 0.30;

          // Middle people share 40%
          const middleShare = distributable * 0.40;
          const middleCount = Math.max(0, chainLength - 2);
          const perMiddlePerson = middleCount > 0 ? middleShare / middleCount : 0;

          // Add to preview
          commissionPreview.push({
            chainId: rootChain._id,
            userId: rootChain.user?._id,
            username: rootChain.user?.username,
            position: 'first',
            commission: firstPersonShare,
            chainDepth: 0
          });

          // Middle people
          descendants.slice(0, -1).forEach((chain, index) => {
            commissionPreview.push({
              chainId: chain._id,
              userId: chain.user?._id,
              username: chain.user?.username,
              position: 'middle',
              commission: perMiddlePerson,
              chainDepth: chain.chainDepth
            });
          });

          // Last person (if different from first)
          if (lastPerson._id.toString() !== rootChain._id.toString()) {
            commissionPreview.push({
              chainId: lastPerson._id,
              userId: lastPerson.user?._id,
              username: lastPerson.user?.username,
              position: 'last',
              commission: lastPersonShare,
              chainDepth: lastPerson.chainDepth
            });
          }
        }
      }

      return commissionPreview;
    } catch (error) {
      throw new Error(`Error calculating commission preview: ${error.message}`);
    }
  }

  /**
   * Export referral data
   */
  async exportReferralData(postId, format = 'json') {
    try {
      const chains = await ReferralChain.find({ post: postId })
        .populate('user', 'username firstName lastName email')
        .populate('referrer', 'username firstName lastName email')
        .lean();

      if (format === 'csv') {
        // Convert to CSV
        const headers = [
          'Chain ID', 'User', 'Referrer', 'Platform', 'Device', 'Browser', 
          'Country', 'City', 'Timestamp', 'Chain Depth'
        ];

        const rows = chains.map(chain => [
          chain._id,
          chain.user?.username || chain.user?.firstName || 'Anonymous',
          chain.referrer?.username || chain.referrer?.firstName || 'N/A',
          chain.platform,
          chain.deviceInfo?.type || 'unknown',
          chain.deviceInfo?.browser || 'unknown',
          chain.location?.country || 'unknown',
          chain.location?.city || 'unknown',
          chain.clickData?.timestamp || chain.createdAt,
          chain.chainDepth
        ]);

        const csv = [headers, ...rows]
          .map(row => row.map(cell => `"${cell}"`).join(','))
          .join('\n');

        return { format: 'csv', data: csv };
      } else {
        // Return JSON
        return { format: 'json', data: chains };
      }
    } catch (error) {
      throw new Error(`Error exporting data: ${error.message}`);
    }
  }

  /**
   * Socket.IO event emitters
   */

  emitReferralUpdate(postId, chainNode) {
    if (!this.io) return;

    this.io.to(`post_${postId}`).emit('referral_update', {
      postId,
      chainNode: {
        id: chainNode._id,
        userId: chainNode.user?._id,
        username: chainNode.user?.username || chainNode.user?.firstName,
        avatar: chainNode.user?.avatar,
        referrerId: chainNode.referrer?._id,
        platform: chainNode.platform,
        deviceType: chainNode.deviceInfo?.type,
        browser: chainNode.deviceInfo?.browser,
        location: chainNode.location,
        timestamp: chainNode.clickData?.timestamp || chainNode.createdAt,
        chainDepth: chainNode.chainDepth,
        parentChainId: chainNode.parentChain
      }
    });

    console.log(`Emitted referral update for post ${postId}`);
  }

  emitAnalyticsUpdate(postId, analytics) {
    if (!this.io) return;

    this.io.to(`post_${postId}`).emit('analytics_update', {
      postId,
      analytics
    });
  }
}

module.exports = new ReferralTrackingService();

