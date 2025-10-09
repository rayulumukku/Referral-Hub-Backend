const ReferralChain = require('../models/ReferralChain');
const Commission = require('../models/Commission');
const User = require('../models/User');
const Post = require('../models/Post');
const Activity = require('../models/Activity');

class TreeCommissionService {
  // Create or update referral chain
  static async addToChain(postId, referrerId, refereeId, trackingData) {
    try {
      const post = await Post.findById(postId);
      if (!post) throw new Error('Post not found');

      // Find existing chain or create new one
      let chain = await ReferralChain.findOne({
        post: postId,
        chainHead: referrerId
      });

      if (!chain) {
        // Create new chain
        chain = new ReferralChain({
          post: postId,
          chainId: `chain_${postId}_${referrerId}_${Date.now()}`,
          originalCreator: post.creator,
          chainHead: referrerId,
          chainMembers: []
        });
      }

      // Add new member to chain
      const newMember = {
        user: refereeId,
        position: chain.chainMembers.length + 1,
        platform: trackingData.platform,
        device: trackingData.device,
        browser: trackingData.browser,
        location: {
          from: trackingData.fromLocation,
          to: trackingData.toLocation
        },
        referralLink: trackingData.referralLink,
        clickCount: 1,
        shareCount: 0,
        engagementScore: 0
      };

      chain.chainMembers.push(newMember);
      chain.totalClicks += 1;

      // Update analytics
      await this.updateChainAnalytics(chain);

      await chain.save();

      // Create activity log
      await Activity.create({
        user: refereeId,
        type: 'referral_joined',
        description: `Joined referral chain for post: ${post.title}`,
        metadata: {
          postId,
          chainId: chain.chainId,
          position: newMember.position,
          platform: trackingData.platform
        }
      });

      return chain;
    } catch (error) {
      console.error('Error adding to chain:', error);
      throw error;
    }
  }

  // Handle product purchase and commission distribution
  static async processPurchase(postId, buyerId, purchaseData) {
    try {
      const post = await Post.findById(postId);
      if (!post) throw new Error('Post not found');

      // Find all chains for this post
      const chains = await ReferralChain.find({
        post: postId,
        status: 'active'
      }).populate('chainMembers.user');

      const totalCommissions = [];

      for (const chain of chains) {
        // Check if buyer is in this chain
        const buyerInChain = chain.chainMembers.find(
          member => member.user._id.toString() === buyerId.toString()
        );

        if (buyerInChain) {
          // Mark chain as converted
          chain.conversionOccurred = true;
          chain.conversionUser = buyerId;
          chain.conversionDate = new Date();
          chain.status = 'converted';

          // Calculate commission distribution
          const commissionDistribution = await this.calculateCommissionDistribution(
            chain,
            post.pointsPool
          );

          // Create commission records
          for (const distribution of commissionDistribution) {
            const commission = new Commission({
              post: postId,
              referral: chain._id,
              recipient: distribution.user,
              amount: distribution.amount,
              percentage: distribution.percentage,
              distributionType: distribution.distributionType,
              chainPosition: distribution.position,
              totalPointsPool: post.pointsPool,
              platformFee: post.pointsPool * 0.1, // 10% platform fee
              distributableAmount: post.pointsPool * 0.9,
              status: 'pending',
              saleDetails: {
                buyer: buyerId,
                salePrice: purchaseData.salePrice,
                saleDate: new Date()
              }
            });

            await commission.save();
            totalCommissions.push(commission);
          }

          // Update chain with commission distribution
          chain.commissionDistributed = true;
          chain.commissionDistribution = commissionDistribution;
          await chain.save();

          // Create activity logs
          await this.createCommissionActivities(chain, totalCommissions);
        }
      }

      return totalCommissions;
    } catch (error) {
      console.error('Error processing purchase:', error);
      throw error;
    }
  }

  // Calculate commission distribution according to tree logic
  static async calculateCommissionDistribution(chain, totalPoints) {
    const distribution = [];
    const platformFee = totalPoints * 0.1; // 10% platform fee
    const distributableAmount = totalPoints * 0.9; // 90% for distribution

    if (chain.chainMembers.length === 0) return distribution;

    // Get the last person (who made the purchase)
    const lastPerson = chain.chainMembers[chain.chainMembers.length - 1];
    
    // Get the chain head (first person in the chain)
    const chainHead = chain.chainMembers[0];
    
    // Get middle members (everyone except first and last)
    const middleMembers = chain.chainMembers.slice(1, -1);

    // 30% to last person
    const lastPersonAmount = distributableAmount * 0.3;
    distribution.push({
      user: lastPerson.user._id,
      amount: lastPersonAmount,
      percentage: 30,
      position: lastPerson.position,
      distributionType: 'last_person'
    });

    // 20% to chain head
    const chainHeadAmount = distributableAmount * 0.2;
    distribution.push({
      user: chainHead.user._id,
      amount: chainHeadAmount,
      percentage: 20,
      position: chainHead.position,
      distributionType: 'chain_head'
    });

    // Remaining 50% split equally among middle members
    if (middleMembers.length > 0) {
      const remainingAmount = distributableAmount * 0.5;
      const amountPerMiddleMember = remainingAmount / middleMembers.length;

      middleMembers.forEach(member => {
        distribution.push({
          user: member.user._id,
          amount: amountPerMiddleMember,
          percentage: (50 / middleMembers.length),
          position: member.position,
          distributionType: 'middle_members'
        });
      });
    }

    return distribution;
  }

  // Update chain analytics
  static async updateChainAnalytics(chain) {
    const analytics = {
      platformDistribution: {},
      deviceDistribution: {},
      browserDistribution: {},
      locationDistribution: {},
      timeDistribution: {},
      engagementMetrics: {}
    };

    // Platform distribution
    chain.chainMembers.forEach(member => {
      if (member.platform) {
        analytics.platformDistribution[member.platform] = 
          (analytics.platformDistribution[member.platform] || 0) + 1;
      }
    });

    // Device distribution
    chain.chainMembers.forEach(member => {
      if (member.device) {
        analytics.deviceDistribution[member.device] = 
          (analytics.deviceDistribution[member.device] || 0) + 1;
      }
    });

    // Browser distribution
    chain.chainMembers.forEach(member => {
      if (member.browser) {
        analytics.browserDistribution[member.browser] = 
          (analytics.browserDistribution[member.browser] || 0) + 1;
      }
    });

    // Location distribution
    chain.chainMembers.forEach(member => {
      if (member.location?.to?.city) {
        const location = `${member.location.to.city}, ${member.location.to.state}`;
        analytics.locationDistribution[location] = 
          (analytics.locationDistribution[location] || 0) + 1;
      }
    });

    // Time distribution (by hour)
    chain.chainMembers.forEach(member => {
      const hour = new Date(member.joinedAt).getHours();
      analytics.timeDistribution[hour] = 
        (analytics.timeDistribution[hour] || 0) + 1;
    });

    // Engagement metrics
    analytics.engagementMetrics = {
      totalClicks: chain.totalClicks,
      totalShares: chain.totalShares,
      averageEngagement: chain.chainMembers.reduce((sum, member) => 
        sum + member.engagementScore, 0) / chain.chainMembers.length,
      conversionRate: chain.conversionOccurred ? 1 : 0
    };

    chain.analytics = analytics;
  }

  // Create commission activities
  static async createCommissionActivities(chain, commissions) {
    for (const commission of commissions) {
      await Activity.create({
        user: commission.recipient,
        type: 'commission_earned',
        description: `Earned ${commission.amount} points from referral chain`,
        metadata: {
          postId: commission.post,
          chainId: chain.chainId,
          amount: commission.amount,
          percentage: commission.percentage,
          distributionType: commission.distributionType
        }
      });
    }
  }

  // Get chain analytics for frontend
  static async getChainAnalytics(postId) {
    try {
      const chains = await ReferralChain.find({ post: postId })
        .populate('chainMembers.user', 'username email')
        .populate('originalCreator', 'username email')
        .populate('chainHead', 'username email');

      const analytics = {
        totalChains: chains.length,
        activeChains: chains.filter(c => c.status === 'active').length,
        convertedChains: chains.filter(c => c.status === 'converted').length,
        totalMembers: chains.reduce((sum, chain) => sum + chain.chainMembers.length, 0),
        totalClicks: chains.reduce((sum, chain) => sum + chain.totalClicks, 0),
        totalShares: chains.reduce((sum, chain) => sum + chain.totalShares, 0),
        conversionRate: chains.length > 0 ? 
          chains.filter(c => c.status === 'converted').length / chains.length : 0,
        platformDistribution: {},
        deviceDistribution: {},
        browserDistribution: {},
        locationDistribution: {},
        timeDistribution: {},
        topChains: chains
          .sort((a, b) => b.chainMembers.length - a.chainMembers.length)
          .slice(0, 10),
        recentActivity: chains
          .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
          .slice(0, 20)
      };

      // Aggregate analytics from all chains
      chains.forEach(chain => {
        if (chain.analytics) {
          // Platform distribution
          Object.entries(chain.analytics.platformDistribution || {}).forEach(([platform, count]) => {
            analytics.platformDistribution[platform] = 
              (analytics.platformDistribution[platform] || 0) + count;
          });

          // Device distribution
          Object.entries(chain.analytics.deviceDistribution || {}).forEach(([device, count]) => {
            analytics.deviceDistribution[device] = 
              (analytics.deviceDistribution[device] || 0) + count;
          });

          // Browser distribution
          Object.entries(chain.analytics.browserDistribution || {}).forEach(([browser, count]) => {
            analytics.browserDistribution[browser] = 
              (analytics.browserDistribution[browser] || 0) + count;
          });

          // Location distribution
          Object.entries(chain.analytics.locationDistribution || {}).forEach(([location, count]) => {
            analytics.locationDistribution[location] = 
              (analytics.locationDistribution[location] || 0) + count;
          });

          // Time distribution
          Object.entries(chain.analytics.timeDistribution || {}).forEach(([hour, count]) => {
            analytics.timeDistribution[hour] = 
              (analytics.timeDistribution[hour] || 0) + count;
          });
        }
      });

      return analytics;
    } catch (error) {
      console.error('Error getting chain analytics:', error);
      throw error;
    }
  }

  // Get user's commission summary
  static async getUserCommissionSummary(userId) {
    try {
      const commissions = await Commission.find({ recipient: userId })
        .populate('post', 'title category')
        .populate('referral', 'chainId')
        .sort({ createdAt: -1 });

      const summary = {
        totalEarned: commissions.reduce((sum, c) => sum + c.amount, 0),
        pendingAmount: commissions
          .filter(c => c.status === 'pending')
          .reduce((sum, c) => sum + c.amount, 0),
        paidAmount: commissions
          .filter(c => c.status === 'paid')
          .reduce((sum, c) => sum + c.amount, 0),
        totalCommissions: commissions.length,
        byDistributionType: {
          last_person: commissions.filter(c => c.distributionType === 'last_person').length,
          chain_head: commissions.filter(c => c.distributionType === 'chain_head').length,
          middle_members: commissions.filter(c => c.distributionType === 'middle_members').length
        },
        recentCommissions: commissions.slice(0, 20)
      };

      return { commissions, summary };
    } catch (error) {
      console.error('Error getting user commission summary:', error);
      throw error;
    }
  }
}

module.exports = TreeCommissionService;
