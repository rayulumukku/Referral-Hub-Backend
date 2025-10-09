const mongoose = require('mongoose');

const likeSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  targetType: {
    type: String,
    enum: ['post', 'comment'],
    required: true
  },
  targetId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: 'targetType'
  },
  reactionType: {
    type: String,
    enum: ['like', 'love', 'wow', 'sad', 'angry', 'haha'],
    default: 'like'
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

// Compound index to prevent duplicate likes
likeSchema.index({ user: 1, targetType: 1, targetId: 1 }, { unique: true });

// Index for efficient querying
likeSchema.index({ targetType: 1, targetId: 1 });
likeSchema.index({ user: 1 });
likeSchema.index({ createdAt: -1 });

// Virtual for getting target (post or comment)
likeSchema.virtual('target', {
  refPath: 'targetType',
  localField: 'targetId',
  foreignField: '_id',
  justOne: true
});

// Method to toggle like
likeSchema.statics.toggleLike = async function(userId, targetType, targetId, reactionType = 'like', metadata = {}) {
  const existingLike = await this.findOne({ user: userId, targetType, targetId });
  
  if (existingLike) {
    // If same reaction, remove it (unlike)
    if (existingLike.reactionType === reactionType) {
      await existingLike.deleteOne();
      return { action: 'unliked', like: null };
    } else {
      // Change reaction type
      existingLike.reactionType = reactionType;
      existingLike.metadata = metadata;
      await existingLike.save();
      return { action: 'reacted', like: existingLike };
    }
  } else {
    // Create new like
    const newLike = await this.create({
      user: userId,
      targetType,
      targetId,
      reactionType,
      metadata
    });
    return { action: 'liked', like: newLike };
  }
};

// Method to get like counts for a target
likeSchema.statics.getLikeCounts = async function(targetType, targetId) {
  const counts = await this.aggregate([
    { $match: { targetType, targetId: new mongoose.Types.ObjectId(targetId) } },
    { $group: { _id: '$reactionType', count: { $sum: 1 } } }
  ]);
  
  const result = {
    total: 0,
    like: 0,
    love: 0,
    wow: 0,
    sad: 0,
    angry: 0,
    haha: 0
  };
  
  counts.forEach(item => {
    result[item._id] = item.count;
    result.total += item.count;
  });
  
  return result;
};

// Method to check if user liked a target
likeSchema.statics.hasUserLiked = async function(userId, targetType, targetId) {
  const like = await this.findOne({ user: userId, targetType, targetId });
  return like ? { hasLiked: true, reactionType: like.reactionType } : { hasLiked: false, reactionType: null };
};

module.exports = mongoose.model('Like', likeSchema);
