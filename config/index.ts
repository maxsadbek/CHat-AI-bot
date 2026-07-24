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
    // Return partial config with defaults for development
    return envSchema.parse({ ...process.env, OPENAI_API_KEY: "sk-dummy" });
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
