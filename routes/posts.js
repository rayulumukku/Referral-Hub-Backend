const express = require('express');
const Post = require('../models/Post');
const User = require('../models/User');
const auth = require('../middleware/auth');
const ActivityService = require('../services/activityService');
const CommissionService = require('../services/commissionService');
const QRCode = require('qrcode');

const router = express.Router();

// Get io instance from app
let io;
const setIoInstance = (ioInstance) => {
  io = ioInstance;
};

// Create post
router.post('/', auth, async (req, res) => {
  try {
    const {
      title,
      description,
      category,
      originalPrice,
      price,
      photos = [],
      pointsPool = 1000, // Default to 1000, can be 1000 or 2000
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

    // Check if user has credits (each post costs 1 credit)
    if (user.credits < 1) {
      return res.status(400).json({ message: 'Insufficient credits. Each post requires 1 credit.' });
    }

    // Validate points pool
    if (![1000, 2000].includes(pointsPool)) {
      return res.status(400).json({ message: 'Points pool must be either 1000 or 2000.' });
    }

    // Validate that at least 1 photo is provided
    if (!photos || photos.length === 0) {
      return res.status(400).json({ message: 'At least 1 photo is required to create a post.' });
    }

    // Deduct 1 credit for post creation
    user.credits -= 1;
    await user.save();

    // Calculate distribution amounts
    const distribution = CommissionService.calculateDistribution(pointsPool);

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
      originalPrice,
      price,
      photos: photos.slice(0, 4), // Limit to 4 photos
      pointsPool: distribution.pointsPool,
      platformFee: distribution.platformFee,
      distributablePoints: distribution.distributableAmount,
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

    // Generate referral link using the actual app URL and saved post ID
    const baseUrl = process.env.FRONTEND_URL || 'https://referral-hub-frontend.vercel.app';
    const referralLink = `${baseUrl}/post/${post._id}`;

    // Generate QR code for referral link
    const qrCode = await QRCode.toDataURL(referralLink);

    // Update post with referral link and QR code
    post.referralLink = referralLink;
    post.qrCode = qrCode;
    await post.save();

    // Emit real-time update to all connected clients
    if (io) {
      io.emit('postCreated', {
        post: post,
        creator: user.username || user.email
      });
    }

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
        description: p.description,
        category: p.category,
        originalPrice: p.originalPrice,
        price: p.price,
        photos: p.photos,
        referralLink: p.referralLink,
        qrCode: p.qrCode,
        creator: p.creator?.username,
        creatorEmail: p.creator?.email,
        creatorRole: p.creator?.role,
        status: p.status,
        reach: p.reach,
        conversions: p.conversions,
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

// Mark post as sold
router.put('/:id/sold', auth, async (req, res) => {
  try {
    const { buyerName, buyerEmail, buyerPhone, buyerAddress, soldPrice, buyerUserId } = req.body;

    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // Check if user is the creator
    if (post.creator.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to update this post' });
    }

    // Check if already sold
    if (post.status === 'sold') {
      return res.status(400).json({ message: 'Post is already marked as sold' });
    }

    const soldAt = new Date();
    post.status = 'sold';
    post.soldDetails = {
      soldAt,
      buyer: {
        name: buyerName,
        email: buyerEmail,
        phone: buyerPhone,
        address: buyerAddress
      },
      soldPrice: soldPrice || post.price
    };

    await post.save();

    // Distribute points using the commission service
    try {
      if (buyerUserId) {
        await CommissionService.distributePoints(
          post._id,
          buyerUserId,
          soldPrice || post.price,
          soldAt
        );
      } else {
        // No buyer user ID provided - create platform fee commission only
        const distribution = CommissionService.calculateDistribution(post.pointsPool);
        await CommissionService.createCommission({
          post: post._id,
          recipient: null, // Platform
          amount: distribution.distributableAmount,
          percentage: 100,
          distributionType: 'platform_fee',
          totalPointsPool: distribution.pointsPool,
          platformFee: distribution.platformFee,
          distributableAmount: distribution.distributableAmount,
          saleDetails: {
            soldAt,
            buyerInfo: {
              name: buyerName,
              email: buyerEmail,
              phone: buyerPhone,
              address: buyerAddress
            },
            soldPrice: soldPrice || post.price
          }
        });
      }
    } catch (commissionError) {
      console.error('Commission distribution error:', commissionError);
      // Don't fail the sale if commission distribution fails
    }

    res.json(post);
  } catch (error) {
    console.error('Mark as sold error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single post by ID (public access)
router.get('/:id', async (req, res) => {
  try {
    const post = await Post.findById(req.params.id).populate('creator', 'username email type profile');
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }
    res.json(post);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Track post view (public endpoint)
router.put('/:id/view', async (req, res) => {
  try {
    const post = await Post.findByIdAndUpdate(
      req.params.id,
      { $inc: { reach: 1 } },
      { new: true }
    );
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }
    res.json({ message: 'View tracked', reach: post.reach });
  } catch (error) {
    console.error('Error tracking view:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update post (for editing)
router.put('/:id', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // Check if user is the creator
    if (post.creator.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to update this post' });
    }

    // Prevent updating sold posts
    if (post.status === 'sold') {
      return res.status(400).json({ message: 'Cannot update a sold post' });
    }

    const { title, description, category, originalPrice, price, photos } = req.body;

    post.title = title || post.title;
    post.description = description || post.description;
    post.category = category || post.category;
    post.originalPrice = originalPrice !== undefined ? originalPrice : post.originalPrice;
    post.price = price || post.price;
    if (photos) {
      post.photos = photos.slice(0, 4); // Limit to 4 photos
    }

    await post.save();
    res.json(post);
  } catch (error) {
    console.error('Update post error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
module.exports.setIoInstance = setIoInstance;