const mongoose = require('mongoose');

const referralChainSchema = new mongoose.Schema({
  post: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post',
    required: true,
    index: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  referrer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    index: true
  },
  parentChain: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ReferralChain',
    index: true
  },
  chainDepth: {
      type: Number,
    default: 0,
    index: true
    },
    platform: {
      type: String,
    enum: ['whatsapp', 'linkedin', 'twitter', 'facebook', 'instagram', 'telegram', 'email', 'sms', 'direct', 'other'],
    default: 'direct',
    index: true
    },
  deviceInfo: {
    type: {
      type: String,
      enum: ['mobile', 'tablet', 'desktop', 'unknown'],
      default: 'unknown'
    },
    brand: String,
    model: String,
    os: String,
    osVersion: String,
    browser: String,
    browserVersion: String,
    userAgent: String,
    screenResolution: {
      width: Number,
      height: Number
    },
    touchSupport: Boolean
  },
    location: {
      city: String,
      state: String,
      country: String,
    countryCode: String,
    timezone: String,
      coordinates: {
      lat: Number,
      lng: Number
    },
    accuracy: Number,
    ipAddress: String,
    isp: String
  },
  clickData: {
    timestamp: {
      type: Date,
      default: Date.now,
      index: true
    },
    sessionId: String,
    referrerUrl: String,
    landingUrl: String,
    utmSource: String,
    utmMedium: String,
    utmCampaign: String,
    utmTerm: String,
    utmContent: String
    },
    engagement: {
    timeSpent: Number, // seconds
    pagesViewed: Number,
    clickedElements: [String],
    scrollDepth: Number, // percentage
    interactionScore: Number, // 0-100
    converted: Boolean,
    conversionValue: Number
  },
  metadata: {
    networkType: String, // wifi, 4g, 5g, etc.
    batteryLevel: Number,
    online: Boolean,
    cookieEnabled: Boolean,
    language: String,
    languages: [String],
    colorDepth: Number,
    pixelRatio: Number
  },
  status: {
    type: String,
    enum: ['active', 'converted', 'abandoned', 'blocked'],
    default: 'active'
  }
}, {
  timestamps: true
});

// Compound indexes for efficient querying
referralChainSchema.index({ post: 1, createdAt: -1 });
referralChainSchema.index({ post: 1, chainDepth: 1 });
referralChainSchema.index({ post: 1, platform: 1 });
referralChainSchema.index({ post: 1, 'deviceInfo.type': 1 });
referralChainSchema.index({ post: 1, 'location.country': 1 });
referralChainSchema.index({ referrer: 1, createdAt: -1 });
referralChainSchema.index({ parentChain: 1 });

// Virtual for children
referralChainSchema.virtual('children', {
  ref: 'ReferralChain',
  localField: '_id',
  foreignField: 'parentChain'
});

// Method to get full chain path
referralChainSchema.methods.getChainPath = async function() {
  const path = [this];
  let current = this;
  
  while (current.parentChain) {
    current = await this.constructor.findById(current.parentChain)
      .populate('user', 'username firstName lastName avatar');
    if (current) {
      path.unshift(current);
    } else {
      break;
    }
  }
  
  return path;
};

// Method to get all descendants
referralChainSchema.methods.getDescendants = async function() {
  const descendants = [];
  
  async function traverse(chainId) {
    const children = await this.constructor.find({ parentChain: chainId })
      .populate('user', 'username firstName lastName avatar');
    
    for (const child of children) {
      descendants.push(child);
      await traverse(child._id);
    }
  }
  
  await traverse.call(this, this._id);
  return descendants;
};

// Static method to get tree structure for a post
referralChainSchema.statics.getTreeStructure = async function(postId) {
  // Get all chains for this post
  const chains = await this.find({ post: postId })
    .populate('user', 'username firstName lastName avatar')
    .populate('referrer', 'username firstName lastName avatar')
    .sort({ chainDepth: 1, createdAt: 1 })
    .lean();
  
  // Build tree structure
  const treeMap = new Map();
  const roots = [];
  
  chains.forEach(chain => {
    treeMap.set(chain._id.toString(), { ...chain, children: [] });
  });
  
  chains.forEach(chain => {
    if (chain.parentChain) {
      const parent = treeMap.get(chain.parentChain.toString());
      if (parent) {
        parent.children.push(treeMap.get(chain._id.toString()));
      }
    } else {
      roots.push(treeMap.get(chain._id.toString()));
    }
  });
  
  return roots;
};

// Static method to get hub-and-spoke data
referralChainSchema.statics.getHubAndSpokeData = async function(postId) {
  const Post = mongoose.model('Post');
  const post = await Post.findById(postId).populate('creator', 'username firstName lastName avatar location coordinates');
  
  if (!post) {
    throw new Error('Post not found');
  }
  
  const chains = await this.find({ post: postId })
    .populate('user', 'username firstName lastName avatar')
    .lean();
  
  // Hub (post creator)
  const hub = {
    id: post.creator._id,
    username: post.creator.username || post.creator.firstName,
    avatar: post.creator.avatar,
    coordinates: post.creator.coordinates || post.creator.location?.coordinates || { lat: 0, lng: 0 },
    type: 'hub',
    postTitle: post.title
  };
  
  // Spokes (all referrals)
  const spokes = chains.map(chain => ({
    id: chain._id,
    userId: chain.user?._id,
    username: chain.user?.username || chain.user?.firstName || 'Anonymous',
    avatar: chain.user?.avatar,
    coordinates: chain.location?.coordinates || { lat: 0, lng: 0 },
    platform: chain.platform,
    deviceType: chain.deviceInfo?.type || 'unknown',
    browser: chain.deviceInfo?.browser,
    city: chain.location?.city,
    country: chain.location?.country,
    timestamp: chain.clickData?.timestamp || chain.createdAt,
    chainDepth: chain.chainDepth,
    parentChainId: chain.parentChain,
    type: 'spoke'
  }));
  
  return { hub, spokes, totalSpokes: spokes.length };
};

// Static method to get analytics
referralChainSchema.statics.getAnalytics = async function(postId, timeRange) {
  const matchQuery = { post: new mongoose.Types.ObjectId(postId) };
  
  if (timeRange) {
    const now = new Date();
    let startDate;
    
    switch(timeRange) {
      case 'hour':
        startDate = new Date(now - 60 * 60 * 1000);
        break;
      case 'day':
        startDate = new Date(now - 24 * 60 * 60 * 1000);
        break;
      case 'week':
        startDate = new Date(now - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = null;
    }
    
    if (startDate) {
      matchQuery.createdAt = { $gte: startDate };
    }
  }
  
  const [
    totalClicks,
    platformBreakdown,
    deviceBreakdown,
    browserBreakdown,
    geographicBreakdown,
    topReferrers,
    timelineData,
    depthDistribution
  ] = await Promise.all([
    // Total clicks
    this.countDocuments(matchQuery),
    
    // Platform breakdown
    this.aggregate([
      { $match: matchQuery },
      { $group: { _id: '$platform', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]),
    
    // Device breakdown
    this.aggregate([
      { $match: matchQuery },
      { $group: { _id: '$deviceInfo.type', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]),
    
    // Browser breakdown
    this.aggregate([
      { $match: matchQuery },
      { $group: { _id: '$deviceInfo.browser', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]),
    
    // Geographic breakdown
    this.aggregate([
      { $match: matchQuery },
      { $group: { 
        _id: { 
          country: '$location.country', 
          city: '$location.city' 
        }, 
        count: { $sum: 1 },
        coordinates: { $first: '$location.coordinates' }
      }},
      { $sort: { count: -1 } },
      { $limit: 20 }
    ]),
    
    // Top referrers
    this.aggregate([
      { $match: { ...matchQuery, referrer: { $exists: true } } },
      { $group: { _id: '$referrer', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
      { $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'user'
      }},
      { $unwind: '$user' },
      { $project: {
        userId: '$_id',
        count: 1,
        username: '$user.username',
        firstName: '$user.firstName',
        lastName: '$user.lastName',
        avatar: '$user.avatar'
      }}
    ]),
    
    // Timeline data (hourly for day, daily for week/month)
    this.aggregate([
      { $match: matchQuery },
      { $group: {
        _id: {
          $dateToString: {
            format: timeRange === 'hour' || timeRange === 'day' ? '%Y-%m-%d %H:00' : '%Y-%m-%d',
            date: '$createdAt'
          }
        },
        count: { $sum: 1 }
      }},
      { $sort: { _id: 1 } }
    ]),
    
    // Chain depth distribution
    this.aggregate([
      { $match: matchQuery },
      { $group: { _id: '$chainDepth', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ])
  ]);
  
  return {
    totalClicks,
    platformBreakdown,
    deviceBreakdown,
    browserBreakdown,
    geographicBreakdown,
    topReferrers,
    timelineData,
    depthDistribution
  };
};

// Pre-save hook to calculate chain depth
referralChainSchema.pre('save', async function(next) {
  if (this.isNew && this.parentChain) {
    const parent = await this.constructor.findById(this.parentChain);
    if (parent) {
      this.chainDepth = parent.chainDepth + 1;
    }
  }
  next();
});

module.exports = mongoose.model('ReferralChain', referralChainSchema);
