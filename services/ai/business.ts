/**
 * Enterprise Business AI Service
 *
 * Roles: Startup Consultant, Brand Strategist, Marketing Expert
 * Generates professional business analysis with exact structured format:
 *   📋 Business Overview → 🚀 Brand Strategy → 💰 Monetization → 📈 Marketing Plan → 🎯 Action Steps
 *
 * Optimized for token efficiency and short inputs.
 * Even "Kayzel Creator" or "telegram bot" should produce a full analysis
 * — the AI infers a business idea rather than asking for more detail.
 */

import { BaseAIService } from "./base";
import { aiConfig, type PlanType } from "@/config/ai";
import { logger } from "@/bot/core/logger";
import type { BusinessContent, BusinessContentType } from "@/types";

const log = logger.child("ai-business");

/**
 * Concise system prompt (~400 chars) — every word counts.
 * Forces the AI to infer a business idea from short inputs like
 * "Kayzel Creator" and produce the 5-section format without
 * asking for clarification.
 */
const SYSTEM_PROMPT = `You are a startup consultant. The user may give a very short input — always INFER a complete business idea from it. Never ask for more info.

Output these 5 sections with emoji headers:
📋 Business Overview (idea, audience, problem)
🚀 Brand Strategy (positioning, USP, competitors)
💰 Monetization (revenue, pricing, growth)
📈 Marketing Plan (channels, content, launch)
🎯 Action Steps (30-day roadmap)

Match language. Be specific with examples. 2-4 bullets per section.`;

export class BusinessAIService extends BaseAIService {
  private readonly types: BusinessContentType[] = [
    "startup_idea", "business_plan", "marketing_strategy",
    "brand_name", "slogan", "logo_prompt", "color_palette", "landing_page_copy",
  ];

  constructor() {
    super("business");
  }

  async generate(
    description: string,
    type: BusinessContentType,
    modelId?: string,
    userPlan?: string | PlanType
  ): Promise<BusinessContent> {
    const typeLabel = type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    const temperature = aiConfig.getTemperature("business");

    // Build user prompt — short inputs must yield a full analysis
    const userPrompt = [
      `Analyze "${description}" as a ${typeLabel}.`,
      `If this input is very short (a name, a word, a phrase), infer a complete business idea from it.`,
      `Produce all 5 sections with emoji headers. Be specific.`,
    ].join("\n");

    log.info("[BUSINESS] Generating content", {
      type,
      plan: userPlan ?? "FREE",
      modelId: modelId ?? "default",
      description: description.slice(0, 100),
      temperature,
    });

    try {
      const response = await this.executeAI(
        [{ role: "user", content: userPrompt }],
        SYSTEM_PROMPT,
        modelId,
        userPlan,
        temperature
      );

      log.info("[BUSINESS] AI response received", {
        type,
        contentLength: response.content.length,
        usage: response.usage,
      });

      return { type, content: response.content };
    } catch (error) {
      // Log AIError details then re-throw — handler shows the friendly message
      const details: Record<string, unknown> = {
        type,
        plan: userPlan ?? "FREE",
        error: String(error),
      };
      if (error instanceof Error && "code" in error) {
        const aiErr = error as any;
        details.errorCode = aiErr.code ?? "UNKNOWN";
        details.statusCode = aiErr.statusCode;
        details.provider = aiErr.provider;
      }
      log.error("[BUSINESS] AI execution failed", details);
      throw error;
    }
  }

  getTypes(): BusinessContentType[] {
    return [...this.types];
  }
}

export const businessAIService = new BusinessAIService();
