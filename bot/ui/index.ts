/**
 * Premium UI Formatting Utilities
 * Provides consistent, beautiful formatting for AI responses.
 * Creates structured result pages with dividers, sections, and action buttons.
 */

/**
 * Create a premium section divider
 */
export function divider(): string {
  return "━━━━━━━━━━━━━━━━━━━━━";
}

/**
 * Format a premium header with emoji and title
 */
export function resultHeader(emoji: string, title: string): string {
  return `${divider()}\n${emoji} *${title}*\n${divider()}`;
}

/**
 * Format a premium section within a result
 */
export function resultSection(label: string, content: string): string {
  return `*${label}:* ${content}`;
}

/**
 * Wrap AI response in premium result format
 */
export function formatPremiumResult(
  emoji: string,
  title: string,
  content: string
): string {
  return [
    resultHeader(emoji, title),
    "",
    content,
    "",
    divider(),
  ].join("\n");
}

/**
 * Format a multi-platform result (for Image, Video, Social)
 */
export function formatPlatformResult(
  platform: string,
  content: string
): string {
  return [
    `*${platform}*`,
    content,
    divider(),
  ].join("\n");
}

/**
 * Format usage progress bar
 */
export function progressBar(used: number, limit: number): string {
  const percent = Math.min(Math.round((used / limit) * 100), 100);
  const filled = Math.min(Math.floor(percent / 10), 10);
  const bar = "▓".repeat(filled) + "░".repeat(10 - filled);
  return `${bar} ${percent}%`;
}
