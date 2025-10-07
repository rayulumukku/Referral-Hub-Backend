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
      platform: platform || 'web',
      location: location || {
        city: 'Unknown',
        state: 'Unknown',
        country: 'Unknown',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      },
      device: device || 'desktop',
      browser: browser || 'Chrome',
      userAgent: userAgent || 'Mozilla/5.0',
      screenSize: screenSize || { width: 1920, height: 1080 },
      coordinates: coordinates || { latitude: 0, longitude: 0, accuracy: 0 },
      ipAddress: ipAddress || req.ip,
      networkInfo: networkInfo || { isp: 'Unknown', connectionType: 'unknown' },
      sessionId: sessionId || `session_${Date.now()}`,
      referrer: httpReferrer || 'Direct',
      language: language || 'en-US',
      distance: distance || 0,
      timeTaken: timeTaken || 0,
      chainPosition: chainPosition || 1,
      parentReferral: parentReferralId,
      level: 1
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
    const { postId } = req.body;

    // Find all referrals for this post
    const referrals = await Referral.find({ post: postId }).sort({ createdAt: 1 });

    if (referrals.length === 0) return res.status(400).json({ message: 'No referrals found' });

    // Updated commission distribution: First sharer 20%, Last person 30%
    const totalPoints = 1000; // points purchased for the post
    const platformFee = Math.floor(totalPoints * 0.1); // 10% platform fee
    const distributablePoints = totalPoints - platformFee; // 900 points to distribute

    console.log(`Distributing ${distributablePoints} points among ${referrals.length} referrals`);

    if (referrals.length === 0) {
      // No referrals - all points go to platform
      const platformCommission = new Commission({
        post: postId,
        recipient: null, // Platform
        amount: distributablePoints,
        percentage: 100,
        distributionType: 'platform_fee',
        level: 0,
      });
      await platformCommission.save();
    } else if (referrals.length === 1) {
      // Only one referral - they get 50% of distributable points
      const amount = Math.floor(distributablePoints * 0.5);
      const commission = new Commission({
        referral: referrals[0]._id,
        recipient: referrals[0].referrer,
        amount,
        percentage: 50,
        distributionType: 'single_referral',
        level: 0,
      });
      await commission.save();
      await User.findByIdAndUpdate(referrals[0].referrer, { $inc: { credits: amount } });
    } else {
      // Multiple referrals - First gets 20%, Last gets 30%, rest share equally
      const firstAmount = Math.floor(distributablePoints * 0.2); // 20%
      const lastAmount = Math.floor(distributablePoints * 0.3);  // 30%
      const remainingAmount = distributablePoints - firstAmount - lastAmount;
      const middleAmount = referrals.length > 2 ? Math.floor(remainingAmount / (referrals.length - 2)) : 0;

      // First referral gets 20%
      const firstCommission = new Commission({
        referral: referrals[0]._id,
        recipient: referrals[0].referrer,
        amount: firstAmount,
        percentage: 20,
        distributionType: 'first_sharer',
        level: 0,
      });
      await firstCommission.save();
      await User.findByIdAndUpdate(referrals[0].referrer, { $inc: { credits: firstAmount } });

      // Last referral gets 30%
      const lastIndex = referrals.length - 1;
      const lastCommission = new Commission({
        referral: referrals[lastIndex]._id,
        recipient: referrals[lastIndex].referrer,
        amount: lastAmount,
        percentage: 30,
        distributionType: 'last_person',
        level: lastIndex,
      });
      await lastCommission.save();
      await User.findByIdAndUpdate(referrals[lastIndex].referrer, { $inc: { credits: lastAmount } });

      // Middle referrals share equally (if more than 2 total)
      if (referrals.length > 2) {
        for (let i = 1; i < referrals.length - 1; i++) {
          const commission = new Commission({
            referral: referrals[i]._id,
            recipient: referrals[i].referrer,
            amount: middleAmount,
            percentage: Math.floor((middleAmount / distributablePoints) * 100),
            distributionType: 'middle_share',
            level: i,
          });
          await commission.save();
          await User.findByIdAndUpdate(referrals[i].referrer, { $inc: { credits: middleAmount } });
        }
      }
    }

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

module.exports = router;