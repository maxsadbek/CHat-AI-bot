/**
 * HistoryService
 * Orchestrates the global Conversation History feature.
 * Reuses ConversationService and HistoryRepository under the hood.
 *
 * Responsibilities:
 *   - Get cross-feature recent conversations
 *   - Get conversation detail (user prompt + AI response)
 *   - Auto-generate short titles (max 40 chars)
 *   - Auto-delete oldest when free user hits limit
 *   - Check conversation limits (Free: 10, Premium: unlimited)
 */

import { historyRepository } from "@/repositories/history";
import { conversationService } from "@/services/conversation";
import { prisma } from "@/lib/prisma";
import { logger } from "@/bot/core/logger";

const log = logger.child("history-service");

// ─── Limits ────────────────────────────────────────────
export const FREE_HISTORY_LIMIT = 10;

export class HistoryService {
  /**
   * Get user's recent conversations across ALL features.
   * Sorted newest first. Returns up to `limit` items.
   * Each item includes the first user message and AI response.
   */
  async getRecentHistory(userId: number, limit = 10) {
    return await historyRepository.getRecentConversations(userId, limit);
  }

  /**
   * Get conversation detail — only if owned by userId.
   * Returns conversation with all messages for the detail view.
   */
  async getConversationDetail(conversationId: string, userId: number) {
    return await historyRepository.getConversationDetail(conversationId, userId);
  }

  /**
   * Get conversation detail for admin — no userId filter.
   */
  async getConversationDetailAdmin(conversationId: string) {
    return await historyRepository.getConversationDetailAdmin(conversationId);
  }

  /**
   * Auto-generate a short title (max 40 chars) from the first user message.
   * Examples:
   *   "React Landing Page"
   *   "Instagram Caption"
   *   "Logo Design"
   *   "Python Script"
   */
  generateTitle(userPrompt: string): string {
    if (!userPrompt || userPrompt.trim().length === 0) {
      return "New Conversation";
    }

    // Clean the input: remove extra spaces, newlines, markdown
    const cleaned = userPrompt
      .replace(/[*_`#\[\]()]/g, "")     // Remove common markdown
      .replace(/\s+/g, " ")             // Collapse whitespace
      .trim();

    if (!cleaned) return "New Conversation";

    if (cleaned.length <= 40) {
      return cleaned;
    }

    // Truncate to 40 chars, prefer breaking at a word boundary
    const truncated = cleaned.slice(0, 40);
    const lastSpace = truncated.lastIndexOf(" ");

    if (lastSpace > 20) {
      // Break at word boundary if we lose fewer than 20 chars
      return truncated.slice(0, lastSpace);
    }

    // Otherwise just truncate at 37 chars + "..."
    return cleaned.slice(0, 37) + "...";
  }

  /**
   * Update conversation title with auto-generated title.
   */
  async autoTitle(conversationId: string, userPrompt: string): Promise<string> {
    const title = this.generateTitle(userPrompt);
    await historyRepository.updateTitle(conversationId, title);
    return title;
  }

  /**
   * Check if user can create a new conversation.
   * Free users: max 10 total across all features.
   * Premium users: unlimited.
   * Returns { allowed, remaining, shouldAutoDelete }.
   */
  async checkLimit(userId: number): Promise<{
    allowed: boolean;
    remaining: number;
    shouldAutoDelete: boolean;
  }> {
    try {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) return { allowed: false, remaining: 0, shouldAutoDelete: false };
      if (user.isPremium) return { allowed: true, remaining: 999999, shouldAutoDelete: false };

      const count = await historyRepository.countByUser(userId);
      const remaining = Math.max(0, FREE_HISTORY_LIMIT - count);

      if (count >= FREE_HISTORY_LIMIT) {
        // At limit — auto-delete oldest to make room
        return { allowed: true, remaining: 0, shouldAutoDelete: true };
      }

      return { allowed: true, remaining, shouldAutoDelete: false };
    } catch (error) {
      log.error("Error checking history limit", { userId, error: String(error) });
      return { allowed: true, remaining: 1, shouldAutoDelete: false };
    }
  }

  /**
   * Auto-delete the oldest conversation to stay within the limit.
   * Called when a free user reaches the limit before saving a new one.
   * Returns the number of conversations deleted.
   */
  async autoDeleteOldest(userId: number): Promise<number> {
    try {
      const count = await historyRepository.countByUser(userId);
      if (count < FREE_HISTORY_LIMIT) return 0;

      // Delete the oldest until we're under the limit
      let deleted = 0;
      while (await historyRepository.countByUser(userId) >= FREE_HISTORY_LIMIT) {
        const oldest = await historyRepository.findOldest(userId);
        if (!oldest) break;
        await historyRepository.softDelete(oldest.id, userId);
        deleted++;
      }

      if (deleted > 0) {
        log.info("Auto-deleted oldest conversations", { userId, deleted });
      }

      return deleted;
    } catch (error) {
      log.error("Error auto-deleting oldest conversation", { userId, error: String(error) });
      return 0;
    }
  }

  /**
   * Delete a single conversation (soft delete).
   * Only succeeds if the conversation belongs to userId.
   */
  async deleteConversation(conversationId: string, userId: number) {
    return await historyRepository.softDelete(conversationId, userId);
  }

  /**
   * Get count of active conversations for a user.
   */
  async getConversationCount(userId: number): Promise<number> {
    return await historyRepository.countByUser(userId);
  }

  /**
   * Get feature emoji for display
   */
  getFeatureEmoji(feature: string): string {
    const map: Record<string, string> = {
      chat: "💬",
      image: "🎨",
      video: "🎬",
      coding: "💻",
      social: "📱",
      business: "💼",
      translate: "🌍",
    };
    return map[feature] ?? "💬";
  }

  /**
   * Get feature display name
   */
  getFeatureName(feature: string): string {
    const map: Record<string, string> = {
      chat: "AI Chat",
      image: "Image AI",
      video: "Video AI",
      coding: "Coding",
      social: "Social Media",
      business: "Business",
      translate: "Translate",
    };
    return map[feature] ?? feature;
  }

  /**
   * Format a relative date string (Today, Yesterday, or date)
   */
  formatRelativeDate(date: Date): string {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    if (target.getTime() === today.getTime()) return "Today";
    if (target.getTime() === yesterday.getTime()) return "Yesterday";

    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${months[target.getMonth()]} ${target.getDate()}`;
  }
}

export const historyService = new HistoryService();
