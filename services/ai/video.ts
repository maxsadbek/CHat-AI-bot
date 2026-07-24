/**
 * Enterprise Video AI Prompt Service
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

    const systemPrompt = `You are a professional video prompt engineer.
Generate detailed, production-ready video prompts for AI video platforms.
Each prompt must include: scene description, lighting, camera movement, lens type, environment, negative prompt, voice style, music style, duration, and visual style.
Be specific and cinematic.`;

    const userPrompt = `Generate video prompts for: "${description}"

For each platform, provide a structured prompt with ALL of these elements:
- Scene: Detailed visual description
- Lighting: Lighting setup and mood
- Camera Movement: Camera motion details
- Lens: Lens type and focal length
- Environment: Setting and atmosphere
- Negative Prompt: What to avoid
- Voice: Voice style and tone
- Music: Music genre and mood
- Duration: Recommended length
- Style: Overall visual style

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
