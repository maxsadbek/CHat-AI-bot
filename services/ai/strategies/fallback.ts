/**
 * Automatic Fallback Strategy
 * Implements token step degradation (6000 -> 4000 -> 3000 -> 2000 -> 1200 -> 800)
 * and provider/model routing on status codes 402, 429, 500, 502, 503, 504.
 */

import { aiConfig } from "@/config/ai";
import { AIError } from "../types/errors";

export class FallbackStrategy {
  private static readonly RETRYABLE_STATUS_CODES = new Set([
    402, 429, 500, 502, 503, 504,
  ]);

  /**
   * Determines if an error triggers the automatic fallback strategy.
   */
  static isFallbackTrigger(error: AIError): boolean {
    if (error.retryable) return true;
    if (error.statusCode && this.RETRYABLE_STATUS_CODES.has(error.statusCode)) {
      return true;
    }
    return false;
  }

  /**
   * Get degraded maxTokens allocation for attempt step.
   *
   * With the optimized limits, the fallback steps are:
   *   [2000, 1400, 800, 600, 400]
   *
   * The function finds the first step <= requestedMaxTokens, then
   * applies the attempt offset to degrade further. If requested
   * tokens are below the smallest step, the smallest step is returned
   * unchanged (no point degrading below 400 tokens for quality generation).
   */
  static getDegradedMaxTokens(requestedMaxTokens: number, attempt: number): number {
    const steps = aiConfig.getFallbackSteps();
    
    // Find the first step that is <= requested tokens
    let startIndex = steps.findIndex((step) => step <= requestedMaxTokens);
    
    // If requested is lower than all steps, start from smallest step and don't degrade
    if (startIndex === -1) {
      return steps[steps.length - 1]!;
    }

    const targetIndex = startIndex + attempt;
    if (targetIndex < steps.length) {
      return steps[targetIndex]!;
    }

    // Don't degrade below the minimum step — preserve generation quality
    return steps[steps.length - 1]!;
  }
}
