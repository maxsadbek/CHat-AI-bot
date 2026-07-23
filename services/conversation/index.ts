/**
 * Conversation Service
 * Manages AI chat conversations, history, and messages.
 * Handles subscription-based conversation limits.
 */

import { conversationRepository } from "@/repositories/conversation";
import { messageRepository } from "@/repositories/message";
import { prisma } from "@/lib/prisma";
import { logger } from "@/bot/core/logger";

const log = logger.child("conversation-service");

// ─── Plan Limits ──────────────────────────────────────
export const FREE_CONVERSATION_LIMIT = 10;
export const PREMIUM_CONVERSATION_LIMIT = 999999; // effectively unlimited

export class ConversationService {
  /**
   * Create a new conversation
   */
  async create(userId: number, title: string, feature = "chat", projectId?: string) {
    return await conversationRepository.create({ userId, title, feature, projectId });
  }

  /**
   * Get conversation by ID
   */
  async getById(id: string) {
    return await conversationRepository.findById(id);
  }

  /**
   * Get user's recent conversations for a feature
   */
  async getUserConversations(userId: number, feature?: string, limit = 10) {
    return await conversationRepository.findByUser(userId, feature, limit);
  }

  /**
   * Check if user can create a new conversation.
   * Free users: max 10 conversations per feature.
   * Premium users: unlimited.
   */
  async checkLimit(userId: number, feature: string): Promise<boolean> {
    try {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) return false;

      if (user.isPremium) return true; // Premium = unlimited

      const count = await prisma.conversation.count({
        where: { userId, feature, isActive: true },
      });

      return count < FREE_CONVERSATION_LIMIT;
    } catch (error) {
      log.error("Error checking conversation limit", { userId, feature, error: String(error) });
      return true; // Allow on error
    }
  }

  /**
   * Get remaining conversation slots for a user/feature
   */
  async getRemainingSlots(userId: number, feature: string): Promise<number> {
    try {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) return 0;
      if (user.isPremium) return PREMIUM_CONVERSATION_LIMIT;

      const count = await prisma.conversation.count({
        where: { userId, feature, isActive: true },
      });

      return Math.max(0, FREE_CONVERSATION_LIMIT - count);
    } catch {
      return 0;
    }
  }

  /**
   * Save messages to a conversation
   */
  async saveMessages(
    conversationId: string,
    userId: number,
    messages: Array<{
      role: string;
      content: string;
      tokensUsed?: number;
    }>
  ) {
    return await messageRepository.createMany(
      messages.map((m) => ({
        conversationId,
        userId,
        role: m.role,
        content: m.content,
        tokensUsed: m.tokensUsed,
      }))
    );
  }

  /**
   * Get messages for a conversation
   */
  async getMessages(conversationId: string) {
    return await messageRepository.findByConversation(conversationId);
  }

  /**
   * Mark a conversation as inactive (soft delete)
   */
  async deactivate(conversationId: string) {
    try {
      return await prisma.conversation.update({
        where: { id: conversationId },
        data: { isActive: false },
      });
    } catch (error) {
      log.error("Error deactivating conversation", { conversationId, error: String(error) });
      throw error;
    }
  }

  /**
   * Get conversation with all messages (for resume)
   */
  async getConversationWithMessages(conversationId: string) {
    try {
      return await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: {
          messages: {
            orderBy: { createdAt: "asc" },
          },
        },
      });
    } catch (error) {
      log.error("Error fetching conversation with messages", { conversationId, error: String(error) });
      throw error;
    }
  }

  /**
   * Delete all user conversations for a feature
   */
  async deleteUserConversations(userId: number, feature?: string) {
    return await conversationRepository.deleteMany(userId, feature);
  }
}

export const conversationService = new ConversationService();
