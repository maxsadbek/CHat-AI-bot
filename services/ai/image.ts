/**
 * Enterprise Image AI Prompt Service
 */

import { BaseAIService } from "./base";
import type { ImagePrompt, ImagePlatform } from "@/types";
import type { PlanType } from "@/config/ai";

export class ImageAIService extends BaseAIService {
  private readonly platforms: ImagePlatform[] = [
    "GPT Image",
    "Flux",
    "Midjourney",
    "Leonardo",
    "Ideogram",
  ];

  constructor() {
    super("image");
  }

  async generatePrompt(
    description: string,
    platform?: ImagePlatform,
    modelId?: string,
    userPlan?: string | PlanType
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

    const response = await this.executeAI(
      [{ role: "user", content: userPrompt }],
      systemPrompt,
      modelId,
      userPlan
    );

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

  getPlatforms(): ImagePlatform[] {
    return [...this.platforms];
  }
}

export const imageAIService = new ImageAIService();
