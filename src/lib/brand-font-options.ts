// Plain data only — safe to import from a "use client" picker component.
// The actual font loading (next/font/google) lives in brand-fonts.ts, which
// only ever runs server-side (the Pay page renders the font, this file just
// lists the choices).
export interface BrandFontOption {
  key: string;
  label: string;
}

export const BRAND_FONT_OPTIONS: BrandFontOption[] = [
  { key: "inter", label: "Inter" },
  { key: "spaceGrotesk", label: "Space Grotesk" },
  { key: "dmSans", label: "DM Sans" },
  { key: "lora", label: "Lora" },
  { key: "playfair", label: "Playfair Display" },
  { key: "merriweather", label: "Merriweather" },
];

export const DEFAULT_BRAND_FONT_KEY = "inter";

export function isValidBrandFontKey(key: string): boolean {
  return BRAND_FONT_OPTIONS.some((f) => f.key === key);
}
