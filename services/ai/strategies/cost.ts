/**
 * Cost Optimization Strategy
 *
 * Dynamically allocates maxTokens based on:
 * - Prompt complexity (length + structural indicators like code blocks, lists)
 * - Feature type (video/coding need more than chat/translate)
 * - User plan (FREE gets base, PREMIUM+ gets scaled)
 * - Model max output capability (never exceed the provider's limit)
 *
 * Design principle: longer/complex prompts get more output tokens because
 * they require more detailed responses.  Simple greetings get the minimum.
 */

import { aiConfig, FeatureType, PlanType } from "@/config/ai";

/**
 * Complexity indicators that suggest the AI needs more output tokens.
 * Code blocks, numbered lists, bullet points, tables, and long paragraphs
 * all require more generation capacity.
 */
const COMPLEXITY_PATTERNS = [
  /```[\s\S]*?```/g,           // Code blocks
  /^#{1,6}\s/m,                 // Markdown headings
  /\|\s*[-:]+\s*\|/m,           // Tables
  /^\d+\.\s/m,                  // Numbered lists
  /^[-*+]\s/m,                  // Bullet lists
  /\[.*\]\(.*\)/g,              // Links
  /\n{2,}/g,                    // Paragraph breaks (multiple = long text)
];

export class CostOptimizationStrategy {
  /**
   * Estimate token count of text.
   * Uses 3.8 chars per token (empirical average for mixed text/code).
   */
  static estimateTokenCount(text: string): number {
    if (!text) return 0;
    // More precise: count words and estimate 1.3 tokens per word
    const words = text.trim().split(/\s+/).length;
    const chars = text.length;
    return Math.max(Math.ceil(words * 1.3), Math.ceil(chars / 3.8));
  }

  /**
   * Analyze prompt to determine its complexity level.
   * Returns a score from 0 (simple) to 3 (very complex).
   */
  static analyzeComplexity(prompt: string): number {
    if (!prompt || prompt.length < 10) return 0;

    let score = 0;

    // Length-based complexity
    if (prompt.length > 2000) score += 1;
    if (prompt.length > 5000) score += 1;
    if (prompt.length > 10000) score += 1;

    // Structural complexity from patterns
    for (const pattern of COMPLEXITY_PATTERNS) {
      const matches = prompt.match(pattern);
      if (matches && matches.length > 0) {
        score += Math.min(matches.length, 2);
      }
    }

    // Cap at 3
    return Math.min(score, 3);
  }

  /**
   * Get feature weight multiplier.
   * Video and Coding need the most output tokens.
   * Chat and Translate need the least.
   */
  static getFeatureWeight(feature: FeatureType): number {
    const weights: Record<FeatureType, number> = {
      chat: 1.0,
      translate: 0.8,
      image: 1.2,
      social: 1.2,
      business: 1.5,
      video: 2.0,
      coding: 2.5,
    };
    return weights[feature] ?? 1.0;
  }

  /**
   * Dynamically calculate optimised maxTokens for a request.
   *
   * Algorithm:
   *   1. Start with the plan/feature base from AIConfig.
   *   2. Scale up based on prompt complexity (0–3 scale).
   *   3. Apply feature weight multiplier.
   *   4. Clamp to the configured maximum for the plan/feature.
   *   5. Never exceed the model's maxOutputTokens capability.
   *
   * This ensures:
   *   - Simple "hello" → minimum tokens (cost efficient)
   *   - Long code prompt → maximum allowed (quality preserved)
   *   - Provider limits are always respected (no 400 errors)
   */
  static resolveMaxTokens(
    feature: FeatureType,
    plan?: string | PlanType,
    userPrompt?: string,
    modelMaxOutput?: number
  ): number {
    const promptText = userPrompt || "";
    const promptTokens = this.estimateTokenCount(promptText);
    const baseTokens = aiConfig.getMaxTokens(feature, plan, promptTokens);

    // ── Complexity scaling ─────────────────────────────────────────
    const complexity = this.analyzeComplexity(promptText);
    const featureWeight = this.getFeatureWeight(feature);

    // Scale factor: 1.0 (simple) to ~2.5 (very complex) adjusted by feature weight
    const scaleFactor = 1.0 + (complexity / 3) * (featureWeight - 1.0);

    // Get the plan's maximum (hard ceiling per plan-feature)
    const planType = plan ? (typeof plan === "string" ? plan.toUpperCase() as PlanType : plan) : "FREE";
    const policy = aiConfig.getConfigData().tokenPolicies[feature]?.[planType];
    const planMax = policy?.max ?? baseTokens;

    let scaledTokens = Math.round(baseTokens * scaleFactor);

    // Clamp to plan max
    scaledTokens = Math.min(scaledTokens, planMax);

    // Never exceed model's max output capability
    if (modelMaxOutput && modelMaxOutput > 0) {
      scaledTokens = Math.min(scaledTokens, modelMaxOutput);
    }

    return scaledTokens;
  }
}
