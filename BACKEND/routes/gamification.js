const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const GamificationService = require('../services/gamificationService');
const Badge = require('../models/Badge');
const User = require('../models/User');

// Initialize badges (admin only)
router.post('/initialize-badges', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    await GamificationService.initializeBadges();
    res.json({ message: 'Badges initialized successfully' });
  } catch (error) {
    console.error('Error initializing badges:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all badges
router.get('/badges', async (req, res) => {
  try {
    const badges = await Badge.find({ isActive: true }).sort({ rarity: -1, points: -1 });
    res.json(badges);
  } catch (error) {
    console.error('Error fetching badges:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get leaderboard
router.get('/leaderboard', async (req, res) => {
  try {
    const { type = 'points', period = 'all_time', limit = 10 } = req.query;
    const leaderboard = await GamificationService.getLeaderboard(type, period, parseInt(limit));
    res.json(leaderboard);
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user gamification stats
router.get('/stats', auth, async (req, res) => {
  try {
    const stats = await GamificationService.getUserStats(req.user.id);
    if (!stats) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(stats);
  } catch (error) {
    console.error('Error fetching user stats:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Check and award badges for user
router.post('/check-badges', auth, async (req, res) => {
  try {
    await GamificationService.checkAndAwardBadges(req.user.id);
    res.json({ message: 'Badge check completed' });
  } catch (error) {
    console.error('Error checking badges:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update user streak
router.post('/update-streak', auth, async (req, res) => {
  try {
    await GamificationService.updateStreak(req.user.id);
    res.json({ message: 'Streak updated' });
  } catch (error) {
    console.error('Error updating streak:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user's badges
router.get('/my-badges', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate('badges.badge');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      badges: user.badges,
      gamification: user.gamification,
    });
  } catch (error) {
    console.error('Error fetching user badges:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Award badge manually (admin only)
router.post('/award-badge', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { userId, badgeId } = req.body;

    const user = await User.findById(userId);
    const badge = await Badge.findById(badgeId);

    if (!user || !badge) {
      return res.status(404).json({ message: 'User or badge not found' });
    }

    // Check if already has badge
    const hasBadge = user.badges.some(b => b.badge.toString() === badgeId);
    if (hasBadge) {
      return res.status(400).json({ message: 'User already has this badge' });
    }

    // Award badge
    user.badges.push({
      badge: badgeId,
      earnedAt: new Date(),
    });

    user.gamification.totalPoints += badge.points;

    await user.save();

    // Send notification
    const NotificationService = require('../services/notificationService');
    await NotificationService.notifyBadgeEarned(user, badge.name);

    res.json({ message: 'Badge awarded successfully' });
  } catch (error) {
    console.error('Error awarding badge:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;