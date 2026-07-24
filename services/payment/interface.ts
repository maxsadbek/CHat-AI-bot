/**
 * Payment Service Interfaces
 * Defines the abstract payment provider interface that all
 * payment gateways (Click, Payme, Stripe, Telegram Stars, etc.)
 * must implement. The application never depends directly on a
 * specific payment provider.
 *
 * Architecture:
 *   PaymentProvider (interface)
 *     └── StripeProvider
 *
 *   PaymentRegistry (factory)
 *     └── paymentRegistry.getProvider("stripe")
 */

import type { PlanId } from "@/config/plans";

// ─── Payment Request / Response Types ─────────────────

export interface CreatePaymentRequest {
  /** Internal user ID */
  userId: number;
  /** Telegram user ID for user identification */
  telegramUserId: number;
  /** The plan being purchased */
  planId: PlanId;
  /** Price in USD cents (e.g., 999 = $9.99) */
  amount: number;
  /** ISO 4217 currency code */
  currency: string;
  /** Optional description shown on payment page */
  description?: string;
  /** URL to redirect after successful payment */
  successUrl?: string;
  /** URL to redirect if payment is cancelled */
  cancelUrl?: string;
  /** Arbitrary metadata to pass through the payment flow */
  metadata?: Record<string, string>;
}

export interface CreatePaymentResponse {
  /** Unique session ID for this payment attempt */
  sessionId: string;
  /** URL to redirect the user to for payment (optional — some providers use deep links) */
  paymentUrl?: string;
  /** Deep link URI for mobile apps (Telegram Stars, Click, etc.) */
  deepLink?: string;
  /** Provider-specific raw response data */
  raw?: Record<string, unknown>;
}

export interface VerifyPaymentRequest {
  /** Payment session ID from CreatePaymentResponse */
  sessionId: string;
  /** Provider-specific transaction ID */
  transactionId?: string;
  /** Provider-specific signature or token for verification */
  signature?: string;
  /** Raw callback data from the payment provider webhook */
  rawData?: Record<string, unknown>;
}

export interface VerifyPaymentResponse {
  /** Whether the payment was successfully verified */
  verified: boolean;
  /** Provider transaction ID */
  transactionId: string;
  /** Amount paid (in USD cents) */
  amount: number;
  /** Currency code */
  currency: string;
  /** Payment status */
  status: PaymentStatus;
  /** Provider-specific metadata */
  metadata?: Record<string, string>;
}

export interface RefundRequest {
  /** Provider transaction ID to refund */
  transactionId: string;
  /** Amount to refund in USD cents (null = full refund) */
  amount?: number;
  /** Reason for the refund */
  reason?: string;
}

export interface RefundResponse {
  /** Whether the refund was successful */
  success: boolean;
  /** Provider refund ID */
  refundId: string;
  /** Amount refunded in USD cents */
  amount: number;
}

export interface WebhookEvent {
  /** Raw request body from the webhook */
  body: unknown;
  /** Headers from the webhook request */
  headers: Record<string, string>;
  /** Provider-specific signature for verification */
  signature?: string;
}

export interface WebhookResult {
  /** Whether the webhook was processed successfully */
  processed: boolean;
  /** Type of event (e.g., "payment.succeeded", "payment.failed") */
  eventType: string;
  /** Extracted transaction ID */
  transactionId: string;
  /** Whether the subscription should be activated */
  shouldActivate: boolean;
  /** The plan ID if determinable from the webhook data */
  planId?: PlanId;
  /** The user ID if determinable from the webhook data */
  userId?: number;
}

// ─── Enums ────────────────────────────────────────────

export type PaymentProviderId = "stripe";

export type PaymentStatus =
  | "pending"
  | "processing"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "refunded"
  | "partially_refunded";

// ─── Provider Configuration ───────────────────────────

export interface PaymentProviderConfig {
  /** Unique provider identifier */
  id: PaymentProviderId;
  /** Human-readable display name */
  displayName: string;
  /** Whether this provider is currently active/enabled */
  enabled: boolean;
  /** Supported currencies (ISO 4217 codes) */
  supportedCurrencies: string[];
  /** Whether this provider supports webhook callbacks */
  supportsWebhooks: boolean;
  /** Whether this provider supports refunds */
  supportsRefunds: boolean;
  /** Whether this provider works via deep links (e.g., Telegram Stars) */
  usesDeepLinks: boolean;
  /** Provider-specific environment config keys */
  configKeys: string[];
  /** Countries/regions where this provider is available */
  availability: string[];
}

// ─── Payment Provider Interface ───────────────────────
// This is the ONLY interface the rest of the application
// should depend on. Never import specific providers directly.

export interface PaymentProvider {
  /** Provider identity and configuration */
  readonly config: PaymentProviderConfig;

  /** Provider name (e.g., "Stripe", "Telegram Stars") */
  readonly providerName: string;

  /**
   * Initialize the provider (validate config, setup client).
   * Called once when the provider is first loaded.
   */
  initialize(): Promise<void>;

  /**
   * Create a payment session / checkout URL.
   * The user is redirected to this URL to complete payment.
   */
  createPayment(request: CreatePaymentRequest): Promise<CreatePaymentResponse>;

  /**
   * Verify a payment after the user returns from the payment page.
   * Also used to validate webhook callbacks.
   */
  verifyPayment(request: VerifyPaymentRequest): Promise<VerifyPaymentResponse>;

  /**
   * Process an incoming webhook event from the payment provider.
   */
  handleWebhook(event: WebhookEvent): Promise<WebhookResult>;

  /**
   * Issue a refund for a completed payment.
   */
  refund(request: RefundRequest): Promise<RefundResponse>;

  /**
   * Check the health/connectivity of the payment provider.
   */
  healthCheck(): Promise<{ healthy: boolean; message: string }>;
}

// ─── Payment Registry ─────────────────────────────────

export interface PaymentProviderDefinition {
  id: PaymentProviderId;
  name: string;
  provider: PaymentProvider;
  enabled: boolean;
}
