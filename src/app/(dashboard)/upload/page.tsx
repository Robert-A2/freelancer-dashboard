import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import CsvUploader from "@/components/upload/CsvUploader";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function UploadPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const imports = await prisma.csvImport.findMany({
    where: { userId: user.id },
    orderBy: { importedAt: "desc" },
    take: 5,
    select: { id: true, fileName: true, status: true, importedRows: true, duplicateRows: true, importedAt: true },
  });

  return (
    <div className="max-w-2xl mx-auto space-y-6 md:space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Upload CSV</h1>
        <p className="text-[#94A3B8] text-sm mt-1">
          Upload any bank statement CSV. Historical and incremental imports both work.
        </p>
      </div>

      <CsvUploader />

      {/* Recurring upload guide */}
      {imports.length > 0 && (
        <div className="flex items-start gap-3 px-4 py-3 bg-[#14B8A60a] border border-[#14B8A618] rounded-xl">
          <span className="text-[#14B8A6] text-base flex-shrink-0 mt-0.5">💡</span>
          <p className="text-sm text-[#CBD5E1]">
            <span className="font-medium text-[#F8FAFC]">Uploading again?</span>{" "}
            Just export your latest months from your bank. We automatically skip any transactions
            already in your history — no need to re-upload your full statement each time.
          </p>
        </div>
      )}

      <div className="card">
        <p className="label mb-3">Expected format</p>
        <div className="bg-[#0A1020] rounded-xl p-4 font-mono text-xs text-[#94A3B8] overflow-x-auto">
          <div className="text-[#22C55E] mb-1">Date, Description, Amount</div>
          <div>2025-01-15, Client Payment - Acme Co, 2500.00</div>
          <div>2025-01-16, Adobe Creative Cloud, -54.99</div>
          <div>2025-01-17, Savings transfer, -400.00</div>
        </div>
        <p className="text-xs text-[#94A3B8] mt-3">
          Most bank exports work automatically. Column names are detected flexibly.
          Positive = income, negative = expense. Duplicates are skipped automatically.
        </p>
      </div>

      {imports.length > 0 && (
        <div className="card">
          <p className="label mb-4">Recent Imports</p>
          <div className="space-y-2">
            {imports.map((imp) => (
              <div key={imp.id} className="flex items-center justify-between py-2 border-b border-[#1E293B] last:border-0">
                <div>
                  <p className="text-sm font-medium text-[#F8FAFC]">{imp.fileName}</p>
                  <p className="text-xs text-[#94A3B8]">
                    {new Date(imp.importedAt).toLocaleDateString("en-IE", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-[#22C55E]">{imp.importedRows.toLocaleString()} imported</p>
                  {imp.duplicateRows > 0 && <p className="text-xs text-[#94A3B8]">{imp.duplicateRows} duplicates</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
