const ReferralChain = require('../models/ReferralChain');
const User = require('../models/User');
const Commission = require('../models/Commission');
const Post = require('../models/Post');

class EnhancedCommissionService {
  /**
   * Distribute commissions based on the new rules:
   * - First person in chain gets 20%
   * - Second-to-last person gets 30%
   * - Remaining 50% is distributed equally among middle persons
   */
  static async distributeCommissions(postId, buyerUserId, soldPrice, soldAt) {
    try {
      console.log('Starting enhanced commission distribution...');
      console.log('Post ID:', postId, 'Buyer:', buyerUserId, 'Price:', soldPrice);

      // Find all referral chains for this post
      const referralChains = await ReferralChain.find({ 
        post: postId,
        'conversion.converted': false 
      }).populate('chain.userId', 'username email');

      if (referralChains.length === 0) {
        console.log('No referral chains found for this post');
        return { success: false, message: 'No referral chains found' };
      }

      const results = [];
      let totalDistributed = 0;

      for (const chain of referralChains) {
        console.log(`Processing chain ${chain.chainId} with ${chain.chain.length} members`);
        
        const chainResult = await this.distributeChainCommission(
          chain, 
          buyerUserId, 
          soldPrice, 
          soldAt
        );
        
        results.push(chainResult);
        totalDistributed += chainResult.totalDistributed;
      }

      // Update post conversion status
      await Post.findByIdAndUpdate(postId, {
        $set: { 
          status: 'sold',
          'soldDetails.soldAt': soldAt,
          'soldDetails.soldPrice': soldPrice
        },
        $inc: { conversions: 1 }
      });

      console.log('Enhanced commission distribution completed');
      return {
        success: true,
        totalDistributed,
        chainsProcessed: results.length,
        results
      };

    } catch (error) {
      console.error('Enhanced commission distribution error:', error);
      throw error;
    }
  }

  /**
   * Distribute commission for a single referral chain
   */
  static async distributeChainCommission(chain, buyerUserId, soldPrice, soldAt) {
    try {
      const chainLength = chain.chain.length;
      console.log(`Distributing commission for chain with ${chainLength} members`);

      if (chainLength === 0) {
        return { success: false, message: 'Empty chain' };
      }

      // Calculate commission amounts
      const commissionAmounts = this.calculateCommissionAmounts(chainLength, soldPrice);
      console.log('Commission amounts:', commissionAmounts);

      const commissions = [];

      // Create commission records
      for (let i = 0; i < chainLength; i++) {
        const chainMember = chain.chain[i];
        const commissionAmount = commissionAmounts[i];
        
        if (commissionAmount > 0) {
          const commission = new Commission({
            post: chain.post,
            recipient: chainMember.userId,
            amount: commissionAmount,
            level: i + 1,
            referral: chainMember.referralId,
            commissionType: this.getCommissionType(i, chainLength),
            distributedAt: new Date()
          });

          await commission.save();
          commissions.push(commission);

          // Update user credits
          await User.findByIdAndUpdate(chainMember.userId, {
            $inc: { credits: commissionAmount }
          });

          console.log(`Commission ${commissionAmount} distributed to user ${chainMember.userId} at position ${i + 1}`);
        }
      }

      // Update chain conversion status
      await ReferralChain.findByIdAndUpdate(chain._id, {
        $set: {
          'conversion.converted': true,
          'conversion.convertedAt': soldAt,
          'conversion.convertedBy': buyerUserId,
          'conversion.conversionValue': soldPrice,
          'conversion.commissionDistributed': true,
          'conversion.commissionDetails': commissions.map(comm => ({
            userId: comm.recipient,
            position: comm.level,
            commissionAmount: comm.amount,
            commissionPercentage: (comm.amount / soldPrice) * 100,
            distributedAt: comm.distributedAt
          }))
        }
      });

      return {
        success: true,
        chainId: chain.chainId,
        totalDistributed: commissionAmounts.reduce((sum, amount) => sum + amount, 0),
        commissions: commissions.length,
        details: commissionAmounts.map((amount, index) => ({
          position: index + 1,
          userId: chain.chain[index].userId,
          amount: amount,
          percentage: (amount / soldPrice) * 100
        }))
      };

    } catch (error) {
      console.error('Chain commission distribution error:', error);
      throw error;
    }
  }

  /**
   * Calculate commission amounts based on the new rules
   */
  static calculateCommissionAmounts(chainLength, soldPrice) {
    const amounts = new Array(chainLength).fill(0);
    
    if (chainLength === 1) {
      // Single person gets 50% (since they're both first and last)
      amounts[0] = soldPrice * 0.5;
    } else if (chainLength === 2) {
      // First person gets 20%, second gets 30%
      amounts[0] = soldPrice * 0.2;
      amounts[1] = soldPrice * 0.3;
    } else {
      // First person gets 20%
      amounts[0] = soldPrice * 0.2;
      
      // Second-to-last person gets 30%
      amounts[chainLength - 2] = soldPrice * 0.3;
      
      // Remaining 50% distributed equally among middle persons
      const middlePersons = chainLength - 2; // Excluding first and second-to-last
      const middleAmount = (soldPrice * 0.5) / middlePersons;
      
      for (let i = 1; i < chainLength - 1; i++) {
        amounts[i] = middleAmount;
      }
    }

    return amounts;
  }

  /**
   * Get commission type description
   */
  static getCommissionType(position, chainLength) {
    if (position === 0) {
      return 'first_person';
    } else if (position === chainLength - 2) {
      return 'second_to_last';
    } else {
      return 'middle_person';
    }
  }

  /**
   * Get commission analytics for a post
   */
  static async getCommissionAnalytics(postId) {
    try {
      const chains = await ReferralChain.find({ post: postId })
        .populate('chain.userId', 'username email')
        .populate('originalSharer', 'username email');

      const analytics = {
        totalChains: chains.length,
        totalCommissions: 0,
        totalDistributed: 0,
        conversionRate: 0,
        chainAnalytics: [],
        userAnalytics: {},
        platformBreakdown: {},
        deviceBreakdown: {}
      };

      for (const chain of chains) {
        const chainAnalytics = {
          chainId: chain.chainId,
          length: chain.chain.length,
          converted: chain.conversion.converted,
          totalClicks: chain.totalClicks,
          totalViews: chain.totalViews,
          totalShares: chain.totalShares,
          commissionDistributed: chain.conversion.commissionDistributed,
          totalCommission: chain.conversion.commissionDetails?.reduce((sum, comm) => sum + comm.commissionAmount, 0) || 0
        };

        analytics.chainAnalytics.push(chainAnalytics);
        analytics.totalCommissions += chainAnalytics.totalCommission;

        if (chain.conversion.converted) {
          analytics.totalDistributed += chainAnalytics.totalCommission;
        }

        // User analytics
        for (const member of chain.chain) {
          const userId = member.userId._id.toString();
          if (!analytics.userAnalytics[userId]) {
            analytics.userAnalytics[userId] = {
              username: member.userId.username,
              totalClicks: 0,
              totalViews: 0,
              totalShares: 0,
              totalCommission: 0,
              chainsParticipated: 0
            };
          }

          analytics.userAnalytics[userId].totalClicks += member.clicks;
          analytics.userAnalytics[userId].totalViews += member.views;
          analytics.userAnalytics[userId].totalShares += member.shares;
          analytics.userAnalytics[userId].chainsParticipated += 1;

          // Platform and device breakdown
          if (!analytics.platformBreakdown[member.platform]) {
            analytics.platformBreakdown[member.platform] = 0;
          }
          analytics.platformBreakdown[member.platform] += 1;

          if (!analytics.deviceBreakdown[member.device]) {
            analytics.deviceBreakdown[member.device] = 0;
          }
          analytics.deviceBreakdown[member.device] += 1;
        }
      }

      // Calculate conversion rate
      const convertedChains = chains.filter(chain => chain.conversion.converted).length;
      analytics.conversionRate = chains.length > 0 ? (convertedChains / chains.length) * 100 : 0;

      return analytics;

    } catch (error) {
      console.error('Commission analytics error:', error);
      throw error;
    }
  }

  /**
   * Get user's commission history
   */
  static async getUserCommissionHistory(userId) {
    try {
      const commissions = await Commission.find({ recipient: userId })
        .populate('post', 'title category price')
        .sort({ distributedAt: -1 });

      const totalEarned = commissions.reduce((sum, comm) => sum + comm.amount, 0);

      return {
        totalCommissions: commissions.length,
        totalEarned,
        commissions: commissions.map(comm => ({
          _id: comm._id,
          post: comm.post,
          amount: comm.amount,
          level: comm.level,
          commissionType: comm.commissionType,
          distributedAt: comm.distributedAt
        }))
      };

    } catch (error) {
      console.error('User commission history error:', error);
      throw error;
    }
  }
}

module.exports = EnhancedCommissionService;
