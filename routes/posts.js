const express = require('express');
const Post = require('../models/Post');
const User = require('../models/User');
const auth = require('../middleware/auth');
const ActivityService = require('../services/activityService');

const router = express.Router();

// Create post
router.post('/', auth, async (req, res) => {
  try {
    const {
      title,
      description,
      category,
      price,
      // Metadata from frontend
      platform = 'web',
      device = 'desktop',
      browser,
      userAgent,
      screenSize,
      coordinates,
      location
    } = req.body;

    const user = await User.findById(req.user.id);

    // Check if user has credits (each credit = 1 post)
    if (user.credits < 1) {
      return res.status(400).json({ message: 'Insufficient credits. Each post requires 1 credit.' });
    }

    // Deduct 1 credit for post creation
    user.credits -= 1;
    await user.save();

    // Generate referral link
    const referralLink = `https://referralhub.com/post/${Date.now()}`;

    // Detect device type from user agent if not provided
    let detectedDevice = device;
    if (!device && userAgent) {
      if (/mobile/i.test(userAgent)) {
        detectedDevice = 'mobile';
      } else if (/tablet/i.test(userAgent)) {
        detectedDevice = 'tablet';
      } else {
        detectedDevice = 'desktop';
      }
    }

    // Get client IP
    const ipAddress = req.ip || req.connection.remoteAddress ||
                      req.socket.remoteAddress ||
                      (req.connection.socket ? req.connection.socket.remoteAddress : null);

    const post = new Post({
      creator: req.user.id,
      title,
      description,
      category,
      price,
      referralLink,
      creditsCost: 1000, // Points to be distributed on sale
      location: location || {},
      creationMetadata: {
        platform: platform,
        device: detectedDevice,
        browser: browser || req.headers['user-agent']?.split(' ')[0] || 'Unknown',
        userAgent: userAgent || req.headers['user-agent'] || 'Unknown',
        screenSize: screenSize || {},
        ipAddress: ipAddress,
        coordinates: coordinates || {},
        timezone: req.headers['timezone'] || Intl.DateTimeFormat().resolvedOptions().timeZone,
        language: req.headers['accept-language']?.split(',')[0] || 'en-US',
        referrer: req.headers['referer'] || req.headers['referrer'] || 'Direct',
        sessionId: req.sessionID || `session_${Date.now()}`
      }
    });

    await post.save();

    // Track post creation activity with detailed metadata
    await ActivityService.trackPostCreation(req.user.id, post._id, title, {
      platform: platform,
      device: detectedDevice,
      location: location,
      coordinates: coordinates,
      ipAddress: ipAddress,
      userAgent: userAgent || req.headers['user-agent']
    });

    res.status(201).json(post);
  } catch (error) {
    console.error('Post creation error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all posts
router.get('/', async (req, res) => {
  try {
    const posts = await Post.find({ status: 'active' }).populate('creator', 'username email type');
    // Include creationMetadata in response for admin access
    res.json(posts);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Debug: Get all posts (including inactive) - for admin debugging
router.get('/debug', async (req, res) => {
  try {
    const allPosts = await Post.find({}).populate('creator', 'username email type role');
    const activePosts = await Post.find({ status: 'active' }).populate('creator', 'username email type role');
    const inactivePosts = await Post.find({ status: 'inactive' }).populate('creator', 'username email type role');

    res.json({
      total: allPosts.length,
      active: activePosts.length,
      inactive: inactivePosts.length,
      allPosts: allPosts.map(p => ({
        id: p._id,
        title: p.title,
        creator: p.creator?.username,
        creatorRole: p.creator?.role,
        status: p.status,
        createdAt: p.createdAt
      }))
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user's posts
router.get('/my', auth, async (req, res) => {
  try {
    const posts = await Post.find({ creator: req.user.id });
    res.json(posts);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;