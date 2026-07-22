import { openai } from "@/lib/openai";
import { env, config } from "@/config";
import type { VideoPrompt, VideoPlatform } from "@/types";

/**
 * Video AI Service
 * Generates professional prompts for various video AI platforms
 */
export class VideoAIService {
  private readonly platforms: VideoPlatform[] = [
    "Hailuo AI",
    "Kling AI",
    "Google Veo",
    "Runway",
    "PixVerse",
  ];

  /**
   * Generate video prompts based on user description
   */
  async generatePrompt(
    description: string,
    platform?: VideoPlatform
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

    // Return parsed prompts based on the response
    return targetPlatforms.map((p) => ({
      platform: p,
      scene: "",
      lighting: "",
      cameraMovement: "",
      lens: "",
      environment: "",
      negativePrompt: "",
      voice: "",
      music: "",
      duration: "",
      style: "",
      fullPrompt: response,
    }));
  }

  /**
   * Get available platforms
   */
  getPlatforms(): VideoPlatform[] {
    return [...this.platforms];
  }
}

export const videoAIService = new VideoAIService();
