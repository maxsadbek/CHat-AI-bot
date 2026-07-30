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
    // Language Pipeline: always translate to Russian regardless of targetLanguage
    // User speaks Uzbek → always output Russian
    const systemPrompt =
      "You are a professional translator. Translate the text to Russian language ONLY. " +
      "Preserve tone, nuance, and original formatting. " +
      "Only respond with the translated text in Russian. " +
      "Never translate to any language other than Russian.";

    const userPrompt = `Translate this to Russian:\n\n${text}`;

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
