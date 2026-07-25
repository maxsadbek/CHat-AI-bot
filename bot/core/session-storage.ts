/**
 * Prisma Session Storage Adapter for grammy
 *
 * Persists session state to PostgreSQL via Prisma so that sessions survive
 * across serverless cold starts on Vercel.
 *
 * Key: Telegram chatId (string)
 * Value: JSON-encoded SessionData
 */

import type { StorageAdapter } from "grammy";
import { prisma } from "@/lib/prisma";
import { logger } from "@/bot/core/logger";

const log = logger.child("session-storage");

export class PrismaSessionStorage<T> implements StorageAdapter<T> {
  async read(key: string): Promise<T | undefined> {
    try {
      const record = await prisma.botSession.findUnique({ where: { id: key } });
      if (!record) return undefined;
      return JSON.parse(record.data) as T;
    } catch (error) {
      log.error("[SESSION] Failed to read session", { key, error: String(error) });
      return undefined;
    }
  }

  async write(key: string, value: T): Promise<void> {
    try {
      const data = JSON.stringify(value);
      await prisma.botSession.upsert({
        where: { id: key },
        create: { id: key, data },
        update: { data },
      });
    } catch (error) {
      log.error("[SESSION] Failed to write session", { key, error: String(error) });
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await prisma.botSession.delete({ where: { id: key } }).catch(() => {});
    } catch (error) {
      log.error("[SESSION] Failed to delete session", { key, error: String(error) });
    }
  }
}

export const prismaSessionStorage = new PrismaSessionStorage();
