/**
 * Enterprise Business AI Service
 *
 * Roles: Startup Consultant, Brand Strategist, Marketing Expert
 * Generates: brand analysis, name ideas, target audience, marketing strategy,
 * monetization ideas, growth plan, competitor positioning.
 *
 * Has error safety net: if ALL providers fail, returns a graceful fallback
 * with the provider error details logged (same pattern as Social).
 */

import { BaseAIService } from "./base";
import { aiConfig, type PlanType, normalizePlanType } from "@/config/ai";
import { logger } from "@/bot/core/logger";
import { routePlanner } from "@/services/ai/router";
import type { BusinessContent, BusinessContentType } from "@/types";

const log = logger.child("ai-business");

const SYSTEM_PROMPT = `You are a world-class startup consultant, brand strategist, and marketing expert.
Analyze the user's input and provide actionable business advice.
Cover: brand identity, target audience, market opportunity, monetization, growth strategy, and competitor positioning.
Respond in the SAME LANGUAGE as the user's input.
Use clear sections with emoji headers. Be specific. Give examples.`;

/** Per-content-type instructions — appended after the base prompt. Each is a single sentence. */
const TYPE_INSTRUCTIONS: Record<BusinessContentType, string> = {
  startup_idea: "Evaluate this idea: market fit, business model, competitive edge, feasibility, and next steps.",
  business_plan: "Structure: executive summary, market analysis, product, marketing, operations, finances, roadmap.",
  marketing_strategy: "Strategy: brand positioning, audience, channels, content, acquisition, KPIs, budget, timeline.",
  brand_name: "Analysis needed: brand name meaning, positioning, target audience, brand identity, tagline ideas, marketing direction, competitor positioning, growth plan, monetization ideas.",
  slogan: "Generate 5-10 creative slogan options with recommendations.",
  logo_prompt: "Brand context, style direction, and 3-5 logo prompts for AI image generation.",
  color_palette: "3-4 palettes with hex codes, psychology, and usage guidelines.",
  landing_page_copy: "Full page: value prop, benefits, features, social proof, pricing, CTA, FAQ.",
};

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
    const planLabel = normalizePlanType(userPlan);
    const typeLabel = type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    const typeInstruction = TYPE_INSTRUCTIONS[type];

    const systemPrompt = `${SYSTEM_PROMPT}\n\nType: ${typeLabel}\n${typeInstruction}`;
    const userPrompt = `${typeLabel} for: "${description}"`;
    const temperature = aiConfig.getTemperature("business");
    const providerChain = routePlanner.getRoute("business").providerChain;

    log.info("[BUSINESS] Generating content", {
      type,
      plan: planLabel,
      modelId: modelId ?? "default",
      userPromptLength: userPrompt.length,
      providerChain,
      temperature,
    });

    try {
      const response = await this.executeAI(
        [{ role: "user", content: userPrompt }],
        systemPrompt,
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
      // Log the REAL provider error with full details
      let errorCode = "UNKNOWN";
      let errorStatus: number | undefined;
      let errorProvider: string | undefined;
      if (error instanceof Error && "code" in error) {
        const aiErr = error as any;
        errorCode = aiErr.code ?? "UNKNOWN";
        errorStatus = aiErr.statusCode;
        errorProvider = aiErr.provider;
      }

      log.error("[BUSINESS] All providers failed, returning fallback", {
        type,
        plan: planLabel,
        errorCode,
        statusCode: errorStatus,
        provider: errorProvider,
        providerChain,
        error: String(error),
        timestamp: new Date().toISOString(),
      });

      // Return graceful fallback with the available info (like Social does)
      const fallbackContent = [
        `📋 **${typeLabel} Analysis**`,
        "",
        `**Input:** ${description}`,
        "",
        "⚠️ *AI generation encountered an issue. Here's a basic analysis based on your input:*",
        "",
        "**Key Points:**",
        `• **Idea:** ${description}`,
        "• **Next Steps:** Refine your concept with more specific details about your target market, value proposition, and business goals.",
        "• **Suggestion:** Try rephrasing with more context about your industry, audience, and objectives.",
        "",
        "---",
        "💡 *Please try again with a more detailed description or try a different input.*",
      ].join("\n");

      return { type, content: fallbackContent };
    }
  }

  getTypes(): BusinessContentType[] {
    return [...this.types];
  }
}

export const businessAIService = new BusinessAIService();
