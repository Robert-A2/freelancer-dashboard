import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getDataCoverage } from "@/lib/analytics-engine";
import { Suspense } from "react";
import HistoryFilters from "@/components/history/HistoryFilters";
import NeedsReviewBanner from "@/components/history/NeedsReviewBanner";
import RecategorizeAllButton from "@/components/history/RecategorizeAllButton";
import TransactionList from "@/components/history/TransactionList";
import DataCoverageBar from "@/components/dashboard/DataCoverage";

export const dynamic = "force-dynamic";


interface SearchParams { page?: string; type?: string; category?: string; year?: string; month?: string; q?: string; confidence?: string; }

export default async function HistoryPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const params   = await searchParams;
  const page     = Math.max(1, parseInt(params.page || "1"));
  const type     = params.type || undefined;
  const category = params.category || undefined;
  const year     = params.year ? parseInt(params.year) : undefined;
  const month    = params.month ? parseInt(params.month) : undefined;
  const search     = params.q?.trim() || undefined;
  const confidence = params.confidence === "low" ? "low" : undefined;
  const limit      = 50;
  const skip       = (page - 1) * limit;

  let dateFilter: { gte?: Date; lt?: Date } | undefined;
  if (year && month)  dateFilter = { gte: new Date(year, month - 1, 1), lt: new Date(year, month, 1) };
  else if (year)      dateFilter = { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) };

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
    const filtered = allTxForMonthFilter.filter((tx) => new Date(tx.transactionDate).getMonth() + 1 === month);
    displayTotal = filtered.length;
    displayTransactions = filtered.slice(skip, skip + limit);
  } else {
    displayTransactions = pagedTransactions;
  }

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
          <h1 className="text-2xl font-bold">History</h1>
          <p className="text-[#7BA8C4] text-sm mt-0.5">
            {displayTotal.toLocaleString()} transaction{displayTotal !== 1 ? "s" : ""}
          </p>
        </div>
        <RecategorizeAllButton />
      </div>

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
          <p className="text-[#6A97B4]">No transactions match these filters.</p>
        </div>
      ) : (
        <TransactionList
          transactions={displayTransactions.map((tx) => ({
            id: tx.id,
            description: tx.description,
            transactionDate: tx.transactionDate.toISOString(),
            category: tx.category,
            categoryConfidence: tx.categoryConfidence,
            transactionType: tx.transactionType,
            amount: Number(tx.amount),
          }))}
        />
      )}

      {pages > 1 && (
        <div className="flex items-center justify-center gap-3">
          {page > 1 && <a href={buildPageUrl(page - 1)} className="btn-secondary px-4 py-2 text-sm">← Previous</a>}
          <span className="text-sm text-[#6A97B4]">Page {page} of {pages}</span>
          {page < pages && <a href={buildPageUrl(page + 1)} className="btn-secondary px-4 py-2 text-sm">Next →</a>}
        </div>
      )}
    </div>
  );
}
