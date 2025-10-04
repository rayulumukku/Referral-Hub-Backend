const express = require('express');
const User = require('../models/User');
const Referral = require('../models/Referral');
const auth = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/kyc/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files (jpeg, jpg, png) and PDFs are allowed!'));
    }
  }
});

// Get user by ID (public for profile viewing)
router.get('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user's network (referrals) - auth required
router.get('/:id/network', auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).populate('network.directReferrals', 'username email type');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if requesting user is the owner or has permission
    if (user._id.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    res.json(user.network);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Submit KYC documents
router.post('/kyc/submit', auth, upload.fields([
  { name: 'idFront', maxCount: 1 },
  { name: 'idBack', maxCount: 1 },
  { name: 'selfie', maxCount: 1 }
]), async (req, res) => {
  try {
    const { idType, idNumber } = req.body;
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if KYC already submitted and approved
    if (user.kyc.status === 'approved') {
      return res.status(400).json({ message: 'KYC already approved' });
    }

    // Validate required fields
    if (!idType || !idNumber || !req.files.idFront || !req.files.selfie) {
      return res.status(400).json({ message: 'All required documents must be provided' });
    }

    // Update KYC information
    user.kyc = {
      status: 'pending',
      documents: {
        idType,
        idNumber,
        idFront: req.files.idFront ? `/uploads/kyc/${req.files.idFront[0].filename}` : null,
        idBack: req.files.idBack ? `/uploads/kyc/${req.files.idBack[0].filename}` : null,
        selfie: `/uploads/kyc/${req.files.selfie[0].filename}`
      },
      submittedAt: new Date()
    };

    await user.save();

    res.json({
      message: 'KYC documents submitted successfully',
      kyc: user.kyc
    });
  } catch (error) {
    console.error('KYC submission error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get KYC status
router.get('/kyc/status', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('kyc isVerified');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      kyc: user.kyc,
      isVerified: user.isVerified
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin: Review KYC application
router.put('/:id/kyc/review', auth, async (req, res) => {
  try {
    const { status, rejectionReason } = req.body;

    // Check if user is admin
    const admin = await User.findById(req.user.id);
    if (admin.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    user.kyc.status = status;
    user.kyc.reviewedAt = new Date();
    user.kyc.reviewedBy = req.user.id;

    if (status === 'rejected' && rejectionReason) {
      user.kyc.rejectionReason = rejectionReason;
    } else if (status === 'approved') {
      user.isVerified = true;
      user.kyc.rejectionReason = null;
    }

    await user.save();

    res.json({
      message: `KYC ${status} successfully`,
      kyc: user.kyc,
      isVerified: user.isVerified
    });
  } catch (error) {
    console.error('KYC review error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin: Get pending KYC applications
router.get('/kyc/pending', auth, async (req, res) => {
  try {
    // Check if user is admin
    const admin = await User.findById(req.user.id);
    if (admin.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const pendingUsers = await User.find({
      'kyc.status': 'pending'
    }).select('username email type kyc profile createdAt');

    res.json(pendingUsers);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get journey map data for user
router.get('/journey-map/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;

    // Check if requesting user is the owner
    if (userId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Try to load journey map data from file
    const journeyDataPath = path.join(__dirname, '..', 'journey-map-data.json');

    let journeyData = {};
    if (fs.existsSync(journeyDataPath)) {
      try {
        journeyData = JSON.parse(fs.readFileSync(journeyDataPath, 'utf8'));
      } catch (error) {
        console.error('Error reading journey map data:', error);
      }
    }

    // If no file data, generate it dynamically
    if (!journeyData[userId]) {
      const userReferrals = await Referral.find({ referrer: userId })
        .populate('referee', 'username profile location coordinates deviceInfo')
        .sort({ createdAt: 1 });

      const locations = [];

      // Add the hub (original user)
      locations.push({
        coords: [user.coordinates.lat, user.coordinates.lng],
        person: user.username,
        name: user.location.city,
        state: user.location.state,
        level: 0,
        time: user.createdAt.toISOString().split('T')[0],
        device: user.deviceInfo.device,
        earnings: 0,
        clicks: 0
      });

      // Add referral locations
      for (let i = 0; i < userReferrals.length; i++) {
        const referral = userReferrals[i];
        const referee = referral.referee;

        locations.push({
          coords: [referee.coordinates.lat, referee.coordinates.lng],
          person: referee.username,
          name: referee.location.city,
          state: referee.location.state,
          level: referral.level,
          time: referral.createdAt.toISOString().split('T')[0],
          device: referral.device,
          earnings: referral.level * 50, // Points based on level
          clicks: Math.floor(Math.random() * 100) + 10
        });
      }

      journeyData[userId] = locations;
    }

    res.json({
      locations: journeyData[userId] || [],
      user: {
        id: user._id,
        username: user.username,
        type: user.type
      }
    });
  } catch (error) {
    console.error('Journey map error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get comprehensive referral chain data
router.get('/referral-chain/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;

    // Check if requesting user is the owner
    if (userId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Build comprehensive referral chain
    const referralChain = await buildReferralChain(userId);

    res.json({
      user: {
        id: user._id,
        username: user.username,
        type: user.type,
        status: user.status
      },
      referralChain
    });
  } catch (error) {
    console.error('Referral chain error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

async function buildReferralChain(userId, maxDepth = 3) {
  const chain = {
    level1: [],
    level2: [],
    level3: []
  };

  // Get level 1 referrals
  const level1Referrals = await Referral.find({ referrer: userId, level: 1 })
    .populate('referee', 'username email type profile location coordinates deviceInfo createdAt')
    .populate('post', 'title price')
    .sort({ createdAt: -1 });

  for (const ref of level1Referrals) {
    const refereeData = {
      id: ref.referee._id,
      username: ref.referee.username,
      email: ref.referee.email,
      type: ref.referee.type,
      profile: ref.referee.profile,
      location: ref.referee.location,
      coordinates: ref.referee.coordinates,
      deviceInfo: ref.referee.deviceInfo,
      joinedAt: ref.referee.createdAt,
      referralDate: ref.createdAt,
      referralSource: ref.post?.title || 'Direct',
      earnings: 50, // Level 1 earnings
      level: 1
    };

    chain.level1.push(refereeData);

    // Get level 2 referrals (referrals of level 1 users)
    if (maxDepth >= 2) {
      const level2Referrals = await Referral.find({ referrer: ref.referee._id, level: 2 })
        .populate('referee', 'username email type profile location coordinates deviceInfo createdAt')
        .populate('post', 'title price')
        .sort({ createdAt: -1 });

      for (const ref2 of level2Referrals) {
        const referee2Data = {
          id: ref2.referee._id,
          username: ref2.referee.username,
          email: ref2.referee.email,
          type: ref2.referee.type,
          profile: ref2.referee.profile,
          location: ref2.referee.location,
          coordinates: ref2.referee.coordinates,
          deviceInfo: ref2.referee.deviceInfo,
          joinedAt: ref2.referee.createdAt,
          referralDate: ref2.createdAt,
          referralSource: ref2.post?.title || 'Direct',
          earnings: 25, // Level 2 earnings
          level: 2,
          referredBy: ref.referee.username
        };

        chain.level2.push(referee2Data);

        // Get level 3 referrals (referrals of level 2 users)
        if (maxDepth >= 3) {
          const level3Referrals = await Referral.find({ referrer: ref2.referee._id, level: 3 })
            .populate('referee', 'username email type profile location coordinates deviceInfo createdAt')
            .populate('post', 'title price')
            .sort({ createdAt: -1 });

          for (const ref3 of level3Referrals) {
            const referee3Data = {
              id: ref3.referee._id,
              username: ref3.referee.username,
              email: ref3.referee.email,
              type: ref3.referee.type,
              profile: ref3.referee.profile,
              location: ref3.referee.location,
              coordinates: ref3.referee.coordinates,
              deviceInfo: ref3.referee.deviceInfo,
              joinedAt: ref3.referee.createdAt,
              referralDate: ref3.createdAt,
              referralSource: ref3.post?.title || 'Direct',
              earnings: 10, // Level 3 earnings
              level: 3,
              referredBy: ref2.referee.username
            };

            chain.level3.push(referee3Data);
          }
        }
      }
    }
  }

  // Calculate summary statistics
  const summary = {
    totalReferrals: chain.level1.length + chain.level2.length + chain.level3.length,
    level1Count: chain.level1.length,
    level2Count: chain.level2.length,
    level3Count: chain.level3.length,
    totalEarnings: chain.level1.reduce((sum, r) => sum + r.earnings, 0) +
                   chain.level2.reduce((sum, r) => sum + r.earnings, 0) +
                   chain.level3.reduce((sum, r) => sum + r.earnings, 0),
    level1Earnings: chain.level1.reduce((sum, r) => sum + r.earnings, 0),
    level2Earnings: chain.level2.reduce((sum, r) => sum + r.earnings, 0),
    level3Earnings: chain.level3.reduce((sum, r) => sum + r.earnings, 0)
  };

  return {
    chain,
    summary
  };
}

module.exports = router;