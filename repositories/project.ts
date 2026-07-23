/**
 * Project Repository
 * Handles database operations for Project model.
 * Follows the same pattern as conversationRepository.
 */

import { prisma } from "@/lib/prisma";
import { logger } from "@/bot/core/logger";

const log = logger.child("project-repo");

export interface CreateProjectData {
  userId: number;
  name: string;
  description?: string;
  emoji?: string;
  color?: string;
}

export interface UpdateProjectData {
  name?: string;
  description?: string;
  emoji?: string;
  color?: string;
  isArchived?: boolean;
}

export class ProjectRepository {
  /**
   * Create a new project
   */
  async create(data: CreateProjectData) {
    return await prisma.project.create({
      data: {
        userId: data.userId,
        name: data.name,
        description: data.description ?? null,
        emoji: data.emoji ?? "📁",
        color: data.color ?? null,
      },
    });
  }

  /**
   * Find project by ID
   */
  async findById(id: string) {
    return await prisma.project.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            conversations: true,
            files: true,
            notes: true,
          },
        },
      },
    });
  }

  /**
   * Find all non-archived projects for a user, ordered by updatedAt
   */
  async findByUser(userId: number, includeArchived = false) {
    return await prisma.project.findMany({
      where: {
        userId,
        ...(includeArchived ? {} : { isArchived: false }),
      },
      orderBy: { updatedAt: "desc" },
      include: {
        _count: {
          select: {
            conversations: true,
            files: true,
            notes: true,
          },
        },
      },
    });
  }

  /**
   * Update a project
   */
  async update(id: string, data: UpdateProjectData) {
    return await prisma.project.update({
      where: { id },
      data,
    });
  }

  /**
   * Archive a project (soft delete)
   */
  async archive(id: string) {
    return await prisma.project.update({
      where: { id },
      data: { isArchived: true },
    });
  }

  /**
   * Permanently delete a project and all its related data
   */
  async delete(id: string) {
    try {
      await prisma.project.delete({ where: { id } });
      return true;
    } catch (error) {
      log.error("Error deleting project", { projectId: id, error: String(error) });
      return false;
    }
  }

  /**
   * Get total project count for a user
   */
  async countByUser(userId: number): Promise<number> {
    return await prisma.project.count({
      where: { userId, isArchived: false },
    });
  }

  /**
   * Search projects by name (case-insensitive)
   */
  async search(userId: number, query: string) {
    return await prisma.project.findMany({
      where: {
        userId,
        isArchived: false,
        name: { contains: query, mode: "insensitive" },
      },
      orderBy: { updatedAt: "desc" },
      take: 10,
    });
  }
}

export const projectRepository = new ProjectRepository();
