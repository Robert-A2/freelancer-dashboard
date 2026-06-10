import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import SignOutButton from "@/components/settings/SignOutButton";
import DeleteAccountSection from "@/components/settings/DeleteAccountSection";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const t = await getTranslations("settings");

  return (
    <div className="max-w-2xl mx-auto space-y-8 md:space-y-10">
      <div>
        <h1 className="text-2xl font-bold">{t("heading")}</h1>
        <p className="text-[#7BA8C4] text-sm mt-0.5">{t("subtitle")}</p>
      </div>

      <div className="card">
        <p className="label mb-4">{t("account")}</p>
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs text-[#6A97B4] mb-0.5">{t("email")}</p>
            <p className="text-sm font-medium text-[#E8F0F8] truncate">{user.email}</p>
          </div>
          <SignOutButton />
        </div>
      </div>

      <div className="flex items-start gap-3 px-4 py-3 bg-[#3AB5A00A] border border-[#3AB5A018] rounded-xl">
        <span className="text-[#3AB5A0] text-base flex-shrink-0 mt-0.5">🔒</span>
        <p className="text-sm text-[#A8C6E0] leading-relaxed">
          <span className="font-medium text-[#E8F0F8]">{t("dataNotice.title")}</span>{" "}
          {t("dataNotice.body")}
        </p>
      </div>

      <DeleteAccountSection email={user.email ?? ""} />
    </div>
  );
}
