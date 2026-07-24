/**
 * Cost Optimization Strategy
 * Performs dynamic token allocation based on prompt length, feature type, user plan,
 * and maximum output capability of the selected model.
 */

import { aiConfig, FeatureType, PlanType } from "@/config/ai";

export class CostOptimizationStrategy {
  /**
   * Estimate token count of text (approx 4 chars per token for English/code).
   */
  static estimateTokenCount(text: string): number {
    if (!text) return 0;
    return Math.ceil(text.length / 3.8);
  }

  /**
   * Dynamically calculate maxTokens for request.
   */
  static resolveMaxTokens(
    feature: FeatureType,
    plan?: string | PlanType,
    userPrompt?: string,
    modelMaxOutput?: number
  ): number {
    const promptTokens = this.estimateTokenCount(userPrompt || "");
    const configuredTokens = aiConfig.getMaxTokens(feature, plan, promptTokens);

    if (modelMaxOutput && modelMaxOutput > 0) {
      return Math.min(configuredTokens, modelMaxOutput);
    }

    return configuredTokens;
  }
}
