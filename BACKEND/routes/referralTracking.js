const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const referralTrackingService = require('../services/referralTrackingService');

/**
 * @route   POST /api/referral-tracking/track
 * @desc    Track a referral click and create chain node
 * @access  Public
 */
router.post('/track', async (req, res) => {
  try {
    const {
      postId,
      userId,
      referrerId,
      parentChainId,
      platform,
      deviceInfo,
      location,
      clickData,
      engagement,
      metadata
    } = req.body;

    if (!postId) {
      return res.status(400).json({
        success: false,
        message: 'Post ID is required'
      });
    }

    const chainNode = await referralTrackingService.trackReferralClick({
      postId,
      userId,
      referrerId,
      parentChainId,
      platform,
      deviceInfo,
      location,
      clickData,
      engagement,
      metadata
    });

    res.status(201).json({
      success: true,
      chainNode
    });
  } catch (error) {
    console.error('Error tracking referral:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route   GET /api/referral-tracking/tree/:postId
 * @desc    Get referral tree structure for a post
 * @access  Public
 */
router.get('/tree/:postId', async (req, res) => {
  try {
    const { postId } = req.params;

    const tree = await referralTrackingService.getReferralTree(postId);

    res.json({
      success: true,
      tree
    });
  } catch (error) {
    console.error('Error getting referral tree:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route   GET /api/referral-tracking/hub-and-spoke/:postId
 * @desc    Get hub-and-spoke visualization data
 * @access  Public
 */
router.get('/hub-and-spoke/:postId', async (req, res) => {
  try {
    const { postId } = req.params;

    const data = await referralTrackingService.getHubAndSpokeData(postId);

    res.json({
      success: true,
      ...data
    });
  } catch (error) {
    console.error('Error getting hub-and-spoke data:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route   GET /api/referral-tracking/analytics/:postId
 * @desc    Get analytics for a post
 * @access  Public
 */
router.get('/analytics/:postId', async (req, res) => {
  try {
    const { postId } = req.params;
    const { timeRange, platform, deviceType, browser } = req.query;

    const filters = {};
    if (platform) filters.platform = platform;
    if (deviceType) filters.deviceType = deviceType;
    if (browser) filters.browser = browser;

    const analytics = await referralTrackingService.getAnalytics(
      postId,
      timeRange,
      filters
    );

    res.json({
      success: true,
      analytics
    });
  } catch (error) {
    console.error('Error getting analytics:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route   GET /api/referral-tracking/top-referrers/:postId
 * @desc    Get top referrers for a post
 * @access  Public
 */
router.get('/top-referrers/:postId', async (req, res) => {
  try {
    const { postId } = req.params;
    const { limit = 10 } = req.query;

    const topReferrers = await referralTrackingService.getTopReferrers(
      postId,
      parseInt(limit)
    );

    res.json({
      success: true,
      topReferrers
    });
  } catch (error) {
    console.error('Error getting top referrers:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route   GET /api/referral-tracking/commission-preview/:postId
 * @desc    Get commission preview for all nodes
 * @access  Private
 */
router.get('/commission-preview/:postId', auth, async (req, res) => {
  try {
    const { postId } = req.params;

    const commissionPreview = await referralTrackingService.calculateCommissionPreview(postId);

    res.json({
      success: true,
      commissionPreview
    });
  } catch (error) {
    console.error('Error getting commission preview:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route   GET /api/referral-tracking/export/:postId
 * @desc    Export referral data (JSON/CSV)
 * @access  Private
 */
router.get('/export/:postId', auth, async (req, res) => {
  try {
    const { postId } = req.params;
    const { format = 'json' } = req.query;

    const exportData = await referralTrackingService.exportReferralData(postId, format);

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=referral-data-${postId}.csv`);
      res.send(exportData.data);
    } else {
      res.json({
        success: true,
        ...exportData
      });
    }
  } catch (error) {
    console.error('Error exporting data:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
