/**
 * Enterprise Social Media AI Service v2
 *
 * Generates platform-optimized social media content with structured fields:
 * caption, hooks, CTA, hashtags, and trending keywords.
 *
 * The AI is instructed to return structured JSON. If JSON parsing fails,
 * a text-based field extractor attempts recovery; otherwise the raw
 * content is wrapped as a caption fallback.
 */

import { BaseAIService } from "./base";
import type { SocialMediaContent, SocialPlatform } from "@/types";
import type { PlanType } from "@/config/ai";
import { logger } from "@/bot/core/logger";

const log = logger.child("ai-social");

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

    const systemPrompt = `You are a professional social media content strategist.
You create viral, engaging, platform-optimized content.
You know the best practices for each platform: Instagram (visual, stories, reels),
TikTok (short-form, trends, sounds), Telegram (long-form, community),
Facebook (mixed media, shareable), LinkedIn (professional, thought leadership),
YouTube (long-form, SEO-optimized).

Tone: ${tone}

You MUST respond with a JSON array. NO markdown, NO code blocks, NO explanations.
EVERY object in the array must have ALL of these fields:

[
  {
    "platform": "Instagram",
    "caption": "Full optimized caption/post content for this platform",
    "hooks": ["Hook 1 that grabs attention", "Hook 2", "Hook 3", "Hook 4", "Hook 5"],
    "cta": "Clear call to action tailored to this platform and content",
    "hashtags": ["#hashtag1", "#hashtag2", "#hashtag3", "#hashtag4", "#hashtag5", "#hashtag6", "#hashtag7", "#hashtag8", "#hashtag9", "#hashtag10"],
    "trendingKeywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"]
  }
]

Return ONLY the JSON array. No markdown. No explanation.`;

    const userPrompt = `Create social media content for: "${topic}"

Platforms: ${targetPlatforms.join(", ")}

For each platform, provide platform-optimized content that will perform well.
Include attention-grabbing hooks, a strong call to action, relevant hashtags,
and trending keywords.

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
        systemPrompt,
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
      // Graceful fallback: wrap raw content as caption
      return targetPlatforms.map((p) => this.buildSafeFallback(p, topic));
    }
  }

  /**
   * Parse AI response: JSON → text extraction → safe fallback
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
    const jsonResult = this.tryParseJson(cleaned, targetPlatforms);
    if (jsonResult) return jsonResult;

    // Strategy 2: Text-based field extraction
    const fields = this.extractFieldsFromText(cleaned);
    if (fields.caption) {
      return targetPlatforms.map((p, _) => ({
        platform: p,
        caption: fields.caption || cleaned,
        hooks: fields.hooks,
        cta: fields.cta || "",
        hashtags: fields.hashtags,
        trendingKeywords: fields.trendingKeywords,
      }));
    }

    // Strategy 3: Safe fallback — wrap raw content as caption
    log.warn("[SOCIAL_SERVICE] All parsing failed, using text fallback");
    return targetPlatforms.map((p) => this.buildSafeFallback(p, cleaned));
  }

  /**
   * Try parsing text as a JSON array with multiple fix-up strategies.
   */
  private tryParseJson(
    text: string,
    targetPlatforms: SocialPlatform[]
  ): SocialMediaContent[] | null {
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

        const results: SocialMediaContent[] = arr
          .map((item, idx) => {
            const p = item as Record<string, unknown>;
            const platform = (p["platform"] as SocialPlatform) ?? targetPlatforms[idx] ?? targetPlatforms[0]!;
            return {
              platform,
              caption: this.safeStr(p["caption"]) || text,
              hooks: Array.isArray(p["hooks"]) ? (p["hooks"] as string[]).filter(Boolean) : [],
              cta: this.safeStr(p["cta"]),
              hashtags: Array.isArray(p["hashtags"]) ? (p["hashtags"] as string[]).filter(Boolean) : [],
              trendingKeywords: Array.isArray(p["trendingKeywords"]) ? (p["trendingKeywords"] as string[]).filter(Boolean) : [],
            };
          })
          .filter((r): r is SocialMediaContent => !!r.platform);

        if (results.length > 0) return results;
      } catch {
        // try next candidate
      }
    }
    return null;
  }

  /**
   * Extract fields from text-based "Header: value" format
   */
  private extractFieldsFromText(text: string): {
    caption: string;
    hooks: string[];
    cta: string;
    hashtags: string[];
    trendingKeywords: string[];
  } {
    const result = { caption: "", hooks: [] as string[], cta: "", hashtags: [] as string[], trendingKeywords: [] as string[] };

    // Extract caption (everything before first recognized section)
    const captionMatch = text.match(/^([\s\S]*?)(?:\n\n*(?:Hook|CTA|Call to Action|Hashtag|Trending|Keyword)|$)/i);
    if (captionMatch && captionMatch[1]!.trim()) {
      result.caption = captionMatch[1]!.trim();
    }

    // Extract hooks
    const hookSection = text.match(/(?:Hook|Hooks)[:\s]*([\s\S]*?)(?=\n\n*(?:CTA|Call to Action|Hashtag|Trending|Keyword|Platform))/i);
    if (hookSection) {
      result.hooks = hookSection[1]!
        .split("\n")
        .map((line) => line.replace(/^[-*\d.]+\s*/, "").trim())
        .filter((line) => line.length > 5);
    }

    // Extract CTA
    const ctaMatch = text.match(/(?:CTA|Call to Action)[:\s]*([^\n]+)/i);
    if (ctaMatch) {
      result.cta = ctaMatch[1]!.trim();
    }

    // Extract hashtags
    const hashtagMatch = text.match(/(?:Hashtag|Hashtags)[:\s]*([\s\S]*?)(?=\n\n*(?:Trending|Keyword|Platform|$))/i);
    if (hashtagMatch) {
      result.hashtags = hashtagMatch[1]!
        .split(/[\s,]+/)
        .map((tag) => tag.trim())
        .filter((tag) => tag.startsWith("#") && tag.length > 1);
    }

    // Extract trending keywords
    const trendMatch = text.match(/(?:Trending|Keywords?)[:\s]*([^\n]+)/i);
    if (trendMatch) {
      result.trendingKeywords = trendMatch[1]!
        .split(/[,]+/)
        .map((k) => k.trim())
        .filter((k) => k.length > 0);
    }

    return result;
  }

  /**
   * Safe fallback when all parsing fails
   */
  private buildSafeFallback(
    platform: SocialPlatform,
    content: string
  ): SocialMediaContent {
    return {
      platform,
      caption: content,
      hooks: [],
      cta: "",
      hashtags: [],
      trendingKeywords: [],
    };
  }

  private safeStr(val: unknown): string {
    if (typeof val === "string") return val;
    if (typeof val === "number" || typeof val === "boolean") return String(val);
    return "";
  }

  getPlatforms(): SocialPlatform[] {
    return [...this.platforms];
  }
}

export const socialAIService = new SocialAIService();
