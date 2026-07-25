/**
 * Enterprise Business AI Service
 *
 * Roles: Startup Consultant, Brand Strategist, Marketing Expert
 * Uses SINGLE clean system prompt (same pattern as Social/Coding — proven to work).
 * Type-specific instructions are appended as simple text, not markdown-heavy sections.
 */

import { BaseAIService } from "./base";
import { aiConfig, type PlanType } from "@/config/ai";
import type { BusinessContent, BusinessContentType } from "@/types";

const SYSTEM_PROMPT_BASE = `You are a world-class startup consultant, brand strategist, and marketing expert.
Analyze the user's input and provide detailed, actionable business advice.
Cover: brand positioning, target audience, market opportunity, and growth strategy.
Respond in the SAME LANGUAGE as the user's input.
Use clear sections and bullet points. Be specific — avoid generic advice.`;

export class BusinessAIService extends BaseAIService {
  private readonly types: BusinessContentType[] = [
    "startup_idea", "business_plan", "marketing_strategy",
    "brand_name", "slogan", "logo_prompt", "color_palette", "landing_page_copy",
  ];

  /** Per-content-type instruction suffix — appended to the base system prompt */
  private readonly TYPE_SUFFIX: Record<BusinessContentType, string> = {
    startup_idea: "Focus on idea validation, market fit, business model, and actionable next steps.",
    business_plan: "Cover: executive summary, market analysis, product, marketing, operations, finances, and roadmap.",
    marketing_strategy: "Cover: brand positioning, audience persona, channels, content strategy, acquisition tactics, KPIs, and budget.",
    brand_name: "Provide: name analysis, brand positioning, target audience, brand identity, tagline ideas, marketing direction, competitor positioning, and growth suggestions.",
    slogan: "Generate 5-10 creative slogan options categorized by style with top recommendations.",
    logo_prompt: "Provide brand context, style direction, and 3-5 detailed logo prompts for AI image generation.",
    color_palette: "Suggest 3-4 complete color palettes with hex codes, psychology analysis, and usage guidelines.",
    landing_page_copy: "Write full landing page copy with: headline, benefits, features, testimonials, pricing, CTA, FAQ.",
  };

  constructor() {
    super("business");
  }

  async generate(
    description: string,
    type: BusinessContentType,
    modelId?: string,
    userPlan?: string | PlanType
  ): Promise<BusinessContent> {
    const typeSuffix = this.TYPE_SUFFIX[type];
    const systemPrompt = `${SYSTEM_PROMPT_BASE}\n\n${typeSuffix}`;
    const userPrompt = `${type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())} for: "${description}"`;

    const temperature = aiConfig.getTemperature("business");

    const response = await this.executeAI(
      [{ role: "user", content: userPrompt }],
      systemPrompt,
      modelId,
      userPlan,
      temperature
    );

    return {
      type,
      content: response.content,
    };
  }

  getTypes(): BusinessContentType[] {
    return [...this.types];
  }
}

export const businessAIService = new BusinessAIService();
