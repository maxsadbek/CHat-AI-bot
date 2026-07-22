import { openai } from "@/lib/openai";
import { env, config } from "@/config";
import type { ImagePrompt, ImagePlatform } from "@/types";

/**
 * Image AI Service
 * Generates detailed prompts for various image AI platforms
 */
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
    platform?: ImagePlatform
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
      composition: "",
      lighting: "",
      camera: "",
      mood: "",
      quality: "",
      negativePrompt: "",
      fullPrompt: response,
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
