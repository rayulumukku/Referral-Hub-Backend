const express = require('express');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

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

module.exports = router;