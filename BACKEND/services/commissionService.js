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

  // Find the head of the specific chain that led to the sale
  static async findChainHead(postId, saleReferral) {
    // Find the original referrer (head of the chain)
    let chainHead = saleReferral;
    let currentReferral = saleReferral;

    // Go up the chain to find the head (person you originally shared to)
    while (currentReferral.parentReferral) {
      const parent = await Referral.findById(currentReferral.parentReferral)
        .populate('referrer')
        .populate('referee');
      if (parent) {
        chainHead = parent;
        currentReferral = parent;
      } else {
        break;
      }
    }

    return chainHead;
  }

  // Get all people in the specific chain that led to the sale
  static async getChainMembers(postId, chainHead) {
    // Find all referrals that belong to this specific chain
    const chainMembers = await Referral.find({
      post: postId,
      $or: [
        { _id: chainHead._id }, // The head itself
        { parentReferral: chainHead._id }, // Direct children
        { 'chain.chainId': chainHead.chain?.chainId } // Same chain ID
      ]
    })
    .populate('referrer')
    .populate('referee')
    .sort({ timestamp: 1 });

    return chainMembers;
  }

  // Distribute points according to the tree-like algorithm
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

    // Find the head of the specific chain that led to the sale
    const chainHead = await this.findChainHead(postId, saleReferral);
    
    // Get all members in this specific chain
    const chainMembers = await this.getChainMembers(postId, chainHead);
    
    console.log('=== TREE-LIKE COMMISSION DISTRIBUTION ===');
    console.log('Chain Head:', chainHead.referrer?.username || 'Unknown');
    console.log('Sale Referral:', saleReferral.referrer?.username || 'Unknown');
    console.log('Total Chain Members:', chainMembers.length);

    // Tree-like distribution logic: Last person 30%, Chain head 20%, Others share remaining 50%
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
    } else if (chain.length === 1) {
      // Only one referral - they get 50% of distributable points
      const amount = Math.floor(distribution.distributableAmount * 0.5);
      await this.createCommission({
        post: postId,
        referral: chain[0]._id,
        recipient: chain[0].referrer,
        amount: amount,
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
      // TREE-LIKE COMMISSION LOGIC: Multiple referrals in tree structure
      // Last person (buyer's direct referrer) gets 30%
      // Chain head (person you originally shared to) gets 20%
      // All other people in the chain share remaining 50% equally
      const lastAmount = Math.floor(distribution.distributableAmount * 0.3);  // 30% to last person
      const chainHeadAmount = Math.floor(distribution.distributableAmount * 0.2); // 20% to chain head
      const remainingAmount = distribution.distributableAmount - lastAmount - chainHeadAmount;
      
      // Calculate how many people get equal share (excluding last person and chain head)
      const otherMembers = chainMembers.filter(member => 
        member._id.toString() !== saleReferral._id.toString() && 
        member._id.toString() !== chainHead._id.toString()
      );
      const otherAmount = otherMembers.length > 0 ? Math.floor(remainingAmount / otherMembers.length) : 0;

      console.log('TREE-LIKE COMMISSION DISTRIBUTION:');
      console.log('- Last person (buyer\'s referrer):', lastAmount, 'points (30%)');
      console.log('- Chain head (original sharee):', chainHeadAmount, 'points (20%)');
      console.log('- Other chain members (' + otherMembers.length + '):', otherAmount, 'points each');
      console.log('- Remaining amount:', remainingAmount, 'points');

      // Chain head gets 20%
      await this.createCommission({
        post: postId,
        referral: chainHead._id,
        recipient: chainHead.referrer,
        amount: chainHeadAmount,
        percentage: 20,
        distributionType: 'chain_head',
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

      // Last person (buyer's referrer) gets 30%
      await this.createCommission({
        post: postId,
        referral: saleReferral._id,
        recipient: saleReferral.referrer,
        amount: lastAmount,
        percentage: 30,
        distributionType: 'last_person',
        chainPosition: chain.length - 1,
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

      // Other chain members share remaining 50% equally
      if (otherMembers.length > 0) {
        for (const member of otherMembers) {
          await this.createCommission({
            post: postId,
            referral: member._id,
            recipient: member.referrer,
            amount: otherAmount,
            percentage: Math.floor((otherAmount / distribution.distributableAmount) * 100),
            distributionType: 'chain_member',
            chainPosition: member.chain?.position || 0,
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
}

module.exports = CommissionService;