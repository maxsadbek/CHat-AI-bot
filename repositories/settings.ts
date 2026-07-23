import { prisma } from "@/lib/prisma";
import { logger } from "@/bot/core/logger";

const log = logger.child("settings-repo");

export class UserSettingsRepository {
  async findByUserId(userId: number) {
    try {
      return await prisma.userSettings.findUnique({ where: { userId } });
    } catch (error) {
      log.error("Error finding user settings", { userId, error: String(error) });
      throw error;
    }
  }

  async upsert(userId: number, data: {
    language?: string;
    theme?: string;
    notificationsEnabled?: boolean;
  }) {
    try {
      return await prisma.userSettings.upsert({
        where: { userId },
        update: data,
        create: { userId, ...data },
      });
    } catch (error) {
      log.error("Error upserting user settings", { userId, error: String(error) });
      throw error;
    }
  }

  async updateLanguage(userId: number, language: string) {
    try {
      return await prisma.userSettings.upsert({
        where: { userId },
        update: { language },
        create: { userId, language },
      });
    } catch (error) {
      log.error("Error updating language", { userId, language, error: String(error) });
      throw error;
    }
  }
}

export const userSettingsRepository = new UserSettingsRepository();
