import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import LanguageSwitcher from "@/components/ui/LanguageSwitcher";
import ProductWalkthrough, { type WalkthroughStep, type WalkthroughSample } from "@/components/landing/ProductWalkthrough";

export default async function LandingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  const t = await getTranslations("landing");
  const tc = await getTranslations("common");

  const understandCards = t.raw("understand.cards") as { title: string; body: string }[];
  const understandIcons = ["💰", "📊", "🔮", "💡"];

  const recognitionItems = t.raw("recognition.items") as string[];

  const walkthroughSteps = t.raw("walkthrough.steps") as WalkthroughStep[];
  const walkthroughSample = t.raw("walkthrough.sample") as WalkthroughSample;

  const historyPoints = t.raw("history.points") as string[];
  const historyTiers = t.raw("history.tiers") as { label: string; title: string; body: string }[];
  const tierIntensities = ["opacity-50", "opacity-75", "opacity-100"];

  const philosophyItems = t.raw("philosophy.items") as { title: string; body: string }[];

  const privacyItems = t.raw("privacy.items") as { title: string; body: string }[];
  const privacyIcons = ["🔒", "🚫", "🔄", "🗑️", "🛡️", "🌱"];

  return (
    <div className="min-h-screen bg-[#0D1B2B] text-[#E8F0F8]">

      {/* ── Navbar ──────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 border-b border-[#1E3550] bg-[#0D1B2B]/95 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-3 sm:px-6 flex items-center justify-between h-14 gap-2">
          <span className="font-bold text-[#E8F0F8] tracking-tight text-sm sm:text-base shrink-0">{tc("appName")}</span>
          <div className="flex items-center gap-1.5 sm:gap-3">
            <LanguageSwitcher />
            <Link href="/login" className="text-xs sm:text-sm text-[#7BA8C4] hover:text-[#E8F0F8] transition-colors px-1.5 sm:px-3 py-2 whitespace-nowrap">
              {tc("buttons.signIn")}
            </Link>
            <Link href="/signup" className="bg-[#3AB5A0] hover:bg-[#2E9D8A] text-[#0D1B2B] text-xs sm:text-sm font-semibold px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-xl transition-colors whitespace-nowrap">
              {tc("buttons.getStarted")}
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-16 pb-20 md:pt-24 md:pb-28">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">

          <div>
            <div className="inline-flex items-center gap-2 bg-[#3AB5A020] border border-[#3AB5A030] rounded-full px-3 py-1 mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-[#3AB5A0]" />
              <span className="text-xs text-[#3AB5A0] font-medium">{t("hero.badge")}</span>
            </div>

            <h1 className="text-4xl sm:text-5xl font-bold leading-tight text-[#E8F0F8] mb-5">
              {t("hero.title")}
            </h1>

            <p className="text-lg text-[#7BA8C4] leading-relaxed mb-8 max-w-lg">
              {t("hero.subtitle")}
            </p>

            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <Link href="/signup" className="bg-[#3AB5A0] hover:bg-[#2E9D8A] text-[#0D1B2B] font-bold px-6 py-3 rounded-xl transition-colors text-base text-center">
                {t("hero.cta")}
              </Link>
              <Link href="/login" className="text-sm text-[#7BA8C4] hover:text-[#E8F0F8] transition-colors flex items-center justify-center px-4 py-3">
                {t("hero.alreadyHaveAccount")}
              </Link>
            </div>

            <p className="text-xs text-[#7BA8C4] mb-5">
              {t("hero.tagline")}
            </p>

            {/* Trust strip */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[#6A97B4]">
              <span className="flex items-center gap-1.5">🔒 {t("hero.trust.encrypted")}</span>
              <span className="flex items-center gap-1.5">🚫 {t("hero.trust.neverSold")}</span>
              <span className="flex items-center gap-1.5">🗑️ {t("hero.trust.deleteAnytime")}</span>
            </div>
          </div>

          <div className="relative">
            <h2 className="sr-only">{t("walkthrough.title")}</h2>
            <p className="text-xs font-medium text-[#3AB5A0] uppercase tracking-widest mb-3 text-center lg:text-left">
              {t("walkthrough.eyebrow")}
            </p>
            <ProductWalkthrough steps={walkthroughSteps} sample={walkthroughSample} />
            <p className="text-xs text-[#6A97B4] mt-3 text-center lg:text-left">
              {t("walkthrough.caption")}
            </p>
          </div>
        </div>
      </section>

      {/* ── You know this feeling ──────────────────────────────────────── */}
      <section className="bg-[#132537] border-y border-[#1E3550]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 md:py-20">
          <div className="text-center mb-10">
            <p className="text-xs font-medium text-[#3AB5A0] uppercase tracking-widest mb-3">{t("recognition.eyebrow")}</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#E8F0F8] mb-3">
              {t("recognition.title")}
            </h2>
            <p className="text-[#7BA8C4] max-w-2xl mx-auto leading-relaxed">
              {t("recognition.body")}
            </p>
          </div>

          <div className="max-w-2xl mx-auto space-y-3">
            {recognitionItems.map((item) => (
              <div key={item} className="flex items-start gap-3 bg-[#0D1B2B] border border-[#1E3550] rounded-xl px-4 py-3.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#3AB5A0] flex-shrink-0 mt-2" />
                <p className="text-sm text-[#A8C6E0] leading-relaxed">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── What you'll understand ──────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 md:py-20">
        <div className="text-center mb-12">
          <p className="text-xs font-medium text-[#3AB5A0] uppercase tracking-widest mb-3">{t("understand.eyebrow")}</p>
          <h2 className="text-2xl sm:text-3xl font-bold text-[#E8F0F8]">
            {t("understand.title")}
          </h2>
          <p className="text-[#7BA8C4] mt-3 max-w-xl mx-auto">
            {t("understand.subtitle")}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {understandCards.map((card, i) => (
            <div key={card.title} className="bg-[#132537] rounded-2xl p-6 border border-[#1E3550]">
              <div className="text-3xl mb-4">{understandIcons[i]}</div>
              <h3 className="font-semibold text-[#E8F0F8] mb-2 text-sm">{card.title}</h3>
              <p className="text-sm text-[#7BA8C4] leading-relaxed">{card.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Why this exists (philosophy) ──────────────────────────────────── */}
      <section className="bg-[#132537] border-y border-[#1E3550]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 md:py-20">
          <div className="text-center mb-12">
            <p className="text-xs font-medium text-[#3AB5A0] uppercase tracking-widest mb-3">{t("philosophy.eyebrow")}</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#E8F0F8] mb-3">
              {t("philosophy.title")}
            </h2>
            <p className="text-[#7BA8C4] max-w-md mx-auto">
              {t("philosophy.subtitle")}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {philosophyItems.map((item) => (
              <div key={item.title} className="bg-[#0D1B2B] rounded-2xl p-6 border border-[#1E3550]">
                <div className="w-6 h-0.5 bg-[#3AB5A0] rounded-full mb-4" />
                <h3 className="font-semibold text-[#E8F0F8] mb-3 leading-snug">{item.title}</h3>
                <p className="text-sm text-[#7BA8C4] leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Historical intelligence ──────────────────────────────────────── */}
      <section>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 md:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

            <div>
              <p className="text-xs font-medium text-[#3AB5A0] uppercase tracking-widest mb-3">{t("history.eyebrow")}</p>
              <h2 className="text-2xl sm:text-3xl font-bold text-[#E8F0F8] mb-4">
                {t("history.title")}
              </h2>
              <p className="text-[#7BA8C4] leading-relaxed mb-6">
                {t("history.body")}
              </p>
              <ul className="space-y-3">
                {historyPoints.map((point) => (
                  <li key={point} className="flex items-start gap-3">
                    <span className="text-[#3AB5A0] flex-shrink-0 mt-0.5">✓</span>
                    <span className="text-sm text-[#A8C6E0]">{point}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-3">
              {historyTiers.map((tier, i) => (
                <div
                  key={tier.label}
                  className="flex items-start gap-4 bg-[#132537] rounded-2xl p-5 border border-[#1E3550]"
                >
                  <div className="flex-shrink-0 w-14 h-14 bg-[#3AB5A010] border border-[#3AB5A025] rounded-xl flex items-center justify-center">
                    <span className={`text-xs font-bold text-[#3AB5A0] text-center leading-tight ${tierIntensities[i]}`}>
                      {tier.label}
                    </span>
                  </div>
                  <div>
                    <p className="font-semibold text-[#E8F0F8] text-sm mb-1">{tier.title}</p>
                    <p className="text-xs text-[#7BA8C4] leading-relaxed">{tier.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Privacy & trust ─────────────────────────────────────────────── */}
      <section className="bg-[#132537] border-y border-[#1E3550]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 md:py-20">
          <div className="text-center mb-10">
            <p className="text-xs font-medium text-[#3AB5A0] uppercase tracking-widest mb-3">{t("privacy.eyebrow")}</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#E8F0F8]">{t("privacy.title")}</h2>
            <p className="text-[#7BA8C4] mt-3 max-w-md mx-auto">
              {t("privacy.subtitle")}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
            {privacyItems.map((item, i) => (
              <div key={item.title} className="bg-[#0D1B2B] rounded-2xl p-5 border border-[#1E3550] text-center">
                <div className="text-2xl mb-3">{privacyIcons[i]}</div>
                <h3 className="text-sm font-semibold text-[#E8F0F8] mb-1">{item.title}</h3>
                <p className="text-xs text-[#7BA8C4]">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ───────────────────────────────────────────────────── */}
      <section className="bg-[#3AB5A0]">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-16 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-[#0D1B2B] mb-4">
            {t("finalCta.title")}
          </h2>
          <p className="text-[#0D1B2B]/70 mb-8 text-lg">
            {t("finalCta.body")}
          </p>
          <Link
            href="/signup"
            className="inline-block bg-[#0D1B2B] text-[#3AB5A0] font-bold px-8 py-3.5 rounded-xl hover:bg-[#132537] transition-colors text-base"
          >
            {t("finalCta.cta")}
          </Link>
          <p className="text-[#0D1B2B]/60 text-xs mt-4">{t("finalCta.tagline")}</p>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="border-t border-[#1E3550] bg-[#0D1B2B]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <span className="font-bold text-[#E8F0F8] text-sm">{tc("appName")}</span>
            <p className="text-xs text-[#7BA8C4] mt-0.5">{t("footer.tagline")}</p>
          </div>
          <div className="flex items-center gap-6 text-xs text-[#7BA8C4]">
            <Link href="/login"  className="hover:text-[#E8F0F8] transition-colors">{tc("buttons.signIn")}</Link>
            <Link href="/signup" className="hover:text-[#E8F0F8] transition-colors">{tc("buttons.createAccount")}</Link>
          </div>
        </div>
      </footer>

    </div>
  );
}
