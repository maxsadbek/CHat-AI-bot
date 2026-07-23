/**
 * Payment Service Module
 * Central entry point for all payment functionality.
 * The rest of the application should only import from here.
 *
 * Providers:
 *   - Click (Uzbekistan)
 *   - Payme (Uzbekistan)
 *   - Stripe (Global)
 *   - Telegram Stars (Global — best for Telegram bots)
 *
 * Usage:
 *   import { paymentRegistry } from "@/services/payment";
 *   const provider = paymentRegistry.getProvider("stripe");
 *   const session = await provider.createPayment({ ... });
 */

export { paymentRegistry } from "./registry";
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

// Provider classes (for direct instantiation in tests only)
export { ClickProvider } from "./providers/click";
export { PaymeProvider } from "./providers/payme";
export { StripeProvider } from "./providers/stripe";
export { TelegramStarsProvider } from "./providers/telegram-stars";
