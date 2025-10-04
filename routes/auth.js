const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');
const ActivityService = require('../services/activityService');

const router = express.Router();

// Get io instance from server.js
let io;
const setIoInstance = (ioInstance) => {
  io = ioInstance;
};

// Attach setIoInstance to router
router.setIoInstance = setIoInstance;

// Use a safe JWT secret fallback to avoid crashes if env var is missing
const jwtSecret = process.env.JWT_SECRET || 'fallback_secret_change_me_in_production';
const SIGNUP_MINIMAL = process.env.SIGNUP_MINIMAL ? process.env.SIGNUP_MINIMAL === 'true' : true;

// Function to escape special regex characters
function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Validate critical environment variables
if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'your_super_secret_jwt_key_here_change_in_production_123456789') {
  console.warn('WARNING: JWT_SECRET is not properly configured. Using fallback secret.');
}
if (!process.env.MONGODB_URI) {
  console.error('CRITICAL: MONGODB_URI is not set!');
}

// Register
router.post('/register', async (req, res) => {
  try {
    console.log('=== REGISTER ENDPOINT HIT ===');
    console.log('Environment variables check:', {
      JWT_SECRET: process.env.JWT_SECRET ? 'SET' : 'NOT SET',
      MONGODB_URI: process.env.MONGODB_URI ? 'SET' : 'NOT SET',
      SIGNUP_MINIMAL: SIGNUP_MINIMAL
    });
    // Ensure DB is connected before proceeding
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 1) {
      console.error('Database not connected, readyState:', mongoose.connection.readyState);
      return res.status(503).json({ message: 'Service temporarily unavailable. Please try again.' });
    }

    console.log('Registration request received:', { email: req.body.email, username: req.body.username });
    const { email, username, password, type, platform, device, browser, userAgent, screenSize, coordinates, postId, referralId } = req.body;
    console.log('Request body parsed:', { email: email ? 'SET' : 'NOT SET', username: username ? 'SET' : 'NOT SET', password: password ? 'SET' : 'NOT SET', type: type ? 'SET' : 'NOT SET' });

    // Type validation
    if (typeof email !== 'string' || typeof username !== 'string' || typeof password !== 'string' || typeof type !== 'string') {
      console.error('Invalid data types:', { email: typeof email, username: typeof username, password: typeof password, type: typeof type });
      return res.status(400).json({ message: 'Invalid data types' });
    }

    // Normalize email and username to lowercase for case-insensitive uniqueness
    console.log('About to normalize email and username');
    const normalizedEmail = email.toLowerCase().trim();
    const normalizedUsername = username.trim().toLowerCase();
    console.log('Normalized:', { normalizedEmail, normalizedUsername });

    // Validate required fields
    if (!email || !username || !password || !type) {
      console.error('Missing required fields:', { email: !!email, username: !!username, password: !!password, type: !!type });
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Normalize and validate type
    const normalizedType = String(type).toLowerCase();
    const allowedTypes = ['enterprise', 'company', 'individual'];
    if (!allowedTypes.includes(normalizedType)) {
      console.error('Invalid type value:', type);
      return res.status(400).json({ message: `Invalid type. Allowed: ${allowedTypes.join(', ')}` });
    }

    // Check if user exists (case-insensitive using escaped regex)
    const escapedEmail = escapeRegex(normalizedEmail);
    const escapedUsername = escapeRegex(normalizedUsername);
    const existingUser = await User.findOne({
      $or: [
        { email: { $regex: `^${escapedEmail}$`, $options: 'i' } },
        { username: { $regex: `^${escapedUsername}$`, $options: 'i' } }
      ]
    });
    if (existingUser) {
      console.log('User already exists:', existingUser.email);
      const field = existingUser.email.toLowerCase() === normalizedEmail ? 'email' : 'username';
      return res.status(400).json({ message: `${field.charAt(0).toUpperCase() + field.slice(1)} already exists` });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    console.log('Password hashed successfully');

    // Set initial credits based on type
    let credits = 5; // individual
    if (normalizedType === 'enterprise' || normalizedType === 'company') {
      credits = 10;
    }

    // Set role - make admin if it's a specific admin email or first user
    let role = 'user';
    const adminEmails = ['admin@referralhub.com', 'superadmin@referralhub.com'];
    if (adminEmails.includes(normalizedEmail)) {
      role = 'admin';
    }

    // Username is required from frontend
    if (!normalizedUsername || normalizedUsername === '') {
      console.error('Username is empty or invalid');
      return res.status(400).json({ message: 'Username is required' });
    }

    // Validate username length
    if (normalizedUsername.length < 3 || normalizedUsername.length > 30) {
      console.error('Username length invalid:', normalizedUsername.length);
      return res.status(400).json({ message: 'Username must be between 3 and 30 characters' });
    }

    // Username already checked in existingUser, but double check
    // The existingUser check already includes username

    // Handle referral if postId or referralId is provided
    let referrerId = null;
    let referralRecord = null;
    let parentReferral = null;

    // Temporarily disable referral processing for debugging
    /*
    if (referralId) {
      // Handle referral link with referralId
      const Referral = require('../models/Referral');
      try {
        parentReferral = await Referral.findById(referralId);
      } catch (error) {
        console.error('Invalid referralId:', referralId, error);
        // Skip referral processing for invalid ID
      }
      if (parentReferral) {
        referrerId = parentReferral.referrer;

        // Create new referral record in the chain
        referralRecord = new Referral({
          post: parentReferral.post,
          referrer: referrerId,
          referee: null, // Will be set after user creation
          level: parentReferral.level + 1,
          platform: platform || 'web',
          device: device || 'desktop',
          location: {
            latitude: coordinates?.latitude,
            longitude: coordinates?.longitude,
            city: coordinates?.city,
            state: coordinates?.state,
            country: coordinates?.country,
            timezone: coordinates?.timezone,
            accuracy: coordinates?.accuracy
          },
          browser: browser,
          userAgent: userAgent,
          screenSize: screenSize,
          ipAddress: req.ip,
          coordinates: coordinates,
          sessionId: req.sessionID,
          parentReferral: referralId, // Link to parent referral
          chainPosition: parentReferral.chainPosition + 1
        });

        await referralRecord.save();
      }
    } else if (postId) {
      // Handle direct post referral (legacy support)
      const Post = require('../models/Post');
      const Referral = require('../models/Referral');

      try {
        const post = await Post.findById(postId);
        if (post) {
          referrerId = post.creator;

          // Create referral record
          referralRecord = new Referral({
            post: postId,
            referrer: referrerId,
            referee: null, // Will be set after user creation
            level: 1,
            platform: platform || 'web',
            device: device || 'desktop',
            location: {
              latitude: coordinates?.latitude,
              longitude: coordinates?.longitude,
              city: coordinates?.city,
              state: coordinates?.state,
              country: coordinates?.country,
              timezone: coordinates?.timezone,
              accuracy: coordinates?.accuracy
            },
            browser: browser,
            userAgent: userAgent,
            screenSize: screenSize,
            ipAddress: req.ip,
            coordinates: coordinates,
            sessionId: req.sessionID,
            chainPosition: 1
          });

          await referralRecord.save();
        }
      } catch (error) {
        console.error('Invalid postId:', postId, error);
        // Skip referral processing for invalid ID
      }
    }
    */

    console.log('Creating user with data:', { email: normalizedEmail, username: normalizedUsername, type: normalizedType, minimal: SIGNUP_MINIMAL });

    let user;
    if (SIGNUP_MINIMAL) {
      console.log('Using minimal signup');
      // Minimal safe user creation to avoid any optional schema issues
      user = new User({
        email: normalizedEmail,
        username: normalizedUsername,
        password: hashedPassword,
        type: normalizedType,
        credits,
        role
      });
    } else {
      console.log('Using full signup');
      // Full profile creation
      user = new User({
        email: normalizedEmail,
        username: normalizedUsername,
        password: hashedPassword,
        type: normalizedType,
        credits,
        role,
        referrer: referrerId,
        network: {
          directReferrals: [],
          level: 1
        },
        profile: {
          name: '',
          company: '',
          location: ''
        },
        coordinates: { lat: 0, lng: 0 },
        location: {
          city: coordinates?.city || 'Unknown',
          state: coordinates?.state || 'Unknown',
          country: coordinates?.country || 'Unknown',
          timezone: coordinates?.timezone || 'UTC'
        },
        deviceInfo: {
          browser: browser || req.headers['user-agent']?.split(' ')[0] || 'Chrome',
          os: 'Unknown',
          device: device || 'desktop',
          userAgent: userAgent || req.headers['user-agent'] || 'Mozilla/5.0',
          screenSize: screenSize || { width: 1920, height: 1080 }
        },
        ipAddress: req.ip,
        isVerified: false,
        kyc: {
          status: 'pending',
          documents: {
            idType: '',
            idNumber: '',
            idFront: '',
            idBack: '',
            selfie: ''
          },
          submittedAt: null,
          reviewedAt: null,
          reviewedBy: null,
          rejectionReason: ''
        },
        badges: [],
        gamification: {
          totalPoints: 0,
          level: 1,
          experience: 0,
          streak: {
            current: 0,
            longest: 0,
            lastActivity: null
          }
        }
      });
    }

    console.log('Saving user to database...');
    console.log('User object before save:', { email: user.email, username: user.username, type: user.type });

    try {
      await user.save();
      console.log('User saved successfully:', user._id);
    } catch (saveError) {
      console.error('User save error:', saveError);
      console.error('Error name:', saveError.name);
      console.error('Error code:', saveError.code);
      console.error('Error message:', saveError.message);

      // Handle specific database errors
      if (saveError.name === 'ValidationError') {
        const validationErrors = Object.values(saveError.errors).map(err => err.message);
        return res.status(400).json({
          message: 'Validation error during user creation',
          errors: validationErrors
        });
      }

      if (saveError.code === 11000) {
        return res.status(400).json({
          message: 'Duplicate key error - user may already exist'
        });
      }

      // Re-throw for general 500 handling
      throw saveError;
    }

    // Update referral record with referee
    if (referralRecord) {
      referralRecord.referee = user._id;
      try {
        await referralRecord.save();
      } catch (referralError) {
        console.error('Error saving referral record:', referralError);
        // Don't fail registration if referral save fails
      }

      // Add to referrer's direct referrals
      if (referrerId) {
        try {
          await User.findByIdAndUpdate(referrerId, {
            $addToSet: { 'network.directReferrals': user._id }
          });
        } catch (updateError) {
          console.error('Error updating referrer network:', updateError);
          // Don't fail registration if this fails
        }
      }
    }

    // Track user registration activity with metadata (skip in minimal mode)
    if (!SIGNUP_MINIMAL) {
      try {
        console.log('DEBUG: About to track user registration activity for user:', user._id);
        await ActivityService.trackUserRegistration(user._id, referrerId, {
          platform: platform || 'web',
          device: device || 'desktop',
          browser: browser || req.headers['user-agent']?.split(' ')[0] || 'Unknown',
          userAgent: userAgent || req.headers['user-agent'] || 'Unknown',
          screenSize: screenSize || {},
          coordinates: coordinates || {},
          ipAddress: req.ip
        });
        console.log('DEBUG: User registration activity tracked successfully');
      } catch (activityError) {
        console.error('DEBUG: Failed to track user registration activity:', activityError);
        console.error('DEBUG: Activity error name:', activityError.name);
        console.error('DEBUG: Activity error message:', activityError.message);
        // Don't fail the registration if activity tracking fails
      }
    } else {
      console.log('DEBUG: Skipping activity tracking due to SIGNUP_MINIMAL=true');
    }

    // Emit real-time updates for referrer
    if (referrerId && io) {
      try {
        // Emit referral update
        io.to(`user_${referrerId}`).emit('referral_update', {
          type: 'new_referral',
          referral: {
            _id: referralRecord._id,
            post: referralRecord.post,
            platform: referralRecord.platform,
            device: referralRecord.device,
            location: referralRecord.location,
            timestamp: referralRecord.createdAt
          }
        });

        // Emit user analytics update
        io.to(`user_${referrerId}`).emit('user_analytics_update', {
          type: 'new_referral_user',
          userId: referrerId,
          newUserId: user._id,
          newUserType: user.type,
          timestamp: new Date()
        });
      } catch (socketError) {
        console.error('Error emitting socket events:', socketError);
        // Don't fail registration if socket fails
      }
    }

    // Generate token
    console.log('Generating JWT token...');
    let token;
    try {
      token = jwt.sign({ id: user._id.toString() }, jwtSecret, {
        expiresIn: 604800,
      });
      console.log('JWT token generated successfully');
    } catch (jwtError) {
      console.error('JWT token generation error:', jwtError);
      return res.status(500).json({
        message: 'Token generation failed',
        error: 'JWT_SECRET may not be configured properly'
      });
    }

    console.log('Registration successful for user:', user.username);
    res.status(201).json({
      token,
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        type: user.type,
        credits: user.credits,
      },
    });
  } catch (error) {
    // Add correlation id for production diagnostics
    const errorId = `reg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    console.error(`[${errorId}] Registration error:`, error);
    console.error('Error stack:', error.stack);
    console.error('Error name:', error.name);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    console.error('Error constructor:', error.constructor.name);
    console.error('Error errno:', error.errno);
    console.error('Error syscall:', error.syscall);

    // Send more specific error messages
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        message: 'Validation error',
        errors: validationErrors
      });
    }

    if (error.code === 11000) {
      // Duplicate key error (handle cases where keyPattern is undefined)
      let field = 'field';
      try {
        const keysFromPattern = error.keyPattern ? Object.keys(error.keyPattern) : [];
        const keysFromValue = error.keyValue ? Object.keys(error.keyValue) : [];
        field = (keysFromPattern[0] || keysFromValue[0] || 'field');
      } catch (_) {
        // fallback to parsing message
        const match = /index: (\w+)_\d+ dup key/.exec(error.message || '');
        if (match && match[1]) field = match[1];
      }
      return res.status(400).json({
        message: `${field} already exists`
      });
    }

    // Allow forcing error details via query param for production debugging: /api/auth/register?debug=true
    const exposeErrors = process.env.EXPOSE_ERRORS === 'true' || req.query.debug === 'true';
    res.status(500).json({
      message: 'Server error',
      errorId,
      error: (process.env.NODE_ENV !== 'production' || exposeErrors) ? {
        message: error.message,
        name: error.name,
        stack: error.stack
      } : 'Internal server error'
    });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    console.log('=== LOGIN ENDPOINT HIT ===');
    console.log('Request body:', req.body);
    const { email, password, platform, device, browser, userAgent, screenSize, coordinates } = req.body;
    console.log('Login request for email:', email);
    const normalizedEmail = email.toLowerCase().trim();
    console.log('Normalized email:', normalizedEmail);

    console.log('Looking up user in database...');
    let user = await User.findOne({ email: normalizedEmail });
    console.log('User found:', !!user);

    // Special handling for demo users
    if (normalizedEmail === 'premium@demo.com' || normalizedEmail === 'superpremium@demo.com') {
      console.log('=== DEMO USER LOGIN ATTEMPT ===');
      console.log('Email:', normalizedEmail);
      console.log('Password provided:', password);

      // Always recreate demo users to ensure they work
      try {
        console.log('Recreating demo user...');
        await User.deleteMany({ email: normalizedEmail });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('demo123', salt);

        const isPremium = normalizedEmail === 'premium@demo.com';
        const newUser = new User({
          email: normalizedEmail,
          username: isPremium ? 'premium_user' : 'super_premium',
          password: hashedPassword,
          type: 'enterprise',
          status: isPremium ? 'premium' : 'super-premium',
          isVerified: true,
          profile: {
            name: isPremium ? 'Premium Demo User' : 'Super Premium Demo',
            company: isPremium ? 'Tech Innovators Inc.' : 'Global Solutions Ltd.'
          },
          credits: isPremium ? 2500 : 5000,
          gamification: {
            totalPoints: isPremium ? 2500 : 5000,
            level: isPremium ? 15 : 25,
            experience: isPremium ? 12500 : 25000
          },
          location: {
            city: 'Mumbai',
            state: 'Maharashtra',
            country: 'India',
            timezone: 'Asia/Kolkata'
          },
          coordinates: { lat: 19.0760, lng: 72.8777 },
          deviceInfo: {
            browser: 'Chrome',
            os: 'Windows',
            device: 'desktop',
            userAgent: 'Mozilla/5.0'
          },
          network: { directReferrals: [], level: 1 }
        });

        user = await newUser.save();
        console.log('Demo user recreated successfully');
      } catch (createError) {
        console.error('Failed to create demo user:', createError);
        return res.status(500).json({ message: 'Server error creating demo user' });
      }
    }

    if (user) {
      console.log('User details:', { id: user._id, email: user.email, username: user.username, type: user.type, status: user.status, role: user.role });
      if (user.status === 'premium' || user.status === 'super-premium') {
        console.log('=== PREMIUM/SUPER-PREMIUM USER LOGIN ATTEMPT ===');
        console.log('User status:', user.status);
        console.log('User verified:', user.isVerified);
        console.log('User kyc status:', user.kyc?.status);
      }
    }
    if (!user) {
      console.log('No user found with email:', normalizedEmail);
      return res.status(400).json({ message: 'Invalid credentials' });
    }


    console.log('Comparing passwords...');
    console.log('Provided password:', password);
    console.log('Stored hash starts with:', user.password.substring(0, 10) + '...');
    const isMatch = await bcrypt.compare(password, user.password);
    console.log('Password match:', isMatch);
    if (!isMatch) {
      console.log('Password does not match for user:', user.email);
      if (user.status === 'premium' || user.status === 'super-premium') {
        console.log('=== PREMIUM/SUPER-PREMIUM USER PASSWORD MISMATCH ===');
      }
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Prepare login data
    const loginData = {
      timestamp: new Date(),
      coordinates: coordinates ? { lat: coordinates.latitude, lng: coordinates.longitude } : undefined,
      location: coordinates ? {
        city: coordinates.city,
        state: coordinates.state,
        country: coordinates.country,
        timezone: coordinates.timezone,
      } : undefined,
      deviceInfo: {
        browser: browser || req.headers['user-agent']?.split(' ')[0] || 'Unknown',
        os: 'Unknown', // Could be extracted from userAgent
        device: device || 'desktop',
        userAgent: userAgent || req.headers['user-agent'] || 'Unknown',
        screenSize: screenSize || {},
      },
      ipAddress: req.ip,
    };

    // Update user's current location and device info if provided
    const updateData = {};
    if (coordinates) {
      updateData.coordinates = { lat: coordinates.latitude, lng: coordinates.longitude };
      updateData.location = {
        city: coordinates.city,
        state: coordinates.state,
        country: coordinates.country,
        timezone: coordinates.timezone,
      };
    }
    if (device || browser || userAgent || screenSize) {
      updateData.deviceInfo = {
        browser: browser || req.headers['user-agent']?.split(' ')[0] || 'Unknown',
        os: 'Unknown',
        device: device || 'desktop',
        userAgent: userAgent || req.headers['user-agent'] || 'Unknown',
        screenSize: screenSize || {},
      };
    }
    updateData.ipAddress = req.ip;
    updateData.$push = { loginHistory: loginData };

    await User.findByIdAndUpdate(user._id, updateData);

    // Track user login activity
    await ActivityService.trackUserLogin(user._id, {
      platform: platform || 'web',
      device: device || 'desktop',
      browser: browser || req.headers['user-agent']?.split(' ')[0] || 'Unknown',
      userAgent: userAgent || req.headers['user-agent'] || 'Unknown',
      screenSize: screenSize || {},
      coordinates: coordinates || {},
      ipAddress: req.ip
    });

    const token = jwt.sign({ id: user._id.toString() }, jwtSecret, {
      expiresIn: '7d',
    });

    if (user.status === 'premium' || user.status === 'super-premium') {
      console.log('=== PREMIUM/SUPER-PREMIUM USER LOGIN SUCCESSFUL ===');
      console.log('Generated token for user:', user.email, 'ID:', user._id, 'ID type:', typeof user._id);
    }

    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        type: user.type,
        credits: user.credits,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get current user profile
router.get('/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Update user profile
router.put('/profile', auth, async (req, res) => {
  try {
    const { name, company, location } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { profile: { name, company, location } },
      { new: true }
    ).select('-password');
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Migration route to add usernames to existing users
router.post('/migrate-usernames', async (req, res) => {
  try {
    // Find users who don't have username field, or have null/empty username
    const users = await User.find({
      $or: [
        { username: { $exists: false } },
        { username: null },
        { username: '' }
      ]
    });
    let updatedCount = 0;

    for (const user of users) {
      // Generate username from email (part before @)
      const baseUsername = user.email.split('@')[0];
      let username = baseUsername;
      let counter = 1;

      // Ensure uniqueness
      while (await User.findOne({ username })) {
        username = `${baseUsername}${counter}`;
        counter++;
      }

      user.username = username;
      await user.save();
      updatedCount++;
    }

    res.json({ message: `Updated ${updatedCount} users with usernames` });
  } catch (error) {
    res.status(500).json({ message: 'Migration error', error: error.message });
  }
});

// Debug route to check user data
router.get('/debug-user/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    res.json({
      user: user,
      hasUsername: !!user.username,
      usernameValue: user.username
    });
  } catch (error) {
    res.status(500).json({ message: 'Error', error: error.message });
  }
});

// Temporary route to check demo users
router.get('/check-demo-users', async (req, res) => {
  try {
    const premium = await User.findOne({ email: 'premium@demo.com' });
    const superPremium = await User.findOne({ email: 'superpremium@demo.com' });

    res.json({
      premium: premium ? {
        email: premium.email,
        username: premium.username,
        type: premium.type,
        status: premium.status,
        isVerified: premium.isVerified,
        passwordHash: premium.password ? 'SET' : 'NOT SET'
      } : null,
      superPremium: superPremium ? {
        email: superPremium.email,
        username: superPremium.username,
        type: superPremium.type,
        status: superPremium.status,
        isVerified: superPremium.isVerified,
        passwordHash: superPremium.password ? 'SET' : 'NOT SET'
      } : null
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Test login endpoint
router.post('/test-login', async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log('Test login for:', email);

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.json({ found: false, message: 'User not found' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    res.json({
      found: true,
      email: user.email,
      passwordMatch: isMatch,
      status: user.status,
      isVerified: user.isVerified
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Temporary route to seed demo users
router.post('/seed-demo-users', async (req, res) => {
  try {
    const bcrypt = require('bcryptjs');

    // Delete existing demo users if they exist
    await User.deleteMany({ email: { $in: ['premium@demo.com', 'superpremium@demo.com'] } });

    const demoUsers = [];

    // Create premium user
    const salt1 = await bcrypt.genSalt(10);
    const hashedPassword1 = await bcrypt.hash('demo123', salt1);

    const premiumUser = new User({
      email: 'premium@demo.com',
      username: 'premium_user',
      password: hashedPassword1,
      type: 'enterprise',
      status: 'premium',
      isVerified: true,
      profile: { name: 'Premium Demo User', company: 'Tech Innovators Inc.' },
      credits: 2500,
      gamification: { totalPoints: 2500, level: 15, experience: 12500 },
      location: { city: 'Mumbai', state: 'Maharashtra', country: 'India', timezone: 'Asia/Kolkata' },
      coordinates: { lat: 19.0760, lng: 72.8777 },
      deviceInfo: { browser: 'Chrome', os: 'Windows', device: 'desktop', userAgent: 'Mozilla/5.0' },
      network: { directReferrals: [], level: 1 }
    });

    await premiumUser.save();
    demoUsers.push(premiumUser);

    // Create super premium user
    const salt2 = await bcrypt.genSalt(10);
    const hashedPassword2 = await bcrypt.hash('demo123', salt2);

    const superPremiumUser = new User({
      email: 'superpremium@demo.com',
      username: 'super_premium',
      password: hashedPassword2,
      type: 'enterprise',
      status: 'super-premium',
      isVerified: true,
      profile: { name: 'Super Premium Demo', company: 'Global Solutions Ltd.' },
      credits: 5000,
      gamification: { totalPoints: 5000, level: 25, experience: 25000 },
      location: { city: 'Mumbai', state: 'Maharashtra', country: 'India', timezone: 'Asia/Kolkata' },
      coordinates: { lat: 19.0760, lng: 72.8777 },
      deviceInfo: { browser: 'Chrome', os: 'Windows', device: 'desktop', userAgent: 'Mozilla/5.0' },
      network: { directReferrals: [], level: 1 }
    });

    await superPremiumUser.save();
    demoUsers.push(superPremiumUser);

    res.json({
      message: 'Demo users created successfully',
      users: demoUsers.map(u => ({ email: u.email, username: u.username, type: u.type, status: u.status }))
    });
  } catch (error) {
    console.error('Error seeding demo users:', error);
    res.status(500).json({ message: 'Error creating demo users', error: error.message });
  }
});

/**
 * Health/debug endpoint to verify backend environment quickly (safe to keep)
 * GET /api/auth/health
 */
router.get('/health', async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const stateMap = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting',
      99: 'uninitialized'
    };
    res.json({
      ok: true,
      mongo: {
        readyState: mongoose.connection.readyState,
        state: stateMap[mongoose.connection.readyState] || 'unknown',
        host: mongoose.connection.host,
        name: mongoose.connection.name
      },
      env: {
        NODE_ENV: process.env.NODE_ENV || 'undefined',
        JWT_SECRET_SET: !!process.env.JWT_SECRET,
        SIGNUP_MINIMAL: SIGNUP_MINIMAL,
        MONGODB_URI_SET: !!process.env.MONGODB_URI
      },
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

module.exports = router;