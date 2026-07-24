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
   */
  static getDegradedMaxTokens(requestedMaxTokens: number, attempt: number): number {
    const steps = aiConfig.getFallbackSteps(); // [6000, 4000, 3000, 2000, 1200, 800]
    
    // Find closest step <= requestedMaxTokens, or start from initial matching step
    let startIndex = steps.findIndex((step) => step <= requestedMaxTokens);
    if (startIndex === -1) startIndex = 0;

    const targetIndex = startIndex + attempt;
    if (targetIndex < steps.length) {
      return steps[targetIndex]!;
    }

    // Return smallest step if attempts exceed array length
    return steps[steps.length - 1]!;
  }
}
