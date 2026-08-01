import { getTranslations, getLocale } from "next-intl/server";
import { INTL_LOCALES, type Locale } from "@/i18n/locales";
import { getDemoDataset } from "@/lib/demo";
import { DEMO_TRANSACTIONS } from "@/lib/demo/transactions";
import { Suspense } from "react";
import { formatCurrency } from "@/utils/finance";
import HistoryFilters from "@/components/history/HistoryFilters";
import NeedsReviewBanner from "@/components/history/NeedsReviewBanner";
import TransactionList from "@/components/history/TransactionList";
import DataCoverageBar from "@/components/dashboard/DataCoverage";
import Link from "next/link";

export const dynamic = "force-dynamic";

interface SearchParams { page?: string; type?: string; category?: string; year?: string; month?: string; q?: string; confidence?: string; }

// Kept in lockstep with (dashboard)/history/page.tsx — same components, same
// reconciliation-banner/filters/pagination behavior. Data comes from
// DEMO_TRANSACTIONS instead of Prisma, and there's no RecategorizeAllButton
// (a bulk write action with nothing real to write to) — everything else,
// including the per-row recategorize dropdown, is the same component.
export default async function DemoHistoryPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("history");

  const { coverage } = getDemoDataset(locale);

  const page = Math.max(1, parseInt(params.page || "1"));
  const type = params.type || undefined;
  const category = params.category || undefined;
  const year = params.year ? parseInt(params.year) : undefined;
  const month = params.month ? parseInt(params.month) : undefined;
  const search = params.q?.trim().toLowerCase() || undefined;
  const confidence = params.confidence === "low" ? "low" : undefined;
  const limit = 50;

  // Reconciliation mode: arriving via "View transactions →" from a dashboard
  // card — same logic as the real page, computed over DEMO_TRANSACTIONS.
  const isReconciliation = !!(year && month);
  const periodLabel = isReconciliation
    ? new Date(Date.UTC(year!, month! - 1, 1)).toLocaleDateString(INTL_LOCALES[locale], { month: "short", year: "numeric", timeZone: "UTC" })
    : null;
  const reconMonthTxs = isReconciliation
    ? DEMO_TRANSACTIONS.filter((tx) =>
        tx.transactionDate.getUTCFullYear() === year && tx.transactionDate.getUTCMonth() + 1 === month
      )
    : [];
  const reconAggregate = isReconciliation && (type === "income" || type === "expense")
    ? reconMonthTxs.filter((tx) => tx.transactionType === type)
    : null;
  const reconCashflow = isReconciliation && !type
    ? {
        income: reconMonthTxs.filter((tx) => tx.transactionType === "income").reduce((s, tx) => s + tx.amount, 0),
        expenses: reconMonthTxs.filter((tx) => tx.transactionType === "expense").reduce((s, tx) => s + tx.amount, 0),
      }
    : null;

  let filtered = [...DEMO_TRANSACTIONS].sort((a, b) => b.transactionDate.getTime() - a.transactionDate.getTime());
  if (type) filtered = filtered.filter((tx) => tx.transactionType === type);
  if (category) filtered = filtered.filter((tx) => tx.category === category);
  if (year && month) filtered = filtered.filter((tx) => tx.transactionDate.getUTCFullYear() === year && tx.transactionDate.getUTCMonth() + 1 === month);
  else if (year) filtered = filtered.filter((tx) => tx.transactionDate.getUTCFullYear() === year);
  if (search) filtered = filtered.filter((tx) => tx.description.toLowerCase().includes(search));
  // categoryConfidence doesn't exist on demo transactions (every one is a
  // confidently-recognized real-world merchant) — "needs review" is always empty.
  if (confidence === "low") filtered = [];

  const displayTotal = filtered.length;
  const pages = Math.ceil(displayTotal / limit);
  const displayTransactions = filtered.slice((page - 1) * limit, page * limit);

  const categories = [...new Set(DEMO_TRANSACTIONS.map((tx) => tx.category))].filter(Boolean).sort();
  const years = [...new Set(DEMO_TRANSACTIONS.map((tx) => tx.transactionDate.getUTCFullYear()))].sort((a, b) => b - a);

  const buildPageUrl = (p: number) => {
    const sp = new URLSearchParams();
    if (p > 1) sp.set("page", String(p));
    if (type) sp.set("type", type);
    if (category) sp.set("category", category);
    if (params.year) sp.set("year", params.year);
    if (params.month) sp.set("month", params.month);
    if (search) sp.set("q", search);
    if (confidence) sp.set("confidence", confidence);
    const qs = sp.toString();
    return `/demo/history${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="space-y-8 md:space-y-10">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t("heading")}</h1>
          <p className="text-[#7BA8C4] text-sm mt-0.5">
            {t("transactionCount", { count: displayTotal })}
          </p>
        </div>
      </div>

      {isReconciliation && periodLabel && (
        <div className="flex flex-col gap-3 px-5 py-4 bg-[#3AB5A00A] border border-[#3AB5A028] rounded-2xl">
          <Link href="/demo" className="text-xs font-semibold text-[#3AB5A0] hover:text-[#4CC4A4] transition-colors w-fit">
            {t("reconciliation.backToDashboard")}
          </Link>
          {reconAggregate ? (
            <p className="text-sm text-[#C8DCF0] leading-relaxed">
              {type === "income"
                ? t("reconciliation.incomeTotal", {
                    period: periodLabel,
                    amount: formatCurrency(reconAggregate.reduce((s, tx) => s + tx.amount, 0), locale),
                    count: reconAggregate.length,
                  })
                : t("reconciliation.expenseTotal", {
                    period: periodLabel,
                    amount: formatCurrency(reconAggregate.reduce((s, tx) => s + tx.amount, 0), locale),
                    count: reconAggregate.length,
                  })}
            </p>
          ) : reconCashflow ? (
            <p className="text-sm text-[#C8DCF0] leading-relaxed">
              {t("reconciliation.cashflowTotal", {
                period: periodLabel,
                amount: formatCurrency(reconCashflow.income - reconCashflow.expenses, locale),
                income: formatCurrency(reconCashflow.income, locale),
                expenses: formatCurrency(reconCashflow.expenses, locale),
                count: displayTotal,
              })}
            </p>
          ) : (
            <p className="text-sm text-[#C8DCF0] leading-relaxed">
              {t("reconciliation.allTotal", { period: periodLabel, count: displayTotal })}
            </p>
          )}
        </div>
      )}

      {coverage.count > 0 && <DataCoverageBar coverage={coverage} />}

      <NeedsReviewBanner count={0} />

      <Suspense>
        <HistoryFilters
          categories={categories} years={years}
          activeType={type ?? ""} activeCategory={category ?? ""}
          activeYear={params.year ?? ""} activeMonth={params.month ?? ""}
          activeSearch={search ?? ""} activeConfidence={confidence ?? ""}
          basePath="/demo/history"
        />
      </Suspense>

      {displayTransactions.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-[#6A97B4]">{t("noResults")}</p>
        </div>
      ) : (
        <TransactionList
          transactions={displayTransactions.map((tx) => ({
            id: tx.id,
            description: tx.description,
            transactionDate: tx.transactionDate.toISOString(),
            category: tx.category,
            categoryConfidence: "high",
            categoryReason: null,
            transactionType: tx.transactionType,
            amount: tx.amount,
          }))}
        />
      )}

      {pages > 1 && (
        <div className="flex items-center justify-center gap-3">
          {page > 1 && <a href={buildPageUrl(page - 1)} className="btn-secondary px-4 py-2 text-sm">{t("pagination.previous")}</a>}
          <span className="text-sm text-[#6A97B4]">{t("pagination.pageOf", { page, pages })}</span>
          {page < pages && <a href={buildPageUrl(page + 1)} className="btn-secondary px-4 py-2 text-sm">{t("pagination.next")}</a>}
        </div>
      )}
    </div>
  );
}
