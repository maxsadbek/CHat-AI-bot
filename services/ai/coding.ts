import { providerRegistry } from "@/services/ai/providers";
import type { CodeGeneration, CodeLanguage } from "@/types";

export class CodingAIService {
  private readonly languages: CodeLanguage[] = [
    "HTML", "CSS", "React", "Next.js", "Tailwind",
    "Node.js", "Express", "Prisma", "SQL", "API",
  ];

  async generate(
    description: string,
    language: CodeLanguage,
    modelId?: string
  ): Promise<CodeGeneration> {
    const systemPrompt = `You are an expert software engineer.
You write clean, production-ready code.
You follow best practices and design patterns.
You provide explanations with your code.`;

    const userPrompt = `Generate ${language} code for: "${description}"

Provide:
1. The complete code with proper formatting
2. Explanation of how the code works
3. Usage instructions

Make sure the code is:
- Production-ready
- Well-commented
- Following best practices
- Error-handled`;

    const provider = providerRegistry.getProvider(modelId);

    const response = await provider.chat({
      messages: [{ role: "user", content: userPrompt }],
      systemPrompt,
      temperature: 0.3,
      maxTokens: 4096,
      modelId,
    });

    return {
      language,
      code: response.content,
      explanation: "",
    };
  }

  async debug(code: string, language: string, modelId?: string): Promise<CodeGeneration> {
    const provider = providerRegistry.getProvider(modelId);

    const response = await provider.chat({
      messages: [{
        role: "user",
        content: `Debug this ${language} code and explain the issues:\n\n${code}\n\nProvide:\n1. The fixed code\n2. List of issues found\n3. Explanation of fixes\n4. Prevention tips`,
      }],
      systemPrompt: "You are an expert debugger. Find and fix issues in code.",
      temperature: 0.3,
      maxTokens: 4096,
      modelId,
    });

    return {
      language: language as CodeLanguage,
      code: response.content,
      explanation: "",
    };
  }

  async explain(code: string, language: string, modelId?: string): Promise<string> {
    const provider = providerRegistry.getProvider(modelId);

    const response = await provider.chat({
      messages: [{
        role: "user",
        content: `Explain this ${language} code in detail:\n\n${code}\n\nCover:\n- What the code does\n- How it works (line by line)\n- Key concepts used\n- Potential improvements`,
      }],
      systemPrompt: "You are an expert programming teacher. Explain code clearly and thoroughly.",
      temperature: 0.5,
      maxTokens: 4096,
      modelId,
    });

    return response.content;
  }

  getLanguages(): CodeLanguage[] {
    return [...this.languages];
  }
}

export const codingAIService = new CodingAIService();
