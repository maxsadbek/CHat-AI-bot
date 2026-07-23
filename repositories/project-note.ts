/**
 * Project Note Repository
 * Manages text notes stored within projects.
 */

import { prisma } from "@/lib/prisma";

export interface CreateProjectNoteData {
  projectId: string;
  userId: number;
  title?: string;
  content?: string;
}

export interface UpdateProjectNoteData {
  title?: string;
  content?: string;
  isPinned?: boolean;
}

export class ProjectNoteRepository {
  /**
   * Create a new note in a project
   */
  async create(data: CreateProjectNoteData) {
    return await prisma.projectNote.create({
      data: {
        projectId: data.projectId,
        userId: data.userId,
        title: data.title ?? "Untitled Note",
        content: data.content ?? "",
      },
    });
  }

  /**
   * Find note by ID
   */
  async findById(id: string) {
    return await prisma.projectNote.findUnique({ where: { id } });
  }

  /**
   * Find all notes in a project
   */
  async findByProject(projectId: string) {
    return await prisma.projectNote.findMany({
      where: { projectId },
      orderBy: [{ isPinned: "desc" }, { updatedAt: "desc" }],
    });
  }

  /**
   * Update a note
   */
  async update(id: string, data: UpdateProjectNoteData) {
    return await prisma.projectNote.update({
      where: { id },
      data,
    });
  }

  /**
   * Toggle pin status
   */
  async togglePin(id: string) {
    const note = await prisma.projectNote.findUnique({ where: { id } });
    if (!note) return null;
    return await prisma.projectNote.update({
      where: { id },
      data: { isPinned: !note.isPinned },
    });
  }

  /**
   * Delete a note
   */
  async delete(id: string) {
    await prisma.projectNote.delete({ where: { id } });
  }

  /**
   * Count notes in a project
   */
  async countByProject(projectId: string): Promise<number> {
    return await prisma.projectNote.count({ where: { projectId } });
  }
}

export const projectNoteRepository = new ProjectNoteRepository();
