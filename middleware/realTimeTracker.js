const RealTimeAnalyticsService = require('../services/realTimeAnalyticsService');

// Middleware to automatically track and emit real-time updates
const realTimeTracker = (req, res, next) => {
  const originalSend = res.send;
  
  res.send = function(data) {
    // Emit real-time updates based on the endpoint
    const path = req.path;
    const method = req.method;
    const userId = req.user?.id;
    
    if (userId) {
      // Track different types of updates
      if (path.includes('/referrals') && method === 'POST') {
        // New referral created
        setTimeout(async () => {
          try {
            await RealTimeAnalyticsService.emitAnalyticsUpdate(userId, 'new_referral', {
              timestamp: new Date(),
              path,
              method
            });
          } catch (error) {
            console.error('Error emitting referral update:', error);
          }
        }, 100);
      }
      
      if (path.includes('/posts') && method === 'POST') {
        // New post created
        setTimeout(async () => {
          try {
            await RealTimeAnalyticsService.emitAnalyticsUpdate(userId, 'new_post', {
              timestamp: new Date(),
              path,
              method
            });
          } catch (error) {
            console.error('Error emitting post update:', error);
          }
        }, 100);
      }
      
      if (path.includes('/commissions') && method === 'POST') {
        // New commission created
        setTimeout(async () => {
          try {
            await RealTimeAnalyticsService.emitAnalyticsUpdate(userId, 'new_commission', {
              timestamp: new Date(),
              path,
              method
            });
          } catch (error) {
            console.error('Error emitting commission update:', error);
          }
        }, 100);
      }
      
      if (path.includes('/analytics')) {
        // Analytics data requested - emit update
        setTimeout(async () => {
          try {
            await RealTimeAnalyticsService.emitAnalyticsUpdate(userId, 'analytics_refresh', {
              timestamp: new Date(),
              path,
              method
            });
          } catch (error) {
            console.error('Error emitting analytics update:', error);
          }
        }, 100);
      }
    }
    
    // Call original send
    originalSend.call(this, data);
  };
  
  next();
};

module.exports = realTimeTracker;
