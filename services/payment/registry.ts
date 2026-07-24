/**
 * Payment Provider Registry & Factory
 * Central registry that resolves payment provider IDs to provider instances.
 * The rest of the application ONLY uses this — never imports specific providers directly.
 *
 * Usage:
 *   import { paymentRegistry } from "@/services/payment";
 *   const provider = paymentRegistry.getProvider("stripe");
 *   const session = await provider.createPayment({ ... });
 *
 * Architecture follows the same pattern as services/ai/providers/registry.ts
 */

import { logger } from "@/bot/core/logger";
import { StripeProvider } from "./providers/stripe";
import type {
  PaymentProvider,
  PaymentProviderId,
  CreatePaymentRequest,
  CreatePaymentResponse,
  VerifyPaymentRequest,
  VerifyPaymentResponse,
  RefundRequest,
  RefundResponse,
  WebhookEvent,
  WebhookResult,
} from "./interface";

const log = logger.child("payment-registry");

// ─── Provider Instance Cache ─────────────────────────
// Singleton pattern — providers are instantiated once

let _stripeProvider: StripeProvider | null = null;

function getStripe(): StripeProvider {
  if (!_stripeProvider) {
    _stripeProvider = new StripeProvider();
    log.info("Stripe provider instance created");
  }
  return _stripeProvider;
}

// ─── Provider Map ────────────────────────────────────
// Maps provider IDs to factory functions

const PROVIDER_MAP: Record<string, () => PaymentProvider> = {
  stripe: getStripe,
};

// ─── Payment Provider Registry ───────────────────────

class PaymentRegistry {
  /**
   * Get a payment provider by its ID.
   * This is the main entry point — the application never needs
   * to know which specific provider is being used.
   *
   * @example
 *   const provider = paymentRegistry.getProvider("stripe");
   */
  getProvider(providerId: PaymentProviderId): PaymentProvider {
    const factory = PROVIDER_MAP[providerId];
    if (!factory) {
      throw new Error(`Unknown payment provider: "${providerId}"`);
    }
    return factory();
  }

  /**
   * Get a provider by its ID string (runtime-safe)
   */
  getProviderById(providerId: string): PaymentProvider {
    return this.getProvider(providerId as PaymentProviderId);
  }

  /**
   * Get all registered payment providers
   */
  getAllProviders(): PaymentProvider[] {
    return Object.keys(PROVIDER_MAP).map((id) =>
      this.getProvider(id as PaymentProviderId)
    );
  }

  /**
   * Get all enabled payment providers
   */
  getEnabledProviders(): PaymentProvider[] {
    return this.getAllProviders().filter((p) => p.config.enabled);
  }

  /**
   * Get a provider that supports a given currency
   */
  getProviderByCurrency(currency: string): PaymentProvider | undefined {
    return this.getAllProviders().find((p) =>
      p.config.supportedCurrencies.includes(currency)
    );
  }

  /**
   * Initialize all enabled providers
   */
  async initializeAll(): Promise<void> {
    const providers = this.getAllProviders();
    for (const provider of providers) {
      try {
        await provider.initialize();
        log.info(`Provider "${provider.providerName}" initialized`);
      } catch (error) {
        log.error(`Failed to initialize provider "${provider.providerName}"`, {
          error: String(error),
        });
      }
    }
  }

  /**
   * Check if a provider ID is valid and registered
   */
  isValidProvider(providerId: string): boolean {
    return !!PROVIDER_MAP[providerId];
  }

  /**
   * Get provider config by ID
   */
  getProviderConfig(providerId: PaymentProviderId) {
    return this.getProvider(providerId).config;
  }

  /**
   * Get the preferred provider from a sorted list (first enabled wins).
   * Throws if no payment provider is configured.
   */
  getDefaultProvider(): PaymentProvider {
    const enabled = this.getEnabledProviders();
    if (enabled.length > 0) return enabled[0]!;
    throw new Error(
      "No payment providers are configured. Set at least one provider's environment variables (e.g., STRIPE_SECRET_KEY)."
    );
  }

  /**
   * Convenience — create payment through the best available provider
   */
  async createPayment(request: CreatePaymentRequest): Promise<CreatePaymentResponse> {
    const provider = this.getDefaultProvider();
    return provider.createPayment(request);
  }

  /**
   * Convenience — verify payment through a specific provider
   */
  async verifyPayment(
    providerId: PaymentProviderId,
    request: VerifyPaymentRequest
  ): Promise<VerifyPaymentResponse> {
    const provider = this.getProvider(providerId);
    return provider.verifyPayment(request);
  }

  /**
   * Convenience — process webhook through matching provider
   */
  async handleWebhook(
    providerId: PaymentProviderId,
    event: WebhookEvent
  ): Promise<WebhookResult> {
    const provider = this.getProvider(providerId);
    return provider.handleWebhook(event);
  }

  /**
   * Convenience — refund through specific provider
   */
  async refund(
    providerId: PaymentProviderId,
    request: RefundRequest
  ): Promise<RefundResponse> {
    const provider = this.getProvider(providerId);
    return provider.refund(request);
  }
}

/** Singleton payment registry instance */
export const paymentRegistry = new PaymentRegistry();
