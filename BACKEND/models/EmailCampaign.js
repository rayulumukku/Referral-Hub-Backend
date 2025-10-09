const mongoose = require('mongoose');

const emailCampaignSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  subject: {
    type: String,
    required: true,
    trim: true
  },
  content: {
    html: {
      type: String,
      required: true
    },
    text: String,
    template: String
  },
  sender: {
    name: {
      type: String,
      default: 'REF-HUB'
    },
    email: {
      type: String,
      default: 'noreply@ref-hub.com'
    }
  },
  recipients: {
    type: {
      type: String,
      enum: ['all', 'segment', 'custom'],
      default: 'all'
    },
    segment: {
      type: String,
      enum: ['all_users', 'premium_users', 'regular_users', 'active_users', 'inactive_users', 'custom'],
      default: 'all_users'
    },
    customQuery: mongoose.Schema.Types.Mixed,
    specificUsers: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    excludeUsers: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }]
  },
  schedule: {
    type: {
      type: String,
      enum: ['immediate', 'scheduled', 'recurring'],
      default: 'immediate'
    },
    scheduledAt: Date,
    recurring: {
      frequency: {
        type: String,
        enum: ['daily', 'weekly', 'monthly']
      },
      dayOfWeek: Number, // 0-6 for weekly
      dayOfMonth: Number, // 1-31 for monthly
      time: String // HH:MM format
    }
  },
  status: {
    type: String,
    enum: ['draft', 'scheduled', 'sending', 'sent', 'paused', 'cancelled'],
    default: 'draft'
  },
  stats: {
    totalRecipients: {
      type: Number,
      default: 0
    },
    sent: {
      type: Number,
      default: 0
    },
    delivered: {
      type: Number,
      default: 0
    },
    opened: {
      type: Number,
      default: 0
    },
    clicked: {
      type: Number,
      default: 0
    },
    bounced: {
      type: Number,
      default: 0
    },
    complained: {
      type: Number,
      default: 0
    },
    unsubscribed: {
      type: Number,
      default: 0
    }
  },
  emailsSent: [{
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    email: String,
    sentAt: Date,
    deliveredAt: Date,
    openedAt: Date,
    clickedAt: Date,
    status: {
      type: String,
      enum: ['sent', 'delivered', 'bounced', 'complained', 'opened', 'clicked'],
      default: 'sent'
    },
    error: String
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  tags: [{
    type: String,
    trim: true
  }],
  metadata: {
    trackOpens: {
      type: Boolean,
      default: true
    },
    trackClicks: {
      type: Boolean,
      default: true
    },
    attachments: [{
      filename: String,
      url: String,
      size: Number
    }],
    variables: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true
});

// Indexes
emailCampaignSchema.index({ status: 1 });
emailCampaignSchema.index({ createdBy: 1 });
emailCampaignSchema.index({ 'schedule.scheduledAt': 1 });
emailCampaignSchema.index({ tags: 1 });

// Method to update stats
emailCampaignSchema.methods.updateStats = async function() {
  this.stats.sent = this.emailsSent.filter(e => e.status === 'sent').length;
  this.stats.delivered = this.emailsSent.filter(e => e.status === 'delivered').length;
  this.stats.opened = this.emailsSent.filter(e => e.openedAt).length;
  this.stats.clicked = this.emailsSent.filter(e => e.clickedAt).length;
  this.stats.bounced = this.emailsSent.filter(e => e.status === 'bounced').length;
  
  await this.save();
};

// Method to mark email as opened
emailCampaignSchema.methods.markAsOpened = async function(userId) {
  const emailSent = this.emailsSent.find(e => e.recipient && e.recipient.toString() === userId.toString());
  
  if (emailSent && !emailSent.openedAt) {
    emailSent.openedAt = new Date();
    if (emailSent.status === 'delivered') {
      emailSent.status = 'opened';
    }
    await this.save();
    await this.updateStats();
  }
};

// Method to mark email as clicked
emailCampaignSchema.methods.markAsClicked = async function(userId) {
  const emailSent = this.emailsSent.find(e => e.recipient && e.recipient.toString() === userId.toString());
  
  if (emailSent && !emailSent.clickedAt) {
    emailSent.clickedAt = new Date();
    emailSent.status = 'clicked';
    await this.save();
    await this.updateStats();
  }
};

// Virtual for open rate
emailCampaignSchema.virtual('openRate').get(function() {
  if (this.stats.delivered === 0) return 0;
  return ((this.stats.opened / this.stats.delivered) * 100).toFixed(2);
});

// Virtual for click rate
emailCampaignSchema.virtual('clickRate').get(function() {
  if (this.stats.delivered === 0) return 0;
  return ((this.stats.clicked / this.stats.delivered) * 100).toFixed(2);
});

// Virtual for bounce rate
emailCampaignSchema.virtual('bounceRate').get(function() {
  if (this.stats.totalRecipients === 0) return 0;
  return ((this.stats.bounced / this.stats.totalRecipients) * 100).toFixed(2);
});

module.exports = mongoose.model('EmailCampaign', emailCampaignSchema);

