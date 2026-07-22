import { openai } from "@/lib/openai";
import { env, config } from "@/config";
import type { SocialMediaContent, SocialPlatform } from "@/types";

/**
 * Social Media AI Service
 * Generates platform-optimized social media content
 */
export class SocialAIService {
  private readonly platforms: SocialPlatform[] = [
    "Instagram",
    "TikTok",
    "Telegram",
    "Facebook",
    "LinkedIn",
    "YouTube",
  ];

  /**
   * Generate social media content for a topic
   */
  async generateContent(
    topic: string,
    platform?: SocialPlatform,
    tone: string = "professional"
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

    const completion = await openai.chat.completions.create({
      model: env.OPENAI_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: config.ai.maxTokens,
      temperature: 0.8,
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) throw new Error("No response from AI");

    return targetPlatforms.map((p) => ({
      platform: p,
      caption: response,
      hooks: [],
      cta: "",
      hashtags: [],
      trendingKeywords: [],
    }));
  }

  /**
   * Get available platforms
   */
  getPlatforms(): SocialPlatform[] {
    return [...this.platforms];
  }
}

export const socialAIService = new SocialAIService();
