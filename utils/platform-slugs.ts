import type {
  VideoPlatform,
  ImagePlatform,
  SocialPlatform,
  CodeLanguage,
} from "@/types";

/** Maps keyboard callback slugs to canonical platform/type names used by AI services. */
export const VIDEO_PLATFORM_SLUGS: Record<string, VideoPlatform> = {
  hailuo: "Hailuo AI",
  kling: "Kling AI",
  veo: "Google Veo",
  runway: "Runway",
  pixverse: "PixVerse",
};

export const IMAGE_PLATFORM_SLUGS: Record<string, ImagePlatform> = {
  gpt: "GPT Image",
  flux: "Flux",
  midjourney: "Midjourney",
  leonardo: "Leonardo",
  ideogram: "Ideogram",
};

export const SOCIAL_PLATFORM_SLUGS: Record<string, SocialPlatform> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  telegram: "Telegram",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  youtube: "YouTube",
};

export const CODING_LANGUAGE_SLUGS: Record<string, CodeLanguage> = {
  html: "HTML",
  css: "CSS",
  react: "React",
  nextjs: "Next.js",
  tailwind: "Tailwind",
  nodejs: "Node.js",
  express: "Express",
  prisma: "Prisma",
  sql: "SQL",
  api: "API",
  debug: "Debug",
  explain: "Explain",
};

export function resolveVideoPlatform(
  raw: string
): VideoPlatform | "all" {
  if (!raw || raw === "all" || raw === "history") return "all";
  return VIDEO_PLATFORM_SLUGS[raw] ?? "all";
}

export function resolveImagePlatform(
  raw: string
): ImagePlatform | "all" {
  if (!raw || raw === "all" || raw === "history") return "all";
  return IMAGE_PLATFORM_SLUGS[raw] ?? "all";
}

export function resolveSocialPlatform(
  raw: string
): SocialPlatform | "all" {
  if (!raw || raw === "all") return "all";
  return SOCIAL_PLATFORM_SLUGS[raw] ?? "all";
}

export function resolveCodeLanguage(raw: string): CodeLanguage {
  if (!raw) return "Next.js";
  return CODING_LANGUAGE_SLUGS[raw] ?? "Next.js";
}

export function getPlatformDisplayName(
  platform: VideoPlatform | ImagePlatform | SocialPlatform | "all"
): string {
  return platform === "all" ? "All Platforms" : platform;
}
