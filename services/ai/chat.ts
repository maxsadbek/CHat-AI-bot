/**
 * AI Chat Service
 * Provides ChatGPT-like conversational AI with memory.
 * Uses the provider registry — no direct SDK calls.
 */

import { providerRegistry } from "@/services/ai/providers";
import type { ChatMessage } from "@/services/ai/providers";
import type { AIChatResponse } from "@/types";
import { config } from "@/config";

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
    messages: Array<{ role: "user" | "assistant"; content: string }>,
    userMessage: string,
    modelId?: string
  ): Promise<AIChatResponse> {
    const provider = providerRegistry.getProvider(modelId);

    const allMessages: ChatMessage[] = [
      ...messages.slice(-config.ai.maxHistoryLength).map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user" as const, content: userMessage },
    ];

    const response = await provider.chat({
      messages: allMessages,
      systemPrompt: this.systemPrompt,
      temperature: config.ai.temperature,
      maxTokens: config.ai.maxTokens,
      modelId,
    });

    return {
      content: response.content,
      usage: response.usage,
    };
  }

  /**
   * Stream a response from the AI
   */
  async *streamChat(
    messages: Array<{ role: "user" | "assistant"; content: string }>,
    userMessage: string,
    modelId?: string
  ): AsyncGenerator<string> {
    const provider = providerRegistry.getProvider(modelId);

    if (!provider.streamChat) {
      // Fallback: non-streaming
      const response = await this.chat(messages, userMessage, modelId);
      yield response.content;
      return;
    }

    const allMessages: ChatMessage[] = [
      ...messages.slice(-config.ai.maxHistoryLength).map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user" as const, content: userMessage },
    ];

    const stream = provider.streamChat({
      messages: allMessages,
      systemPrompt: this.systemPrompt,
      temperature: config.ai.temperature,
      maxTokens: config.ai.maxTokens,
      modelId,
    });

    for await (const chunk of stream) {
      yield chunk;
    }
  }
}

export const aiChatService = new AIChatService();
