const express = require('express');
const Referral = require('../models/Referral');
const User = require('../models/User');
const Post = require('../models/Post');
const Activity = require('../models/Activity');
const Notification = require('../models/Notification');

const router = express.Router();

// Get io instance from server.js
let io;
const setIoInstance = (ioInstance) => {
  io = ioInstance;
};

// Attach setIoInstance to router
router.setIoInstance = setIoInstance;

// Enhanced referral tracking endpoint
router.post('/track-referral', async (req, res) => {
  try {
    const {
      postId,
      referrerEmail, // dasaradharam109@gmail.com
      refereeEmail,  // ram@gmail.com
      platform,
      device,
      browser,
      location,
      coordinates,
      userAgent,
      screenSize,
      sessionId
    } = req.body;

    console.log('=== REFERRAL TRACKING STARTED ===');
    console.log('Post ID:', postId);
    console.log('Referrer Email:', referrerEmail);
    console.log('Referee Email:', refereeEmail);
    console.log('Platform:', platform);

    // Find or create referrer user
    let referrer = await User.findOne({ email: referrerEmail });
    if (!referrer) {
      console.log('Referrer not found, creating new user:', referrerEmail);
      referrer = new User({
        email: referrerEmail,
        username: referrerEmail.split('@')[0],
        type: 'individual',
        credits: 5,
        status: 'active'
      });
      await referrer.save();
    }

    // Find or create referee user
    let referee = await User.findOne({ email: refereeEmail });
    if (!referee) {
      console.log('Referee not found, creating new user:', refereeEmail);
      referee = new User({
        email: refereeEmail,
        username: refereeEmail.split('@')[0],
        type: 'individual',
        credits: 5,
        status: 'active',
        referrer: referrer._id // Set referrer relationship
      });
      await referee.save();
    }

    // Get post
    const post = await Post.findById(postId).populate('creator');
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // Check if referral already exists
    let existingReferral = await Referral.findOne({
      post: postId,
      referrer: referrer._id,
      referee: referee._id
    });

    if (existingReferral) {
      // Update existing referral
      existingReferral.engagement.totalClicks += 1;
      existingReferral.engagement.interactions.push({
        type: 'click',
        timestamp: new Date(),
        duration: 0
      });
      await existingReferral.save();
      
      console.log('Updated existing referral:', existingReferral._id);
    } else {
      // Create new referral
      const referral = new Referral({
        post: postId,
        referrer: referrer._id,
        referee: referee._id,
        level: 1,
        platform: platform || 'web',
        device: device || 'desktop',
        browser: browser || 'Unknown',
        userAgent: userAgent || 'Unknown',
        screenSize: screenSize || {},
        location: {
          latitude: coordinates?.latitude,
          longitude: coordinates?.longitude,
          city: location?.city,
          state: location?.state,
          country: location?.country,
          timezone: location?.timezone
        },
        coordinates,
        sessionId: sessionId || `session_${Date.now()}`,
        engagement: {
          totalClicks: 1,
          uniqueClicks: 1,
          shares: 0,
          interactions: [{
            type: 'click',
            timestamp: new Date(),
            duration: 0
          }]
        },
        chain: {
          position: 1,
          totalInChain: 1,
          chainId: `chain_${postId}_${referrer._id}`,
          isActive: true
        }
      });

      await referral.save();
      console.log('Created new referral:', referral._id);

      // Create activity record
      const activity = new Activity({
        type: 'referral_created',
        user: referrer._id,
        targetUser: referee._id,
        post: postId,
        referral: referral._id,
        details: {
          message: `${referrer.username} referred ${referee.username} to post: ${post.title}`,
          platform,
          location
        },
        metadata: {
          platform,
          device,
          browser,
          location,
          ipAddress: req.ip
        }
      });
      await activity.save();

      // Create notification for post creator
      const notification = new Notification({
        recipient: post.creator._id,
        type: 'referral_created',
        title: 'New Referral Created',
        message: `${referrer.username} referred ${referee.username} to your post: ${post.title}`,
        data: {
          postId,
          referralId: referral._id,
          referrerId: referrer._id,
          refereeId: referee._id
        }
      });
      await notification.save();

      // Emit real-time updates
      if (io) {
        // Emit to post creator
        io.to(`user_${post.creator._id}`).emit('referral_update', {
          type: 'new_referral',
          postId,
          referralId: referral._id,
          referrer: referrer.username,
          referee: referee.username,
          platform,
          location,
          timestamp: new Date()
        });

        // Emit to referrer
        io.to(`user_${referrer._id}`).emit('referral_update', {
          type: 'referral_created',
          postId,
          referralId: referral._id,
          referee: referee.username,
          platform,
          location,
          timestamp: new Date()
        });

        // Emit global analytics update
        io.emit('global_analytics_update', {
          type: 'new_referral',
          postId,
          timestamp: new Date()
        });
      }
    }

    // Update post analytics
    await Post.findByIdAndUpdate(postId, {
      $inc: { 
        'analytics.views': 1,
        'analytics.shares': 1
      },
      $addToSet: { 'analytics.uniqueViewers': referee._id }
    });

    console.log('=== REFERRAL TRACKING COMPLETED ===');

    res.json({
      success: true,
      message: 'Referral tracked successfully',
      referral: {
        id: existingReferral?._id || 'new',
        referrer: referrer.username,
        referee: referee.username,
        platform,
        timestamp: new Date()
      }
    });

  } catch (error) {
    console.error('Error tracking referral:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error tracking referral',
      error: error.message 
    });
  }
});

// Get user's referral network
router.get('/user-network/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Get user's direct referrals
    const directReferrals = await Referral.find({ referrer: userId })
      .populate('referee', 'username email type')
      .populate('post', 'title description')
      .sort({ createdAt: -1 });

    // Get user's referral analytics
    const analytics = {
      totalReferrals: directReferrals.length,
      totalClicks: directReferrals.reduce((sum, r) => sum + (r.engagement?.totalClicks || 0), 0),
      totalShares: directReferrals.reduce((sum, r) => sum + (r.engagement?.shares || 0), 0),
      conversions: directReferrals.filter(r => r.conversion?.converted).length,
      platforms: {},
      locations: {},
      devices: {}
    };

    // Process analytics data
    directReferrals.forEach(ref => {
      if (ref.platform) {
        analytics.platforms[ref.platform] = (analytics.platforms[ref.platform] || 0) + 1;
      }
      if (ref.location?.city) {
        const key = `${ref.location.city}, ${ref.location.state || ref.location.country}`;
        analytics.locations[key] = (analytics.locations[key] || 0) + 1;
      }
      if (ref.device) {
        analytics.devices[ref.device] = (analytics.devices[ref.device] || 0) + 1;
      }
    });

    res.json({
      referrals: directReferrals,
      analytics
    });

  } catch (error) {
    console.error('Error fetching user network:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get referral chain for a post
router.get('/post-chain/:postId', async (req, res) => {
  try {
    const { postId } = req.params;
    
    // Get all referrals for this post
    const referrals = await Referral.find({ post: postId })
      .populate('referrer', 'username email')
      .populate('referee', 'username email')
      .sort({ createdAt: 1 });

    // Build chain structure
    const chain = referrals.map((ref, index) => ({
      level: index + 1,
      referrer: ref.referrer,
      referee: ref.referee,
      platform: ref.platform,
      location: ref.location,
      timestamp: ref.createdAt,
      engagement: ref.engagement
    }));

    res.json({
      postId,
      chain,
      totalReferrals: referrals.length,
      totalClicks: referrals.reduce((sum, r) => sum + (r.engagement?.totalClicks || 0), 0)
    });

  } catch (error) {
    console.error('Error fetching post chain:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
