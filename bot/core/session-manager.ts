/**
 * Session Manager
 * Centralizes all session operations — create, reset, clear mode data,
 * update language, and track state.
 */

import type { SessionData } from "@/types";
import { BotStep } from "@/types";
import { DEFAULT_LANGUAGE } from "@/bot/localization";
import type { SupportedLanguage } from "@/bot/localization";

export class SessionManager {
  /**
   * Create a fresh initial session state
   */
  createFresh(overrides?: Partial<SessionData>): SessionData {
    return {
      step: BotStep.IDLE,
      userId: null,
      conversationId: null,
      messages: [],
      tempData: {},
      language: DEFAULT_LANGUAGE,
      languageSelected: false,
      selectedVideoPlatform: "all",
      selectedImagePlatform: "all",
      selectedSocialPlatform: "all",
      selectedBusinessType: "startup_idea",
    selectedCodeLanguage: "Next.js",
    selectedModel: "gpt-4o",
    ...overrides,
    };
  }

  /**
   * Reset session to clean IDLE state.
   * Preserves userId, language, and languageSelected by default.
   */
  reset(session: SessionData, keepUserId: boolean = true): void {
    const userId = keepUserId ? session.userId : null;
    const language = session.language;
    const languageSelected = session.languageSelected;
    const fresh = this.createFresh({ userId, language, languageSelected });
    Object.assign(session, fresh);
  }

  /**
   * Clear mode-specific data when entering a new AI mode.
   * Keeps userId intact but clears conversation/messages/tempData.
   */
  clearMode(session: SessionData): void {
    session.conversationId = null;
    session.messages = [];
    session.tempData = {};
  }

  /**
   * Set user language in session
   */
  setLanguage(session: SessionData, language: SupportedLanguage): void {
    session.language = language;
    session.languageSelected = true;
  }

  /**
   * Set the current bot step/mode
   */
  setStep(session: SessionData, step: BotStep): void {
    session.step = step;
  }

  /**
   * Set user ID
   */
  setUserId(session: SessionData, userId: number): void {
    session.userId = userId;
  }

  /**
   * Create new conversation in session
   */
  setConversationId(session: SessionData, conversationId: string): void {
    session.conversationId = conversationId;
  }

  /**
   * Add a message to session history
   */
  addMessage(
    session: SessionData,
    message: { role: "user" | "assistant"; content: string }
  ): void {
    session.messages.push(message);
  }

  /**
   * Clear conversation messages
   */
  clearMessages(session: SessionData): void {
    session.messages = [];
    session.conversationId = null;
  }

  /**
   * Set the AI model for this session
   */
  setModel(session: SessionData, modelId: string): void {
    session.selectedModel = modelId;
  }

  /**
   * Get the currently selected AI model
   */
  getModel(session: SessionData): string {
    return session.selectedModel;
  }

  /**
   * Set temporary data
   */
  setTempData(session: SessionData, key: string, value: string): void {
    session.tempData[key] = value;
  }

  /**
   * Get temporary data
   */
  getTempData(session: SessionData, key: string): string | undefined {
    return session.tempData[key];
  }

  /**
   * Clear temporary data
   */
  clearTempData(session: SessionData): void {
    session.tempData = {};
  }
}

export const sessionManager = new SessionManager();
