const express = require('express');
const router = express.Router();
const Commission = require('../models/Commission');
const auth = require('../middleware/auth');

// Get user's commissions
router.get('/user/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;

    // Users can only view their own commissions (unless admin)
    if (req.user.id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const commissions = await Commission.find({ recipient: userId })
      .populate('post', 'title category price')
      .populate('recipient', 'username email')
      .sort({ createdAt: -1 })
      .limit(100);

    const totalEarned = commissions.reduce((sum, c) => sum + c.amount, 0);

    res.json({
      success: true,
      commissions,
      totalCommissions: commissions.length,
      totalEarned,
      stats: {
        pending: commissions.filter(c => c.status === 'pending').length,
        completed: commissions.filter(c => c.status === 'completed').length,
        failed: commissions.filter(c => c.status === 'failed').length
      }
    });
  } catch (error) {
    console.error('Error fetching commissions:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching commissions',
      error: error.message 
    });
  }
});

// Get all commissions (for admin dashboard)
router.get('/all', auth, async (req, res) => {
  try {
    const commissions = await Commission.find()
      .populate('recipient', 'username email')
      .populate('post', 'title category')
      .sort({ createdAt: -1 })
      .limit(200);

    const totalEarned = commissions.reduce((sum, c) => sum + c.amount, 0);

    res.json({
      success: true,
      commissions,
      totalCommissions: commissions.length,
      totalEarned
    });
  } catch (error) {
    console.error('Error fetching all commissions:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching commissions',
      error: error.message,
      commissions: []
    });
  }
});

module.exports = router;

