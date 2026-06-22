import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import CsvUploader from "@/components/upload/CsvUploader";
import DeleteImportButton from "@/components/upload/DeleteImportButton";
import { prisma } from "@/lib/prisma";
import { INTL_LOCALES, type Locale } from "@/i18n/locales";

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

  const t = await getTranslations("upload");
  const locale = (await getLocale()) as Locale;

  return (
    <div className="max-w-2xl mx-auto space-y-6 md:space-y-8">
      <div>
        <h1 className="text-2xl font-bold">{t("heading")}</h1>
        <p className="text-[#7BA8C4] text-sm mt-1">
          {t("subtitle")}
        </p>
      </div>

      <CsvUploader />

      {imports.length > 0 && (
        <div className="flex items-start gap-3 px-4 py-3 bg-[#3AB5A00A] border border-[#3AB5A018] rounded-xl">
          <span className="text-[#3AB5A0] text-base flex-shrink-0 mt-0.5">💡</span>
          <p className="text-sm text-[#A8C6E0]">
            <span className="font-medium text-[#E8F0F8]">{t("uploadingAgain.title")}</span>{" "}
            {t("uploadingAgain.body")}
          </p>
        </div>
      )}

      <div className="card">
        <p className="label mb-3">{t("expectedFormat.label")}</p>
        <div className="bg-[#1A3048] rounded-xl p-4 font-mono text-xs text-[#7BA8C4] overflow-x-auto border border-[#1E3550]">
          <div className="text-[#4CC4A4] mb-1">{t("expectedFormat.header")}</div>
          <div>{t("expectedFormat.example1")}</div>
          <div>{t("expectedFormat.example2")}</div>
          <div>{t("expectedFormat.example3")}</div>
        </div>
        <p className="text-xs text-[#6A97B4] mt-3">
          {t("expectedFormat.note")}
        </p>
      </div>

      {imports.length > 0 && (
        <div className="card">
          <p className="label mb-4">{t("recentImports.label")}</p>
          <div className="space-y-2">
            {imports.map((imp) => (
              <div key={imp.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#E8F0F8] truncate">{imp.fileName}</p>
                  <p className="text-xs text-[#6A97B4]">
                    {new Date(imp.importedAt).toLocaleDateString(INTL_LOCALES[locale], { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-3 flex-shrink-0">
                  <div className="text-right">
                    <p className="text-sm text-[#4CC4A4] whitespace-nowrap">{t("recentImports.imported", { count: imp.importedRows })}</p>
                    {imp.duplicateRows > 0 && <p className="text-xs text-[#6A97B4] whitespace-nowrap">{t("recentImports.duplicates", { count: imp.duplicateRows })}</p>}
                  </div>
                  <DeleteImportButton importId={imp.id} fileName={imp.fileName} importedRows={imp.importedRows} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="text-center">
        <a href="/data-privacy" className="text-xs text-[#6A97B4] hover:text-[#E8F0F8] transition-colors">
          {t("dataPrivacyLink")}
        </a>
      </div>
    </div>
  );
}
