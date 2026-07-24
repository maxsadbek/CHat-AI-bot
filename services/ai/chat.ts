/**
 * Enterprise AI Chat Service
 * Provides ChatGPT-like conversational AI with memory.
 * Uses Central Executor, Dependency Injection, and Dynamic Token Allocation.
 */

import { BaseAIService } from "./base";
import { providerRegistry } from "./providers";
import type { ChatMessage } from "./providers";
import type { AIChatResponse } from "@/types";
import type { PlanType } from "@/config/ai";

export class AIChatService extends BaseAIService {
  private readonly systemPrompt = `You are AI Creator Studio, a premium AI assistant.
You are helpful, creative, and professional.
You respond in clear markdown format.
You support conversations, code generation, and creative tasks.
Keep responses concise but comprehensive.
Use emojis occasionally to make responses engaging.
Current date: ${new Date().toISOString().split("T")[0] ?? "unknown"}.`;

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
   */
  async *streamChat(
    messages: Array<{ role: "user" | "assistant"; content: string }>,
    userMessage: string,
    modelId?: string,
    userPlan?: string | PlanType
  ): AsyncGenerator<string> {
    const provider = providerRegistry.getProvider(modelId);

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
      systemPrompt: this.systemPrompt,
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
