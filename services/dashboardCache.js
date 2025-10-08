// Simple in-memory cache for dashboard data
class DashboardCache {
  constructor() {
    this.cache = new Map();
    this.ttl = 5 * 60 * 1000; // 5 minutes TTL
  }

  set(userId, data) {
    this.cache.set(userId, {
      data,
      timestamp: Date.now()
    });
  }

  get(userId) {
    const cached = this.cache.get(userId);
    if (!cached) return null;

    // Check if expired
    if (Date.now() - cached.timestamp > this.ttl) {
      this.cache.delete(userId);
      return null;
    }

    return cached.data;
  }

  invalidate(userId) {
    this.cache.delete(userId);
  }

  clear() {
    this.cache.clear();
  }

  // Get cache stats
  getStats() {
    const now = Date.now();
    let expiredCount = 0;
    let validCount = 0;

    for (const [userId, cached] of this.cache.entries()) {
      if (now - cached.timestamp > this.ttl) {
        expiredCount++;
      } else {
        validCount++;
      }
    }

    return {
      totalEntries: this.cache.size,
      validEntries: validCount,
      expiredEntries: expiredCount,
      memoryUsage: process.memoryUsage().heapUsed
    };
  }
}

module.exports = new DashboardCache();
