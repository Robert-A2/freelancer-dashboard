"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { setUserLocale } from "@/lib/locale-actions";
import { LOCALES, LOCALE_LABELS, LOCALE_LABELS_SHORT, type Locale } from "@/i18n/locales";

export default function LanguageSwitcher({ className = "" }: { className?: string }) {
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations("common.languageSwitcher");
  const [isPending, startTransition] = useTransition();

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
          {i > 0 && <span className="text-[#3A5068]">|</span>}
          <button
            type="button"
            onClick={() => handleChange(l)}
            disabled={isPending}
            aria-current={locale === l ? "true" : undefined}
            className={`px-1 sm:px-1.5 py-1 rounded transition-colors disabled:opacity-60 ${
              locale === l
                ? "text-[#3AB5A0]"
                : "text-[#6A97B4] hover:text-[#E8F0F8]"
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
