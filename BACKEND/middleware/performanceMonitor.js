const performanceMonitor = (req, res, next) => {
  const start = Date.now();
  const startMemory = process.memoryUsage();

  // Log slow requests
  const originalSend = res.send;
  res.send = function(data) {
    const duration = Date.now() - start;
    const endMemory = process.memoryUsage();
    const memoryDiff = endMemory.heapUsed - startMemory.heapUsed;

    // Log slow requests (> 2 seconds)
    if (duration > 2000) {
      console.warn(`SLOW REQUEST: ${req.method} ${req.originalUrl} took ${duration}ms, memory: ${Math.round(memoryDiff / 1024 / 1024)}MB`);
    }

    // Log very slow requests (> 10 seconds)
    if (duration > 10000) {
      console.error(`VERY SLOW REQUEST: ${req.method} ${req.originalUrl} took ${duration}ms, memory: ${Math.round(memoryDiff / 1024 / 1024)}MB`);
    }

    // Add performance headers for debugging
    res.setHeader('X-Response-Time', `${duration}ms`);
    res.setHeader('X-Memory-Usage', `${Math.round(memoryDiff / 1024 / 1024)}MB`);

    originalSend.call(this, data);
  };

  next();
};

module.exports = performanceMonitor;
