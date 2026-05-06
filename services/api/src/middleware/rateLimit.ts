import type { Request, Response, NextFunction } from 'express';

// Simple in-memory rate limiter
// In production, use Redis-backed rate limiting

const requests = new Map<string, number[]>();
const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS = 100;

export function rateLimit(req: Request, res: Response, next: NextFunction) {
  const key = req.ip || 'unknown';
  const now = Date.now();
  
  // Get request timestamps for this key
  const timestamps = requests.get(key) || [];
  
  // Filter out timestamps outside the window
  const recentTimestamps = timestamps.filter(ts => now - ts < WINDOW_MS);
  
  if (recentTimestamps.length >= MAX_REQUESTS) {
    return res.status(429).json({
      error: 'Too many requests',
      retryAfter: Math.ceil((recentTimestamps[0] + WINDOW_MS - now) / 1000),
    });
  }
  
  // Add current timestamp
  recentTimestamps.push(now);
  requests.set(key, recentTimestamps);
  
  next();
}
