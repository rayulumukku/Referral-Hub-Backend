const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['direct', 'group'],
    default: 'direct'
  },
  participants: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    role: {
      type: String,
      enum: ['member', 'admin', 'owner'],
      default: 'member'
    },
    joinedAt: {
      type: Date,
      default: Date.now
    },
    leftAt: Date,
    lastReadAt: Date,
    notificationsMuted: {
      type: Boolean,
      default: false
    }
  }],
  name: {
    type: String,
    trim: true
  },
  description: {
    type: String,
    maxlength: 500
  },
  avatar: String,
  lastMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  lastMessageAt: Date,
  unreadCount: {
    type: Map,
    of: Number,
    default: {}
  },
  isActive: {
    type: Boolean,
    default: true
  },
  metadata: {
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    isPinned: {
      type: Boolean,
      default: false
    },
    isArchived: {
      type: Boolean,
      default: false
    }
  }
}, {
  timestamps: true
});

// Indexes
conversationSchema.index({ 'participants.user': 1 });
conversationSchema.index({ type: 1 });
conversationSchema.index({ lastMessageAt: -1 });
conversationSchema.index({ isActive: 1 });

// Validation: Direct conversations must have exactly 2 participants
conversationSchema.pre('save', function(next) {
  if (this.type === 'direct' && this.participants.length !== 2) {
    next(new Error('Direct conversations must have exactly 2 participants'));
  } else {
    next();
  }
});

// Method to add participant
conversationSchema.methods.addParticipant = async function(userId, role = 'member') {
  const exists = this.participants.some(p => p.user.toString() === userId.toString());
  
  if (!exists) {
    this.participants.push({
      user: userId,
      role,
      joinedAt: new Date()
    });
    await this.save();
  }
};

// Method to remove participant
conversationSchema.methods.removeParticipant = async function(userId) {
  const participant = this.participants.find(p => p.user.toString() === userId.toString());
  
  if (participant) {
    participant.leftAt = new Date();
    await this.save();
  }
};

// Method to update last message
conversationSchema.methods.updateLastMessage = async function(messageId) {
  this.lastMessage = messageId;
  this.lastMessageAt = new Date();
  await this.save();
};

// Method to increment unread count for a user
conversationSchema.methods.incrementUnreadCount = async function(userId) {
  const currentCount = this.unreadCount.get(userId.toString()) || 0;
  this.unreadCount.set(userId.toString(), currentCount + 1);
  await this.save();
};

// Method to reset unread count for a user
conversationSchema.methods.resetUnreadCount = async function(userId) {
  this.unreadCount.set(userId.toString(), 0);
  await this.save();
};

// Method to check if user is participant
conversationSchema.methods.isParticipant = function(userId) {
  return this.participants.some(p => p.user.toString() === userId.toString() && !p.leftAt);
};

// Static method to find or create direct conversation
conversationSchema.statics.findOrCreateDirect = async function(user1Id, user2Id) {
  let conversation = await this.findOne({
    type: 'direct',
    'participants.user': { $all: [user1Id, user2Id] }
  }).populate('participants.user', 'username firstName lastName avatar');
  
  if (!conversation) {
    conversation = await this.create({
      type: 'direct',
      participants: [
        { user: user1Id, role: 'member' },
        { user: user2Id, role: 'member' }
      ],
      metadata: {
        createdBy: user1Id
      }
    });
    
    await conversation.populate('participants.user', 'username firstName lastName avatar');
  }
  
  return conversation;
};

// Static method to get user conversations
conversationSchema.statics.getUserConversations = async function(userId, options = {}) {
  const limit = options.limit || 20;
  const skip = options.skip || 0;
  
  const conversations = await this.find({
    'participants.user': userId,
    'participants.leftAt': { $exists: false },
    isActive: true
  })
    .populate('participants.user', 'username firstName lastName avatar')
    .populate('lastMessage')
    .sort({ lastMessageAt: -1 })
    .limit(limit)
    .skip(skip)
    .lean();
  
  return conversations;
};

module.exports = mongoose.model('Conversation', conversationSchema);

