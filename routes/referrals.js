const express = require('express');
const Referral = require('../models/Referral');
const Commission = require('../models/Commission');
const User = require('../models/User');
const auth = require('../middleware/auth');
const ActivityService = require('../services/activityService');

const router = express.Router();

// Get io instance from server.js
let io;
const setIoInstance = (ioInstance) => {
  io = ioInstance;
};

module.exports.setIoInstance = setIoInstance;

// Track referral click (public endpoint)
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
      parentReferralId // Link to parent referral in chain
    } = req.body;

    // Get post to calculate distance and time
    const Post = require('../models/Post');
    const post = await Post.findById(postId);

    let distance = 0;
    let timeTaken = 0;

    if (post) {
      // Calculate distance from post creation location
      if (post.location && coordinates) {
        const R = 6371; // Earth's radius in km
        const dLat = (coordinates.latitude - post.location.latitude) * Math.PI / 180;
        const dLon = (coordinates.longitude - post.location.longitude) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(post.location.latitude * Math.PI / 180) * Math.cos(coordinates.latitude * Math.PI / 180) *
          Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        distance = R * c;
      }

      // Calculate time taken from post creation
      timeTaken = (Date.now() - post.createdAt.getTime()) / (1000 * 60); // in minutes
    }

    // Find chain position
    let chainPosition = 1;
    if (parentReferralId) {
      const parentReferral = await Referral.findById(parentReferralId);
      if (parentReferral) {
        chainPosition = parentReferral.chainPosition + 1;
      }
    }

    const referral = new Referral({
      post: postId,
      referrer: referrerId || null, // Allow null for anonymous referrals
      referee: refereeId,
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
      distance,
      timeTaken,
      chainPosition,
      parentReferral: parentReferralId,
    });

    await referral.save();

    // Track referral click activity
    await ActivityService.trackReferralClick(referrerId, postId, platform, {
      platform,
      device,
      location,
      userAgent: browser,
      ip: req.ip
    });

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
    const { postId } = req.body;

    // Find all referrals for this post
    const referrals = await Referral.find({ post: postId }).sort({ createdAt: 1 });

    if (referrals.length === 0) return res.status(400).json({ message: 'No referrals found' });

    // Multi-level commission distribution based on referral levels
    const totalPoints = 1000; // points purchased for the post
    const commissionRates = {
      0: 0.40, // Level 0 (Original): 40%
      1: 0.25, // Level 1: 25%
      2: 0.15, // Level 2: 15%
      3: 0.10, // Level 3: 10%
      4: 0.05  // Level 4+: 5%
    };

    console.log(`Distributing ${totalPoints} points among ${referrals.length} referrals using multi-level system`);

    // Award commissions based on levels
    for (let i = 0; i < referrals.length; i++) {
      const level = Math.min(i, 4); // Cap at level 4 for 5% rate
      const rate = commissionRates[level];
      const amount = totalPoints * rate;

      console.log(`Referral ${i + 1} (Level ${level}): ${amount} points (${rate * 100}%)`);

      const commission = new Commission({
        referral: referrals[i]._id,
        recipient: referrals[i].referrer,
        amount,
        percentage: rate * 100,
        level: level,
      });

      await commission.save();

      // Track commission earned activity
      await ActivityService.trackCommissionEarned(referrals[i].referrer, amount, referrals[i]._id, level);

      // Update user credits (points become credits)
      await User.findByIdAndUpdate(referrals[i].referrer, { $inc: { credits: amount } });

      // Emit real-time commission update
      if (io) {
        io.to(`user_${referrals[i].referrer}`).emit('commission_update', {
          type: 'new_commission',
          commission: {
            _id: commission._id,
            amount,
            level: level,
            post: postId,
            timestamp: new Date()
          }
        });

        io.to(`user_${referrals[i].referrer}`).emit('credits_update', {
          newCredits: (await User.findById(referrals[i].referrer)).credits
        });

        // Emit user analytics update for commission earned
        io.to(`user_${referrals[i].referrer}`).emit('user_analytics_update', {
          type: 'commission_earned',
          userId: referrals[i].referrer,
          amount,
          level,
          postId,
          timestamp: new Date()
        });
      }
    }

    // Update post conversions
    const Post = require('../models/Post');
    await Post.findByIdAndUpdate(postId, { $inc: { conversions: 1 } });

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

    res.json({ message: 'Conversion recorded and multi-level commissions distributed' });
  } catch (error) {
    console.error('Conversion error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Track share action (public endpoint)
router.post('/share', async (req, res) => {
  try {
    const { postId, platform } = req.body;
    const token = req.headers.authorization?.replace('Bearer ', '');
    let userId = null;

    // Try to get user from token if available
    if (token) {
      try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded.id;
      } catch (err) {
        // Token invalid, continue with anonymous tracking
      }
    }

    // Track referral shared activity if user is logged in
    if (userId) {
      await ActivityService.trackReferralShared(userId, postId, platform, {
        platform,
        userAgent: req.headers['user-agent'],
        ip: req.ip
      });
    }

    res.json({ message: 'Share tracked successfully' });
  } catch (error) {
    console.error('Share tracking error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;