/**
 * Conversation Service
 * Manages AI chat conversations, history, and messages.
 */

import { conversationRepository } from "@/repositories/conversation";
import { messageRepository } from "@/repositories/message";
import { logger } from "@/bot/core/logger";

const log = logger.child("conversation-service");

export class ConversationService {
  /**
   * Create a new conversation
   */
  async create(userId: number, title: string, feature = "chat") {
    return await conversationRepository.create({ userId, title, feature });
  }

  /**
   * Get conversation by ID
   */
  async getById(id: string) {
    return await conversationRepository.findById(id);
  }

  /**
   * Get user's recent conversations
   */
  async getUserConversations(userId: number, feature?: string, limit = 10) {
    return await conversationRepository.findByUser(userId, feature, limit);
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
   * Delete all user conversations for a feature
   */
  async deleteUserConversations(userId: number, feature?: string) {
    return await conversationRepository.deleteMany(userId, feature);
  }
}

export const conversationService = new ConversationService();
