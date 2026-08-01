import { getTranslations } from "next-intl/server";
import Link from "next/link";

export const dynamic = "force-dynamic";

// Kept in lockstep with (dashboard)/projects/page.tsx — same header, same
// card-light empty state (a deliberate light-on-dark-shell contrast the real
// app uses only for this invoicing-facing area, not a demo-only style).
// The demo persona has no Projects entities, matching a genuine brand-new
// signup, so only the empty state ever renders here — NewProjectPanel,
// RunwayCard, and the Stripe/branding nudge banners are all real-write or
// real-account-state features the demo can't back with anything real, so
// they're omitted rather than faked. The CTA goes to /signup instead of
// opening the real new-project form, for the same reason.
export default async function DemoProjectsPage() {
  const t = await getTranslations("projects");

  return (
    <div className="space-y-8">
      <div>
        <p className="label-light mb-1">{t("label")}</p>
        <h1 className="text-2xl font-bold text-[#16283B]">{t("title")}</h1>
        <p className="text-[#5B7185] text-sm mt-0.5">{t("subtitle")}</p>
      </div>

      <div className="card-light text-center py-16">
        <div className="text-5xl mb-4">🤝</div>
        <h2 className="text-xl font-semibold mb-2 text-[#16283B]">{t("emptyState.heading")}</h2>
        <p className="text-[#5B7185] mb-6 max-w-sm mx-auto">{t("emptyState.body")}</p>
        <Link href="/signup" className="btn-primary inline-block">{t("emptyState.cta")}</Link>
      </div>
    </div>
  );
}
