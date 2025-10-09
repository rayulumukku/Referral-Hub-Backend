const Referral = require('../models/Referral');
const Post = require('../models/Post');
const User = require('../models/User');
const geolib = require('geolib');

class TrackingService {
  // Track a referral click with comprehensive data
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
        toLocation
      } = data;

      // Get post and referrer details
      const post = await Post.findById(postId).populate('creator');
      const referrer = await User.findById(referrerId);
      
      if (!post || !referrer) {
        throw new Error('Post or referrer not found');
      }

      // Calculate journey data
      const journeyData = await this.calculateJourneyData(post, fromLocation, toLocation);
      
      // Get or create chain ID
      const chainId = await this.getOrCreateChainId(postId, parentReferralId);
      
      // Calculate chain position
      const chainPosition = await this.calculateChainPosition(postId, parentReferralId);
      
      // Calculate distance and time
      const distance = this.calculateDistance(post.location, coordinates);
      const timeTaken = this.calculateTimeTaken(post.createdAt);

      // Create comprehensive referral record
      const referral = new Referral({
        post: postId,
        referrer: referrerId,
        referee: refereeId,
        level: chainPosition + 1,
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
        distance,
        timeTaken,
        chainPosition,
        journey: journeyData,
        chain: {
          position: chainPosition,
          totalInChain: chainPosition + 1,
          chainId,
          isActive: true
        },
        engagement: {
          totalClicks: 1,
          uniqueClicks: 1,
          shares: 0,
          interactions: [{
            type: 'click',
            timestamp: new Date(),
            duration: 0
          }]
        }
      });

      await referral.save();

      // Emit real-time updates using the comprehensive service
      const RealTimeAnalyticsService = require('./realTimeAnalyticsService');
      await RealTimeAnalyticsService.onNewReferral(referral._id);

      // Emit real-time updates
      const io = require('../server').getIo();
      if (io) {
        // Emit to post creator
        io.to(`user_${post.creator._id}`).emit('referral_update', {
          type: 'new_referral',
          postId,
          referralId: referral._id,
          referrer: referrer.username,
          platform,
          location: toLocation,
          timestamp: new Date()
        });

        // Emit to referrer
        io.to(`user_${referrerId}`).emit('referral_update', {
          type: 'referral_click',
          postId,
          referralId: referral._id,
          platform,
          location: toLocation,
          timestamp: new Date()
        });

        // Emit global analytics update
        io.emit('global_analytics_update', {
          type: 'new_referral',
          postId,
          timestamp: new Date()
        });
      }

      // Update post analytics
      await this.updatePostAnalytics(postId, referral);

      return referral;
    } catch (error) {
      console.error('Tracking error:', error);
      throw error;
    }
  }

  // Track a share action
  static async trackShare(data) {
    try {
      const {
        postId,
        referrerId,
        platform,
        device,
        browser,
        coordinates,
        parentReferralId
      } = data;

      // Find the referral record
      const referral = await Referral.findOne({
        post: postId,
        referrer: referrerId,
        parentReferral: parentReferralId
      });

      if (referral) {
        // Update engagement data
        referral.engagement.shares += 1;
        referral.engagement.interactions.push({
          type: 'share',
          timestamp: new Date(),
          duration: 0
        });
        
        await referral.save();
      }

      return referral;
    } catch (error) {
      console.error('Share tracking error:', error);
      throw error;
    }
  }

  // Track user interactions (scroll, hover, time spent)
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

      const referral = await Referral.findOne({
        post: postId,
        referrer: referrerId,
        parentReferral: parentReferralId
      });

      if (referral) {
        // Update engagement data
        referral.engagement.interactions.push({
          type: interactionType,
          timestamp: new Date(),
          duration: duration || 0
        });

        if (scrollDepth) {
          referral.engagement.scrollDepth = Math.max(referral.engagement.scrollDepth || 0, scrollDepth);
        }

        if (interactionType === 'view' && duration) {
          referral.engagement.timeSpent = (referral.engagement.timeSpent || 0) + duration;
        }

        await referral.save();
      }

      return referral;
    } catch (error) {
      console.error('Interaction tracking error:', error);
      throw error;
    }
  }

  // Calculate journey data between locations
  static async calculateJourneyData(post, fromLocation, toLocation) {
    try {
      let distance = 0;
      let travelTime = 0;

      if (fromLocation && toLocation) {
        distance = this.calculateDistance(
          { latitude: fromLocation.latitude, longitude: fromLocation.longitude },
          { latitude: toLocation.latitude, longitude: toLocation.longitude }
        );
        
        // Estimate travel time (rough calculation)
        travelTime = distance / 50; // Assuming 50 km/h average speed
      }

      return {
        fromLocation: fromLocation || null,
        toLocation: toLocation || null,
        distance,
        travelTime
      };
    } catch (error) {
      console.error('Journey calculation error:', error);
      return {
        fromLocation: null,
        toLocation: null,
        distance: 0,
        travelTime: 0
      };
    }
  }

  // Get or create chain ID for referral tracking
  static async getOrCreateChainId(postId, parentReferralId) {
    if (parentReferralId) {
      const parentReferral = await Referral.findById(parentReferralId);
      return parentReferral?.chain?.chainId || `chain_${postId}_${Date.now()}`;
    }
    return `chain_${postId}_${Date.now()}`;
  }

  // Calculate position in referral chain
  static async calculateChainPosition(postId, parentReferralId) {
    if (!parentReferralId) {
      return 0; // Original sharer
    }

    const parentReferral = await Referral.findById(parentReferralId);
    return (parentReferral?.chain?.position || 0) + 1;
  }

  // Calculate distance between two points
  static calculateDistance(point1, point2) {
    if (!point1 || !point2) return 0;
    
    try {
      return geolib.getDistance(
        { latitude: point1.latitude, longitude: point1.longitude },
        { latitude: point2.latitude, longitude: point2.longitude }
      ) / 1000; // Convert to kilometers
    } catch (error) {
      return 0;
    }
  }

  // Calculate time taken from post creation
  static calculateTimeTaken(postCreatedAt) {
    const now = new Date();
    const diffInMinutes = (now - postCreatedAt) / (1000 * 60);
    return Math.round(diffInMinutes);
  }

  // Update post analytics
  static async updatePostAnalytics(postId, referral) {
    try {
      await Post.findByIdAndUpdate(postId, {
        $inc: {
          'analytics.views': 1,
          'analytics.uniqueViewers': referral.referee ? 1 : 0,
          'analytics.shares': referral.engagement.shares,
          'analytics.clicks': referral.engagement.totalClicks
        }
      });
    } catch (error) {
      console.error('Analytics update error:', error);
    }
  }

  // Get comprehensive analytics for a post
  static async getPostAnalytics(postId) {
    try {
      const referrals = await Referral.find({ post: postId })
        .populate('referrer', 'username email')
        .populate('referee', 'username email')
        .sort({ createdAt: 1 });

      // Calculate analytics
      const analytics = {
        totalReferrals: referrals.length,
        totalClicks: referrals.reduce((sum, r) => sum + r.engagement.totalClicks, 0),
        totalShares: referrals.reduce((sum, r) => sum + r.engagement.shares, 0),
        uniqueViewers: new Set(referrals.map(r => r.referee?.toString()).filter(Boolean)).size,
        
        // Platform breakdown
        platforms: this.getBreakdown(referrals, 'platform'),
        
        // Device breakdown
        devices: this.getBreakdown(referrals, 'device'),
        
        // Browser breakdown
        browsers: this.getBreakdown(referrals, 'browser'),
        
        // Location breakdown
        locations: this.getLocationBreakdown(referrals),
        
        // Journey map
        journeyMap: this.buildJourneyMap(referrals),
        
        // Chain analysis
        chains: this.analyzeChains(referrals),
        
        // Time analysis
        timeAnalysis: this.analyzeTimePatterns(referrals)
      };

      return analytics;
    } catch (error) {
      console.error('Analytics retrieval error:', error);
      throw error;
    }
  }

  // Get breakdown by field
  static getBreakdown(referrals, field) {
    const breakdown = {};
    referrals.forEach(referral => {
      const value = referral[field];
      if (value) {
        breakdown[value] = (breakdown[value] || 0) + 1;
      }
    });
    return breakdown;
  }

  // Get location breakdown
  static getLocationBreakdown(referrals) {
    const locations = {};
    referrals.forEach(referral => {
      if (referral.location?.city) {
        const key = `${referral.location.city}, ${referral.location.state || referral.location.country}`;
        locations[key] = (locations[key] || 0) + 1;
      }
    });
    return locations;
  }

  // Build journey map
  static buildJourneyMap(referrals) {
    const journey = [];
    referrals.forEach(referral => {
      if (referral.journey?.fromLocation && referral.journey?.toLocation) {
        journey.push({
          from: referral.journey.fromLocation,
          to: referral.journey.toLocation,
          distance: referral.journey.distance,
          travelTime: referral.journey.travelTime,
          timestamp: referral.createdAt,
          referrer: referral.referrer,
          platform: referral.platform
        });
      }
    });
    return journey;
  }

  // Analyze referral chains
  static analyzeChains(referrals) {
    const chains = {};
    referrals.forEach(referral => {
      const chainId = referral.chain?.chainId;
      if (chainId) {
        if (!chains[chainId]) {
          chains[chainId] = [];
        }
        chains[chainId].push(referral);
      }
    });

    return Object.keys(chains).map(chainId => ({
      chainId,
      length: chains[chainId].length,
      referrals: chains[chainId].map(r => ({
        referrer: r.referrer,
        timestamp: r.createdAt,
        platform: r.platform,
        location: r.location
      }))
    }));
  }

  // Analyze time patterns
  static analyzeTimePatterns(referrals) {
    const hourly = {};
    const daily = {};
    
    referrals.forEach(referral => {
      const hour = new Date(referral.createdAt).getHours();
      const day = new Date(referral.createdAt).getDay();
      
      hourly[hour] = (hourly[hour] || 0) + 1;
      daily[day] = (daily[day] || 0) + 1;
    });

    return { hourly, daily };
  }
}

module.exports = TrackingService;
