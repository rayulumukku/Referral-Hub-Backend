const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  conversation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    text: {
      type: String,
      trim: true
    },
    type: {
      type: String,
      enum: ['text', 'image', 'file', 'audio', 'video', 'location'],
      default: 'text'
    },
    fileUrl: String,
    fileName: String,
    fileSize: Number,
    mimeType: String,
    thumbnailUrl: String,
    duration: Number, // For audio/video in seconds
    location: {
      latitude: Number,
      longitude: Number,
      address: String
    }
  },
  readBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    readAt: {
      type: Date,
      default: Date.now
    }
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
  deletedFor: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  reactions: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    emoji: String,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  metadata: {
    deviceType: String,
    browser: String,
    ipAddress: String
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
messageSchema.index({ conversation: 1, createdAt: -1 });
messageSchema.index({ sender: 1 });
messageSchema.index({ 'readBy.user': 1 });
messageSchema.index({ isDeleted: 1 });
messageSchema.index({ createdAt: -1 });

// Virtual for read status
messageSchema.virtual('isRead').get(function() {
  return this.readBy && this.readBy.length > 0;
});

// Method to soft delete for specific user
messageSchema.methods.deleteForUser = async function(userId) {
  if (!this.deletedFor.includes(userId)) {
    this.deletedFor.push(userId);
    await this.save();
  }
};

// Method to mark as read by user
messageSchema.methods.markAsRead = async function(userId) {
  const alreadyRead = this.readBy.some(r => r.user.toString() === userId.toString());
  
  if (!alreadyRead && this.sender.toString() !== userId.toString()) {
    this.readBy.push({
      user: userId,
      readAt: new Date()
    });
    await this.save();
  }
};

// Method to add reaction
messageSchema.methods.addReaction = async function(userId, emoji) {
  const existingReaction = this.reactions.find(r => r.user.toString() === userId.toString());
  
  if (existingReaction) {
    if (existingReaction.emoji === emoji) {
      // Remove reaction if same emoji
      this.reactions = this.reactions.filter(r => r.user.toString() !== userId.toString());
    } else {
      // Update emoji
      existingReaction.emoji = emoji;
    }
  } else {
    // Add new reaction
    this.reactions.push({ user: userId, emoji });
  }
  
  await this.save();
};

module.exports = mongoose.model('Message', messageSchema);

