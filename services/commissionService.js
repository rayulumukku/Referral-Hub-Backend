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

    // Rule A: If seller directly shared to up to 5 persons (chain length 1) and one of them bought,
    // then the distributable points are shared equally among the remaining 4 direct referees (excluding buyer),
    // seller does not receive points. This applies when there is only one hop from creator to buyer and
    // there are up to 5 total direct referees recorded for this post.
    const isDirectSale = chain.length === 1 && chain[0].referrer && chain[0].parentReferral == null;
    if (isDirectSale) {
      // Gather all direct referrals from creator for this post
      const directReferrals = await Referral.find({ post: postId, parentReferral: null }).sort({ createdAt: 1 });
      // Exclude the buyer referral
      const eligible = directReferrals.filter(r => !saleReferral || (saleReferral && r._id.toString() !== saleReferral._id.toString()));

      // Share distributable equally among up to 4 remaining direct referees
      const maxRecipients = 4;
      const recipients = eligible.slice(0, maxRecipients);
      if (recipients.length > 0) {
        const amountPer = Math.floor(distribution.distributableAmount / recipients.length);
        for (let i = 0; i < recipients.length; i++) {
          const r = recipients[i];
          if (r.referrer) {
            await this.createCommission({
              post: postId,
              referral: r._id,
              recipient: r.referrer,
              amount: amountPer,
              percentage: Math.floor((amountPer / distribution.distributableAmount) * 100),
              distributionType: 'direct_share_equal',
              chainPosition: 1,
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
      return;
    }

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

    // Rule B (chain sharing): Apply the 20% (first), 30% (last), remaining equally among others
    const firstPerson = filteredChain[0]; // 20% of distributable amount
    const lastPerson = filteredChain[filteredChain.length - 1]; // 30% of distributable amount
    const remainingPeople = filteredChain.slice(1, -1); // Remaining people share the rest

    const firstPersonAmount = Math.floor(distribution.distributableAmount * 0.2);
    const lastPersonAmount = Math.floor(distribution.distributableAmount * 0.3);
    const remainingAmount = distribution.distributableAmount - firstPersonAmount - lastPersonAmount;

    // Distribute to first person (20%)
    if (firstPerson.referrer) {
      await this.createCommission({
        post: postId,
        referral: firstPerson._id,
        recipient: firstPerson.referrer._id,
        amount: firstPersonAmount,
        percentage: 20,
        distributionType: 'chain_first',
        chainPosition: 1,
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

    // Distribute to last person (30%)
    if (lastPerson.referrer && lastPerson._id.toString() !== firstPerson._id.toString()) {
      await this.createCommission({
        post: postId,
        referral: lastPerson._id,
        recipient: lastPerson.referrer._id,
        amount: lastPersonAmount,
        percentage: 30,
        distributionType: 'chain_last',
        chainPosition: filteredChain.length,
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

    // Distribute remaining amount among other chain members
    if (remainingPeople.length > 0 && remainingAmount > 0) {
      const amountPerPerson = Math.floor(remainingAmount / remainingPeople.length);

      for (let i = 0; i < remainingPeople.length; i++) {
        const person = remainingPeople[i];
        if (person.referrer) {
          await this.createCommission({
            post: postId,
            referral: person._id,
            recipient: person.referrer._id,
            amount: amountPerPerson,
            percentage: Math.floor((amountPerPerson / distribution.distributableAmount) * 100),
            distributionType: 'chain_remaining',
            chainPosition: i + 2, // Position in chain (after first person)
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