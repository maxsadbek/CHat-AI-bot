/**
 * Enterprise Base AI Service Abstraction
 * Re-exports base types and interfaces for legacy backward compatibility.
 */

import { aiExecutor, AIExecutor } from "./core/executor";
import type { ChatRequest, ChatResponse } from "./providers/interface";
import type { FeatureType, PlanType } from "@/config/ai";

export interface AIProviderConfig {
  model: string;
  maxTokens: number;
  temperature: number;
}

export interface AICompletionParams {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AICompletionResult {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export abstract class BaseAIService {
  constructor(
    protected readonly feature: FeatureType,
    protected readonly executor: AIExecutor = aiExecutor
  ) {}

  protected async executeAI(
    messages: ChatRequest["messages"],
    systemPrompt?: string,
    modelId?: string,
    userPlan?: string | PlanType,
    temperature?: number
  ): Promise<ChatResponse> {
    return this.executor.execute({
      feature: this.feature,
      userPlan: typeof userPlan === "string" ? userPlan : undefined,
      modelId,
      request: {
        messages,
        systemPrompt,
        temperature,
      },
    });
  }
}
