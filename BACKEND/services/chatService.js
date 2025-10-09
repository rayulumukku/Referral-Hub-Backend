const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const User = require('../models/User');

class ChatService {
  constructor() {
    this.io = null;
  }

  /**
   * Initialize Socket.IO instance
   */
  initialize(io) {
    this.io = io;
    this.setupSocketHandlers();
    console.log('✅ Chat Service initialized with Socket.IO');
  }

  /**
   * Setup Socket.IO event handlers for chat
   */
  setupSocketHandlers() {
    if (!this.io) return;

    this.io.on('connection', (socket) => {
      console.log(`Chat: User connected - ${socket.id}`);

      // Join conversation room
      socket.on('join_conversation', async (conversationId) => {
        socket.join(`conversation_${conversationId}`);
        console.log(`User ${socket.id} joined conversation ${conversationId}`);
        
        // Mark messages as read
        const userId = socket.handshake.auth?.userId;
        if (userId) {
          await this.markConversationAsRead(conversationId, userId);
        }
      });

      // Leave conversation room
      socket.on('leave_conversation', (conversationId) => {
        socket.leave(`conversation_${conversationId}`);
        console.log(`User ${socket.id} left conversation ${conversationId}`);
      });

      // User typing indicator
      socket.on('typing', ({ conversationId, userId, username }) => {
        socket.to(`conversation_${conversationId}`).emit('user_typing', {
          conversationId,
          userId,
          username
        });
      });

      // User stopped typing
      socket.on('stop_typing', ({ conversationId, userId }) => {
        socket.to(`conversation_${conversationId}`).emit('user_stop_typing', {
          conversationId,
          userId
        });
      });

      // Send message (handled via API, but can emit real-time)
      socket.on('send_message', async (messageData) => {
        try {
          const message = await this.sendMessage(messageData);
          this.emitNewMessage(message);
        } catch (error) {
          socket.emit('message_error', { error: error.message });
        }
      });

      socket.on('disconnect', () => {
        console.log(`Chat: User disconnected - ${socket.id}`);
      });
    });
  }

  /**
   * Create or get direct conversation
   */
  async getOrCreateDirectConversation(user1Id, user2Id) {
    try {
      const conversation = await Conversation.findOrCreateDirect(user1Id, user2Id);
      return conversation;
    } catch (error) {
      throw new Error(`Error getting/creating conversation: ${error.message}`);
    }
  }

  /**
   * Create group conversation
   */
  async createGroupConversation(creatorId, participants, name, description, avatar) {
    try {
      const participantsList = [
        { user: creatorId, role: 'owner' },
        ...participants.map(userId => ({ user: userId, role: 'member' }))
      ];

      const conversation = await Conversation.create({
        type: 'group',
        participants: participantsList,
        name,
        description,
        avatar,
        metadata: {
          createdBy: creatorId
        }
      });

      await conversation.populate('participants.user', 'username firstName lastName avatar');

      return conversation;
    } catch (error) {
      throw new Error(`Error creating group conversation: ${error.message}`);
    }
  }

  /**
   * Send message
   */
  async sendMessage(data) {
    try {
      const { conversationId, senderId, content, metadata } = data;

      // Verify conversation exists and user is participant
      const conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        throw new Error('Conversation not found');
      }

      if (!conversation.isParticipant(senderId)) {
        throw new Error('User is not a participant in this conversation');
      }

      // Create message
      const message = await Message.create({
        conversation: conversationId,
        sender: senderId,
        content,
        metadata
      });

      await message.populate('sender', 'username firstName lastName avatar');

      // Update conversation's last message
      await conversation.updateLastMessage(message._id);

      // Increment unread count for other participants
      for (const participant of conversation.participants) {
        if (participant.user.toString() !== senderId.toString() && !participant.leftAt) {
          await conversation.incrementUnreadCount(participant.user);
        }
      }

      // Emit real-time event
      this.emitNewMessage(message);

      return message;
    } catch (error) {
      throw new Error(`Error sending message: ${error.message}`);
    }
  }

  /**
   * Get conversation messages
   */
  async getConversationMessages(conversationId, options = {}) {
    try {
      const limit = options.limit || 50;
      const skip = options.skip || 0;
      const before = options.before; // Get messages before this message ID

      const query = { conversation: conversationId, isDeleted: false };
      
      if (before) {
        const beforeMessage = await Message.findById(before);
        if (beforeMessage) {
          query.createdAt = { $lt: beforeMessage.createdAt };
        }
      }

      const messages = await Message.find(query)
        .populate('sender', 'username firstName lastName avatar')
        .populate('replyTo')
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(skip)
        .lean();

      const total = await Message.countDocuments({ conversation: conversationId, isDeleted: false });

      return {
        messages: messages.reverse(), // Return in chronological order
        total,
        hasMore: total > skip + limit
      };
    } catch (error) {
      throw new Error(`Error getting messages: ${error.message}`);
    }
  }

  /**
   * Mark conversation as read
   */
  async markConversationAsRead(conversationId, userId) {
    try {
      const conversation = await Conversation.findById(conversationId);
      if (!conversation) return;

      // Reset unread count
      await conversation.resetUnreadCount(userId);

      // Mark all unread messages as read
      const unreadMessages = await Message.find({
        conversation: conversationId,
        sender: { $ne: userId },
        'readBy.user': { $ne: userId }
      });

      for (const message of unreadMessages) {
        await message.markAsRead(userId);
      }

      // Emit read receipt to other participants
      this.emitReadReceipt(conversationId, userId);

      return { success: true };
    } catch (error) {
      throw new Error(`Error marking conversation as read: ${error.message}`);
    }
  }

  /**
   * Delete message
   */
  async deleteMessage(messageId, userId) {
    try {
      const message = await Message.findById(messageId);
      
      if (!message) {
        throw new Error('Message not found');
      }

      if (message.sender.toString() !== userId.toString()) {
        throw new Error('Unauthorized to delete this message');
      }

      message.isDeleted = true;
      message.deletedAt = new Date();
      await message.save();

      // Emit message deleted event
      this.emitMessageDeleted(message.conversation, messageId);

      return { success: true };
    } catch (error) {
      throw new Error(`Error deleting message: ${error.message}`);
    }
  }

  /**
   * Delete message for specific user (soft delete)
   */
  async deleteMessageForUser(messageId, userId) {
    try {
      const message = await Message.findById(messageId);
      
      if (!message) {
        throw new Error('Message not found');
      }

      await message.deleteForUser(userId);

      return { success: true };
    } catch (error) {
      throw new Error(`Error deleting message for user: ${error.message}`);
    }
  }

  /**
   * Add reaction to message
   */
  async addReaction(messageId, userId, emoji) {
    try {
      const message = await Message.findById(messageId);
      
      if (!message) {
        throw new Error('Message not found');
      }

      await message.addReaction(userId, emoji);
      await message.populate('sender', 'username firstName lastName avatar');

      // Emit reaction event
      this.emitMessageReaction(message.conversation, messageId, userId, emoji);

      return message;
    } catch (error) {
      throw new Error(`Error adding reaction: ${error.message}`);
    }
  }

  /**
   * Get user conversations
   */
  async getUserConversations(userId, options = {}) {
    try {
      const conversations = await Conversation.getUserConversations(userId, options);

      // Add unread count for each conversation
      const conversationsWithUnread = conversations.map(conv => ({
        ...conv,
        unreadCount: conv.unreadCount?.get(userId.toString()) || 0
      }));

      return conversationsWithUnread;
    } catch (error) {
      throw new Error(`Error getting user conversations: ${error.message}`);
    }
  }

  /**
   * Add participant to group conversation
   */
  async addParticipant(conversationId, userId, addedBy) {
    try {
      const conversation = await Conversation.findById(conversationId);
      
      if (!conversation) {
        throw new Error('Conversation not found');
      }

      if (conversation.type !== 'group') {
        throw new Error('Can only add participants to group conversations');
      }

      await conversation.addParticipant(userId);
      await conversation.populate('participants.user', 'username firstName lastName avatar');

      // Emit participant added event
      this.emitParticipantAdded(conversationId, userId);

      return conversation;
    } catch (error) {
      throw new Error(`Error adding participant: ${error.message}`);
    }
  }

  /**
   * Remove participant from group conversation
   */
  async removeParticipant(conversationId, userId, removedBy) {
    try {
      const conversation = await Conversation.findById(conversationId);
      
      if (!conversation) {
        throw new Error('Conversation not found');
      }

      if (conversation.type !== 'group') {
        throw new Error('Can only remove participants from group conversations');
      }

      await conversation.removeParticipant(userId);

      // Emit participant removed event
      this.emitParticipantRemoved(conversationId, userId);

      return conversation;
    } catch (error) {
      throw new Error(`Error removing participant: ${error.message}`);
    }
  }

  /**
   * Socket.IO Emit Methods
   */

  emitNewMessage(message) {
    if (!this.io) return;
    
    this.io.to(`conversation_${message.conversation}`).emit('new_message', message);
  }

  emitReadReceipt(conversationId, userId) {
    if (!this.io) return;
    
    this.io.to(`conversation_${conversationId}`).emit('message_read', {
      conversationId,
      userId,
      readAt: new Date()
    });
  }

  emitMessageDeleted(conversationId, messageId) {
    if (!this.io) return;
    
    this.io.to(`conversation_${conversationId}`).emit('message_deleted', {
      conversationId,
      messageId
    });
  }

  emitMessageReaction(conversationId, messageId, userId, emoji) {
    if (!this.io) return;
    
    this.io.to(`conversation_${conversationId}`).emit('message_reaction', {
      conversationId,
      messageId,
      userId,
      emoji
    });
  }

  emitParticipantAdded(conversationId, userId) {
    if (!this.io) return;
    
    this.io.to(`conversation_${conversationId}`).emit('participant_added', {
      conversationId,
      userId
    });
  }

  emitParticipantRemoved(conversationId, userId) {
    if (!this.io) return;
    
    this.io.to(`conversation_${conversationId}`).emit('participant_removed', {
      conversationId,
      userId
    });
  }
}

module.exports = new ChatService();

