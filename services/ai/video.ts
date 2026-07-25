/**
 * Enterprise Video AI Prompt Service
 *
 * Optimized: concise prompts, trimmed whitespace, reduced token usage.
 */

import { BaseAIService } from "./base";
import type { VideoPrompt, VideoPlatform } from "@/types";
import type { PlanType } from "@/config/ai";

export class VideoAIService extends BaseAIService {
  private readonly platforms: VideoPlatform[] = [
    "Hailuo AI",
    "Kling AI",
    "Google Veo",
    "Runway",
    "PixVerse",
  ];

  constructor() {
    super("video");
  }

  async generatePrompt(
    description: string,
    platform?: VideoPlatform,
    modelId?: string,
    userPlan?: string | PlanType
  ): Promise<VideoPrompt[]> {
    const targetPlatforms = platform ? [platform] : this.platforms;

    // Optimized: concise system prompt, reduced token usage
    const systemPrompt = "You are a video prompt engineer. Generate detailed, production-ready video prompts including scene, lighting, camera movement, and visual style.";

    // Optimized: trimmed unnecessary formatting instructions
    const userPrompt = `Generate video prompts for: "${description}"

Platforms: ${targetPlatforms.join(", ")}

Include: scene, lighting, camera movement, lens, environment, negative prompt, voice, music, duration, style.`;

    const response = await this.executeAI(
      [{ role: "user", content: userPrompt }],
      systemPrompt,
      modelId,
      userPlan
    );

    return targetPlatforms.map((p) => ({
      platform: p,
      scene: "",
      lighting: "",
      cameraMovement: "",
      lens: "",
      environment: "",
      negativePrompt: "",
      fullPrompt: response.content,
      voice: "",
      music: "",
      duration: "",
      style: "",
    }));
  }

  getPlatforms(): VideoPlatform[] {
    return [...this.platforms];
  }
}

export const videoAIService = new VideoAIService();
