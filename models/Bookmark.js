const mongoose = require('mongoose');

const bookmarkSchema = new mongoose.Schema({
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
  collection: {
    type: String,
    default: 'default',
    maxlength: 50,
  },
  notes: {
    type: String,
    maxlength: 500,
  },
  tags: [{
    type: String,
    maxlength: 30,
  }],
  metadata: {
    platform: String,
    device: String,
    ipAddress: String,
    userAgent: String,
  },
}, {
  timestamps: true,
});

// Compound index to ensure one bookmark per user per post
bookmarkSchema.index({ user: 1, post: 1 }, { unique: true });
bookmarkSchema.index({ user: 1, collection: 1 });
bookmarkSchema.index({ user: 1, createdAt: -1 });

// Static method to toggle bookmark
bookmarkSchema.statics.toggleBookmark = async function(userId, postId, collection = 'default', notes = '', tags = []) {
  const existingBookmark = await this.findOne({ user: userId, post: postId });

  if (existingBookmark) {
    // Remove bookmark
    await this.deleteOne({ user: userId, post: postId });
    return { action: 'removed', bookmark: null };
  } else {
    // Add bookmark
    const bookmark = new this({
      user: userId,
      post: postId,
      collection,
      notes,
      tags,
      metadata: {
        platform: 'web',
        device: 'desktop',
      },
    });
    await bookmark.save();
    return { action: 'added', bookmark };
  }
};

// Static method to check if user bookmarked post
bookmarkSchema.statics.hasBookmarked = async function(userId, postId) {
  const bookmark = await this.findOne({ user: userId, post: postId });
  return !!bookmark;
};

// Static method to get user's bookmarks
bookmarkSchema.statics.getUserBookmarks = async function(userId, collection = null) {
  const query = { user: userId };
  if (collection) {
    query.collection = collection;
  }

  return await this.find(query)
    .populate('post')
    .sort({ createdAt: -1 });
};

// Static method to get user's bookmark collections
bookmarkSchema.statics.getUserCollections = async function(userId) {
  return await this.distinct('collection', { user: userId });
};

module.exports = mongoose.model('Bookmark', bookmarkSchema);