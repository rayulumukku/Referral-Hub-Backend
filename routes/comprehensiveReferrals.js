const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const ComprehensiveReferralChainService = require('../services/comprehensiveReferralChainService');
const Post = require('../models/Post');
const User = require('../models/User');
const Commission = require('../models/Commission');

// Get io instance
let io;
const setIoInstance = (ioInstance) => {
  io = ioInstance;
};
router.setIoInstance = setIoInstance;

/**
 * POST /api/comprehensive-referrals/post-created
 * Initialize post with creator's view (sets clicks to 1)
 */
router.post('/post-created', auth, async (req, res) => {
  try {
    const { postId, metadata } = req.body;
    const creatorId = req.user.id;

    const result = await ComprehensiveReferralChainService.initializePostView(
      postId,
      creatorId,
      {
        ...metadata,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      }
    );

    // 🚀 Create activity with COMPLETE data
    const ActivityService = require('../services/activityService');
    const Post = require('../models/Post');
    const post = await Post.findById(postId);
    
    if (post) {
      await ActivityService.trackPostCreation(
        creatorId,
        postId,
        post.title,
        {
          platform: metadata?.platform || 'web',
          device: metadata?.device || 'desktop',
          browser: metadata?.browser || 'Unknown',
          location: metadata?.location || {},
          ipAddress: req.ip,
          userAgent: req.headers['user-agent']
        }
      );
      console.log(`✅ Activity created: Post "${post.title}" by user ${creatorId}`);
    }

    res.json({
      success: true,
      message: 'Post initialized with creator view',
      ...result
    });
  } catch (error) {
    console.error('Error initializing post:', error);
    res.status(500).json({
      success: false,
      message: 'Error initializing post',
      error: error.message
    });
  }
});

/**
 * POST /api/comprehensive-referrals/share
 * Track when user shares a post
 * Returns chainId and shareUrl
 */
router.post('/share', async (req, res) => {
  try {
    const {
      postId,
      sharerId,
      platform,
      device,
      browser,
      location,
      coordinates,
      fromLocation,
      toLocation,
      parentChainId
    } = req.body;

    // Get user ID from auth if available
    let userId = sharerId;
    if (!userId && req.headers.authorization) {
      try {
        const jwt = require('jsonwebtoken');
        const token = req.headers.authorization.replace('Bearer ', '');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded.id;
      } catch (err) {
        // User not authenticated, allow anonymous share
      }
    }

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID required for sharing'
      });
    }

    const result = await ComprehensiveReferralChainService.trackShare({
      postId,
      sharerId: userId,
      platform: platform || 'web',
      device: device || 'desktop',
      browser: browser || 'Unknown',
      location,
      coordinates,
      fromLocation,
      toLocation,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      sessionId: req.headers['x-session-id'] || null,
      parentChainId
    });

    // Build shareable URL
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const shareUrl = `${baseUrl}/post/${postId}?chainId=${result.chainId}&ref=${userId}`;

    // Emit real-time update
    if (io) {
      io.to(`user_${userId}`).emit('referral_update', {
        type: 'share_tracked',
        postId,
        chainId: result.chainId,
        timestamp: new Date()
      });
    }

    res.json({
      success: true,
      message: 'Share tracked successfully',
      chainId: result.chainId,
      shareUrl,
      referralId: result.referral._id,
      chain: result.chain
    });
  } catch (error) {
    console.error('Error tracking share:', error);
    res.status(500).json({
      success: false,
      message: 'Error tracking share',
      error: error.message
    });
  }
});

/**
 * POST /api/comprehensive-referrals/click
 * Track when someone clicks a referral link
 */
router.post('/click', async (req, res) => {
  try {
    const {
      postId,
      chainId,
      clickerId,
      referrerId,
      platform,
      device,
      browser,
      location,
      coordinates
    } = req.body;

    if (!chainId || !referrerId) {
      return res.status(400).json({
        success: false,
        message: 'chainId and referrerId are required'
      });
    }

    const result = await ComprehensiveReferralChainService.trackClick({
      postId,
      chainId,
      clickerId: clickerId || null,
      referrerId,
      platform: platform || 'web',
      device: device || 'desktop',
      browser: browser || 'Unknown',
      location,
      coordinates,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      sessionId: req.headers['x-session-id'] || null
    });

    // Emit real-time update
    if (io && referrerId) {
      io.to(`user_${referrerId}`).emit('referral_update', {
        type: 'new_click',
        postId,
        chainId,
        timestamp: new Date()
      });
    }

    res.json({
      success: true,
      message: 'Click tracked successfully',
      chain: result.chain
    });
  } catch (error) {
    console.error('Error tracking click:', error);
    res.status(500).json({
      success: false,
      message: 'Error tracking click',
      error: error.message
    });
  }
});

/**
 * POST /api/comprehensive-referrals/register
 * Track when someone registers/logs in via referral link
 */
router.post('/register', async (req, res) => {
  try {
    const {
      postId,
      chainId,
      newUserId,
      referrerId,
      platform,
      device,
      browser,
      location,
      coordinates,
      registrationType // 'register' or 'login'
    } = req.body;

    if (!chainId || !newUserId || !referrerId) {
      return res.status(400).json({
        success: false,
        message: 'chainId, newUserId, and referrerId are required'
      });
    }

    const result = await ComprehensiveReferralChainService.trackRegistration({
      postId,
      chainId,
      newUserId,
      referrerId,
      platform: platform || 'web',
      device: device || 'desktop',
      browser: browser || 'Unknown',
      location,
      coordinates,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      sessionId: req.headers['x-session-id'] || null,
      registrationType: registrationType || 'register'
    });

    // Emit real-time update to referrer
    if (io && referrerId) {
      io.to(`user_${referrerId}`).emit('referral_update', {
        type: 'new_referral',
        postId,
        chainId,
        newUser: newUserId,
        timestamp: new Date()
      });
    }

    // Emit to new user
    if (io && newUserId) {
      io.to(`user_${newUserId}`).emit('referral_update', {
        type: 'joined_chain',
        postId,
        chainId,
        referredBy: referrerId,
        timestamp: new Date()
      });
    }

    res.json({
      success: true,
      message: 'Registration tracked successfully',
      chain: result.chain,
      referral: result.referral
    });
  } catch (error) {
    console.error('Error tracking registration:', error);
    res.status(500).json({
      success: false,
      message: 'Error tracking registration',
      error: error.message
    });
  }
});

/**
 * GET /api/comprehensive-referrals/user/:userId/chains
 * Get all chains for a user with formatted display
 */
router.get('/user/:userId/chains', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    const { postId } = req.query;

    // Verify user can only access their own chains (or admin)
    if (req.user.id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const chains = await ComprehensiveReferralChainService.getChainForUser(userId, postId);

    res.json({
      success: true,
      count: chains.length,
      chains
    });
  } catch (error) {
    console.error('Error getting user chains:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting user chains',
      error: error.message
    });
  }
});

/**
 * GET /api/comprehensive-referrals/post/:postId/chains
 * Get all chains for a specific post
 */
router.get('/post/:postId/chains', auth, async (req, res) => {
  try {
    const { postId } = req.params;

    // Verify user is post creator or admin
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    if (post.creator.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const chains = await ComprehensiveReferralChainService.getChainsForPost(postId);

    res.json({
      success: true,
      postId,
      count: chains.length,
      chains
    });
  } catch (error) {
    console.error('Error getting post chains:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting post chains',
      error: error.message
    });
  }
});

/**
 * POST /api/comprehensive-referrals/purchase
 * Handle purchase and distribute commissions
 */
router.post('/purchase', auth, async (req, res) => {
  try {
    const { postId, buyerUserId } = req.body;

    if (!postId) {
      return res.status(400).json({
        success: false,
        message: 'postId is required'
      });
    }

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    const totalPoints = post.pointsPool || 1000;
    const buyerId = buyerUserId || req.user.id;

    // Calculate and distribute commissions
    const distribution = await ComprehensiveReferralChainService.calculateCommissionDistribution(
      postId,
      buyerId,
      totalPoints
    );

    // Create commission records and update user credits
    for (const commission of distribution.commissions) {
      // Save commission record
      const commissionRecord = new Commission({
        post: postId,
        recipient: commission.userId,
        amount: commission.amount,
        percentage: commission.percentage,
        level: commission.position,
        referral: null, // We can link to referral if needed
        status: 'completed',
        metadata: {
          reason: commission.reason,
          buyerChainId: distribution.buyerChainId,
          chainLength: distribution.chainLength,
          distributionType: 'comprehensive'
        }
      });
      await commissionRecord.save();

      // Update user credits
      await User.findByIdAndUpdate(commission.userId, {
        $inc: {
          credits: commission.amount,
          'gamification.totalPoints': commission.amount
        }
      });

      // Send notification
      if (io) {
        io.to(`user_${commission.userId}`).emit('commission_earned', {
          type: 'purchase_commission',
          postId,
          amount: commission.amount,
          percentage: commission.percentage,
          position: commission.position,
          timestamp: new Date()
        });
      }
    }

    // Update post status
    await Post.findByIdAndUpdate(postId, {
      $inc: { conversions: 1 },
      $set: { status: 'sold' }
    });

    res.json({
      success: true,
      message: 'Purchase completed and commissions distributed',
      totalDistributed: distribution.totalDistributed,
      platformFee: distribution.platformFee,
      commissionsCount: distribution.commissions.length,
      distribution
    });
  } catch (error) {
    console.error('Error processing purchase:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing purchase',
      error: error.message
    });
  }
});

/**
 * GET /api/comprehensive-referrals/analytics/:postId
 * Get comprehensive analytics for a post
 */
router.get('/analytics/:postId', auth, async (req, res) => {
  try {
    const { postId } = req.params;

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    // Get all chains
    const chains = await ComprehensiveReferralChainService.getChainsForPost(postId);

    // Aggregate analytics
    const analytics = {
      totalChains: chains.length,
      totalPeopleInChains: chains.reduce((sum, c) => sum + c.chainLength, 0),
      totalClicks: chains.reduce((sum, c) => sum + c.totalClicks, 0),
      totalViews: chains.reduce((sum, c) => sum + c.totalViews, 0),
      totalShares: chains.reduce((sum, c) => sum + c.totalShares, 0),
      conversions: chains.filter(c => c.converted).length,
      totalConversionValue: chains.reduce((sum, c) => sum + (c.conversionValue || 0), 0),
      longestChain: Math.max(...chains.map(c => c.chainLength), 0),
      mostActiveChain: chains.sort((a, b) => b.totalClicks - a.totalClicks)[0] || null,
      chains: chains.map(c => ({
        chainId: c.chainId,
        originalSharer: c.originalSharer,
        length: c.chainLength,
        clicks: c.totalClicks,
        views: c.totalViews,
        shares: c.totalShares,
        converted: c.converted,
        lastActivity: c.lastActivity
      }))
    };

    res.json({
      success: true,
      postId,
      analytics
    });
  } catch (error) {
    console.error('Error getting analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting analytics',
      error: error.message
    });
  }
});

module.exports = router;

