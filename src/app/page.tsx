import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import LanguageSwitcher from "@/components/ui/LanguageSwitcher";
import FinancialPositionCalculator from "@/components/landing/FinancialPositionCalculator";
import ProductDemoReel from "@/components/landing/ProductDemoReel";
import MobileAppShellShowcase from "@/components/landing/MobileAppShellShowcase";
import ProductPanelShowcase from "@/components/landing/ProductPanelShowcase";

function Lines({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <>
      {lines.map((line, i) => (
        <span key={i}>
          {line}
          {i < lines.length - 1 && <br />}
        </span>
      ))}
    </>
  );
}

const CTA_PRIMARY = "inline-flex items-center justify-center bg-[#4F46E5] hover:bg-[#4338CA] text-white font-medium text-base px-7 py-3.5 rounded-full transition-colors";
const CTA_SECONDARY = "inline-flex items-center justify-center border border-[#CBD5E1] hover:border-[#0D1B2B] text-[#0D1B2B] font-medium text-base px-7 py-3.5 rounded-full transition-colors";
// One consistent primary container used by every full-width section, so
// alignment never drifts between sections (spec: "global page width").
const CONTAINER = "max-w-[1320px] mx-auto px-5 sm:px-8 lg:px-10";
// Shared scale for every major-section heading (Calculator/Features/Final
// CTA) — one step below the Hero headline, so hierarchy stays coherent
// instead of each section inventing its own heading size.
const SECTION_HEADING = "text-3xl sm:text-4xl lg:text-5xl font-bold leading-[1.1] tracking-tight text-[#0D1B2B] text-balance";

export default async function LandingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  const t = await getTranslations("landing");
  const featureItems = t.raw("features.items") as { title: string; body: string }[];

  return (
    <div className="min-h-screen bg-white text-[#0D1B2B] overflow-x-hidden">

      {/* ── Navbar ────────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-[#E2E8F0] bg-white/90 backdrop-blur-md">
        <div className={`${CONTAINER} flex items-center justify-between h-[76px]`}>
          <a href="#top" className="flex items-center gap-2">
            <span className="font-bold text-[#0D1B2B] text-lg tracking-tight">Nonodia</span>
          </a>

          <div className="hidden md:flex items-center gap-1 text-sm font-medium text-[#33465A]">
            <a href="#features" className="px-3 py-2 rounded-lg hover:bg-[#F1F5F9] transition-colors">{t("nav.product")}</a>
            <a href="#calculator" className="px-3 py-2 rounded-lg hover:bg-[#F1F5F9] transition-colors">{t("nav.howItWorks")}</a>
            <details className="relative">
              <summary className="list-none [&::-webkit-details-marker]:hidden cursor-pointer px-3 py-2 rounded-lg hover:bg-[#F1F5F9] transition-colors flex items-center gap-1">
                {t("nav.resources")}
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M2.5 4.5L6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </summary>
              <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-[#E2E8F0] rounded-xl shadow-lg py-2">
                <Link href="/demo" className="block px-4 py-2.5 text-sm text-[#33465A] hover:bg-[#F1F5F9] transition-colors">{t("nav.resourcesLiveDemo")}</Link>
                <Link href="/demo/upload" className="block px-4 py-2.5 text-sm text-[#33465A] hover:bg-[#F1F5F9] transition-colors">{t("nav.resourcesCsvGuide")}</Link>
              </div>
            </details>
          </div>

          <div className="flex items-center gap-1 sm:gap-3">
            <LanguageSwitcher variant="light" />
            <Link href="/login" className="text-sm font-medium text-[#33465A] hover:text-[#0D1B2B] transition-colors px-3 py-2">
              {t("nav.signIn")}
            </Link>
            <Link href="/signup" className="bg-[#4F46E5] hover:bg-[#4338CA] text-white text-sm font-semibold px-4 sm:px-5 py-2.5 rounded-full transition-colors whitespace-nowrap">
              {t("nav.cta")}
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Section 1: Hero ───────────────────────────────────────── */}
      <section id="top" className="pt-24 sm:pt-32 lg:pt-[172px] pb-10 lg:pb-16" style={{ background: "linear-gradient(180deg, #F5F8FC 0%, #FFFFFF 100%)" }}>
        <div className={`${CONTAINER} grid grid-cols-1 lg:grid-cols-[43%_57%] gap-16 xl:gap-20 items-start`}>

          {/* Text column */}
          <div className="min-w-0">
            <h1 className="text-[clamp(2.375rem,1.25rem_+_3vw,4rem)] font-bold leading-[1.05] tracking-[-0.04em] text-[#0D1B2B] mb-7 max-w-[650px] text-balance">
              {t("hero.titleLead")}{" "}
              <span className="text-[#4F46E5]">{t("hero.titleAmount")}</span>{" "}
              {t("hero.titleQuestionPre")}{" "}
              <span className="text-[#4F46E5]">{t("hero.titleQuestionHighlight")}</span>{" "}
              {t("hero.titleQuestionPost")}
            </h1>

            <p className="text-[19px] leading-[1.55] text-[#64748B] mb-9 max-w-[600px]">
              {t("hero.body")}
            </p>

            <div className="flex flex-wrap items-center gap-3 mb-10">
              <Link href="/signup" className={CTA_PRIMARY}>{t("hero.primaryCta")} →</Link>
            </div>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              {(t.raw("hero.trust") as string[]).map((label, i) => (
                <span key={i} className="flex items-center gap-1.5 text-sm text-[#64748B]">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <circle cx="8" cy="8" r="7" stroke="#16A34A" strokeWidth="1.3"/>
                    <path d="M5 8.2l2 2 4-4.4" stroke="#16A34A" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  {label}
                </span>
              ))}
            </div>
          </div>

          {/* Product demo reel — a real, animated UI walkthrough (not a
              screen-recorded video file; auto-plays in view, replayable).
              Desktop and mobile get purpose-built previews rather than one
              layout awkwardly serving both: the mobile version is a
              compact, curated slice (see MobileAppShellShowcase), not the
              full desktop card stack shrunk down. */}
          <div className="min-w-0">
            <div className="hidden lg:block">
              <ProductDemoReel />
            </div>
            <div className="lg:hidden">
              <MobileAppShellShowcase />
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 2: Interactive calculator ─────────────────────── */}
      <section id="calculator" className="pt-10 md:pt-14 lg:pt-16 pb-20 md:pb-28 lg:pb-36 bg-white border-t border-[#F1F5F9]">
        <div className="max-w-[760px] mx-auto px-5 sm:px-8 text-center mb-14">
          <h2 className={SECTION_HEADING}>{t("calculator.title")}</h2>
          <p className="text-lg text-[#64748B] mt-5">{t("calculator.subtitle")}</p>
        </div>
        <div className="px-5 sm:px-8">
          <FinancialPositionCalculator />
        </div>
      </section>

      {/* ── Section 3: Features ───────────────────────────────────── */}
      <section id="features" className="py-20 md:py-28 lg:py-36 bg-[#F8FAFC] border-y border-[#E2E8F0]">
        <div className={CONTAINER}>
          <h2 className={`${SECTION_HEADING} text-center max-w-[760px] mx-auto mb-16`}>
            {t("features.title")}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-x-8 gap-y-12">
            {featureItems.map((item, i) => (
              <div key={i} className="flex flex-col items-center text-center">
                <div className="w-14 h-14 rounded-full bg-[#EEF2FF] flex items-center justify-center mb-5">
                  <FeatureIcon index={i} />
                </div>
                <p className="text-base font-semibold text-[#0D1B2B] mb-2">{item.title}</p>
                <p className="text-sm text-[#64748B] leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Section 3.5: Product showcase (real dashboard + Add menu) ── */}
      <section className="py-16 md:py-20 lg:py-24 bg-white">
        <div className={CONTAINER}>
          <div className="flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-0">
            <ProductPanelShowcase />
            <p className="text-xl sm:text-2xl lg:text-3xl font-bold leading-[1.1] tracking-tight text-[#0D1B2B] lg:flex-1 mt-0 lg:mt-0 lg:-translate-y-8 lg:translate-x-8"><Lines text={t("productShowcase.tagline")} /></p>
          </div>
        </div>
      </section>

      {/* ── Section 4: Final CTA ──────────────────────────────────── */}
      <section className="py-16 md:py-20 lg:py-24 bg-[#F5F3FF]">
        <div className="max-w-2xl mx-auto px-5 sm:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#0D1B2B] leading-[1.15] mb-5 text-balance">{t("finalCta.title")}</h2>
          <p className="text-lg text-[#64748B] leading-relaxed mb-10">{t("finalCta.body")}</p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link href="/signup" className={CTA_PRIMARY}>{t("finalCta.primaryCta")}</Link>
            <Link href="/demo" className={CTA_SECONDARY}>{t("finalCta.secondaryCta")}</Link>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer className="border-t border-[#E2E8F0] bg-white pt-16 pb-10">
        <div className={CONTAINER}>
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div>
              <p className="font-bold text-[#0D1B2B] text-lg mb-1">Nonodia</p>
              <p className="text-sm text-[#94A3B8]">{t("footer.tagline")}</p>
            </div>

            <nav className="flex flex-wrap items-center justify-center gap-2 text-sm text-[#64748B]">
              <Link href="/data-privacy" className="hover:text-[#0D1B2B] transition-colors px-2 py-1">{t("footer.privacyPolicy")}</Link>
              <span className="text-[#E2E8F0]">·</span>
              <Link href="/terms-of-service" className="hover:text-[#0D1B2B] transition-colors px-2 py-1">{t("footer.termsOfService")}</Link>
              <span className="text-[#E2E8F0]">·</span>
              <Link href="/data-privacy" className="hover:text-[#0D1B2B] transition-colors px-2 py-1">{t("footer.dataPrivacy")}</Link>
            </nav>

            <div className="flex items-center gap-4">
              <LanguageSwitcher variant="light" />
              <span className="text-sm text-[#94A3B8]">{t("footer.copyright")}</span>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}


function FeatureIcon({ index }: { index: number }) {
  const paths = [
    // shield — protected
    <path key="shield" d="M12 3l7 3v5c0 4.5-3 8-7 9-4-1-7-4.5-7-9V6l7-3z" stroke="#4F46E5" strokeWidth="1.4" strokeLinejoin="round" />,
    // wallet — available
    <path key="wallet" d="M4 7a2 2 0 012-2h10a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2V7z M15 12h3v3h-3a1.5 1.5 0 010-3z" stroke="#4F46E5" strokeWidth="1.4" strokeLinejoin="round" />,
    // clock — runway
    <g key="clock"><circle cx="12" cy="12" r="8" stroke="#4F46E5" strokeWidth="1.4" /><path d="M12 8v4l3 2" stroke="#4F46E5" strokeWidth="1.4" strokeLinecap="round" /></g>,
    // trending up — plan
    <path key="trend" d="M4 16l5-5 4 4 7-8 M15 6h5v5" stroke="#4F46E5" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />,
    // list — track
    <g key="list"><path d="M8 7h9M8 12h9M8 17h9" stroke="#4F46E5" strokeWidth="1.4" strokeLinecap="round" /><circle cx="5" cy="7" r="1" fill="#4F46E5" /><circle cx="5" cy="12" r="1" fill="#4F46E5" /><circle cx="5" cy="17" r="1" fill="#4F46E5" /></g>,
  ];
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {paths[index % paths.length]}
    </svg>
  );
}
