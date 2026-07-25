/**
 * Enterprise Image AI Prompt Service
 *
 * Optimized: concise prompts, trimmed whitespace, reduced token usage.
 */

import { BaseAIService } from "./base";
import type { ImagePrompt, ImagePlatform } from "@/types";
import type { PlanType } from "@/config/ai";
import { providerRegistry } from "./providers/registry";

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

    // Optimized: concise system prompt, reduced token usage
    const systemPrompt = "You are an AI image prompt engineer. Craft detailed, artistic prompts including composition, lighting, camera, mood, and quality parameters.";

    // Optimized: trimmed unnecessary formatting instructions
    const userPrompt = `Generate image prompts for: "${description}"

Platforms: ${targetPlatforms.join(", ")}

Include: composition, lighting, camera, mood, quality, negative prompt.`;

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

  async generateImage(
    prompt: string,
    platform: string,
    modelId?: string
  ): Promise<string | Buffer> {
    const provider = providerRegistry.getProviderById(platform);
    if (!provider.generateImage) {
      throw new Error(`The provider ${platform} does not support direct image generation.`);
    }
    return await provider.generateImage(prompt, modelId);
  }
}

export const imageAIService = new ImageAIService();
