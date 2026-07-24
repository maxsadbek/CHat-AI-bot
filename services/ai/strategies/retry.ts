/**
 * Exponential Backoff with Jitter Retry Strategy
 * Ensures API endpoints are never spammed during rate limits or server degradation.
 */

import { aiConfig } from "@/config/ai";

export class RetryStrategy {
  /**
   * Calculate backoff delay in milliseconds for a given attempt index (0-indexed).
   */
  static getBackoffDelayMs(attempt: number): number {
    const policy = aiConfig.getRetryPolicy();
    // exponential backoff: base * (factor ^ attempt)
    const exponential = policy.initialBackoffMs * Math.pow(policy.backoffFactor, attempt);
    const capped = Math.min(policy.maxBackoffMs, exponential);

    if (policy.jitter) {
      // Full jitter algorithm: random value between 0 and capped delay
      return Math.floor(Math.random() * capped);
    }

    return capped;
  }

  /**
   * Asynchronously sleep for calculated backoff delay.
   */
  static async wait(attempt: number): Promise<void> {
    const delay = this.getBackoffDelayMs(attempt);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}
