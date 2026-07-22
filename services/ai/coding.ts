import { openai } from "@/lib/openai";
import { env, config } from "@/config";
import type { CodeGeneration, CodeLanguage } from "@/types";

/**
 * Coding AI Service
 * Generates code, explains code, and helps with programming tasks
 */
export class CodingAIService {
  private readonly languages: CodeLanguage[] = [
    "HTML",
    "CSS",
    "React",
    "Next.js",
    "Tailwind",
    "Node.js",
    "Express",
    "Prisma",
    "SQL",
    "API",
  ];

  /**
   * Generate code based on user description
   */
  async generate(
    description: string,
    language: CodeLanguage
  ): Promise<CodeGeneration> {
    const systemPrompt = `You are an expert software engineer.
You write clean, production-ready code.
You follow best practices and design patterns.
You provide explanations with your code.`;

    const completion = await openai.chat.completions.create({
      model: env.OPENAI_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Generate ${language} code for: "${description}"

Provide:
1. The complete code with proper formatting
2. Explanation of how the code works
3. Usage instructions

Make sure the code is:
- Production-ready
- Well-commented
- Following best practices
- Error-handled`,
        },
      ],
      max_tokens: config.ai.maxTokens,
      temperature: 0.3,
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) throw new Error("No response from AI");

    return {
      language,
      code: response,
      explanation: "",
    };
  }

  /**
   * Debug and fix code
   */
  async debug(code: string, language: string): Promise<CodeGeneration> {
    const completion = await openai.chat.completions.create({
      model: env.OPENAI_MODEL,
      messages: [
        {
          role: "system",
          content: "You are an expert debugger. Find and fix issues in code.",
        },
        {
          role: "user",
          content: `Debug this ${language} code and explain the issues:

${code}

Provide:
1. The fixed code
2. List of issues found
3. Explanation of fixes
4. Prevention tips`,
        },
      ],
      max_tokens: config.ai.maxTokens,
      temperature: 0.3,
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) throw new Error("No response from AI");

    return {
      language: language as CodeLanguage,
      code: response,
      explanation: "",
    };
  }

  /**
   * Explain code
   */
  async explain(code: string, language: string): Promise<string> {
    const completion = await openai.chat.completions.create({
      model: env.OPENAI_MODEL,
      messages: [
        {
          role: "system",
          content:
            "You are an expert programming teacher. Explain code clearly and thoroughly.",
        },
        {
          role: "user",
          content: `Explain this ${language} code in detail:

${code}

Cover:
- What the code does
- How it works (line by line)
- Key concepts used
- Potential improvements`,
        },
      ],
      max_tokens: config.ai.maxTokens,
      temperature: 0.5,
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) throw new Error("No response from AI");

    return response;
  }

  /**
   * Get available languages
   */
  getLanguages(): CodeLanguage[] {
    return [...this.languages];
  }
}

export const codingAIService = new CodingAIService();
