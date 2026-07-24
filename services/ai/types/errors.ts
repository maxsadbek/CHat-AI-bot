/**
 * Unified AI Error Types
 * Standard error hierarchy across all AI operations and providers.
 */

export type AIErrorCode =
  | "TIMEOUT"
  | "PROVIDER_ERROR"
  | "RATE_LIMIT"
  | "CREDITS_EXHAUSTED"
  | "NETWORK_ERROR"
  | "VALIDATION_ERROR"
  | "UNKNOWN";

export class AIError extends Error {
  readonly code: AIErrorCode;
  readonly statusCode?: number;
  readonly provider?: string;
  readonly retryable: boolean;

  constructor(
    message: string,
    code: AIErrorCode = "UNKNOWN",
    options?: {
      statusCode?: number;
      provider?: string;
      retryable?: boolean;
      cause?: Error;
    }
  ) {
    super(message);
    this.name = "AIError";
    this.code = code;
    this.statusCode = options?.statusCode;
    this.provider = options?.provider;
    this.retryable = options?.retryable ?? false;
    if (options?.cause) {
      this.cause = options.cause;
    }
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class AITimeoutError extends AIError {
  constructor(message = "AI request timed out", provider?: string) {
    super(message, "TIMEOUT", { statusCode: 408, provider, retryable: true });
    this.name = "AITimeoutError";
  }
}

export class AIRateLimitError extends AIError {
  constructor(message = "Rate limit exceeded for AI provider", provider?: string) {
    super(message, "RATE_LIMIT", { statusCode: 429, provider, retryable: true });
    this.name = "AIRateLimitError";
  }
}

export class AICreditsError extends AIError {
  constructor(message = "Insufficient credits or payment required", provider?: string) {
    super(message, "CREDITS_EXHAUSTED", { statusCode: 402, provider, retryable: true });
    this.name = "AICreditsError";
  }
}

export class AINetworkError extends AIError {
  constructor(message = "Network error connecting to AI provider", statusCode = 500, provider?: string) {
    super(message, "NETWORK_ERROR", { statusCode, provider, retryable: true });
    this.name = "AINetworkError";
  }
}

export class AIProviderError extends AIError {
  constructor(message: string, statusCode = 500, provider?: string, retryable = false) {
    super(message, "PROVIDER_ERROR", { statusCode, provider, retryable });
    this.name = "AIProviderError";
  }
}

export class AIValidationError extends AIError {
  constructor(message: string) {
    super(message, "VALIDATION_ERROR", { statusCode: 400, retryable: false });
    this.name = "AIValidationError";
  }
}
