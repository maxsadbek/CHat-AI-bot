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
import { ClickProvider } from "./providers/click";
import { PaymeProvider } from "./providers/payme";
import { StripeProvider } from "./providers/stripe";
import { TelegramStarsProvider } from "./providers/telegram-stars";
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

let _clickProvider: ClickProvider | null = null;
let _paymeProvider: PaymeProvider | null = null;
let _stripeProvider: StripeProvider | null = null;
let _telegramStarsProvider: TelegramStarsProvider | null = null;

function getClick(): ClickProvider {
  if (!_clickProvider) {
    _clickProvider = new ClickProvider();
    log.info("Click provider instance created");
  }
  return _clickProvider;
}

function getPayme(): PaymeProvider {
  if (!_paymeProvider) {
    _paymeProvider = new PaymeProvider();
    log.info("Payme provider instance created");
  }
  return _paymeProvider;
}

function getStripe(): StripeProvider {
  if (!_stripeProvider) {
    _stripeProvider = new StripeProvider();
    log.info("Stripe provider instance created");
  }
  return _stripeProvider;
}

function getTelegramStars(): TelegramStarsProvider {
  if (!_telegramStarsProvider) {
    _telegramStarsProvider = new TelegramStarsProvider();
    log.info("Telegram Stars provider instance created");
  }
  return _telegramStarsProvider;
}

// ─── Provider Map ────────────────────────────────────
// Maps provider IDs to factory functions

const PROVIDER_MAP: Record<string, () => PaymentProvider> = {
  click: getClick,
  payme: getPayme,
  stripe: getStripe,
  telegram_stars: getTelegramStars,
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
   *   const provider = paymentRegistry.getProvider("telegram_stars");
   *   const provider = paymentRegistry.getProvider("click");
   */
  getProvider(providerId: PaymentProviderId): PaymentProvider {
    const factory = PROVIDER_MAP[providerId];
    if (!factory) {
      log.warn(`Unknown payment provider "${providerId}", falling back to Telegram Stars`);
      return getTelegramStars();
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
   * Falls back to Stripe stub which returns a mock payment URL.
   * This ensures the "💳 Pay Now" button is always visible during development/stub mode.
   * In production, configure at least one real payment provider via environment variables.
   */
  getDefaultProvider(): PaymentProvider {
    const enabled = this.getEnabledProviders();
    if (enabled.length > 0) return enabled[0]!;
    // Stripe stub returns a mock payment URL so the payment flow displays the "💳 Pay Now" button.
    // TelegramStars and other UZ providers (Click/Payme) return undefined paymentUrl.
    return getStripe();
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
