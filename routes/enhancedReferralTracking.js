const express = require('express');
const router = express.Router();
const Referral = require('../models/Referral');
const Post = require('../models/Post');
const User = require('../models/User');
const Activity = require('../models/Activity');
const Notification = require('../models/Notification');

// Enhanced referral tracking that ensures EVERY person who receives a post is tracked
router.post('/track-share', async (req, res) => {
  try {
    const {
      postId,
      fromUserId, // Person who shared
      toUserId, // Person who received (if they have account)
      toEmail, // Email of person who received
      platform, // WhatsApp, LinkedIn, etc.
      device,
      browser,
      coordinates,
      location
    } = req.body;

    console.log('Enhanced referral tracking:', { postId, fromUserId, toUserId, toEmail, platform });

    // Get post and referrer details
    const post = await Post.findById(postId).populate('creator');
    const fromUser = await User.findById(fromUserId);
    
    if (!post || !fromUser) {
      return res.status(404).json({ message: 'Post or user not found' });
    }

    // Find or create the recipient user
    let toUser = null;
    if (toUserId) {
      toUser = await User.findById(toUserId);
    } else if (toEmail) {
      toUser = await User.findOne({ email: toEmail.toLowerCase() });
    }

    // Create referral record for the share
    const referral = new Referral({
      post: postId,
      referrer: fromUserId,
      referee: toUser?._id || null,
      level: 1, // Direct referral
      platform: platform || 'web',
      device: device || 'desktop',
      browser: browser || 'unknown',
      location: {
        latitude: coordinates?.latitude,
        longitude: coordinates?.longitude,
        city: location?.city,
        state: location?.state,
        country: location?.country,
        timezone: location?.timezone
      },
      coordinates,
      chainPosition: 1,
      journey: {
        from: {
          userId: fromUserId,
          username: fromUser.username,
          location: fromUser.location || 'Unknown'
        },
        to: {
          userId: toUser?._id || null,
          email: toEmail,
          location: location || 'Unknown'
        },
        platform: platform,
        timestamp: new Date()
      },
      engagement: {
        totalClicks: 0,
        uniqueClicks: 0,
        shares: 1,
        interactions: [{
          type: 'share',
          timestamp: new Date(),
          platform: platform
        }]
      },
      status: 'shared'
    });

    await referral.save();

    // Update post analytics
    await Post.findByIdAndUpdate(postId, {
      $inc: {
        'analytics.shares': 1,
        'analytics.totalShares': 1
      }
    });

    // Create activity record
    const activity = new Activity({
      user: fromUserId,
      type: 'referral_shared',
      description: `Shared post "${post.title}" to ${toEmail || 'new user'} via ${platform}`,
      metadata: {
        postId,
        platform,
        recipientEmail: toEmail,
        recipientUserId: toUser?._id
      }
    });
    await activity.save();

    // Create notification for post creator
    const notification = new Notification({
      user: post.creator._id,
      type: 'referral_shared',
      title: 'Post Shared!',
      message: `${fromUser.username} shared your post "${post.title}" via ${platform}`,
      metadata: {
        postId,
        referrerId: fromUserId,
        platform
      }
    });
    await notification.save();

    // Emit real-time updates
    const io = require('../server').getIo();
    if (io) {
      // Emit to post creator
      io.to(`user_${post.creator._id}`).emit('referral_update', {
        type: 'post_shared',
        postId,
        referrer: fromUser.username,
        platform,
        timestamp: new Date()
      });

      // Emit to referrer
      io.to(`user_${fromUserId}`).emit('referral_update', {
        type: 'share_tracked',
        postId,
        platform,
        timestamp: new Date()
      });

      // Emit global analytics update
      io.emit('global_analytics_update', {
        type: 'new_share',
        postId,
        timestamp: new Date()
      });
    }

    res.json({
      success: true,
      referralId: referral._id,
      message: 'Share tracked successfully'
    });

  } catch (error) {
    console.error('Error tracking share:', error);
    res.status(500).json({ message: 'Error tracking share' });
  }
});

// Track when someone clicks a referral link
router.post('/track-click', async (req, res) => {
  try {
    const {
      postId,
      referrerId,
      platform,
      device,
      browser,
      coordinates,
      location,
      userAgent,
      screenSize,
      ipAddress
    } = req.body;

    console.log('Tracking referral click:', { postId, referrerId, platform });

    // Get post and referrer details
    const post = await Post.findById(postId).populate('creator');
    const referrer = await User.findById(referrerId);
    
    if (!post || !referrer) {
      return res.status(404).json({ message: 'Post or referrer not found' });
    }

    // Find existing referral record or create new one
    let referral = await Referral.findOne({
      post: postId,
      referrer: referrerId,
      status: 'shared'
    });

    if (referral) {
      // Update existing referral with click data
      referral.engagement.totalClicks += 1;
      referral.engagement.uniqueClicks += 1;
      referral.engagement.interactions.push({
        type: 'click',
        timestamp: new Date(),
        platform: platform
      });
      referral.status = 'clicked';
      await referral.save();
    } else {
      // Create new referral record for the click
      referral = new Referral({
        post: postId,
        referrer: referrerId,
        level: 1,
        platform: platform || 'web',
        device: device || 'desktop',
        browser: browser || 'unknown',
        userAgent: userAgent,
        screenSize: screenSize,
        ipAddress: ipAddress,
        location: {
          latitude: coordinates?.latitude,
          longitude: coordinates?.longitude,
          city: location?.city,
          state: location?.state,
          country: location?.country,
          timezone: location?.timezone
        },
        coordinates,
        chainPosition: 1,
        engagement: {
          totalClicks: 1,
          uniqueClicks: 1,
          shares: 0,
          interactions: [{
            type: 'click',
            timestamp: new Date(),
            platform: platform
          }]
        },
        status: 'clicked'
      });
      await referral.save();
    }

    // Update post analytics
    await Post.findByIdAndUpdate(postId, {
      $inc: {
        'analytics.clicks': 1,
        'analytics.totalClicks': 1
      }
    });

    // Create activity record
    const activity = new Activity({
      user: referrerId,
      type: 'referral_clicked',
      description: `Someone clicked your referral link for post "${post.title}" via ${platform}`,
      metadata: {
        postId,
        platform
      }
    });
    await activity.save();

    // Emit real-time updates
    const io = require('../server').getIo();
    if (io) {
      // Emit to post creator
      io.to(`user_${post.creator._id}`).emit('referral_update', {
        type: 'referral_clicked',
        postId,
        referrer: referrer.username,
        platform,
        timestamp: new Date()
      });

      // Emit to referrer
      io.to(`user_${referrerId}`).emit('referral_update', {
        type: 'click_tracked',
        postId,
        platform,
        timestamp: new Date()
      });

      // Emit global analytics update
      io.emit('global_analytics_update', {
        type: 'new_click',
        postId,
        timestamp: new Date()
      });
    }

    res.json({
      success: true,
      referralId: referral._id,
      message: 'Click tracked successfully'
    });

  } catch (error) {
    console.error('Error tracking click:', error);
    res.status(500).json({ message: 'Error tracking click' });
  }
});

// Get comprehensive referral analytics for a post
router.get('/analytics/:postId', async (req, res) => {
  try {
    const { postId } = req.params;
    
    const referrals = await Referral.find({ post: postId })
      .populate('referrer', 'username email')
      .populate('referee', 'username email')
      .sort({ createdAt: -1 });

    const analytics = {
      totalReferrals: referrals.length,
      totalShares: referrals.filter(r => r.status === 'shared').length,
      totalClicks: referrals.filter(r => r.status === 'clicked').length,
      platformStats: referrals.reduce((acc, ref) => {
        const platform = ref.platform || 'unknown';
        acc[platform] = (acc[platform] || 0) + 1;
        return acc;
      }, {}),
      deviceStats: referrals.reduce((acc, ref) => {
        const device = ref.device || 'unknown';
        acc[device] = (acc[device] || 0) + 1;
        return acc;
      }, {}),
      locationStats: referrals.reduce((acc, ref) => {
        const country = ref.location?.country || 'Unknown';
        acc[country] = (acc[country] || 0) + 1;
        return acc;
      }, {}),
      referrals: referrals.slice(0, 50) // Limit to 50 most recent
    };

    res.json(analytics);
  } catch (error) {
    console.error('Error fetching referral analytics:', error);
    res.status(500).json({ message: 'Error fetching analytics' });
  }
});

module.exports = router;
