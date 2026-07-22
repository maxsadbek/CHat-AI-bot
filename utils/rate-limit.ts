/**
 * Simple in-memory rate limiter
 * Suitable for serverless with short-lived memory
 */
export class RateLimiter {
  private store: Map<string, { count: number; resetAt: number }> = new Map();

  constructor(
    private readonly maxRequests: number = 20,
    private readonly windowMs: number = 60_000
  ) {}

  /**
   * Check if a key is rate limited
   * @returns Whether the request is allowed and remaining count
   */
  check(key: string): { allowed: boolean; remaining: number; resetIn: number } {
    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry || now > entry.resetAt) {
      this.store.set(key, { count: 1, resetAt: now + this.windowMs });
      return { allowed: true, remaining: this.maxRequests - 1, resetIn: this.windowMs };
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

  /** Reset rate limit for a key */
  reset(key: string): void {
    this.store.delete(key);
  }

  /** Clean up expired entries */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.resetAt) {
        this.store.delete(key);
      }
    }
  }
}

// Global rate limiter instance
export const rateLimiter = new RateLimiter();
