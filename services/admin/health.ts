/**
 * System Health Service
 * Comprehensive health checks for all system components.
 * Used by the system health API and admin dashboard.
 */

import { prisma } from "@/lib/prisma";
import { logger } from "@/bot/core/logger";
import { env } from "@/config";

const log = logger.child("admin-health");

export interface HealthCheckResult {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  uptime: number;
  version: string;
  checks: {
    database: ComponentHealth;
    openai: ComponentHealth;
    gemini: ComponentHealth;
    telegram: ComponentHealth;
    paymentProviders: ComponentHealth;
    memory: ComponentHealth;
  };
}

export interface ComponentHealth {
  status: "healthy" | "degraded" | "unhealthy";
  message: string;
  latency?: number;
}

export class SystemHealthService {
  private startTime = Date.now();

  /**
   * Run all health checks and return comprehensive result
   */
  async getFullHealth(): Promise<HealthCheckResult> {
    const [db, openai, gemini, telegram, payments, memory] =
      await Promise.all([
        this.checkDatabase(),
        this.checkOpenAI(),
        this.checkGemini(),
        this.checkTelegram(),
        this.checkPaymentProviders(),
        this.checkMemory(),
      ]);

    const checks = {
      database: db,
      openai,
      gemini,
      telegram,
      paymentProviders: payments,
      memory,
    };

    // Determine overall status
    const status: HealthCheckResult["status"] = Object.values(checks).some(
      (c) => c.status === "unhealthy"
    )
      ? "unhealthy"
      : Object.values(checks).some((c) => c.status === "degraded")
        ? "degraded"
        : "healthy";

    return {
      status,
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      version: "1.0.0",
      checks,
    };
  }

  /**
   * Quick health check (for load balancers)
   */
  async getQuickHealth(): Promise<{ status: string; uptime: number }> {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return {
        status: "ok",
        uptime: Math.floor((Date.now() - this.startTime) / 1000),
      };
    } catch {
      return { status: "error", uptime: 0 };
    }
  }

  /**
   * Get system resource usage
   */
  async getResourceUsage() {
    return {
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      node: process.version,
      platform: process.platform,
    };
  }

  // ─── Individual Checks ───────────────────────────

  private async checkDatabase(): Promise<ComponentHealth> {
    const start = Date.now();
    try {
      await prisma.$queryRaw`SELECT 1`;
      const latency = Date.now() - start;
      return {
        status: "healthy",
        message: `Database connected (${latency}ms)`,
        latency,
      };
    } catch (error) {
      return {
        status: "unhealthy",
        message: `Database connection failed: ${String(error).slice(0, 100)}`,
      };
    }
  }

  private async checkOpenAI(): Promise<ComponentHealth> {
    if (!env.OPENAI_API_KEY || env.OPENAI_API_KEY === "sk-dummy") {
      return {
        status: "degraded",
        message: "OpenAI API key not configured",
      };
    }
    return {
      status: "healthy",
      message: `OpenAI configured (model: ${env.OPENAI_MODEL})`,
    };
  }

  private async checkGemini(): Promise<ComponentHealth> {
    if (!env.GEMINI_API_KEY) {
      return {
        status: "degraded",
        message: "Gemini API key not configured",
      };
    }
    return {
      status: "healthy",
      message: `Gemini configured (model: ${env.GEMINI_MODEL})`,
    };
  }

  private async checkTelegram(): Promise<ComponentHealth> {
    if (!env.TELEGRAM_BOT_TOKEN) {
      return {
        status: "unhealthy",
        message: "Telegram bot token not configured",
      };
    }
    return {
      status: "healthy",
      message: "Telegram bot configured",
    };
  }

  private async checkPaymentProviders(): Promise<ComponentHealth> {
    if (!env.STRIPE_SECRET_KEY) {
      return {
        status: "degraded",
        message: "No payment providers configured. Set STRIPE_SECRET_KEY.",
      };
    }

    return {
      status: "healthy",
      message: "Stripe provider configured",
    };
  }

  private async checkMemory(): Promise<ComponentHealth> {
    const memoryUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024);

    if (heapUsedMB > heapTotalMB * 0.9) {
      return {
        status: "unhealthy",
        message: `Memory critical: ${heapUsedMB}MB / ${heapTotalMB}MB`,
      };
    }

    if (heapUsedMB > heapTotalMB * 0.7) {
      return {
        status: "degraded",
        message: `Memory high: ${heapUsedMB}MB / ${heapTotalMB}MB`,
      };
    }

    return {
      status: "healthy",
      message: `Memory: ${heapUsedMB}MB / ${heapTotalMB}MB`,
    };
  }
}

export const systemHealthService = new SystemHealthService();
