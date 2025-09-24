const express = require('express');
const Referral = require('../models/Referral');
const Commission = require('../models/Commission');
const User = require('../models/User');
const auth = require('../middleware/auth');
const ActivityService = require('../services/activityService');

const router = express.Router();

// Track referral click
router.post('/track', async (req, res) => {
  try {
    const { postId, referrerId, platform, location, device, browser, screenSize } = req.body;

    const referral = new Referral({
      post: postId,
      referrer: referrerId,
      platform,
      location,
      device,
      browser,
      screenSize,
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
    const Post = require('../models/Post');
    await Post.findByIdAndUpdate(postId, { $inc: { reach: 1 } });

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
    }

    // Update post conversions
    const Post = require('../models/Post');
    await Post.findByIdAndUpdate(postId, { $inc: { conversions: 1 } });

    res.json({ message: 'Conversion recorded and multi-level commissions distributed' });
  } catch (error) {
    console.error('Conversion error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Track share action
router.post('/share', auth, async (req, res) => {
  try {
    const { postId, platform } = req.body;

    // Track referral shared activity
    await ActivityService.trackReferralShared(req.user.id, postId, platform, {
      platform,
      userAgent: req.headers['user-agent'],
      ip: req.ip
    });

    res.json({ message: 'Share tracked successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;