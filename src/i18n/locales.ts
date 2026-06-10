export const LOCALES = ["en", "fr"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  fr: "Français",
};

// Maps an app locale to the BCP-47 tag used for Intl number/date formatting.
export const INTL_LOCALES: Record<Locale, string> = {
  en: "en-IE",
  fr: "fr-FR",
};

export function isLocale(value: string | null | undefined): value is Locale {
  return !!value && (LOCALES as readonly string[]).includes(value);
}
