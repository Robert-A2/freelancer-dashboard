"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { setUserLocale } from "@/lib/locale-actions";
import { LOCALES, LOCALE_LABELS, LOCALE_LABELS_SHORT, type Locale } from "@/i18n/locales";

// "dark" (default) matches every existing dark-navy surface this ships on
// (dashboard Navbar, DemoNavbar, the pre-redesign landing page). "light"
// exists for surfaces on a white/light background (the redesigned marketing
// landing page's navbar) — same behavior, just legible on white.
type Variant = "dark" | "light";

const VARIANT_CLASSES: Record<Variant, { divider: string; active: string; inactive: string }> = {
  dark:  { divider: "text-[#3A5068]", active: "text-[#3AB5A0]", inactive: "text-[#6A97B4] hover:text-[#E8F0F8]" },
  light: { divider: "text-[#CBD5E1]", active: "text-[#4F46E5]", inactive: "text-[#64748B] hover:text-[#0D1B2B]" },
};

export default function LanguageSwitcher({ className = "", variant = "dark" }: { className?: string; variant?: Variant }) {
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations("common.languageSwitcher");
  const [isPending, startTransition] = useTransition();
  const colors = VARIANT_CLASSES[variant];

  function handleChange(next: Locale) {
    if (next === locale || isPending) return;
    startTransition(async () => {
      await setUserLocale(next);
      router.refresh();
    });
  }

  return (
    <div
      className={`flex items-center gap-1 text-sm font-medium ${className}`}
      role="group"
      aria-label={t("label")}
    >
      {LOCALES.map((l, i) => (
        <span key={l} className="flex items-center gap-1">
          {i > 0 && <span className={colors.divider}>|</span>}
          <button
            type="button"
            onClick={() => handleChange(l)}
            disabled={isPending}
            aria-current={locale === l ? "true" : undefined}
            className={`px-1 sm:px-1.5 py-1 rounded transition-colors disabled:opacity-60 ${
              locale === l ? colors.active : colors.inactive
            }`}
          >
            <span className="sm:hidden">{LOCALE_LABELS_SHORT[l]}</span>
            <span className="hidden sm:inline">{LOCALE_LABELS[l]}</span>
          </button>
        </span>
      ))}
    </div>
  );
}
