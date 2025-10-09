const express = require('express');
const ComprehensiveReferralTrackingService = require('../services/comprehensiveReferralTrackingService');
const EnhancedCommissionService = require('../services/enhancedCommissionService');
const auth = require('../middleware/auth');

const router = express.Router();

// Get io instance from server.js
let io;
const setIoInstance = (ioInstance) => {
  io = ioInstance;
};

// Attach setIoInstance to router
router.setIoInstance = setIoInstance;

/**
 * Track referral click with comprehensive analytics
 * POST /api/enhanced-referrals/track
 */
router.post('/track', async (req, res) => {
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
      interactionType,
      duration,
      scrollDepth
    } = req.body;

    console.log('Enhanced referral tracking request:', { postId, referrerId, platform });

    const result = await ComprehensiveReferralTrackingService.trackReferralClick({
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
      interactionType,
      duration,
      scrollDepth
    });

    // Emit real-time updates
    if (io) {
      io.emit('enhanced_referral_update', {
        type: 'new_referral_click',
        postId,
        chainId: result.chain.chainId,
        referrerId,
        platform,
        device,
        location: toLocation,
        timestamp: new Date()
      });

      // Emit to post creator
      const Post = require('../models/Post');
      const post = await Post.findById(postId).populate('creator');
      if (post && post.creator) {
        io.to(`user_${post.creator._id}`).emit('post_analytics_update', {
          postId,
          type: 'enhanced_referral_click',
          chainId: result.chain.chainId,
          timestamp: new Date()
        });
      }
    }

    res.status(201).json({
      success: true,
      referral: result.referral,
      chain: {
        chainId: result.chain.chainId,
        length: result.chain.chain.length,
        userPosition: result.chainMember.position
      }
    });

  } catch (error) {
    console.error('Enhanced referral tracking error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Enhanced referral tracking failed',
      error: error.message 
    });
  }
});

/**
 * Track share action
 * POST /api/enhanced-referrals/share
 */
router.post('/share', async (req, res) => {
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
    } = req.body;

    const result = await ComprehensiveReferralTrackingService.trackShare({
      postId,
      referrerId,
      platform,
      device,
      browser,
      coordinates,
      parentReferralId,
      toLocation
    });

    // Emit real-time updates
    if (io) {
      io.emit('enhanced_referral_update', {
        type: 'referral_share',
        postId,
        referrerId,
        platform,
        device,
        location: toLocation,
        timestamp: new Date()
      });
    }

    res.json({
      success: true,
      message: 'Share tracked successfully',
      shares: result.shares
    });

  } catch (error) {
    console.error('Share tracking error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Share tracking failed',
      error: error.message 
    });
  }
});

/**
 * Track user interaction
 * POST /api/enhanced-referrals/interaction
 */
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

    const result = await ComprehensiveReferralTrackingService.trackInteraction({
      postId,
      referrerId,
      interactionType,
      duration,
      scrollDepth,
      parentReferralId
    });

    res.json({
      success: true,
      message: 'Interaction tracked successfully'
    });

  } catch (error) {
    console.error('Interaction tracking error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Interaction tracking failed',
      error: error.message 
    });
  }
});

/**
 * Get comprehensive analytics for a post
 * GET /api/enhanced-referrals/analytics/:postId
 */
router.get('/analytics/:postId', async (req, res) => {
  try {
    const { postId } = req.params;
    
    const analytics = await ComprehensiveReferralTrackingService.getPostAnalytics(postId);
    
    res.json({
      success: true,
      analytics
    });

  } catch (error) {
    console.error('Analytics retrieval error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Analytics retrieval failed',
      error: error.message 
    });
  }
});

/**
 * Get user's referral chain history
 * GET /api/enhanced-referrals/user-chains/:userId
 */
router.get('/user-chains/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const chains = await ComprehensiveReferralTrackingService.getUserReferralChains(userId);
    
    res.json({
      success: true,
      chains
    });

  } catch (error) {
    console.error('User chains retrieval error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'User chains retrieval failed',
      error: error.message 
    });
  }
});

/**
 * Distribute commissions using enhanced system
 * POST /api/enhanced-referrals/distribute-commissions
 */
router.post('/distribute-commissions', auth, async (req, res) => {
  try {
    const { postId, buyerUserId, soldPrice, soldAt } = req.body;

    if (!postId || !soldPrice) {
      return res.status(400).json({
        success: false,
        message: 'Post ID and sold price are required'
      });
    }

    const result = await EnhancedCommissionService.distributeCommissions(
      postId,
      buyerUserId || req.user.id,
      soldPrice,
      soldAt || new Date()
    );

    // Emit real-time updates for commission distribution
    if (io) {
      io.emit('commission_distribution', {
        type: 'commissions_distributed',
        postId,
        totalDistributed: result.totalDistributed,
        chainsProcessed: result.chainsProcessed,
        timestamp: new Date()
      });
    }

    res.json({
      success: true,
      message: 'Commissions distributed successfully',
      result
    });

  } catch (error) {
    console.error('Commission distribution error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Commission distribution failed',
      error: error.message 
    });
  }
});

/**
 * Get commission analytics for a post
 * GET /api/enhanced-referrals/commission-analytics/:postId
 */
router.get('/commission-analytics/:postId', async (req, res) => {
  try {
    const { postId } = req.params;
    
    const analytics = await EnhancedCommissionService.getCommissionAnalytics(postId);
    
    res.json({
      success: true,
      analytics
    });

  } catch (error) {
    console.error('Commission analytics error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Commission analytics retrieval failed',
      error: error.message 
    });
  }
});

/**
 * Get user's commission history
 * GET /api/enhanced-referrals/user-commissions/:userId
 */
router.get('/user-commissions/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const history = await EnhancedCommissionService.getUserCommissionHistory(userId);
    
    res.json({
      success: true,
      history
    });

  } catch (error) {
    console.error('User commission history error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'User commission history retrieval failed',
      error: error.message 
    });
  }
});

/**
 * Get referral chain details
 * GET /api/enhanced-referrals/chain/:chainId
 */
router.get('/chain/:chainId', async (req, res) => {
  try {
    const { chainId } = req.params;
    
    const ReferralChain = require('../models/ReferralChain');
    const chain = await ReferralChain.findOne({ chainId })
      .populate('post', 'title category price')
      .populate('chain.userId', 'username email')
      .populate('originalSharer', 'username email');

    if (!chain) {
      return res.status(404).json({
        success: false,
        message: 'Referral chain not found'
      });
    }

    res.json({
      success: true,
      chain: {
        _id: chain._id,
        chainId: chain.chainId,
        post: chain.post,
        originalSharer: chain.originalSharer,
        chain: chain.chain.map(member => ({
          userId: member.userId,
          position: member.position,
          platform: member.platform,
          device: member.device,
          clicks: member.clicks,
          views: member.views,
          shares: member.shares,
          sharedAt: member.sharedAt,
          engagement: member.engagement
        })),
        totalClicks: chain.totalClicks,
        totalViews: chain.totalViews,
        totalShares: chain.totalShares,
        converted: chain.conversion.converted,
        createdAt: chain.createdAt,
        lastActivity: chain.lastActivity
      }
    });

  } catch (error) {
    console.error('Chain details error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Chain details retrieval failed',
      error: error.message 
    });
  }
});

/**
 * Get real-time analytics dashboard
 * GET /api/enhanced-referrals/dashboard
 */
router.get('/dashboard', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get user's referral chains
    const userChains = await ComprehensiveReferralTrackingService.getUserReferralChains(userId);
    
    // Get user's commission history
    const commissionHistory = await EnhancedCommissionService.getUserCommissionHistory(userId);
    
    // Get user's posts analytics
    const Post = require('../models/Post');
    const userPosts = await Post.find({ creator: userId });
    
    const postsAnalytics = await Promise.all(
      userPosts.map(async (post) => {
        const analytics = await ComprehensiveReferralTrackingService.getPostAnalytics(post._id);
        return {
          postId: post._id,
          title: post.title,
          analytics
        };
      })
    );

    res.json({
      success: true,
      dashboard: {
        userChains: userChains.slice(0, 10), // Latest 10 chains
        commissionHistory: commissionHistory.commissions.slice(0, 10), // Latest 10 commissions
        totalEarned: commissionHistory.totalEarned,
        postsAnalytics: postsAnalytics.slice(0, 5) // Latest 5 posts
      }
    });

  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Dashboard retrieval failed',
      error: error.message 
    });
  }
});

module.exports = router;