"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition, useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";

interface Props {
  categories: string[];
  years: number[];
  activeType: string;
  activeCategory: string;
  activeYear: string;
  activeMonth: string;
  activeSearch: string;
  activeConfidence: string;
  /** Defaults to "/history" — pass "/demo/history" so filter navigation stays inside the demo, never redirecting to the auth-gated real page. */
  basePath?: string;
}

const MONTH_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"] as const;

export default function HistoryFilters({
  categories, years, activeType, activeCategory, activeYear, activeMonth, activeSearch, activeConfidence,
  basePath = "/history",
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations("history.filters");
  const tc = useTranslations("common");
  const tCategories = useTranslations("categories");
  const [, startTransition] = useTransition();
  const [searchValue, setSearchValue] = useState(activeSearch);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setSearchValue(activeSearch); }, [activeSearch]);

  const update = useCallback((key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value); else params.delete(key);
    params.delete("page");
    startTransition(() => router.push(`${basePath}?${params.toString()}`));
  }, [router, searchParams, basePath]);

  function handleSearchChange(value: string) {
    setSearchValue(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => update("q", value), 400);
  }

  const clearAll = () => {
    setSearchValue("");
    startTransition(() => router.push(basePath));
  };

  const hasFilters = activeType || activeCategory || activeYear || activeMonth || activeSearch || activeConfidence;
  const selectBase = "bg-[#132537] border border-[#243F5E] rounded-xl px-3 py-2.5 text-sm text-[#E8F0F8] focus:outline-none focus:border-[#3AB5A0] capitalize min-h-[44px] w-full";

  const TYPE_FILTERS = [
    { label: t("all"), value: "" },
    { label: t("income"), value: "income" },
    { label: t("expenses"), value: "expense" },
    { label: t("savings"), value: "savings" },
    { label: t("internal"), value: "transfer" },
  ];

  return (
    <div className="space-y-3">
      <div className="relative">
        <input
          type="text"
          placeholder={t("searchPlaceholder")}
          value={searchValue}
          className="input pr-10"
          onChange={(e) => handleSearchChange(e.target.value)}
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6A97B4] text-sm pointer-events-none">⌕</span>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide sm:flex-wrap sm:overflow-visible sm:pb-0">
        {TYPE_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => update("type", f.value)}
            className={`flex-shrink-0 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors min-h-[44px] ${
              activeType === f.value || (!activeType && !f.value)
                ? "bg-[#3AB5A015] text-[#3AB5A0]"
                : "bg-[#1A3048] text-[#7BA8C4] hover:text-[#E8F0F8]"
            }`}
          >
            {f.label}
          </button>
        ))}
        <button
          onClick={() => update("confidence", activeConfidence === "low" ? "" : "low")}
          className={`flex-shrink-0 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors min-h-[44px] ${
            activeConfidence === "low"
              ? "bg-[#D4A25415] text-[#D4A254]"
              : "bg-[#1A3048] text-[#7BA8C4] hover:text-[#E8F0F8]"
          }`}
        >
          {t("needsReview")}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {categories.length > 0 && (
          <select value={activeCategory} onChange={(e) => update("category", e.target.value)} className={selectBase}>
            <option value="">{t("allCategories")}</option>
            {categories.map((c) => <option key={c} value={c} className="normal-case">{tCategories.has(c) ? tCategories(c) : c}</option>)}
          </select>
        )}
        {years.length > 1 && (
          <select value={activeYear} onChange={(e) => update("year", e.target.value)} className={selectBase}>
            <option value="">{t("allYears")}</option>
            {years.map((y) => <option key={y} value={String(y)}>{y}</option>)}
          </select>
        )}
        <select value={activeMonth} onChange={(e) => update("month", e.target.value)} className={selectBase}>
          <option value="">{t("allMonths")}</option>
          {MONTH_KEYS.map((m) => <option key={m} value={m}>{tc(`months.${m}`)}</option>)}
        </select>
      </div>

      {hasFilters && (
        <button onClick={clearAll} className="text-sm text-[#6A97B4] hover:text-[#7BA8C4] transition-colors min-h-[44px] px-2">
          {t("clearAll")}
        </button>
      )}
    </div>
  );
}
