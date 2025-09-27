const express = require('express');
const User = require('../models/User');
const auth = require('../middleware/auth');
const multer = require('multer');
const path = require('path');

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

module.exports = router;