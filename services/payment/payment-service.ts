/**
 * Payment Service
 * Orchestrates payment operations across providers.
 * The rest of the application should use this service,
 * never depending directly on payment providers.
 *
 * Flow:
 *   1. User selects plan → createPayment() → returns payment URL
 *   2. User completes payment on provider's page
 *   3. Provider sends webhook → verifyPayment() → activate subscription
 *   4. User checks status → getPayment() / getPaymentHistory()
 */

import { paymentRegistry, type PaymentProviderId } from "@/services/payment";
import { paymentRepository } from "@/repositories/payment";
import { subscriptionService } from "@/services/subscription";
import { logger } from "@/bot/core/logger";
import type { PlanId } from "@/config/plans";
import { SUBSCRIPTION_PLANS } from "@/config/plans";
import type {
  CreatePaymentRequest,
  CreatePaymentResponse,
} from "./interface";

const log = logger.child("payment-service");

// ─── Types ────────────────────────────────────────────

export interface PaymentSession {
  id: string;
  userId: number;
  provider: string;
  plan: string;
  amount: number;
  currency: string;
  transactionId: string | null;
  status: string;
  createdAt: Date;
  paidAt: Date | null;
  paymentUrl?: string;
  deepLink?: string;
}

export interface CreatePaymentInput {
  userId: number;
  telegramUserId: number;
  planId: PlanId;
  providerId: PaymentProviderId;
  successUrl?: string;
  cancelUrl?: string;
}

export interface VerifyPaymentInput {
  sessionId: string;
  transactionId?: string;
  signature?: string;
  rawData?: Record<string, unknown>;
}

// ─── Payment Service ──────────────────────────────────

class PaymentService {
  /**
   * Create a new payment session.
   * 
   * 1. Validates the plan exists and is active
   * 2. Gets the appropriate payment provider
   * 3. Creates a payment record in the database
   * 4. Calls the provider to create a checkout session
   * 5. Returns the payment URL/session info
   */
  async createPayment(input: CreatePaymentInput): Promise<{
    session: PaymentSession;
    paymentUrl?: string;
    deepLink?: string;
  }> {
    log.info("Creating payment", {
      userId: input.userId,
      planId: input.planId,
      providerId: input.providerId,
    });

    // Validate plan
    const plan = SUBSCRIPTION_PLANS[input.planId];
    if (!plan || !plan.isActive) {
      throw new Error(`Plan "${input.planId}" is not available`);
    }

    // Get payment provider
    const provider = paymentRegistry.getProvider(input.providerId);

    // Create payment record in DB (PENDING)
    const paymentRecord = await paymentRepository.create({
      userId: input.userId,
      provider: input.providerId,
      plan: input.planId,
      amount: plan.price.amount,
      currency: provider.config.supportedCurrencies[0] ?? "USD",
    });

    // Create payment session with provider
    let providerResponse: CreatePaymentResponse;
    try {
      providerResponse = await provider.createPayment({
        userId: input.userId,
        telegramUserId: input.telegramUserId,
        planId: input.planId,
        amount: plan.price.amount,
        currency: provider.config.supportedCurrencies[0] ?? "USD",
        description: `${plan.emoji} ${plan.name} — ${plan.description}`,
        successUrl: input.successUrl,
        cancelUrl: input.cancelUrl,
        metadata: {
          paymentId: paymentRecord.id,
          userId: String(input.userId),
          planId: input.planId,
        },
      });
    } catch (error) {
      // Mark payment as failed if provider call fails
      await paymentRepository.update(paymentRecord.id, {
        status: "FAILED",
        metadata: { error: String(error) },
      });
      log.error("Provider createPayment failed", {
        paymentId: paymentRecord.id,
        provider: input.providerId,
        error: String(error),
      });
      throw new Error(`Payment provider error: ${String(error)}`);
    }

    // Update payment record with provider session info
    await paymentRepository.update(paymentRecord.id, {
      transactionId: providerResponse.sessionId,
      metadata: { ...providerResponse.raw, sessionId: providerResponse.sessionId },
    });

    const session: PaymentSession = {
      id: paymentRecord.id,
      userId: input.userId,
      provider: input.providerId,
      plan: input.planId,
      amount: plan.price.amount,
      currency: provider.config.supportedCurrencies[0] ?? "USD",
      transactionId: providerResponse.sessionId,
      status: "PENDING",
      createdAt: paymentRecord.createdAt,
      paidAt: null,
      paymentUrl: providerResponse.paymentUrl,
      deepLink: providerResponse.deepLink,
    };

    log.info("Payment created successfully", {
      paymentId: session.id,
      sessionId: providerResponse.sessionId,
      provider: input.providerId,
    });

    return {
      session,
      paymentUrl: providerResponse.paymentUrl,
      deepLink: providerResponse.deepLink,
    };
  }

  /**
   * Verify a payment after webhook callback or user return.
   * 
   * 1. Looks up the payment record
   * 2. Asks the provider to verify the payment
   * 3. If verified, activates the subscription
   * 4. Updates payment status
   */
  async verifyPayment(input: VerifyPaymentInput): Promise<{
    verified: boolean;
    payment: PaymentSession;
  }> {
    log.info("Verifying payment", { sessionId: input.sessionId });

    // Look up payment by our payment ID or transaction ID
    let paymentRecord = await paymentRepository.findById(input.sessionId);
    if (!paymentRecord && input.transactionId) {
      paymentRecord = await paymentRepository.findByTransactionId(input.transactionId);
    }

    if (!paymentRecord) {
      log.error("Payment record not found for verification", {
        sessionId: input.sessionId,
        transactionId: input.transactionId,
      });
      throw new Error("Payment not found");
    }

    // Don't re-verify already succeeded payments
    if (paymentRecord.status === "SUCCESS") {
      log.info("Payment already verified as SUCCESS", { paymentId: paymentRecord.id });
      return {
        verified: true,
        payment: this.toSession(paymentRecord),
      };
    }

    // Get provider and verify
    const provider = paymentRegistry.getProvider(paymentRecord.provider as PaymentProviderId);

    let verified = false;
    try {
      const providerResponse = await provider.verifyPayment({
        sessionId: paymentRecord.transactionId ?? paymentRecord.id,
        transactionId: input.transactionId,
        signature: input.signature,
        rawData: input.rawData,
      });

      verified = providerResponse.verified;
    } catch (error) {
      log.error("Provider verifyPayment failed", {
        paymentId: paymentRecord.id,
        provider: paymentRecord.provider,
        error: String(error),
      });
      // Don't throw — update payment status and let caller handle
    }

    if (verified) {
      // Update payment as SUCCESS
      await paymentRepository.update(paymentRecord.id, {
        status: "SUCCESS",
        paidAt: new Date(),
        metadata: { ...((paymentRecord.metadata as Record<string, unknown>) ?? {}), verified: true },
      });

      // Activate subscription
      try {
        await subscriptionService.upgrade(
          paymentRecord.userId,
          paymentRecord.plan as PlanId,
          paymentRecord.id,
          paymentRecord.provider
        );
        log.info("Subscription activated after payment verification", {
          userId: paymentRecord.userId,
          planId: paymentRecord.plan,
          paymentId: paymentRecord.id,
        });
      } catch (error) {
        log.error("Failed to activate subscription after payment", {
          userId: paymentRecord.userId,
          paymentId: paymentRecord.id,
          error: String(error),
        });
        // Payment went through but subscription activation failed — log and continue
      }
    } else {
      await paymentRepository.update(paymentRecord.id, {
        status: "FAILED",
        metadata: { ...((paymentRecord.metadata as Record<string, unknown>) ?? {}), verified: false },
      });
    }

    paymentRecord = await paymentRepository.findById(paymentRecord.id);

    return {
      verified,
      payment: this.toSession(paymentRecord!),
    };
  }

  /**
   * Cancel a pending payment.
   */
  async cancelPayment(paymentId: string): Promise<PaymentSession> {
    log.info("Canceling payment", { paymentId });

    const paymentRecord = await paymentRepository.findById(paymentId);
    if (!paymentRecord) {
      throw new Error("Payment not found");
    }

    if (paymentRecord.status === "SUCCESS") {
      throw new Error("Cannot cancel a completed payment");
    }

    await paymentRepository.update(paymentId, {
      status: "CANCELED",
    });

    const updated = await paymentRepository.findById(paymentId);

    log.info("Payment canceled", { paymentId, userId: paymentRecord.userId });

    return this.toSession(updated!);
  }

  /**
   * Get a single payment by ID.
   */
  async getPayment(paymentId: string): Promise<PaymentSession | null> {
    const paymentRecord = await paymentRepository.findById(paymentId);
    if (!paymentRecord) return null;
    return this.toSession(paymentRecord);
  }

  /**
   * Get payment history for a user.
   */
  async getPaymentHistory(
    userId: number,
    limit = 20,
    offset = 0
  ): Promise<{
    payments: PaymentSession[];
    total: number;
    hasMore: boolean;
  }> {
    const [payments, total] = await Promise.all([
      paymentRepository.findByUserId(userId, limit, offset),
      paymentRepository.countByUserId(userId),
    ]);

    return {
      payments: payments.map((p) => this.toSession(p)),
      total,
      hasMore: offset + payments.length < total,
    };
  }

  /**
   * Get all payments for admin
   */
  async getAllPayments(limit = 50, offset = 0) {
    try {
      const { prisma } = await import("@/lib/prisma");
      const [payments, total] = await Promise.all([
        prisma.payment.findMany({
          orderBy: { createdAt: "desc" },
          take: limit,
          skip: offset,
          include: { user: { select: { id: true, firstName: true, username: true } } },
        }),
        prisma.payment.count(),
      ]);

      return { payments, total, hasMore: offset + payments.length < total };
    } catch (error) {
      log.error("Error getting all payments", { error: String(error) });
      return { payments: [], total: 0, hasMore: false };
    }
  }

  /**
   * Get payment statistics
   */
  async getPaymentStats() {
    return await paymentRepository.getStats();
  }

  /**
   * Convert raw DB payment record to a clean session object
   */
  private toSession(record: any): PaymentSession {
    return {
      id: record.id,
      userId: record.userId,
      provider: record.provider,
      plan: record.plan,
      amount: record.amount,
      currency: record.currency,
      transactionId: record.transactionId,
      status: record.status,
      createdAt: record.createdAt,
      paidAt: record.paidAt,
    };
  }
}

/** Singleton payment service instance */
export const paymentService = new PaymentService();
