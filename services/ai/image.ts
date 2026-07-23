/**
 * Image AI Service
 * Generates detailed prompts for various image AI platforms.
 * Uses the provider registry — no direct SDK calls.
 */

import { providerRegistry } from "@/services/ai/providers";
import type { ImagePrompt, ImagePlatform } from "@/types";

export class ImageAIService {
  private readonly platforms: ImagePlatform[] = [
    "GPT Image",
    "Flux",
    "Midjourney",
    "Leonardo",
    "Ideogram",
  ];

  /**
   * Generate image prompts based on user description
   */
  async generatePrompt(
    description: string,
    platform?: ImagePlatform,
    modelId?: string
  ): Promise<ImagePrompt[]> {
    const targetPlatforms = platform ? [platform] : this.platforms;

    const systemPrompt = `You are a professional AI image prompt engineer.
You craft stunning, detailed prompts for AI image generation platforms.
Each prompt must include: composition, lighting, camera type, mood, quality parameters, and negative prompts.
Be artistic and precise.`;

    const userPrompt = `Generate image prompts for: "${description}"

For each platform, provide structured prompts with:
- Composition: Framing, rule of thirds, perspective
- Lighting: Light source, type, mood
- Camera: Camera type, lens, settings
- Mood: Emotional tone and atmosphere
- Quality: Resolution, style, render quality
- Negative Prompt: What to exclude

Platforms: ${targetPlatforms.join(", ")}

Return the response as structured text with clear sections for each platform.`;

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
      composition: "",
      lighting: "",
      camera: "",
      mood: "",
      quality: "",
      negativePrompt: "",
      fullPrompt: response.content,
    }));
  }

  /**
   * Get available platforms
   */
  getPlatforms(): ImagePlatform[] {
    return [...this.platforms];
  }
}

export const imageAIService = new ImageAIService();
