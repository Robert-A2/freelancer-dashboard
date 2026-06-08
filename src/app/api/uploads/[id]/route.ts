import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { recalculateMonthlyAnalytics } from "@/lib/analytics-engine";

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

    // Recalculate monthly analytics so dashboards and forecasts reflect the removal
    await recalculateMonthlyAnalytics(user.id);

    return NextResponse.json({ success: true, deletedCount });
  } catch (error) {
    console.error("Delete import error:", error);
    return NextResponse.json({ error: "Failed to delete import" }, { status: 500 });
  }
}
