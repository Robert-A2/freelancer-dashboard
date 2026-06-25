import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const transactions = await prisma.transaction.findMany({
    where: { userId: user.id },
    orderBy: { transactionDate: "desc" },
    select: {
      transactionDate: true,
      description: true,
      amount: true,
      transactionType: true,
      category: true,
      intent: true,
    },
  });

  const header = "Date,Description,Amount,Type,Category,Intent\n";
  const rows = transactions.map(tx => {
    const date = tx.transactionDate.toISOString().slice(0, 10);
    const desc = `"${tx.description.replace(/"/g, '""')}"`;
    const amount = Number(tx.amount).toFixed(2);
    const type = tx.transactionType;
    const category = tx.category ?? "";
    const intent = tx.intent ?? "";
    return `${date},${desc},${amount},${type},${category},${intent}`;
  });

  const csv = header + rows.join("\n");
  const filename = `freelancer-os-export-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
