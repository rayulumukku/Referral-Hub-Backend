const mongoose = require('mongoose');

const followSchema = new mongoose.Schema({
  follower: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  following: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'blocked', 'muted'],
    default: 'active'
  },
  notifications: {
    type: Boolean,
    default: true
  },
  metadata: {
    deviceType: String,
    browser: String,
    location: {
      city: String,
      country: String
    },
    ipAddress: String
  }
}, {
  timestamps: true
});

// Compound index to prevent duplicate follows
followSchema.index({ follower: 1, following: 1 }, { unique: true });

// Indexes for efficient querying
followSchema.index({ follower: 1, status: 1 });
followSchema.index({ following: 1, status: 1 });
followSchema.index({ createdAt: -1 });

// Validation: Can't follow yourself
followSchema.pre('save', function(next) {
  if (this.follower.equals(this.following)) {
    next(new Error('Users cannot follow themselves'));
  } else {
    next();
  }
});

// Static method to toggle follow
followSchema.statics.toggleFollow = async function(followerId, followingId, metadata = {}) {
  if (followerId === followingId) {
    throw new Error('Users cannot follow themselves');
  }
  
  const existingFollow = await this.findOne({ 
    follower: followerId, 
    following: followingId 
  });
  
  if (existingFollow) {
    await existingFollow.deleteOne();
    
    // Update follower/following counts
    await this.updateUserCounts(followerId, followingId, -1);
    
    return { action: 'unfollowed', follow: null };
  } else {
    const newFollow = await this.create({
      follower: followerId,
      following: followingId,
      metadata
    });
    
    // Update follower/following counts
    await this.updateUserCounts(followerId, followingId, 1);
    
    return { action: 'followed', follow: newFollow };
  }
};

// Static method to update user follower/following counts
followSchema.statics.updateUserCounts = async function(followerId, followingId, delta) {
  const User = mongoose.model('User');
  
  // Update follower's following count
  await User.findByIdAndUpdate(followerId, { 
    $inc: { 'socialStats.followingCount': delta } 
  });
  
  // Update following's follower count
  await User.findByIdAndUpdate(followingId, { 
    $inc: { 'socialStats.followerCount': delta } 
  });
};

// Static method to check if user is following another
followSchema.statics.isFollowing = async function(followerId, followingId) {
  const follow = await this.findOne({ 
    follower: followerId, 
    following: followingId,
    status: 'active'
  });
  return !!follow;
};

// Static method to get mutual followers
followSchema.statics.getMutualFollowers = async function(userId1, userId2) {
  const user1Followers = await this.find({ following: userId1 }).select('follower');
  const user2Followers = await this.find({ following: userId2 }).select('follower');
  
  const user1FollowerIds = user1Followers.map(f => f.follower.toString());
  const user2FollowerIds = user2Followers.map(f => f.follower.toString());
  
  const mutualIds = user1FollowerIds.filter(id => user2FollowerIds.includes(id));
  
  return mutualIds;
};

// Static method to get follow suggestions (followers of followers)
followSchema.statics.getSuggestions = async function(userId, limit = 10) {
  const User = mongoose.model('User');
  
  // Get users that the current user is following
  const following = await this.find({ follower: userId }).select('following');
  const followingIds = following.map(f => f.following);
  
  // Get users that those users are following (exclude already following and self)
  const suggestions = await this.aggregate([
    { $match: { follower: { $in: followingIds } } },
    { $group: { _id: '$following', count: { $sum: 1 } } },
    { $match: { 
      _id: { 
        $nin: [...followingIds, new mongoose.Types.ObjectId(userId)] 
      } 
    }},
    { $sort: { count: -1 } },
    { $limit: limit }
  ]);
  
  // Populate user details
  const suggestedUserIds = suggestions.map(s => s._id);
  const users = await User.find({ _id: { $in: suggestedUserIds } })
    .select('username firstName lastName avatar socialStats')
    .lean();
  
  return users;
};

// Post-remove hook to update counts when unfollowing
followSchema.post('deleteOne', { document: true, query: false }, async function(doc) {
  if (doc.follower && doc.following) {
    await this.constructor.updateUserCounts(doc.follower, doc.following, -1);
  }
});

module.exports = mongoose.model('Follow', followSchema);

