/**
 * Session Management
 * Legacy compatibility layer — delegates to SessionManager.
 * Re-exports session manager functions for backward compatibility.
 */

import type { SessionData } from "@/types";
import { BotStep } from "@/types";
import { sessionManager } from "@/bot/core/session-manager";

/**
 * Create a fresh initial session state.
 */
export function createFreshSession(
  overrides?: Partial<SessionData>
): SessionData {
  return sessionManager.createFresh(overrides);
}

/**
 * Reset the session to a clean IDLE state.
 * Preserves userId, language, and languageSelected preference.
 */
export function resetSession(
  session: SessionData,
  keepUserId: boolean = true
): void {
  sessionManager.reset(session, keepUserId);
}

/**
 * Clear mode-specific data when entering a new AI mode.
 * Keeps userId intact, but clears stale conversation/messages/tempData.
 */
export function clearModeData(session: SessionData): void {
  sessionManager.clearMode(session);
}
