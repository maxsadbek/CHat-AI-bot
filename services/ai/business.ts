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

  startup_idea: `You are a startup consultant. User gives short input — INFER full concept.

Output a concise analysis maximum 500-700 words total. Use this exact format:

━━━━━━━━━━━━━━━━━━━━━
💼 Business Analysis
━━━━━━━━━━━━━━━━━━━━━

📌 Idea:
2-3 sentences describing what they do, the problem they solve, and their core concept.

🎯 Target Audience:
• (bullet 1)
• (bullet 2)
• (bullet 3)

🚀 Unique Value:
• (bullet 1)
• (bullet 2)
• (bullet 3)

💰 Monetization:
• (bullet 1)
• (bullet 2)
• (bullet 3)

📢 Marketing:
• (bullet 1)
• (bullet 2)
• (bullet 3)

⚡ First Steps:
1. (short actionable step)
2. (short actionable step)
3. (short actionable step)
4. (short actionable step)
5. (short actionable step)

━━━━━━━━━━━━━━━━━━━━━

RULES:
- Maximum 500-700 words total.
- No long explanations. No repeated info. No generic consultant phrases.
- Every point must be practical and specific.
- Use emojis. Make it look like a premium AI product.
- Answer in the user's language.
- For simple input like "Telegram bot", still generate a full useful analysis.
- NEVER leave any section empty. NEVER ask for more info. INFER everything.`,

  business_plan: `You are a business strategist. INFER business from input.

📋 Executive Summary
📊 Market Analysis — competitors, trends, positioning
💼 Operations — model, tech, team, logistics
📈 Financials — revenue 12mo, costs, breakeven
🎯 Goals — Year 1/2/3

3-5 bullets per section. Never skip.`,

  marketing_strategy: `You are a marketing director. MARKETING ONLY — no business plan, no financials.

📌 Target Audience — 3-5 segments
🔥 Channels — 3-5 platforms with budget & ROI per channel
📱 Content — platform-by-platform: format, frequency, goal
🚀 Growth — first 90 days: weekly targets and tactics

3-5 bullets. Name platforms, budgets, dates.`,

  // ── SHORT-FORM (concise output) ────────────────────

  brand_name: `Generate 5 brand names from concept.

🏷️ Name 1:
🏷️ Name 2:
🏷️ Name 3:
🏷️ Name 4:
🏷️ Name 5:

Each: 1-line meaning + why it works. Then 🏆 top pick.`,

  slogan: `Generate 5 slogans.

📝 Slogan 1:
📝 Slogan 2:
📝 Slogan 3:
📝 Slogan 4:
📝 Slogan 5:

Each: text + 1-line psychological reason. Then 🎯 best pick.`,

  logo_prompt: `You are an AI design director. Generate 3 complete logo prompts.

🎨 Prompt 1 — Minimalist:
🎨 Prompt 2 — Premium:
🎨 Prompt 3 — Futuristic:

Each prompt: 80-120 words, complete sentence, ready for Midjourney/Gemini. Include: subject, style, composition, colors, mood, technical parameters. Do NOT explain the prompt — just output it.`,

  color_palette: `Create brand color palette.

🌈 Primary: #HEX — name — psychology
🌈 Secondary: #HEX —  name — usage
🌈 Accent: #HEX — name — usage
🌈 Neutral: #HEX — name — usage

Then 📱 web, print, social application.`,

  landing_page_copy: `Write landing page copy.

🔝 Hero: headline, subheadline, CTA button
💪 Problem & Solution: pain → solution
✨ Features: 3 features → benefits
📢 Proof: testimonial + stat
🎯 CTA: closing headline, final CTA, urgency

2-3 sentences each section.`,

};

const BASE_BEHAVIOR = `

RULES: No "Here's an analysis". No "Based on your input". No "As an AI". No disclaimers. Never ask for more info — INFER. Match user language. Fill every section.`;

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
    const systemPrompt = `${typePrompt}\n${BASE_BEHAVIOR}`;
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

      // ── Post-generation: detect & fix truncation ──
      let finalContent = response.content;
      const isTruncated = this.isMidSentenceCut(finalContent);
      if (isTruncated) {
        log.info(`[BUSINESS_AI] mid-sentence cut detected, attempting continuation`);
        try {
          const continuation = await this.executeAI(
            [
              { role: "user", content: userPrompt },
              { role: "assistant", content: finalContent },
              { role: "user", content: "Continue exactly from where you stopped. Do not repeat previous text. Just complete the last sentence and section." },
            ],
            systemPrompt,
            modelId,
            userPlan,
            temperature,
            maxTokens
          );
          finalContent = finalContent + " " + continuation.content;
          log.info(`[BUSINESS_AI] continuation successful, merged length=${finalContent.length}`);
        } catch (contErr) {
          log.warn(`[BUSINESS_AI] continuation failed, returning partial content: ${String(contErr).slice(0, 100)}`);
          // Fall through — return what we have
        }
      }

      // Post-generation safety: trim incomplete trailing section
      finalContent = this.trimIncompleteTrailingSection(finalContent);

      const latencyMs = Date.now() - startTime;
      const tokensUsed = response.usage?.totalTokens ?? 0;

      log.info(`[BUSINESS_AI] provider=${response.provider} model=${response.model ?? "unknown"} status=success tokens=${tokensUsed} length=${finalContent.length} initialLength=${response.content.length} continued=${isTruncated} latency=${latencyMs}ms type=${type} user=${userPlan ?? "FREE"}`);

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
   * Detect if response was cut mid-sentence.
   * A response is "mid-sentence" if it doesn't end with sentence-ending
   * punctuation (. ! ?) or a natural section-ending pattern.
   */
  private isMidSentenceCut(content: string): boolean {
    const trimmed = content.trimEnd();
    if (trimmed.length < 20) return false; // too short to judge

    const lastChar = trimmed.charAt(trimmed.length - 1);

    // Ends with sentence-ending punctuation → not cut
    if (lastChar === "." || lastChar === "!" || lastChar === "?") return false;

    // Ends with newline + emoji header pattern → next section starts, not a cut
    const lastTwoLines = trimmed.split("\n").slice(-2).join("\n");
    const emojiStart = /^[\u{1F300}-\u{1F9FF}]|^[📋📊💼📈🎯🔥🎨📱🚀💰📌🏷️📝🌈🔝💪✨📢]/u;
    if (emojiStart.test(lastTwoLines.trim())) return false;

    // Ends with closing brace/bracket → likely complete
    if (lastChar === ")" || lastChar === "]" || lastChar === "}") return false;

    // Ends with end-of-line character but no period → cut
    // This includes: comma, dash, colon, a word without punctuation
    if (/[a-zA-Z0-9\u{0400}-\u{04FF}ا-یぁ-んァ-ン]/u.test(lastChar)) return true;
    if (lastChar === "," || lastChar === ";" || lastChar === "-" || lastChar === ":") return true;
    if (lastChar === "\n") return false; // ends on newline → section end

    return false;
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
