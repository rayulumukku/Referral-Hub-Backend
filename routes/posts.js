const express = require('express');
const Post = require('../models/Post');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

// Create post
router.post('/', auth, async (req, res) => {
  try {
    const { title, description, category, price } = req.body;
    const user = await User.findById(req.user.id);

    // Check if user has credits (each credit = 1 post)
    if (user.credits < 1) {
      return res.status(400).json({ message: 'Insufficient credits. Each post requires 1 credit.' });
    }

    // Deduct 1 credit for post creation
    user.credits -= 1;
    await user.save();

    // Generate referral link
    const referralLink = `https://referralhub.com/post/${Date.now()}`;

    const post = new Post({
      creator: req.user.id,
      title,
      description,
      category,
      price,
      referralLink,
      creditsCost: 1000, // Points to be distributed on sale
    });

    await post.save();

    res.status(201).json(post);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all posts
router.get('/', async (req, res) => {
  try {
    const posts = await Post.find({ status: 'active' }).populate('creator', 'email type');
    res.json(posts);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Debug: Get all posts (including inactive) - for admin debugging
router.get('/debug', async (req, res) => {
  try {
    const allPosts = await Post.find({}).populate('creator', 'email type role');
    const activePosts = await Post.find({ status: 'active' }).populate('creator', 'email type role');
    const inactivePosts = await Post.find({ status: 'inactive' }).populate('creator', 'email type role');

    res.json({
      total: allPosts.length,
      active: activePosts.length,
      inactive: inactivePosts.length,
      allPosts: allPosts.map(p => ({
        id: p._id,
        title: p.title,
        creator: p.creator?.email,
        creatorRole: p.creator?.role,
        status: p.status,
        createdAt: p.createdAt
      }))
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user's posts
router.get('/my', auth, async (req, res) => {
  try {
    const posts = await Post.find({ creator: req.user.id });
    res.json(posts);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;