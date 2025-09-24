const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');
const ActivityService = require('../services/activityService');

const router = express.Router();

// Register
router.post('/register', async (req, res) => {
  try {
    const { email, username, password, type, platform, device, browser, userAgent, screenSize, coordinates } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
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

    // Create user
    const user = new User({
      email,
      username,
      password: hashedPassword,
      type,
      credits,
      role,
    });

    await user.save();

    // Track user registration activity with metadata
    await ActivityService.trackUserRegistration(user._id, null, {
      platform: platform || 'web',
      device: device || 'desktop',
      browser: browser || req.headers['user-agent']?.split(' ')[0] || 'Unknown',
      userAgent: userAgent || req.headers['user-agent'] || 'Unknown',
      screenSize: screenSize || {},
      coordinates: coordinates || {},
      ipAddress: req.ip
    });

    // Generate token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: '7d',
    });

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
    res.status(500).json({ message: 'Server error' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Track user login activity
    await ActivityService.trackUserLogin(user._id, {
      platform: 'web',
      userAgent: req.headers['user-agent'],
      ip: req.ip
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
    const users = await User.find({ username: { $exists: false } });
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

module.exports = router;