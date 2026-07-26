import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { recalculateMonthlyAnalytics } from "@/lib/analytics-engine";
import { generateForecast } from "@/lib/forecast-engine";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    const csvImport = await prisma.csvImport.findFirst({
      where: { id, userId: user.id },
      select: { id: true },
    });
    if (!csvImport) return NextResponse.json({ error: "Import not found" }, { status: 404 });

    // Remove the transactions this import brought in, then the import record itself.
    const { count: deletedCount } = await prisma.transaction.deleteMany({
      where: { csvImportId: id, userId: user.id },
    });
    await prisma.csvImport.delete({ where: { id } });

    // An account created for this import (e.g. "Deutsche Bank", auto-detected
    // from the CSV header) can be left with zero transactions and zero
    // imports once this is gone — a ghost row that outlives the data it
    // represented. Deleted data should stay deleted everywhere, including
    // account tabs, so remove any account left fully empty by this delete.
    await prisma.account.deleteMany({
      where: { userId: user.id, transactions: { none: {} }, csvImports: { none: {} } },
    });

    // Recalculate monthly analytics, then regenerate the forecast so dashboards
    // and forecasts reflect the removal (and don't show a stale projection if
    // this was the user's last import).
    await recalculateMonthlyAnalytics(user.id);
    await generateForecast(user.id);

    // The deleted transactions feed every one of these pages. Without this,
    // Next's client-side router cache can keep serving a stale copy of a page
    // (e.g. the Dashboard) for up to 30s after the delete, even though the
    // server-side data is already gone — this forces the next visit to refetch.
    revalidatePath("/dashboard");
    revalidatePath("/history");
    revalidatePath("/analytics");
    revalidatePath("/forecast");
    revalidatePath("/clients");
    revalidatePath("/upload");

    return NextResponse.json({ success: true, deletedCount });
  } catch (error) {
    console.error("Delete import error:", error);
    return NextResponse.json({ error: "Failed to delete import" }, { status: 500 });
  }
}
