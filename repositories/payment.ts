/**
 * Payment Repository
 * Data access layer for Payment model.
 */

import { prisma } from "@/lib/prisma";
import { logger } from "@/bot/core/logger";
import type { PaymentProviderId } from "@/services/payment/interface";

const log = logger.child("payment-repo");

export type PaymentStatus = "PENDING" | "SUCCESS" | "FAILED" | "CANCELED";

export interface CreatePaymentData {
  userId: number;
  provider: string;
  plan: string;
  amount: number;
  currency: string;
  transactionId?: string | null;
  status?: PaymentStatus;
  metadata?: Record<string, unknown> | null;
}

export interface UpdatePaymentData {
  transactionId?: string | null;
  status?: PaymentStatus;
  metadata?: Record<string, unknown> | null;
  paidAt?: Date | null;
}

export class PaymentRepository {
  /**
   * Create a new payment record
   */
  async create(data: CreatePaymentData) {
    try {
      return await prisma.payment.create({
        data: {
          userId: data.userId,
          provider: data.provider,
          plan: data.plan,
          amount: data.amount,
          currency: data.currency,
          transactionId: data.transactionId ?? null,
          status: data.status ?? "PENDING",
          metadata: (data.metadata ?? {}) as any,
        },
      });
    } catch (error) {
      log.error("Error creating payment", { userId: data.userId, error: String(error) });
      throw error;
    }
  }

  /**
   * Find payment by ID
   */
  async findById(id: string) {
    try {
      return await prisma.payment.findUnique({ where: { id } });
    } catch (error) {
      log.error("Error finding payment by id", { id, error: String(error) });
      throw error;
    }
  }

  /**
   * Find payment by transaction ID
   */
  async findByTransactionId(transactionId: string) {
    try {
      return await prisma.payment.findFirst({
        where: { transactionId },
      });
    } catch (error) {
      log.error("Error finding payment by transaction ID", {
        transactionId,
        error: String(error),
      });
      throw error;
    }
  }

  /**
   * Find payments by user ID, ordered by newest first
   */
  async findByUserId(userId: number, limit = 20, offset = 0) {
    try {
      return await prisma.payment.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      });
    } catch (error) {
      log.error("Error finding payments by user", { userId, error: String(error) });
      throw error;
    }
  }

  /**
   * Count payments by user ID
   */
  async countByUserId(userId: number): Promise<number> {
    try {
      return await prisma.payment.count({ where: { userId } });
    } catch (error) {
      log.error("Error counting payments by user", { userId, error: String(error) });
      throw error;
    }
  }

  /**
   * Find the most recent payment for a user by provider
   */
  async findRecentByUserAndProvider(userId: number, provider: string) {
    try {
      return await prisma.payment.findFirst({
        where: { userId, provider, status: "PENDING" },
        orderBy: { createdAt: "desc" },
      });
    } catch (error) {
      log.error("Error finding recent payment", { userId, provider, error: String(error) });
      throw error;
    }
  }

  /**
   * Update a payment record
   */
  async update(id: string, data: UpdatePaymentData) {
    try {
      return await prisma.payment.update({
        where: { id },
        data: {
          ...(data.transactionId !== undefined ? { transactionId: data.transactionId } : {}),
          ...(data.status !== undefined ? { status: data.status } : {}),
          ...(data.metadata !== undefined ? { metadata: data.metadata as any } : {}),
          ...(data.paidAt !== undefined ? { paidAt: data.paidAt } : {}),
        },
      });
    } catch (error) {
      log.error("Error updating payment", { id, error: String(error) });
      throw error;
    }
  }

  /**
   * Get payment statistics
   */
  async getStats() {
    try {
      const [total, byStatus, byProvider, totalRevenue] = await Promise.all([
        prisma.payment.count(),
        prisma.payment.groupBy({
          by: ["status"],
          _count: { id: true },
        }),
        prisma.payment.groupBy({
          by: ["provider"],
          _count: { id: true },
        }),
        prisma.payment.aggregate({
          _sum: { amount: true },
          where: { status: "SUCCESS" },
        }),
      ]);

      return {
        total,
        byStatus: byStatus.map((s: { status: string; _count: { id: number } }) => ({ status: s.status, count: s._count.id })),
        byProvider: byProvider.map((p: { provider: string; _count: { id: number } }) => ({ provider: p.provider, count: p._count.id })),
        totalRevenue: totalRevenue._sum.amount ?? 0,
      };
    } catch (error) {
      log.error("Error getting payment stats", { error: String(error) });
      return { total: 0, byStatus: [], byProvider: [], totalRevenue: 0 };
    }
  }
}

export const paymentRepository = new PaymentRepository();
