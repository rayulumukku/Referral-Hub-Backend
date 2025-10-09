const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const TreeCommissionService = require('../services/treeCommissionService');

// Add user to referral chain
router.post('/add-to-chain', auth, async (req, res) => {
  try {
    const { postId, referrerId, trackingData } = req.body;
    
    const chain = await TreeCommissionService.addToChain(
      postId, 
      referrerId, 
      req.user.id, 
      trackingData
    );

    res.json({
      success: true,
      chain,
      message: 'Successfully added to referral chain'
    });
  } catch (error) {
    console.error('Error adding to chain:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error adding to chain',
      error: error.message 
    });
  }
});

// Process product purchase
router.post('/process-purchase', auth, async (req, res) => {
  try {
    const { postId, purchaseData } = req.body;
    
    const commissions = await TreeCommissionService.processPurchase(
      postId, 
      req.user.id, 
      purchaseData
    );

    res.json({
      success: true,
      commissions,
      message: 'Purchase processed and commissions distributed'
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

// Get chain analytics for a post
router.get('/analytics/:postId', auth, async (req, res) => {
  try {
    const { postId } = req.params;
    
    const analytics = await TreeCommissionService.getChainAnalytics(postId);

    res.json({
      success: true,
      analytics
    });
  } catch (error) {
    console.error('Error getting chain analytics:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error getting chain analytics',
      error: error.message 
    });
  }
});

// Get user's commission summary
router.get('/commissions/summary', auth, async (req, res) => {
  try {
    const { commissions, summary } = await TreeCommissionService.getUserCommissionSummary(req.user.id);

    res.json({
      success: true,
      commissions,
      summary
    });
  } catch (error) {
    console.error('Error getting commission summary:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error getting commission summary',
      error: error.message 
    });
  }
});

// Track referral click
router.post('/track-click', auth, async (req, res) => {
  try {
    const { postId, referrerId, trackingData } = req.body;
    
    // Find or create chain
    let chain = await require('../models/ReferralChain').findOne({
      post: postId,
      chainHead: referrerId
    });

    if (chain) {
      // Update click count for the user
      const member = chain.chainMembers.find(
        m => m.user.toString() === req.user.id.toString()
      );
      
      if (member) {
        member.clickCount += 1;
        member.engagementScore += 1;
        chain.totalClicks += 1;
        
        // Update analytics
        await TreeCommissionService.updateChainAnalytics(chain);
        await chain.save();
      }
    }

    res.json({
      success: true,
      message: 'Click tracked successfully'
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

// Track referral share
router.post('/track-share', auth, async (req, res) => {
  try {
    const { postId, referrerId, trackingData } = req.body;
    
    // Find or create chain
    let chain = await require('../models/ReferralChain').findOne({
      post: postId,
      chainHead: referrerId
    });

    if (chain) {
      // Update share count for the user
      const member = chain.chainMembers.find(
        m => m.user.toString() === req.user.id.toString()
      );
      
      if (member) {
        member.shareCount += 1;
        member.engagementScore += 2;
        chain.totalShares += 1;
        
        // Update analytics
        await TreeCommissionService.updateChainAnalytics(chain);
        await chain.save();
      }
    }

    res.json({
      success: true,
      message: 'Share tracked successfully'
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

// Get comprehensive journey map for a post
router.get('/journey-map/:postId', auth, async (req, res) => {
  try {
    const { postId } = req.params;
    
    const chains = await require('../models/ReferralChain').find({ post: postId })
      .populate('chainMembers.user', 'username email')
      .populate('originalCreator', 'username email')
      .populate('chainHead', 'username email')
      .sort({ createdAt: -1 });

    const journeyMap = {
      postId,
      totalChains: chains.length,
      totalMembers: chains.reduce((sum, chain) => sum + chain.chainMembers.length, 0),
      totalClicks: chains.reduce((sum, chain) => sum + chain.totalClicks, 0),
      totalShares: chains.reduce((sum, chain) => sum + chain.totalShares, 0),
      conversionRate: chains.length > 0 ? 
        chains.filter(c => c.status === 'converted').length / chains.length : 0,
      chains: chains.map(chain => ({
        chainId: chain.chainId,
        originalCreator: chain.originalCreator,
        chainHead: chain.chainHead,
        members: chain.chainMembers.map(member => ({
          user: member.user,
          position: member.position,
          platform: member.platform,
          device: member.device,
          browser: member.browser,
          location: member.location,
          clickCount: member.clickCount,
          shareCount: member.shareCount,
          engagementScore: member.engagementScore,
          joinedAt: member.joinedAt
        })),
        totalClicks: chain.totalClicks,
        totalShares: chain.totalShares,
        conversionOccurred: chain.conversionOccurred,
        conversionDate: chain.conversionDate,
        status: chain.status,
        createdAt: chain.createdAt,
        updatedAt: chain.updatedAt
      })),
      analytics: await TreeCommissionService.getChainAnalytics(postId)
    };

    res.json({
      success: true,
      journeyMap
    });
  } catch (error) {
    console.error('Error getting journey map:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error getting journey map',
      error: error.message 
    });
  }
});

// Get real-time analytics
router.get('/realtime/:postId', auth, async (req, res) => {
  try {
    const { postId } = req.params;
    
    const analytics = await TreeCommissionService.getChainAnalytics(postId);
    
    // Add real-time metrics
    const realTimeMetrics = {
      activeUsers: analytics.totalMembers,
      liveEvents: analytics.totalClicks + analytics.totalShares,
      conversions: analytics.convertedChains,
      revenue: analytics.convertedChains * 100, // Assuming $100 per conversion
      lastUpdated: new Date()
    };

    res.json({
      success: true,
      analytics: {
        ...analytics,
        realTime: realTimeMetrics
      }
    });
  } catch (error) {
    console.error('Error getting real-time analytics:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error getting real-time analytics',
      error: error.message 
    });
  }
});

module.exports = router;
