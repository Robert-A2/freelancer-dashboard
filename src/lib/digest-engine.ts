import { prisma } from "./prisma";
import { getDashboardSummary } from "./analytics-engine";
import { extractClientName } from "./analytics-engine";
import { formatCurrency } from "@/utils/finance";
import type { DigestEmailData } from "./email";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://freelanceros.app";

// Builds the weekly digest data for a single user.
// Always uses 'en' locale — digest is English-only until locale is persisted to DB.
export async function buildUserDigest(
  userId: string,
  user: { email: string; fullName: string; digestUnsubscribeToken: string }
): Promise<DigestEmailData | null> {
  const [summary, clientAlerts] = await Promise.all([
    getDashboardSummary(userId),
    getOverdueClientsForDigest(userId),
  ]);

  if (!summary.current) return null;

  const income    = Number(summary.current.totalIncome);
  const expenses  = Number(summary.current.totalExpenses);
  const cashflow  = Number(summary.current.netCashflow);

  const fmtIncome   = formatCurrency(income, "en");
  const fmtExpenses = formatCurrency(expenses, "en");
  const fmtCashflow = formatCurrency(Math.abs(cashflow), "en");

  let insightLine: string | null = null;
  if (income > 0 && cashflow > 0) {
    const marginPct = Math.round((cashflow / income) * 100);
    insightLine = `You kept ${marginPct}% of your income as profit this month.`;
  } else if (cashflow < 0) {
    insightLine = `Expenses exceeded income by ${formatCurrency(Math.abs(cashflow), "en")} this month.`;
  }

  const now = new Date();
  const period = now.toLocaleDateString("en-IE", { month: "long", year: "numeric" });
  const firstName = user.fullName.split(" ")[0] || user.fullName;

  return {
    to: user.email,
    firstName,
    period,
    income: fmtIncome,
    expenses: fmtExpenses,
    cashflow: cashflow >= 0 ? fmtCashflow : `-${fmtCashflow}`,
    cashflowPositive: cashflow >= 0,
    insightLine,
    clientAlerts,
    unsubscribeUrl: `${APP_URL}/api/digest/unsubscribe?token=${user.digestUnsubscribeToken}`,
    appUrl: APP_URL,
  };
}

// Lightweight version of the client risk check — avoids the getLocale() dependency
// from client-risk-engine so this can run in a cron context without request headers.
async function getOverdueClientsForDigest(userId: string): Promise<{ name: string; daysSince: number }[]> {
  const txs = await prisma.transaction.findMany({
    where: {
      userId,
      OR: [
        { intent: { in: ["freelance_income", "salary"] } },
        { transactionType: "income" },
      ],
    },
    select: { description: true, transactionDate: true, category: true },
    orderBy: { transactionDate: "desc" },
  });

  if (txs.length === 0) return [];

  const today = new Date();
  const lastPaymentByClient: Record<string, Date> = {};

  for (const tx of txs) {
    const { name } = extractClientName(tx.description, tx.category);
    const key = name.toUpperCase();
    const date = new Date(tx.transactionDate);
    if (!lastPaymentByClient[key] || date > lastPaymentByClient[key]) {
      lastPaymentByClient[key] = date;
    }
  }

  return Object.entries(lastPaymentByClient)
    .map(([key, lastDate]) => ({
      name: key
        .split(" ")
        .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
        .join(" "),
      daysSince: Math.floor((today.getTime() - lastDate.getTime()) / 86_400_000),
    }))
    .filter((c) => c.daysSince >= 30)
    .sort((a, b) => b.daysSince - a.daysSince)
    .slice(0, 2);
}
