/**
 * Core AI Provider Interfaces
 * All providers must implement AIProvider.
 * The rest of the application only knows about AIProvider — never specific providers.
 */

// ─── Chat Message Types ───────────────────────────────

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  /** Specific model ID to use (e.g., "gpt-4o", "gemini-2.0-flash"). Falls back to provider default. */
  modelId?: string;
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
}

// ─── Provider Identity ────────────────────────────────

export interface ModelCapabilities {
  /** Whether the model supports streaming */
  streaming: boolean;
  /** Whether the model supports vision/image input */
  vision: boolean;
  /** Whether the model supports function calling */
  functionCalling: boolean;
  /** Maximum context window in tokens */
  maxContextTokens: number;
  /** Maximum output tokens */
  maxOutputTokens: number;
}

export interface ProviderModel {
  id: string;
  name: string;
  provider: string;
  capabilities: ModelCapabilities;
  /** Whether this is the default model for this provider */
  default: boolean;
}

// ─── AI Provider Interface ────────────────────────────
// This is the ONLY interface the application should know about.

export interface AIProvider {
  /** Human-friendly provider name (e.g., "OpenAI", "Google Gemini") */
  readonly providerName: string;

  /** All models this provider offers */
  readonly models: ProviderModel[];

  /**
   * Chat completion with full message history.
   * This is the main method used by the application.
   */
  chat(request: ChatRequest): Promise<ChatResponse>;

  /**
   * Streaming chat completion.
   * Yields content chunks as they arrive.
   */
  streamChat?(request: ChatRequest): AsyncGenerator<string>;

  /**
   * Get a specific model by ID
   */
  getModel(modelId: string): ProviderModel | undefined;

  /**
   * Get the default model for this provider
   */
  getDefaultModel(): ProviderModel;
}

// ─── Provider Registry ────────────────────────────────

export interface ProviderDefinition {
  id: string;
  name: string;
  provider: AIProvider;
  enabled: boolean;
}
