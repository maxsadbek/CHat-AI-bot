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
 *
 * Never splits inside a fenced code block (``` ... ```) so Telegram formatting
 * entities are never broken across separate messages.
 */
export function splitMessage(text: string, maxLength: number = 4096): string[] {
  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }

    const actualCut = findSafeSplitIndex(remaining, maxLength);
    let cut = actualCut;
    let chunk = remaining.slice(0, cut);

    // If we were forced to cut inside a fenced code block (a single block
    // larger than maxLength), close the fence in this chunk and reopen it in
    // the next one so Telegram formatting entities stay valid. Reserve room
    // for the closing fence so chunks never exceed maxLength.
    if ((chunk.match(/```/g) || []).length % 2 !== 0) {
      cut = Math.max(1, Math.min(cut, maxLength - 4));
      chunk = remaining.slice(0, cut);
      chunk += "\n```";
      chunks.push(chunk);
      remaining = "```\n" + remaining.slice(cut).trim();
      continue;
    }

    chunks.push(chunk);
    remaining = remaining.slice(cut).trim();
  }

  return chunks;
}

/**
 * Find a safe split index for a long message: as close to maxLength as possible,
 * preferring paragraph boundaries, and never splitting inside a fenced code block.
 */
function findSafeSplitIndex(text: string, maxLength: number): number {
  let inFence = false;
  let paragraphCut = -1;
  let lineCut = -1;
  let wordCut = -1;

  const limit = Math.min(maxLength, text.length);

  for (let i = 0; i <= limit; i++) {
    // Fenced code block opener/closer: "```" (+ optional language tag)
    if (text.startsWith("```", i)) {
      inFence = !inFence;
      i += 2; // skip the remaining fence characters
      continue;
    }

    if (inFence) continue; // never cut inside a code block

    const ch = text[i];
    if (ch === "\n") {
      if (text.startsWith("\n\n", i - 1)) {
        paragraphCut = i - 1;
      }
      lineCut = i;
    } else if (ch === " ") {
      wordCut = i;
    }
  }

  // Prefer the boundary closest to maxLength; paragraph breaks are only used
  // when they are beyond the midpoint (avoids tiny chunks).
  const best =
    paragraphCut > maxLength / 2 ? paragraphCut : Math.max(wordCut, lineCut);
  return best >= 0 ? best : maxLength;
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
