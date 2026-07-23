/**
 * Project File Repository
 * Manages files/attachments stored within projects.
 */

import { prisma } from "@/lib/prisma";

export interface CreateProjectFileData {
  projectId: string;
  userId: number;
  fileName: string;
  fileType: string;
  fileUrl?: string;
  content?: string;
  size?: number;
}

export class ProjectFileRepository {
  /**
   * Create a new file entry in a project
   */
  async create(data: CreateProjectFileData) {
    return await prisma.projectFile.create({
      data: {
        projectId: data.projectId,
        userId: data.userId,
        fileName: data.fileName,
        fileType: data.fileType,
        fileUrl: data.fileUrl ?? null,
        content: data.content ?? null,
        size: data.size ?? null,
      },
    });
  }

  /**
   * Find file by ID
   */
  async findById(id: string) {
    return await prisma.projectFile.findUnique({ where: { id } });
  }

  /**
   * Find all files in a project
   */
  async findByProject(projectId: string, fileType?: string) {
    return await prisma.projectFile.findMany({
      where: {
        projectId,
        ...(fileType ? { fileType } : {}),
      },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Delete a file
   */
  async delete(id: string) {
    await prisma.projectFile.delete({ where: { id } });
  }

  /**
   * Count files in a project
   */
  async countByProject(projectId: string): Promise<number> {
    return await prisma.projectFile.count({ where: { projectId } });
  }
}

export const projectFileRepository = new ProjectFileRepository();
