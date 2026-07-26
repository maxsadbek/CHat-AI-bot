/**
 * Telegram markdown formatting utilities
 * Supports Markdown, MarkdownV2, and HTML parse modes
 */

/**
 * Escape special characters for Telegram MarkdownV2
 */
export function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, "\\$&");
}

/**
 * Escape special characters for Telegram legacy Markdown mode.
 *
 * Legacy Markdown only supports:
 *   *bold*  _italic_  `code`
 *
 * Characters to escape: * _ `
 */
export function escapeMarkdownLegacy(text: string): string {
  return text.replace(/([\*_`])/g, "\\$1");
}

/**
 * Escape HTML entities for Telegram HTML parse mode.
 * Escapes: & < >
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Format text as bold
 */
export function bold(text: string): string {
  return `*${text}*`;
}

/**
 * Format text as italic
 */
export function italic(text: string): string {
  return `_${text}_`;
}

/**
 * Format text as code
 */
export function code(text: string): string {
  return "`" + text + "`";
}

/**
 * Format text as pre-formatted code block
 */
export function pre(text: string, language?: string): string {
  const lang = language ?? "";
  return "```" + lang + "\n" + text + "\n```";
}

/**
 * Create a clickable link
 */
export function link(text: string, url: string): string {
  return `[${text}](${url})`;
}

/**
 * Format a section header with divider
 */
export function section(title: string, content: string): string {
  return `${bold(title)}\n\n${content}`;
}

/**
 * Format a list item
 */
export function listItem(text: string, bullet: string = "•"): string {
  return `${bullet} ${text}`;
}

/**
 * Format a numbered list item
 */
export function numberedItem(index: number, text: string): string {
  return `${index}. ${text}`;
}

/**
 * Split long message into chunks for Telegram
 */
export function splitMessage(text: string, maxLength: number = 4096): string[] {
  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }

    // Try to split at a natural boundary
    const splitIndex = remaining.lastIndexOf("\n\n", maxLength);
    const cutIndex =
      splitIndex > maxLength / 2 ? splitIndex : remaining.lastIndexOf(" ", maxLength);
    const actualCut = cutIndex > 0 ? cutIndex : maxLength;

    chunks.push(remaining.slice(0, actualCut));
    remaining = remaining.slice(actualCut).trim();
  }

  return chunks;
}

/**
 * Strip markdown from text for plain text rendering
 */
export function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/_(.*?)_/g, "$1")
    .replace(/`{3}[\s\S]*?`{3}/g, "")
    .replace(/`(.*?)`/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");
}

/**
 * AI Message Sanitizer
 *
 * Safely prepares AI-generated text for Telegram.
 * AI responses often contain markdown/metadata characters that break Telegram's parser.
 *
 * Strategy: Use HTML parse_mode, which is more forgiving than Markdown.
 * We only allow basic HTML tags (bold, italic, code, links) and escape everything else.
 *
 * If the text still fails to send, the caller should retry with parse_mode: undefined (plain text).
 */

/**
 * Escape text for safe Telegram HTML parsing.
 * Escapes: & < > and removes entities that could break parsing.
 */
export function sanitizeForTelegram(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Smart Telegram message sender.
 * Tries HTML parse_mode first, falls back to plain text on parse failure.
 * This is the SAFEST way to send AI-generated content to Telegram.
 *
 * @param sendFn - Function that sends the message (e.g., ctx.reply or ctx.editMessageText)
 * @param text - The text to send
 * @param extra - Additional send options (reply_markup, etc.)
 * @returns The result of the successful send attempt
 */
export async function sendAIMessage<T>(
  sendFn: (text: string, extra?: Record<string, unknown>) => Promise<T>,
  text: string,
  extra?: Record<string, unknown>
): Promise<T> {
  // First attempt: HTML parse_mode with sanitized text
  const safeHtml = sanitizeForTelegram(text);
  try {
    return await sendFn(safeHtml, { ...extra, parse_mode: "HTML" } as any);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    // If HTML parsing fails, fall back to plain text
    if (msg.includes("parse") || msg.includes("entity") || msg.includes("Can't parse")) {
      return await sendFn(text, { ...extra, parse_mode: undefined } as any);
    }
    throw err;
  }
}
