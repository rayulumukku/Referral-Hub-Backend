const EnhancedReferralChain = require('../models/EnhancedReferralChain');
const User = require('../models/User');
const Post = require('../models/Post');
const Referral = require('../models/Referral');
const Commission = require('../models/Commission');
const Activity = require('../services/activityService');

class EnhancedReferralTrackingService {
  
  // Track when someone shares a post
  static async trackShare(data) {
    try {
      const {
        postId,
        fromUserId,
        toUserId,
        platform,
        device,
        browser,
        location,
        coordinates,
        ipAddress,
        userAgent,
        parentReferralId
      } = data;

      console.log('Tracking share:', { postId, fromUserId, toUserId, platform });

      // Find or create the referral chain
      let chain = await this.findOrCreateChain(postId, fromUserId, parentReferralId);
      
      // Add the share action to the chain
      await this.addShareToChain(chain, fromUserId, toUserId, {
        platform,
        device,
        browser,
        location,
        coordinates,
        ipAddress,
        userAgent
      });

      // Update chain statistics
      await this.updateChainStats(chain._id);

      // Track activity
      await Activity.trackReferralShared(fromUserId, postId, platform, {
        platform,
        device,
        browser,
        location,
        ipAddress,
        userAgent
      });

      return { success: true, chainId: chain._id };
    } catch (error) {
      console.error('Error tracking share:', error);
      throw error;
    }
  }

  // Track when someone clicks/views a post
  static async trackClick(data) {
    try {
      const {
        postId,
        userId,
        referrerId,
        platform,
        device,
        browser,
        location,
        coordinates,
        ipAddress,
        userAgent,
        parentReferralId
      } = data;

      console.log('Tracking click:', { postId, userId, referrerId, platform });

      // Find the referral chain
      let chain = await this.findOrCreateChain(postId, referrerId, parentReferralId);
      
      // Add the click/view to the chain
      await this.addClickToChain(chain, userId, {
        platform,
        device,
        browser,
        location,
        coordinates,
        ipAddress,
        userAgent
      });

      // Update chain statistics
      await this.updateChainStats(chain._id);

      // Update post view count
      await Post.findByIdAndUpdate(postId, { $inc: { views: 1, reach: 1 } });

      return { success: true, chainId: chain._id };
    } catch (error) {
      console.error('Error tracking click:', error);
      throw error;
    }
  }

  // Track when someone registers/logs in through a referral link
  static async trackRegistration(data) {
    try {
      const {
        postId,
        newUserId,
        referrerId,
        platform,
        device,
        browser,
        location,
        coordinates,
        ipAddress,
        userAgent,
        parentReferralId
      } = data;

      console.log('Tracking registration:', { postId, newUserId, referrerId });

      // Find the referral chain
      let chain = await this.findOrCreateChain(postId, referrerId, parentReferralId);
      
      // Add the new user to the chain
      await this.addUserToChain(chain, newUserId, referrerId, {
        platform,
        device,
        browser,
        location,
        coordinates,
        ipAddress,
        userAgent
      });

      // Update chain statistics
      await this.updateChainStats(chain._id);

      // Track activity
      await Activity.trackUserRegistration(newUserId, referrerId, {
        platform,
        device,
        browser,
        location,
        ipAddress,
        userAgent
      });

      return { success: true, chainId: chain._id };
    } catch (error) {
      console.error('Error tracking registration:', error);
      throw error;
    }
  }

  // Find or create a referral chain
  static async findOrCreateChain(postId, userId, parentReferralId) {
    try {
      // Try to find existing chain
      let chain = await EnhancedReferralChain.findOne({
        post: postId,
        originalCreator: userId
      });

      if (!chain) {
        // Get user info
        const user = await User.findById(userId).select('username email');
        if (!user) throw new Error('User not found');

        // Create new chain
        chain = new EnhancedReferralChain({
          post: postId,
          originalCreator: userId,
          chainHead: userId,
          chainMembers: [{
            userId: userId,
            username: user.username,
            email: user.email,
            position: 1,
            sharedAt: new Date(),
            sharedTo: [],
            totalClicks: 0,
            totalShares: 0,
            totalViews: 0,
            engagementScore: 0,
            commissionEarned: 0,
            isActive: true
          }],
          totalClicks: 0,
          totalShares: 0,
          totalViews: 0,
          conversionOccurred: false,
          status: 'active'
        });

        await chain.save();
      }

      return chain;
    } catch (error) {
      console.error('Error finding/creating chain:', error);
      throw error;
    }
  }

  // Add share action to chain
  static async addShareToChain(chain, fromUserId, toUserId, shareData) {
    try {
      const member = chain.chainMembers.find(m => m.userId.toString() === fromUserId.toString());
      
      if (member) {
        // Add to sharedTo array
        member.sharedTo.push({
          userId: toUserId,
          platform: shareData.platform,
          sharedAt: new Date(),
          device: shareData.device,
          browser: shareData.browser,
          location: shareData.location,
          ipAddress: shareData.ipAddress,
          userAgent: shareData.userAgent
        });

        member.totalShares += 1;
        member.engagementScore += 10; // Points for sharing

        // Update platform distribution
        chain.platformDistribution[shareData.platform] = 
          (chain.platformDistribution[shareData.platform] || 0) + 1;

        // Update device distribution
        chain.deviceDistribution[shareData.device] = 
          (chain.deviceDistribution[shareData.device] || 0) + 1;

        await chain.save();
      }
    } catch (error) {
      console.error('Error adding share to chain:', error);
      throw error;
    }
  }

  // Add click/view to chain
  static async addClickToChain(chain, userId, clickData) {
    try {
      // Find the member who received the click
      const member = chain.chainMembers.find(m => 
        m.sharedTo.some(share => share.userId.toString() === userId.toString())
      );

      if (member) {
        member.totalClicks += 1;
        member.engagementScore += 5; // Points for clicks

        // Update platform distribution
        chain.platformDistribution[clickData.platform] = 
          (chain.platformDistribution[clickData.platform] || 0) + 1;

        // Update device distribution
        chain.deviceDistribution[clickData.device] = 
          (chain.deviceDistribution[clickData.device] || 0) + 1;

        // Update location distribution
        if (clickData.location?.city) {
          const key = `${clickData.location.city}, ${clickData.location.state}`;
          chain.locationDistribution.set(key, (chain.locationDistribution.get(key) || 0) + 1);
        }

        // Update time distribution
        const hour = new Date().getHours();
        chain.timeDistribution.set(hour.toString(), (chain.timeDistribution.get(hour.toString()) || 0) + 1);

        await chain.save();
      }
    } catch (error) {
      console.error('Error adding click to chain:', error);
      throw error;
    }
  }

  // Add new user to chain
  static async addUserToChain(chain, newUserId, referrerId, userData) {
    try {
      // Get new user info
      const newUser = await User.findById(newUserId).select('username email');
      if (!newUser) throw new Error('New user not found');

      // Find referrer in chain
      const referrerIndex = chain.chainMembers.findIndex(m => m.userId.toString() === referrerId.toString());
      
      if (referrerIndex !== -1) {
        // Add new member after referrer
        const newPosition = referrerIndex + 1;
        
        // Shift positions of existing members
        chain.chainMembers.forEach(member => {
          if (member.position >= newPosition) {
            member.position += 1;
          }
        });

        // Add new member
        chain.chainMembers.push({
          userId: newUserId,
          username: newUser.username,
          email: newUser.email,
          position: newPosition,
          sharedAt: new Date(),
          sharedTo: [],
          totalClicks: 0,
          totalShares: 0,
          totalViews: 0,
          engagementScore: 0,
          commissionEarned: 0,
          isActive: true
        });

        // Sort by position
        chain.chainMembers.sort((a, b) => a.position - b.position);

        await chain.save();
      }
    } catch (error) {
      console.error('Error adding user to chain:', error);
      throw error;
    }
  }

  // Update chain statistics
  static async updateChainStats(chainId) {
    try {
      const chain = await EnhancedReferralChain.findById(chainId);
      if (!chain) return;

      // Calculate totals
      chain.totalClicks = chain.chainMembers.reduce((sum, member) => sum + member.totalClicks, 0);
      chain.totalShares = chain.chainMembers.reduce((sum, member) => sum + member.totalShares, 0);
      chain.totalViews = chain.totalClicks; // Views = clicks

      await chain.save();
    } catch (error) {
      console.error('Error updating chain stats:', error);
    }
  }

  // Handle product purchase/conversion
  static async handleConversion(postId, buyerId, purchaseAmount) {
    try {
      console.log('Handling conversion:', { postId, buyerId, purchaseAmount });

      // Find all chains for this post
      const chains = await EnhancedReferralChain.find({ post: postId, status: 'active' });
      
      for (const chain of chains) {
        await this.distributeCommissions(chain, buyerId, purchaseAmount);
      }

      return { success: true };
    } catch (error) {
      console.error('Error handling conversion:', error);
      throw error;
    }
  }

  // Distribute commissions according to your rules
  static async distributeCommissions(chain, buyerId, purchaseAmount) {
    try {
      const totalPoints = purchaseAmount;
      const commissions = [];

      // Find the buyer in the chain
      const buyerIndex = chain.chainMembers.findIndex(m => m.userId.toString() === buyerId.toString());
      
      if (buyerIndex === -1) return; // Buyer not in this chain

      // Rule 1: First person (position 1) gets 20%
      if (chain.chainMembers.length > 0) {
        const firstPerson = chain.chainMembers[0];
        const firstPersonCommission = totalPoints * 0.20;
        
        commissions.push({
          recipient: firstPerson.userId,
          amount: firstPersonCommission,
          percentage: 20,
          position: 1,
          status: 'pending'
        });
      }

      // Rule 2: Last person who shared (2nd from last) gets 30%
      if (chain.chainMembers.length >= 2) {
        const secondLastPerson = chain.chainMembers[chain.chainMembers.length - 2];
        const secondLastCommission = totalPoints * 0.30;
        
        commissions.push({
          recipient: secondLastPerson.userId,
          amount: secondLastCommission,
          percentage: 30,
          position: secondLastPerson.position,
          status: 'pending'
        });
      }

      // Rule 3: Remaining points distributed equally among middle persons
      const remainingPoints = totalPoints * 0.50; // 50% remaining
      const middlePersons = chain.chainMembers.filter(m => 
        m.position > 1 && m.position < chain.chainMembers.length - 1
      );

      if (middlePersons.length > 0) {
        const pointsPerPerson = remainingPoints / middlePersons.length;
        
        middlePersons.forEach(member => {
          commissions.push({
            recipient: member.userId,
            amount: pointsPerPerson,
            percentage: (pointsPerPerson / totalPoints) * 100,
            position: member.position,
            status: 'pending'
          });
        });
      }

      // Update chain with commissions
      chain.commissions = commissions;
      chain.conversionOccurred = true;
      chain.conversionValue = purchaseAmount;
      chain.conversionDate = new Date();
      chain.buyer = buyerId;
      chain.status = 'converted';

      await chain.save();

      // Create commission records
      for (const commission of commissions) {
        const commissionRecord = new Commission({
          recipient: commission.recipient,
          post: chain.post,
          amount: commission.amount,
          percentage: commission.percentage,
          status: 'pending',
          referral: chain._id,
          level: commission.position
        });

        await commissionRecord.save();
      }

      // Update member commission earned
      for (const commission of commissions) {
        const member = chain.chainMembers.find(m => m.userId.toString() === commission.recipient.toString());
        if (member) {
          member.commissionEarned += commission.amount;
        }
      }

      await chain.save();

      return commissions;
    } catch (error) {
      console.error('Error distributing commissions:', error);
      throw error;
    }
  }

  // Get referral chains for a user
  static async getUserReferralChains(userId, postId = null) {
    try {
      const query = {
        $or: [
          { originalCreator: userId },
          { 'chainMembers.userId': userId }
        ]
      };

      if (postId) {
        query.post = postId;
      }

      const chains = await EnhancedReferralChain.find(query)
        .populate('post', 'title category price status')
        .populate('originalCreator', 'username email')
        .populate('chainHead', 'username email')
        .populate('chainMembers.userId', 'username email')
        .populate('buyer', 'username email')
        .sort({ createdAt: -1 });

      return chains.map(chain => this.formatChainForUser(chain, userId));
    } catch (error) {
      console.error('Error getting user referral chains:', error);
      throw error;
    }
  }

  // Format chain data for specific user perspective
  static formatChainForUser(chain, userId) {
    const userMember = chain.chainMembers.find(m => m.userId.toString() === userId.toString());
    const userPosition = userMember ? userMember.position : 0;

    return {
      id: chain._id,
      post: chain.post,
      originalCreator: chain.originalCreator,
      chainHead: chain.chainHead,
      userPosition: userPosition,
      chainLength: chain.chainMembers.length,
      chainMembers: chain.chainMembers.map(member => ({
        id: member.userId,
        username: member.username,
        email: member.email,
        position: member.position,
        isYou: member.userId.toString() === userId.toString(),
        sharedAt: member.sharedAt,
        totalClicks: member.totalClicks,
        totalShares: member.totalShares,
        totalViews: member.totalViews,
        engagementScore: member.engagementScore,
        commissionEarned: member.commissionEarned,
        sharedTo: member.sharedTo
      })),
      totalClicks: chain.totalClicks,
      totalShares: chain.totalShares,
      totalViews: chain.totalViews,
      conversionOccurred: chain.conversionOccurred,
      conversionValue: chain.conversionValue,
      conversionDate: chain.conversionDate,
      buyer: chain.buyer,
      commissions: chain.commissions,
      platformDistribution: chain.platformDistribution,
      deviceDistribution: chain.deviceDistribution,
      locationDistribution: Object.fromEntries(chain.locationDistribution),
      timeDistribution: Object.fromEntries(chain.timeDistribution),
      status: chain.status,
      createdAt: chain.createdAt,
      updatedAt: chain.updatedAt
    };
  }

  // Get analytics for a post
  static async getPostAnalytics(postId) {
    try {
      const chains = await EnhancedReferralChain.find({ post: postId });

      const analytics = {
        totalChains: chains.length,
        totalClicks: chains.reduce((sum, chain) => sum + chain.totalClicks, 0),
        totalShares: chains.reduce((sum, chain) => sum + chain.totalShares, 0),
        totalViews: chains.reduce((sum, chain) => sum + chain.totalViews, 0),
        totalConversions: chains.filter(chain => chain.conversionOccurred).length,
        totalConversionValue: chains.reduce((sum, chain) => sum + (chain.conversionValue || 0), 0),
        averageChainLength: chains.length > 0 ? 
          chains.reduce((sum, chain) => sum + chain.chainMembers.length, 0) / chains.length : 0,
        platformDistribution: {},
        deviceDistribution: {},
        locationDistribution: {},
        timeDistribution: {},
        topPerformers: []
      };

      // Aggregate distributions
      chains.forEach(chain => {
        // Platform distribution
        Object.keys(chain.platformDistribution).forEach(platform => {
          analytics.platformDistribution[platform] = 
            (analytics.platformDistribution[platform] || 0) + chain.platformDistribution[platform];
        });

        // Device distribution
        Object.keys(chain.deviceDistribution).forEach(device => {
          analytics.deviceDistribution[device] = 
            (analytics.deviceDistribution[device] || 0) + chain.deviceDistribution[device];
        });

        // Location distribution
        chain.locationDistribution.forEach((count, location) => {
          analytics.locationDistribution[location] = 
            (analytics.locationDistribution[location] || 0) + count;
        });

        // Time distribution
        chain.timeDistribution.forEach((count, hour) => {
          analytics.timeDistribution[hour] = 
            (analytics.timeDistribution[hour] || 0) + count;
        });
      });

      // Top performers (users with highest engagement)
      const allMembers = chains.flatMap(chain => chain.chainMembers);
      const memberStats = {};

      allMembers.forEach(member => {
        const key = member.userId.toString();
        if (!memberStats[key]) {
          memberStats[key] = {
            userId: member.userId,
            username: member.username,
            totalClicks: 0,
            totalShares: 0,
            totalViews: 0,
            engagementScore: 0,
            commissionEarned: 0
          };
        }

        memberStats[key].totalClicks += member.totalClicks;
        memberStats[key].totalShares += member.totalShares;
        memberStats[key].totalViews += member.totalViews;
        memberStats[key].engagementScore += member.engagementScore;
        memberStats[key].commissionEarned += member.commissionEarned;
      });

      analytics.topPerformers = Object.values(memberStats)
        .sort((a, b) => b.engagementScore - a.engagementScore)
        .slice(0, 10);

      return analytics;
    } catch (error) {
      console.error('Error getting post analytics:', error);
      throw error;
    }
  }
}

module.exports = EnhancedReferralTrackingService;
