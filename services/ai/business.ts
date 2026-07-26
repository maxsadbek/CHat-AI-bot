/**
 * Enterprise Business AI Service
 * v3.0 — Truncation-Proof Compact Engine
 *
 * Core fix: Old prompts were too verbose (━━━ separators, long format descriptions).
 * AI wasted tokens on decoration instead of content.
 *
 * New approach:
 *  - Minimal prompt format — no decorative separators, no boilerplate
 *  - Each type has only ESSENTIAL sections (3-5 max, not 5-7)
 *  - marketing_strategy = ONLY marketing, not full business plan
 *  - brand_name = names only
 *  - Each section = 3-5 bullet points, always filled with content
 *  - Token budget: 600 (FREE) / 1400 (PREMIUM)
 *  - Post-generation safety: trim incomplete trailing sections
 */

import { BaseAIService } from "./base";
import { aiConfig, type PlanType } from "@/config/ai";
import { logger } from "@/bot/core/logger";
import type { BusinessContent, BusinessContentType } from "@/types";

const log = logger.child("ai-business");

/**
 * ─── COMPACT TYPE-SPECIFIC PROMPTS ───────────────────
 *
 * Design rules (token efficiency):
 *  1. NO decorative separators like ━━━━━━━━━━━━━━━━━━ (waste 40+ chars each)
 *  2. NO long format descriptions — show format inline
 *  3. Each section = emoji header + 3-5 bullet points
 *  4. AI fills EACH section with content before moving to next
 *  5. If token limit hit: finish current section, stop clean
 */

const TYPE_PROMPTS: Record<BusinessContentType, string> = {

  startup_idea: `You are a startup consultant. User gives a short idea — you INFER a full concept.

Output these 4 sections with emoji headers. Fill each with 3-5 bullet points. NEVER leave a section empty:

🎯 Concept: what, who, problem solved
📊 Market: size, competitors, your edge
💰 Model: revenue streams, pricing, unit numbers
🚀 Launch: first channels, first 100 customers, 30-day plan

Rules: Be specific (name real companies, give real numbers). Match user language. No "Here's an analysis". No "Based on your input". Stop cleanly if at limit.`,

  business_plan: `You are a business strategist. INFER business from input. Output:

📋 Executive Summary — one paragraph
📊 Market Analysis — competitors, trends, positioning
💼 Operations — model, tech, team, logistics
📈 Financials — revenue 12mo, costs, breakeven
🎯 Goals — Year 1, 2, 3

3-5 bullets per section. Never skip a section.`,

  marketing_strategy: `You are a marketing director. INFER product from input. MARKETING ONLY — no business plan, no financials.

Output these 4 sections:

📌 Target Audience — 3-5 specific segments
🔥 Channels — 3-5 platforms with budget & expected ROI per channel
📱 Content — platform-by-platform: what to post, how often, goal
🚀 Growth — first 90 days: weekly targets and tactics

3-5 bullets each. Be specific: name platforms, budgets, dates.`,

  brand_name: `You are a naming strategist. Generate 5 brand names from user's concept.

🏷️ Name 1: [name] — meaning, why it works, domain availability
🏷️ Name 2: [name] — same
🏷️ Name 3: [name] — same
🏷️ Name 4: [name] — same
🏷️ Name 5: [name] — same

Then: 🏆 Top pick + reasoning.

Short explanations. No filler.`,

  slogan: `You are a copywriter. Generate 5 slogans.

📝 Slogan 1: [text] — psychological reason it works
📝 Slogan 2: [text] — same
📝 Slogan 3: [text] — same
📝 Slogan 4: [text] — same
📝 Slogan 5: [text] — same

Then: 🎯 Best pick + where to use it.`,

  logo_prompt: `You are an AI design director. Generate 3 production-ready logo prompts for Midjourney/DALL-E/Flux.

🎨 Prompt 1 — Minimalist: [full prompt with subject, style, colors, mood, technical params]
🎨 Prompt 2 — Creative: [full prompt]
🎨 Prompt 3 — Professional: [full prompt]

Then: 📋 Color palette & typography suggestions.`,

  color_palette: `You are a brand color strategist. Create color palettes.

🌈 Primary Palette: #HEX — name — psychology
🌈 Secondary: #HEX — name — usage
🌈 Accent: #HEX — name — usage
🌈 Neutral: #HEX — name — usage

Then: 📱 Application — web, print, social usage.`,

  landing_page_copy: `You are a conversion copywriter. Write landing page copy.

🔝 Hero: headline, subheadline, CTA button text
💪 Problem & Solution: pain point then solution
✨ Features: 3 features with benefits
📢 Proof: testimonial + stat
🎯 CTA: closing headline, final CTA, urgency

Each section: 2-3 sentences max.`,

};

/**
 * Ultra-short behavior rules — appended to every type prompt.
 * Kept minimal to save tokens.
 */
const BASE_BEHAVIOR = `

RULES: No "Here's an analysis". No "Based on your input". No "As an AI". No disclaimers. Never ask for more info — INFER. Match user language. Fill every section. If at token limit, finish current section cleanly then stop.`;

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
    const startTime = Date.now();
    const temperature = aiConfig.getTemperature("business");

    // Build compact system prompt
    const typePrompt = TYPE_PROMPTS[type] ?? TYPE_PROMPTS.startup_idea;
    const systemPrompt = `${typePrompt}\n${BASE_BEHAVIOR}`;
    const userPrompt = description.trim();

    log.info(`[BUSINESS_AI] request user=${userPlan ?? "FREE"} type=${type} model=${modelId ?? "auto"} input="${userPrompt.slice(0, 80)}"`);

    try {
      const response = await this.executeAI(
        [{ role: "user", content: userPrompt }],
        systemPrompt,
        modelId,
        userPlan,
        temperature
      );

      const latencyMs = Date.now() - startTime;
      const tokensUsed = response.usage?.totalTokens ?? 0;
      const trimmedContent = this.trimIncompleteTrailingSection(response.content);

      log.info(`[BUSINESS_AI] provider=${response.provider} model=${response.model ?? "unknown"} status=success tokens=${tokensUsed} length=${response.content.length} trimmed=${response.content.length !== trimmedContent.length} latency=${latencyMs}ms type=${type} user=${userPlan ?? "FREE"}`);

      return { type, content: trimmedContent };
    } catch (error) {
      const latencyMs = Date.now() - startTime;

      let errorCode = "UNKNOWN";
      let errorStatus: number | undefined;
      let errorProvider: string | undefined;

      if (error instanceof Error && "code" in error) {
        const aiErr = error as any;
        errorCode = aiErr.code ?? "UNKNOWN";
        errorStatus = aiErr.statusCode;
        errorProvider = aiErr.provider;
      }

      log.error(`[BUSINESS_AI] provider=${errorProvider ?? "unknown"} status=error code=${errorCode} statusCode=${errorStatus ?? "N/A"} type=${type} user=${userPlan ?? "FREE"} latency=${latencyMs}ms msg="${String(error).slice(0, 200)}"`);

      throw error;
    }
  }

  /**
   * Post-generation safety: trim incomplete trailing section.
   * If the response ends with a header/emoji line that has no substantive
   * content after it, remove it — better to show a complete report
   * missing one section than a dangling header with nothing under it.
   *
   * Patterns that indicate an incomplete trailing section:
   *  - Line ends with colon and nothing follows (empty header)
   *  - Line is only emoji + short text (header with no content)
   *  - Response ends with an emoji on its own line
   */
  private trimIncompleteTrailingSection(content: string): string {
    const lines = content.trimEnd().split("\n");

    // Check last meaningful line
    const nonEmptyLines = lines.filter((l) => l.trim().length > 0);
    if (nonEmptyLines.length === 0) return content;

    const lastLine = nonEmptyLines[nonEmptyLines.length - 1]!;

    // ── Detect: header with emoji + colon, no content after ──
    // Pattern: "🎯 Concept:" or "📌 Target Audience —" with only 1-2 lines total
    const headerPattern = /^[\u{1F300}-\u{1F9FF}]|^📋|^📊|^💼|^📈|^🎯|^🔥|^🎨|^📱|^🚀|^💰|^📌|^🏷️|^📝|^🌈|^🔝|^💪|^✨|^📢/u;
    const isTrailingHeader = headerPattern.test(lastLine.trim()) &&
      lastLine.trim().length < 60 &&
      nonEmptyLines.length >= 2 &&
      // Check that this header appears to be a NEW section (not continuation of content)
      nonEmptyLines.indexOf(lastLine) >= nonEmptyLines.length - 2;

    if (isTrailingHeader) {
      // Remove the empty header line(s)
      const lastHeaderIndex = lines.lastIndexOf(lastLine);
      return lines.slice(0, lastHeaderIndex).join("\n").trimEnd();
    }

    return content.trimEnd();
  }

  getTypes(): BusinessContentType[] {
    return [...this.types];
  }
}

export const businessAIService = new BusinessAIService();
