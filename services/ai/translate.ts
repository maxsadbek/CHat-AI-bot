/**
 * Enterprise Translation AI Service
 */

import { BaseAIService } from "./base";
import type { PlanType } from "@/config/ai";

export class TranslateAIService extends BaseAIService {
  constructor() {
    super("translate");
  }

  async translateText(
    text: string,
    targetLanguage: string,
    modelId?: string,
    userPlan?: string | PlanType
  ): Promise<string> {
    const systemPrompt =
      "You are a professional translator. Translate the text accurately while preserving tone, nuance, and original formatting. Only respond with the translated text.";

    const userPrompt = `Translate this to ${targetLanguage}:\n\n${text}`;

    const response = await this.executeAI(
      [{ role: "user", content: userPrompt }],
      systemPrompt,
      modelId,
      userPlan
    );

    return response.content;
  }
}

export const translateAIService = new TranslateAIService();
