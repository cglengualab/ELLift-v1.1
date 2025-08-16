// api/rate-limit.js
// Simple in-memory rate limiting (resets when server restarts)
const rateLimit = new Map();

export function checkRateLimit(ip, maxRequests = 5, windowMs = 60000) {
  const now = Date.now();
  const userRequests = rateLimit.get(ip) || [];
  
  // Remove old requests outside the time window
  const validRequests = userRequests.filter(time => now - time < windowMs);
  
  // Check if user has exceeded limit
  if (validRequests.length >= maxRequests) {
    return {
      allowed: false,
      resetTime: Math.min(...validRequests) + windowMs,
      remaining: 0
    };
  }
  
  // Add current request
  validRequests.push(now);
  rateLimit.set(ip, validRequests);
  
  return {
    allowed: true,
    remaining: maxRequests - validRequests.length,
    resetTime: now + windowMs
  };
}

export function getRealIP(req) {
  return req.headers['x-forwarded-for'] || 
         req.headers['x-real-ip'] || 
         req.connection?.remoteAddress || 
         'unknown';
}
