import { getTranslations, getLocale } from "next-intl/server";
import { formatCurrency } from "@/utils/finance";
import { INTL_LOCALES, type Locale } from "@/i18n/locales";

const IconSettings = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);
const IconHome = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="m3 12 2-2m0 0 7-7 7 7M5 10v10a1 1 0 001 1h3m10-11 2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
  </svg>
);
const IconUpload = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
  </svg>
);
const IconHistory = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);
const IconAnalytics = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
  </svg>
);
const IconForecast = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
  </svg>
);
const IconClients = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
  </svg>
);

// Matches the real Navbar's mobile bottom nav — Dashboard is the active tab
// since this mockup shows the dashboard's account/coverage view.
const BOTTOM_NAV = [
  { key: "dashboard", Icon: IconHome },
  { key: "upload", Icon: IconUpload },
  { key: "clients", Icon: IconClients },
  { key: "analytics", Icon: IconAnalytics },
  { key: "forecast", Icon: IconForecast },
] as const;

// Three uploaded accounts, styled after the real AccountFilterBar's
// colored-dot pills — named after real banks freelancers actually use.
const ACCOUNTS = [
  { name: "Revolut Savings", color: "#4CC4A4" },
  { name: "N26 Payments", color: "#7BA8C4" },
  { name: "Deutsche Bank", color: "#D4A254" },
];

// A long real-looking history (Jan 2015 – Jul 2026) to make the point that
// years of banking history, not just a recent CSV, is what gets understood.
const COVERAGE_FROM = new Date(Date.UTC(2015, 0, 1));
const COVERAGE_TO   = new Date(Date.UTC(2026, 6, 1));
const COVERAGE_YEARS = 11;
const COVERAGE_REMAINDER_MONTHS = 6;
const COVERAGE_COUNT = 1440;

// Figures scaled to fit the "All accounts, 11.5 years" narrative — three
// combined accounts over that long a span read as bigger, and expenses
// carry more real weight than a single thin month would show.
const INCOME = 5200;
const EXPENSES = 3480;

export default async function AccountsPhone() {
  const t = await getTranslations("common");
  const tFilter = await getTranslations("dashboard.accountFilter");
  const tCoverage = await getTranslations("dashboard.dataCoverage");
  const tMetrics = await getTranslations("metrics");
  const locale = (await getLocale()) as Locale;

  const span = tCoverage("yearsAndMonths", { years: COVERAGE_YEARS, months: COVERAGE_REMAINDER_MONTHS });
  const fmtMonth = (d: Date) => d.toLocaleDateString(INTL_LOCALES[locale], { month: "long", year: "numeric", timeZone: "UTC" });
  const rangeLabel = `${fmtMonth(COVERAGE_FROM)} – ${fmtMonth(COVERAGE_TO)}`;

  const income   = INCOME;
  const expenses = EXPENSES;
  const cashflow = income - expenses;
  const marginPct = Math.round((cashflow / income) * 100);

  return (
    <div className="flex justify-center">
      {/* Phone frame — normal handset proportions, not stretched wide */}
      <div className="w-72 bg-[#0D1B2B] rounded-[44px] border-2 border-[#243F5E] shadow-2xl shadow-black/70 overflow-hidden">

        {/* Dynamic island */}
        <div className="bg-[#132537] border-b border-[#1E3550] flex justify-center py-3">
          <div className="w-24 h-6 bg-[#0D1B2B] rounded-full border border-[#243F5E] flex items-center justify-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-[#1A3048]" />
            <div className="w-5 h-3 bg-[#1A3048] rounded-full" />
          </div>
        </div>

        {/* App top bar — mirrors the real Navbar: app name, Feedback, Settings, Sign out */}
        <div className="bg-[#132537] border-b border-[#1E3550] px-5 py-3 flex items-center justify-between">
          <span className="font-bold text-[#E8F0F8] text-sm tracking-tight">{t("appName")}</span>
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-[#6A97B4]">Feedback</span>
            <IconSettings className="w-3.5 h-3.5 text-[#6A97B4]" />
            <span className="text-[11px] text-[#6A97B4]">{t("buttons.signOut")}</span>
          </div>
        </div>

        {/* Dashboard content — real account filter + data-coverage summary + a
            calm, low-key metrics row. Natural height (no forced box) so the
            longer bank names never get clipped or overlap the bottom nav. */}
        <div className="bg-[#0D1B2B] px-5 py-4">

          {/* Account filter pills — All accounts + the 3 uploaded accounts.
              Compact sizing so the longer bank names fit two-per-row instead
              of stacking into a tall single column. */}
          <div className="flex items-center gap-1.5 flex-wrap mb-2.5">
            <span className="px-3 py-1.5 rounded-full text-xs font-medium bg-[#3AB5A0] text-[#0D1B2B]">
              {tFilter("allAccounts")}
            </span>
            {ACCOUNTS.map(acct => (
              <span
                key={acct.name}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-[#1A3048] text-[#7BA8C4]"
              >
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: acct.color }} />
                {acct.name}
              </span>
            ))}
          </div>

          {/* Data coverage — years-of-history + transaction-count summary */}
          <div className="flex items-start gap-3 px-4 py-2.5 bg-[#4CC4A412] border border-[#4CC4A428] rounded-xl mb-2.5">
            <div className="w-5 h-5 rounded-full bg-[#4CC4A4] flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="flex flex-col gap-1 min-w-0">
              <span className="text-sm font-medium text-[#4CC4A4]">
                {tCoverage("summary", { span, count: COVERAGE_COUNT })}
              </span>
              <span className="text-xs text-[#6A97B4]">{tCoverage("analysisRange", { range: rangeLabel })}</span>
            </div>
          </div>

          {/* Calm metrics row — scaled figures, low-key presentation */}
          <div className="grid grid-cols-2 gap-2">
            <div className="px-3.5 py-2 bg-[#132537] border border-[#1E3550] rounded-xl">
              <p className="text-[10px] text-[#6A97B4] mb-1">{tMetrics("income")}</p>
              <p className="text-sm font-medium text-[#4CC4A4] tabular-nums">{formatCurrency(income, locale)}</p>
            </div>
            <div className="px-3.5 py-2 bg-[#132537] border border-[#1E3550] rounded-xl">
              <p className="text-[10px] text-[#6A97B4] mb-1">{tMetrics("expenses")}</p>
              <p className="text-sm font-medium text-[#D4A254] tabular-nums">{formatCurrency(expenses, locale)}</p>
            </div>
            <div className="px-3.5 py-2 bg-[#132537] border border-[#1E3550] rounded-xl">
              <p className="text-[10px] text-[#6A97B4] mb-1">{tMetrics("cashflow")}</p>
              <p className={`text-sm font-medium tabular-nums ${cashflow >= 0 ? "text-[#3AB5A0]" : "text-[#D97070]"}`}>
                {formatCurrency(cashflow, locale)}
              </p>
            </div>
            <div className="px-3.5 py-2 bg-[#132537] border border-[#1E3550] rounded-xl">
              <p className="text-[10px] text-[#6A97B4] mb-1">{tMetrics("margin")}</p>
              <p className="text-sm font-medium text-[#A8C6E0] tabular-nums">{marginPct}%</p>
            </div>
          </div>
        </div>

        {/* Bottom nav — the real mobile tab bar, Dashboard active */}
        <div className="bg-[#132537] border-t border-[#243F5E] flex items-stretch">
          {BOTTOM_NAV.map(({ key, Icon }) => {
            const active = key === "dashboard";
            return (
              <div
                key={key}
                className={`relative flex flex-col items-center justify-center gap-1 flex-1 py-3 ${
                  active ? "text-[#3AB5A0]" : "text-[#6A97B4]"
                }`}
              >
                {active && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-[#3AB5A0] rounded-full" />
                )}
                <Icon className="w-5 h-5" />
                <span className="text-[10px] leading-none font-medium">
                  {t(`nav.${key}Mobile`)}
                </span>
              </div>
            );
          })}
        </div>

        {/* Home indicator */}
        <div className="flex justify-center py-3 bg-[#0D1B2B]">
          <div className="w-32 h-1 bg-[#1E3550] rounded-full" />
        </div>
      </div>
    </div>
  );
}
