const express = require('express');
const Post = require('../models/Post');
const User = require('../models/User');
const auth = require('../middleware/auth');
const ActivityService = require('../services/activityService');
const CommissionService = require('../services/commissionService');
const GamificationService = require('../services/gamificationService');
const QRCode = require('qrcode');
const sharp = require('sharp');

const router = express.Router();

// Get io instance from app
let io;
const setIoInstance = (ioInstance) => {
  io = ioInstance;
};

// Function to convert image data URL to JPEG format
const convertToJpeg = async (dataUrl) => {
  try {
    // Check if it's a data URL
    if (!dataUrl.startsWith('data:image/')) {
      return dataUrl; // Return as is if not a data URL
    }

    // Extract base64 data
    const base64Data = dataUrl.split(',')[1];
    const buffer = Buffer.from(base64Data, 'base64');

    // Convert to JPEG using sharp
    const jpegBuffer = await sharp(buffer)
      .jpeg({ quality: 85 }) // Good quality JPEG
      .toBuffer();

    // Convert back to data URL
    const jpegDataUrl = `data:image/jpeg;base64,${jpegBuffer.toString('base64')}`;
    return jpegDataUrl;
  } catch (error) {
    console.error('Error converting image to JPEG:', error);
    return dataUrl; // Return original if conversion fails
  }
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

    // Convert all photos to JPEG format for universal compatibility
    console.log('Converting photos to JPEG format...');
    const convertedPhotos = await Promise.all(photos.map(convertToJpeg));
    console.log('Photo conversion completed');

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
      originalPrice: originalPrice || 0,
      price: price || 0,
      photos: convertedPhotos.slice(0, 4), // Limit to 4 photos
      pointsPool: distribution.pointsPool,
      platformFee: distribution.platformFee,
      distributablePoints: distribution.distributableAmount,
      reach: 0,
      conversions: 0,
      location: location || {
        latitude: coordinates?.latitude || 0,
        longitude: coordinates?.longitude || 0,
        city: 'Unknown',
        state: 'Unknown',
        country: 'Unknown',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      },
      creationMetadata: {
        platform: platform,
        device: detectedDevice,
        browser: browser || req.headers['user-agent']?.split(' ')[0] || 'Chrome',
        userAgent: userAgent || req.headers['user-agent'] || 'Mozilla/5.0',
        screenSize: screenSize || { width: 1920, height: 1080 },
        ipAddress: ipAddress,
        coordinates: coordinates || { latitude: 0, longitude: 0, accuracy: 0 },
        networkInfo: { isp: 'Unknown', connectionType: 'unknown' },
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

    // Check for badge achievements
    await GamificationService.checkAndAwardBadges(req.user.id);

    // Update user streak
    await GamificationService.updateStreak(req.user.id);

    res.status(201).json(post);
  } catch (error) {
    console.error('Post creation error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get trending posts
router.get('/trending', async (req, res) => {
  try {
    console.log('Trending posts endpoint hit, query:', req.query);
    const limit = parseInt(req.query.limit) || 10;
    console.log('Parsed limit:', limit);

    // Trending algorithm: sort by combination of recent activity, reach, and conversions
    // Posts from last 7 days with high engagement
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    console.log('Seven days ago:', sevenDaysAgo);

    console.log('Querying posts with status active and createdAt >=', sevenDaysAgo);
    const trendingPosts = await Post.find({
      status: 'active',
      createdAt: { $gte: sevenDaysAgo }
    })
    .populate({
      path: 'creator',
      select: 'username email type profile isVerified kyc'
    })
    .sort({
      // Custom scoring: conversions * 10 + reach * 0.1 + (recent bonus)
      conversions: -1,
      reach: -1,
      createdAt: -1
    })
    .limit(limit);

    console.log('Found trending posts count:', trendingPosts.length);

    // Add trending score for frontend
    const postsWithScore = trendingPosts.map(post => ({
      ...post.toObject(),
      trendingScore: (post.conversions * 10) + (post.reach * 0.1) + Math.max(0, (7 - Math.floor((new Date() - post.createdAt) / (1000 * 60 * 60 * 24))) * 2)
    }));

    // Sort by trending score
    postsWithScore.sort((a, b) => b.trendingScore - a.trendingScore);

    console.log('Returning trending posts with scores, total:', postsWithScore.length);
    res.json({
      posts: postsWithScore,
      total: postsWithScore.length
    });
  } catch (error) {
    console.error('Error fetching trending posts:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all posts with advanced search and filtering
router.get('/', async (req, res) => {
  try {
    const {
      search,
      category,
      status = 'active',
      priceMin,
      priceMax,
      dateStart,
      dateEnd,
      location,
      creator,
      minReach,
      minConversions,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      page = 1,
      limit = 20
    } = req.query;

    // Build query object
    let query = {};

    // Status filter
    if (status !== 'all') {
      query.status = status;
    }

    // Search filter
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Category filter
    if (category && category !== '') {
      query.category = category;
    }

    // Price range filter
    if (priceMin || priceMax) {
      query.price = {};
      if (priceMin) query.price.$gte = parseFloat(priceMin);
      if (priceMax) query.price.$lte = parseFloat(priceMax);
    }

    // Date range filter
    if (dateStart || dateEnd) {
      query.createdAt = {};
      if (dateStart) query.createdAt.$gte = new Date(dateStart);
      if (dateEnd) query.createdAt.$lte = new Date(dateEnd);
    }

    // Location filter
    if (location) {
      query.$or = query.$or || [];
      query.$or.push(
        { 'location.city': { $regex: location, $options: 'i' } },
        { 'location.state': { $regex: location, $options: 'i' } },
        { 'location.country': { $regex: location, $options: 'i' } }
      );
    }

    // Creator filter
    if (creator) {
      // First find users matching the creator search
      const User = require('../models/User');
      const users = await User.find({
        $or: [
          { username: { $regex: creator, $options: 'i' } },
          { email: { $regex: creator, $options: 'i' } }
        ]
      }).select('_id');

      const userIds = users.map(user => user._id);
      if (userIds.length > 0) {
        query.creator = { $in: userIds };
      } else {
        // No matching users found, return empty result
        return res.json({
          posts: [],
          pagination: {
            currentPage: parseInt(page),
            totalPages: 0,
            totalPosts: 0,
            hasNextPage: false,
            hasPrevPage: false,
          }
        });
      }
    }

    // Reach filter
    if (minReach) {
      query.reach = { $gte: parseInt(minReach) };
    }

    // Conversions filter
    if (minConversions) {
      query.conversions = { $gte: parseInt(minConversions) };
    }

    // Build sort object
    let sort = {};
    switch (sortBy) {
      case 'newest':
        sort.createdAt = sortOrder === 'asc' ? 1 : -1;
        break;
      case 'oldest':
        sort.createdAt = sortOrder === 'asc' ? 1 : -1;
        break;
      case 'price_high':
        sort.price = -1;
        break;
      case 'price_low':
        sort.price = 1;
        break;
      case 'reach':
        sort.reach = -1;
        break;
      case 'conversions':
        sort.conversions = -1;
        break;
      case 'engagement':
        // Sort by combined engagement (likes + comments + bookmarks)
        // This would require aggregation, for now sort by reach
        sort.reach = -1;
        break;
      default:
        sort.createdAt = -1;
    }

    // Execute query with pagination
    const posts = await Post.find(query)
      .populate({
        path: 'creator',
        select: 'username email type profile isVerified kyc'
      })
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Post.countDocuments(query);

    res.json({
      posts,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalPosts: total,
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
      filters: {
        applied: Object.keys(req.query).filter(key =>
          req.query[key] && req.query[key] !== '' && req.query[key] !== 'all'
        ).length,
        query: req.query
      }
    });
  } catch (error) {
    console.error('Error fetching posts:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Debug: Get all posts (including inactive) - for admin debugging
router.get('/debug', async (req, res) => {
  try {
    const allPostsRaw = await Post.find({});
    const allPosts = await Post.find({}).populate('creator', 'username email type role');
    const activePosts = await Post.find({ status: 'active' }).populate('creator', 'username email type role');
    const inactivePosts = await Post.find({ status: 'inactive' }).populate('creator', 'username email type role');

    res.json({
      total: allPosts.length,
      active: activePosts.length,
      inactive: inactivePosts.length,
      rawCreatorField: allPostsRaw[0]?.creator, // Show raw creator field
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
        creatorObject: p.creator, // Show full creator object
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
    const post = await Post.findById(req.params.id).populate({
      path: 'creator',
      select: 'username email type profile isVerified kyc'
    });
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

    // Emit real-time update for post analytics
    if (io) {
      const postOwner = await Post.findById(req.params.id).populate('creator');
      if (postOwner && postOwner.creator) {
        io.to(`user_${postOwner.creator._id}`).emit('post_analytics_update', {
          postId: req.params.id,
          type: 'reach_increase',
          newReach: post.reach
        });
      }
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
      // Convert photos to JPEG format for universal compatibility
      const convertedPhotos = await Promise.all(photos.map(convertToJpeg));
      post.photos = convertedPhotos.slice(0, 4); // Limit to 4 photos
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