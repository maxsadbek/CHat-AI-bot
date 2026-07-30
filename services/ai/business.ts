/**
 * Enterprise Business AI Service
 * v4.0 — Logo/Brand Truncation Fix
 *
 * Core fix: Short-form types (logo_prompt, brand_name, slogan, color_palette)
 * had prompts that were too verbose for their token budget. AI spent tokens
 * on format descriptions instead of generating the actual prompts/names.
 *
 * New approach:
 *  - Ultra-concise prompts for short-form types — 2-3 lines max
 *  - logo_prompt: 3 variants × 80-120 words each, no explanations
 *  - Type-specific maxTokens passed to executor
 *  - Mid-sentence detection: if response ends mid-sentence, auto-continue
 *  - Post-generation safety: trim incomplete last section/line
 */

import { BaseAIService } from "./base";
import { aiConfig, type PlanType } from "@/config/ai";
import { logger } from "@/bot/core/logger";
import type { BusinessContent, BusinessContentType } from "@/types";

const log = logger.child("ai-business");

/**
 * ─── TYPE-SPECIFIC TOKEN LIMITS ──────────────────────
 * Override max output tokens per business content type + plan.
 * These override the default `business` feature limits (600/1400).
 *
 * Short-form types (logo, brand, slogan, color): 400-500 tokens.
 * Marketing strategy: 600 (fits in FREE limit).
 * Business plan (only PREMIUM/PRO): 1000.
 * Others: auto (uses feature default from config/ai.ts).
 */
const TYPE_MAX_TOKENS: Partial<Record<BusinessContentType, { free: number; premium: number }>> = {
  logo_prompt:        { free: 400, premium: 500 },
  brand_name:         { free: 400, premium: 500 },
  slogan:             { free: 400, premium: 500 },
  color_palette:      { free: 400, premium: 500 },
  marketing_strategy: { free: 500, premium: 600 },
  business_plan:      { free: 600, premium: 1000 },
};

/**
 * ─── TYPE-SPECIFIC PROMPTS ───────────────────────────
 * Ultra-concise. Short-form types (logo, brand, slogan, color):
 *   - 2-3 lines max prompt text
 *   - NO format boilerplate, NO long descriptions
 *   - AI should spend 90%+ tokens on output, not reading instructions
 *   - Each variant: 80-120 words max, complete sentence, production-ready
 */

const TYPE_PROMPTS: Record<BusinessContentType, string> = {

  // ── LONG-FORM (full analysis) ──────────────────────

  startup_idea: `You are Kayzel Creator AI — a startup founder and growth hacker.
Users send business ideas. You reply with premium, Telegram-native analysis.
No academic reports. No corporate consulting. No long paragraphs.

Use this exact format, max 500-700 characters:

━━━━━━━━━━━━━━━━━━━━
🚀 Startup Idea
━━━━━━━━━━━━━━━━━━━━

💡 Idea:
(1 sentence — what it is, who it helps)

🎯 Customers:
• (who needs this)
• (their problem)
• (why they pay)

💰 Money:
• (revenue stream)
• (pricing)
• (growth potential)

🔥 Why it wins:
• (advantage over alternatives)
• (key differentiator)
• (defensibility)

🚀 First launch:
1. (build MVP)
2. (acquire first users)
3. (iterate)

RULES: Never ask for more info — INFER everything. If input is just "Telegram bot" or "IT kompaniya", create a full concept. Avoid generic sentences. Be specific. Use the exact format above.

IMPORTANT: All output MUST be in Russian language. Never write in Uzbek or English.`,

  business_plan: `You are a product strategist. User gives an idea — build a practical rollout plan.
Telegram format. 400-600 chars.

━━━━━━━━━━━━━━━━━━━━
📋 Execution Plan
━━━━━━━━━━━━━━━━━━━━

💡 Core Offer:
(what you sell — 1 line)

⚙️ How It Works:
• (key operation 1)
• (key operation 2)
• (key operation 3)

💰 Cost & Revenue:
• (setup cost)
• (monthly runway)
• (breakeven timeline)

📊 Metrics:
• (KPI 1)
• (KPI 2)
• (KPI 3)

RULES: Bullet points only. No corporate language. Be specific — name real numbers where possible.

IMPORTANT: All output MUST be in Russian language. Never write in Uzbek or English.`,

  marketing_strategy: `You are a growth hacker. User gives a product — design a growth engine.
Telegram format. 400-600 chars.

━━━━━━━━━━━━━━━━━━━━
📈 Growth Strategy
━━━━━━━━━━━━━━━━━━━━

🎯 Best Customers:
• (segment 1)
• (segment 2)
• (segment 3)

🔥 Top Channels:
• (channel — budget — expected CAC)
• (channel — budget — expected CAC)
• (channel — budget — expected CAC)

📱 Content That Works:
• (platform: format, frequency, goal)

🚀 30-Day Sprint:
1. (week 1)
2. (week 2)
3. (week 3)
4. (week 4)

RULES: Name real platforms and budgets. Be specific.

IMPORTANT: All output MUST be in Russian language. Never write in Uzbek or English.`,

  // ── SHORT-FORM (concise output) ────────────────────

  brand_name: `You are a creative director. Generate 5 brand names for the concept.
Output names only — no explanations unless specified.

🏷️ Name 1:
🏷️ Name 2:
🏷️ Name 3:
🏷️ Name 4:
🏷️ Name 5:

🏆 Top Pick: (1 line why it works)

RULES: Each name must be unique, memorable, and domain-ready. 1-line meaning each.

IMPORTANT: All output MUST be in Russian language. Never write in Uzbek or English.`,

  slogan: `You are a creative director. Generate 5 slogans.

📝 Slogan 1:
📝 Slogan 2:
📝 Slogan 3:
📝 Slogan 4:
📝 Slogan 5:

🎯 Best choice: (1 line psych reason)

RULES: Short, punchy, emotional. Each under 8 words.

IMPORTANT: All output MUST be in Russian language. Never write in Uzbek or English.`,

  logo_prompt: `You are a creative director. Generate 3 logo prompts ready for Midjourney.

🎨 Minimalist:
(80-100 words — subject, style, colors, mood, lighting)

🎨 Premium:
(80-100 words — subject, style, colors, mood, lighting)

🎨 Bold:
(80-100 words — subject, style, colors, mood, lighting)

RULES: Complete sentences. Technical parameters included. No explanations. Ready to paste into image generator.

IMPORTANT: All output MUST be in Russian language. Never write in Uzbek or English.`,

  color_palette: `You are a creative director. Create a brand color palette.

🌈 Primary: #HEX — name — emotion
🌈 Secondary: #HEX — name — use case
🌈 Accent: #HEX — name — use case
🌈 Background: #HEX — name — use case

📱 Application: web, print, social media tips (2-3 bullets)

RULES: Hex codes only. Name each color. Explain psychology or use case.

IMPORTANT: All output MUST be in Russian language. Never write in Uzbek or English.`,

  landing_page_copy: `You are a product strategist. Write landing page copy that converts.

━━━━━━━━━━━━━━━━━━━━
🌐 Landing Page
━━━━━━━━━━━━━━━━━━━━

🔝 Above Fold:
Headline: (8 words max)
Sub: (1 line)
CTA: (action button text)

💪 Problem → Solution:
(pain point) → (how you fix it)

✨ Features:
• (feature → benefit)
• (feature → benefit)
• (feature → benefit)

📢 Social Proof:
(testimonial or stat — 1 line)

🎯 Closing:
(final headline)
(final CTA with urgency)

RULES: Copywriting principles apply. Short sentences. Emotional triggers.

IMPORTANT: All output MUST be in Russian language. Never write in Uzbek or English.`,

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
    const startTime = Date.now();
    const temperature = aiConfig.getTemperature("business");
    const planType = userPlan && ["PREMIUM", "PRO", "ENTERPRISE"].includes(userPlan.toUpperCase())
      ? "premium" as const
      : "free" as const;

    // Resolve type-specific token limit
    const typeTokens = TYPE_MAX_TOKENS[type];
    const maxTokens = typeTokens
      ? planType === "premium" ? typeTokens.premium : typeTokens.free
      : undefined; // undefined = use feature default from config/ai.ts

    const typePrompt = TYPE_PROMPTS[type] ?? TYPE_PROMPTS.startup_idea;
    const systemPrompt = typePrompt;
    const userPrompt = description.trim();

    log.info(`[BUSINESS_AI] request user=${userPlan ?? "FREE"} type=${type} model=${modelId ?? "auto"} maxTokens=${maxTokens ?? "default"} input="${userPrompt.slice(0, 80)}"`);

    try {
      const response = await this.executeAI(
        [{ role: "user", content: userPrompt }],
        systemPrompt,
        modelId,
        userPlan,
        temperature,
        maxTokens
      );

      // Post-generation safety: trim incomplete trailing section
      // (executor.ts owns continuation end-to-end via detectIncompleteSection)
      const finalContent = this.trimIncompleteTrailingSection(response.content);

      const latencyMs = Date.now() - startTime;
      const tokensUsed = response.usage?.totalTokens ?? 0;

      log.info(`[BUSINESS_AI] provider=${response.provider} model=${response.model ?? "unknown"} status=success tokens=${tokensUsed} length=${finalContent.length} initialLength=${response.content.length} latency=${latencyMs}ms type=${type} user=${userPlan ?? "FREE"}`);

      return { type, content: finalContent };
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
   * content after it, remove it.
   */
  private trimIncompleteTrailingSection(content: string): string {
    const lines = content.trimEnd().split("\n");
    const nonEmptyLines = lines.filter((l) => l.trim().length > 0);
    if (nonEmptyLines.length === 0) return content;

    const lastLine = nonEmptyLines[nonEmptyLines.length - 1]!;
    const headerPattern = /^[\u{1F300}-\u{1F9FF}]|^[📋📊💼📈🎯🔥🎨📱🚀💰📌🏷️📝🌈🔝💪✨📢]/u;
    const isTrailingHeader = headerPattern.test(lastLine.trim()) &&
      lastLine.trim().length < 60 &&
      nonEmptyLines.length >= 2 &&
      nonEmptyLines.indexOf(lastLine) >= nonEmptyLines.length - 2;

    if (isTrailingHeader) {
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
