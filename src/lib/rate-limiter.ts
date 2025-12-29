// src/lib/rate-limiter.ts
import type { RateLimitInfo } from '@/types/azure-tts';

interface RateLimitEntry {
  count: number;
  resetTime: number;
  windowStart: number;
}

export class RateLimiter {
  private storage: Map<string, RateLimitEntry> = new Map();
  private readonly windowMs: number;
  private readonly maxRequests: number;
  private readonly cleanupInterval: NodeJS.Timeout;

  constructor(windowMs: number = 60000, maxRequests: number = 100) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    
    // Clean up expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  /**
   * Check if a request is allowed
   */
  public isAllowed(identifier: string): { allowed: boolean; info: RateLimitInfo } {
    const now = Date.now();
    const windowStart = Math.floor(now / this.windowMs) * this.windowMs;
    const resetTime = windowStart + this.windowMs;

    let entry = this.storage.get(identifier);

    // Create new entry if doesn't exist or window has reset
    if (!entry || entry.windowStart < windowStart) {
      entry = {
        count: 0,
        resetTime,
        windowStart
      };
    }

    // Check if request is allowed
    if (entry.count >= this.maxRequests) {
      return {
        allowed: false,
        info: {
          remaining: 0,
          resetTime: entry.resetTime,
          limit: this.maxRequests
        }
      };
    }

    // Increment counter and save
    entry.count++;
    this.storage.set(identifier, entry);

    return {
      allowed: true,
      info: {
        remaining: this.maxRequests - entry.count,
        resetTime: entry.resetTime,
        limit: this.maxRequests
      }
    };
  }

  /**
   * Get current rate limit info for an identifier
   */
  public getInfo(identifier: string): RateLimitInfo {
    const now = Date.now();
    const windowStart = Math.floor(now / this.windowMs) * this.windowMs;
    const resetTime = windowStart + this.windowMs;

    const entry = this.storage.get(identifier);

    if (!entry || entry.windowStart < windowStart) {
      return {
        remaining: this.maxRequests,
        resetTime,
        limit: this.maxRequests
      };
    }

    return {
      remaining: Math.max(0, this.maxRequests - entry.count),
      resetTime: entry.resetTime,
      limit: this.maxRequests
    };
  }

  /**
   * Reset rate limit for an identifier
   */
  public reset(identifier: string): void {
    this.storage.delete(identifier);
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    
    for (const [key, entry] of this.storage.entries()) {
      if (entry.resetTime < now) {
        this.storage.delete(key);
      }
    }
  }

  /**
   * Destroy the rate limiter and clean up resources
   */
  public destroy(): void {
    clearInterval(this.cleanupInterval);
    this.storage.clear();
  }
}

// Different rate limiters for different endpoints
const rateLimiters = {
  // Individual TTS generation: 30 requests per minute
  generate: new RateLimiter(60000, 30),

  // Batch TTS generation: 5 requests per minute (more resource intensive)
  batch: new RateLimiter(60000, 5),

  // Audio retrieval: 200 requests per minute (less intensive)
  retrieve: new RateLimiter(60000, 200),

  // Auth endpoints: 5 attempts per minute (stricter for security)
  authLogin: new RateLimiter(60000, 5),

  // Signup: 3 attempts per minute (even stricter)
  authSignup: new RateLimiter(60000, 3),
};

export function getRateLimiter(type: 'generate' | 'batch' | 'retrieve' | 'authLogin' | 'authSignup'): RateLimiter {
  return rateLimiters[type];
}

/**
 * Get client identifier for rate limiting
 */
export function getClientIdentifier(request: Request): string {
  // Try to get IP from various headers (for deployment behind proxies)
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const cfConnectingIp = request.headers.get('cf-connecting-ip');
  
  // Use the first available IP
  const ip = forwarded?.split(',')[0].trim() || 
            realIp || 
            cfConnectingIp || 
            'unknown';
            
  return ip;
}

/**
 * Create rate limit headers for response
 */
export function createRateLimitHeaders(info: RateLimitInfo): Record<string, string> {
  return {
    'X-RateLimit-Limit': info.limit.toString(),
    'X-RateLimit-Remaining': info.remaining.toString(),
    'X-RateLimit-Reset': Math.ceil(info.resetTime / 1000).toString(),
  };
}