const Commission = require('../models/Commission');
const Referral = require('../models/Referral');
const User = require('../models/User');
const Post = require('../models/Post');

class CommissionService {
  // Calculate platform fee and distributable points
  static calculateDistribution(pointsPool) {
    const platformFee = Math.floor(pointsPool * 0.1); // 10% platform fee
    const distributableAmount = pointsPool - platformFee;

    return {
      pointsPool,
      platformFee,
      distributableAmount
    };
  }

  // Find the referral chain that led to the sale
  static async findSaleChain(postId, buyerUserId) {
    // Find all referrals for this post
    const allReferrals = await Referral.find({ post: postId })
      .populate('referrer')
      .populate('referee')
      .sort({ timestamp: 1 });

    // Find referrals where the referee (buyer) was involved
    const buyerReferrals = allReferrals.filter(ref =>
      ref.referee && ref.referee._id.toString() === buyerUserId.toString()
    );

    if (buyerReferrals.length === 0) {
      return null; // No direct referral found
    }

    // For simplicity, take the most recent referral to the buyer
    const saleReferral = buyerReferrals[buyerReferrals.length - 1];

    // Build the chain backwards from the sale referral
    const chain = [saleReferral];
    let currentReferral = saleReferral;

    while (currentReferral.parentReferral) {
      const parent = await Referral.findById(currentReferral.parentReferral)
        .populate('referrer')
        .populate('referee');
      if (parent) {
        chain.unshift(parent); // Add to beginning
        currentReferral = parent;
      } else {
        break;
      }
    }

    return {
      chain,
      saleReferral,
      buyer: saleReferral.referee
    };
  }

  // Distribute points according to the algorithm
  static async distributePoints(postId, buyerUserId, soldPrice, soldAt) {
    const post = await Post.findById(postId).populate('creator');
    if (!post) {
      throw new Error('Post not found');
    }

    const distribution = this.calculateDistribution(post.pointsPool);

    // Find the successful referral chain
    const saleData = await this.findSaleChain(postId, buyerUserId);

    if (!saleData) {
      // No referral chain found - all distributable points go to platform
      await this.createCommission({
        post: postId,
        recipient: null, // Platform
        amount: distribution.distributableAmount,
        percentage: 100,
        distributionType: 'platform_fee',
        totalPointsPool: distribution.pointsPool,
        platformFee: distribution.platformFee,
        distributableAmount: distribution.distributableAmount,
        saleDetails: {
          soldAt,
          buyerInfo: { name: 'Unknown', email: 'Unknown' },
          soldPrice
        }
      });
      return;
    }

    const { chain, saleReferral } = saleData;

    // Updated distribution logic: First sharer 20%, Last person 30%
    if (chain.length === 0) {
      // No referrals - all points go to platform
      await this.createCommission({
        post: postId,
        recipient: null,
        amount: distribution.distributableAmount,
        percentage: 100,
        distributionType: 'platform_fee',
        totalPointsPool: distribution.pointsPool,
        platformFee: distribution.platformFee,
        distributableAmount: distribution.distributableAmount,
        saleDetails: {
          soldAt,
          buyerInfo: {
            name: saleReferral?.referee?.username || 'Unknown',
            email: saleReferral?.referee?.email || 'Unknown'
          },
          soldPrice
        }
      });
      return;
    } else if (chain.length === 1) {
      // Only one referral - they get 50% of distributable points
      const amount = Math.floor(distribution.distributableAmount * 0.5);
      await this.createCommission({
        post: postId,
        referral: chain[0]._id,
        recipient: chain[0].referrer,
        amount,
        percentage: 50,
        distributionType: 'single_referral',
        chainPosition: 0,
        totalPointsPool: distribution.pointsPool,
        platformFee: distribution.platformFee,
        distributableAmount: distribution.distributableAmount,
        saleDetails: {
          soldAt,
          buyerInfo: {
            name: saleReferral?.referee?.username || 'Unknown',
            email: saleReferral?.referee?.email || 'Unknown'
          },
          soldPrice
        }
      });
    } else {
      // Multiple referrals - First gets 20%, Last gets 30%, rest share equally
      const firstAmount = Math.floor(distribution.distributableAmount * 0.2); // 20%
      const lastAmount = Math.floor(distribution.distributableAmount * 0.3);  // 30%
      const remainingAmount = distribution.distributableAmount - firstAmount - lastAmount;
      const middleAmount = chain.length > 2 ? Math.floor(remainingAmount / (chain.length - 2)) : 0;

      // First referral gets 20%
      await this.createCommission({
        post: postId,
        referral: chain[0]._id,
        recipient: chain[0].referrer,
        amount: firstAmount,
        percentage: 20,
        distributionType: 'first_sharer',
        chainPosition: 0,
        totalPointsPool: distribution.pointsPool,
        platformFee: distribution.platformFee,
        distributableAmount: distribution.distributableAmount,
        saleDetails: {
          soldAt,
          buyerInfo: {
            name: saleReferral?.referee?.username || 'Unknown',
            email: saleReferral?.referee?.email || 'Unknown'
          },
          soldPrice
        }
      });

      // Last referral gets 30%
      const lastIndex = chain.length - 1;
      await this.createCommission({
        post: postId,
        referral: chain[lastIndex]._id,
        recipient: chain[lastIndex].referrer,
        amount: lastAmount,
        percentage: 30,
        distributionType: 'last_person',
        chainPosition: lastIndex,
        totalPointsPool: distribution.pointsPool,
        platformFee: distribution.platformFee,
        distributableAmount: distribution.distributableAmount,
        saleDetails: {
          soldAt,
          buyerInfo: {
            name: saleReferral?.referee?.username || 'Unknown',
            email: saleReferral?.referee?.email || 'Unknown'
          },
          soldPrice
        }
      });

      // Middle referrals share equally (if more than 2 total)
      if (chain.length > 2) {
        for (let i = 1; i < chain.length - 1; i++) {
          await this.createCommission({
            post: postId,
            referral: chain[i]._id,
            recipient: chain[i].referrer,
            amount: middleAmount,
            percentage: Math.floor((middleAmount / distribution.distributableAmount) * 100),
            distributionType: 'middle_share',
            chainPosition: i,
            totalPointsPool: distribution.pointsPool,
            platformFee: distribution.platformFee,
            distributableAmount: distribution.distributableAmount,
            saleDetails: {
              soldAt,
              buyerInfo: {
                name: saleReferral?.referee?.username || 'Unknown',
                email: saleReferral?.referee?.email || 'Unknown'
              },
              soldPrice
            }
          });
        }
      }
    }

    // Platform fee commission (10%)
    await this.createCommission({
      post: postId,
      recipient: null,
      amount: distribution.platformFee,
      percentage: 10,
      distributionType: 'platform_fee',
      totalPointsPool: distribution.pointsPool,
      platformFee: distribution.platformFee,
      distributableAmount: distribution.distributableAmount,
      saleDetails: {
        soldAt,
        buyerInfo: {
          name: saleReferral?.referee?.username || 'Unknown',
          email: saleReferral?.referee?.email || 'Unknown'
        },
        soldPrice
      }
    });

    // Remove the post creator from the chain (they don't get commission)
    const filteredChain = chain.filter(ref =>
      ref.referrer._id.toString() !== post.creator._id.toString()
    );

    if (filteredChain.length === 0) {
      // Only the creator was involved - all points to platform
      await this.createCommission({
        post: postId,
        recipient: null,
        amount: distribution.distributableAmount,
        percentage: 100,
        distributionType: 'platform_fee',
        totalPointsPool: distribution.pointsPool,
        platformFee: distribution.platformFee,
        distributableAmount: distribution.distributableAmount,
        saleDetails: {
          soldAt,
          buyerInfo: {
            name: saleReferral.referee?.username || 'Unknown',
            email: saleReferral.referee?.email || 'Unknown'
          },
          soldPrice
        }
      });
      return;
    }

    // Simplified commission system:
    // - 30% to the person who directly shared to the buyer (right person)
    // - 20% to each person in the referral chain (correct chain sharing)

    const directReferrer = saleReferral; // The person who directly referred the buyer
    const chainMembers = filteredChain.filter(ref => ref._id.toString() !== directReferrer._id.toString());

    // 30% to direct referrer (right person)
    const directReferrerAmount = Math.floor(distribution.distributableAmount * 0.3);
    if (directReferrer.referrer) {
      await this.createCommission({
        post: postId,
        referral: directReferrer._id,
        recipient: directReferrer.referrer._id,
        amount: directReferrerAmount,
        percentage: 30,
        distributionType: 'direct_referral',
        chainPosition: filteredChain.length, // Last in chain
        totalPointsPool: distribution.pointsPool,
        platformFee: distribution.platformFee,
        distributableAmount: distribution.distributableAmount,
        saleDetails: {
          soldAt,
          buyerInfo: {
            name: saleReferral.referee?.username || 'Unknown',
            email: saleReferral.referee?.email || 'Unknown'
          },
          soldPrice
        }
      });
    }

    // 20% to each remaining chain member (correct chain sharing)
    const remainingAmount = distribution.distributableAmount - directReferrerAmount;
    if (chainMembers.length > 0 && remainingAmount > 0) {
      const amountPerChainMember = Math.floor(remainingAmount / chainMembers.length);

      for (let i = 0; i < chainMembers.length; i++) {
        const member = chainMembers[i];
        if (member.referrer) {
          await this.createCommission({
            post: postId,
            referral: member._id,
            recipient: member.referrer._id,
            amount: amountPerChainMember,
            percentage: 20,
            distributionType: 'chain_sharing',
            chainPosition: i + 1, // Position in chain
            totalPointsPool: distribution.pointsPool,
            platformFee: distribution.platformFee,
            distributableAmount: distribution.distributableAmount,
            saleDetails: {
              soldAt,
              buyerInfo: {
                name: saleReferral.referee?.username || 'Unknown',
                email: saleReferral.referee?.email || 'Unknown'
              },
              soldPrice
            }
          });
        }
      }
    }

    // Create platform fee commission
    await this.createCommission({
      post: postId,
      recipient: null, // Platform
      amount: distribution.platformFee,
      percentage: 10,
      distributionType: 'platform_fee',
      totalPointsPool: distribution.pointsPool,
      platformFee: distribution.platformFee,
      distributableAmount: distribution.distributableAmount,
      saleDetails: {
        soldAt,
        buyerInfo: {
          name: saleReferral.referee?.username || 'Unknown',
          email: saleReferral.referee?.email || 'Unknown'
        },
        soldPrice
      }
    });
  }

  // Create a commission record
  static async createCommission(commissionData) {
    const commission = new Commission(commissionData);
    await commission.save();

    // If recipient exists, update their credits
    if (commissionData.recipient) {
      await User.findByIdAndUpdate(commissionData.recipient, {
        $inc: { credits: commissionData.amount }
      });
    }

    return commission;
  }

  // Get commission analytics for a post
  static async getPostCommissions(postId) {
    return await Commission.find({ post: postId })
      .populate('recipient', 'username email')
      .populate('referral')
      .sort({ createdAt: -1 });
  }

  // Get user commissions
  static async getUserCommissions(userId) {
    return await Commission.find({ recipient: userId })
      .populate('post', 'title')
      .populate('referral')
      .sort({ createdAt: -1 });
  }
}

module.exports = CommissionService;