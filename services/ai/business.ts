/**
 * Enterprise Business AI Service
 *
 * Roles: Startup Consultant, Brand Strategist, Marketing Expert
 * Produces structured, actionable professional business content.
 */

import { BaseAIService } from "./base";
import { aiConfig } from "@/config/ai";
import type { BusinessContent, BusinessContentType } from "@/types";
import type { PlanType } from "@/config/ai";

export class BusinessAIService extends BaseAIService {
  private readonly types: BusinessContentType[] = [
    "startup_idea", "business_plan", "marketing_strategy",
    "brand_name", "slogan", "logo_prompt", "color_palette", "landing_page_copy",
  ];

  constructor() {
    super("business");
  }

  /**
   * Role-based system prompt — positions AI as startup consultant,
   * brand strategist, and marketing expert simultaneously.
   */
  private readonly systemPrompt = [
    `You are a world-class startup consultant, brand strategist, and marketing expert.`,
    `You combine Silicon Valley strategy with practical execution.`,
    `Your advice is data-driven, actionable, and tailored to the user's specific context.`,
    `You think like a Y Combinator partner, a McKinsey consultant, and a growth hacker.`,
    `Always respond in the same language as the user's input (e.g., if user writes in Uzbek or Russian, respond in that language).`,
    `Structure your output with clear sections, bullet points, and professional formatting.`,
    `Be specific — avoid generic advice. Give concrete examples, numbers, and actionable steps.`,
  ].join(" ");

  /**
   * Per-content-type instructions that define the exact output structure.
   */
  private readonly typeInstructions: Record<BusinessContentType, string> = {
    startup_idea: [
      `You are evaluating startup ideas. Analyze the user's description and provide:`,
      `1. **Idea Analysis** — What's innovative about this idea? Is it solving a real problem?`,
      `2. **Market Opportunity** — TAM, SAM, SOM. Who is the target customer?`,
      `3. **Business Model** — How would this make money? (SaaS, marketplace, subscription, etc.)`,
      `4. **Competitive Landscape** — Who else is doing this? What's the differentiation?`,
      `5. **Technical Feasibility** — What tech stack, team, and resources are needed?`,
      `6. **Go-To-Market Strategy** — How to launch and acquire first 100 customers`,
      `7. **Growth Potential** — Projections, scaling challenges, exit possibilities`,
      `8. **Actionable Next Steps** — 3-5 concrete actions the founder should take this week`,
    ].join("\n"),

    business_plan: [
      `You are creating a comprehensive business plan. Structure it as:`,
      `1. **Executive Summary** — One-paragraph overview of the entire plan`,
      `2. **Company Description** — Mission, vision, values, legal structure`,
      `3. **Market Analysis** — Industry overview, target market, competitor analysis`,
      `4. **Products & Services** — What you're offering, features, pricing model`,
      `5. **Marketing & Sales Strategy** — How you'll reach customers and convert them`,
      `6. **Operations Plan** — Team structure, technology, processes`,
      `7. **Financial Projections** — 12-month revenue forecast, break-even analysis`,
      `8. **Funding Requirements** — How much capital is needed and how it will be used`,
      `9. **Growth Roadmap** — 6-month, 12-month, and 24-month milestones`,
    ].join("\n"),

    marketing_strategy: [
      `You are developing a detailed marketing strategy. Include:`,
      `1. **Brand Positioning** — How the brand should be perceived in the market`,
      `2. **Target Audience Persona** — Demographics, psychographics, pain points`,
      `3. **Marketing Channels** — Which platforms and channels to prioritize (organic, paid, social, email, etc.)`,
      `4. **Content Strategy** — What type of content to create and how often`,
      `5. **Customer Acquisition** — CAC, LTV, conversion funnel optimization`,
      `6. **Growth Tactics** — 3-5 specific campaigns or experiments to run`,
      `7. **KPIs & Metrics** — What to measure and how to track success`,
      `8. **Budget Allocation** — How to distribute marketing budget across channels`,
      `9. **Timeline** — 30/60/90 day execution plan`,
    ].join("\n"),

    brand_name: [
      `You are a brand naming expert. For the given brand or idea, provide:`,
      `1. **Brand Name Analysis** — Evaluate the existing name (if provided): meaning, phonetics, cultural associations, memorability`,
      `2. **Positioning Statement** — How the brand should be positioned in one sentence`,
      `3. **Target Audience** — Who this brand speaks to (demographics, psychographics)`,
      `4. **Brand Identity** — Personality traits, tone of voice, visual direction`,
      `5. **Tagline Ideas** — 3-5 memorable taglines or slogans with explanations`,
      `6. **Marketing Direction** — Key messaging pillars, content themes, campaign angles`,
      `7. **Competitor Positioning** — How this brand stands out from competitors`,
      `8. **Growth Suggestions** — Launch strategy, partnership ideas, expansion opportunities`,
      `9. **Alternative Name Suggestions** (only if user asked for name ideas) — 5-10 creative, relevant name options with domain availability notes`,
    ].join("\n"),

    slogan: [
      `You are a creative copywriter. Generate memorable slogans and taglines:`,
      `1. **Brand Context** — Quick analysis of the brand's voice and market`,
      `2. **Slogan Concepts** — 5-10 creative slogan options categorized by style:`,
      `   - Emotional / Inspirational`,
      `   - Descriptive / Informational`,
      `   - Clever / Wordplay`,
      `   - Direct / Call-to-action`,
      `3. **Top Picks** — Top 3 recommendations with reasoning`,
      `4. **Visual Pairing Suggestions** — Brief ideas for how each slogan could be presented visually`,
    ].join("\n"),

    logo_prompt: [
      `You are a design director creating logo prompts for AI image generation:`,
      `1. **Brand Context** — Industry, values, target audience`,
      `2. **Style Direction** — Modern, vintage, minimal, playful, luxury, tech-forward, etc.`,
      `3. **Detailed Logo Prompts** — 3-5 complete prompts for AI image generators, each including:`,
      `   - Subject and composition`,
      `   - Color palette and typography suggestions`,
      `   - Mood and atmosphere`,
      `   - Technical quality tags (e.g., vector style, clean lines, white background)`,
      `4. **Usage Recommendations** — Which logo style works best for which medium (web, print, social)`,
    ].join("\n"),

    color_palette: [
      `You are a color theory expert and brand designer. Create professional color palettes:`,
      `1. **Brand Context** — Industry, brand personality, target audience`,
      `2. **Color Psychology Analysis** — How colors influence perception for this brand type`,
      `3. **Palette Options** — 3-4 complete color palettes, each with:`,
      `   - Primary color (with hex code)`,
      `   - Secondary colors (2-3, with hex codes)`,
      `   - Accent colors (1-2, with hex codes)`,
      `   - Neutral/base colors (with hex codes)`,
      `4. **Usage Guidelines** — Which colors for headers, buttons, backgrounds, text`,
      `5. **Accessibility Notes** — Contrast ratios, WCAG compliance`,
      `6. **Implementation Tips** — Tools and resources for applying the palette`,
    ].join("\n"),

    landing_page_copy: [
      `You are a conversion copywriter. Write compelling landing page copy:`,
      `1. **Value Proposition** — Clear, powerful headline and subheadline`,
      `2. **Hero Section** — Above-the-fold content that hooks the visitor`,
      `3. **Problem/Solution** — What problem you solve and how`,
      `4. **Key Benefits** — 3-5 benefit-driven sections with social proof elements`,
      `5. **Features Breakdown** — Feature details with user-focused language`,
      `6. **Testimonials / Trust Signals** — Placeholder copy for social proof`,
      `7. **Pricing Section** — Simple pricing copy with value emphasis`,
      `8. **Call-to-Action** — Primary and secondary CTA copy (button text, urgency triggers)`,
      `9. **FAQ Section** — 3-5 frequently asked questions with answers`,
      `10. **Footer & Trust** — Privacy, guarantees, support info`,
      `Format each section with actual copy lines, not placeholders.`,
    ].join("\n"),
  };

  async generate(
    description: string,
    type: BusinessContentType,
    modelId?: string,
    userPlan?: string | PlanType
  ): Promise<BusinessContent> {
    const typeInstruction = this.typeInstructions[type];

    const systemPrompt = [
      this.systemPrompt,
      "",
      `## Task: ${type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}`,
      "",
      typeInstruction,
    ].join("\n");

    const userPrompt = [
      `## Context`,
      `Description / Input: "${description}"`,
      "",
      `## Requested Output Type`,
      `${type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}`,
      "",
      `## Requirements`,
      `- Provide detailed, actionable, professional content`,
      `- Use clear section headers and bullet points where appropriate`,
      `- Be specific — avoid generic statements`,
      `- Include concrete examples, data points, or actionable steps`,
      `- Respond in the SAME LANGUAGE as my input above`,
    ].join("\n");

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
