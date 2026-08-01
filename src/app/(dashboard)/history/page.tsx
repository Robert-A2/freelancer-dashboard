import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getDataCoverage } from "@/lib/analytics-engine";
import { Suspense } from "react";
import { getTranslations, getLocale } from "next-intl/server";
import { INTL_LOCALES, type Locale } from "@/i18n/locales";
import { formatCurrency } from "@/utils/finance";
import HistoryFilters from "@/components/history/HistoryFilters";
import NeedsReviewBanner from "@/components/history/NeedsReviewBanner";
import RecategorizeAllButton from "@/components/history/RecategorizeAllButton";
import TransactionList from "@/components/history/TransactionList";
import DataCoverageBar from "@/components/dashboard/DataCoverage";
import Link from "next/link";

export const dynamic = "force-dynamic";


interface SearchParams { page?: string; type?: string; category?: string; year?: string; month?: string; q?: string; confidence?: string; }

export default async function HistoryPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const params   = await searchParams;
  const locale   = (await getLocale()) as Locale;
  const page     = Math.max(1, parseInt(params.page || "1"));
  const type     = params.type || undefined;
  const category = params.category || undefined;
  const year     = params.year ? parseInt(params.year) : undefined;
  const month    = params.month ? parseInt(params.month) : undefined;
  const search     = params.q?.trim() || undefined;
  const confidence = params.confidence === "low" ? "low" : undefined;
  const limit      = 50;
  const skip       = (page - 1) * limit;

  // Reconciliation mode: arriving via "View transactions →" from a dashboard card.
  // Shows a banner with the total amount so the user can verify it matches the card.
  const isReconciliation = !!(year && month);
  const periodLabel = isReconciliation
    ? new Date(Date.UTC(year!, month! - 1, 1)).toLocaleDateString(INTL_LOCALES[locale], { month: "short", year: "numeric", timeZone: "UTC" })
    : null;

  // For income/expense reconciliation: aggregate the exact same rows that make up
  // the dashboard card total so the user can confirm the numbers match.
  const reconMonthRange = isReconciliation
    ? { gte: new Date(Date.UTC(year!, month! - 1, 1)), lt: new Date(Date.UTC(year!, month!, 1)) }
    : null;

  const reconWhere = (isReconciliation && (type === "income" || type === "expense"))
    ? { userId: user.id, transactionType: type, transactionDate: reconMonthRange! }
    : null;

  // For the Cashflow card specifically (arrives with year+month but no type
  // filter): compute the same income-minus-expenses figure the card showed,
  // so this page confirms the number instead of just restating the formula.
  const reconCashflowWhere = (isReconciliation && !type)
    ? { userId: user.id, transactionDate: reconMonthRange!, transactionType: { in: ["income", "expense"] } }
    : null;

  const [reconAggregate, reconCashflowGroups] = await Promise.all([
    reconWhere
      ? prisma.transaction.aggregate({ where: reconWhere, _sum: { amount: true }, _count: { _all: true } })
      : Promise.resolve(null),
    reconCashflowWhere
      ? prisma.transaction.groupBy({ by: ["transactionType"], where: reconCashflowWhere, _sum: { amount: true } })
      : Promise.resolve(null),
  ]);

  const reconCashflow = reconCashflowGroups
    ? {
        income: Number(reconCashflowGroups.find((g) => g.transactionType === "income")?._sum.amount ?? 0),
        expenses: Number(reconCashflowGroups.find((g) => g.transactionType === "expense")?._sum.amount ?? 0),
      }
    : null;

  let dateFilter: { gte?: Date; lt?: Date } | undefined;
  if (year && month)  dateFilter = { gte: new Date(Date.UTC(year, month - 1, 1)), lt: new Date(Date.UTC(year, month, 1)) };
  else if (year)      dateFilter = { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) };

  const where = {
    userId: user.id,
    ...(type ? { transactionType: type } : {}),
    ...(category ? { category } : {}),
    ...(dateFilter ? { transactionDate: dateFilter } : {}),
    ...(search ? { description: { contains: search, mode: "insensitive" as const } } : {}),
    ...(confidence ? { categoryConfidence: confidence } : {}),
  };

  const useMonthFilter = month && !year;

  const [allTxForMonthFilter, pagedTransactions, total, distinctCategories, distinctYears, coverage, lowConfidenceCount] =
    await Promise.all([
      useMonthFilter
        ? prisma.transaction.findMany({
            where: { userId: user.id, ...(type ? { transactionType: type } : {}), ...(category ? { category } : {}), ...(search ? { description: { contains: search, mode: "insensitive" as const } } : {}), ...(confidence ? { categoryConfidence: confidence } : {}) },
            orderBy: { transactionDate: "desc" },
          })
        : Promise.resolve([] as Awaited<ReturnType<typeof prisma.transaction.findMany>>),
      useMonthFilter
        ? Promise.resolve([] as Awaited<ReturnType<typeof prisma.transaction.findMany>>)
        : prisma.transaction.findMany({ where, orderBy: { transactionDate: "desc" }, skip, take: limit }),
      useMonthFilter ? Promise.resolve(0) : prisma.transaction.count({ where }),
      prisma.transaction.findMany({ where: { userId: user.id }, select: { category: true }, distinct: ["category"], orderBy: { category: "asc" } }),
      prisma.monthlyAnalytics.findMany({ where: { userId: user.id }, select: { year: true }, distinct: ["year"], orderBy: { year: "desc" } }),
      getDataCoverage(user.id),
      prisma.transaction.count({ where: { userId: user.id, categoryConfidence: "low" } }),
    ]);

  let displayTotal = total;
  let displayTransactions: typeof pagedTransactions;

  if (useMonthFilter) {
    const filtered = allTxForMonthFilter.filter((tx) => new Date(tx.transactionDate).getUTCMonth() + 1 === month);
    displayTotal = filtered.length;
    displayTransactions = filtered.slice(skip, skip + limit);
  } else {
    displayTransactions = pagedTransactions;
  }

  const t = await getTranslations("history");
  const pages = Math.ceil(displayTotal / limit);
  const categories = distinctCategories.map((c) => c.category).filter(Boolean).sort() as string[];
  const years = distinctYears.map((r) => r.year);

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
    return `/history${qs ? `?${qs}` : ""}`;
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
        <RecategorizeAllButton />
      </div>

      {/* Reconciliation banner — shown when arriving from a dashboard card via "View transactions →" */}
      {isReconciliation && periodLabel && (
        <div className="flex flex-col gap-3 px-5 py-4 bg-[#3AB5A00A] border border-[#3AB5A028] rounded-2xl">
          <Link href="/dashboard" className="text-xs font-semibold text-[#3AB5A0] hover:text-[#4CC4A4] transition-colors w-fit">
            {t("reconciliation.backToDashboard")}
          </Link>
          {reconAggregate ? (
            <p className="text-sm text-[#C8DCF0] leading-relaxed">
              {type === "income"
                ? t("reconciliation.incomeTotal", {
                    period: periodLabel,
                    amount: formatCurrency(Number(reconAggregate._sum.amount ?? 0), locale),
                    count: reconAggregate._count._all,
                  })
                : t("reconciliation.expenseTotal", {
                    period: periodLabel,
                    amount: formatCurrency(Number(reconAggregate._sum.amount ?? 0), locale),
                    count: reconAggregate._count._all,
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

      <NeedsReviewBanner count={lowConfidenceCount} />

      <Suspense>
        <HistoryFilters
          categories={categories} years={years}
          activeType={type ?? ""} activeCategory={category ?? ""}
          activeYear={params.year ?? ""} activeMonth={params.month ?? ""}
          activeSearch={search ?? ""} activeConfidence={confidence ?? ""}
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
            categoryConfidence: tx.categoryConfidence,
            categoryReason: tx.categoryReason,
            transactionType: tx.transactionType,
            amount: Number(tx.amount),
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
