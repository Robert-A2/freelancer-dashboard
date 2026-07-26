import { getTranslations, getLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import type { Locale } from "@/i18n/locales";
import { INTL_LOCALES } from "@/i18n/locales";
import { formatCurrency, formatInvoiceNumber, computeVatBreakdown } from "@/utils/finance";
import { getBrandFontClassName } from "@/lib/brand-fonts";
import PayButton from "@/components/pay/PayButton";

export const dynamic = "force-dynamic";

const DEFAULT_ACCENT = "#2FA393";

function CheckIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}

function formatDate(date: Date, locale: Locale): string {
  return date.toLocaleDateString(INTL_LOCALES[locale], { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

// Fallback identity mark shown when no logo has been uploaded yet — so the
// header always shows something with the freelancer's brand color, rather
// than leaving an empty gap above the client name.
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export default async function PayPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ paid?: string }>;
}) {
  const { token } = await params;
  const { paid } = await searchParams;
  const t = await getTranslations("pay");
  const locale = (await getLocale()) as Locale;

  const milestone = await prisma.milestone.findUnique({
    where: { paymentUrlToken: token },
    include: {
      project: {
        include: {
          milestones: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
          user: {
            select: {
              stripeAccountEnabled: true, brandLogoUrl: true, brandAccentColor: true, brandFont: true,
              fullName: true, businessName: true, vatStatus: true, vatNumber: true,
            },
          },
        },
      },
    },
  });

  if (!milestone) {
    return (
      <div className="min-h-screen bg-[#F4F6F8] flex items-center justify-center px-6">
        <div className="max-w-md w-full bg-white border border-[#E3E8EE] rounded-2xl shadow-[0_1px_2px_rgba(15,40,60,0.04),0_12px_32px_rgba(15,40,60,0.06)] p-8 text-center">
          <div className="text-4xl mb-4">🔗</div>
          <h1 className="text-lg font-semibold text-[#16283B] mb-2">{t("notFound.heading")}</h1>
          <p className="text-sm text-[#5B7185]">{t("notFound.body")}</p>
        </div>
      </div>
    );
  }

  const { project } = milestone;
  const isPaid = milestone.status === "paid" || milestone.status === "cleared";
  const canPay = !isPaid && project.user.stripeAccountEnabled;
  const showSuccess = paid === "1";
  const accentColor = project.user.brandAccentColor || DEFAULT_ACCENT;
  const fontClassName = getBrandFontClassName(project.user.brandFont);

  const issuerName = project.user.businessName || project.user.fullName || null;
  const showVatId = project.user.vatStatus === "registered" && !!project.user.vatNumber;
  const showIssuer = !!issuerName || showVatId;

  const currentVatRatePct = milestone.vatRatePct != null ? Number(milestone.vatRatePct) : null;
  const currentBreakdown = computeVatBreakdown(Number(milestone.amount), currentVatRatePct);
  // Only show the net/VAT/gross breakdown when there's actually VAT to show —
  // a freelancer who isn't VAT-registered sees the same simple amount line
  // as before, with zero tax administration in view.
  const showVatBreakdown = milestone.isReverseCharge || (currentVatRatePct != null && currentVatRatePct > 0);

  return (
    <div className={`min-h-screen bg-[#F4F6F8] flex items-center justify-center px-6 py-12 ${fontClassName}`}>
      <div className="max-w-md w-full">

        {showSuccess && (
          <div className="mb-5 px-4 py-3 bg-[#E8F7F3] border border-[#BFE6DC] rounded-xl text-center">
            <p className="text-sm font-semibold text-[#1F8A73]">{t("successBanner.heading")}</p>
            <p className="text-xs text-[#3D6E62] mt-1 leading-relaxed">{t("successBanner.body")}</p>
          </div>
        )}

        <div className="bg-white border border-[#E3E8EE] rounded-2xl shadow-[0_1px_2px_rgba(15,40,60,0.04),0_12px_32px_rgba(15,40,60,0.06)] p-8">
          <div className="text-center mb-7">
            {project.user.brandLogoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={project.user.brandLogoUrl} alt="" className="h-10 max-w-[140px] object-contain mx-auto mb-4" />
            ) : issuerName ? (
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center mx-auto mb-4 text-sm font-bold text-[#0D1B2B]"
                style={{ backgroundColor: accentColor }}
              >
                {getInitials(issuerName)}
              </div>
            ) : null}
            {showIssuer && (
              <div className="mb-4 pb-4 border-b border-[#E3E8EE]">
                {issuerName && <p className="text-sm font-semibold text-[#16283B]">{issuerName}</p>}
                {showVatId && (
                  <p className="text-xs text-[#8A9BAC] mt-0.5 tabular-nums">{t("vatId", { number: project.user.vatNumber ?? "" })}</p>
                )}
              </div>
            )}
            <p className="text-xs font-medium tracking-widest uppercase mb-2" style={{ color: accentColor }}>{project.clientName}</p>
            <h1 className="text-xl font-bold text-[#16283B]">{project.projectName}</h1>
            <p className="text-xs text-[#8A9BAC] mt-1 tabular-nums">
              {t("invoiceMeta", { number: formatInvoiceNumber(milestone.invoiceNumber), date: formatDate(milestone.createdAt, locale) })}
            </p>
          </div>

          {!isPaid && (
            <div className="mb-7 text-center">
              <p className="text-[11px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: accentColor }}>{t("amountDue")}</p>
              <p className="text-[44px] leading-[1.1] font-bold text-[#16283B] tabular-nums">{formatCurrency(currentBreakdown.gross, locale)}</p>
              <p className="text-sm text-[#5B7185] mt-1.5">{milestone.label}</p>
            </div>
          )}

          {showVatBreakdown && (
            <div className="mb-7 px-4 py-4 bg-[#F8FAFB] border border-[#E3E8EE] rounded-xl">
              <div className="flex items-center justify-between gap-3 mb-1.5">
                <span className="text-sm text-[#5B7185]">{t("vatBreakdown.net")}</span>
                <span className="text-sm text-[#16283B] tabular-nums">{formatCurrency(currentBreakdown.net, locale)}</span>
              </div>
              {milestone.isReverseCharge ? (
                <p className="text-xs text-[#8A9BAC] leading-relaxed mt-2 mb-2">{t("vatBreakdown.reverseChargeNote")}</p>
              ) : (
                <div className="flex items-center justify-between gap-3 mb-1.5">
                  <span className="text-sm text-[#5B7185]">{t("vatBreakdown.vat", { pct: currentVatRatePct ?? 0 })}</span>
                  <span className="text-sm text-[#16283B] tabular-nums">{formatCurrency(currentBreakdown.vat, locale)}</span>
                </div>
              )}
              <div className="flex items-center justify-between gap-3 pt-2 mt-1 border-t border-[#E3E8EE]">
                <span className="text-sm font-semibold text-[#16283B]">{t("vatBreakdown.gross")}</span>
                <span className="text-sm font-bold text-[#16283B] tabular-nums">{formatCurrency(currentBreakdown.gross, locale)}</span>
              </div>
            </div>
          )}

          {/* Milestone timeline */}
          <div className="mb-7">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#8A9BAC] mb-3">{t("scheduleLabel")}</p>
            <div className="space-y-0">
              {project.milestones.map((m, i) => {
                const mPaid = m.status === "paid" || m.status === "cleared";
                const isCurrent = m.id === milestone.id;
                const isLast = i === project.milestones.length - 1;
                return (
                  <div key={m.id} className="flex gap-3">
                    <div className="flex flex-col items-center flex-shrink-0">
                      <span
                        className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                          mPaid ? "text-white" : isCurrent ? "border-2" : "border-2 border-[#DCE3EA] text-[#DCE3EA]"
                        }`}
                        style={
                          mPaid
                            ? { backgroundColor: accentColor }
                            : isCurrent
                            ? { borderColor: accentColor, color: accentColor, boxShadow: `0 0 0 4px ${accentColor}22` }
                            : undefined
                        }
                      >
                        {mPaid ? <CheckIcon /> : <span className="w-1.5 h-1.5 rounded-full bg-current" />}
                      </span>
                      {!isLast && <span className="w-0.5 flex-1 bg-[#E3E8EE] min-h-[24px]" />}
                    </div>
                    <div className={`pb-5 min-w-0 flex-1 ${isCurrent ? "" : "opacity-70"}`}>
                      <div className="flex items-center justify-between gap-3">
                        <p className={`text-sm truncate ${isCurrent ? "font-semibold text-[#16283B]" : "text-[#42586B]"}`}>
                          {m.label}
                        </p>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${
                          mPaid ? "bg-[#E8F7F3] text-[#1F8A73]" : "bg-[#F1F4F7] text-[#5B7185]"
                        }`}>
                          {mPaid ? t("paidBadge") : t("dueBadge")}
                        </span>
                      </div>
                      <p className="text-sm font-bold text-[#16283B] tabular-nums mt-0.5">
                        {formatCurrency(computeVatBreakdown(Number(m.amount), m.vatRatePct != null ? Number(m.vatRatePct) : null).gross, locale)}
                      </p>
                      {mPaid && m.paidAt && (
                        <p className="text-xs text-[#8A9BAC] mt-0.5">{t("paidOn", { date: formatDate(m.paidAt, locale) })}</p>
                      )}
                      {!mPaid && m.dueDate && (
                        <p className="text-xs text-[#8A9BAC] mt-0.5">{t("dueOn", { date: formatDate(m.dueDate, locale) })}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {project.milestones.length > 1 && (
            <div className="mb-7 px-4 py-3.5 bg-[#F8FAFB] border border-[#E3E8EE] rounded-xl">
              <p className="text-xs text-[#5B7185] leading-relaxed">{t("milestoneNote")}</p>
            </div>
          )}

          {/* Payment action */}
          {isPaid ? (
            <div className="text-center px-4 py-5 bg-[#E8F7F3] border border-[#BFE6DC] rounded-xl">
              <p className="text-sm font-semibold text-[#1F8A73]">{t("alreadyPaid.heading")}</p>
              <p className="text-xs text-[#3D6E62] mt-1">{t("alreadyPaid.body")}</p>
            </div>
          ) : canPay ? (
            <PayButton token={token} amount={currentBreakdown.gross} locale={locale} accentColor={accentColor} />
          ) : (
            <div className="text-center px-4 py-5 bg-[#FDF3E3] border border-[#F2DEB3] rounded-xl">
              <p className="text-sm font-semibold text-[#A66A0A]">{t("notReady.heading")}</p>
              <p className="text-xs text-[#8A6633] mt-1 leading-relaxed">{t("notReady.body")}</p>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-[#8A9BAC] mt-5">{t("poweredBy")}</p>
      </div>
    </div>
  );
}
