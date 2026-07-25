/**
 * Core AI Provider Interfaces
 * Dependency Inversion Principle: Business logic only knows about AIProvider.
 */

import type { FeatureType, PlanType } from "@/config/ai";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  modelId?: string;
  feature?: FeatureType;
  userPlan?: string | PlanType;
}

export interface ChatResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
  provider: string;
  costUsd?: number;
}

export interface ModelCapabilities {
  streaming: boolean;
  vision: boolean;
  functionCalling: boolean;
  maxContextTokens: number;
  maxOutputTokens: number;
}

export interface ProviderModel {
  id: string;
  name: string;
  provider: string;
  capabilities: ModelCapabilities;
  default: boolean;
}

export interface AIProvider {
  readonly providerName: string;
  readonly models: ProviderModel[];

  chat(request: ChatRequest): Promise<ChatResponse>;
  streamChat?(request: ChatRequest): AsyncGenerator<string>;
  generateImage?(prompt: string, modelId?: string): Promise<string | Buffer>;
  getModel(modelId: string): ProviderModel | undefined;
  getDefaultModel(): ProviderModel;
}

export interface ProviderDefinition {
  id: string;
  name: string;
  provider: AIProvider;
  enabled: boolean;
}
