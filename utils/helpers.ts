/**
 * Generic helper utilities
 */

/**
 * Escape special characters for Telegram HTML parse_mode.
 * Escapes: & < >
 * Characters like * _ ` [ ] ( ) are NOT special in HTML mode
 * and are safe to send without escaping.
 */
export function escapeTelegramHTML(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Sleep for a given number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Format a date for display
 */
export function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Generate a random ID
 */
export function generateId(length: number = 12): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}

/**
 * Parse a string to boolean
 */
export function toBoolean(value: string | undefined | null): boolean {
  if (!value) return false;
  return ["true", "1", "yes", "y"].includes(value.toLowerCase());
}

/**
 * Chunk an array into smaller arrays
 */
export function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Safely parse JSON without throwing
 */
export function safeJsonParse<T>(text: string, fallback: T): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

/**
 * Get emoji for a feature name
 */
export function getFeatureEmoji(feature: string): string {
  const emojis: Record<string, string> = {
    chat: "🤖",
    video: "🎬",
    image: "🎨",
    social: "📱",
    business: "💼",
    coding: "💻",
    translate: "🌍",
    profile: "⚙️",
    help: "❓",
  };
  return emojis[feature] ?? "✨";
}
