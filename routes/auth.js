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

// Register
router.post('/register', async (req, res) => {
  try {
    console.log('Registration request received:', { email: req.body.email, username: req.body.username });
    
    const { email, username, password, type, platform, device, browser, userAgent, screenSize, coordinates, postId, referralId } = req.body;

    // Validate required fields
    if (!email || !username || !password || !type) {
      console.error('Missing required fields:', { email: !!email, username: !!username, password: !!password, type: !!type });
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Check if user exists
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      console.log('User already exists:', existingUser.email);
      const field = existingUser.email === email ? 'email' : 'username';
      return res.status(400).json({ message: `${field.charAt(0).toUpperCase() + field.slice(1)} already exists` });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Set initial credits based on type
    let credits = 5; // individual
    if (type === 'enterprise' || type === 'company') {
      credits = 10;
    }

    // Set role - make admin if it's a specific admin email or first user
    let role = 'user';
    const adminEmails = ['admin@referralhub.com', 'superadmin@referralhub.com'];
    if (adminEmails.includes(email.toLowerCase())) {
      role = 'admin';
    }

    // Username is required from frontend
    if (!username || username.trim() === '') {
      console.error('Username is empty or invalid');
      return res.status(400).json({ message: 'Username is required' });
    }

    // Validate username length
    const finalUsername = username.trim();
    if (finalUsername.length < 3 || finalUsername.length > 30) {
      console.error('Username length invalid:', finalUsername.length);
      return res.status(400).json({ message: 'Username must be between 3 and 30 characters' });
    }

    // Check if username is already taken
    const existingUsername = await User.findOne({ username: finalUsername });
    if (existingUsername) {
      console.log('Username already taken:', finalUsername);
      return res.status(400).json({ message: 'Username already taken' });
    }

    // Handle referral if postId or referralId is provided
    let referrerId = null;
    let referralRecord = null;
    let parentReferral = null;

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

    console.log('Creating user with data:', { email, username: finalUsername, type });

    // Create user with complete profile
    const user = new User({
      email,
      username: finalUsername,
      password: hashedPassword,
      type,
      credits,
      role,
      referrer: referrerId,
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

    console.log('Saving user to database...');
    await user.save();
    console.log('User saved successfully:', user._id);

    // Store signup data
    const signupData = {
      coordinates: coordinates ? { lat: coordinates.latitude, lng: coordinates.longitude } : undefined,
      location: coordinates ? {
        city: coordinates.city,
        state: coordinates.state,
        country: coordinates.country,
        timezone: coordinates.timezone,
      } : undefined,
      deviceInfo: {
        browser: browser || req.headers['user-agent']?.split(' ')[0] || 'Unknown',
        os: 'Unknown',
        device: device || 'desktop',
        userAgent: userAgent || req.headers['user-agent'] || 'Unknown',
        screenSize: screenSize || {},
      },
      ipAddress: req.ip,
      timestamp: new Date(),
    };

    await User.findByIdAndUpdate(user._id, {
      coordinates: signupData.coordinates,
      location: signupData.location,
      deviceInfo: signupData.deviceInfo,
      ipAddress: signupData.ipAddress,
      signupData: signupData,
    });

    // Update referral record with referee
    if (referralRecord) {
      referralRecord.referee = user._id;
      await referralRecord.save();

      // Add to referrer's direct referrals
      if (referrerId) {
        await User.findByIdAndUpdate(referrerId, {
          $addToSet: { 'network.directReferrals': user._id }
        });
      }
    }

    // Track user registration activity with metadata
    try {
      console.log('Tracking user registration activity...');
      await ActivityService.trackUserRegistration(user._id, referrerId, {
        platform: platform || 'web',
        device: device || 'desktop',
        browser: browser || req.headers['user-agent']?.split(' ')[0] || 'Unknown',
        userAgent: userAgent || req.headers['user-agent'] || 'Unknown',
        screenSize: screenSize || {},
        coordinates: coordinates || {},
        ipAddress: req.ip
      });
      console.log('User registration activity tracked successfully');
    } catch (activityError) {
      console.error('Failed to track user registration activity:', activityError);
      // Don't fail the registration if activity tracking fails
    }

    // Emit real-time updates for referrer
    if (referrerId && io) {
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
    }

    // Generate token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: '7d',
    });

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
    console.error('Registration error:', error);
    console.error('Error stack:', error.stack);
    console.error('Error name:', error.name);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);

    // Send more specific error messages
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        message: 'Validation error',
        errors: validationErrors
      });
    }

    if (error.code === 11000) {
      // Duplicate key error
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({
        message: `${field} already exists`
      });
    }

    res.status(500).json({
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password, platform, device, browser, userAgent, screenSize, coordinates } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
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

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: '7d',
    });

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

module.exports = router;