/**
 * Serverless-compatible Rate Limiter
 *
 * Uses Upstash Redis (serverless-friendly) as the primary backing store,
 * with an in-memory Map fallback when Redis is not configured.
 *
 * On Vercel serverless:
 *   - In-memory rate limits are per-instance and reset on cold starts,
 *     providing NO effective protection.
 *   - Redis-backed rate limits are global across all instances.
 *
 * When Redis is not configured, the limiter still works but logs a
 * warning at startup. Consider adding UPSTASH_REDIS_REST_URL and
 * UPSTASH_REDIS_REST_TOKEN to your environment variables.
 */

import { Redis } from "@upstash/redis";

export class RateLimiter {
  private store: Map<string, { count: number; resetAt: number }> = new Map();
  private redis: Redis | null = null;
  private redisAvailable = false;

  constructor(
    private readonly maxRequests: number = 20,
    private readonly windowMs: number = 60_000
  ) {
    // Try to initialize Upstash Redis
    const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
    const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (redisUrl && redisToken) {
      try {
        this.redis = new Redis({ url: redisUrl, token: redisToken });
        this.redisAvailable = true;
      } catch (error) {
        console.warn(
          "⚠️ [RATE_LIMITER] Failed to initialize Upstash Redis. " +
            "Falling back to in-memory rate limiting. " +
            "On serverless (Vercel), this provides NO effective protection across instances. " +
            `Error: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    } else {
      console.warn(
        "⚠️ [RATE_LIMITER] UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN not configured. " +
          "Rate limiting is falling back to in-memory store. " +
          "On serverless (Vercel) environments, this does NOT provide cross-instance protection. " +
          "Add UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN to your environment variables."
      );
    }
  }

  /**
   * Check if a key is rate limited
   * @returns Whether the request is allowed and remaining count
   */
  async check(
    key: string
  ): Promise<{ allowed: boolean; remaining: number; resetIn: number }> {
    if (this.redisAvailable && this.redis) {
      return this.checkRedis(key);
    }
    return this.checkMemory(key);
  }

  /**
   * Reset rate limit for a key
   */
  async reset(key: string): Promise<void> {
    if (this.redisAvailable && this.redis) {
      await this.redis.del(`ratelimit:${key}`);
    }
    this.store.delete(key);
  }

  /**
   * Clean up expired entries (memory only — Redis handles TTL automatically)
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.resetAt) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Redis-backed check using sliding window via INCR + EXPIRE
   */
  private async checkRedis(
    key: string
  ): Promise<{ allowed: boolean; remaining: number; resetIn: number }> {
    const redisKey = `ratelimit:${key}`;
    try {
      const count = await this.redis!.incr(redisKey);

      if (count === 1) {
        // First request in this window — set TTL
        await this.redis!.expire(redisKey, Math.ceil(this.windowMs / 1000));
        return {
          allowed: true,
          remaining: this.maxRequests - 1,
          resetIn: this.windowMs,
        };
      }

      const ttl = await this.redis!.ttl(redisKey);
      const remainingTtl = ttl > 0 ? ttl * 1000 : this.windowMs;

      if (count > this.maxRequests) {
        return {
          allowed: false,
          remaining: 0,
          resetIn: remainingTtl,
        };
      }

      return {
        allowed: true,
        remaining: this.maxRequests - count,
        resetIn: remainingTtl,
      };
    } catch (error) {
      // Redis failed — fall back to in-memory for this check
      console.warn(
        `[RATE_LIMITER] Redis check failed for key "${key}", falling back to memory: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return this.checkMemory(key);
    }
  }

  /**
   * In-memory check (per-instance, resets on cold start)
   */
  private checkMemory(
    key: string
  ): { allowed: boolean; remaining: number; resetIn: number } {
    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry || now > entry.resetAt) {
      this.store.set(key, { count: 1, resetAt: now + this.windowMs });
      return {
        allowed: true,
        remaining: this.maxRequests - 1,
        resetIn: this.windowMs,
      };
    }

    if (entry.count >= this.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetIn: entry.resetAt - now,
      };
    }

    entry.count++;
    return {
      allowed: true,
      remaining: this.maxRequests - entry.count,
      resetIn: entry.resetAt - now,
    };
  }
}

/**
 * Global rate limiter instance
 */
export const rateLimiter = new RateLimiter();
