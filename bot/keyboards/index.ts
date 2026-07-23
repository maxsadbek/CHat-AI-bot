import { InlineKeyboard } from "grammy";
import type { SupportedLanguage } from "@/bot/localization";
import { LANGUAGE_FLAGS } from "@/bot/localization";

/**
 * Main menu keyboard shown on /start
 */
export const mainMenuKeyboard = new InlineKeyboard()
  .row()
  .text("🤖 AI Chat", "feature:chat")
  .text("🎬 Video AI", "feature:video")
  .row()
  .text("🎨 Image AI", "feature:image")
  .text("📱 Social Media", "feature:social")
  .row()
  .text("💻 Coding", "feature:coding")
  .text("💼 Business", "feature:business")
  .row()
  .text("🌍 Translate", "feature:translate")
  .text("⚙️ Settings", "feature:settings")
  .row()
  .text("❓ Help", "feature:help");

/**
 * AI Chat action keyboard
 */
export const chatKeyboard = new InlineKeyboard()
  .text("🔄 New Chat", "chat:new")
  .text("📋 History", "chat:history")
  .row()
  .text("🏠 Main Menu", "menu:main");

/**
 * Video AI platform selection keyboard
 */
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

/**
 * Image AI platform selection keyboard
 */
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

/**
 * Social media platform selection keyboard
 */
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

/**
 * Business content type selection keyboard
 */
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

/**
 * Coding language selection keyboard
 */
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

/**
 * Profile action keyboard
 */
export const profileKeyboard = new InlineKeyboard()
  .text("🔄 Reset Usage", "profile:reset")
  .text("⭐ Premium", "profile:premium")
  .row()
  .text("🏠 Main Menu", "menu:main");

/**
 * Back to main menu keyboard
 */
export const backToMainKeyboard = new InlineKeyboard().text(
  "🏠 Main Menu",
  "menu:main"
);

/**
 * Language selection keyboard
 */
export function languageKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text(`${LANGUAGE_FLAGS.uz} O'zbekcha`, "lang:uz")
    .text(`${LANGUAGE_FLAGS.en} English`, "lang:en")
    .row()
    .text(`${LANGUAGE_FLAGS.ru} Русский`, "lang:ru");
}

/**
 * Settings keyboard
 */
export const settingsKeyboard = new InlineKeyboard()
  .text("🌍 Change Language", "settings:language")
  .row()
  .text("🏠 Main Menu", "menu:main");

/**
 * Confirmation keyboard
 */
export function confirmKeyboard(action: string): InlineKeyboard {
  return new InlineKeyboard()
    .text("✅ Yes", `${action}:confirm`)
    .text("❌ No", `${action}:cancel`);
}
