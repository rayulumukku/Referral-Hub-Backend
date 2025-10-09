const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
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
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: 2000
  },
  parentComment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment',
    default: null
  },
  mentions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  images: [{
    type: String
  }],
  isEdited: {
    type: Boolean,
    default: false
  },
  editedAt: Date,
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: Date,
  metadata: {
    deviceType: String,
    browser: String,
    location: {
      city: String,
      country: String
    },
    ipAddress: String
  },
  // Engagement metrics
  likeCount: {
    type: Number,
    default: 0
  },
  replyCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
commentSchema.index({ post: 1, createdAt: -1 });
commentSchema.index({ author: 1 });
commentSchema.index({ parentComment: 1 });
commentSchema.index({ mentions: 1 });
commentSchema.index({ isDeleted: 1 });

// Virtual for replies
commentSchema.virtual('replies', {
  ref: 'Comment',
  localField: '_id',
  foreignField: 'parentComment'
});

// Virtual for likes
commentSchema.virtual('likes', {
  ref: 'Like',
  localField: '_id',
  foreignField: 'targetId',
  match: { targetType: 'comment' }
});

// Method to soft delete
commentSchema.methods.softDelete = async function() {
  this.isDeleted = true;
  this.deletedAt = new Date();
  await this.save();
};

// Method to update reply count
commentSchema.methods.updateReplyCount = async function() {
  const count = await this.constructor.countDocuments({ 
    parentComment: this._id, 
    isDeleted: false 
  });
  this.replyCount = count;
  await this.save();
};

// Method to update like count
commentSchema.methods.updateLikeCount = async function() {
  const Like = mongoose.model('Like');
  const count = await Like.countDocuments({ 
    targetType: 'comment',
    targetId: this._id 
  });
  this.likeCount = count;
  await this.save();
};

// Static method to get comment tree (with replies)
commentSchema.statics.getCommentTree = async function(postId, options = {}) {
  const limit = options.limit || 20;
  const skip = options.skip || 0;
  
  // Get top-level comments
  const comments = await this.find({ 
    post: postId, 
    parentComment: null,
    isDeleted: false 
  })
  .populate('author', 'username firstName lastName avatar')
  .sort({ createdAt: -1 })
  .limit(limit)
  .skip(skip)
  .lean();
  
  // Get replies for each comment (up to 3 levels deep)
  for (let comment of comments) {
    comment.replies = await this.find({ 
      parentComment: comment._id,
      isDeleted: false 
    })
    .populate('author', 'username firstName lastName avatar')
    .sort({ createdAt: 1 })
    .limit(5)
    .lean();
    
    // Get reply count
    comment.totalReplies = await this.countDocuments({ 
      parentComment: comment._id,
      isDeleted: false 
    });
  }
  
  return comments;
};

// Pre-save hook to extract mentions from content
commentSchema.pre('save', function(next) {
  if (this.isModified('content')) {
    // Extract @mentions from content
    const mentionRegex = /@(\w+)/g;
    const matches = this.content.match(mentionRegex);
    
    if (matches) {
      this.wasNew = this.isNew; // Store for post-save hook
      this.mentionUsernames = matches.map(m => m.substring(1)); // Remove @ symbol
    }
  }
  next();
});

// Post-save hook to update parent comment reply count
commentSchema.post('save', async function(doc) {
  if (doc.parentComment) {
    const parent = await this.constructor.findById(doc.parentComment);
    if (parent) {
      await parent.updateReplyCount();
    }
  }
  
  // Find mentioned users and convert usernames to IDs
  if (doc.mentionUsernames && doc.mentionUsernames.length > 0) {
    const User = mongoose.model('User');
    const users = await User.find({ 
      username: { $in: doc.mentionUsernames } 
    }).select('_id');
    
    if (users.length > 0) {
      doc.mentions = users.map(u => u._id);
      await doc.save();
    }
  }
});

module.exports = mongoose.model('Comment', commentSchema);
