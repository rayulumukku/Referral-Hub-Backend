const express = require('express');
const router = express.Router();
const Post = require('../models/Post');
const ReferralChain = require('../models/ReferralChain');
const auth = require('../middleware/auth');

// Get comprehensive analytics for a specific post
router.get('/post/:postId', auth, async (req, res) => {
  try {
    const { postId } = req.params;
    
    const post = await Post.findById(postId)
      .populate('creator', 'username email')
      .lean();
    
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    // Check if user is post creator or admin
    if (post.creator._id.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Get referral chains for this post
    const chains = await ReferralChain.find({ post: postId })
      .populate('chain.userId', 'username email')
      .lean();

    // Calculate detailed breakdowns from viewHistory
    const deviceBreakdown = {};
    const browserBreakdown = {};
    const osBreakdown = {};
    const locationBreakdown = {};
    const networkBreakdown = {};
    const platformBreakdown = {};
    const timeDistribution = {};

    // Process viewHistory
    if (post.analytics?.viewHistory) {
      post.analytics.viewHistory.forEach(view => {
        // Device breakdown
        const device = view.device || 'Unknown';
        deviceBreakdown[device] = (deviceBreakdown[device] || 0) + 1;

        // Browser breakdown
        const browser = view.browser || 'Unknown';
        browserBreakdown[browser] = (browserBreakdown[browser] || 0) + 1;

        // OS breakdown
        const os = view.os || 'Unknown';
        osBreakdown[os] = (osBreakdown[os] || 0) + 1;

        // Location breakdown
        if (view.location?.city) {
          const location = `${view.location.city}, ${view.location.country || ''}`;
          locationBreakdown[location] = (locationBreakdown[location] || 0) + 1;
        }

        // Network breakdown
        if (view.networkInfo?.connectionType) {
          const network = view.networkInfo.connectionType;
          networkBreakdown[network] = (networkBreakdown[network] || 0) + 1;
        }

        // Time distribution (by hour)
        if (view.timestamp) {
          const hour = new Date(view.timestamp).getHours();
          timeDistribution[hour] = (timeDistribution[hour] || 0) + 1;
        }
      });
    }

    // Process shareHistory
    if (post.analytics?.shareHistory) {
      post.analytics.shareHistory.forEach(share => {
        const platform = share.platform || 'Unknown';
        platformBreakdown[platform] = (platformBreakdown[platform] || 0) + 1;
      });
    }

    // Calculate unique viewers
    const uniqueViewers = post.analytics?.uniqueViewers?.length || 0;
    const totalViews = post.analytics?.views || 0;

    // Calculate average engagement metrics
    let totalTimeSpent = 0;
    let totalScrollDepth = 0;
    let timeTrackedViews = 0;

    if (post.analytics?.viewHistory) {
      post.analytics.viewHistory.forEach(view => {
        // Calculate from timeTracking if available
        const timeEntry = post.analytics.timeTracking?.find(
          t => t.userId?.toString() === view.userId?.toString() && 
               Math.abs(new Date(t.timestamp) - new Date(view.timestamp)) < 60000
        );
        if (timeEntry && timeEntry.timeSpent) {
          totalTimeSpent += timeEntry.timeSpent;
          timeTrackedViews++;
        }

        // Calculate from scrollTracking
        const scrollEntry = post.analytics.scrollTracking?.find(
          s => s.userId?.toString() === view.userId?.toString() &&
               Math.abs(new Date(s.timestamp) - new Date(view.timestamp)) < 60000
        );
        if (scrollEntry && scrollEntry.scrollDepth) {
          totalScrollDepth += scrollEntry.scrollDepth;
        }
      });
    }

    const avgTimeSpent = timeTrackedViews > 0 ? totalTimeSpent / timeTrackedViews : 0;
    const avgScrollDepth = totalViews > 0 ? totalScrollDepth / totalViews : 0;

    // Format response
    const analytics = {
      post: {
        _id: post._id,
        title: post.title,
        description: post.description,
        category: post.category,
        price: post.price,
        creator: post.creator,
        createdAt: post.createdAt
      },
      basicStats: {
        totalViews,
        uniqueViewers,
        totalShares: post.analytics?.shares || 0,
        totalClicks: post.analytics?.clicks || 0,
        conversions: post.analytics?.conversions || 0,
        avgTimeSpent: Math.round(avgTimeSpent),
        avgScrollDepth: Math.round(avgScrollDepth)
      },
      viewHistory: post.analytics?.viewHistory || [],
      shareHistory: post.analytics?.shareHistory || [],
      breakdowns: {
        device: Object.entries(deviceBreakdown).map(([name, count]) => ({
          name,
          count,
          percentage: Math.round((count / totalViews) * 100)
        })).sort((a, b) => b.count - a.count),
        browser: Object.entries(browserBreakdown).map(([name, count]) => ({
          name,
          count,
          percentage: Math.round((count / totalViews) * 100)
        })).sort((a, b) => b.count - a.count),
        os: Object.entries(osBreakdown).map(([name, count]) => ({
          name,
          count,
          percentage: Math.round((count / totalViews) * 100)
        })).sort((a, b) => b.count - a.count),
        location: Object.entries(locationBreakdown).map(([name, count]) => ({
          name,
          count,
          percentage: Math.round((count / totalViews) * 100)
        })).sort((a, b) => b.count - a.count),
        network: Object.entries(networkBreakdown).map(([name, count]) => ({
          name,
          count,
          percentage: Math.round((count / totalViews) * 100)
        })).sort((a, b) => b.count - a.count),
        platform: Object.entries(platformBreakdown).map(([name, count]) => ({
          name,
          count,
          percentage: Math.round((count / (post.analytics?.shares || 1)) * 100)
        })).sort((a, b) => b.count - a.count),
        timeDistribution: Object.entries(timeDistribution).map(([hour, count]) => ({
          hour: parseInt(hour),
          count
        })).sort((a, b) => a.hour - b.hour)
      },
      chains,
      engagement: {
        likes: post.analytics?.engagement?.likes || 0,
        comments: post.analytics?.engagement?.comments || 0,
        bookmarks: post.analytics?.engagement?.bookmarks || 0
      }
    };

    res.json({
      success: true,
      analytics
    });
  } catch (error) {
    console.error('Error fetching post analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Get unique viewers list
router.get('/post/:postId/unique-viewers', auth, async (req, res) => {
  try {
    const { postId } = req.params;
    
    const post = await Post.findById(postId)
      .populate('analytics.uniqueViewers', 'username email profile')
      .lean();
    
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    res.json({
      success: true,
      uniqueViewers: post.analytics?.uniqueViewers || [],
      count: post.analytics?.uniqueViewers?.length || 0
    });
  } catch (error) {
    console.error('Error fetching unique viewers:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;

