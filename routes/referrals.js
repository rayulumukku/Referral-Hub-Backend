const express = require('express');
const Referral = require('../models/Referral');
const Commission = require('../models/Commission');
const User = require('../models/User');
const auth = require('../middleware/auth');
const ActivityService = require('../services/activityService');
const GamificationService = require('../services/gamificationService');
const NotificationService = require('../services/notificationService');

const router = express.Router();

// Get io instance from server.js
let io;
const setIoInstance = (ioInstance) => {
  io = ioInstance;
};

// Attach setIoInstance to router
router.setIoInstance = setIoInstance;

// Track referral click (public endpoint) - Enhanced with comprehensive tracking
router.post('/track', async (req, res) => {
  try {
    const {
      postId,
      referrerId,
      refereeId, // The person who clicked (optional)
      platform,
      location,
      device,
      browser,
      userAgent,
      screenSize,
      coordinates,
      ipAddress,
      networkInfo,
      sessionId,
      referrer: httpReferrer,
      language,
      parentReferralId, // Link to parent referral in chain
      fromLocation, // Where the link was shared from
      toLocation, // Where the link was clicked
      interactionType, // click, share, view, scroll, hover
      duration, // Time spent
      scrollDepth // How far user scrolled
    } = req.body;

    // Use comprehensive tracking service
    const TrackingService = require('../services/trackingService');
    
    // Track the referral click with all data
    const referral = await TrackingService.trackReferralClick({
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
    });

    // Referral already created by TrackingService

    // Track referral click activity
    await ActivityService.trackReferralClick(referrerId, postId, platform, {
      platform,
      device,
      location,
      userAgent: browser,
      ip: req.ip
    });

    // Send notification for referral click
    if (referrerId) {
      await NotificationService.notifyReferralClick(referral);

      // Check for badge achievements
      await GamificationService.checkAndAwardBadges(referrerId);

      // Update user streak
      await GamificationService.updateStreak(referrerId);
    }

    // Update post reach
    await Post.findByIdAndUpdate(postId, { $inc: { reach: 1 } });

    // Emit real-time updates
    if (io) {
      // Emit to referrer if logged in
      if (referrerId) {
        io.to(`user_${referrerId}`).emit('referral_update', {
          type: 'new_click',
          referral: {
            _id: referral._id,
            post: postId,
            platform,
            device,
            location,
            timestamp: referral.createdAt
          }
        });

        // Emit user analytics update for referrer
        io.to(`user_${referrerId}`).emit('user_analytics_update', {
          type: 'network_growth',
          userId: referrerId,
          change: 'new_referral_click',
          timestamp: new Date()
        });
      }

      // Emit to post owner
      const post = await Post.findById(postId).populate('creator');
      if (post && post.creator) {
        io.to(`user_${post.creator._id}`).emit('post_analytics_update', {
          postId,
          type: 'reach_increase',
          newReach: post.reach + 1
        });

        // Emit user analytics update for post owner
        io.to(`user_${post.creator._id}`).emit('user_analytics_update', {
          type: 'post_performance',
          userId: post.creator._id,
          postId,
          change: 'reach_increase',
          timestamp: new Date()
        });
      }

      // Emit global analytics update
      io.emit('global_analytics_update', {
        type: 'new_referral',
        platform,
        device,
        location: location.city + ', ' + location.state,
        timestamp: new Date()
      });
    }

    res.status(201).json(referral);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Record conversion and calculate commissions
router.post('/convert', auth, async (req, res) => {
  try {
    const { postId, buyerUserId } = req.body;

    // Use the new commission service for distribution
    const CommissionService = require('../services/commissionService');
    
    console.log('Using new commission distribution logic...');
    const result = await CommissionService.distributePoints(
      postId, 
      buyerUserId || req.user.id, 
      1000, // soldPrice
      new Date() // soldAt
    );

    console.log('Commission distribution result:', result);

    // Update post conversion status
    const Post = require('../models/Post');
    await Post.findByIdAndUpdate(postId, { 
      $inc: { conversions: 1 },
      $set: { status: 'sold' }
    });

    // Track activities and send notifications for all commissions
    const allCommissions = await Commission.find({ post: postId });
    for (const commission of allCommissions) {
      if (commission.recipient) {
        await ActivityService.trackCommissionEarned(commission.recipient, commission.amount, commission.referral, commission.level);
        await NotificationService.notifyCommissionEarned(commission);

        // Emit real-time updates
        if (io) {
          io.to(`user_${commission.recipient}`).emit('commission_update', {
            type: 'new_commission',
            commission: {
              _id: commission._id,
              amount: commission.amount,
              level: commission.level,
              post: postId,
              timestamp: new Date()
            }
          });

          io.to(`user_${commission.recipient}`).emit('credits_update', {
            newCredits: (await User.findById(commission.recipient)).credits
          });

          io.to(`user_${commission.recipient}`).emit('user_analytics_update', {
            type: 'commission_earned',
            userId: commission.recipient,
            amount: commission.amount,
            level: commission.level,
            postId,
            timestamp: new Date()
          });
        }
      }
    }

    // Post conversion already updated above

    // Emit conversion update
    if (io) {
      const post = await Post.findById(postId).populate('creator');
      if (post && post.creator) {
        io.to(`user_${post.creator._id}`).emit('post_analytics_update', {
          postId,
          type: 'conversion_increase',
          newConversions: post.conversions + 1
        });
      }
    }

    res.json({ 
      message: 'Conversion recorded and commissions distributed using new logic',
      totalCommissions: result.commissions?.length || 0,
      totalDistributed: result.totalDistributed || 0,
      platformFee: result.platformFee || 0
    });
  } catch (error) {
    console.error('Conversion error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create a referral share and return a shareable URL with a referral id
router.post('/share', async (req, res) => {
  try {
    const { postId, platform, parentReferralId } = req.body;
    const token = req.headers.authorization?.replace('Bearer ', '');
    let userId = null;

    if (token) {
      try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded.id;
      } catch (err) {
        // ignore invalid token
      }
    }

    const Post = require('../models/Post');
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // Create a seed referral representing this share action
    const referral = new Referral({
      post: postId,
      referrer: userId || null,
      referee: null,
      platform,
      location: null,
      device: null,
      browser: null,
      userAgent: req.headers['user-agent'],
      screenSize: null,
      coordinates: null,
      ipAddress: req.ip,
      networkInfo: null,
      sessionId: null,
      referrer: null,
      language: null,
      distance: 0,
      timeTaken: 0,
      chainPosition: 1,
      parentReferral: parentReferralId || null,
    });
    await referral.save();

    // Build share URL with referral id
    const baseUrl = process.env.FRONTEND_URL || 'https://referral-hub-frontend.vercel.app';
    const shareUrl = `${baseUrl}/post/${postId}?ref=${referral._id}`;

    // Track activity
    if (userId) {
      await ActivityService.trackReferralShared(userId, postId, platform, {
        platform,
        userAgent: req.headers['user-agent'],
        ip: req.ip
      });
    }

    return res.json({ referralId: referral._id, shareUrl });
  } catch (error) {
    console.error('Share creation error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get referral chain for a user
router.get('/chain/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // Find all referrals where the user is involved (as referrer or referee)
    const referrals = await Referral.find({
      $or: [{ referrer: userId }, { referee: userId }]
    }).populate('referrer', 'username email')
      .populate('referee', 'username email')
      .populate('post', 'title')
      .sort({ createdAt: -1 });

    // Build the chain structure
    const chain = {
      userId,
      referrals: referrals.map(r => ({
        _id: r._id,
        post: r.post,
        referrer: r.referrer,
        referee: r.referee,
        level: r.level,
        chainPosition: r.chainPosition,
        createdAt: r.createdAt
      }))
    };

    res.json(chain);
  } catch (error) {
    console.error('Chain fetch error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get comprehensive analytics for a post
router.get('/analytics/:postId', async (req, res) => {
  try {
    const { postId } = req.params;
    const TrackingService = require('../services/trackingService');
    
    const analytics = await TrackingService.getPostAnalytics(postId);
    
    res.json({
      success: true,
      analytics
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Track user interactions (scroll, hover, time spent)
router.post('/interaction', async (req, res) => {
  try {
    const {
      postId,
      referrerId,
      interactionType,
      duration,
      scrollDepth,
      parentReferralId
    } = req.body;

    const TrackingService = require('../services/trackingService');
    
    const result = await TrackingService.trackInteraction({
      postId,
      referrerId,
      interactionType,
      duration,
      scrollDepth,
      parentReferralId
    });

    res.json({
      success: true,
      message: 'Interaction tracked',
      result
    });
  } catch (error) {
    console.error('Interaction tracking error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET interaction endpoint for frontend compatibility
router.get('/interaction', async (req, res) => {
  try {
    // Return basic interaction data or empty response
    res.json({
      success: true,
      message: 'Interaction endpoint available',
      interactions: []
    });
  } catch (error) {
    console.error('GET interaction error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Track share action
router.post('/share', async (req, res) => {
  try {
    const {
      postId,
      referrerId,
      platform,
      device,
      browser,
      coordinates,
      parentReferralId
    } = req.body;

    const TrackingService = require('../services/trackingService');
    
    const result = await TrackingService.trackShare({
      postId,
      referrerId,
      platform,
      device,
      browser,
      coordinates,
      parentReferralId
    });

    res.json({
      success: true,
      message: 'Share tracked',
      result
    });
  } catch (error) {
    console.error('Share tracking error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;