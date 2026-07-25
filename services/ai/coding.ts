/**
 * Enterprise Coding AI Service
 * Generates, debugs, and explains code using central AI execution pipeline.
 *
 * Optimized: concise prompts, trimmed whitespace, reduced token usage.
 */

import { BaseAIService } from "./base";
import type { CodeGeneration, CodeLanguage } from "@/types";
import type { PlanType } from "@/config/ai";

export class CodingAIService extends BaseAIService {
  private readonly languages: CodeLanguage[] = [
    "HTML", "CSS", "React", "Next.js", "Tailwind",
    "Node.js", "Express", "Prisma", "SQL", "API",
  ];

  constructor() {
    super("coding");
  }

  async generate(
    description: string,
    language: CodeLanguage,
    modelId?: string,
    userPlan?: string | PlanType
  ): Promise<CodeGeneration> {
    // Optimized: concise system prompt, reduced token usage
    const systemPrompt = "You are an expert software engineer. Write clean, production-ready code following best practices.";
    // Optimized: trimmed unnecessary bullet points
    const userPrompt = `Generate ${language} code for: "${description}"

Provide the complete code with explanation and usage instructions. Ensure it is production-ready, well-commented, and includes error handling.`;

    const response = await this.executeAI(
      [{ role: "user", content: userPrompt }],
      systemPrompt,
      modelId,
      userPlan
    );

    return {
      language,
      code: response.content,
      explanation: "",
    };
  }

  async debug(
    code: string,
    language: string,
    modelId?: string,
    userPlan?: string | PlanType
  ): Promise<CodeGeneration> {
    const systemPrompt = "You are an expert debugger. Find and fix issues in code.";
    const userPrompt = `Debug this ${language} code:\n\n${code}\n\nProvide: fixed code, issues found, fixes explanation, prevention tips.`;

    const response = await this.executeAI(
      [{ role: "user", content: userPrompt }],
      systemPrompt,
      modelId,
      userPlan
    );

    return {
      language: language as CodeLanguage,
      code: response.content,
      explanation: "",
    };
  }

  async explain(
    code: string,
    language: string,
    modelId?: string,
    userPlan?: string | PlanType
  ): Promise<string> {
    const systemPrompt = "You are an expert programming teacher. Explain code clearly and thoroughly.";
    const userPrompt = `Explain this ${language} code:\n\n${code}\n\nCover: what it does, how it works, key concepts, potential improvements.`;

    const response = await this.executeAI(
      [{ role: "user", content: userPrompt }],
      systemPrompt,
      modelId,
      userPlan
    );

    return response.content;
  }

  getLanguages(): CodeLanguage[] {
    return [...this.languages];
  }
}

export const codingAIService = new CodingAIService();
