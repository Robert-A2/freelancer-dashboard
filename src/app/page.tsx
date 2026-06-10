import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import LanguageSwitcher from "@/components/ui/LanguageSwitcher";

export default async function LandingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  const t = await getTranslations("landing");
  const tc = await getTranslations("common");

  const understandCards = t.raw("understand.cards") as { title: string; body: string }[];
  const understandIcons = ["💰", "📊", "🔮", "💡"];

  const steps = t.raw("howItWorks.steps") as { title: string; body: string }[];

  const historyPoints = t.raw("history.points") as string[];
  const historyTiers = t.raw("history.tiers") as { label: string; title: string; body: string }[];
  const tierIntensities = ["opacity-50", "opacity-75", "opacity-100"];

  const whyItems = t.raw("whyFreelancers.items") as { title: string; points: string[] }[];

  const privacyItems = t.raw("privacy.items") as { title: string; body: string }[];
  const privacyIcons = ["🔒", "🚫", "🗑️", "🛡️"];

  return (
    <div className="min-h-screen bg-[#0D1B2B] text-[#E8F0F8]">

      {/* ── Navbar ──────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 border-b border-[#1E3550] bg-[#0D1B2B]/95 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
          <span className="font-bold text-[#E8F0F8] tracking-tight">{tc("appName")}</span>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <Link href="/login" className="text-sm text-[#7BA8C4] hover:text-[#E8F0F8] transition-colors px-3 py-2">
              {tc("buttons.signIn")}
            </Link>
            <Link href="/signup" className="bg-[#3AB5A0] hover:bg-[#2E9D8A] text-[#0D1B2B] text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
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

            <div className="flex flex-col sm:flex-row gap-3">
              <Link href="/signup" className="bg-[#3AB5A0] hover:bg-[#2E9D8A] text-[#0D1B2B] font-bold px-6 py-3 rounded-xl transition-colors text-base text-center">
                {t("hero.cta")}
              </Link>
              <Link href="/login" className="text-sm text-[#7BA8C4] hover:text-[#E8F0F8] transition-colors flex items-center justify-center px-4 py-3">
                {t("hero.alreadyHaveAccount")}
              </Link>
            </div>

            <p className="text-xs text-[#7BA8C4] mt-4">
              {t("hero.tagline")}
            </p>
          </div>

          <div className="relative">
            <DashboardMockup />
          </div>
        </div>
      </section>

      {/* ── What you'll understand ──────────────────────────────────────── */}
      <section className="bg-[#132537] border-y border-[#1E3550]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 md:py-20">
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
              <div key={card.title} className="bg-[#0D1B2B] rounded-2xl p-6 border border-[#1E3550]">
                <div className="text-3xl mb-4">{understandIcons[i]}</div>
                <h3 className="font-semibold text-[#E8F0F8] mb-2 text-sm">{card.title}</h3>
                <p className="text-sm text-[#7BA8C4] leading-relaxed">{card.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 md:py-20">
        <div className="text-center mb-12">
          <p className="text-xs font-medium text-[#3AB5A0] uppercase tracking-widest mb-3">{t("howItWorks.eyebrow")}</p>
          <h2 className="text-2xl sm:text-3xl font-bold text-[#E8F0F8]">{t("howItWorks.title")}</h2>
          <p className="text-[#7BA8C4] mt-3 max-w-md mx-auto">
            {t("howItWorks.subtitle")}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          <div className="hidden md:block absolute top-8 left-[calc(33%+1rem)] right-[calc(33%+1rem)] h-px bg-[#1E3550]" />
          {steps.map((s, i) => (
            <div key={s.title} className="relative text-center">
              <div className="w-16 h-16 bg-[#3AB5A020] border border-[#3AB5A030] rounded-2xl flex items-center justify-center mx-auto mb-4">
                <span className="text-lg font-bold text-[#3AB5A0]">{String(i + 1).padStart(2, "0")}</span>
              </div>
              <h3 className="font-semibold text-[#E8F0F8] mb-2">{s.title}</h3>
              <p className="text-sm text-[#7BA8C4] leading-relaxed max-w-xs mx-auto">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Historical intelligence ──────────────────────────────────────── */}
      <section className="bg-[#132537] border-y border-[#1E3550]">
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
                  className="flex items-start gap-4 bg-[#0D1B2B] rounded-2xl p-5 border border-[#1E3550]"
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

      {/* ── Why freelancers ─────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 md:py-20">
        <div className="text-center mb-12">
          <p className="text-xs font-medium text-[#3AB5A0] uppercase tracking-widest mb-3">{t("whyFreelancers.eyebrow")}</p>
          <h2 className="text-2xl sm:text-3xl font-bold text-[#E8F0F8]">
            {t("whyFreelancers.title")}
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {whyItems.map((item) => (
            <div key={item.title} className="bg-[#132537] rounded-2xl p-6 border border-[#1E3550]">
              <div className="w-6 h-0.5 bg-[#3AB5A0] rounded-full mb-4" />
              <h3 className="font-semibold text-[#E8F0F8] mb-3">{item.title}</h3>
              <ul className="space-y-2">
                {item.points.map((p) => (
                  <li key={p} className="text-sm text-[#7BA8C4] leading-snug">{p}</li>
                ))}
              </ul>
            </div>
          ))}
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

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-4xl mx-auto">
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

// ── Dashboard preview mockup ──────────────────────────────────────────────────
async function DashboardMockup() {
  const t = await getTranslations("landing.mockup");
  const tc = await getTranslations("common");

  const metrics = [
    { label: t("income"),   value: "€4,850", color: "#4CC4A4" },
    { label: t("expenses"), value: "€2,680", color: "#D4A254" },
    { label: t("savings"),  value: "€800",   color: "#3AB5A0" },
    { label: t("cashflow"), value: "€1,370", color: "#4CC4A4" },
  ];

  return (
    <div className="rounded-2xl border border-[#1E3550] bg-[#132537] overflow-hidden shadow-2xl shadow-black/50">

      {/* Mini top bar */}
      <div className="h-9 bg-[#0D1B2B] border-b border-[#1E3550] flex items-center px-3 gap-3">
        <span className="text-[10px] font-bold text-[#E8F0F8]">{tc("appName")}</span>
        <div className="flex gap-1.5">
          {[tc("nav.dashboard"), tc("nav.history"), tc("nav.forecast")].map((l) => (
            <span key={l} className="text-[9px] text-[#7BA8C4] px-2 py-0.5 rounded bg-[#1E3550]">{l}</span>
          ))}
        </div>
      </div>

      <div className="p-4 space-y-3">

        {/* 4 metric cards */}
        <div className="grid grid-cols-2 gap-2">
          {metrics.map((c) => (
            <div key={c.label} className="bg-[#0D1B2B] rounded-xl p-2.5">
              <div className="text-[8px] text-[#7BA8C4] uppercase tracking-wide mb-1">{c.label}</div>
              <div className="text-sm font-bold" style={{ color: c.color }}>{c.value}</div>
            </div>
          ))}
        </div>

        {/* Mini chart */}
        <div className="bg-[#0D1B2B] rounded-xl p-3">
          <div className="text-[8px] text-[#7BA8C4] mb-2">{t("incomeVsExpenses")}</div>
          <svg viewBox="0 0 240 52" className="w-full" preserveAspectRatio="none">
            <line x1="0" y1="13" x2="240" y2="13" stroke="#1E3550" strokeWidth="0.5"/>
            <line x1="0" y1="26" x2="240" y2="26" stroke="#1E3550" strokeWidth="0.5"/>
            <line x1="0" y1="39" x2="240" y2="39" stroke="#1E3550" strokeWidth="0.5"/>
            <polyline
              points="0,42 20,38 40,40 60,32 80,34 100,26 120,28 140,20 160,22 180,14 200,16 240,10"
              fill="none" stroke="#4CC4A4" strokeWidth="1.5" strokeLinejoin="round"
            />
            <polyline
              points="0,46 20,44 40,45 60,44 80,46 100,42 120,43 140,40 160,44 180,40 200,42 240,41"
              fill="none" stroke="#D4A254" strokeWidth="1.5" strokeLinejoin="round"
            />
          </svg>
        </div>

        {/* Intelligence insight */}
        <div className="bg-[#D4A2540A] border border-[#D4A25425] rounded-xl p-3 space-y-2">
          <div className="flex items-center gap-1.5">
            <span className="text-[#D4A254] text-[10px]">⚠</span>
            <span className="text-[9px] font-semibold text-[#D4A254]">{t("expensesIncreased")}</span>
          </div>
          <div className="space-y-1 pl-3 border-l border-[#1E3550]">
            <div className="text-[8px] text-[#7BA8C4]">
              <span className="text-[#A8C6E0]">{t("mainCause")}</span> {t("mainCauseBody")}
            </div>
            <div className="text-[8px] text-[#7BA8C4]">
              <span className="text-[#3AB5A0]">{t("recommended")}</span> {t("recommendedBody")}
            </div>
          </div>
        </div>

        {/* Forecast row */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-[#3AB5A00A] border border-[#3AB5A018] rounded-xl p-2.5">
            <div className="text-[8px] text-[#7BA8C4] mb-1">{t("nextMonthForecast")}</div>
            <div className="text-xs font-bold text-[#3AB5A0]">{t("nextMonthCashflow")}</div>
          </div>
          <div className="bg-[#0D1B2B] rounded-xl p-2.5">
            <div className="text-[8px] text-[#7BA8C4] mb-1">{t("annualProjection")}</div>
            <div className="text-xs font-bold text-[#4CC4A4]">{t("annualProjectionValue")}</div>
          </div>
        </div>

      </div>
    </div>
  );
}
