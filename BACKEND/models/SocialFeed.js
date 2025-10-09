const mongoose = require('mongoose');

const socialFeedSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  post: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post',
    required: true
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  feedType: {
    type: String,
    enum: ['following', 'trending', 'recommended', 'nearby'],
    default: 'following'
  },
  priority: {
    type: Number,
    default: 0
  },
  engagement: {
    clicks: { type: Number, default: 0 },
    views: { type: Number, default: 0 },
    shares: { type: Number, default: 0 },
    timeSpent: { type: Number, default: 0 }
  },
  shown: {
    type: Boolean,
    default: false
  },
  shownAt: Date,
  dismissed: {
    type: Boolean,
    default: false
  },
  dismissedAt: Date
}, {
  timestamps: true
});

// Indexes for efficient querying
socialFeedSchema.index({ user: 1, post: 1 }, { unique: true });
socialFeedSchema.index({ user: 1, feedType: 1, priority: -1 });
socialFeedSchema.index({ user: 1, shown: 1 });
socialFeedSchema.index({ createdAt: -1 });
socialFeedSchema.index({ post: 1 });

// Static method to generate feed for a user
socialFeedSchema.statics.generateFeed = async function(userId, options = {}) {
  const Follow = mongoose.model('Follow');
  const Post = mongoose.model('Post');
  const User = mongoose.model('User');
  
  const limit = options.limit || 20;
  const feedType = options.feedType || 'following';
  
  let posts = [];
  
  if (feedType === 'following') {
    // Get posts from users that the current user is following
    const following = await Follow.find({ follower: userId }).select('following');
    const followingIds = following.map(f => f.following);
    
    posts = await Post.find({ 
      author: { $in: followingIds },
      status: 'active',
      isDeleted: { $ne: true }
    })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
  } else if (feedType === 'trending') {
    // Get trending posts (high engagement in last 24 hours)
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    posts = await Post.find({ 
      status: 'active',
      isDeleted: { $ne: true },
      createdAt: { $gte: yesterday }
    })
    .sort({ 
      'analytics.totalViews': -1, 
      'analytics.totalClicks': -1,
      'analytics.totalShares': -1
    })
    .limit(limit)
    .lean();
  } else if (feedType === 'recommended') {
    // Get posts based on user interests and engagement history
    const user = await User.findById(userId);
    
    posts = await Post.find({ 
      status: 'active',
      isDeleted: { $ne: true }
    })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
  } else if (feedType === 'nearby') {
    // Get posts from nearby users (based on location)
    const user = await User.findById(userId);
    
    if (user && user.location && user.location.city) {
      posts = await Post.find({ 
        status: 'active',
        isDeleted: { $ne: true },
        'location.city': user.location.city
      })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    }
  }
  
  // Create or update feed entries
  for (let post of posts) {
    await this.findOneAndUpdate(
      { user: userId, post: post._id },
      {
        user: userId,
        post: post._id,
        author: post.author,
        feedType,
        priority: Math.random() * 100 // Simple priority for now
      },
      { upsert: true, new: true }
    );
  }
  
  return posts;
};

// Static method to get personalized feed
socialFeedSchema.statics.getPersonalizedFeed = async function(userId, options = {}) {
  const limit = options.limit || 20;
  const skip = options.skip || 0;
  
  const feedItems = await this.find({ 
    user: userId,
    dismissed: false
  })
  .populate({
    path: 'post',
    populate: [
      { path: 'author', select: 'username firstName lastName avatar' }
    ]
  })
  .populate('author', 'username firstName lastName avatar')
  .sort({ priority: -1, createdAt: -1 })
  .limit(limit)
  .skip(skip)
  .lean();
  
  // Mark as shown
  const feedItemIds = feedItems.map(f => f._id);
  await this.updateMany(
    { _id: { $in: feedItemIds } },
    { shown: true, shownAt: new Date() }
  );
  
  return feedItems.map(f => f.post).filter(p => p !== null);
};

// Static method to mark post as dismissed
socialFeedSchema.statics.dismissPost = async function(userId, postId) {
  await this.findOneAndUpdate(
    { user: userId, post: postId },
    { dismissed: true, dismissedAt: new Date() }
  );
};

// Static method to track engagement
socialFeedSchema.statics.trackEngagement = async function(userId, postId, engagementType, value = 1) {
  const updateField = `engagement.${engagementType}`;
  
  await this.findOneAndUpdate(
    { user: userId, post: postId },
    { $inc: { [updateField]: value } }
  );
};

module.exports = mongoose.model('SocialFeed', socialFeedSchema);

