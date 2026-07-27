import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import LanguageSwitcher from "@/components/ui/LanguageSwitcher";
import CsvHelpPanel from "@/components/landing/CsvHelpPanel";
import ProductExperience from "@/components/landing/ProductExperience";
import PhoneNavShowcase from "@/components/landing/snapshots/PhoneNavShowcase";
import MilestoneFlipCard from "@/components/landing/MilestoneFlipCard";
import TaxShieldFlipCard from "@/components/landing/TaxShieldFlipCard";

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

// Shared CTA style — every primary button on the landing page uses this
// exact size/shape: a calm, light-weight pill, no arrow icon.
const CTA_CLASS = "inline-flex items-center bg-[#3AB5A0] hover:bg-[#2E9D8A] text-[#0D1B2B] font-medium text-sm px-6 py-3 rounded-full transition-colors";
// The hero CTA only — same shape/weight, just a touch larger since it's the
// page's primary action and sits next to a large product screen.
const CTA_CLASS_HERO = "inline-flex items-center bg-[#3AB5A0] hover:bg-[#2E9D8A] text-[#0D1B2B] font-medium text-base px-8 py-3.5 rounded-full transition-colors";

export default async function LandingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  const t = await getTranslations("landing");
  const questions = t.raw("problem.questions") as string[];
  const valuePropItems = t.raw("valueProp.items") as { title: string; body: string }[];
  const valuePropDemo = t.raw("valueProp.demo") as {
    cta: string;
    invoiceHeading: string;
    project: string;
    milestones: { label: string; status: string; state: "paid" | "upcoming"; amount: string; due: string }[];
  };
  const valuePropTaxDemo = t.raw("valueProp.taxDemo") as {
    cta: string;
    heading: string;
    subtitle: string;
    grossLabel: string;
    gross: string;
    taxLabel: string;
    taxAmount: string;
    netLabel: string;
    net: string;
  };

  return (
    <div className="min-h-screen bg-[#0D1B2B] text-[#E8F0F8]">

      {/* ── Navbar ────────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-[#1E3550]/40 bg-[#132537]/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
          <span className="font-bold text-[#E8F0F8] text-lg tracking-tight">Nonodia</span>
          <div className="flex items-center gap-1 sm:gap-2">
            <LanguageSwitcher />
            <Link
              href="/login"
              className="hidden sm:inline-block text-sm text-[#7BA8C4] hover:text-[#E8F0F8] transition-colors px-4 py-2"
            >
              {t("nav.signIn")}
            </Link>
            <Link
              href="/signup"
              className="bg-[#3AB5A0] hover:bg-[#2E9D8A] text-[#0D1B2B] text-sm font-bold px-4 sm:px-5 py-2.5 rounded-xl transition-colors whitespace-nowrap"
            >
              {t("nav.getStarted")}
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Section 1: Hero — text left, live product screen right ──── */}
      <section className="pt-24 pb-14 md:pt-28 overflow-x-hidden" style={{ background: "linear-gradient(180deg, #F3F8FD 0%, #F8FBFE 55%, #FFFFFF 100%)" }}>
        <div className="max-w-[1440px] mx-auto px-6 grid grid-cols-1 lg:grid-cols-[minmax(0,480px)_1fr] gap-14 lg:gap-16 items-start">

          {/* Text column */}
          <div className="lg:pt-6 lg:pl-10">
            <h1 className="mb-10 text-balance">
              <span className="block text-2xl sm:text-[1.75rem] font-medium leading-[1.4] tracking-tight text-[#7189A3] mb-4">
                {t("hero.titleLead")}
              </span>
              <span className="block text-3xl sm:text-4xl lg:text-[2.875rem] font-bold leading-[1.15] tracking-tight text-[#0D1B2B]">
                {t("hero.titleMain")}
              </span>
            </h1>

            <p className="text-[15px] sm:text-base leading-[1.7] mb-8 max-w-md">
              <span className="text-[#7189A3]">{t("hero.bodyLight")}</span>{" "}
              <span className="text-[#33465A] font-medium">{t("hero.bodyDark")}</span>
            </p>

            <Link href="/signup" className={CTA_CLASS_HERO}>
              {t("hero.cta")}
            </Link>
          </div>

          {/* Live product screen — one fixed 800px-wide composition (matching
              its 5-column internal grid, which never reflows) shrunk down as
              a whole using `zoom` rather than reflowed per breakpoint. zoom
              (unlike transform) actually shrinks the layout box too, so this
              behaves like a real screenshot scaling down, not a live grid
              restructuring itself.

              The zoom steps are NOT monotonically "bigger at bigger
              breakpoints" — that's intentional. Below `lg` this sits in a
              single-column stack with the full viewport width to itself
              (minus the page's own px-6). At `lg` (1024px) the grid switches
              to two columns and the text column claims up to 480px + a 64px
              gap, so the space actually available to this column *drops*
              sharply right at that breakpoint even though the viewport got
              bigger — from ~720px just before `lg` to as little as ~430px
              right at it. The zoom value has to drop to match, then climb
              back up as the viewport keeps growing and there's real room
              again. min-w-0 + overflow-hidden is the hard backstop: even if
              this math is ever slightly off at some in-between width, it
              clips instead of overlapping the text column.

              Deliberately NOT `ml-auto`: once zoom shrinks this smaller than
              its 1fr track (true at every width except >=1440px), ml-auto
              pushes it flush against the page's outer edge instead — which
              looks fine on its own, but leaves the *leftover track space*
              sitting between the text and the image, right where the eye
              expects them to be close together. Left-aligned, it just sits
              directly next to the grid gap instead.

              Below `lg` (single-column stack), the opposite problem showed
              up: this sits in a full-width grid track, but the zoomed
              content is narrower than that track and — as a plain block
              child with no width of its own — hugs the left edge, dumping
              all the leftover slack on the right (confirmed on a real
              phone: text reached further right than the mockup did).
              w-fit + mx-auto below `lg` makes this box hug its own (zoomed)
              content size and centers *that* within the column, so
              whatever slack exists splits evenly instead of collecting on
              one side. Reset to the flush-left, next-to-text behavior at
              `lg`+ where it's beside the text, not stacked under it. */}
          <div className="w-fit mx-auto lg:w-auto lg:mx-0 min-w-0 overflow-hidden mt-10 lg:mt-0 lg:-mt-4 [zoom:0.39] sm:[zoom:0.6] md:[zoom:0.85] lg:[zoom:0.5] min-[1150px]:[zoom:0.65] min-[1280px]:[zoom:0.8] min-[1440px]:[zoom:1]">
            <div className="w-[800px]">
              <ProductExperience />
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 2: The Problem ────────────────────────────────── */}
      <section className="pt-10 pb-16 md:pt-12 md:pb-20 bg-[#EFE5D4] border-y border-[#E0D4BC] overflow-x-hidden">
        <div className="max-w-[1440px] mx-auto px-6 grid grid-cols-1 lg:grid-cols-[minmax(0,480px)_1fr] gap-6 items-center">

          <div className="max-w-[560px] mx-auto lg:mx-0 lg:pl-12">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-[-0.015em] text-[#0D1B2B] leading-[1.3] mb-6 text-balance">
              <Lines text={t("problem.title")} />
            </h2>

            <p className="text-base font-light tracking-[-0.005em] leading-[1.65] text-[#5B5346] mb-10">
              {t("problem.body")}
            </p>

            <p className="text-base font-medium text-[#33465A] mb-8">
              {t("problem.questionsIntro")}
            </p>

            <div className="flex flex-col gap-5">
              {questions.map((q, i) => (
                <p
                  key={i}
                  className="text-base font-semibold tracking-[-0.02em] leading-[1.4] text-[#0D1B2B] text-balance border-l-2 border-[#3AB5A0] pl-5 text-left"
                >
                  {q}
                </p>
              ))}
            </div>
          </div>

          <div className="flex justify-center lg:justify-end pr-0 lg:pr-12">
            <PhoneNavShowcase />
          </div>
        </div>
      </section>

      {/* ── Section 3: Interactive Demo entry ────────────────────── */}
      <section className="py-14 md:py-20 bg-[#0A1825] border-b border-[#1E3550]">
        <div className="max-w-3xl mx-auto px-6 text-center">

          <div className="inline-flex items-center gap-2 mb-8">
            <div className="w-1.5 h-1.5 rounded-full bg-[#3AB5A0]" />
            <span className="text-[11px] font-medium tracking-[0.2em] text-[#3AB5A0] uppercase">
              {t("liveDemo.badge")}
            </span>
          </div>

          <h2 className="text-5xl sm:text-6xl font-bold tracking-tight text-[#E8F0F8] leading-tight mb-6">
            <Lines text={t("liveDemo.title")} />
          </h2>

          <p className="text-xl text-[#7BA8C4] leading-relaxed max-w-xl mx-auto mb-12 font-light">
            {t("liveDemo.subtitle")}
          </p>

          <Link href="/demo/upload" className={CTA_CLASS}>
            {t("liveDemo.cta")}
          </Link>

          <p className="text-sm text-[#2E5070] mt-5 mb-8">
            {t("liveDemo.ctaNote")}
          </p>

          <CsvHelpPanel />
        </div>
      </section>

      {/* ── Section 4: Value Proposition ──────────────────────────── */}
      <section className="py-16 md:py-20 bg-[#F1F5F9] border-y border-[#E1E7EF]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="max-w-2xl mx-auto text-center mb-16">
            <h2 className="text-[2rem] sm:text-[2.5rem] font-semibold tracking-[-0.02em] text-[#0D1B2B] leading-[1.2] text-balance">
              <Lines text={t("valueProp.title")} />
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {valuePropItems.map((item, i) => {
              const isSecond = i === 1;
              const bg = isSecond ? "#D4A254" : "#4C7FEE";
              const shadowColor = isSecond ? "rgba(212,162,84,0.4)" : "rgba(76,127,238,0.4)";
              const number = String(i + 1).padStart(2, "0");

              if (isSecond) {
                return (
                  <MilestoneFlipCard
                    key={i}
                    number={number}
                    title={item.title}
                    body={item.body}
                    bg={bg}
                    shadowColor={shadowColor}
                    ctaLabel={valuePropDemo.cta}
                    timeline={{
                      heading: valuePropDemo.invoiceHeading,
                      project: valuePropDemo.project,
                      milestones: valuePropDemo.milestones,
                    }}
                  />
                );
              }

              if (i === 2) {
                return (
                  <TaxShieldFlipCard
                    key={i}
                    number={number}
                    title={item.title}
                    body={item.body}
                    bg={bg}
                    shadowColor={shadowColor}
                    ctaLabel={valuePropTaxDemo.cta}
                    breakdown={{
                      heading: valuePropTaxDemo.heading,
                      subtitle: valuePropTaxDemo.subtitle,
                      grossLabel: valuePropTaxDemo.grossLabel,
                      gross: valuePropTaxDemo.gross,
                      taxLabel: valuePropTaxDemo.taxLabel,
                      taxAmount: valuePropTaxDemo.taxAmount,
                      netLabel: valuePropTaxDemo.netLabel,
                      net: valuePropTaxDemo.net,
                    }}
                  />
                );
              }

              return (
                <div
                  key={i}
                  className="border rounded-2xl p-8 flex flex-col"
                  style={{ backgroundColor: bg, borderColor: bg, boxShadow: `0 8px 24px -8px ${shadowColor}` }}
                >
                  <span className="text-sm font-bold tabular-nums mb-4 text-white">
                    {number}
                  </span>
                  <p className="text-xl font-bold tracking-[-0.01em] leading-snug mb-3 text-white">
                    {item.title}
                  </p>
                  <p className="text-[15px] leading-relaxed text-white font-medium">
                    {item.body}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Section 5: Pricing / Alignment ────────────────────────── */}
      <section className="py-16 md:py-20 bg-[#132537] border-y border-[#1E3550]">
        <div className="max-w-[640px] mx-auto px-6 text-center">

          <p className="text-xs font-semibold tracking-[0.24em] uppercase text-[#3AB5A0] mb-8">
            {t("pricing.eyebrow")}
          </p>

          <h2 className="text-4xl sm:text-5xl font-bold tracking-[-0.03em] text-[#E8F0F8] leading-[1.14] mb-8 text-balance">
            {t("pricing.title")}
          </h2>

          <p className="text-[17px] sm:text-[19px] font-light tracking-[-0.005em] leading-[1.65] text-[#7BA8C4] mb-6">
            {t("pricing.body1")}
          </p>

          <p className="text-[17px] sm:text-[19px] font-light tracking-[-0.005em] leading-[1.65] text-[#7BA8C4] mb-12">
            {t("pricing.body2")}
          </p>

          <div className="w-7 h-px bg-[#1E3550] mx-auto mb-12" />

          <p className="text-2xl sm:text-3xl font-bold tracking-[-0.02em] leading-[1.3] text-[#3AB5A0] text-balance">
            {t("pricing.highlight")}
          </p>
        </div>
      </section>

      {/* ── Section 6: Final CTA ──────────────────────────────────── */}
      <section className="py-14 md:py-20 bg-[#F1ECE2]">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <h2 className="text-4xl sm:text-5xl font-bold tracking-[-0.03em] text-[#0D1B2B] leading-[1.14] mb-6 text-balance">
            {t("finalCta.title")}
          </h2>
          <p className="text-lg text-[#5B5346] leading-relaxed mb-10 font-light">
            {t("finalCta.body")}
          </p>
          <Link href="/signup" className={CTA_CLASS}>
            {t("finalCta.cta")}
          </Link>
        </div>
      </section>

      {/* ── Section 7: Footer / Legal ─────────────────────────────── */}
      <footer className="border-t border-[#1E3550] bg-[#0D1B2B] py-10">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">

            <div>
              <p className="font-bold text-[#E8F0F8] text-lg mb-1">Nonodia</p>
              <p className="text-sm text-[#4A7A9B]">{t("footer.tagline")}</p>
            </div>

            <nav className="flex flex-wrap items-center justify-center gap-2 text-sm text-[#4A7A9B]">
              <Link href="/data-privacy" className="hover:text-[#7BA8C4] transition-colors px-2 py-1">
                {t("footer.privacyPolicy")}
              </Link>
              <span className="text-[#1E3550]">·</span>
              <Link href="/terms-of-service" className="hover:text-[#7BA8C4] transition-colors px-2 py-1">
                {t("footer.termsOfService")}
              </Link>
              <span className="text-[#1E3550]">·</span>
              <Link href="/data-privacy" className="hover:text-[#7BA8C4] transition-colors px-2 py-1">
                {t("footer.dataPrivacy")}
              </Link>
            </nav>

            <div className="flex items-center gap-4">
              <LanguageSwitcher />
              <span className="text-sm text-[#4A7A9B]">{t("footer.copyright")}</span>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}
