import { z } from "zod";

/**
 * Environment variable schema with validation
 * All config is validated at startup for safety
 */
const envSchema = z.object({
  // Telegram
  TELEGRAM_BOT_TOKEN: z.string().min(1, "TELEGRAM_BOT_TOKEN is required"),
  TELEGRAM_WEBHOOK_URL: z.string().url().optional(),

  // ─── OpenAI Compatible API ────────────────
  OPENAI_API_KEY: z.string().min(1, "OPENAI_API_KEY is required"),
  OPENAI_BASE_URL: z.string().url().default("https://api.openai.com/v1"),
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),

  // ─── Google Gemini API ────────────────────
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default("gemini-2.0-flash"),

  // ─── Anthropic Claude API ─────────────────
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default("claude-sonnet-4-20250514"),

  // ─── DeepSeek API (OpenAI-compatible) ──────
  DEEPSEEK_API_KEY: z.string().optional(),
  DEEPSEEK_BASE_URL: z.string().url().default("https://api.deepseek.com/v1"),
  DEEPSEEK_MODEL: z.string().default("deepseek-chat"),

  // ─── Cerebras API (OpenAI-compatible) ──────
  CEREBRAS_API_KEY: z.string().optional(),
  CEREBRAS_BASE_URL: z.string().url().default("https://api.cerebras.ai/v1"),
  CEREBRAS_MODEL: z.string().default("llama3.1-8b"),

  // ─── Mistral API (OpenAI-compatible) ───────
  MISTRAL_API_KEY: z.string().optional(),
  MISTRAL_BASE_URL: z.string().url().default("https://api.mistral.ai/v1"),
  MISTRAL_MODEL: z.string().default("mistral-small-latest"),

  // ─── AI Router Configuration ────────────
  /** Daily limit for free users */
  AI_DAILY_LIMIT_FREE: z.coerce.number().default(50),
  /** Daily limit for premium users */
  AI_DAILY_LIMIT_PREMIUM: z.coerce.number().default(500),
  /** Provider priority chain for each task (comma-separated, highest first) */
  ROUTER_CHAT_PRIORITY: z.string().default("openai,groq,openrouter,cerebras,mistral,gemini,deepseek"),
  /** Provider priority chain for coding tasks */
  ROUTER_CODING_PRIORITY: z.string().default("openai,claude,gemini,groq,cerebras,mistral,deepseek"),
  /** Provider priority chain for image prompt tasks */
  ROUTER_IMAGE_PRIORITY: z.string().default("openai,gemini,openrouter"),
  /** Provider priority chain for video prompt tasks */
  ROUTER_VIDEO_PRIORITY: z.string().default("openai,gemini,openrouter"),
  /** Default provider priority fallback */
  ROUTER_DEFAULT_PRIORITY: z.string().default("openai,groq,openrouter,cerebras,mistral,gemini,deepseek,claude"),
  /** Cache TTL in seconds (default: 5 minutes) */
  AI_CACHE_TTL: z.coerce.number().default(300),

  // Database
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  // Admin
  ADMIN_IDS: z
    .string()
    .transform((val) =>
      val
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .map(Number)
        .filter((n) => !isNaN(n))
    )
    .default(""),
  ADMIN_SECRET: z.string().default("admin-secret"),

  // App
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_APP_NAME: z.string().default("AI Creator Studio"),

  // ─── Per-Feature Max Tokens ────────────
  /** Max tokens for AI Chat (default: 400) */
  AI_CHAT_MAX_TOKENS: z.coerce.number().default(400),
  /** Max tokens for Image prompts (default: 350) */
  AI_IMAGE_MAX_TOKENS: z.coerce.number().default(350),
  /** Max tokens for Video prompts (default: 450) */
  AI_VIDEO_MAX_TOKENS: z.coerce.number().default(450),
  /** Max tokens for Coding (default: 600) */
  AI_CODING_MAX_TOKENS: z.coerce.number().default(600),
  /** Max tokens for Business (default: 500) */
  AI_BUSINESS_MAX_TOKENS: z.coerce.number().default(500),
  /** Max tokens for Social (default: 500) */
  AI_SOCIAL_MAX_TOKENS: z.coerce.number().default(500),
  /** Max tokens for Translate (default: 400) */
  AI_TRANSLATE_MAX_TOKENS: z.coerce.number().default(400),

  // ─── Stability AI (Image/Text) ────────
  STABILITY_API_KEY: z.string().optional(),
  STABILITY_BASE_URL: z.string().url().default("https://api.stability.ai/v1"),
  STABILITY_MODEL: z.string().default("stable-diffusion-xl-1024-v1-0"),

  // ─── Flux AI (Image/Text) ──────────────
  FLUX_API_KEY: z.string().optional(),
  FLUX_BASE_URL: z.string().url().default("https://api.bfl.ml/v1"),
  FLUX_MODEL: z.string().default("FLUX.1-schnell"),

  // ─── AI Router Environment Variables ───
  /** Enable/disable AI router (default: true) */
  AI_ROUTER_ENABLED: z.string().default("true"),
  /** Enable/disable AI fallback (default: true) */
  AI_FALLBACK_ENABLED: z.string().default("true"),
  /** Provider order for text tasks (comma-separated) */
  AI_PROVIDER_ORDER: z.string().default("gemini,cerebras,mistral,openrouter"),

  // ─── Per-Feature Daily Limits (Free) ───
  AI_DAILY_CHAT_LIMIT_FREE: z.coerce.number().default(30),
  AI_DAILY_IMAGE_LIMIT_FREE: z.coerce.number().default(10),
  AI_DAILY_VIDEO_LIMIT_FREE: z.coerce.number().default(5),
  AI_DAILY_CODING_LIMIT_FREE: z.coerce.number().default(10),
  AI_DAILY_SOCIAL_LIMIT_FREE: z.coerce.number().default(30),
  AI_DAILY_BUSINESS_LIMIT_FREE: z.coerce.number().default(30),
  AI_DAILY_TRANSLATE_LIMIT_FREE: z.coerce.number().default(30),

  // ─── Per-Feature Daily Limits (Premium) ─
  AI_DAILY_CHAT_LIMIT_PREMIUM: z.coerce.number().default(300),
  AI_DAILY_IMAGE_LIMIT_PREMIUM: z.coerce.number().default(100),
  AI_DAILY_VIDEO_LIMIT_PREMIUM: z.coerce.number().default(50),
  AI_DAILY_CODING_LIMIT_PREMIUM: z.coerce.number().default(100),
  AI_DAILY_SOCIAL_LIMIT_PREMIUM: z.coerce.number().default(300),
  AI_DAILY_BUSINESS_LIMIT_PREMIUM: z.coerce.number().default(300),
  AI_DAILY_TRANSLATE_LIMIT_PREMIUM: z.coerce.number().default(300),

  // ─── Token Limits ────────────────────────
  FREE_MAX_TOKENS: z.coerce.number().default(250),
  PREMIUM_MAX_TOKENS: z.coerce.number().default(700),

  // ─── Stripe ───────────────────────────
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  // ─── Manual Payment (Temporary) ──────────
  /** Card holder name displayed on the manual payment page */
  MANUAL_PAYMENT_CARD_NAME: z.string().default("Card Holder"),
  /** Card number displayed (formatted with spaces automatically) */
  MANUAL_PAYMENT_CARD_NUMBER: z.string().default("0000000000000000"),
  /** Local price in UZS (positive integer only) */
  MANUAL_PAYMENT_AMOUNT_UZS: z.coerce.number().default(0),
  /** USD price string */
  MANUAL_PAYMENT_PRICE_USD: z.string().default("0.00"),

});

function getEnv() {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missing = error.errors
        .map((e) => `${e.path.join(".")}: ${e.message}`)
        .join("\n");
      console.error("❌ Invalid environment variables:\n", missing);
    }
    // Fallback: return partial config (allows dev to work without all keys)
    return envSchema.partial().parse(process.env) as z.infer<typeof envSchema>;
  }
}

export const env = {
  ...getEnv(),
  isDev: process.env.NODE_ENV === "development",
  isProd: process.env.NODE_ENV === "production",
} as const;

export const config = {
  app: {
    name: "AI Creator Studio",
    version: "1.0.0",
    description:
      "Your all-in-one AI platform for content creation, coding, and business",
  },

  ai: {
    maxTokens: 4096,
    temperature: 0.7,
    maxHistoryLength: 20,
    rateLimitRequests: 20,
    rateLimitWindow: 60 * 1000, // 1 minute
  },

  bot: {
    maxMessageLength: 4096,
    typingDelay: 1000,
  },

  limits: {
    freeRequestsPerDay: 50,
    premiumRequestsPerDay: 500,
  },
} as const;

export type Config = typeof config;
