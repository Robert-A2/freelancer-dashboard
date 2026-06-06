import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function LandingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-[#0A1020] text-[#F8FAFC]">

      {/* ── Navbar ─────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 border-b border-[#1E293B] bg-[#0A1020]/95 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
          <span className="font-bold text-[#F8FAFC] tracking-tight">Freelancer OS</span>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-[#94A3B8] hover:text-[#F8FAFC] transition-colors px-3 py-2">
              Sign in
            </Link>
            <Link href="/signup" className="bg-[#14B8A6] hover:bg-[#0D9488] text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
              Get started free
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-16 pb-20 md:pt-24 md:pb-28">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">

          <div>
            <div className="inline-flex items-center gap-2 bg-[#14B8A620] border border-[#14B8A630] rounded-full px-3 py-1 mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-[#14B8A6]" />
              <span className="text-xs text-[#14B8A6] font-medium">Built for freelancers</span>
            </div>

            <h1 className="text-4xl sm:text-5xl font-bold leading-tight text-[#F8FAFC] mb-5">
              Finally understand<br className="hidden sm:block" /> where your money goes.
            </h1>

            <p className="text-lg text-[#94A3B8] leading-relaxed mb-8 max-w-lg">
              Upload your bank statement and get a complete financial insight.
              what happened, why it happened, and what to do next.
              In minutes, not spreadsheets.
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <Link href="/signup" className="bg-[#14B8A6] hover:bg-[#0D9488] text-white font-bold px-6 py-3 rounded-xl transition-colors text-base text-center">
                Upload your first CSV →
              </Link>
              <Link href="/login" className="text-sm text-[#94A3B8] hover:text-[#F8FAFC] transition-colors flex items-center justify-center px-4 py-3">
                Already have an account? Sign in
              </Link>
            </div>

            <p className="text-xs text-[#94A3B8] mt-4">
              Free · Any bank · Any CSV format
            </p>
          </div>

          <div className="relative">
            <DashboardMockup />
          </div>
        </div>
      </section>

      {/* ── What you'll understand ─────────────────────────────────────── */}
      <section className="bg-[#111827] border-y border-[#1E293B]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 md:py-20">
          <div className="text-center mb-12">
            <p className="text-xs font-medium text-[#14B8A6] uppercase tracking-widest mb-3">After one upload</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#F8FAFC]">
              Real answers. Not just numbers.
            </h2>
            <p className="text-[#94A3B8] mt-3 max-w-xl mx-auto">
              Freelancer OS explains your finances in plain language. The questions
              you actually ask, answered automatically.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                icon: "💰",
                title: "What happened this month",
                body: "Income vs expenses vs your historical average. Know immediately if this was a strong month or a difficult one.",
              },
              {
                icon: "📊",
                title: "Where your money is going",
                body: "Every transaction categorised automatically. Subscriptions, tools, travel, taxes, visible in one clear view.",
              },
              {
                icon: "🔮",
                title: "What is coming next",
                body: "Cashflow forecasts built from your actual patterns. Know if next month looks tight before it arrives.",
              },
              {
                icon: "💡",
                title: "What to do about it",
                body: "Specific recommendations based on your real numbers. Not generic advice. Actions from your own financial data.",
              },
            ].map((card) => (
              <div key={card.title} className="bg-[#0A1020] rounded-2xl p-6 border border-[#1E293B]">
                <div className="text-3xl mb-4">{card.icon}</div>
                <h3 className="font-semibold text-[#F8FAFC] mb-2 text-sm">{card.title}</h3>
                <p className="text-sm text-[#94A3B8] leading-relaxed">{card.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ───────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 md:py-20">
        <div className="text-center mb-12">
          <p className="text-xs font-medium text-[#14B8A6] uppercase tracking-widest mb-3">Simple process</p>
          <h2 className="text-2xl sm:text-3xl font-bold text-[#F8FAFC]">How it works</h2>
          <p className="text-[#94A3B8] mt-3 max-w-md mx-auto">
            From bank statement to financial clarity in under a minute.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          <div className="hidden md:block absolute top-8 left-[calc(33%+1rem)] right-[calc(33%+1rem)] h-px bg-[#1E293B]" />
          {[
            {
              step: "01",
              title: "Upload your CSV",
              body: "Export from any bank: Revolut, Monzo, AIB, HSBC, Wise, or any bank worldwide. Columns and formats detected automatically.",
            },
            {
              step: "02",
              title: "We do the analysis",
              body: "Transactions categorised, patterns detected, forecasts generated. Your complete financial picture appears in seconds.",
            },
            {
              step: "03",
              title: "You understand your money",
              body: "Clear answers to the questions freelancers actually ask. What is my cashflow? Am I growing? What should I cut?",
            },
          ].map((s) => (
            <div key={s.step} className="relative text-center">
              <div className="w-16 h-16 bg-[#14B8A620] border border-[#14B8A630] rounded-2xl flex items-center justify-center mx-auto mb-4">
                <span className="text-lg font-bold text-[#14B8A6]">{s.step}</span>
              </div>
              <h3 className="font-semibold text-[#F8FAFC] mb-2">{s.title}</h3>
              <p className="text-sm text-[#94A3B8] leading-relaxed max-w-xs mx-auto">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Historical intelligence ────────────────────────────────────── */}
      <section className="bg-[#111827] border-y border-[#1E293B]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 md:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

            {/* Left: copy */}
            <div>
              <p className="text-xs font-medium text-[#14B8A6] uppercase tracking-widest mb-3">Deep history</p>
              <h2 className="text-2xl sm:text-3xl font-bold text-[#F8FAFC] mb-4">
                The more history you upload,<br className="hidden sm:block" /> the smarter it gets.
              </h2>
              <p className="text-[#94A3B8] leading-relaxed mb-6">
                Upload 1 year, 5 years, or 10+ years of bank statements.
                Freelancer OS builds one continuous financial timeline and
                automatically identifies patterns, seasonal income cycles, spending
                habits, and long-term changes, far more than you could ever
                spot manually.
              </p>
              <ul className="space-y-3">
                {[
                  "Seasonal income patterns and quiet periods",
                  "Year-over-year business growth or decline",
                  "Your strongest quarters and your weakest",
                  "Long-term spending trends by category",
                  "Recurring expense cycles you may not have noticed",
                ].map((point) => (
                  <li key={point} className="flex items-start gap-3">
                    <span className="text-[#14B8A6] flex-shrink-0 mt-0.5">✓</span>
                    <span className="text-sm text-[#CBD5E1]">{point}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Right: tier cards */}
            <div className="space-y-3">
              {[
                {
                  label: "1 year",
                  title: "Monthly patterns",
                  body: "Income trends, expense categories, cashflow health, and your first forecast.",
                  intensity: "opacity-50",
                },
                {
                  label: "5 years",
                  title: "Seasonal cycles",
                  body: "Which months are consistently strong. Which are slow. How your business has grown year by year.",
                  intensity: "opacity-75",
                },
                {
                  label: "10+ years",
                  title: "Your complete financial journey",
                  body: "Long-term trends, major financial shifts, and patterns that only become visible across a decade of data.",
                  intensity: "opacity-100",
                },
              ].map((tier) => (
                <div
                  key={tier.label}
                  className="flex items-start gap-4 bg-[#0A1020] rounded-2xl p-5 border border-[#1E293B]"
                >
                  <div className="flex-shrink-0 w-14 h-14 bg-[#14B8A610] border border-[#14B8A625] rounded-xl flex items-center justify-center">
                    <span className={`text-xs font-bold text-[#14B8A6] text-center leading-tight ${tier.intensity}`}>
                      {tier.label}
                    </span>
                  </div>
                  <div>
                    <p className="font-semibold text-[#F8FAFC] text-sm mb-1">{tier.title}</p>
                    <p className="text-xs text-[#94A3B8] leading-relaxed">{tier.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Why freelancers ────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 md:py-20">
        <div className="text-center mb-12">
          <p className="text-xs font-medium text-[#14B8A6] uppercase tracking-widest mb-3">Built for how you work</p>
          <h2 className="text-2xl sm:text-3xl font-bold text-[#F8FAFC]">
            Why freelancers use Freelancer OS
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {[
            {
              title: "Irregular income",
              points: [
                "Some months are great. Some are not.",
                "Track your income patterns and spot slow periods before they hit.",
                "Plan ahead instead of reacting.",
              ],
            },
            {
              title: "Variable expenses",
              points: [
                "Tools, subscriptions, and costs change constantly.",
                "See what is growing, what you can cut, and what it means for cashflow.",
              ],
            },
            {
              title: "Cashflow uncertainty",
              points: [
                "Know if next month looks safe before it arrives.",
                "Forecasts built from your actual history, not industry averages.",
              ],
            },
            {
              title: "Long-term visibility",
              points: [
                "Is your business growing or shrinking?",
                "See the full trajectory across months and years, not just this month.",
              ],
            },
          ].map((item) => (
            <div key={item.title} className="bg-[#111827] rounded-2xl p-6 border border-[#1E293B]">
              <div className="w-6 h-0.5 bg-[#14B8A6] rounded-full mb-4" />
              <h3 className="font-semibold text-[#F8FAFC] mb-3">{item.title}</h3>
              <ul className="space-y-2">
                {item.points.map((p) => (
                  <li key={p} className="text-sm text-[#94A3B8] leading-snug">{p}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* ── Privacy & trust ────────────────────────────────────────────── */}
      <section className="bg-[#111827] border-y border-[#1E293B]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 md:py-20">
          <div className="text-center mb-10">
            <p className="text-xs font-medium text-[#14B8A6] uppercase tracking-widest mb-3">Your data</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#F8FAFC]">Private. Secure. Yours.</h2>
            <p className="text-[#94A3B8] mt-3 max-w-md mx-auto">
              Your financial data is personal. We treat it that way.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-4xl mx-auto">
            {[
              { icon: "🔒", title: "Bank-level encryption", body: "All data encrypted in transit and at rest." },
              { icon: "🚫", title: "Never sold", body: "We never sell, share, or use your data for advertising." },
              { icon: "🗑️", title: "Delete anytime", body: "Remove your account and all data permanently with one click." },
              { icon: "🛡️", title: "No third-party tracking", body: "Your financial data stays on our servers only." },
            ].map((t) => (
              <div key={t.title} className="bg-[#0A1020] rounded-2xl p-5 border border-[#1E293B] text-center">
                <div className="text-2xl mb-3">{t.icon}</div>
                <h3 className="text-sm font-semibold text-[#F8FAFC] mb-1">{t.title}</h3>
                <p className="text-xs text-[#94A3B8]">{t.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ──────────────────────────────────────────────────── */}
      <section className="bg-[#14B8A6]">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-16 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
            Start understanding your finances today.
          </h2>
          <p className="text-[#ccfbf1] mb-8 text-lg">
            Upload your first bank statement in under a minute.<br className="hidden sm:block" />
            No setup. No spreadsheets. Just clarity.
          </p>
          <Link
            href="/signup"
            className="inline-block bg-white text-[#0D9488] font-bold px-8 py-3.5 rounded-xl hover:bg-[#f0fdfa] transition-colors text-base"
          >
            Get started free →
          </Link>
          <p className="text-xs text-[#99f6e4] mt-4">Free · Any bank · Takes 60 seconds</p>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer className="border-t border-[#1E293B] bg-[#0A1020]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <span className="font-bold text-[#F8FAFC] text-sm">Freelancer OS</span>
            <p className="text-xs text-[#94A3B8] mt-0.5">Financial clarity built for freelancers</p>
          </div>
          <div className="flex items-center gap-6 text-xs text-[#94A3B8]">
            <Link href="/login"  className="hover:text-[#F8FAFC] transition-colors">Sign in</Link>
            <Link href="/signup" className="hover:text-[#F8FAFC] transition-colors">Create account</Link>
          </div>
        </div>
      </footer>

    </div>
  );
}

// ── Dashboard preview mockup ────────────────────────────────────────────────
function DashboardMockup() {
  return (
    <div className="rounded-2xl border border-[#1E293B] bg-[#111827] overflow-hidden shadow-2xl shadow-black/50">

      {/* Mini top bar */}
      <div className="h-9 bg-[#0A1020] border-b border-[#1E293B] flex items-center px-3 gap-3">
        <span className="text-[10px] font-bold text-[#F8FAFC]">Freelancer OS</span>
        <div className="flex gap-1.5">
          {["Dashboard", "History", "Forecast"].map((l) => (
            <span key={l} className="text-[9px] text-[#94A3B8] px-2 py-0.5 rounded bg-[#1E293B]">{l}</span>
          ))}
        </div>
      </div>

      <div className="p-4 space-y-3">

        {/* 4 metric cards */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "Income",   value: "€4,850", color: "#22C55E" },
            { label: "Expenses", value: "€2,680", color: "#F59E0B" },
            { label: "Savings",  value: "€800",   color: "#3B82F6" },
            { label: "Cashflow", value: "€1,370", color: "#06B6D4" },
          ].map((c) => (
            <div key={c.label} className="bg-[#0A1020] rounded-xl p-2.5">
              <div className="text-[8px] text-[#94A3B8] uppercase tracking-wide mb-1">{c.label}</div>
              <div className="text-sm font-bold" style={{ color: c.color }}>{c.value}</div>
            </div>
          ))}
        </div>

        {/* Mini chart */}
        <div className="bg-[#0A1020] rounded-xl p-3">
          <div className="text-[8px] text-[#94A3B8] mb-2">Income vs Expenses, 12 months</div>
          <svg viewBox="0 0 240 52" className="w-full" preserveAspectRatio="none">
            <line x1="0" y1="13" x2="240" y2="13" stroke="#1E293B" strokeWidth="0.5"/>
            <line x1="0" y1="26" x2="240" y2="26" stroke="#1E293B" strokeWidth="0.5"/>
            <line x1="0" y1="39" x2="240" y2="39" stroke="#1E293B" strokeWidth="0.5"/>
            <polyline
              points="0,42 20,38 40,40 60,32 80,34 100,26 120,28 140,20 160,22 180,14 200,16 240,10"
              fill="none" stroke="#22C55E" strokeWidth="1.5" strokeLinejoin="round"
            />
            <polyline
              points="0,46 20,44 40,45 60,44 80,46 100,42 120,43 140,40 160,44 180,40 200,42 240,41"
              fill="none" stroke="#F59E0B" strokeWidth="1.5" strokeLinejoin="round"
            />
          </svg>
        </div>

        {/* Intelligence insight — shows the product explains numbers, not just displays them */}
        <div className="bg-[#F59E0B0d] border border-[#F59E0B25] rounded-xl p-3 space-y-2">
          <div className="flex items-center gap-1.5">
            <span className="text-[#F59E0B] text-[10px]">⚠</span>
            <span className="text-[9px] font-semibold text-[#F59E0B]">Expenses increased 14% this month.</span>
          </div>
          <div className="space-y-1 pl-3 border-l border-[#1E293B]">
            <div className="text-[8px] text-[#94A3B8]">
              <span className="text-[#CBD5E1]">Main cause:</span> Software subscriptions increased by €82.
            </div>
            <div className="text-[8px] text-[#94A3B8]">
              <span className="text-[#14B8A6]">Recommended:</span> Reducing unused subscriptions could improve annual cashflow by €984.
            </div>
          </div>
        </div>

        {/* Forecast row */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-[#14B8A60a] border border-[#14B8A618] rounded-xl p-2.5">
            <div className="text-[8px] text-[#94A3B8] mb-1">Next month forecast</div>
            <div className="text-xs font-bold text-[#06B6D4]">€1,890 cashflow</div>
          </div>
          <div className="bg-[#0A1020] rounded-xl p-2.5">
            <div className="text-[8px] text-[#94A3B8] mb-1">Annual projection</div>
            <div className="text-xs font-bold text-[#22C55E]">€22,680</div>
          </div>
        </div>

      </div>
    </div>
  );
}
