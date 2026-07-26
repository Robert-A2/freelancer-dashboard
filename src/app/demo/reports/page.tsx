import { getLocale, getTranslations } from "next-intl/server";
import { type Locale } from "@/i18n/locales";
import { getDemoDataset } from "@/lib/demo";
import { DEMO_TRANSACTIONS } from "@/lib/demo/transactions";
import { formatCurrency } from "@/utils/finance";
import Link from "next/link";

export const dynamic = "force-dynamic";

function pct(part: number, total: number) {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

function yoy(curr: number, prev: number) {
  if (prev === 0) return curr > 0 ? 100 : 0;
  return Math.round(((curr - prev) / Math.abs(prev)) * 100);
}

function YoyChip({ value }: { value: number }) {
  if (value === 0) return <span className="text-[10px] text-[#6A97B4]">—</span>;
  const good = value > 0;
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${good ? "bg-[#4CC4A415] text-[#4CC4A4]" : "bg-[#D9707015] text-[#D97070]"}`}>
      {value > 0 ? "↑" : "↓"}{Math.abs(value)}%
    </span>
  );
}

const YEARS = [2023, 2024, 2025] as const;

export default async function DemoReportsPage() {
  const locale = (await getLocale()) as Locale;
  const t    = await getTranslations("reports");
  const tCat = await getTranslations("categories");
  const cat  = (slug: string) => tCat.has(slug) ? tCat(slug as Parameters<typeof tCat>[0]) : slug.replace(/_/g, " ");
  const { chartData, clientData } = getDemoDataset(locale);

  // ── Annual income / expenses / cashflow ──────────────────────────────────────
  const annual = YEARS.map(year => {
    const months   = chartData.filter(d => d.year === year);
    const income   = months.reduce((s, m) => s + m.income,   0);
    const expenses = months.reduce((s, m) => s + m.expenses, 0);
    const cashflow = income - expenses;
    const savings  = months.reduce((s, m) => s + m.savings,  0);
    const margin   = income > 0 ? Math.round((cashflow / income) * 100) : 0;
    return { year, income, expenses, cashflow, savings, margin };
  });

  // ── Tax payments by year ─────────────────────────────────────────────────────
  const taxByYear = YEARS.reduce<Record<number, number>>((acc, y) => {
    acc[y] = DEMO_TRANSACTIONS
      .filter(t => t.intent === "tax_payment" && t.transactionDate.getUTCFullYear() === y)
      .reduce((s, t) => s + t.amount, 0);
    return acc;
  }, {});

  // ── Income by source category ────────────────────────────────────────────────
  const sourcesByYear = YEARS.map(year => {
    const txs = DEMO_TRANSACTIONS.filter(
      t => t.transactionType === "income" && t.transactionDate.getUTCFullYear() === year
    );
    const byCategory: Record<string, number> = {};
    for (const t of txs) {
      const cat = t.category ?? "other";
      byCategory[cat] = (byCategory[cat] ?? 0) + t.amount;
    }
    const total = txs.reduce((s, t) => s + t.amount, 0);
    return {
      year,
      sources: Object.entries(byCategory)
        .sort((a, b) => b[1] - a[1])
        .map(([category, amount]) => ({ category, amount, pct: pct(amount, total) })),
    };
  });

  // ── Top expense categories by year ───────────────────────────────────────────
  const expensesByYear = YEARS.map(year => {
    const txs = DEMO_TRANSACTIONS.filter(
      t => t.transactionType === "expense" && t.transactionDate.getUTCFullYear() === year
    );
    const byCategory: Record<string, number> = {};
    for (const t of txs) {
      const cat = t.category ?? "other";
      byCategory[cat] = (byCategory[cat] ?? 0) + t.amount;
    }
    const total = txs.reduce((s, t) => s + t.amount, 0);
    return {
      year,
      expenses: Object.entries(byCategory)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([category, amount]) => ({ category, amount, pct: pct(amount, total) })),
    };
  });

  // ── Client revenue by year ────────────────────────────────────────────────────
  const clientsByYear = YEARS.map(year => {
    return clientData.clients.map(c => ({
      name:   c.name,
      amount: c.payments
        .filter(p => new Date(p.date).getUTCFullYear() === year)
        .reduce((s, p) => s + p.amount, 0),
    })).filter(c => c.amount > 0).sort((a, b) => b.amount - a.amount);
  });

  const totalRevenue = clientData.totalRevenue;

  return (
    <div className="space-y-10">

      {/* Header */}
      <div>
        <p className="label mb-1">{t("heading")}</p>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-[#7BA8C4] text-sm mt-0.5">{t("subtitle")}</p>
      </div>

      {/* ── Year-over-year comparison table ─────────────────────────────────── */}
      <section className="card overflow-x-auto">
        <p className="label mb-1">{t("overview.label")}</p>
        <h2 className="text-lg font-semibold mb-4">{t("overview.title")}</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[#6A97B4] border-b border-[#1E3550]">
              <th className="pb-3 font-medium w-32">{t("overview.metric")}</th>
              {YEARS.map(y => (
                <th key={y} className="pb-3 font-medium text-right">{y}</th>
              ))}
              <th className="pb-3 font-medium text-right text-[#4A7A9B]">{t("overview.vsPriorYear")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1A3048]">
            {[
              { label: t("rows.income"),   key: "income"   as const, color: "text-[#4CC4A4]" },
              { label: t("rows.expenses"), key: "expenses" as const, color: "text-[#D4A254]" },
              { label: t("rows.net"),      key: "cashflow" as const, color: "text-[#E8F0F8]" },
              { label: t("rows.saved"),    key: "savings"  as const, color: "text-[#7BA8C4]" },
            ].map(row => (
              <tr key={row.key}>
                <td className="py-3 text-[#7BA8C4]">{row.label}</td>
                {YEARS.map(y => {
                  const a = annual.find(a => a.year === y)!;
                  return (
                    <td key={y} className={`py-3 text-right font-medium tabular-nums ${row.color}`}>
                      {formatCurrency(a[row.key], locale)}
                    </td>
                  );
                })}
                <td className="py-3 text-right">
                  <YoyChip value={yoy(annual[2][row.key], annual[1][row.key])} />
                </td>
              </tr>
            ))}
            <tr className="border-t border-[#243F5E]">
              <td className="pt-4 text-[#7BA8C4] text-xs">{t("rows.margin")}</td>
              {YEARS.map(y => {
                const a = annual.find(a => a.year === y)!;
                return (
                  <td key={y} className="pt-4 text-right text-xs tabular-nums text-[#A8C6E0]">
                    {a.margin}%
                  </td>
                );
              })}
              <td className="pt-4 text-right">
                <YoyChip value={annual[2].margin - annual[1].margin} />
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* ── Tax summary ─────────────────────────────────────────────────────── */}
      <section className="card">
        <p className="label mb-1">{t("taxes.label")}</p>
        <h2 className="text-lg font-semibold mb-4">{t("taxes.title")}</h2>
        <div className="grid grid-cols-3 gap-3">
          {YEARS.map(y => {
            const tax    = taxByYear[y] ?? 0;
            const inc    = annual.find(a => a.year === y)?.income ?? 0;
            const effRate = inc > 0 ? Math.round((tax / inc) * 100) : 0;
            return (
              <div key={y} className="bg-[#1A3048] rounded-xl p-4">
                <p className="label mb-1">{y}</p>
                <p className="text-lg font-bold text-[#D4A254] tabular-nums">
                  {formatCurrency(tax, locale)}
                </p>
                <p className="text-xs text-[#6A97B4] mt-1">{effRate}{t("taxes.ofIncome")}</p>
              </div>
            );
          })}
        </div>
        <p className="text-[11px] text-[#475569] mt-4 leading-relaxed">
          {t("taxes.note")}
        </p>
      </section>

      {/* ── Revenue by client ───────────────────────────────────────────────── */}
      <section className="card">
        <p className="label mb-1">{t("clients.label")}</p>
        <h2 className="text-lg font-semibold mb-1">{t("clients.title")}</h2>
        <p className="text-xs text-[#6A97B4] mb-5">
          {t("clients.totalAllTime", { amount: formatCurrency(totalRevenue, locale) })}
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[#6A97B4] border-b border-[#1E3550]">
                <th className="pb-3 font-medium">{t("clients.client")}</th>
                {YEARS.map(y => (
                  <th key={y} className="pb-3 font-medium text-right">{y}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1A3048]">
              {clientData.clients.filter(c => c.totalRevenue > 0).map(client => (
                <tr key={client.name}>
                  <td className="py-3 text-[#A8C6E0] font-medium">{client.name}</td>
                  {YEARS.map((y, i) => {
                    const amount = clientsByYear[i].find(c => c.name === client.name)?.amount ?? 0;
                    return (
                      <td key={y} className={`py-3 text-right tabular-nums ${amount > 0 ? "text-[#E8F0F8]" : "text-[#2E5070]"}`}>
                        {amount > 0 ? formatCurrency(amount, locale) : "—"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4">
          <Link
            href="/demo/clients"
            className="inline-flex items-center gap-1.5 text-sm text-[#3AB5A0] hover:text-[#4CC4A4] font-medium transition-colors"
          >
            {t("clients.viewProfiles")}
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </section>

      {/* ── Expense breakdown by year ────────────────────────────────────────── */}
      <section>
        <p className="label mb-1">{t("expenses.label")}</p>
        <h2 className="text-lg font-semibold mb-4">{t("expenses.title")}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {YEARS.map((year, i) => {
            const { expenses } = expensesByYear[i];
            const yearTotal    = annual.find(a => a.year === year)?.expenses ?? 0;
            return (
              <div key={year} className="card">
                <p className="text-base font-semibold mb-1">{year}</p>
                <p className="text-xs text-[#6A97B4] mb-4">{t("expenses.yearTotal", { amount: formatCurrency(yearTotal, locale) })}</p>
                <div className="space-y-3">
                  {expenses.map(exp => (
                    <div key={exp.category}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-[#A8C6E0] capitalize">
                          {cat(exp.category)}
                        </span>
                        <span className="text-[#D4A254] tabular-nums font-medium">
                          {formatCurrency(exp.amount, locale)}
                        </span>
                      </div>
                      <div className="h-1 bg-[#243F5E] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#D4A254] rounded-full opacity-60"
                          style={{ width: `${exp.pct}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Income sources by year */}
      <section>
        <p className="label mb-1">{t("income.label")}</p>
        <h2 className="text-lg font-semibold mb-4">{t("income.title")}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {YEARS.map((year, i) => {
            const { sources } = sourcesByYear[i];
            const yearTotal   = annual.find(a => a.year === year)?.income ?? 0;
            return (
              <div key={year} className="card">
                <p className="text-base font-semibold mb-1">{year}</p>
                <p className="text-xs text-[#6A97B4] mb-4">{t("income.yearTotal", { amount: formatCurrency(yearTotal, locale) })}</p>
                <div className="space-y-3">
                  {sources.map(src => (
                    <div key={src.category}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-[#A8C6E0] capitalize">
                          {cat(src.category)}
                        </span>
                        <span className="text-[#4CC4A4] tabular-nums font-medium">
                          {formatCurrency(src.amount, locale)}
                        </span>
                      </div>
                      <div className="h-1 bg-[#243F5E] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#4CC4A4] rounded-full opacity-60"
                          style={{ width: `${src.pct}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <p className="text-center text-xs text-[#2E5070] pb-4">
        {t("footer")}
      </p>
    </div>
  );
}
