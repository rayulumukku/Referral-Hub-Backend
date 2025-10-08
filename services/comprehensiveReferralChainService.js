const mongoose = require('mongoose');
const ReferralChain = require('../models/ReferralChain');
const Referral = require('../models/Referral');
const Post = require('../models/Post');
const User = require('../models/User');

// Store Socket.IO instance
let io;

class ComprehensiveReferralChainService {
  // Set Socket.IO instance
  static setIoInstance(ioInstance) {
    io = ioInstance;
  }
}

ComprehensiveReferralChainService.setIoInstance = function(ioInstance) {
  io = ioInstance;
};

class ComprehensiveReferralChainServiceClass {
  /**
   * Initialize post with creator's initial view
   * This sets clicks to 1 when post is created
   * Tracks EVERYTHING: device, browser, screen size, location, etc.
   */
  static async initializePostView(postId, creatorId, metadata = {}) {
    try {
      const post = await Post.findById(postId);
      if (!post) {
        throw new Error('Post not found');
      }

      // Comprehensive view tracking
      const viewData = {
        userId: creatorId,
        timestamp: new Date(),
        platform: metadata.platform || 'web',
        device: metadata.device || 'desktop',
        browser: metadata.browser || 'Unknown',
        ipAddress: metadata.ipAddress || null,
        referrer: 'self',
        sessionId: metadata.sessionId || null,
        // Additional tracking
        userAgent: metadata.userAgent || null,
        screenSize: metadata.screenSize || null,
        viewport: metadata.viewport || null,
        os: metadata.os || null,
        deviceModel: metadata.deviceModel || null,
        location: {
          city: metadata.location?.city || null,
          state: metadata.location?.state || null,
          country: metadata.location?.country || null,
          coordinates: metadata.location?.coordinates || null,
          timezone: metadata.location?.timezone || null
        },
        networkInfo: {
          connectionType: metadata.networkInfo?.connectionType || null,
          effectiveType: metadata.networkInfo?.effectiveType || null,
          downlink: metadata.networkInfo?.downlink || null
        }
      };

      // Increment views AND clicks for creator's initial view
      // ✅ Creator viewing their post counts as BOTH view and click
      await Post.findByIdAndUpdate(postId, {
        $inc: { 
          'analytics.views': 1,
          'analytics.clicks': 1,  // ✅ Clicks = Views always!
          reach: 1 
        },
        $addToSet: { 'analytics.uniqueViewers': creatorId },
        $push: {
          'analytics.viewHistory': viewData
        }
      });

      console.log(`Post ${postId} initialized with creator view - Device: ${metadata.device}, Browser: ${metadata.browser}, Screen: ${metadata.screenSize?.width}x${metadata.screenSize?.height}`);
      
      // ✅ Real-time update - emit to post room
      if (io) {
        io.to(`post_${postId}`).emit('post_view', {
          postId,
          viewData,
          totalViews: 1,
          totalClicks: 1,
          timestamp: new Date()
        });
      }
      
      return { 
        success: true, 
        clicks: 1, 
        views: 1,
        trackedData: {
          device: metadata.device,
          browser: metadata.browser,
          platform: metadata.platform,
          screenSize: metadata.screenSize,
          location: metadata.location
        }
      };
    } catch (error) {
      console.error('Error initializing post view:', error);
      throw error;
    }
  }

  /**
   * Track when a user shares a post to someone
   * Creates or updates a referral chain
   * Tracks: platform, device, browser, screen size, OS, location, network, etc.
   */
  static async trackShare(data) {
    try {
      const {
        postId,
        sharerId, // Person sharing
        shareToUserId, // Person being shared to (optional at share time)
        platform, // whatsapp, linkedin, twitter, facebook, etc.
        device, // desktop, mobile, tablet
        browser, // Chrome, Firefox, Safari
        browserVersion,
        location,
        ipAddress,
        userAgent,
        sessionId,
        parentChainId, // If this is a re-share in an existing chain
        coordinates,
        fromLocation,
        toLocation,
        // Enhanced tracking
        screenSize, // { width, height }
        viewport, // { width, height }
        os, // Windows, macOS, iOS, Android
        osVersion,
        deviceModel, // iPhone 14 Pro, etc.
        networkInfo, // { connectionType, effectiveType, downlink }
        language,
        timezone,
        shareMethod, // native_share, copy_link, direct_platform
        colorScheme, // light, dark
        touchSupport
      } = data;

      // Generate unique chain ID if this is a new chain
      const chainId = parentChainId || `chain_${postId}_${sharerId}_${Date.now()}`;

      // Find existing chain or create new one
      let chain = await ReferralChain.findOne({ chainId });

      if (!chain) {
        // Create new chain starting from this sharer with FULL tracking
        chain = new ReferralChain({
          post: postId,
          chainId,
          originalSharer: sharerId,
          chain: [{
            userId: sharerId,
            position: 0,
            sharedAt: new Date(),
            platform,
            device,
            browser,
            userAgent,
            location: location || {
              city: null,
              state: null,
              country: null,
              coordinates: coordinates || null
            },
            ipAddress,
            sessionId,
            clicks: 0,
            views: 0,
            shares: 1,
            engagement: {
              interactions: [{
                type: 'share',
                timestamp: new Date(),
                metadata: { 
                  fromLocation, 
                  toLocation,
                  screenSize,
                  viewport,
                  os,
                  osVersion,
                  deviceModel,
                  browserVersion,
                  networkInfo,
                  language,
                  timezone,
                  shareMethod,
                  colorScheme,
                  touchSupport
                }
              }]
            }
          }],
          totalShares: 1,
          analytics: {
            platformBreakdown: new Map([[platform, 1]]),
            deviceBreakdown: new Map([[device, 1]]),
            journeyMap: []
          }
        });
      } else {
        // Update existing chain - add share count with full metadata
        const sharerIndex = chain.chain.findIndex(c => c.userId.toString() === sharerId.toString());
        if (sharerIndex !== -1) {
          chain.chain[sharerIndex].shares += 1;
          chain.chain[sharerIndex].engagement.interactions.push({
            type: 'share',
            timestamp: new Date(),
            metadata: { 
              fromLocation, 
              toLocation, 
              platform, 
              device,
              screenSize,
              viewport,
              os,
              osVersion,
              deviceModel,
              browser,
              browserVersion,
              networkInfo,
              language,
              timezone,
              shareMethod,
              colorScheme,
              touchSupport
            }
          });
        }
        chain.totalShares += 1;
      }

      chain.lastActivity = new Date();
      await chain.save();

      // Create a Referral entry for tracking
      const referral = new Referral({
        post: postId,
        referrer: sharerId,
        referee: shareToUserId || null,
        platform,
        device,
        browser,
        userAgent,
        location,
        ipAddress,
        sessionId,
        coordinates,
        journey: {
          fromLocation,
          toLocation
        },
        engagement: {
          totalClicks: 0,
          uniqueClicks: 0,
          shares: 1,
          interactions: [{
            type: 'share',
            timestamp: new Date()
          }]
        },
        chain: {
          position: chain.chain.findIndex(c => c.userId.toString() === sharerId.toString()),
          totalInChain: chain.chain.length,
          chainId,
          isActive: true
        }
      });

      await referral.save();

      // Update post analytics with COMPREHENSIVE data
      await Post.findByIdAndUpdate(postId, {
        $inc: {
          'analytics.shares': 1,
          [`analytics.sharesByPlatform.${platform}`]: 1
        },
        $push: {
          'analytics.shareHistory': {
            userId: sharerId,
            platform,
            timestamp: new Date(),
            ipAddress,
            userAgent,
            device,
            browser,
            screenSize,
            os,
            location: location || {
              city: null,
              state: null,
              country: null,
              coordinates: coordinates || null
            },
            shareMethod,
            sharedTo: shareToUserId || null,
            fromLocation
          }
        }
      });

      console.log(`Share tracked: ${sharerId} shared post ${postId} via ${platform}`);
      return { chain, referral, chainId };
    } catch (error) {
      console.error('Error tracking share:', error);
      throw error;
    }
  }

  /**
   * Track when someone clicks on a referral link
   */
  static async trackClick(data) {
    try {
      const {
        postId,
        chainId,
        clickerId, // Person who clicked (may not have account yet)
        referrerId, // Person who shared to them
        platform,
        device,
        browser,
        location,
        ipAddress,
        userAgent,
        sessionId,
        coordinates
      } = data;

      // Update referral chain
      const chain = await ReferralChain.findOne({ chainId });
      if (chain) {
        const referrerIndex = chain.chain.findIndex(c => c.userId.toString() === referrerId.toString());
        if (referrerIndex !== -1) {
          chain.chain[referrerIndex].clicks += 1;
          chain.chain[referrerIndex].views += 1;
          chain.chain[referrerIndex].engagement.interactions.push({
            type: 'click',
            timestamp: new Date(),
            metadata: { clickerId, platform, device }
          });
        }
        chain.totalClicks += 1;
        chain.totalViews += 1;
        chain.lastActivity = new Date();
        await chain.save();
      }

      // Update post analytics
      // ✅ FIXED: Increment BOTH views AND clicks (they should be equal!)
      await Post.findByIdAndUpdate(postId, {
        $inc: {
          'analytics.views': 1,
          'analytics.clicks': 1,  // ✅ NOW TRACKING CLICKS TOO!
          'reach': 1
        },
        $push: {
          'analytics.viewHistory': {
            userId: clickerId,
            timestamp: new Date(),
            platform,
            device,
            browser,
            ipAddress,
            referrer: referrerId,
            sessionId
          }
        }
      });

      console.log(`Click tracked: Post ${postId} clicked by ${clickerId || 'anonymous'}`);
      
      // ✅ Real-time update - emit to post room
      if (io) {
        const updatedPost = await Post.findById(postId).select('analytics').lean();
        io.to(`post_${postId}`).emit('post_click', {
          postId,
          clickerId,
          totalClicks: updatedPost?.analytics?.clicks || 0,
          totalViews: updatedPost?.analytics?.views || 0,
          timestamp: new Date()
        });
        
        // Also emit to referrer
        if (referrerId) {
          io.to(`user_${referrerId}`).emit('referral_click_notification', {
            postId,
            timestamp: new Date()
          });
        }
      }
      
      return { success: true, chain };
    } catch (error) {
      console.error('Error tracking click:', error);
      throw error;
    }
  }

  /**
   * Track when someone registers/logs in via a referral link
   * This extends the chain
   */
  static async trackRegistration(data) {
    try {
      const {
        postId,
        chainId,
        newUserId, // Person who just registered/logged in
        referrerId, // Person who shared to them
        platform,
        device,
        browser,
        location,
        ipAddress,
        userAgent,
        sessionId,
        coordinates,
        registrationType // 'register' or 'login'
      } = data;

      // Find the chain
      let chain = await ReferralChain.findOne({ chainId });
      if (!chain) {
        throw new Error('Chain not found');
      }

      // Check if user already in chain
      const existingUser = chain.chain.find(c => c.userId.toString() === newUserId.toString());
      if (!existingUser) {
        // Add new user to chain
        const newPosition = chain.chain.length;
        chain.chain.push({
          userId: newUserId,
          position: newPosition,
          sharedAt: new Date(),
          platform,
          device,
          browser,
          userAgent,
          location,
          ipAddress,
          sessionId,
          clicks: 1,
          views: 1,
          shares: 0,
          engagement: {
            interactions: [{
              type: registrationType,
              timestamp: new Date(),
              metadata: { referredBy: referrerId }
            }]
          }
        });

        // Update analytics with journey map
        const referrerData = chain.chain.find(c => c.userId.toString() === referrerId.toString());
        if (referrerData) {
          chain.analytics.journeyMap.push({
            from: {
              userId: referrerId,
              location: referrerData.location,
              timestamp: referrerData.sharedAt,
              platform: referrerData.platform,
              device: referrerData.device
            },
            to: {
              userId: newUserId,
              location,
              timestamp: new Date(),
              platform,
              device
            },
            distance: this.calculateDistance(
              referrerData.location?.coordinates,
              coordinates
            ),
            travelTime: (new Date() - referrerData.sharedAt) / 1000 / 60, // minutes
            clicks: 1,
            views: 1,
            shares: 0
          });
        }

        chain.lastActivity = new Date();
        await chain.save();
      }

      // Update or create referral entry
      let referral = await Referral.findOne({
        post: postId,
        referrer: referrerId,
        referee: newUserId
      });

      if (!referral) {
        referral = new Referral({
          post: postId,
          referrer: referrerId,
          referee: newUserId,
          platform,
          device,
          browser,
          userAgent,
          location,
          ipAddress,
          sessionId,
          coordinates,
          engagement: {
            totalClicks: 1,
            uniqueClicks: 1,
            shares: 0,
            interactions: [{
              type: registrationType,
              timestamp: new Date()
            }]
          },
          chain: {
            position: chain.chain.findIndex(c => c.userId.toString() === referrerId.toString()) + 1,
            totalInChain: chain.chain.length,
            chainId,
            isActive: true
          }
        });
        await referral.save();
      }

      console.log(`Registration tracked: ${newUserId} joined chain ${chainId} via ${referrerId}`);
      return { chain, referral };
    } catch (error) {
      console.error('Error tracking registration:', error);
      throw error;
    }
  }

  /**
   * Get referral chain display for a specific user
   * Shows: A->B(you)->C format
   */
  static async getChainForUser(userId, postId = null) {
    try {
      const query = postId 
        ? { 'chain.userId': userId, post: postId }
        : { 'chain.userId': userId };

      const chains = await ReferralChain.find(query)
        .populate('post', 'title description category')
        .populate('chain.userId', 'username email profile.name')
        .populate('originalSharer', 'username email profile.name')
        .sort({ createdAt: -1 });

      const formattedChains = chains.map(chain => {
        const userPosition = chain.chain.findIndex(c => c.userId._id.toString() === userId.toString());
        
        // Format chain display
        const chainDisplay = chain.chain.map((person, index) => {
          const isCurrentUser = person.userId._id.toString() === userId.toString();
          return {
            userId: person.userId._id,
            username: person.userId.username,
            name: person.userId.profile?.name || person.userId.username,
            position: index,
            isYou: isCurrentUser,
            sharedAt: person.sharedAt,
            platform: person.platform,
            device: person.device,
            location: person.location,
            clicks: person.clicks,
            views: person.views,
            shares: person.shares,
            engagement: person.engagement
          };
        });

        return {
          chainId: chain.chainId,
          post: chain.post,
          originalSharer: chain.originalSharer,
          yourPosition: userPosition,
          chainDisplay,
          chainString: chainDisplay.map(p => 
            p.isYou ? `${p.username}(you)` : p.username
          ).join(' → '),
          totalClicks: chain.totalClicks,
          totalViews: chain.totalViews,
          totalShares: chain.totalShares,
          analytics: chain.analytics,
          converted: chain.conversion?.converted || false,
          conversionDetails: chain.conversion,
          createdAt: chain.createdAt,
          lastActivity: chain.lastActivity
        };
      });

      return formattedChains;
    } catch (error) {
      console.error('Error getting chain for user:', error);
      throw error;
    }
  }

  /**
   * Get all chains for a specific post
   */
  static async getChainsForPost(postId) {
    try {
      const chains = await ReferralChain.find({ post: postId })
        .populate('originalSharer', 'username email profile.name')
        .populate('chain.userId', 'username email profile.name')
        .sort({ totalClicks: -1, createdAt: -1 });

      return chains.map(chain => ({
        chainId: chain.chainId,
        originalSharer: chain.originalSharer,
        chainLength: chain.chain.length,
        totalClicks: chain.totalClicks,
        totalViews: chain.totalViews,
        totalShares: chain.totalShares,
        chain: chain.chain,
        analytics: chain.analytics,
        converted: chain.conversion?.converted || false,
        conversionValue: chain.conversion?.conversionValue || 0,
        createdAt: chain.createdAt,
        lastActivity: chain.lastActivity
      }));
    } catch (error) {
      console.error('Error getting chains for post:', error);
      throw error;
    }
  }

  /**
   * Calculate commission distribution for a purchase
   * First person: 20%, Second from last: 30%, Remaining 50% split equally
   */
  static async calculateCommissionDistribution(postId, buyerUserId, totalPoints) {
    try {
      const post = await Post.findById(postId);
      if (!post) {
        throw new Error('Post not found');
      }

      // Get all chains for this post
      const allChains = await ReferralChain.find({ post: postId })
        .populate('chain.userId', 'username email');

      // Find which chain the buyer is in
      let buyerChain = null;
      for (const chain of allChains) {
        const buyerInChain = chain.chain.find(c => c.userId._id.toString() === buyerUserId.toString());
        if (buyerInChain) {
          buyerChain = chain;
          break;
        }
      }

      if (!buyerChain) {
        console.log('Buyer not in any referral chain');
        return { commissions: [], totalDistributed: 0 };
      }

      const commissions = [];
      const platformFee = totalPoints * 0.1; // 10% platform fee
      const distributablePoints = totalPoints - platformFee;

      // Get the buyer's chain
      const chain = buyerChain.chain;
      
      if (chain.length < 2) {
        console.log('Chain too short for commission distribution');
        return { commissions: [], totalDistributed: 0, platformFee };
      }

      // First person in chain gets 20%
      const firstPerson = chain[1]; // Position 1 (position 0 is original sharer/post creator)
      if (firstPerson) {
        commissions.push({
          userId: firstPerson.userId._id,
          username: firstPerson.userId.username,
          position: 'first',
          percentage: 20,
          amount: distributablePoints * 0.20,
          reason: 'First person in referral chain'
        });
      }

      // Second from last person gets 30%
      if (chain.length >= 3) {
        const secondFromLast = chain[chain.length - 2];
        if (secondFromLast && secondFromLast.userId._id.toString() !== firstPerson.userId._id.toString()) {
          commissions.push({
            userId: secondFromLast.userId._id,
            username: secondFromLast.userId.username,
            position: 'second_from_last',
            percentage: 30,
            amount: distributablePoints * 0.30,
            reason: 'Second from last in referral chain'
          });
        }
      }

      // Remaining 50% split among middle persons + all persons in other chains
      const remainingAmount = distributablePoints * 0.50;
      const middlePersons = [];

      // Get middle persons from buyer's chain (excluding first and second from last)
      for (let i = 2; i < chain.length - 2; i++) {
        const person = chain[i];
        if (!middlePersons.find(p => p.toString() === person.userId._id.toString())) {
          middlePersons.push(person.userId._id);
        }
      }

      // Get all persons from other chains (including first and last)
      for (const otherChain of allChains) {
        if (otherChain.chainId !== buyerChain.chainId) {
          for (const person of otherChain.chain) {
            if (!middlePersons.find(p => p.toString() === person.userId._id.toString())) {
              middlePersons.push(person.userId._id);
            }
          }
        }
      }

      // Distribute remaining amount equally
      if (middlePersons.length > 0) {
        const amountPerPerson = remainingAmount / middlePersons.length;
        const percentagePerPerson = (50 / middlePersons.length);

        for (const personId of middlePersons) {
          const user = await User.findById(personId);
          commissions.push({
            userId: personId,
            username: user?.username || 'Unknown',
            position: 'middle_or_other_chain',
            percentage: percentagePerPerson,
            amount: amountPerPerson,
            reason: 'Middle person or person in other chain'
          });
        }
      }

      // Mark chain as converted
      buyerChain.conversion = {
        converted: true,
        convertedAt: new Date(),
        convertedBy: buyerUserId,
        conversionValue: totalPoints,
        commissionDistributed: true,
        commissionDetails: commissions.map(c => ({
          userId: c.userId,
          position: chain.findIndex(p => p.userId._id.toString() === c.userId.toString()),
          commissionAmount: c.amount,
          commissionPercentage: c.percentage,
          distributedAt: new Date()
        }))
      };
      await buyerChain.save();

      const totalDistributed = commissions.reduce((sum, c) => sum + c.amount, 0);

      return {
        commissions,
        totalDistributed,
        platformFee,
        buyerChainId: buyerChain.chainId,
        chainLength: chain.length,
        otherChainsCount: allChains.length - 1
      };
    } catch (error) {
      console.error('Error calculating commission distribution:', error);
      throw error;
    }
  }

  /**
   * Helper: Calculate distance between two coordinates
   */
  static calculateDistance(coord1, coord2) {
    if (!coord1 || !coord2 || !coord1.latitude || !coord2.latitude) {
      return null;
    }

    const R = 6371; // Radius of Earth in kilometers
    const dLat = this.toRad(coord2.latitude - coord1.latitude);
    const dLon = this.toRad(coord2.longitude - coord1.longitude);
    const lat1 = this.toRad(coord1.latitude);
    const lat2 = this.toRad(coord2.latitude);

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  static toRad(deg) {
    return deg * (Math.PI / 180);
  }
}

// Export as singleton with setIoInstance method
const service = new ComprehensiveReferralChainServiceClass();
service.setIoInstance = ComprehensiveReferralChainService.setIoInstance;

// Copy all static methods to the service instance
Object.getOwnPropertyNames(ComprehensiveReferralChainServiceClass).forEach(name => {
  if (name !== 'length' && name !== 'prototype' && name !== 'name') {
    service[name] = ComprehensiveReferralChainServiceClass[name];
  }
});

module.exports = service;

