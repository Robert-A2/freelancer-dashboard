import { getTranslations, getLocale } from "next-intl/server";
import type { Locale } from "@/i18n/locales";
import { INTL_LOCALES } from "@/i18n/locales";
import { formatCurrency, formatInvoiceNumber } from "@/utils/finance";

export const dynamic = "force-dynamic";

const DEMO_ACCENT = "#3AB5A0";

function CheckIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}

// Static preview of the real /pay/[token] page a freelancer's client actually
// sees — reachable from the "Copy payment link" button on the demo Projects
// page. Not tied to whatever the visitor just typed in (nothing here is
// persisted server-side to read back), so it uses a fixed, clearly-labeled
// example instead of pretending to reflect their input. Kept visually in
// lockstep with the real page's design/layout.
export default async function DemoPayPreviewPage() {
  const t = await getTranslations("pay");
  const td = await getTranslations("demo");
  const locale = (await getLocale()) as Locale;

  const exampleAmount = 1700;
  const exampleDueDate = new Date();
  const paidMilestone = { label: "Deposit", amount: 1700, paid: true };
  const dueMilestone = { label: "Final payment", amount: 1700, paid: false };

  return (
    <div className="min-h-screen bg-[#F4F6F8] flex items-center justify-center px-6 py-12">
      <div className="max-w-md w-full">
        <div className="mb-5 px-4 py-3 bg-[#EAF6F3] border border-[#BFE6DC] rounded-xl text-center">
          <p className="text-sm font-semibold text-[#1F8A73]">{td("payPreview.banner.heading")}</p>
          <p className="text-xs text-[#3D6E62] mt-1 leading-relaxed">{td("payPreview.banner.body")}</p>
        </div>

        <div className="bg-white border border-[#E3E8EE] rounded-2xl shadow-[0_1px_2px_rgba(15,40,60,0.04),0_12px_32px_rgba(15,40,60,0.06)] p-8">
          <div className="text-center mb-7">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center mx-auto mb-4 text-sm font-bold text-[#0D1B2B]"
              style={{ backgroundColor: DEMO_ACCENT }}
            >
              SM
            </div>
            <div className="mb-4 pb-4 border-b border-[#E3E8EE]">
              <p className="text-sm font-semibold text-[#16283B]">Sophie Martin</p>
            </div>
            <p className="text-xs font-medium tracking-widest uppercase mb-2" style={{ color: DEMO_ACCENT }}>Nexo Startup</p>
            <h1 className="text-xl font-bold text-[#16283B]">Brand identity redesign</h1>
            <p className="text-xs text-[#8A9BAC] mt-1 tabular-nums">
              {t("invoiceMeta", { number: formatInvoiceNumber(2), date: exampleDueDate.toLocaleDateString(INTL_LOCALES[locale], { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) })}
            </p>
          </div>

          <div className="mb-7 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: DEMO_ACCENT }}>{t("amountDue")}</p>
            <p className="text-[44px] leading-[1.1] font-bold text-[#16283B] tabular-nums">{formatCurrency(exampleAmount, locale)}</p>
            <p className="text-sm text-[#5B7185] mt-1.5">{dueMilestone.label}</p>
          </div>

          <div className="mb-7">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#8A9BAC] mb-3">{t("scheduleLabel")}</p>
            <div className="space-y-0">
              {[paidMilestone, dueMilestone].map((m, i) => (
                <div key={m.label} className="flex gap-3">
                  <div className="flex flex-col items-center flex-shrink-0">
                    <span
                      className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${m.paid ? "text-white" : "border-2"}`}
                      style={m.paid ? { backgroundColor: DEMO_ACCENT } : { borderColor: DEMO_ACCENT, color: DEMO_ACCENT, boxShadow: `0 0 0 4px ${DEMO_ACCENT}22` }}
                    >
                      {m.paid ? <CheckIcon /> : <span className="w-1.5 h-1.5 rounded-full bg-current" />}
                    </span>
                    {i === 0 && <span className="w-0.5 flex-1 bg-[#E3E8EE] min-h-[24px]" />}
                  </div>
                  <div className={`pb-5 min-w-0 flex-1 ${m.paid ? "opacity-70" : ""}`}>
                    <div className="flex items-center justify-between gap-3">
                      <p className={`text-sm truncate ${m.paid ? "text-[#42586B]" : "font-semibold text-[#16283B]"}`}>{m.label}</p>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${m.paid ? "bg-[#E8F7F3] text-[#1F8A73]" : "bg-[#F1F4F7] text-[#5B7185]"}`}>
                        {m.paid ? t("paidBadge") : t("dueBadge")}
                      </span>
                    </div>
                    <p className="text-sm font-bold text-[#16283B] tabular-nums mt-0.5">{formatCurrency(m.amount, locale)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mb-7 px-4 py-3.5 bg-[#F8FAFB] border border-[#E3E8EE] rounded-xl">
            <p className="text-xs text-[#5B7185] leading-relaxed">{t("milestoneNote")}</p>
          </div>

          <button disabled className="w-full py-3.5 rounded-xl text-sm font-semibold text-white cursor-not-allowed opacity-90" style={{ backgroundColor: DEMO_ACCENT }}>
            {t("payButton", { amount: formatCurrency(exampleAmount, locale) })}
          </button>
          <p className="text-xs text-[#8A9BAC] text-center mt-2.5">{t("secureNotice")}</p>
        </div>

        <p className="text-center text-xs text-[#8A9BAC] mt-5">{t("poweredBy")}</p>
      </div>
    </div>
  );
}
