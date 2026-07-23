/**
 * Localization Service
 * Loads locale files and provides a simple t() function
 * for retrieving translated strings based on user's language preference.
 */

import en from "@/locales/en.json";
import uz from "@/locales/uz.json";
import ru from "@/locales/ru.json";

export type SupportedLanguage = "en" | "uz" | "ru";

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = ["en", "uz", "ru"];
export const DEFAULT_LANGUAGE: SupportedLanguage = "en";

export const LANGUAGE_NAMES: Record<SupportedLanguage, string> = {
  en: "English",
  uz: "O'zbekcha",
  ru: "Русский",
};

export const LANGUAGE_FLAGS: Record<SupportedLanguage, string> = {
  en: "🇬🇧",
  uz: "🇺🇿",
  ru: "🇷🇺",
};

type LocaleMap = typeof en;

const locales: Record<SupportedLanguage, LocaleMap> = {
  en: en as LocaleMap,
  uz: uz as LocaleMap,
  ru: ru as LocaleMap,
};

/**
 * Get a translated string by key path (e.g., "welcome.title")
 * Falls back to English if the key or language is not found.
 */
export function t(language: SupportedLanguage, key: string, params?: Record<string, string | number>): string {
  const lang = language in locales ? language : DEFAULT_LANGUAGE;
  const keys = key.split(".");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let value: any = locales[lang];

  for (const k of keys) {
    if (value && typeof value === "object" && k in value) {
      value = value[k];
    } else {
      // Key not found in requested language, fallback to English
      value = locales[DEFAULT_LANGUAGE];
      for (const fk of keys) {
        if (value && typeof value === "object" && fk in value) {
          value = value[fk];
        } else {
          return key;
        }
      }
      break;
    }
  }

  if (typeof value !== "string") {
    return key;
  }

  // Replace placeholders like {name}, {date}, etc.
  if (params) {
    return value.replace(/\{(\w+)\}/g, (_, paramKey) => {
      const val = params[paramKey];
      return val !== undefined ? String(val) : `{${paramKey}}`;
    });
  }

  return value;
}

/**
 * Resolve the user's effective language.
 * Priority: session (user preference) -> DB (user_code) -> Telegram -> default
 */
export function resolveLanguage(
  sessionLang?: SupportedLanguage | null,
  dbLangCode?: string | null
): SupportedLanguage {
  if (sessionLang && SUPPORTED_LANGUAGES.includes(sessionLang)) {
    return sessionLang;
  }
  if (dbLangCode && SUPPORTED_LANGUAGES.includes(dbLangCode as SupportedLanguage)) {
    return dbLangCode as SupportedLanguage;
  }
  return DEFAULT_LANGUAGE;
}
