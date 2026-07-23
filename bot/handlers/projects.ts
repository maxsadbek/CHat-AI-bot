/**
 * Projects Handler
 * Users can create projects as containers for Chat, Images, Videos,
 * Files, Notes, and History. Projects function as workspaces.
 *
 * Flow:
 *   Main Menu → 📁 Projects → List projects → Open project hub
 *   Project hub: 💬 Chat | 🎨 Images | 🎬 Videos | 📄 Files | 📝 Notes | 📋 History
 */

import { InlineKeyboard } from "grammy";
import type { BotContext } from "@/types";
import { BotStep } from "@/types";
import { projectService } from "@/services/project";
import { sessionManager } from "@/bot/core/session-manager";
import { modeManager } from "@/bot/core/mode-manager";
import { t } from "@/bot/localization";
import { logger } from "@/bot/core/logger";
import {
  mainMenuKeyboard,
  addNavRow,
} from "@/bot/keyboards";
import { formatDate } from "@/utils/helpers";
import { escapeMarkdown } from "@/utils/markdown";

const log = logger.child("projects-handler");

// ═══════════════════════════════════════════════════════════════
// KEYBOARDS
// ═══════════════════════════════════════════════════════════════

function projectHubKeyboard(): InlineKeyboard {
  return addNavRow(
    new InlineKeyboard()
      .text("💬 Chat", "project:hub:chat")
      .text("🎨 Images", "project:hub:images")
      .row()
      .text("🎬 Videos", "project:hub:videos")
      .text("📄 Files", "project:hub:files")
      .row()
      .text("📝 Notes", "project:hub:notes")
      .text("📋 History", "project:hub:history")
      .row()
      .text("📤 Upload File", "project:file:upload")
      .row()
      .text("✏️ Rename", "project:rename")
      .text("🗑️ Delete", "project:delete")
  );
}



function projectNoteKeyboard(noteId: string): InlineKeyboard {
  return addNavRow(
    new InlineKeyboard()
      .text("📝 Edit", `project:note:edit:${noteId}`)
      .text("📌 Toggle Pin", `project:note:pin:${noteId}`)
      .row()
      .text("🗑️ Delete", `project:note:delete:${noteId}`)
  );
}

// ═══════════════════════════════════════════════════════════════
// HANDLERS
// ═══════════════════════════════════════════════════════════════

/**
 * Main project list handler — shows all projects
 */
export async function projectsHandler(ctx: BotContext): Promise<void> {
  const lang = ctx.session.language;
  const userId = ctx.session.userId;

  if (!userId) return;

  sessionManager.setStep(ctx.session, BotStep.PROJECTS);
  sessionManager.clearProjectContext(ctx.session);

  const projects = await projectService.getUserProjects(userId);

  if (projects.length === 0) {
    // No projects — prompt to create one
    const kb = addNavRow(
      new InlineKeyboard()
        .text("📁 New Project", "project:create")
    );
    await ctx.reply(t(lang, "projects.empty"), {
      parse_mode: "Markdown",
      reply_markup: kb,
    });
    return;
  }

  // Build project list
  const lines = projects.map((p, i) => {
    const convCount = p._count?.conversations ?? 0;
    const fileCount = p._count?.files ?? 0;
    const noteCount = p._count?.notes ?? 0;
    return `${p.emoji} *${p.name}*\n   💬 ${convCount} · 📄 ${fileCount} · 📝 ${noteCount}\n   🕐 ${formatDate(p.updatedAt)}`;
  });

  const text = [
    t(lang, "projects.title"),
    "",
    ...lines,
    "",
    t(lang, "projects.select_prompt"),
  ].join("\n");

  // Build keyboard with open buttons for each project
  const kb = new InlineKeyboard();
  projects.slice(0, 10).forEach((p) => {
    kb.text(`${p.emoji} ${p.name}`, `project:open:${p.id}`);
    kb.row();
  });
  kb.text("📁 New Project", "project:create");
  addNavRow(kb);

  await ctx.reply(text, {
    parse_mode: "Markdown",
    reply_markup: kb,
  });
}

/**
 * Create a new project — prompts for name
 */
export async function projectCreateHandler(ctx: BotContext): Promise<void> {
  const lang = ctx.session.language;

  sessionManager.setStep(ctx.session, BotStep.PROJECT_CREATE);
  const kb = addNavRow(new InlineKeyboard());
  await ctx.reply(t(lang, "projects.create_prompt"), {
    parse_mode: "Markdown",
    reply_markup: kb,
  });
}

/**
 * Handle text input for project name creation
 */
export async function projectCreateNameHandler(ctx: BotContext): Promise<void> {
  const lang = ctx.session.language;
  const userId = ctx.session.userId;
  const name = ctx.message?.text?.trim();

  if (!userId || !name) return;

  if (name.length > 100) {
    await ctx.reply(t(lang, "projects.name_too_long"), { parse_mode: "Markdown" });
    return;
  }

  try {
    const project = await projectService.create({
      userId,
      name,
    });

    log.info("Project created", { userId, projectId: project.id, name });

    // Open the new project hub
    sessionManager.setCurrentProject(ctx.session, project.id);
    sessionManager.setStep(ctx.session, BotStep.PROJECTS);

    await openProjectHub(ctx, project.id, true);
  } catch (error) {
    log.error("Failed to create project", { userId, name, error: String(error) });
    await ctx.reply(t(lang, "errors.generic"), { parse_mode: "Markdown" });
  }
}

/**
 * Open a project hub
 */
export async function projectOpenHandler(ctx: BotContext, projectId: string): Promise<void> {
  sessionManager.setCurrentProject(ctx.session, projectId);
  await openProjectHub(ctx, projectId);
}

async function openProjectHub(ctx: BotContext, projectId: string, isNew = false): Promise<void> {
  const lang = ctx.session.language;
  const userId = ctx.session.userId;
  if (!userId) return;

  const project = await projectService.getById(projectId);
  if (!project) {
    await ctx.reply(t(lang, "projects.not_found"), { parse_mode: "Markdown" });
    return;
  }

  // Verify ownership
  if (project.userId !== userId) {
    await ctx.reply(t(lang, "errors.generic"), { parse_mode: "Markdown" });
    return;
  }

  const convCount = project._count?.conversations ?? 0;
  const fileCount = project._count?.files ?? 0;
  const noteCount = project._count?.notes ?? 0;

  const text = isNew
    ? [
        t(lang, "projects.created", { name: project.name }),
        "",
        project.description ?? "",
        `━━━━━━━━━━━━━━━━━━━━━`,
        `${project.emoji} *${project.name}*`,
        "",
        `${t(lang, "projects.hub_stats", {
          chats: String(convCount),
          files: String(fileCount),
          notes: String(noteCount),
        })}`,
        "",
        t(lang, "projects.hub_prompt"),
      ].join("\n")
    : [
        `━━━━━━━━━━━━━━━━━━━━━`,
        `${project.emoji} *${project.name}*`,
        "",
        `${t(lang, "projects.hub_stats", {
          chats: String(convCount),
          files: String(fileCount),
          notes: String(noteCount),
        })}`,
        "",
        t(lang, "projects.hub_prompt"),
      ].join("\n");

  await ctx.reply(text, {
    parse_mode: "Markdown",
    reply_markup: projectHubKeyboard(),
  });
}

/**
 * Rename project — prompts for new name
 */
export async function projectRenameHandler(ctx: BotContext): Promise<void> {
  const lang = ctx.session.language;
  const projectId = ctx.session.currentProjectId;
  if (!projectId) return;

  sessionManager.setStep(ctx.session, BotStep.PROJECT_RENAME);
  const kb = addNavRow(new InlineKeyboard());
  await ctx.reply(t(lang, "projects.rename_prompt"), {
    parse_mode: "Markdown",
    reply_markup: kb,
  });
}

/**
 * Handle text input for project rename
 */
export async function projectRenameNameHandler(ctx: BotContext): Promise<void> {
  const lang = ctx.session.language;
  const userId = ctx.session.userId;
  const projectId = ctx.session.currentProjectId;
  const name = ctx.message?.text?.trim();

  if (!userId || !projectId || !name) return;

  if (name.length > 100) {
    await ctx.reply(t(lang, "projects.name_too_long"), { parse_mode: "Markdown" });
    return;
  }

  try {
    await projectService.rename(projectId, name);
    log.info("Project renamed", { userId, projectId, name });
    sessionManager.setStep(ctx.session, BotStep.PROJECTS);

    await ctx.reply(t(lang, "projects.renamed", { name }), {
      parse_mode: "Markdown",
      reply_markup: projectHubKeyboard(),
    });
  } catch (error) {
    log.error("Failed to rename project", { projectId, name, error: String(error) });
    await ctx.reply(t(lang, "errors.generic"), { parse_mode: "Markdown" });
  }
}

/**
 * Delete project — confirmation
 */
export async function projectDeleteHandler(ctx: BotContext): Promise<void> {
  const lang = ctx.session.language;
  const projectId = ctx.session.currentProjectId;
  if (!projectId) return;

  const project = await projectService.getById(projectId);
  if (!project) return;

  const text = [
    t(lang, "projects.delete_confirm", { name: project.name }),
    "",
    t(lang, "projects.delete_warning"),
  ].join("\n");

  const kb = addNavRow(
    new InlineKeyboard()
      .text("✅ Yes, Delete", `project:delete:confirm:${projectId}`)
      .text("❌ Cancel", `project:delete:cancel:${projectId}`)
  );

  await ctx.reply(text, {
    parse_mode: "Markdown",
    reply_markup: kb,
  });
}

/**
 * Confirm project deletion
 */
export async function projectDeleteConfirmHandler(ctx: BotContext, projectId: string): Promise<void> {
  const lang = ctx.session.language;
  const userId = ctx.session.userId;

  if (!userId) return;

  const owned = await projectService.verifyOwnership(projectId, userId);
  if (!owned) {
    await ctx.reply(t(lang, "errors.generic"), { parse_mode: "Markdown" });
    return;
  }

  try {
    await projectService.delete(projectId);
    log.info("Project deleted", { userId, projectId });
    sessionManager.clearProjectContext(ctx.session);

    await ctx.reply(t(lang, "projects.deleted"), {
      parse_mode: "Markdown",
      reply_markup: mainMenuKeyboard,
    });
  } catch (error) {
    log.error("Failed to delete project", { projectId, error: String(error) });
    await ctx.reply(t(lang, "errors.generic"), { parse_mode: "Markdown" });
  }
}

/**
 * Cancel deletion
 */
export async function projectDeleteCancelHandler(ctx: BotContext, projectId: string): Promise<void> {
  const lang = ctx.session.language;
  sessionManager.setStep(ctx.session, BotStep.PROJECTS);
  sessionManager.setCurrentProject(ctx.session, projectId);

  await openProjectHub(ctx, projectId);
}

// ═══════════════════════════════════════════════════════════════
// PROJECT HUB ACTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Open chat within project context
 */
export async function projectHubChatHandler(ctx: BotContext): Promise<void> {
  const lang = ctx.session.language;
  const projectId = ctx.session.currentProjectId;

  if (!projectId) return;

  // Switch to AI Chat mode, project context preserved in session
  const msg = modeManager.switchTo(ctx, "chat");
  await ctx.reply(msg, {
    parse_mode: "Markdown",
  });
}

/**
 * Show images generated within this project
 */
export async function projectHubImagesHandler(ctx: BotContext): Promise<void> {
  const lang = ctx.session.language;
  const projectId = ctx.session.currentProjectId;

  if (!projectId) {
    await ctx.reply(t(lang, "errors.generic"), { parse_mode: "Markdown" });
    return;
  }

  const conversations = await projectService.getProjectConversations(projectId, "image");

  if (conversations.length === 0) {
    await ctx.reply(t(lang, "projects.no_images"), {
      parse_mode: "Markdown",
      reply_markup: projectHubKeyboard(),
    });
    return;
  }

  const lines = conversations.map((c, i) =>
    `${i + 1}. *${c.title}* — 🕐 ${formatDate(c.updatedAt)}`
  );

  const text = [
    t(lang, "projects.hub_images_title"),
    "",
    ...lines,
  ].join("\n");

  await ctx.reply(text, {
    parse_mode: "Markdown",
    reply_markup: projectHubKeyboard(),
  });
}

/**
 * Show videos generated within this project
 */
export async function projectHubVideosHandler(ctx: BotContext): Promise<void> {
  const lang = ctx.session.language;
  const projectId = ctx.session.currentProjectId;

  if (!projectId) {
    await ctx.reply(t(lang, "errors.generic"), { parse_mode: "Markdown" });
    return;
  }

  const conversations = await projectService.getProjectConversations(projectId, "video");

  if (conversations.length === 0) {
    await ctx.reply(t(lang, "projects.no_videos"), {
      parse_mode: "Markdown",
      reply_markup: projectHubKeyboard(),
    });
    return;
  }

  const lines = conversations.map((c, i) =>
    `${i + 1}. *${c.title}* — 🕐 ${formatDate(c.updatedAt)}`
  );

  const text = [
    t(lang, "projects.hub_videos_title"),
    "",
    ...lines,
  ].join("\n");

  await ctx.reply(text, {
    parse_mode: "Markdown",
    reply_markup: projectHubKeyboard(),
  });
}

/**
 * Show files in this project
 */
export async function projectHubFilesHandler(ctx: BotContext): Promise<void> {
  const lang = ctx.session.language;
  const projectId = ctx.session.currentProjectId;

  if (!projectId) {
    await ctx.reply(t(lang, "errors.generic"), { parse_mode: "Markdown" });
    return;
  }

  const files = await projectService.getProjectFiles(projectId);

  if (files.length === 0) {
    await ctx.reply(t(lang, "projects.no_files"), {
      parse_mode: "Markdown",
      reply_markup: projectHubKeyboard(),
    });
    return;
  }

  const lines = files.map((f, i) =>
    `${i + 1}. ${f.fileName} (${f.fileType})`
  );

  const text = [
    t(lang, "projects.hub_files_title"),
    "",
    ...lines,
  ].join("\n");

  await ctx.reply(text, {
    parse_mode: "Markdown",
    reply_markup: projectHubKeyboard(),
  });
}

// Placeholder for future file upload — sends a friendly "coming soon" message
// Will be expanded when direct file upload via Telegram is integrated
export async function projectFileUploadHandler(ctx: BotContext): Promise<void> {
  const lang = ctx.session.language;
  await ctx.reply("📄 *File upload coming soon!*\n\nYou'll be able to upload images, documents, and code files directly to your project.\n\nFor now, use 📝 Notes to save text content.", {
    parse_mode: "Markdown",
    reply_markup: projectHubKeyboard(),
  });
}

/**
 * Show notes in this project
 */
export async function projectHubNotesHandler(ctx: BotContext): Promise<void> {
  const lang = ctx.session.language;
  const projectId = ctx.session.currentProjectId;

  if (!projectId) {
    await ctx.reply(t(lang, "errors.generic"), { parse_mode: "Markdown" });
    return;
  }

  const notes = await projectService.getProjectNotes(projectId);

  if (notes.length === 0) {
    const kb = addNavRow(
      new InlineKeyboard()
        .text("📝 New Note", "project:note:create")
    );
    await ctx.reply(t(lang, "projects.no_notes"), {
      parse_mode: "Markdown",
      reply_markup: kb,
    });
    return;
  }

  // Build notes list
  const lines = notes.map((n, i) => {
    const pin = n.isPinned ? "📌 " : "";
    const preview = n.content.slice(0, 60).replace(/\n/g, " ");
    const date = formatDate(n.updatedAt);
    return `${pin}*${n.title}*\n   ${preview}${n.content.length > 60 ? "…" : ""}\n   🕐 ${date}`;
  });

  const text = [
    t(lang, "projects.hub_notes_title"),
    "",
    ...lines,
  ].join("\n");

  const kb = new InlineKeyboard();
  notes.slice(0, 10).forEach((n) => {
    kb.text(`${n.isPinned ? "📌" : "📝"} ${n.title.slice(0, 20)}`, `project:note:view:${n.id}`);
    kb.row();
  });
  kb.text("📝 New Note", "project:note:create");
  addNavRow(kb);

  await ctx.reply(text, {
    parse_mode: "Markdown",
    reply_markup: kb,
  });
}

/**
 * Show all history (conversations) in this project
 */
export async function projectHubHistoryHandler(ctx: BotContext): Promise<void> {
  const lang = ctx.session.language;
  const projectId = ctx.session.currentProjectId;

  if (!projectId) {
    await ctx.reply(t(lang, "errors.generic"), { parse_mode: "Markdown" });
    return;
  }

  const conversations = await projectService.getProjectConversations(projectId);

  if (conversations.length === 0) {
    await ctx.reply(t(lang, "projects.no_history"), {
      parse_mode: "Markdown",
      reply_markup: projectHubKeyboard(),
    });
    return;
  }

  const lines = conversations.map((c, i) => {
    const emoji = featureEmoji(c.feature);
    return `${emoji} *${c.title}*\n   📝 ${c._count?.messages ?? 0} msgs · 🕐 ${formatDate(c.updatedAt)}`;
  });

  const text = [
    t(lang, "projects.hub_history_title"),
    "",
    ...lines.slice(0, 15),
    conversations.length > 15 ? `\n+${conversations.length - 15} more` : "",
  ].join("\n");

  await ctx.reply(text, {
    parse_mode: "Markdown",
    reply_markup: projectHubKeyboard(),
  });
}

// ═══════════════════════════════════════════════════════════════
// NOTES CRUD
// ═══════════════════════════════════════════════════════════════

/**
 * Start creating a note — prompts for title
 */
export async function projectNoteCreateHandler(ctx: BotContext): Promise<void> {
  const lang = ctx.session.language;
  const projectId = ctx.session.currentProjectId;
  if (!projectId) return;

  sessionManager.setStep(ctx.session, BotStep.PROJECT_NOTE_CREATE);
  sessionManager.setTempData(ctx.session, "noteStep", "title");

  const kb = addNavRow(new InlineKeyboard());
  await ctx.reply(t(lang, "projects.note_title_prompt"), {
    parse_mode: "Markdown",
    reply_markup: kb,
  });
}

/**
 * Handle text input for note title
 */
export async function projectNoteTitleHandler(ctx: BotContext): Promise<void> {
  const lang = ctx.session.language;
  const title = ctx.message?.text?.trim();
  if (!title) return;

  sessionManager.setTempData(ctx.session, "noteTitle", title);
  sessionManager.setTempData(ctx.session, "noteStep", "content");

  const kb = addNavRow(new InlineKeyboard());
  await ctx.reply(t(lang, "projects.note_content_prompt"), {
    parse_mode: "Markdown",
    reply_markup: kb,
  });
}

/**
 * Handle text input for note content — saves the note
 */
export async function projectNoteContentHandler(ctx: BotContext): Promise<void> {
  const lang = ctx.session.language;
  const userId = ctx.session.userId;
  const projectId = ctx.session.currentProjectId;

  if (!userId || !projectId) return;

  const content = ctx.message?.text?.trim();
  const title = sessionManager.getTempData(ctx.session, "noteTitle") ?? "Untitled Note";
  if (!content) return;

  try {
    await projectService.createNote({
      projectId,
      userId,
      title,
      content,
    });

    sessionManager.clearTempData(ctx.session);
    sessionManager.setStep(ctx.session, BotStep.PROJECTS);

    await ctx.reply(t(lang, "projects.note_created"), {
      parse_mode: "Markdown",
      reply_markup: projectHubKeyboard(),
    });
  } catch (error) {
    log.error("Failed to create note", { userId, projectId, error: String(error) });
    await ctx.reply(t(lang, "errors.generic"), { parse_mode: "Markdown" });
  }
}

/**
 * View a note
 */
export async function projectNoteViewHandler(ctx: BotContext, noteId: string): Promise<void> {
  const lang = ctx.session.language;
  const userId = ctx.session.userId;
  if (!userId) return;

  const note = await projectService.getNoteById(noteId);

  if (!note) {
    await ctx.reply(t(lang, "projects.note_not_found"), { parse_mode: "Markdown" });
    return;
  }

  // Verify ownership through project
  const owned = await projectService.verifyOwnership(note.projectId, userId);
  if (!owned) return;

  const text = [
    `${note.isPinned ? "📌 " : ""}*${escapeMarkdown(note.title)}*`,
    "",
    escapeMarkdown(note.content),
    "",
    `━━━━━━━━━━━━━━━━━━━━━`,
    `🕐 ${formatDate(note.updatedAt)}`,
  ].join("\n");

  await ctx.reply(text, {
    parse_mode: "Markdown",
    reply_markup: projectNoteKeyboard(noteId),
  });
}

/**
 * Toggle note pin
 */
export async function projectNotePinHandler(ctx: BotContext, noteId: string): Promise<void> {
  const lang = ctx.session.language;
  try {
    await projectService.toggleNotePin(noteId);
    await ctx.reply(t(lang, "projects.note_pinned"), {
      parse_mode: "Markdown",
    });
    await projectNoteViewHandler(ctx, noteId);
  } catch (error) {
    log.error("Failed to toggle note pin", { noteId, error: String(error) });
    await ctx.reply(t(lang, "errors.generic"), { parse_mode: "Markdown" });
  }
}

/**
 * Delete a note
 */
export async function projectNoteDeleteHandler(ctx: BotContext, noteId: string): Promise<void> {
  const lang = ctx.session.language;
  try {
    await projectService.deleteNote(noteId);
    await ctx.reply(t(lang, "projects.note_deleted"), {
      parse_mode: "Markdown",
      reply_markup: projectHubKeyboard(),
    });
  } catch (error) {
    log.error("Failed to delete note", { noteId, error: String(error) });
    await ctx.reply(t(lang, "errors.generic"), { parse_mode: "Markdown" });
  }
}

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function featureEmoji(feature: string): string {
  switch (feature) {
    case "chat": return "💬";
    case "image": return "🎨";
    case "video": return "🎬";
    case "coding": return "💻";
    case "social": return "📱";
    case "business": return "💼";
    case "translate": return "🌍";
    default: return "💬";
  }
}


