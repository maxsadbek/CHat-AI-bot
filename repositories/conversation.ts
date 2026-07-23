import { prisma } from "@/lib/prisma";
import { logger } from "@/bot/core/logger";

const log = logger.child("conversation-repo");

export class ConversationRepository {
  async create(data: { userId: number; title: string; feature: string }) {
    try {
      return await prisma.conversation.create({ data });
    } catch (error) {
      log.error("Error creating conversation", { error: String(error) });
      throw error;
    }
  }

  async findById(id: string) {
    try {
      return await prisma.conversation.findUnique({
        where: { id },
        include: { _count: { select: { messages: true } } },
      });
    } catch (error) {
      log.error("Error finding conversation", { id, error: String(error) });
      throw error;
    }
  }

  async findByUser(userId: number, feature?: string, limit = 10) {
    try {
      return await prisma.conversation.findMany({
        where: {
          userId,
          ...(feature ? { feature } : {}),
          isActive: true,
        },
        orderBy: { updatedAt: "desc" },
        take: limit,
        include: { _count: { select: { messages: true } } },
      });
    } catch (error) {
      log.error("Error finding conversations by user", { userId, error: String(error) });
      throw error;
    }
  }

  async deleteMany(userId: number, feature?: string) {
    try {
      const where: Record<string, unknown> = { userId };
      if (feature) where.feature = feature;
      return await prisma.conversation.deleteMany({ where });
    } catch (error) {
      log.error("Error deleting conversations", { userId, error: String(error) });
      throw error;
    }
  }
}

export const conversationRepository = new ConversationRepository();
