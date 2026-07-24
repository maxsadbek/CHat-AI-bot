/**
 * AI Error Normalization Utilities
 */

import {
  AIError,
  AITimeoutError,
  AIRateLimitError,
  AICreditsError,
  AINetworkError,
  AIProviderError,
  AIValidationError,
} from "../types/errors";

export function normalizeAIError(error: unknown, providerName = "UnknownProvider"): AIError {
  if (error instanceof AIError) {
    return error;
  }

  const errObj = error as any;
  const message = errObj?.message || String(error);
  const status = errObj?.status || errObj?.statusCode || errObj?.response?.status;

  if (status === 402 || message.includes("402") || message.toLowerCase().includes("credit") || message.toLowerCase().includes("billing")) {
    return new AICreditsError(message, providerName);
  }

  if (status === 429 || message.includes("429") || message.toLowerCase().includes("rate limit")) {
    return new AIRateLimitError(message, providerName);
  }

  if (status === 408 || message.toLowerCase().includes("timeout") || message.toLowerCase().includes("timed out")) {
    return new AITimeoutError(message, providerName);
  }

  if (status === 500 || status === 502 || status === 503 || status === 504 || [500, 502, 503, 504].some((s) => message.includes(String(s)))) {
    return new AINetworkError(message, status || 500, providerName);
  }

  if (status === 400 || status === 422) {
    return new AIValidationError(message);
  }

  return new AIProviderError(message, status || 500, providerName, true);
}
