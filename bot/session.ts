import type { SessionData } from "@/types";
import { BotStep } from "@/types";
import { DEFAULT_LANGUAGE } from "@/bot/localization";

/**
 * Create a fresh initial session state.
 * Used by createInitialSession() and resetSession().
 */
export function createFreshSession(
  overrides?: Partial<SessionData>
): SessionData {
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
    ...overrides,
  };
}

/**
 * Reset the session to a clean IDLE state.
 * This should be called on /start, /cancel, /menu, and entering main menu.
 * Preserves userId, language, and languageSelected preference.
 */
export function resetSession(
  session: SessionData,
  keepUserId: boolean = true
): void {
  const userId = keepUserId ? session.userId : null;
  // Preserve language preferences across session resets
  const language = session.language;
  const languageSelected = session.languageSelected;
  const fresh = createFreshSession({ userId, language, languageSelected });
  Object.assign(session, fresh);
}

/**
 * Clear mode-specific data when entering a new AI mode.
 * Keeps userId intact, but clears stale conversation/messages/tempData.
 */
export function clearModeData(session: SessionData): void {
  session.conversationId = null;
  session.messages = [];
  session.tempData = {};
}
