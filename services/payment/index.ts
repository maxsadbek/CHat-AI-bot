/**
 * Payment Service Module
 * Central entry point for all payment functionality.
 * The rest of the application should only import from here.
 *
 * Providers:
 *   - Stripe (Global)
 *
 * Usage:
 *   import { paymentRegistry, paymentService } from "@/services/payment";
 *   const session = await paymentService.createPayment({ ... });
 */

export { paymentRegistry } from "./registry";
export { paymentService } from "./payment-service";
export type {
  PaymentProvider,
  PaymentProviderConfig,
  PaymentProviderId,
  PaymentStatus,
  CreatePaymentRequest,
  CreatePaymentResponse,
  VerifyPaymentRequest,
  VerifyPaymentResponse,
  RefundRequest,
  RefundResponse,
  WebhookEvent,
  WebhookResult,
  PaymentProviderDefinition,
} from "./interface";

export type {
  PaymentSession,
  CreatePaymentInput,
  VerifyPaymentInput,
} from "./payment-service";

// Provider classes (for direct instantiation in tests only)
export { StripeProvider } from "./providers/stripe";
