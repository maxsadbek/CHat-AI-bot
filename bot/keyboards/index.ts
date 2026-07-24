import { InlineKeyboard } from "grammy";
import type { SupportedLanguage } from "@/bot/localization";
import { LANGUAGE_FLAGS } from "@/bot/localization";

// ═══════════════════════════════════════════════════════
// NAVIGATION PATTERN
// ═══════════════════════════════════════════════════════
// Every feature keyboard ends with a consistent nav row:
//   🔙 Back  |  🏠 Home  |  ❌ Cancel
//
// - Back:  Go to the previous screen/menu
// - Home:  Return to the Main Menu (resets session)
// - Cancel: Cancel current operation, show Main Menu
// ═══════════════════════════════════════════════════════

// ─── Reusable Navigation Row ─────────────────────────
const navHome = "🏠 Home";
const navHomeCb = "nav:home";

const navBack = "🔙 Back";
const navBackCb = "nav:back";

const navCancel = "❌ Cancel";
const navCancelCb = "nav:cancel";

/** Reusable navigation row — exported for external handlers */
export function addNavRow(kb: InlineKeyboard): InlineKeyboard {
  return kb.row().text(navBack, navBackCb).text(navHome, navHomeCb).text(navCancel, navCancelCb);
}

// ═══════════════════════════════════════════════════════
// MAIN MENU (Home)
// ═══════════════════════════════════════════════════════
// 2-column grid — all features open from here.
export const mainMenuKeyboard = new InlineKeyboard()
  .text("🤖 AI Chat", "feature:chat")
  .text("🎨 Image AI", "feature:image")
  .row()
  .text("🎬 Video AI", "feature:video")
  .text("💻 Coding", "feature:coding")
  .row()
  .text("📱 Social", "feature:social")
  .text("💼 Business", "feature:business")
  .row()
  .text("🌍 Translate", "feature:translate")
  .text("📁 Projects", "feature:projects")
  .row()
  .text("🕒 History", "feature:history")
  .text("👤 Profile", "feature:profile")
  .row()
  .text("⚙️ Settings", "feature:settings")
  .text("⭐ Premium", "feature:premium");

// ═══════════════════════════════════════════════════════
// AI CHAT
// ═══════════════════════════════════════════════════════
export const chatKeyboard = addNavRow(
  new InlineKeyboard()
    .text("🔄 New Chat", "chat:new")
    .text("📋 History", "chat:history")
    .row()
    .text("🧹 Clear", "chat:clear")
);

// ═══════════════════════════════════════════════════════
// RESULT PAGE (Copy / Regenerate / Home)
// ═══════════════════════════════════════════════════════
export const resultPageKeyboard = addNavRow(
  new InlineKeyboard()
    .text("📋 Copy", "result:copy")
    .text("🔄 Regenerate", "result:regenerate")
);

// ═══════════════════════════════════════════════════════
// VIDEO AI
// ═══════════════════════════════════════════════════════
export const videoKeyboard = addNavRow(
  new InlineKeyboard()
    .text("🎬 Hailuo AI", "video:hailuo")
    .text("🎬 Kling AI", "video:kling")
    .row()
    .text("🎬 Google Veo", "video:veo")
    .text("🎬 Runway", "video:runway")
    .row()
    .text("🎬 PixVerse", "video:pixverse")
    .text("📋 All Platforms", "video:all")
    .row()
    .text("📋 History", "video:history")
);

// ═══════════════════════════════════════════════════════
// IMAGE AI
// ═══════════════════════════════════════════════════════
export const imageKeyboard = addNavRow(
  new InlineKeyboard()
    .text("🖼️ GPT Image", "image:gpt")
    .text("🖼️ Flux", "image:flux")
    .row()
    .text("🖼️ Midjourney", "image:midjourney")
    .text("🖼️ Leonardo", "image:leonardo")
    .row()
    .text("🖼️ Ideogram", "image:ideogram")
    .text("📋 All Platforms", "image:all")
    .row()
    .text("📋 History", "image:history")
);

// ═══════════════════════════════════════════════════════
// SOCIAL MEDIA AI
// ═══════════════════════════════════════════════════════
export const socialKeyboard = addNavRow(
  new InlineKeyboard()
    .text("📸 Instagram", "social:instagram")
    .text("🎵 TikTok", "social:tiktok")
    .row()
    .text("✈️ Telegram", "social:telegram")
    .text("📘 Facebook", "social:facebook")
    .row()
    .text("💼 LinkedIn", "social:linkedin")
    .text("🎥 YouTube", "social:youtube")
    .row()
    .text("📋 All Platforms", "social:all")
);

// ═══════════════════════════════════════════════════════
// BUSINESS AI
// ═══════════════════════════════════════════════════════
export const businessKeyboard = addNavRow(
  new InlineKeyboard()
    .text("💡 Startup Ideas", "business:startup_idea")
    .text("📋 Business Plan", "business:business_plan")
    .row()
    .text("📈 Marketing Strategy", "business:marketing_strategy")
    .text("🏷️ Brand Name", "business:brand_name")
    .row()
    .text("📝 Slogan", "business:slogan")
    .text("🎨 Logo Prompt", "business:logo_prompt")
    .row()
    .text("🎨 Color Palette", "business:color_palette")
    .text("🌐 Landing Page", "business:landing_page_copy")
    .row()
    .text("📋 History", "business:history")
);

// ═══════════════════════════════════════════════════════
// CODING AI
// ═══════════════════════════════════════════════════════
export const codingKeyboard = addNavRow(
  new InlineKeyboard()
    .text("🌐 HTML", "coding:html")
    .text("🎨 CSS", "coding:css")
    .row()
    .text("⚛️ React", "coding:react")
    .text("▲ Next.js", "coding:nextjs")
    .row()
    .text("🎨 Tailwind", "coding:tailwind")
    .text("🟢 Node.js", "coding:nodejs")
    .row()
    .text("🚀 Express", "coding:express")
    .text("📊 Prisma", "coding:prisma")
    .row()
    .text("🗄️ SQL", "coding:sql")
    .text("🔌 API", "coding:api")
    .row()
    .text("📋 History", "coding:history")
);

// ═══════════════════════════════════════════════════════
// PROFILE
// ═══════════════════════════════════════════════════════
// PROFILE
// ═══════════════════════════════════════════════════════
export const profileKeyboard = addNavRow(
  new InlineKeyboard()
    .text("⚙️ Settings", "feature:settings")
    .text("⭐ Upgrade", "feature:premium")
);

export function getProfileKeyboard(isPremium: boolean, isAdmin: boolean): InlineKeyboard {
  const label = (isPremium || isAdmin) ? "⭐ Subscription" : "⭐ Upgrade";
  return addNavRow(
    new InlineKeyboard()
      .text("⚙️ Settings", "feature:settings")
      .text(label, "feature:premium")
  );
}

// ═══════════════════════════════════════════════════════
// SETTINGS
// ═══════════════════════════════════════════════════════
export const settingsKeyboard = addNavRow(
  new InlineKeyboard()
    .text("🌍 Change Language", "settings:language")
    .row()
    .text("🤖 AI Model", "settings:model")
    .row()
    .text("🧹 Clear Conversations", "settings:clear")
    .row()
    .text("📜 Privacy", "settings:privacy")
    .row()
    .text("ℹ️ About", "settings:about")
);

// ═══════════════════════════════════════════════════════
// AI MODEL SELECTION
// ═══════════════════════════════════════════════════════
export const modelProviderKeyboard = addNavRow(
  new InlineKeyboard()
    .text("🤖 OpenAI", "model:provider:openai")
    .text("🌀 Gemini", "model:provider:gemini")
    .row()
    .text("🟣 Claude", "model:provider:claude")
    .text("🔮 DeepSeek", "model:provider:deepseek")
);

export function modelSelectionKeyboard(provider: string): InlineKeyboard {
  const kb = new InlineKeyboard();
  switch (provider) {
    case "openai":
      kb.text("GPT-4o", "model:select:gpt-4o");
      kb.text("GPT-4o Mini", "model:select:gpt-4o-mini");
      kb.row();
      kb.text("O1 Mini", "model:select:o1-mini");
      kb.text("GPT-4 Turbo", "model:select:gpt-4-turbo");
      break;
    case "gemini":
      kb.text("Gemini 2.0 Flash", "model:select:gemini-2.0-flash");
      kb.text("Gemini 2.0 Pro", "model:select:gemini-2.0-pro");
      kb.row();
      kb.text("Gemini 1.5 Flash", "model:select:gemini-1.5-flash");
      kb.text("Gemini 1.5 Pro", "model:select:gemini-1.5-pro");
      break;
    case "claude":
      kb.text("Claude Sonnet 4", "model:select:claude-sonnet-4-20250514");
      kb.text("Claude Haiku 3.5", "model:select:claude-haiku-3-5-20241022");
      break;
    case "deepseek":
      kb.text("DeepSeek Chat", "model:select:deepseek-chat");
      break;
  }
  kb.row();
  kb.text("🔙 Back to Providers", "model:providers");
  return addNavRow(kb);
}

// ═══════════════════════════════════════════════════════
// HELP CENTER
// ═══════════════════════════════════════════════════════
export const helpKeyboard = addNavRow(
  new InlineKeyboard()
    .text("🤖 AI Chat", "help:chat")
    .text("🎨 Image AI", "help:image")
    .row()
    .text("🎬 Video AI", "help:video")
    .text("💻 Coding", "help:coding")
    .row()
    .text("📱 Social", "help:social")
    .text("💼 Business", "help:business")
    .row()
    .text("🌍 Translate", "help:translate")
    .text("💡 Tips", "help:tips")
);

// ═══════════════════════════════════════════════════════
// PREMIUM
// ═══════════════════════════════════════════════════════

// Premium hub keyboard — plan selection for non-premium users
export const premiumKeyboard = addNavRow(
  new InlineKeyboard()
    .text("🚀 Pro Monthly • $2.99", "premium:plan:pro_monthly")
    .text("🌟 Pro Yearly • $24.99", "premium:plan:pro_yearly")
    .row()
    .text("👑 Lifetime • $299.99", "premium:plan:lifetime")
);

// Dynamic premium hub keyboard: payment/purchase buttons visible ONLY to non-premium users
export function getPremiumKeyboard(isPremium: boolean, isAdmin: boolean): InlineKeyboard {
  if (isPremium || isAdmin) {
    return premiumNavKeyboard;
  }
  return premiumKeyboard;
}

// Plan-specific action keyboard (viewed after selecting a plan)
export function planSelectionKeyboard(
  planId: string,
  isPremium = false,
  isAdmin = false
): InlineKeyboard {
  const kb = new InlineKeyboard();
  if (planId !== "free" && !isPremium && !isAdmin) {
    kb.text("🚀 Subscribe Now", `premium:subscribe:${planId}`);
    kb.row();
  }
  kb.text("📋 Compare Plans", "premium:back");
  return addNavRow(kb);
}

// ─── Manual Payment Keyboard ────────────────────────────

/**
 * Keyboard shown on the manual payment page.
 * Minimal, clean layout — only two actions:
 *   "📷 Send Receipt" — proceed to send payment screenshot
 *   "⬅ Back" — return to plan comparison
 *
 * Note: Uses a dedicated callback for Back (premium:back) rather than
 * the generic nav:back, so the user returns to the plan selection screen.
 */
export function manualPaymentKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("📷 Send Receipt", "manual:payment:receipt")
    .row()
    .text("⬅ Back", "premium:back");
}

// Navigation after upgrade / for active subscribers
export const premiumNavKeyboard = addNavRow(
  new InlineKeyboard()
    .text("👤 My Profile", "feature:profile")
    .text("🏠 Main Menu", "nav:home")
);

// ═══════════════════════════════════════════════════════
// LANGUAGE SELECTION
// ═══════════════════════════════════════════════════════
export function languageKeyboard(): InlineKeyboard {
  return addNavRow(
    new InlineKeyboard()
      .text(`${LANGUAGE_FLAGS.uz} O'zbekcha`, "lang:uz")
      .text(`${LANGUAGE_FLAGS.en} English`, "lang:en")
      .row()
      .text(`${LANGUAGE_FLAGS.ru} Русский`, "lang:ru")
  );
}

// ═══════════════════════════════════════════════════════
// SIMPLE NAV KEYBOARDS
// ═══════════════════════════════════════════════════════

// Home + Cancel only (for simple info screens)
export const homeCancelKeyboard = new InlineKeyboard()
  .text(navHome, navHomeCb)
  .text(navCancel, navCancelCb);

// ─── TRANSLATE KEYBOARD
export const translateKeyboard = addNavRow(
  new InlineKeyboard()
    .text("📋 History", "translate:history")
);

// Back to Main Menu (legacy)
export const backToMainKeyboard = new InlineKeyboard().text(
  navHome,
  navHomeCb
);

// ═══════════════════════════════════════════════════════
// CONFIRMATION
// ═══════════════════════════════════════════════════════
export function confirmKeyboard(action: string): InlineKeyboard {
  return addNavRow(
    new InlineKeyboard()
      .text("✅ Yes", `${action}:confirm`)
      .text("❌ No", `${action}:cancel`)
  );
}
