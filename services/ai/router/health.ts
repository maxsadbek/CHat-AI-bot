/**
 * AI Router - Provider Health Checks
 * Tracks health status of each provider with consecutive failure counting
 * and automatic recovery after a cooldown period.
 */

import { providerRegistry } from "@/services/ai/providers/registry";
import { logger } from "@/bot/core/logger";
import type { AIProvider, ChatResponse } from "@/services/ai/providers/interface";
import type { ProviderHealth } from "./types";

const log = logger.child("router-health");

/** Default health check timeout in ms */
const HEALTH_CHECK_TIMEOUT = 10_000;

/** After this many consecutive failures, provider is marked unhealthy */
const UNHEALTHY_THRESHOLD = 3;

/** Cooldown period (ms) before retrying an unhealthy provider */
const RECOVERY_COOLDOWN = 60_000;

/** Cooldown period after 429 (ms) — 60 seconds */
const RATE_LIMIT_COOLDOWN = 60_000;

/** Interval (ms) between periodic health checks */
const PERIODIC_CHECK_INTERVAL = 120_000;

/** Simple health check prompt – very short to minimize cost */
const HEALTH_CHECK_PROMPT = "Reply with exactly one word: ok.";

export class HealthChecker {
  private healthMap: Map<string, ProviderHealth> = new Map();
  /** Tracks providers that received 429 — separate from general health */
  private rateLimitedUntil: Map<string, number> = new Map();
  private periodicTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.initHealthMap();
  }

  /** Initialize health map with all registered providers */
  private initHealthMap(): void {
    const allModels = providerRegistry.getAllModels();
    const seenProviders = new Set<string>();

    for (const model of allModels) {
      if (!seenProviders.has(model.provider)) {
        seenProviders.add(model.provider);
        this.healthMap.set(model.provider, {
          status: "healthy",
          lastChecked: 0,
          lastSuccess: 0,
          lastFailure: 0,
          consecutiveFailures: 0,
          latencyMs: 0,
        });
      }
    }
  }

  /** Start periodic health checks */
  startPeriodicChecks(): void {
    if (this.periodicTimer) return;
    this.periodicTimer = setInterval(() => {
      this.checkAllProviders().catch((err) => {
        log.error("Periodic health check error", { error: String(err) });
      });
    }, PERIODIC_CHECK_INTERVAL);
    log.info("Periodic health checks started", { intervalMs: PERIODIC_CHECK_INTERVAL });
  }

  /** Stop periodic health checks */
  stopPeriodicChecks(): void {
    if (this.periodicTimer) {
      clearInterval(this.periodicTimer);
      this.periodicTimer = null;
    }
  }

  /** Run a health check against a single provider */
  async checkProvider(providerId: string): Promise<ProviderHealth> {
    const startTime = Date.now();
    let status: ProviderHealth["status"] = "healthy";
    let errorMsg: string | undefined;
    let successTime = this.healthMap.get(providerId)?.lastSuccess ?? 0;
    let failureTime = this.healthMap.get(providerId)?.lastFailure ?? 0;
    let consecutiveFailures = this.healthMap.get(providerId)?.consecutiveFailures ?? 0;

    try {
      const provider = providerRegistry.getProviderById(providerId);

      // Run a quick health check request
      await this.runHealthCheck(provider);

      const latencyMs = Date.now() - startTime;
      successTime = Date.now();
      consecutiveFailures = 0;

      this.healthMap.set(providerId, {
        status: "healthy",
        lastChecked: Date.now(),
        lastSuccess: successTime,
        lastFailure: failureTime,
        consecutiveFailures: 0,
        latencyMs,
      });

      log.debug(`Health check passed for ${providerId}`, { latencyMs });
    } catch (err) {
      const latencyMs = Date.now() - startTime;
      failureTime = Date.now();
      consecutiveFailures++;

      status = consecutiveFailures >= UNHEALTHY_THRESHOLD ? "unhealthy" : "degraded";
      errorMsg = err instanceof Error ? err.message : String(err);

      this.healthMap.set(providerId, {
        status,
        lastChecked: Date.now(),
        lastSuccess: successTime,
        lastFailure: failureTime,
        consecutiveFailures,
        latencyMs,
        error: errorMsg,
      });

      log.warn(`Health check failed for ${providerId}`, {
        status,
        consecutiveFailures,
        error: errorMsg,
      });
    }

    return this.healthMap.get(providerId)!;
  }

  /** Run health checks for all providers */
  async checkAllProviders(): Promise<Map<string, ProviderHealth>> {
    const allModels = providerRegistry.getAllModels();
    const seenProviders = new Set<string>();
    const promises: Promise<ProviderHealth | void>[] = [];

    for (const model of allModels) {
      if (!seenProviders.has(model.provider)) {
        seenProviders.add(model.provider);
        promises.push(
          this.checkProvider(model.provider).catch((err) => {
            log.error(`Health check error for ${model.provider}`, { error: String(err) });
          })
        );
      }
    }

    await Promise.allSettled(promises);
    return this.healthMap;
  }

  /** Get health status for a specific provider */
  getHealth(providerId: string): ProviderHealth | undefined {
    const health = this.healthMap.get(providerId);
    if (!health) return undefined;

    // If unhealthy, check if cooldown has passed for automatic recovery
    if (health.status === "unhealthy") {
      const timeSinceFailure = Date.now() - health.lastFailure;
      if (timeSinceFailure > RECOVERY_COOLDOWN) {
        return { ...health, status: "degraded" }; // Allow retry
      }
    }

    return health;
  }

  /** Get health status for all providers */
  getAllHealth(): Map<string, ProviderHealth> {
    const result = new Map<string, ProviderHealth>();
    for (const [id] of this.healthMap) {
      const health = this.getHealth(id);
      if (health) result.set(id, health);
    }
    return result;
  }

  /** Record a successful call (stats tracking) */
  recordSuccess(providerId: string, latencyMs: number): void {
    const existing = this.healthMap.get(providerId);
    if (existing) {
      this.healthMap.set(providerId, {
        ...existing,
        status: "healthy",
        lastSuccess: Date.now(),
        lastChecked: Date.now(),
        consecutiveFailures: 0,
        latencyMs,
        error: undefined,
      });
    }
  }

  /** Record a failed call */
  recordFailure(providerId: string, error?: string): void {
    const existing = this.healthMap.get(providerId);
    if (existing) {
      const consecutiveFailures = existing.consecutiveFailures + 1;
      const status = consecutiveFailures >= UNHEALTHY_THRESHOLD ? "unhealthy" : "degraded";
      this.healthMap.set(providerId, {
        ...existing,
        status,
        lastFailure: Date.now(),
        lastChecked: Date.now(),
        consecutiveFailures,
        error: error || "Unknown error",
      });
    }
  }

  /** Check if a provider should be attempted (not unhealthy, not rate-limited, past cooldown) */
  shouldAttempt(providerId: string): boolean {
    // Check rate-limit cooldown first (429-specific, faster check)
    if (this.isRateLimited(providerId)) {
      return false;
    }

    const health = this.getHealth(providerId);
    if (!health) return true; // Unknown provider, allow attempt
    if (health.status === "healthy") return true;
    if (health.status === "degraded") return true; // Allow degraded providers
    // Unhealthy: only allow if cooldown passed
    return Date.now() - health.lastFailure > RECOVERY_COOLDOWN;
  }

  /**
   * Mark a provider as rate-limited (429). Sets a 60-second cooldown
   * during which no requests will be sent to this provider.
   */
  recordRateLimit(providerId: string): void {
    const cooldownUntil = Date.now() + RATE_LIMIT_COOLDOWN;
    this.rateLimitedUntil.set(providerId, cooldownUntil);

    // Also update general health
    const existing = this.healthMap.get(providerId);
    if (existing) {
      this.healthMap.set(providerId, {
        ...existing,
        status: "degraded",
        lastFailure: Date.now(),
        consecutiveFailures: existing.consecutiveFailures + 1,
        error: "Rate limited (429) — 60s cooldown",
      });
    }

    log.warn(`[HEALTH] ${providerId} rate-limited for 60s (until ${new Date(cooldownUntil).toISOString()})`);
  }

  /**
   * Check if a provider is currently in rate-limit cooldown.
   */
  isRateLimited(providerId: string): boolean {
    const cooldownUntil = this.rateLimitedUntil.get(providerId);
    if (!cooldownUntil) return false;
    if (Date.now() > cooldownUntil) {
      // Cooldown expired — remove and allow
      this.rateLimitedUntil.delete(providerId);
      return false;
    }
    return true;
  }

  /** Get remaining cooldown seconds for a rate-limited provider */
  getRateLimitCooldownRemaining(providerId: string): number {
    const cooldownUntil = this.rateLimitedUntil.get(providerId);
    if (!cooldownUntil) return 0;
    const remaining = Math.ceil((cooldownUntil - Date.now()) / 1000);
    return Math.max(0, remaining);
  }

  /** Run a single health check request against a provider */
  private async runHealthCheck(provider: AIProvider): Promise<ChatResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT);

    try {
      return await provider.chat({
        messages: [{ role: "user", content: HEALTH_CHECK_PROMPT }],
        maxTokens: 10,
        temperature: 0,
      });
    } finally {
      clearTimeout(timeout);
    }
  }
}

/** Singleton health checker instance */
export const healthChecker = new HealthChecker();
