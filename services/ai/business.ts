import { openai } from "@/lib/openai";
import { env, config } from "@/config";
import type { BusinessContent, BusinessContentType } from "@/types";

/**
 * Business AI Service
 * Generates business content: ideas, plans, strategies, branding
 */
export class BusinessAIService {
  private readonly types: BusinessContentType[] = [
    "startup_idea",
    "business_plan",
    "marketing_strategy",
    "brand_name",
    "slogan",
    "logo_prompt",
    "color_palette",
    "landing_page_copy",
  ];

  /**
   * Generate business content
   */
  async generate(
    description: string,
    type: BusinessContentType
  ): Promise<BusinessContent> {
    const prompts: Record<BusinessContentType, string> = {
      startup_idea:
        "Generate innovative startup ideas based on this description",
      business_plan: "Create a comprehensive business plan",
      marketing_strategy: "Develop a detailed marketing strategy",
      brand_name: "Generate creative brand name suggestions",
      slogan: "Create memorable slogans and taglines",
      logo_prompt: "Generate detailed logo design prompts for AI",
      color_palette: "Suggest professional color palettes with hex codes",
      landing_page_copy: "Write compelling landing page copy",
    };

    const systemPrompt = `You are a professional business consultant and strategist.
You provide actionable, data-driven business advice.
You think like a top-tier startup advisor.
${prompts[type]}.`;

    const completion = await openai.chat.completions.create({
      model: env.OPENAI_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Generate ${type.replace(/_/g, " ")} for: "${description}"

Provide detailed, actionable content with examples and explanations.
Format with clear sections and bullet points where appropriate.`,
        },
      ],
      max_tokens: config.ai.maxTokens,
      temperature: 0.8,
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) throw new Error("No response from AI");

    return {
      type,
      content: response,
    };
  }

  /**
   * Get available content types
   */
  getTypes(): BusinessContentType[] {
    return [...this.types];
  }
}

export const businessAIService = new BusinessAIService();
