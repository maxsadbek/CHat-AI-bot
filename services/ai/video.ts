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

    const systemPrompt = `You are a professional cinematic AI video prompt engineer. Create production-ready prompts for AI video generators like Hailuo AI, Kling AI, Runway and Veo. Include camera movement, lens, lighting, environment, physics, motion, realism, negative prompts, sound design and cinematic style.

For each platform, respond with EXACTLY this format (no deviations):

Scene: [describe the scene in detail]
Camera: [camera angle and position]
Lens: [lens type, focal length]
Movement: [camera movement description]
Environment: [setting, time of day, weather]
Lighting: [lighting setup and mood]
Physics: [physics and motion details]
Style: [visual style, color grading]
Negative prompt: [what to avoid]
Sound: [sound design and music]
Duration: [suggested clip duration]`;

    const userPrompt = `Generate a professional cinematic video prompt for the following idea:

"${description}"

Platform: ${targetPlatforms.join(", ")}

Provide the prompt using the exact structured format specified. Be detailed, cinematic, and production-ready.`;

    const response = await this.executeAI(
      [{ role: "user", content: userPrompt }],
      systemPrompt,
      modelId,
      userPlan
    );

    // Parse structured fields from response text
    const parse = (field: string): string => {
      const regex = new RegExp(`${field}:\\s*([^\\n]+)`, "i");
      const match = response.content.match(regex);
      return match ? match[1]!.trim() : "";
    };

    return targetPlatforms.map((p) => ({
      platform: p,
      scene: parse("Scene"),
      lighting: parse("Lighting"),
      cameraMovement: parse("Camera"),
      lens: parse("Lens"),
      environment: parse("Environment"),
      negativePrompt: parse("Negative prompt"),
      fullPrompt: response.content,
      voice: parse("Sound"),
      music: parse("Sound"),
      duration: parse("Duration"),
      style: parse("Style"),
    }));
  }

  getPlatforms(): VideoPlatform[] {
    return [...this.platforms];
  }
}

export const videoAIService = new VideoAIService();
