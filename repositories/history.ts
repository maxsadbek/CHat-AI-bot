/**
 * HistoryRepository
 * Data access layer for the global Conversation History feature.
 * Queries across all AI features (chat, image, video, coding, social, business, translate).
 *
 * Storage (via Conversation + Message models in Prisma):
 *   id          — UUID
 *   user_id     — Int
 *   feature     — String (chat, image, video, coding, social, business, translate)
 *   title       — String (auto-generated, max 40 chars)
 *   messages    — Message[] (user_prompt, ai_response)
 *   created_at  — DateTime
 *   updated_at  — DateTime
 *
 * Security:
 *   Every query filters by userId to prevent cross-user access.
 *   Admins can optionally view any user's history.
 */

import { prisma } from "@/lib/prisma";
import { logger } from "@/bot/core/logger";

const log = logger.child("history-repo");

export class HistoryRepository {
  /**
   * Get the latest conversations across ALL features for a user.
   * Sorted by newest first. Returns up to `limit` conversations.
   * Includes the first user message and AI response for detail view.
   */
  async getRecentConversations(userId: number, limit = 10) {
    try {
      return await prisma.conversation.findMany({
        where: { userId, isActive: true },
        orderBy: { updatedAt: "desc" },
        take: limit,
        include: {
          messages: {
            orderBy: { createdAt: "asc" },
            take: 2, // First user message + first AI response
          },
          _count: { select: { messages: true } },
        },
      });
    } catch (error) {
      log.error("Error getting recent conversations", { userId, error: String(error) });
      throw error;
    }
  }

  /**
   * Get a single conversation with all its messages for detail view.
   * Only returns if userId matches (security check).
   */
  async getConversationDetail(conversationId: string, userId: number) {
    try {
      return await prisma.conversation.findFirst({
        where: { id: conversationId, userId, isActive: true },
        include: {
          messages: {
            orderBy: { createdAt: "asc" },
          },
        },
      });
    } catch (error) {
      log.error("Error getting conversation detail", { conversationId, error: String(error) });
      throw error;
    }
  }

  /**
   * Admin version — get any user's conversation without userId filter.
   */
  async getConversationDetailAdmin(conversationId: string) {
    try {
      return await prisma.conversation.findFirst({
        where: { id: conversationId, isActive: true },
        include: {
          messages: {
            orderBy: { createdAt: "asc" },
          },
        },
      });
    } catch (error) {
      log.error("Error getting conversation detail (admin)", { conversationId, error: String(error) });
      throw error;
    }
  }

  /**
   * Count active conversations for a user (used for limit checking)
   */
  async countByUser(userId: number): Promise<number> {
    try {
      return await prisma.conversation.count({
        where: { userId, isActive: true },
      });
    } catch (error) {
      log.error("Error counting conversations", { userId, error: String(error) });
      return 0;
    }
  }

  /**
   * Delete a single conversation by ID (only if owned by userId).
   * Uses soft delete (sets isActive to false) to preserve data.
   */
  async softDelete(conversationId: string, userId: number) {
    try {
      return await prisma.conversation.updateMany({
        where: { id: conversationId, userId },
        data: { isActive: false },
      });
    } catch (error) {
      log.error("Error soft-deleting conversation", { conversationId, error: String(error) });
      throw error;
    }
  }

  /**
   * Permanently delete a conversation (GDPR / admin action).
   */
  async hardDelete(conversationId: string) {
    try {
      return await prisma.conversation.delete({
        where: { id: conversationId },
      });
    } catch (error) {
      log.error("Error hard-deleting conversation", { conversationId, error: String(error) });
      throw error;
    }
  }

  /**
   * Find the oldest active conversation for a user (to auto-delete when at limit).
   */
  async findOldest(userId: number) {
    try {
      return await prisma.conversation.findFirst({
        where: { userId, isActive: true },
        orderBy: { updatedAt: "asc" },
      });
    } catch (error) {
      log.error("Error finding oldest conversation", { userId, error: String(error) });
      return null;
    }
  }

  /**
   * Update conversation title (for auto-generation)
   */
  async updateTitle(conversationId: string, title: string) {
    try {
      return await prisma.conversation.update({
        where: { id: conversationId },
        data: { title },
      });
    } catch (error) {
      log.error("Error updating conversation title", { conversationId, error: String(error) });
      throw error;
    }
  }
}

export const historyRepository = new HistoryRepository();
