import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getHistoricalData } from "@/lib/analytics-engine";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const months = parseInt(searchParams.get("months") || "12");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const type = searchParams.get("type") || undefined;
    const skip = (page - 1) * limit;

    const [chartData, transactions, total] = await Promise.all([
      getHistoricalData(user.id, months),
      prisma.transaction.findMany({
        where: {
          userId: user.id,
          ...(type ? { transactionType: type } : {}),
        },
        orderBy: { transactionDate: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          transactionDate: true,
          description: true,
          amount: true,
          transactionType: true,
          category: true,
          sourceFile: true,
        },
      }),
      prisma.transaction.count({
        where: {
          userId: user.id,
          ...(type ? { transactionType: type } : {}),
        },
      }),
    ]);

    return NextResponse.json({
      chartData,
      transactions: transactions.map((tx) => ({
        ...tx,
        amount: Number(tx.amount),
      })),
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("History error:", error);
    return NextResponse.json({ error: "Failed to load history" }, { status: 500 });
  }
}
