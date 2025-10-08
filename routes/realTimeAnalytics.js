const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

// Dummy endpoint to prevent 404
router.get('/user/:userId', auth, async (req, res) => {
  res.json({
    success: true,
    analytics: {
      activities: [],
      referrals: { made: [], received: [] }
    }
  });
});

module.exports = router;
