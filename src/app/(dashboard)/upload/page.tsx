import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import CsvUploader from "@/components/upload/CsvUploader";
import DeleteImportButton from "@/components/upload/DeleteImportButton";
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
        <p className="text-[#7BA8C4] text-sm mt-1">
          Upload any bank statement CSV. Historical and incremental imports both work.
        </p>
      </div>

      <CsvUploader />

      {imports.length > 0 && (
        <div className="flex items-start gap-3 px-4 py-3 bg-[#3AB5A00A] border border-[#3AB5A018] rounded-xl">
          <span className="text-[#3AB5A0] text-base flex-shrink-0 mt-0.5">💡</span>
          <p className="text-sm text-[#A8C6E0]">
            <span className="font-medium text-[#E8F0F8]">Uploading again?</span>{" "}
            Just export your latest months from your bank. We automatically skip any transactions
            already in your history — no need to re-upload your full statement each time.
          </p>
        </div>
      )}

      <div className="card">
        <p className="label mb-3">Expected format</p>
        <div className="bg-[#1A3048] rounded-xl p-4 font-mono text-xs text-[#7BA8C4] overflow-x-auto border border-[#1E3550]">
          <div className="text-[#4CC4A4] mb-1">Date, Description, Amount</div>
          <div>2025-01-15, Client Payment - Acme Co, 2500.00</div>
          <div>2025-01-16, Adobe Creative Cloud, -54.99</div>
          <div>2025-01-17, Savings transfer, -400.00</div>
        </div>
        <p className="text-xs text-[#6A97B4] mt-3">
          Most bank exports work automatically. Column names are detected flexibly.
          Positive = income, negative = expense. Duplicates are skipped automatically.
        </p>
      </div>

      {imports.length > 0 && (
        <div className="card">
          <p className="label mb-4">Recent Imports</p>
          <div className="space-y-2">
            {imports.map((imp) => (
              <div key={imp.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 py-2 border-b border-[#1E3550] last:border-0">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#E8F0F8] truncate">{imp.fileName}</p>
                  <p className="text-xs text-[#6A97B4]">
                    {new Date(imp.importedAt).toLocaleDateString("en-IE", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-3 flex-shrink-0">
                  <div className="text-right">
                    <p className="text-sm text-[#4CC4A4] whitespace-nowrap">{imp.importedRows.toLocaleString()} imported</p>
                    {imp.duplicateRows > 0 && <p className="text-xs text-[#6A97B4] whitespace-nowrap">{imp.duplicateRows} duplicates</p>}
                  </div>
                  <DeleteImportButton importId={imp.id} fileName={imp.fileName} importedRows={imp.importedRows} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
