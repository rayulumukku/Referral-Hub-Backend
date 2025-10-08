const express = require('express');
const router = express.Router();
const User = require('../models/User');
const auth = require('../middleware/auth');

// Get all users (admin only or for super admin dashboard)
router.get('/', auth, async (req, res) => {
  try {
    // Check if user is admin or has sufficient permissions
    const requestingUser = await User.findById(req.user.id);
    
    if (!requestingUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // For now, allow all authenticated users to view user list (you can restrict this later)
    const users = await User.find()
      .select('-password') // Exclude password field
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      users,
      count: users.length
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      users: []
    });
  }
});

// Get specific user by ID
router.get('/:userId', auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId)
      .select('-password')
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      user
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;
