import type { Context, SessionFlavor } from "grammy";
import type { SupportedLanguage } from "@/bot/localization";

// ─── Session ────────────────────────────────────────────

export interface SessionData {
  step: BotStep;
  userId: number | null;
  conversationId: string | null;
  messages: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
  tempData: Record<string, string>;
  /** User's selected language for UI */
  language: SupportedLanguage;
  /** Whether user has completed language selection */
  languageSelected: boolean;
  /** Currently selected video platform for isolated mode */
  selectedVideoPlatform: VideoPlatform | "all";
  /** Currently selected image platform for isolated mode */
  selectedImagePlatform: ImagePlatform | "all";
  /** Currently selected social platform for isolated mode */
  selectedSocialPlatform: SocialPlatform | "all";
  /** Currently selected business content type for isolated mode */
  selectedBusinessType: BusinessContentType;
  /** Currently selected coding language for isolated mode */
  selectedCodeLanguage: CodeLanguage;
  /** Currently selected AI model (e.g., "gpt-4o", "gemini-2.0-flash", "claude-sonnet-4-20250514") */
  selectedModel: string;
}

export type BotContext = Context & SessionFlavor<SessionData>;

// ─── Bot Steps ───────────────────────────────────────────

export enum BotStep {
  IDLE = "idle",
  AI_CHAT = "ai_chat",
  VIDEO_PROMPT = "video_prompt",
  IMAGE_PROMPT = "image_prompt",
  SOCIAL_MEDIA = "social_media",
  CODING = "coding",
  BUSINESS = "business",
  TRANSLATE = "translate",
  PROFILE = "profile",
  HELP = "help",
  LANGUAGE = "language",
  SETTINGS = "settings",
}

// ─── AI Service Types ────────────────────────────────────

export interface AIChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AIChatResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface VideoPrompt {
  platform: VideoPlatform;
  scene: string;
  lighting: string;
  cameraMovement: string;
  lens: string;
  environment: string;
  negativePrompt: string;
  voice: string;
  music: string;
  duration: string;
  style: string;
  fullPrompt: string;
}

export type VideoPlatform =
  | "Hailuo AI"
  | "Kling AI"
  | "Google Veo"
  | "Runway"
  | "PixVerse";

export interface ImagePrompt {
  platform: ImagePlatform;
  composition: string;
  lighting: string;
  camera: string;
  mood: string;
  quality: string;
  negativePrompt: string;
  fullPrompt: string;
}

export type ImagePlatform =
  | "GPT Image"
  | "Flux"
  | "Midjourney"
  | "Leonardo"
  | "Ideogram";

export interface SocialMediaContent {
  platform: SocialPlatform;
  caption: string;
  hooks: string[];
  cta: string;
  hashtags: string[];
  trendingKeywords: string[];
}

export type SocialPlatform =
  | "Instagram"
  | "TikTok"
  | "Telegram"
  | "Facebook"
  | "LinkedIn"
  | "YouTube";

export interface BusinessContent {
  type: BusinessContentType;
  content: string;
}

export type BusinessContentType =
  | "startup_idea"
  | "business_plan"
  | "marketing_strategy"
  | "brand_name"
  | "slogan"
  | "logo_prompt"
  | "color_palette"
  | "landing_page_copy";

export interface CodeGeneration {
  language: CodeLanguage;
  code: string;
  explanation: string;
  usage?: string;
}

export type CodeLanguage =
  | "HTML"
  | "CSS"
  | "React"
  | "Next.js"
  | "Tailwind"
  | "Node.js"
  | "Express"
  | "Prisma"
  | "SQL"
  | "API"
  | "Debug"
  | "Explain";

// ─── User Types ──────────────────────────────────────────

export interface UserProfile {
  id: number;
  telegramId: number;
  firstName: string;
  lastName: string | null;
  username: string | null;
  languageCode: string | null;
  isPremium: boolean;
  requestsToday: number;
  totalRequests: number;
  dailyLimit: number;
  createdAt: Date;
  lastActiveAt: Date;
}

export type SubscriptionTier = "free" | "premium";

// ─── Admin Types ─────────────────────────────────────────

export interface AdminStats {
  totalUsers: number;
  activeUsersToday: number;
  totalRequests: number;
  requestsToday: number;
  premiumUsers: number;
  topFeatures: Array<{ feature: string; count: number }>;
}

export interface AdminLog {
  id: string;
  action: string;
  adminId: number;
  details: string;
  createdAt: Date;
}

// ─── Utility Types ───────────────────────────────────────

export type AsyncReturnType<T extends (...args: unknown[]) => unknown> =
  T extends (...args: unknown[]) => Promise<infer R> ? R : never;

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
