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
        <p className="text-[#6B7280] text-sm mt-1">
          Upload any bank statement CSV. Historical and incremental imports both work.
        </p>
      </div>

      <CsvUploader />

      {imports.length > 0 && (
        <div className="flex items-start gap-3 px-4 py-3 bg-[#4F7A650A] border border-[#4F7A6518] rounded-xl">
          <span className="text-[#4F7A65] text-base flex-shrink-0 mt-0.5">💡</span>
          <p className="text-sm text-[#4B5563]">
            <span className="font-medium text-[#1F2937]">Uploading again?</span>{" "}
            Just export your latest months from your bank. We automatically skip any transactions
            already in your history — no need to re-upload your full statement each time.
          </p>
        </div>
      )}

      <div className="card">
        <p className="label mb-3">Expected format</p>
        <div className="bg-[#F7F8F5] rounded-xl p-4 font-mono text-xs text-[#6B7280] overflow-x-auto border border-[#ECEEE9]">
          <div className="text-[#5B8A72] mb-1">Date, Description, Amount</div>
          <div>2025-01-15, Client Payment - Acme Co, 2500.00</div>
          <div>2025-01-16, Adobe Creative Cloud, -54.99</div>
          <div>2025-01-17, Savings transfer, -400.00</div>
        </div>
        <p className="text-xs text-[#9CA3AF] mt-3">
          Most bank exports work automatically. Column names are detected flexibly.
          Positive = income, negative = expense. Duplicates are skipped automatically.
        </p>
      </div>

      {imports.length > 0 && (
        <div className="card">
          <p className="label mb-4">Recent Imports</p>
          <div className="space-y-2">
            {imports.map((imp) => (
              <div key={imp.id} className="flex items-center justify-between py-2 border-b border-[#ECEEE9] last:border-0">
                <div>
                  <p className="text-sm font-medium text-[#1F2937]">{imp.fileName}</p>
                  <p className="text-xs text-[#9CA3AF]">
                    {new Date(imp.importedAt).toLocaleDateString("en-IE", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-[#5B8A72]">{imp.importedRows.toLocaleString()} imported</p>
                  {imp.duplicateRows > 0 && <p className="text-xs text-[#9CA3AF]">{imp.duplicateRows} duplicates</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
