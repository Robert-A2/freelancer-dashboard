import { getTranslations, getLocale } from "next-intl/server";
import { INTL_LOCALES, type Locale } from "@/i18n/locales";
import { getDemoDataset } from "@/lib/demo";
import { DEMO_TRANSACTIONS } from "@/lib/demo/transactions";
import DataCoverageBar from "@/components/dashboard/DataCoverage";

export const dynamic = "force-dynamic";

export default async function DemoHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; type?: string; category?: string; year?: string; month?: string; q?: string }>;
}) {
  const t      = await getTranslations("history");
  const locale = (await getLocale()) as Locale;
  const params = await searchParams;

  const { coverage } = getDemoDataset(locale);

  const page     = Math.max(1, parseInt(params.page || "1"));
  const typeF    = params.type || undefined;
  const catF     = params.category || undefined;
  const yearF    = params.year ? parseInt(params.year) : undefined;
  const monthF   = params.month ? parseInt(params.month) : undefined;
  const search   = params.q?.trim().toLowerCase() || undefined;
  const limit    = 50;

  let filtered = [...DEMO_TRANSACTIONS].sort((a, b) => b.transactionDate.getTime() - a.transactionDate.getTime());

  if (typeF)   filtered = filtered.filter(tx => tx.transactionType === typeF);
  if (catF)    filtered = filtered.filter(tx => tx.category === catF);
  if (yearF)   filtered = filtered.filter(tx => tx.transactionDate.getUTCFullYear() === yearF);
  if (monthF)  filtered = filtered.filter(tx => tx.transactionDate.getUTCMonth() + 1 === monthF);
  if (search)  filtered = filtered.filter(tx => tx.description.toLowerCase().includes(search));

  const total = filtered.length;
  const pages = Math.ceil(total / limit);
  const txs   = filtered.slice((page - 1) * limit, page * limit);

  const distinctCategories = [...new Set(DEMO_TRANSACTIONS.map(tx => tx.category))].filter(Boolean).sort();
  const distinctYears      = [...new Set(DEMO_TRANSACTIONS.map(tx => tx.transactionDate.getUTCFullYear()))].sort((a, b) => b - a);

  const buildUrl = (p: number) => {
    const sp = new URLSearchParams();
    if (p > 1) sp.set("page", String(p));
    if (typeF) sp.set("type", typeF);
    if (catF)  sp.set("category", catF);
    if (params.year)  sp.set("year",  params.year);
    if (params.month) sp.set("month", params.month);
    if (params.q)     sp.set("q",     params.q);
    const qs = sp.toString();
    return `/demo/history${qs ? `?${qs}` : ""}`;
  };

  const TYPE_COLORS: Record<string, string> = {
    income:   "text-[#4CC4A4]",
    expense:  "text-[#D4A254]",
    savings:  "text-[#7BA8C4]",
    transfer: "text-[#6A97B4]",
  };

  return (
    <div className="space-y-8 md:space-y-10">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t("heading")}</h1>
          <p className="text-[#7BA8C4] text-sm mt-0.5">{t("subheading")}</p>
        </div>
      </div>

      {coverage.count > 0 && <DataCoverageBar coverage={coverage} />}

      {/* Filters */}
      <form method="GET" action="/demo/history" className="flex flex-wrap gap-3">
        <input
          type="text"
          name="q"
          defaultValue={params.q || ""}
          placeholder={t("filters.search")}
          className="bg-[#1A3048] border border-[#243F5E] rounded-lg px-3 py-2 text-sm text-[#E8F0F8] placeholder:text-[#4A7A9B] focus:outline-none focus:border-[#3AB5A0] min-w-[180px] flex-1"
        />
        <select
          name="type"
          defaultValue={typeF || ""}
          className="bg-[#1A3048] border border-[#243F5E] rounded-lg px-3 py-2 text-sm text-[#E8F0F8] focus:outline-none focus:border-[#3AB5A0]"
        >
          <option value="">{t("filters.allTypes")}</option>
          <option value="income">{t("filters.income")}</option>
          <option value="expense">{t("filters.expense")}</option>
          <option value="savings">{t("filters.savings")}</option>
        </select>
        <select
          name="category"
          defaultValue={catF || ""}
          className="bg-[#1A3048] border border-[#243F5E] rounded-lg px-3 py-2 text-sm text-[#E8F0F8] focus:outline-none focus:border-[#3AB5A0]"
        >
          <option value="">{t("filters.allCategories")}</option>
          {distinctCategories.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select
          name="year"
          defaultValue={params.year || ""}
          className="bg-[#1A3048] border border-[#243F5E] rounded-lg px-3 py-2 text-sm text-[#E8F0F8] focus:outline-none focus:border-[#3AB5A0]"
        >
          <option value="">{t("filters.allYears")}</option>
          {distinctYears.map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <button
          type="submit"
          className="bg-[#3AB5A0] hover:bg-[#4CC4A4] text-[#0D1B2B] font-semibold text-sm px-4 py-2 rounded-lg transition-colors"
        >
          {t("filters.apply")}
        </button>
        {(typeF || catF || yearF || monthF || search) && (
          <a href="/demo/history" className="text-sm text-[#6A97B4] hover:text-[#7BA8C4] transition-colors flex items-center">
            {t("filters.clear")}
          </a>
        )}
      </form>

      {/* Results count */}
      <p className="text-xs text-[#6A97B4]">
        {t("showing", { count: total })}
      </p>

      {/* Transaction list */}
      <div className="card overflow-hidden">
        {txs.length === 0 ? (
          <p className="text-[#6A97B4] text-center py-8">{t("noResults")}</p>
        ) : (
          <div className="divide-y divide-[#1A3048]">
            {txs.map(tx => {
              const dateStr = tx.transactionDate.toLocaleDateString(INTL_LOCALES[locale], {
                day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
              });
              const isIncome = tx.transactionType === "income";
              return (
                <div key={tx.id} className="flex items-center gap-3 py-3 px-1">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[#E8F0F8] font-medium truncate">{tx.description}</p>
                    <p className="text-xs text-[#6A97B4] mt-0.5 flex items-center gap-2">
                      <span>{dateStr}</span>
                      {tx.category && (
                        <>
                          <span className="text-[#243F5E]">·</span>
                          <span className="capitalize">{tx.category}</span>
                        </>
                      )}
                    </p>
                  </div>
                  <span className={`text-sm font-semibold tabular-nums flex-shrink-0 ${TYPE_COLORS[tx.transactionType] ?? "text-[#E8F0F8]"}`}>
                    {isIncome ? "+" : "−"}{tx.amount.toLocaleString(INTL_LOCALES[locale], { style: "currency", currency: "EUR" })}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-2 flex-wrap">
          {page > 1 && (
            <a href={buildUrl(page - 1)} className="px-3 py-1.5 text-sm text-[#7BA8C4] hover:text-[#E8F0F8] bg-[#1A3048] rounded-lg transition-colors">
              {t("pagination.prev")}
            </a>
          )}
          {Array.from({ length: Math.min(pages, 7) }, (_, i) => {
            const p = i + 1;
            return (
              <a
                key={p}
                href={buildUrl(p)}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  p === page ? "bg-[#3AB5A0] text-[#0D1B2B] font-semibold" : "text-[#7BA8C4] hover:text-[#E8F0F8] bg-[#1A3048]"
                }`}
              >
                {p}
              </a>
            );
          })}
          {page < pages && (
            <a href={buildUrl(page + 1)} className="px-3 py-1.5 text-sm text-[#7BA8C4] hover:text-[#E8F0F8] bg-[#1A3048] rounded-lg transition-colors">
              {t("pagination.next")}
            </a>
          )}
        </div>
      )}
    </div>
  );
}
