import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import PersonalDetailsSection from "@/components/settings/PersonalDetailsSection";
import BrandingSection from "@/components/settings/BrandingSection";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const t = await getTranslations("profile");

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      fullName: true,
      businessName: true,
      brandLogoUrl: true,
      brandAccentColor: true,
      brandFont: true,
    },
  });

  return (
    <div className="max-w-2xl mx-auto space-y-8 md:space-y-10">
      <div>
        <h1 className="text-2xl font-bold">{t("heading")}</h1>
        <p className="text-[#7BA8C4] text-sm mt-0.5">{t("subtitle")}</p>
      </div>

      <PersonalDetailsSection
        fullName={dbUser?.fullName ?? user.user_metadata?.full_name ?? ""}
        email={user.email ?? ""}
      />

      <BrandingSection
        brandLogoUrl={dbUser?.brandLogoUrl ?? null}
        brandAccentColor={dbUser?.brandAccentColor ?? null}
        brandFont={dbUser?.brandFont ?? null}
        businessName={dbUser?.businessName ?? null}
      />
    </div>
  );
}
