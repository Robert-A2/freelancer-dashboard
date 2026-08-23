import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import type { Locale } from "@/i18n/locales";
import { prisma } from "@/lib/prisma";
import { getAccountStatus } from "@/lib/stripe";
import { getCountryRules } from "@/lib/reserve-engine/countries";
import { getFinancialReserve } from "@/lib/reserve-engine";
import DeleteAccountSection from "@/components/settings/DeleteAccountSection";
import ExportDataButton from "@/components/settings/ExportDataButton";
import StripeConnectSection from "@/components/settings/StripeConnectSection";
import VatSettingsSection from "@/components/settings/VatSettingsSection";
import TaxContributionsSection from "@/components/settings/TaxContributionsSection";
import FinancialReserveCard from "@/components/dashboard/FinancialReserveCard";
import SafetyBufferSection from "@/components/settings/SafetyBufferSection";
import { PROJECTS_ENABLED } from "@/lib/feature-flags";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const t = await getTranslations("settings");
  const locale = (await getLocale()) as Locale;
  const financialReserve = await getFinancialReserve(user.id);

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      stripeAccountId: true,
      stripeAccountEnabled: true,
      country: true,
      businessLegalStatus: true,
      activityType: true,
      vatStatus: true,
      vatNumber: true,
      defaultVatRate: true,
      versementLiberatoireStatus: true,
      acreStatus: true,
      activityStartDate: true,
      urssafFrequency: true,
      businessName: true,
      brandLogoUrl: true,
      brandAccentColor: true,
      brandFont: true,
      safetyBufferMonths: true,
    },
  });

  const financialProfile = {
    country: dbUser?.country ?? null,
    businessLegalStatus: dbUser?.businessLegalStatus ?? null,
    activityType: dbUser?.activityType ?? null,
    vatStatus: dbUser?.vatStatus ?? null,
    versementLiberatoireStatus: dbUser?.versementLiberatoireStatus ?? null,
    acreStatus: dbUser?.acreStatus ?? null,
    activityStartDate: dbUser?.activityStartDate ?? null,
    defaultVatRate: dbUser?.defaultVatRate != null ? Number(dbUser.defaultVatRate) : null,
    urssafFrequency: dbUser?.urssafFrequency ?? null,
  };
  const countryRules = getCountryRules(financialProfile.country);
  const isFinancialProfileComplete = countryRules?.isProfileComplete(financialProfile) ?? false;

  // Live-check with Stripe once per page load rather than relying only on the
  // webhook — Connect onboarding can be finished by the user without any
  // webhook firing back to us, so this is how "pending" flips to "connected".
  let stripeStatus: "notConnected" | "pending" | "connected" = "notConnected";
  // Projects/Milestones (and the Stripe Connect payment links tied to them)
  // are paused — see feature-flags.ts. Skips the live Stripe API call too,
  // not just the rendered section.
  if (PROJECTS_ENABLED && dbUser?.stripeAccountId) {
    stripeStatus = dbUser.stripeAccountEnabled ? "connected" : "pending";
    if (process.env.STRIPE_SECRET_KEY) {
      try {
        const account = await getAccountStatus(dbUser.stripeAccountId);
        const enabled = Boolean(account.charges_enabled && account.payouts_enabled);
        stripeStatus = enabled ? "connected" : "pending";
        if (enabled !== dbUser.stripeAccountEnabled) {
          await prisma.user.update({ where: { id: user.id }, data: { stripeAccountEnabled: enabled } });
        }
      } catch (err) {
        console.error("Stripe account status check failed:", err);
      }
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8 md:space-y-10">
      <div>
        <h1 className="text-2xl font-bold">{t("heading")}</h1>
        <p className="text-[#7BA8C4] text-sm mt-0.5">{t("subtitle")}</p>
      </div>

      <div className="flex items-start gap-3 px-4 py-3 bg-[#3AB5A00A] border border-[#3AB5A018] rounded-xl">
        <span className="text-[#3AB5A0] text-base flex-shrink-0 mt-0.5">🔒</span>
        <p className="text-sm text-[#A8C6E0] leading-relaxed">
          <span className="font-medium text-[#E8F0F8]">{t("dataNotice.title")}</span>{" "}
          {t("dataNotice.body")}
        </p>
      </div>

      <div className="card">
        <p className="label mb-1">{t("export.label")}</p>
        <p className="text-sm text-[#7BA8C4] mb-4">{t("export.body")}</p>
        <ExportDataButton />
      </div>

      {PROJECTS_ENABLED && <StripeConnectSection status={stripeStatus} />}

      <TaxContributionsSection
        country={financialProfile.country}
        businessLegalStatus={financialProfile.businessLegalStatus}
        activityType={financialProfile.activityType}
        versementLiberatoireStatus={financialProfile.versementLiberatoireStatus}
        acreStatus={financialProfile.acreStatus}
        activityStartDate={financialProfile.activityStartDate}
        urssafFrequency={financialProfile.urssafFrequency}
        isComplete={isFinancialProfileComplete}
      />

      <VatSettingsSection
        vatStatus={dbUser?.vatStatus ?? null}
        vatNumber={dbUser?.vatNumber ?? null}
        defaultVatRate={financialProfile.defaultVatRate}
      />

      <FinancialReserveCard data={financialReserve} locale={locale} />

      <SafetyBufferSection safetyBufferMonths={dbUser?.safetyBufferMonths != null ? Number(dbUser.safetyBufferMonths) : null} />

      <DeleteAccountSection email={user.email ?? ""} />
    </div>
  );
}
