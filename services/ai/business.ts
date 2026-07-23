import { providerRegistry } from "@/services/ai/providers";
import type { BusinessContent, BusinessContentType } from "@/types";

export class BusinessAIService {
  private readonly types: BusinessContentType[] = [
    "startup_idea", "business_plan", "marketing_strategy",
    "brand_name", "slogan", "logo_prompt", "color_palette", "landing_page_copy",
  ];

  async generate(
    description: string,
    type: BusinessContentType,
    modelId?: string
  ): Promise<BusinessContent> {
    const prompts: Record<BusinessContentType, string> = {
      startup_idea: "Generate innovative startup ideas based on this description",
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

    const userPrompt = `Generate ${type.replace(/_/g, " ")} for: "${description}"

Provide detailed, actionable content with examples and explanations.
Format with clear sections and bullet points where appropriate.`;

    const provider = providerRegistry.getProvider(modelId);

    const response = await provider.chat({
      messages: [{ role: "user", content: userPrompt }],
      systemPrompt,
      temperature: 0.8,
      maxTokens: 4096,
      modelId,
    });

    return {
      type,
      content: response.content,
    };
  }

  getTypes(): BusinessContentType[] {
    return [...this.types];
  }
}

export const businessAIService = new BusinessAIService();
