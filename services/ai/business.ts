/**
 * Enterprise Business AI Service
 *
 * Roles: Startup Consultant, Brand Strategist, Marketing Expert
 * Generates professional business analysis with exact structured format:
 *   📋 Business Overview → 🚀 Brand Strategy → 💰 Monetization → 📈 Marketing Plan → 🎯 Action Steps
 */

import { BaseAIService } from "./base";
import { aiConfig, type PlanType } from "@/config/ai";
import { logger } from "@/bot/core/logger";
import type { BusinessContent, BusinessContentType } from "@/types";

const log = logger.child("ai-business");

/**
 * Professional business analysis system prompt.
 * Instructs the AI to produce the exact structured format the user expects.
 */
const SYSTEM_PROMPT = `You are a world-class startup consultant and brand strategist.

Analyze the user's input and produce a professional business analysis with these EXACT sections:

📋 Business Overview
- Business idea analysis
- Target audience
- Problem solved

🚀 Brand Strategy
- Brand positioning
- Unique value proposition
- Competitor advantage

💰 Monetization
- Revenue model
- Pricing ideas
- Growth opportunities

📈 Marketing Plan
- Acquisition channels
- Content strategy
- Launch plan

🎯 Action Steps
- First 30 days roadmap

RULES:
1. Respond in the SAME LANGUAGE as the user's input.
2. Use emoji headers for each section.
3. Be specific and actionable — avoid generic advice.
4. Provide concrete examples and data points.
5. Each bullet point must be a complete, detailed sentence.`;

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

    // Build user prompt based on content type
    const userPrompt = [
      `Generate a ${typeLabel} for: "${description}"`,
      "",
      `Use the standard business analysis format with all 5 sections.`,
      "Make it detailed, actionable, and specific to this idea.",
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
