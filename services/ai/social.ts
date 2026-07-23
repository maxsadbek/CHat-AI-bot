import { providerRegistry } from "@/services/ai/providers";
import type { SocialMediaContent, SocialPlatform } from "@/types";

export class SocialAIService {
  private readonly platforms: SocialPlatform[] = [
    "Instagram", "TikTok", "Telegram", "Facebook", "LinkedIn", "YouTube",
  ];

  async generateContent(
    topic: string,
    platform?: SocialPlatform,
    tone: string = "professional",
    modelId?: string
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

    const provider = providerRegistry.getProvider(modelId);

    const response = await provider.chat({
      messages: [{ role: "user", content: userPrompt }],
      systemPrompt,
      temperature: 0.8,
      maxTokens: 4096,
      modelId,
    });

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
