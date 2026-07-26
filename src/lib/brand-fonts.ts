// Server-only — next/font/google must be called at module scope so Next can
// self-host and optimize each face at build time. A font's actual file is
// only ever fetched by the browser when its className is applied to
// something on the page, so loading all six here doesn't cost anything on a
// Pay page that only uses one of them. See brand-font-options.ts for the
// plain-data version safe to hand to a client-side picker.
import { Inter, Space_Grotesk, DM_Sans, Lora, Playfair_Display, Merriweather } from "next/font/google";
import { DEFAULT_BRAND_FONT_KEY } from "./brand-font-options";

const inter = Inter({ subsets: ["latin"], weight: ["400", "600", "700"], display: "swap" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], weight: ["400", "600", "700"], display: "swap" });
const dmSans = DM_Sans({ subsets: ["latin"], weight: ["400", "600", "700"], display: "swap" });
const lora = Lora({ subsets: ["latin"], weight: ["400", "600", "700"], display: "swap" });
const playfair = Playfair_Display({ subsets: ["latin"], weight: ["400", "600", "700"], display: "swap" });
const merriweather = Merriweather({ subsets: ["latin"], weight: ["400", "700"], display: "swap" });

const BRAND_FONTS: Record<string, { className: string }> = {
  inter, spaceGrotesk, dmSans, lora, playfair, merriweather,
};

export function getBrandFontClassName(key: string | null | undefined): string {
  return (key && BRAND_FONTS[key]?.className) || BRAND_FONTS[DEFAULT_BRAND_FONT_KEY].className;
}
