"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition, useState, useEffect, useRef } from "react";

interface Props {
  categories: string[];
  years: number[];
  activeType: string;
  activeCategory: string;
  activeYear: string;
  activeMonth: string;
  activeSearch: string;
}

const MONTHS = [
  { value: "1", label: "Jan" }, { value: "2", label: "Feb" }, { value: "3", label: "Mar" },
  { value: "4", label: "Apr" }, { value: "5", label: "May" }, { value: "6", label: "Jun" },
  { value: "7", label: "Jul" }, { value: "8", label: "Aug" }, { value: "9", label: "Sep" },
  { value: "10", label: "Oct" }, { value: "11", label: "Nov" }, { value: "12", label: "Dec" },
];

export default function HistoryFilters({
  categories, years, activeType, activeCategory, activeYear, activeMonth, activeSearch,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [searchValue, setSearchValue] = useState(activeSearch);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setSearchValue(activeSearch); }, [activeSearch]);

  const update = useCallback((key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value); else params.delete(key);
    params.delete("page");
    startTransition(() => router.push(`/history?${params.toString()}`));
  }, [router, searchParams]);

  function handleSearchChange(value: string) {
    setSearchValue(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => update("q", value), 400);
  }

  const clearAll = () => {
    setSearchValue("");
    startTransition(() => router.push("/history"));
  };

  const hasFilters = activeType || activeCategory || activeYear || activeMonth || activeSearch;
  const selectBase = "bg-white border border-[#E8EAE5] rounded-xl px-3 py-2.5 text-sm text-[#1F2937] focus:outline-none focus:border-[#4F7A65] capitalize min-h-[44px] w-full";

  return (
    <div className="space-y-3">
      <div className="relative">
        <input
          type="text"
          placeholder="Search transactions…"
          value={searchValue}
          className="input pr-10"
          onChange={(e) => handleSearchChange(e.target.value)}
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] text-sm pointer-events-none">⌕</span>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide sm:flex-wrap sm:overflow-visible sm:pb-0">
        {[
          { label: "All", value: "" }, { label: "Income", value: "income" },
          { label: "Expenses", value: "expense" }, { label: "Savings", value: "savings" },
          { label: "Internal", value: "transfer" },
        ].map((f) => (
          <button
            key={f.value}
            onClick={() => update("type", f.value)}
            className={`flex-shrink-0 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors min-h-[44px] ${
              activeType === f.value || (!activeType && !f.value)
                ? "bg-[#4F7A6515] text-[#4F7A65]"
                : "bg-[#F3F4F0] text-[#6B7280] hover:text-[#1F2937]"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {categories.length > 0 && (
          <select value={activeCategory} onChange={(e) => update("category", e.target.value)} className={selectBase}>
            <option value="">All categories</option>
            {categories.map((c) => <option key={c} value={c} className="capitalize">{c}</option>)}
          </select>
        )}
        {years.length > 1 && (
          <select value={activeYear} onChange={(e) => update("year", e.target.value)} className={selectBase}>
            <option value="">All years</option>
            {years.map((y) => <option key={y} value={String(y)}>{y}</option>)}
          </select>
        )}
        <select value={activeMonth} onChange={(e) => update("month", e.target.value)} className={selectBase}>
          <option value="">All months</option>
          {MONTHS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </div>

      {hasFilters && (
        <button onClick={clearAll} className="text-sm text-[#9CA3AF] hover:text-[#6B7280] transition-colors min-h-[44px] px-2">
          Clear all filters
        </button>
      )}
    </div>
  );
}
