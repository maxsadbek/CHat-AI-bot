import { InlineKeyboard } from "grammy";
import type { SupportedLanguage } from "@/bot/localization";
import { LANGUAGE_FLAGS } from "@/bot/localization";

// ─── Main Menu ────────────────────────────────────────
// 2-column grid layout as specified:
// Row 1: 🤖 AI Chat      🎨 Image AI
// Row 2: 🎬 Video AI     💻 Coding
// Row 3: 📱 Social       💼 Business
// Row 4: 🌍 Translate    👤 Profile
// Row 5: ⚙️ Settings     ⭐ Premium
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
  .text("👤 Profile", "feature:profile")
  .row()
  .text("⚙️ Settings", "feature:settings")
  .text("⭐ Premium", "feature:premium");

// ─── Mode Switch Confirmation ─────────────────────────
// Shown when switching to a new mode
export function modeSwitchKeyboard(feature: string): InlineKeyboard {
  return new InlineKeyboard()
    .text("🏠 Main Menu", "menu:main")
    .text("❓ Help", `help:${feature}`);
}

// ─── AI Chat Keyboards ────────────────────────────────
export const chatKeyboard = new InlineKeyboard()
  .text("🔄 New Chat", "chat:new")
  .text("📋 History", "chat:history")
  .row()
  .text("🧹 Clear", "chat:clear")
  .text("🏠 Main Menu", "menu:main");

// ─── Feature Action Keyboards ─────────────────────────
// Generic result page keyboard with Copy, Regenerate, Home
export const resultPageKeyboard = new InlineKeyboard()
  .text("📋 Copy", "result:copy")
  .text("🔄 Regenerate", "result:regenerate")
  .row()
  .text("🏠 Main Menu", "menu:main");

// Video AI platform selection keyboard
export const videoKeyboard = new InlineKeyboard()
  .text("🎬 Hailuo AI", "video:hailuo")
  .text("🎬 Kling AI", "video:kling")
  .row()
  .text("🎬 Google Veo", "video:veo")
  .text("🎬 Runway", "video:runway")
  .row()
  .text("🎬 PixVerse", "video:pixverse")
  .text("📋 All Platforms", "video:all")
  .row()
  .text("🏠 Main Menu", "menu:main");

// Image AI platform selection keyboard
export const imageKeyboard = new InlineKeyboard()
  .text("🖼️ GPT Image", "image:gpt")
  .text("🖼️ Flux", "image:flux")
  .row()
  .text("🖼️ Midjourney", "image:midjourney")
  .text("🖼️ Leonardo", "image:leonardo")
  .row()
  .text("🖼️ Ideogram", "image:ideogram")
  .text("📋 All Platforms", "image:all")
  .row()
  .text("🏠 Main Menu", "menu:main");

// Social media platform selection keyboard
export const socialKeyboard = new InlineKeyboard()
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
  .row()
  .text("🏠 Main Menu", "menu:main");

// Business content type selection keyboard
export const businessKeyboard = new InlineKeyboard()
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
  .text("🏠 Main Menu", "menu:main");

// Coding language selection keyboard
export const codingKeyboard = new InlineKeyboard()
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
  .text("🏠 Main Menu", "menu:main");

// ─── Profile Page Keyboard ──────────────────────────
export const profileKeyboard = new InlineKeyboard()
  .text("⚙️ Settings", "feature:settings")
  .text("⭐ Upgrade", "feature:premium")
  .row()
  .text("🏠 Main Menu", "menu:main");

// ─── Settings Keyboard ──────────────────────────────
export const settingsKeyboard = new InlineKeyboard()
  .text("🌍 Change Language", "settings:language")
  .row()
  .text("🤖 AI Model", "settings:model")
  .row()
  .text("🧹 Clear Conversations", "settings:clear")
  .row()
  .text("📜 Privacy", "settings:privacy")
  .row()
  .text("ℹ️ About", "settings:about")
  .row()
  .text("🏠 Main Menu", "menu:main");

// ─── Model Selection Keyboards ─────────────────────
// Provider selection keyboard
export const modelProviderKeyboard = new InlineKeyboard()
  .text("🤖 OpenAI", "model:provider:openai")
  .text("🌀 Gemini", "model:provider:gemini")
  .row()
  .text("🟣 Claude", "model:provider:claude")
  .row()
  .text("🏠 Main Menu", "menu:main");

// Dynamic model selection keyboard — call with provider ID
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
  }
  kb.row();
  kb.text("🔙 Back to Providers", "model:providers");
  kb.text("🏠 Main Menu", "menu:main");
  return kb;
}

// ─── Help Center Keyboard ───────────────────────────
export const helpKeyboard = new InlineKeyboard()
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
  .row()
  .text("🏠 Main Menu", "menu:main");

// ─── Premium Keyboard ───────────────────────────────
export const premiumKeyboard = new InlineKeyboard()
  .text("⬆️ Upgrade", "premium:upgrade")
  .row()
  .text("🏠 Main Menu", "menu:main");

// ─── Language Selection Keyboard ────────────────────
export function languageKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text(`${LANGUAGE_FLAGS.uz} O'zbekcha`, "lang:uz")
    .text(`${LANGUAGE_FLAGS.en} English`, "lang:en")
    .row()
    .text(`${LANGUAGE_FLAGS.ru} Русский`, "lang:ru");
}

// ─── Back to Main Menu Keyboard ─────────────────────
export const backToMainKeyboard = new InlineKeyboard().text(
  "🏠 Main Menu",
  "menu:main"
);

// ─── Confirmation Keyboard ──────────────────────────
export function confirmKeyboard(action: string): InlineKeyboard {
  return new InlineKeyboard()
    .text("✅ Yes", `${action}:confirm`)
    .text("❌ No", `${action}:cancel`);
}
