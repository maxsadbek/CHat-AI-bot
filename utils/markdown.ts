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
