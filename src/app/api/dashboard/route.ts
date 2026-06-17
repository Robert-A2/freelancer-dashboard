import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getDashboardSummary, getIntentBreakdown } from "@/lib/analytics-engine";
import { getLatestForecast } from "@/lib/forecast-engine";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [summary, forecast, totalTransactions, lastImport, intentBreakdown] = await Promise.all([
      getDashboardSummary(user.id),
      getLatestForecast(user.id),
      prisma.transaction.count({ where: { userId: user.id } }),
      prisma.csvImport.findFirst({
        where: { userId: user.id, status: "completed" },
        orderBy: { importedAt: "desc" },
        select: { importedAt: true, fileName: true, importedRows: true },
      }),
      getIntentBreakdown(user.id),
    ]);

    return NextResponse.json({
      current: summary.current
        ? {
            totalIncome: Number(summary.current.totalIncome),
            totalExpenses: Number(summary.current.totalExpenses),
            totalSavings: Number(summary.current.totalSavings),
            netCashflow: Number(summary.current.netCashflow),
          }
        : null,
      previous: summary.previous
        ? {
            totalIncome: Number(summary.previous.totalIncome),
            totalExpenses: Number(summary.previous.totalExpenses),
            totalSavings: Number(summary.previous.totalSavings),
            netCashflow: Number(summary.previous.netCashflow),
          }
        : null,
      recent: summary.recent.map((tx) => ({
        id: tx.id,
        date: tx.transactionDate,
        description: tx.description,
        amount: Number(tx.amount),
        type: tx.transactionType,
        category: tx.category,
      })),
      forecast,
      totalTransactions,
      lastImport,
      // Intent-based financial breakdown — all-time totals.
      // null when hasEnoughDataForDisplay is false (intent coverage < 80%).
      intentBreakdown: intentBreakdown.hasEnoughDataForDisplay ? intentBreakdown : null,
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    return NextResponse.json({ error: "Failed to load dashboard" }, { status: 500 });
  }
}
