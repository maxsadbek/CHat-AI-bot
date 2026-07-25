/**
 * Enterprise Social Media AI Service v3
 *
 * Professional marketing agency-level social media content generator.
 * Transforms short user ideas into complete viral-ready campaigns.
 *
 * The AI MUST expand the user's idea — never repeat it — and return
 * structured JSON with hooks, captions, reel ideas, audience targeting,
 * CTAs, hashtags, keywords, and visual direction.
 *
 * All fields are mapped into the existing SocialMediaContent interface.
 */

import { BaseAIService } from "./base";
import type { SocialMediaContent, SocialPlatform } from "@/types";
import type { PlanType } from "@/config/ai";
import { logger } from "@/bot/core/logger";

const log = logger.child("ai-social");

// ─── Custom internal type for the rich AI response ───────────

interface SocialAIResponse {
  platform: string;
  hook: string;
  caption: string;
  reelIdea: string;
  targetAudience: string;
  cta: string;
  hashtags: string[];
  keywords: string[];
  designIdea: string;
}

// ─── System prompt ──────────────────────────────────────────────

const SYSTEM_PROMPT = `You are the head of content at a top-tier digital marketing agency.

Your job is to transform short user ideas into complete, professional social media campaigns.

RULES:
1. NEVER repeat the user's input. Always expand it into a full campaign.
2. If the user types something short like "Bot reklamasi uchun", create a complete bot promotion campaign — do not just echo the text.
3. Think like a marketing strategist: analyze the idea, identify the target audience, and craft conversion-focused content.
4. Every field must be detailed, actionable, and platform-optimized.

You MUST respond with a JSON array. NO markdown, NO code blocks, NO explanations.
EVERY object in the array must have ALL of these fields:

[
  {
    "platform": "Instagram",
    "hook": "A viral 3-second hook that stops the scroll — must be attention-grabbing, emotional, or curiosity-driven",
    "caption": "Full optimized caption/post content — storytelling structure with hook, problem, solution, social proof, and CTA",
    "reelIdea": "Complete Instagram Reel / TikTok concept: visual idea, text overlay, music suggestion, editing style, duration",
    "targetAudience": "Primary audience demographic, psychographics, pain points, and why this content resonates with them",
    "cta": "Clear, urgent call to action that drives engagement (comment, share, save, click)",
    "hashtags": ["#branded1", "#niche2", "#broad3", "#trending4", "#location5", "#community6", "#growth7", "#viral8", "#education9", "#entertainment10", "#value11", "#story12", "#behindTheScenes13", "#tips14", "#inspiration15"],
    "keywords": ["primary keyword", "secondary keyword", "trending term", "niche phrase", "long-tail keyword"],
    "designIdea": "Visual and creative direction: color palette, font style, image/video mood, graphic elements, post layout"
  }
]

Return ONLY the JSON array. No markdown. No explanation.`;

// ─── Service ──────────────────────────────────────────────────────

export class SocialAIService extends BaseAIService {
  private readonly platforms: SocialPlatform[] = [
    "Instagram", "TikTok", "Telegram", "Facebook", "LinkedIn", "YouTube",
  ];

  constructor() {
    super("social");
  }

  async generateContent(
    topic: string,
    platform?: SocialPlatform,
    tone: string = "professional",
    modelId?: string,
    userPlan?: string | PlanType
  ): Promise<SocialMediaContent[]> {
    const targetPlatforms = platform ? [platform] : this.platforms;

    const userPrompt = `Create a complete social media marketing campaign for: "${topic}"

Platforms: ${targetPlatforms.join(", ")}

Your task:
1. Analyze "${topic}" and identify the core marketing message.
2. Create platform-specific content that converts browsers into customers.
3. For SHORT inputs (like "${topic.slice(0, 30)}"), expand into a full campaign — never repeat the input.
4. Include a scroll-stopping hook, story-driven caption, reel idea, target audience insights, CTA, 15 hashtags, 5 keywords, and visual direction.

Return ONE JSON object per platform in a JSON array.`;

    log.info("[SOCIAL_SERVICE] Generating content", {
      topic: topic.slice(0, 50),
      platform,
      tone,
      modelId: modelId ?? "default",
    });

    try {
      const response = await this.executeAI(
        [{ role: "user", content: userPrompt }],
        SYSTEM_PROMPT,
        modelId,
        userPlan
      );

      log.info("[SOCIAL_SERVICE] AI response received", {
        contentLength: response.content.length,
      });

      return this.parseResponse(response.content, targetPlatforms);
    } catch (error) {
      log.error("[SOCIAL_SERVICE] AI execution failed", {
        error: String(error),
        topic: topic.slice(0, 50),
      });
      return targetPlatforms.map((p) => this.buildSafeFallback(p, topic));
    }
  }

  // ── Parsing ──────────────────────────────────────────────────────

  /**
   * Parse AI response: JSON → text extraction → safe fallback
   * Maps the rich AI fields into the existing SocialMediaContent interface:
   *
   *   AI { hook, caption, reelIdea, targetAudience, cta, hashtags, keywords, designIdea }
   *   → SocialMediaContent { caption (rich formatted), hooks, cta, hashtags, trendingKeywords }
   */
  private parseResponse(
    rawContent: string,
    targetPlatforms: SocialPlatform[]
  ): SocialMediaContent[] {
    const cleaned = rawContent
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/, "")
      .trim();

    // Strategy 1: Try JSON parse
    const richResult = this.tryParseJson(cleaned, targetPlatforms);
    if (richResult) {
      return richResult.map((r) => this.mapToSocialContent(r));
    }

    // Strategy 2: Text-based field extraction
    const fields = this.extractFieldsFromText(cleaned);
    if (fields.caption || fields.hooks.length > 0) {
      return targetPlatforms.map((p) => ({
        platform: p,
        caption: fields.caption || cleaned,
        hooks: fields.hooks,
        cta: fields.cta || "",
        hashtags: fields.hashtags,
        trendingKeywords: fields.trendingKeywords,
      }));
    }

    // Strategy 3: Safe fallback
    log.warn("[SOCIAL_SERVICE] All parsing strategies failed, using text fallback");
    return targetPlatforms.map((p) => this.buildSafeFallback(p, cleaned));
  }

  /**
   * Map the rich AI response into the existing SocialMediaContent interface.
   *
   * Combines hook, caption, reelIdea, targetAudience, and designIdea into
   * a beautifully formatted caption string.  Hooks go into the hooks array,
   * keywords map to trendingKeywords.
   */
  private mapToSocialContent(ai: SocialAIResponse): SocialMediaContent {
    const platform = ai.platform as SocialPlatform;

    // Build a rich caption from all the AI fields
    const captionParts: string[] = [];

    if (ai.caption) {
      captionParts.push(ai.caption);
    }

    if (ai.reelIdea) {
      captionParts.push(`\n🎬 Reel/Idea:\n${ai.reelIdea}`);
    }

    if (ai.targetAudience) {
      captionParts.push(`\n🎯 Target Audience:\n${ai.targetAudience}`);
    }

    if (ai.designIdea) {
      captionParts.push(`\n🎨 Visual Direction:\n${ai.designIdea}`);
    }

    const caption = captionParts.join("\n\n") || ai.hook || "";

    // Hooks array
    const hooks = ai.hook ? [ai.hook] : [];

    // Keywords map to trendingKeywords
    const keywords = Array.isArray(ai.keywords) ? ai.keywords.filter(Boolean) : [];

    return {
      platform,
      caption,
      hooks,
      cta: ai.cta || "",
      hashtags: Array.isArray(ai.hashtags) ? ai.hashtags.filter(Boolean) : [],
      trendingKeywords: keywords,
    };
  }

  /**
   * Try parsing text as a JSON array of SocialAIResponse objects.
   */
  private tryParseJson(
    text: string,
    targetPlatforms: SocialPlatform[]
  ): SocialAIResponse[] | null {
    const candidates = [
      text,
      text.replace(/'/g, '"'),
      text.replace(/,([\s\n]*[}\]])/g, "$1"),
      text.replace(/'/g, '"').replace(/,([\s\n]*[}\]])/g, "$1"),
    ];

    for (const candidate of candidates) {
      try {
        const parsed = JSON.parse(candidate);
        const arr: unknown[] = Array.isArray(parsed) ? parsed : [parsed];

        const results: SocialAIResponse[] = arr
          .map((item, idx) => {
            const p = item as Record<string, unknown>;
            const platform = (p["platform"] as string) ?? targetPlatforms[idx] ?? targetPlatforms[0]!;
            return {
              platform,
              hook: this.safeStr(p["hook"]),
              caption: this.safeStr(p["caption"]),
              reelIdea: this.safeStr(p["reelIdea"] ?? p["reel_idea"] ?? p["reel"]),
              targetAudience: this.safeStr(p["targetAudience"] ?? p["target_audience"] ?? p["audience"]),
              cta: this.safeStr(p["cta"]),
              hashtags: this.asStringArray(p["hashtags"]),
              keywords: this.asStringArray(p["keywords"] ?? p["trendingKeywords"] ?? p["trending_keywords"]),
              designIdea: this.safeStr(p["designIdea"] ?? p["design_idea"] ?? p["visual"]),
            };
          })
          .filter((r): r is SocialAIResponse => !!r.platform);

        if (results.length > 0) return results;
      } catch {
        // try next candidate
      }
    }
    return null;
  }

  // ── Text-based fallback ─────────────────────────────────────────

  private extractFieldsFromText(text: string): {
    caption: string;
    hooks: string[];
    cta: string;
    hashtags: string[];
    trendingKeywords: string[];
  } {
    const result = {
      caption: "",
      hooks: [] as string[],
      cta: "",
      hashtags: [] as string[],
      trendingKeywords: [] as string[],
    };

    // Extract hook
    const hookMatch = text.match(/(?:Hook|Viral Hook)[:\s]*([^\n]+)/i);
    if (hookMatch) {
      result.hooks = [hookMatch[1]!.trim()];
    }

    // Extract caption (between "Caption:" and next section)
    const captionMatch = text.match(/(?:Caption|Post Content)[:\s]*([\s\S]*?)(?=\n\n*(?:Reel|Hook|CTA|Call to Action|Hashtag|Target|Audience|Design|Keyword|Platform))/i);
    if (captionMatch && captionMatch[1]!.trim()) {
      result.caption = captionMatch[1]!.trim();
    }

    // Extract CTA
    const ctaMatch = text.match(/(?:CTA|Call to Action)[:\s]*([^\n]+)/i);
    if (ctaMatch) {
      result.cta = ctaMatch[1]!.trim();
    }

    // Extract hashtags
    const hashtagMatch = text.match(/(?:Hashtag|Hashtags)[:\s]*([\s\S]*?)(?=\n\n*(?:Keyword|Trending|Design|Platform|$))/i);
    if (hashtagMatch) {
      result.hashtags = hashtagMatch[1]!
        .split(/[\s,]+/)
        .map((tag) => tag.trim())
        .filter((tag) => tag.startsWith("#") && tag.length > 1);
    }

    // Extract keywords
    const keywordMatch = text.match(/(?:Keyword|Keywords|Trending)[:\s]*([^\n]+)/i);
    if (keywordMatch) {
      result.trendingKeywords = keywordMatch[1]!
        .split(/[,]+/)
        .map((k) => k.trim())
        .filter((k) => k.length > 0);
    }

    return result;
  }

  // ── Fallback ────────────────────────────────────────────────────

  private buildSafeFallback(
    platform: SocialPlatform,
    topic: string
  ): SocialMediaContent {
    return {
      platform,
      caption: `📢 Marketing campaign for: ${topic}\n\nOur team is generating a complete content strategy for this topic. Stay tuned for optimized posts, hooks, and hashtags across all platforms.`,
      hooks: ["Learn more about " + topic],
      cta: "Share your thoughts in the comments!",
      hashtags: ["#" + topic.replace(/\s+/g, "").toLowerCase(), "#marketing", "#content", "#growth"],
      trendingKeywords: [topic, "marketing strategy", "content marketing"],
    };
  }

  // ── Helpers ─────────────────────────────────────────────────────

  private safeStr(val: unknown): string {
    if (typeof val === "string") return val;
    if (typeof val === "number" || typeof val === "boolean") return String(val);
    return "";
  }

  private asStringArray(val: unknown): string[] {
    if (Array.isArray(val)) {
      return val.map((v) => String(v)).filter(Boolean);
    }
    if (typeof val === "string") {
      return val.split(/[,;]+/).map((s) => s.trim()).filter(Boolean);
    }
    return [];
  }

  getPlatforms(): SocialPlatform[] {
    return [...this.platforms];
  }
}

export const socialAIService = new SocialAIService();
