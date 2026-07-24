/**
 * Enterprise Social Media AI Service
 */

import { BaseAIService } from "./base";
import type { SocialMediaContent, SocialPlatform } from "@/types";
import type { PlanType } from "@/config/ai";

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
You know the best practices for each platform.
You include hooks, CTAs, hashtags, and trending keywords.
Tone: ${tone}`;

    const userPrompt = `Create social media content for: "${topic}"

For each platform, provide:
- Caption/Post content
- 3-5 attention-grabbing hooks
- Call to action
- 10-15 relevant hashtags
- 5 trending keywords

Platforms: ${targetPlatforms.join(", ")}

Return as structured text with clear sections for each platform.`;

    const response = await this.executeAI(
      [{ role: "user", content: userPrompt }],
      systemPrompt,
      modelId,
      userPlan
    );

    return targetPlatforms.map((p) => ({
      platform: p,
      caption: response.content,
      hooks: [],
      cta: "",
      hashtags: [],
      trendingKeywords: [],
    }));
  }

  getPlatforms(): SocialPlatform[] {
    return [...this.platforms];
  }
}

export const socialAIService = new SocialAIService();
