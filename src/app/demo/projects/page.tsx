import { getTranslations, getLocale } from "next-intl/server";
import type { Locale } from "@/i18n/locales";
import DemoProjectsExperience from "@/components/demo/DemoProjectsExperience";

export const dynamic = "force-dynamic";

// Kept in lockstep with (dashboard)/projects/page.tsx for the header and the
// card-light styling (a deliberate light-on-dark-shell contrast the real app
// uses only for this invoicing-facing area). Unlike a static empty state,
// "Create a project" here actually lets the visitor create one and see the
// resulting milestone list, payment-link copy, and status changes — entirely
// in local browser state, nothing persisted — so they get a real feel for
// the flow instead of being bounced straight to /signup. See
// DemoProjectsExperience for the interactive part. RunwayCard and the
// Stripe/branding nudge banners are still omitted: those reflect real
// account state (Stripe connection, branding upload) that has no meaning
// for a session with nothing saved server-side.
export default async function DemoProjectsPage() {
  const t = await getTranslations("projects");
  const locale = (await getLocale()) as Locale;

  return (
    <div className="space-y-8">
      <div>
        <p className="label-light mb-1">{t("label")}</p>
        <h1 className="text-2xl font-bold text-[#16283B]">{t("title")}</h1>
        <p className="text-[#5B7185] text-sm mt-0.5">{t("subtitle")}</p>
      </div>

      <DemoProjectsExperience locale={locale} />
    </div>
  );
}
