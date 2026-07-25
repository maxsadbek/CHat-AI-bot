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
  /** Currently active project ID (null = no project selected) */
  currentProjectId: string | null;
  /** Temporary project name being set */
  pendingProjectName: string;
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
  PROJECTS = "projects",
  PROJECT_CREATE = "project_create",
  PROJECT_RENAME = "project_rename",
  PROJECT_NOTE_CREATE = "project_note_create",

  /**
   * Manual Payment — waiting for user to send a payment receipt photo
   */
  MANUAL_PAYMENT_RECEIPT = "manual_payment_receipt",
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
  title: string;
  scene: string;
  subject: string;
  action: string;
  environment: string;
  camera: string;
  lens: string;
  movement: string;
  lighting: string;
  color_grading: string;
  realism: string;
  duration: string;
  negative_prompt: string;
  music: string;
  voice: string;
  full_prompt: string;
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

// ─── Project Types ──────────────────────────────────────

export interface ProjectSummary {
  id: string;
  name: string;
  description: string | null;
  emoji: string;
  color: string | null;
  conversationCount: number;
  fileCount: number;
  noteCount: number;
  lastUpdated: Date;
}

export interface ProjectFileInfo {
  id: string;
  fileName: string;
  fileType: string;
  fileUrl: string | null;
  content: string | null;
  size: number | null;
  createdAt: Date;
}

export interface ProjectNoteInfo {
  id: string;
  title: string;
  content: string;
  isPinned: boolean;
  updatedAt: Date;
}

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

// ─── Analytics Types ────────────────────────────────────

export interface AnalyticsOverview {
  users: {
    total: number;
    activeToday: number;
    activeThisWeek: number;
    activeThisMonth: number;
    newToday: number;
  };
  usage: {
    total: number;
    today: number;
    thisWeek: number;
    thisMonth: number;
  };
  features: {
    messagesToday: number;
    imagesToday: number;
    videosToday: number;
    topFeatures: Array<{ feature: string; count: number }>;
  };
  tokens: {
    tokensIn: number;
    tokensOut: number;
  };
  premium: {
    totalPremium: number;
    byPlan: Array<{ plan: string; count: number }>;
    byBilling: Array<{ period: string; count: number }>;
  };
  conversion: {
    free: number;
    premium: number;
    rate: number;
  };
  dailyTrend: Array<{ date: string; count: number; users: number }>;
  generatedAt: string;
}

export interface ProviderAnalytics {
  period: { from: string; to: string };
  byProvider: Array<{ provider: string; count: number }>;
  byModel: Array<{ model: string; count: number }>;
}

export interface UserGrowthPoint {
  date: string;
  newUsers: number;
  newPremium: number;
}

export interface DailyUsagePoint {
  date: string;
  count: number;
  users: number;
}

export interface HourlyDistribution {
  hour: number;
  count: number;
  label: string;
}

export interface RetentionStats {
  totalActive: number;
  returned: number;
  retentionRate: number;
}

// ─── Admin Types ─────────────────────────────────────────

export interface AdminStats {
  // Core
  totalUsers: number;
  activeUsersToday: number;
  totalRequests: number;
  requestsToday: number;
  premiumUsers: number;
  topFeatures: Array<{ feature: string; count: number }>;

  // Granular feature counts (today)
  chatRequests: number;
  imageRequests: number;
  videoRequests: number;
  codingRequests: number;
  socialRequests: number;
  businessRequests: number;
  translateRequests: number;

  // Provider
  mostUsedProvider: string | null;
  providers: Array<{ provider: string; count: number }>;

  // Growth
  newUsersToday: number;

  // Payment overview
  paymentsPending: number;
  paymentsApproved: number;
  paymentsRejected: number;
  totalRevenue: number;
}

export interface AdminLog {
  id: string;
  action: string;
  adminId: number;
  details: string;
  createdAt: Date;
}

// ─── Admin System Types ──────────────────────────────────

export interface SystemHealth {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  uptime: number;
  version: string;
  checks: {
    database: ComponentHealth;
    openai: ComponentHealth;
    gemini: ComponentHealth;
    claude: ComponentHealth;
    deepseek: ComponentHealth;
    telegram: ComponentHealth;
    paymentProviders: ComponentHealth;
    memory: ComponentHealth;
  };
}

export interface ComponentHealth {
  status: "healthy" | "degraded" | "unhealthy";
  message: string;
  latency?: number;
}

export interface AdminUserDetail {
  id: number;
  telegramId: bigint;
  firstName: string;
  lastName: string | null;
  username: string | null;
  isPremium: boolean;
  requestsToday: number;
  totalRequests: number;
  dailyLimit: number;
  languageCode: string | null;
  createdAt: Date;
  lastActiveAt: Date;
  planType: string;
  conversationCount: number;
  messageCount: number;
  usageCount: number;
  projectCount: number;
}

export interface AdminAction {
  action: string;
  adminId: number;
  details: string;
  timestamp: Date;
}

export interface PremiumManageResult {
  success: boolean;
  userId: number;
  planId?: string;
  newExpiry?: Date;
}

// ─── Utility Types ───────────────────────────────────────

export type AsyncReturnType<T extends (...args: unknown[]) => unknown> =
  T extends (...args: unknown[]) => Promise<infer R> ? R : never;

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
