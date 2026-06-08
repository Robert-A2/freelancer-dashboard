import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import SignOutButton from "@/components/settings/SignOutButton";
import DeleteAccountSection from "@/components/settings/DeleteAccountSection";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="max-w-2xl mx-auto space-y-8 md:space-y-10">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-[#7BA8C4] text-sm mt-0.5">Manage your account and data</p>
      </div>

      <div className="card">
        <p className="label mb-4">Account</p>
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs text-[#6A97B4] mb-0.5">Email</p>
            <p className="text-sm font-medium text-[#E8F0F8] truncate">{user.email}</p>
          </div>
          <SignOutButton />
        </div>
      </div>

      <div className="flex items-start gap-3 px-4 py-3 bg-[#3AB5A00A] border border-[#3AB5A018] rounded-xl">
        <span className="text-[#3AB5A0] text-base flex-shrink-0 mt-0.5">🔒</span>
        <p className="text-sm text-[#A8C6E0] leading-relaxed">
          <span className="font-medium text-[#E8F0F8]">Your data belongs to you.</span>{" "}
          Freelancer OS never sells or shares your financial data. You can leave at any
          time, and permanently remove every record we hold about you — no questions asked.
        </p>
      </div>

      <DeleteAccountSection email={user.email ?? ""} />
    </div>
  );
}
