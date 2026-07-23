/**
 * Project Service
 * Manages user projects — containers for conversations, files, and notes.
 * Each project can contain multiple conversations (chat, image, video, coding, etc.),
 * uploaded files, and text notes.
 */

import { projectRepository } from "@/repositories/project";
import { projectFileRepository } from "@/repositories/project-file";
import { projectNoteRepository } from "@/repositories/project-note";
import { conversationRepository } from "@/repositories/conversation";
import { prisma } from "@/lib/prisma";
import { logger } from "@/bot/core/logger";
import type { CreateProjectData, UpdateProjectData } from "@/repositories/project";

const log = logger.child("project-service");

export class ProjectService {
  // ─── CRUD ───────────────────────────────────────────

  /**
   * Create a new project
   */
  async create(data: CreateProjectData) {
    log.info("Creating project", { userId: data.userId, name: data.name });
    return await projectRepository.create(data);
  }

  /**
   * Get project by ID with counts
   */
  async getById(projectId: string) {
    return await projectRepository.findById(projectId);
  }

  /**
   * Get all projects for a user
   */
  async getUserProjects(userId: number, includeArchived = false) {
    return await projectRepository.findByUser(userId, includeArchived);
  }

  /**
   * Update project details
   */
  async update(projectId: string, data: UpdateProjectData) {
    return await projectRepository.update(projectId, data);
  }

  /**
   * Archive a project
   */
  async archive(projectId: string) {
    return await projectRepository.archive(projectId);
  }

  /**
   * Delete a project and all associated data
   */
  async delete(projectId: string): Promise<boolean> {
    return await projectRepository.delete(projectId);
  }

  // ─── Conversations Scoped to Project ──────────────

  /**
   * Get all conversations within a project
   */
  async getProjectConversations(projectId: string, feature?: string) {
    const project = await projectRepository.findById(projectId);
    if (!project) return [];

    return await conversationRepository.findByProject(projectId, feature);
  }

  /**
   * Count conversations in a project
   */
  async countConversations(projectId: string): Promise<number> {
    return await prisma.conversation.count({
      where: { projectId, isActive: true },
    });
  }

  // ─── Files ─────────────────────────────────────────

  /**
   * Add a file to a project
   */
  async addFile(data: {
    projectId: string;
    userId: number;
    fileName: string;
    fileType: string;
    fileUrl?: string;
    content?: string;
    size?: number;
  }) {
    return await projectFileRepository.create(data);
  }

  /**
   * Get all files in a project
   */
  async getProjectFiles(projectId: string, fileType?: string) {
    return await projectFileRepository.findByProject(projectId, fileType);
  }

  /**
   * Delete a file
   */
  async deleteFile(fileId: string) {
    await projectFileRepository.delete(fileId);
  }

  // ─── Notes ─────────────────────────────────────────

  /**
   * Create a note in a project
   */
  async createNote(data: {
    projectId: string;
    userId: number;
    title?: string;
    content?: string;
  }) {
    return await projectNoteRepository.create(data);
  }

  /**
   * Get a note by ID
   */
  async getNoteById(noteId: string) {
    return await projectNoteRepository.findById(noteId);
  }

  /**
   * Get all notes in a project
   */
  async getProjectNotes(projectId: string) {
    return await projectNoteRepository.findByProject(projectId);
  }

  /**
   * Update a note
   */
  async updateNote(noteId: string, data: { title?: string; content?: string; isPinned?: boolean }) {
    return await projectNoteRepository.update(noteId, data);
  }

  /**
   * Toggle note pin
   */
  async toggleNotePin(noteId: string) {
    return await projectNoteRepository.togglePin(noteId);
  }

  /**
   * Delete a note
   */
  async deleteNote(noteId: string) {
    await projectNoteRepository.delete(noteId);
  }

  // ─── Utility ───────────────────────────────────────

  /**
   * Check if a user owns a project
   */
  async verifyOwnership(projectId: string, userId: number): Promise<boolean> {
    const project = await projectRepository.findById(projectId);
    return project?.userId === userId;
  }

  /**
   * Rename a project
   */
  async rename(projectId: string, name: string) {
    return await projectRepository.update(projectId, { name });
  }

  /**
   * Search user's projects
   */
  async searchProjects(userId: number, query: string) {
    return await projectRepository.search(userId, query);
  }
}

export const projectService = new ProjectService();
