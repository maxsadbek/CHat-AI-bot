import { prisma } from "@/lib/prisma";
import { logger } from "@/bot/core/logger";

const log = logger.child("message-repo");

export class MessageRepository {
  async createMany(
    messages: Array<{
      conversationId: string;
      userId: number;
      role: string;
      content: string;
      tokensUsed?: number;
    }>
  ) {
    try {
      return await prisma.message.createMany({
        data: messages.map((m) => ({
          ...m,
          tokensUsed: m.tokensUsed ?? 0,
        })),
      });
    } catch (error) {
      log.error("Error creating messages", { error: String(error) });
      throw error;
    }
  }

  async findByConversation(conversationId: string) {
    try {
      return await prisma.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: "asc" },
      });
    } catch (error) {
      log.error("Error finding messages", { conversationId, error: String(error) });
      throw error;
    }
  }

  async deleteMany(conversationId: string) {
    try {
      return await prisma.message.deleteMany({
        where: { conversationId },
      });
    } catch (error) {
      log.error("Error deleting messages", { conversationId, error: String(error) });
      throw error;
    }
  }
}

export const messageRepository = new MessageRepository();
