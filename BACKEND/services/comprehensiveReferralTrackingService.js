const ReferralChain = require('../models/ReferralChain');
const Referral = require('../models/Referral');
const User = require('../models/User');
const Post = require('../models/Post');
const geolib = require('geolib');

class ComprehensiveReferralTrackingService {
  /**
   * Track a new referral click with comprehensive analytics
   */
  static async trackReferralClick(data) {
    try {
      const {
        postId,
        referrerId,
        refereeId,
        platform,
        device,
        browser,
        userAgent,
        screenSize,
        coordinates,
        ipAddress,
        networkInfo,
        sessionId,
        language,
        parentReferralId,
        fromLocation,
        toLocation,
        interactionType = 'click',
        duration = 0,
        scrollDepth = 0
      } = data;

      console.log('Tracking referral click:', { postId, referrerId, platform, device });

      // Find or create referral chain
      let chain = await this.findOrCreateReferralChain(postId, referrerId, parentReferralId);
      
      // Add user to chain if not already present
      const chainMember = await this.addUserToChain(chain, {
        userId: refereeId || referrerId,
        platform,
        device,
        browser,
        userAgent,
        location: toLocation,
        coordinates,
        ipAddress,
        sessionId,
        interactionType,
        duration,
        scrollDepth,
        parentReferralId
      });

      // Update chain analytics
      await this.updateChainAnalytics(chain._id, {
        platform,
        device,
        location: toLocation,
        interactionType,
        duration,
        scrollDepth
      });

      // Create individual referral record
      const referral = new Referral({
        post: postId,
        referrer: referrerId,
        referee: refereeId,
        level: chainMember.position,
        platform,
        device,
        browser,
        userAgent,
        screenSize,
        ipAddress,
        networkInfo,
        sessionId,
        language,
        parentReferral: parentReferralId,
        location: {
          latitude: coordinates?.latitude,
          longitude: coordinates?.longitude,
          city: toLocation?.city,
          state: toLocation?.state,
          country: toLocation?.country,
          timezone: toLocation?.timezone,
          accuracy: coordinates?.accuracy
        },
        coordinates,
        clicks: 1,
        engagement: {
          totalClicks: 1,
          uniqueClicks: 1,
          shares: 0,
          timeSpent: duration,
          scrollDepth: scrollDepth,
          interactions: [{
            type: interactionType,
            timestamp: new Date(),
            duration: duration
          }]
        },
        chain: {
          position: chainMember.position,
          totalInChain: chain.chain.length,
          chainId: chain.chainId,
          isActive: true
        }
      });

      await referral.save();

      // Update post analytics
      await this.updatePostAnalytics(postId, referral);

      console.log('Referral click tracked successfully');
      return { referral, chain, chainMember };

    } catch (error) {
      console.error('Comprehensive referral tracking error:', error);
      throw error;
    }
  }

  /**
   * Track a share action
   */
  static async trackShare(data) {
    try {
      const {
        postId,
        referrerId,
        platform,
        device,
        browser,
        coordinates,
        parentReferralId,
        toLocation
      } = data;

      console.log('Tracking share action:', { postId, referrerId, platform });

      // Find the referral chain
      const chain = await ReferralChain.findOne({
        post: postId,
        'chain.userId': referrerId
      });

      if (!chain) {
        throw new Error('Referral chain not found');
      }

      // Update chain member's share count
      const chainMember = chain.chain.find(member => 
        member.userId.toString() === referrerId.toString()
      );

      if (chainMember) {
        chainMember.shares += 1;
        chainMember.engagement.interactions.push({
          type: 'share',
          timestamp: new Date(),
          duration: 0
        });

        // Update chain totals
        chain.totalShares += 1;
        chain.lastActivity = new Date();

        await chain.save();
      }

      // Update post analytics
      await Post.findByIdAndUpdate(postId, {
        $inc: { 'analytics.shares': 1 }
      });

      console.log('Share tracked successfully');
      return { success: true, shares: chainMember?.shares || 0 };

    } catch (error) {
      console.error('Share tracking error:', error);
      throw error;
    }
  }

  /**
   * Track user interaction (scroll, hover, time spent)
   */
  static async trackInteraction(data) {
    try {
      const {
        postId,
        referrerId,
        interactionType,
        duration,
        scrollDepth,
        parentReferralId
      } = data;

      console.log('Tracking interaction:', { postId, referrerId, interactionType });

      // Find the referral chain
      const chain = await ReferralChain.findOne({
        post: postId,
        'chain.userId': referrerId
      });

      if (!chain) {
        throw new Error('Referral chain not found');
      }

      // Update chain member's interaction data
      const chainMember = chain.chain.find(member => 
        member.userId.toString() === referrerId.toString()
      );

      if (chainMember) {
        chainMember.engagement.interactions.push({
          type: interactionType,
          timestamp: new Date(),
          duration: duration || 0
        });

        if (scrollDepth) {
          chainMember.engagement.scrollDepth = Math.max(
            chainMember.engagement.scrollDepth || 0, 
            scrollDepth
          );
        }

        if (interactionType === 'view' && duration) {
          chainMember.engagement.timeSpent = (chainMember.engagement.timeSpent || 0) + duration;
          chainMember.views += 1;
        }

        chain.lastActivity = new Date();
        await chain.save();
      }

      console.log('Interaction tracked successfully');
      return { success: true };

    } catch (error) {
      console.error('Interaction tracking error:', error);
      throw error;
    }
  }

  /**
   * Find or create referral chain
   */
  static async findOrCreateReferralChain(postId, referrerId, parentReferralId) {
    try {
      // If there's a parent referral, find the existing chain
      if (parentReferralId) {
        const parentReferral = await Referral.findById(parentReferralId);
        if (parentReferral) {
          const existingChain = await ReferralChain.findOne({
            post: postId,
            chainId: parentReferral.chain?.chainId
          });
          if (existingChain) {
            return existingChain;
          }
        }
      }

      // Create new chain
      const chainId = `chain_${postId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const chain = new ReferralChain({
        post: postId,
        chainId,
        originalSharer: referrerId,
        chain: [],
        totalClicks: 0,
        totalViews: 0,
        totalShares: 0,
        analytics: {
          platformBreakdown: new Map(),
          deviceBreakdown: new Map(),
          locationBreakdown: new Map(),
          timeBreakdown: {
            hourly: new Map(),
            daily: new Map()
          },
          journeyMap: []
        }
      });

      await chain.save();
      console.log('New referral chain created:', chainId);
      return chain;

    } catch (error) {
      console.error('Chain creation error:', error);
      throw error;
    }
  }

  /**
   * Add user to referral chain
   */
  static async addUserToChain(chain, userData) {
    try {
      const {
        userId,
        platform,
        device,
        browser,
        userAgent,
        location,
        coordinates,
        ipAddress,
        sessionId,
        interactionType,
        duration,
        scrollDepth,
        parentReferralId
      } = userData;

      // Check if user is already in chain
      const existingMember = chain.chain.find(member => 
        member.userId.toString() === userId.toString()
      );

      if (existingMember) {
        // Update existing member's data
        existingMember.clicks += 1;
        existingMember.engagement.interactions.push({
          type: interactionType,
          timestamp: new Date(),
          duration: duration || 0
        });

        if (scrollDepth) {
          existingMember.engagement.scrollDepth = Math.max(
            existingMember.engagement.scrollDepth || 0, 
            scrollDepth
          );
        }

        if (interactionType === 'view' && duration) {
          existingMember.engagement.timeSpent = (existingMember.engagement.timeSpent || 0) + duration;
          existingMember.views += 1;
        }

        chain.totalClicks += 1;
        chain.lastActivity = new Date();
        await chain.save();

        return existingMember;
      }

      // Add new member to chain
      const position = chain.chain.length;
      const newMember = {
        userId,
        position,
        sharedAt: new Date(),
        platform,
        device,
        browser,
        userAgent,
        location: {
          city: location?.city,
          state: location?.state,
          country: location?.country,
          coordinates: {
            latitude: coordinates?.latitude,
            longitude: coordinates?.longitude,
            accuracy: coordinates?.accuracy
          }
        },
        ipAddress,
        sessionId,
        clicks: 1,
        views: interactionType === 'view' ? 1 : 0,
        shares: 0,
        engagement: {
          timeSpent: duration || 0,
          scrollDepth: scrollDepth || 0,
          interactions: [{
            type: interactionType,
            timestamp: new Date(),
            duration: duration || 0
          }]
        }
      };

      chain.chain.push(newMember);
      chain.totalClicks += 1;
      chain.lastActivity = new Date();
      await chain.save();

      console.log(`User ${userId} added to chain at position ${position}`);
      return newMember;

    } catch (error) {
      console.error('Add user to chain error:', error);
      throw error;
    }
  }

  /**
   * Update chain analytics
   */
  static async updateChainAnalytics(chainId, data) {
    try {
      const { platform, device, location, interactionType, duration, scrollDepth } = data;

      const chain = await ReferralChain.findById(chainId);
      if (!chain) return;

      // Update platform breakdown
      const currentPlatformCount = chain.analytics.platformBreakdown.get(platform) || 0;
      chain.analytics.platformBreakdown.set(platform, currentPlatformCount + 1);

      // Update device breakdown
      const currentDeviceCount = chain.analytics.deviceBreakdown.get(device) || 0;
      chain.analytics.deviceBreakdown.set(device, currentDeviceCount + 1);

      // Update location breakdown
      if (location?.city) {
        const locationKey = `${location.city}, ${location.state || location.country}`;
        const currentLocationCount = chain.analytics.locationBreakdown.get(locationKey) || 0;
        chain.analytics.locationBreakdown.set(locationKey, currentLocationCount + 1);
      }

      // Update time breakdown
      const now = new Date();
      const hour = now.getHours();
      const day = now.getDay();
      
      const currentHourCount = chain.analytics.timeBreakdown.hourly.get(hour) || 0;
      chain.analytics.timeBreakdown.hourly.set(hour, currentHourCount + 1);
      
      const currentDayCount = chain.analytics.timeBreakdown.daily.get(day) || 0;
      chain.analytics.timeBreakdown.daily.set(day, currentDayCount + 1);

      await chain.save();

    } catch (error) {
      console.error('Chain analytics update error:', error);
    }
  }

  /**
   * Update post analytics
   */
  static async updatePostAnalytics(postId, referral) {
    try {
      await Post.findByIdAndUpdate(postId, {
        $inc: {
          'analytics.views': 1,
          'analytics.clicks': 1,
          'analytics.shares': referral.engagement.shares || 0
        },
        $push: {
          'analytics.viewHistory': {
            userId: referral.referee || referral.referrer,
            timestamp: new Date(),
            platform: referral.platform,
            device: referral.device,
            browser: referral.browser,
            ipAddress: referral.ipAddress,
            referrer: referral.parentReferral,
            sessionId: referral.sessionId
          }
        }
      });

    } catch (error) {
      console.error('Post analytics update error:', error);
    }
  }

  /**
   * Get comprehensive analytics for a post
   */
  static async getPostAnalytics(postId) {
    try {
      const chains = await ReferralChain.find({ post: postId })
        .populate('chain.userId', 'username email')
        .populate('originalSharer', 'username email');

      const analytics = {
        totalChains: chains.length,
        totalClicks: chains.reduce((sum, chain) => sum + chain.totalClicks, 0),
        totalViews: chains.reduce((sum, chain) => sum + chain.totalViews, 0),
        totalShares: chains.reduce((sum, chain) => sum + chain.totalShares, 0),
        uniqueUsers: new Set(chains.flatMap(chain => chain.chain.map(member => member.userId.toString()))).size,
        convertedChains: chains.filter(chain => chain.conversion.converted).length,
        conversionRate: 0,
        chainAnalytics: chains.map(chain => ({
          chainId: chain.chainId,
          length: chain.chain.length,
          totalClicks: chain.totalClicks,
          totalViews: chain.totalViews,
          totalShares: chain.totalShares,
          converted: chain.conversion.converted,
          members: chain.chain.map(member => ({
            userId: member.userId,
            position: member.position,
            platform: member.platform,
            device: member.device,
            clicks: member.clicks,
            views: member.views,
            shares: member.shares,
            sharedAt: member.sharedAt
          }))
        })),
        platformBreakdown: {},
        deviceBreakdown: {},
        locationBreakdown: {},
        timeAnalysis: {
          hourly: {},
          daily: {}
        },
        journeyMap: []
      };

      // Calculate conversion rate
      if (chains.length > 0) {
        analytics.conversionRate = (analytics.convertedChains / chains.length) * 100;
      }

      // Aggregate analytics from all chains
      for (const chain of chains) {
        // Platform breakdown
        for (const [platform, count] of chain.analytics.platformBreakdown) {
          analytics.platformBreakdown[platform] = (analytics.platformBreakdown[platform] || 0) + count;
        }

        // Device breakdown
        for (const [device, count] of chain.analytics.deviceBreakdown) {
          analytics.deviceBreakdown[device] = (analytics.deviceBreakdown[device] || 0) + count;
        }

        // Location breakdown
        for (const [location, count] of chain.analytics.locationBreakdown) {
          analytics.locationBreakdown[location] = (analytics.locationBreakdown[location] || 0) + count;
        }

        // Time analysis
        for (const [hour, count] of chain.analytics.timeBreakdown.hourly) {
          analytics.timeAnalysis.hourly[hour] = (analytics.timeAnalysis.hourly[hour] || 0) + count;
        }

        for (const [day, count] of chain.analytics.timeBreakdown.daily) {
          analytics.timeAnalysis.daily[day] = (analytics.timeAnalysis.daily[day] || 0) + count;
        }

        // Journey map
        analytics.journeyMap.push(...chain.analytics.journeyMap);
      }

      return analytics;

    } catch (error) {
      console.error('Post analytics retrieval error:', error);
      throw error;
    }
  }

  /**
   * Get user's referral chain history
   */
  static async getUserReferralChains(userId) {
    try {
      const chains = await ReferralChain.find({
        $or: [
          { originalSharer: userId },
          { 'chain.userId': userId }
        ]
      }).populate('post', 'title category price')
        .populate('chain.userId', 'username email')
        .sort({ createdAt: -1 });

      return chains.map(chain => ({
        _id: chain._id,
        chainId: chain.chainId,
        post: chain.post,
        originalSharer: chain.originalSharer,
        userPosition: chain.chain.findIndex(member => member.userId.toString() === userId.toString()),
        chainLength: chain.chain.length,
        totalClicks: chain.totalClicks,
        totalViews: chain.totalViews,
        totalShares: chain.totalShares,
        converted: chain.conversion.converted,
        createdAt: chain.createdAt,
        lastActivity: chain.lastActivity
      }));

    } catch (error) {
      console.error('User referral chains error:', error);
      throw error;
    }
  }
}

module.exports = ComprehensiveReferralTrackingService;
