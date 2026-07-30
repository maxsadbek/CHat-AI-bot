/**
 * Enterprise AI Chat Service
 * Provides ChatGPT-like conversational AI with memory.
 * Uses Central Executor, Dependency Injection, and Dynamic Token Allocation.
 *
 * Optimized: concise system prompt, reduced token usage.
 */

import { BaseAIService, RUSSIAN_ONLY_INSTRUCTION } from "./base";
import { providerRegistry } from "./providers";
import type { ChatMessage } from "./providers";
import type { AIChatResponse } from "@/types";
import type { PlanType } from "@/config/ai";

export class AIChatService extends BaseAIService {
  // Optimized: concise system prompt, trimmed whitespace
  private readonly systemPrompt = [
    `You are AI Creator Studio, a helpful AI assistant.`,
    `Current date: ${new Date().toISOString().split("T")[0] ?? "unknown"}.`,
  ].join(" ");

  constructor() {
    super("chat");
  }

  /**
   * Send a message to the AI and get a response
   */
  async chat(
    messages: Array<{ role: "user" | "assistant"; content: string }>,
    userMessage: string,
    modelId?: string,
    userPlan?: string | PlanType
  ): Promise<AIChatResponse> {
    const allMessages: ChatMessage[] = [
      ...messages.slice(-20).map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user" as const, content: userMessage },
    ];

    const response = await this.executeAI(
      allMessages,
      this.systemPrompt,
      modelId,
      userPlan
    );

    return {
      content: response.content,
      usage: response.usage,
    };
  }

  /**
   * Stream a response from the AI
   * NOTE: Uses the same Russian-only enforcement as executeAI().
   * The RUSSIAN_ONLY_INSTRUCTION is appended to the system prompt
   * before passing to the provider's streaming method.
   */
  async *streamChat(
    messages: Array<{ role: "user" | "assistant"; content: string }>,
    userMessage: string,
    modelId?: string,
    userPlan?: string | PlanType
  ): AsyncGenerator<string> {
    const provider = providerRegistry.getProvider(modelId);

    // Compose full system prompt with Russian-only instruction
    // Uses the same constant from BaseAIService.executeAI() for consistency
    const fullSystemPrompt = this.systemPrompt + RUSSIAN_ONLY_INSTRUCTION;

    if (!provider.streamChat) {
      const response = await this.chat(messages, userMessage, modelId, userPlan);
      yield response.content;
      return;
    }

    const allMessages: ChatMessage[] = [
      ...messages.slice(-20).map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user" as const, content: userMessage },
    ];

    const stream = provider.streamChat({
      messages: allMessages,
      systemPrompt: fullSystemPrompt,
      modelId,
      feature: "chat",
      userPlan,
    });

    for await (const chunk of stream) {
      yield chunk;
    }
  }
}

export const aiChatService = new AIChatService();
