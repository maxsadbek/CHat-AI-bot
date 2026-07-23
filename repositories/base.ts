/**
 * Base Repository
 * Provides common database operations using Prisma.
 * All repositories should extend this base class.
 */

import { prisma } from "@/lib/prisma";
import { logger } from "@/bot/core/logger";

const log = logger.child("repository");

export abstract class BaseRepository<T, CreateInput, UpdateInput> {
  protected abstract modelName: string;

  /**
   * Find a record by ID
   */
  async findById(id: number | string): Promise<T | null> {
    try {
      return await (prisma as any)[this.modelName].findUnique({
        where: { id },
      }) as T;
    } catch (error) {
      log.error(`Error finding ${this.modelName} by id`, { id, error: String(error) });
      throw error;
    }
  }

  /**
   * Find all records with optional filter
   */
  async findAll(where?: Record<string, unknown>): Promise<T[]> {
    try {
      return await (prisma as any)[this.modelName].findMany({
        where: where ?? {},
        orderBy: { createdAt: "desc" },
      }) as T[];
    } catch (error) {
      log.error(`Error finding all ${this.modelName}`, { error: String(error) });
      throw error;
    }
  }

  /**
   * Create a new record with retry logic
   */
  async create(data: CreateInput, retries = 1): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await (prisma as any)[this.modelName].create({
          data,
        }) as T;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        log.warn(`Error creating ${this.modelName} (attempt ${attempt + 1}/${retries + 1})`, {
          error: lastError.message,
        });
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, 100 * (attempt + 1)));
        }
      }
    }

    throw lastError ?? new Error(`Failed to create ${this.modelName}`);
  }

  /**
   * Update a record by ID
   */
  async update(id: number | string, data: UpdateInput): Promise<T> {
    try {
      return await (prisma as any)[this.modelName].update({
        where: { id },
        data,
      }) as T;
    } catch (error) {
      log.error(`Error updating ${this.modelName}`, { id, error: String(error) });
      throw error;
    }
  }

  /**
   * Delete a record by ID
   */
  async delete(id: number | string): Promise<T> {
    try {
      return await (prisma as any)[this.modelName].delete({
        where: { id },
      }) as T;
    } catch (error) {
      log.error(`Error deleting ${this.modelName}`, { id, error: String(error) });
      throw error;
    }
  }

  /**
   * Upsert (create or update) a record
   */
  async upsert(
    where: Record<string, unknown>,
    create: CreateInput,
    update: UpdateInput
  ): Promise<T> {
    try {
      return await (prisma as any)[this.modelName].upsert({
        where,
        create,
        update,
      }) as T;
    } catch (error) {
      log.error(`Error upserting ${this.modelName}`, { error: String(error) });
      throw error;
    }
  }

  /**
   * Count records matching optional filter
   */
  async count(where?: Record<string, unknown>): Promise<number> {
    try {
      return await (prisma as any)[this.modelName].count({
        where: where ?? {},
      }) as number;
    } catch (error) {
      log.error(`Error counting ${this.modelName}`, { error: String(error) });
      throw error;
    }
  }
}
