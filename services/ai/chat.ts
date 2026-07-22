import { openai } from "@/lib/openai";
import { env, config } from "@/config";
import type { AIChatMessage, AIChatResponse } from "@/types";

/**
 * AI Chat Service
 * Provides ChatGPT-like conversational AI with memory
 */
export class AIChatService {
  private readonly systemPrompt = `You are AI Creator Studio, a premium AI assistant.
You are helpful, creative, and professional.
You respond in clear markdown format.
You support conversations, code generation, and creative tasks.
Keep responses concise but comprehensive.
Use emojis occasionally to make responses engaging.
Current date: ${new Date().toISOString().split("T")[0] ?? "unknown"}.`;

  /**
   * Send a message to the AI and get a response
   */
  async chat(
    messages: AIChatMessage[],
    userMessage: string
  ): Promise<AIChatResponse> {
    const completion = await openai.chat.completions.create({
      model: env.OPENAI_MODEL,
      messages: [
        { role: "system", content: this.systemPrompt },
        ...messages.slice(-config.ai.maxHistoryLength),
        { role: "user", content: userMessage },
      ],
      max_tokens: config.ai.maxTokens,
      temperature: config.ai.temperature,
    });

    const choice = completion.choices[0];
    if (!choice?.message?.content) {
      throw new Error("No response from AI");
    }

    return {
      content: choice.message.content,
      usage: completion.usage
        ? {
            promptTokens: completion.usage.prompt_tokens,
            completionTokens: completion.usage.completion_tokens,
            totalTokens: completion.usage.total_tokens,
          }
        : undefined,
    };
  }

  /**
   * Stream a response from the AI (for future use)
   */
  async *streamChat(
    messages: AIChatMessage[],
    userMessage: string
  ): AsyncGenerator<string> {
    const stream = await openai.chat.completions.create({
      model: env.OPENAI_MODEL,
      messages: [
        { role: "system", content: this.systemPrompt },
        ...messages.slice(-config.ai.maxHistoryLength),
        { role: "user", content: userMessage },
      ],
      max_tokens: config.ai.maxTokens,
      temperature: config.ai.temperature,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        yield content;
      }
    }
  }
}

export const aiChatService = new AIChatService();
