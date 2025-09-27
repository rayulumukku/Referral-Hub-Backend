const mongoose = require('mongoose');

const likeSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  post: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post',
    required: true,
  },
  type: {
    type: String,
    enum: ['like', 'love', 'laugh', 'angry', 'sad', 'wow'],
    default: 'like',
  },
  metadata: {
    platform: String,
    device: String,
    ipAddress: String,
    userAgent: String,
  },
}, {
  timestamps: true,
});

// Compound index to ensure one like per user per post
likeSchema.index({ user: 1, post: 1 }, { unique: true });
likeSchema.index({ post: 1, createdAt: -1 });

// Static method to toggle like
likeSchema.statics.toggleLike = async function(userId, postId, type = 'like') {
  const existingLike = await this.findOne({ user: userId, post: postId });

  if (existingLike) {
    // Remove like
    await this.deleteOne({ user: userId, post: postId });
    return { action: 'removed', like: null };
  } else {
    // Add like
    const like = new this({
      user: userId,
      post: postId,
      type,
      metadata: {
        platform: 'web',
        device: 'desktop',
      },
    });
    await like.save();
    return { action: 'added', like };
  }
};

// Static method to check if user liked post
likeSchema.statics.hasLiked = async function(userId, postId) {
  const like = await this.findOne({ user: userId, post: postId });
  return !!like;
};

// Static method to get like count for post
likeSchema.statics.getLikeCount = async function(postId) {
  return await this.countDocuments({ post: postId });
};

// Static method to get likes for post with user details
likeSchema.statics.getLikesForPost = async function(postId) {
  return await this.find({ post: postId })
    .populate('user', 'username')
    .sort({ createdAt: -1 });
};

module.exports = mongoose.model('Like', likeSchema);