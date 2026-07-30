/**
 * Voice Manager Stub
 *
 * Placeholder for future audio/sound functionality.
 * Currently logs actions to console — no real audio playback.
 *
 * Planned: TTS-based startup/shutdown announcements, voice alerts
 * for critical system events, and audio feedback for admin actions.
 */

import { logger } from "@/bot/core/logger";

const log = logger.child("voice");

class VoiceManager {
  private initialized = false;

  /**
   * Initialize the voice system.
   * Currently a no-op stub — always resolves successfully.
   */
  async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    log.info("Voice Manager initialized (stub mode — no audio hardware)");
  }

  /**
   * Play a startup sound/sequence.
   * Stub implementation — just logs.
   */
  async playStartupSequence(): Promise<void> {
    log.info("Startup sequence triggered (stub — no audio playback)");
  }

  /**
   * Play a shutdown sound/sequence.
   * Stub implementation — just logs.
   */
  async playShutdownSequence(): Promise<void> {
    log.info("Shutdown sequence triggered (stub — no audio playback)");
  }
}

export const voiceManager = new VoiceManager();
