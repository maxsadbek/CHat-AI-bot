/**
 * Mode Manager
 * Centralizes mode switching logic.
 * Only one mode active at a time. Opening another mode
 * automatically closes the previous one with clean state transitions.
 */

import type { BotContext } from "@/types";
import { BotStep } from "@/types";
import { sessionManager } from "@/bot/core/session-manager";
import { t } from "@/bot/localization";
import type { SupportedLanguage } from "@/bot/localization";

// ─── Mode Descriptors ────────────────────────────────

export interface ModeDescriptor {
  id: string;
  step: BotStep;
  emoji: string;
  name: string;
  description: string;
}

// ─── Mode Registry ───────────────────────────────────

// Built-in mode definitions
const MODE_REGISTRY: Record<string, ModeDescriptor> = {
  chat: {
    id: "chat",
    step: BotStep.AI_CHAT,
    emoji: "🤖",
    name: "AI Chat",
    description: "Send me a message and I'll respond!",
  },
  video: {
    id: "video",
    step: BotStep.VIDEO_PROMPT,
    emoji: "🎬",
    name: "Video AI",
    description: "Describe your video idea.",
  },
  image: {
    id: "image",
    step: BotStep.IMAGE_PROMPT,
    emoji: "🎨",
    name: "Image AI",
    description: "Describe your image.",
  },
  social: {
    id: "social",
    step: BotStep.SOCIAL_MEDIA,
    emoji: "📱",
    name: "Social Media AI",
    description: "Describe your content idea.",
  },
  business: {
    id: "business",
    step: BotStep.BUSINESS,
    emoji: "💼",
    name: "Business AI",
    description: "Describe your business need.",
  },
  coding: {
    id: "coding",
    step: BotStep.CODING,
    emoji: "💻",
    name: "Coding AI",
    description: "Describe what you want to build.",
  },
  translate: {
    id: "translate",
    step: BotStep.TRANSLATE,
    emoji: "🌍",
    name: "Translate AI",
    description: "Send me text to translate.",
  },
  profile: {
    id: "profile",
    step: BotStep.PROFILE,
    emoji: "👤",
    name: "Profile",
    description: "View your profile.",
  },
  settings: {
    id: "settings",
    step: BotStep.SETTINGS,
    emoji: "⚙️",
    name: "Settings",
    description: "Configure your preferences.",
  },
  help: {
    id: "help",
    step: BotStep.HELP,
    emoji: "❓",
    name: "Help Center",
    description: "Learn how to use the bot.",
  },
};

class ModeManager {
  /**
   * Get a mode descriptor by feature ID
   */
  getMode(feature: string): ModeDescriptor | undefined {
    return MODE_REGISTRY[feature];
  }

  /**
   * Get all registered modes
   */
  getAllModes(): ModeDescriptor[] {
    return Object.values(MODE_REGISTRY);
  }

  /**
   * Check if a mode exists
   */
  hasMode(feature: string): boolean {
    return feature in MODE_REGISTRY;
  }

  /**
   * Get the current mode info from session
   */
  getCurrentMode(session: { step: BotStep }): ModeDescriptor | undefined {
    const step = session.step;
    return Object.values(MODE_REGISTRY).find((m) => m.step === step);
  }

  /**
   * Get the localized switched message for a mode
   */
  getModeSwitchedMessage(lang: SupportedLanguage, feature: string): string {
    const mode = MODE_REGISTRY[feature];
    if (!mode) return "";
    return t(lang, "mode.switched_to", {
      mode: `${mode.emoji} ${mode.name}`,
      description: mode.description,
    });
  }

  /**
   * Get the localized active mode message
   */
  getModeActiveMessage(lang: SupportedLanguage, feature: string): string {
    const mode = MODE_REGISTRY[feature];
    if (!mode) return "";
    return t(lang, "mode.active", {
      mode: `${mode.emoji} ${mode.name}`,
      description: mode.description,
    });
  }

  /**
   * Switch to a new mode, clearing previous mode context.
   * Returns the localized confirmation message.
   */
  switchTo(ctx: BotContext, feature: string): string {
    const mode = MODE_REGISTRY[feature];
    if (!mode) return "";

    // Clear previous mode data
    sessionManager.clearMode(ctx.session);

    // Set new mode step
    sessionManager.setStep(ctx.session, mode.step);

    // Return localized confirmation
    return this.getModeSwitchedMessage(ctx.session.language, feature);
  }

  /**
   * Get step for a feature
   */
  getStep(feature: string): BotStep | undefined {
    return MODE_REGISTRY[feature]?.step;
  }
}

export const modeManager = new ModeManager();
