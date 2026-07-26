/**
 * AI Router - Re-exports
 *
 * Entry point that re-exports all router sub-modules used by core/executor.ts
 * and other parts of the system.
 *
 * The AIRouter class and generateAI facade were removed as dead code —
 * they were never imported outside this directory. The executor owns
 * failover/caching/health checks end-to-end via direct imports below.
 */

export * from "./types";
export * from "./route-planner";
export * from "./health";
export * from "./cache";
export * from "./usage-tracker";
