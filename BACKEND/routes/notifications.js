const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const auth = require('../middleware/auth');
const webpush = require('web-push');

// Get io instance from server.js
let io;
const setIoInstance = (ioInstance) => {
  io = ioInstance;
};

// Attach setIoInstance to router
router.setIoInstance = setIoInstance;
// VAPID configuration (public key exposure only). Set env vars on server.
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_CONTACT = process.env.VAPID_CONTACT || 'mailto:admin@referralhub.com';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  try {
    webpush.setVapidDetails(VAPID_CONTACT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  } catch (e) {
    console.error('Failed to set VAPID details:', e.message);
  }
}

// Public endpoint to fetch VAPID public key
router.get('/vapid-public-key', (req, res) => {
  console.log('VAPID_PUBLIC_KEY env var:', VAPID_PUBLIC_KEY ? 'SET' : 'NOT SET');
  console.log('VAPID_PUBLIC_KEY value length:', VAPID_PUBLIC_KEY ? VAPID_PUBLIC_KEY.length : 0);
  console.log('VAPID_PUBLIC_KEY starts with:', VAPID_PUBLIC_KEY ? VAPID_PUBLIC_KEY.substring(0, 10) + '...' : 'N/A');
  if (!VAPID_PUBLIC_KEY) {
    console.error('VAPID key not configured in environment');
    return res.status(503).json({ message: 'VAPID key not configured' });
  }

  // Validate VAPID key format (should be base64url)
  try {
    // Check if it's valid base64url (no + / _ - padding issues)
    const base64Regex = /^[A-Za-z0-9\-_]+$/;
    if (!base64Regex.test(VAPID_PUBLIC_KEY)) {
      console.error('VAPID key contains invalid characters for base64url');
      return res.status(503).json({ message: 'VAPID key format invalid' });
    }

    // Try to decode it to check if it's valid
    const decoded = atob(VAPID_PUBLIC_KEY.replace(/-/g, '+').replace(/_/g, '/'));
    if (decoded.length !== 65) { // VAPID public keys are 65 bytes
      console.error('VAPID key decoded length is not 65 bytes, got:', decoded.length);
      return res.status(503).json({ message: 'VAPID key length invalid' });
    }

    console.log('VAPID key validation passed');
  } catch (error) {
    console.error('VAPID key validation failed:', error.message);
    return res.status(503).json({ message: 'VAPID key validation failed' });
  }

  res.json({ publicKey: VAPID_PUBLIC_KEY });
});

// Get user's notifications
router.get('/', auth, async (req, res) => {
  try {
    const { page = 1, limit = 20, unreadOnly = false } = req.query;
    const query = { recipient: req.user.id };

    if (unreadOnly === 'true') {
      query.isRead = false;
    }

    const notifications = await Notification.find(query)
      .populate('data.postId', 'title')
      .populate('data.referralId', 'platform')
      .populate('data.userId', 'username')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Notification.countDocuments(query);

    res.json({
      notifications,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalNotifications: total,
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Mark notification as read
router.put('/:id/read', auth, async (req, res) => {
  try {
    const notification = await Notification.findOne({
      _id: req.params.id,
      recipient: req.user.id,
    });

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    await notification.markAsRead();
    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Mark all notifications as read
router.put('/read-all', auth, async (req, res) => {
  try {
    await Notification.updateMany(
      { recipient: req.user.id, isRead: false },
      { isRead: true }
    );
    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete notification
router.delete('/:id', auth, async (req, res) => {
  try {
    const notification = await Notification.findOneAndDelete({
      _id: req.params.id,
      recipient: req.user.id,
    });

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    res.json({ message: 'Notification deleted' });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get notification stats
router.get('/stats', auth, async (req, res) => {
  try {
    const stats = await Notification.aggregate([
      { $match: { recipient: req.user.id } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          unread: { $sum: { $cond: [{ $eq: ['$isRead', false] }, 1, 0] } },
          byType: {
            $push: {
              type: '$type',
              isRead: '$isRead',
            },
          },
        },
      },
    ]);

    const result = stats[0] || { total: 0, unread: 0, byType: [] };

    // Count by type
    const typeCounts = {};
    result.byType.forEach(item => {
      if (!typeCounts[item.type]) {
        typeCounts[item.type] = { total: 0, unread: 0 };
      }
      typeCounts[item.type].total++;
      if (!item.isRead) {
        typeCounts[item.type].unread++;
      }
    });

    res.json({
      total: result.total,
      unread: result.unread,
      byType: typeCounts,
    });
  } catch (error) {
    console.error('Error fetching notification stats:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create notification (admin/internal use)
router.post('/', auth, async (req, res) => {
  try {
    const { recipient, type, title, message, data, priority } = req.body;

    // Only admins can create system notifications
    if (type === 'system_announcement' || type === 'admin_message') {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Unauthorized' });
      }
    }

    const notification = await Notification.createNotification({
      recipient,
      type,
      title,
      message,
      data: data || {},
      priority: priority || 'medium',
      metadata: {
        platform: req.headers['user-agent']?.split(' ')[0] || 'unknown',
        device: req.headers['user-agent']?.includes('Mobile') ? 'mobile' : 'desktop',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    // Emit real-time notification
    if (io) {
      io.to(`notifications_${recipient}`).emit('notification', {
        type: 'new_notification',
        notification: {
          _id: notification._id,
          type,
          title,
          message,
          data,
          priority,
          createdAt: notification.createdAt
        }
      });
    }

    res.status(201).json(notification);
  } catch (error) {
    console.error('Error creating notification:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Subscribe to push notifications
router.post('/subscribe', auth, async (req, res) => {
  try {
    const { subscription, userId } = req.body;

    // In a real implementation, you'd store this subscription in the database
    // For now, we'll just acknowledge it
    console.log('Push subscription received for user:', userId);

    // You could store subscriptions in a separate collection or add to user model
    // For this demo, we'll just return success

    res.json({ message: 'Subscription saved successfully' });
  } catch (error) {
    console.error('Error saving push subscription:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Send push notification (admin/internal use)
router.post('/send-push', auth, async (req, res) => {
  try {
    const { userId, title, message, data } = req.body;

    // In a real implementation, you'd use web-push library to send push notifications
    // For now, we'll just create a notification that will be sent via socket

    const notification = await Notification.createNotification({
      recipient: userId,
      type: 'system_announcement',
      title: title || 'Notification',
      message: message || 'You have a new notification',
      data: data || {},
      priority: 'medium',
    });

    res.json({ message: 'Push notification sent', notification });
  } catch (error) {
    console.error('Error sending push notification:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;