"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { INTL_LOCALES, type Locale } from "@/i18n/locales";
import { formatCurrency, parseAmount } from "@/utils/finance";
import { calculateLandingFinancialPosition, type LandingCalculatorResult } from "@/lib/landing-calculator";

// The interactive centerpiece of the redesigned landing page: 5 real inputs
// (not a mockup screenshot) feeding the actual France micro-entrepreneur tax
// formula, computed and shown instantly — nothing here is ever sent to a
// server or persisted (spec: "never be saved, it is a test only"). Every
// number a visitor sees below is either what they typed or a real,
// clearly-labeled derivation of it.

type CurrencyFieldId = "currentCash" | "monthlyBusinessCost" | "personalMonthlyNeed" | "upcomingPayment";
const CURRENCY_FIELDS: CurrencyFieldId[] = ["currentCash", "monthlyBusinessCost", "personalMonthlyNeed", "upcomingPayment"];
const ALL_FIELDS = [...CURRENCY_FIELDS, "expectedDate"] as const;

type FormState = Record<(typeof ALL_FIELDS)[number], string>;
const EMPTY_FORM: FormState = { currentCash: "", monthlyBusinessCost: "", personalMonthlyNeed: "", upcomingPayment: "", expectedDate: "" };

export default function FinancialPositionCalculator() {
  const t = useTranslations("landing.calculator");
  const locale = useLocale() as Locale;

  const [values, setValues] = useState<FormState>(EMPTY_FORM);
  const [touched, setTouched] = useState(false);
  const [result, setResult] = useState<LandingCalculatorResult | null>(null);

  const filled = ALL_FIELDS.map((id) => values[id].trim() !== "");
  const activeIndex = filled.findIndex((f) => !f);
  const hasAllCurrency = CURRENCY_FIELDS.every((id) => values[id].trim() !== "");

  function setField(id: (typeof ALL_FIELDS)[number], v: string) {
    setValues((prev) => ({ ...prev, [id]: v }));
  }

  function handleSubmit() {
    setTouched(true);
    if (!hasAllCurrency) return;
    setResult(
      calculateLandingFinancialPosition({
        currentCash: parseAmount(values.currentCash),
        monthlyBusinessCost: parseAmount(values.monthlyBusinessCost),
        personalMonthlyNeed: parseAmount(values.personalMonthlyNeed),
        upcomingPayment: parseAmount(values.upcomingPayment),
      })
    );
  }

  function handleEdit() {
    setResult(null);
  }

  const expectedDateLabel = values.expectedDate
    ? new Date(`${values.expectedDate}T00:00:00Z`).toLocaleDateString(INTL_LOCALES[locale], { day: "numeric", month: "long", timeZone: "UTC" })
    : null;

  return (
    <div className="max-w-6xl mx-auto">
      {!result ? (
        <div className="bg-[#F1F5F9] border border-[#CBD5E1] rounded-3xl shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_28px_-12px_rgba(15,23,42,0.18)] p-7 sm:p-10 lg:p-12">
          {/* Stepper track */}
          <div className="flex items-center justify-center mb-10">
            {ALL_FIELDS.map((id, i) => (
              <div key={id} className="flex items-center">
                {i > 0 && (
                  <div className={`h-px w-6 sm:w-12 md:w-16 transition-colors ${filled[i - 1] ? "bg-[#4F46E5]" : "bg-[#E2E8F0]"}`} />
                )}
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 border transition-colors ${
                    filled[i]
                      ? "bg-[#4F46E5] border-[#4F46E5] text-white"
                      : i === activeIndex
                      ? "border-2 border-[#4F46E5] text-[#4F46E5] bg-white"
                      : "border-[#CBD5E1] text-[#94A3B8] bg-white"
                  }`}
                >
                  {filled[i] ? "✓" : i + 1}
                </div>
              </div>
            ))}
          </div>

          {/* Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
            {ALL_FIELDS.map((id) => (
              <div key={id}>
                <p className="text-sm font-semibold text-[#0D1B2B] mb-1 leading-snug">{t(`steps.${id}.title`)}</p>
                <p className="text-xs text-[#64748B] mb-3 leading-snug min-h-[32px]">{t(`steps.${id}.subtitle`)}</p>
                {id === "expectedDate" ? (
                  <input
                    type="date"
                    value={values.expectedDate}
                    onChange={(e) => setField("expectedDate", e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-[#CBD5E1] bg-white text-[#0D1B2B] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/30 focus:border-[#4F46E5] transition-colors"
                  />
                ) : (
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8] text-sm">€</span>
                    <input
                      inputMode="decimal"
                      placeholder="0"
                      value={values[id]}
                      onChange={(e) => setField(id, e.target.value)}
                      className="w-full pl-7 pr-3.5 py-2.5 rounded-lg border border-[#CBD5E1] bg-white text-[#0D1B2B] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/30 focus:border-[#4F46E5] transition-colors"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="text-center">
            <button
              type="button"
              onClick={handleSubmit}
              className="inline-flex items-center gap-2 bg-[#4F46E5] hover:bg-[#4338CA] text-white font-medium text-sm px-8 py-3.5 rounded-full transition-colors"
            >
              {t("submitCta")}
              <span aria-hidden="true">→</span>
            </button>
            {touched && !hasAllCurrency && (
              <p className="text-xs text-[#DC2626] mt-3">{t("validationError")}</p>
            )}
            <p className="flex items-center justify-center gap-1.5 text-xs text-[#94A3B8] mt-4">
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <rect x="3" y="7" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
                <path d="M5.5 7V4.8a2.5 2.5 0 0 1 5 0V7" stroke="currentColor" strokeWidth="1.3" />
              </svg>
              {t("privacyNote")}
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-[#E2E8F0] rounded-3xl p-7 sm:p-10 lg:p-12 shadow-[0_20px_38px_-16px_rgba(13,27,43,0.15)]">
          <p className="text-lg font-semibold text-[#0D1B2B] mb-6">{t("results.heading")}</p>

          <div className="space-y-0 mb-6">
            <BreakdownRow label={t("results.currentCash")} value={formatCurrency(result.currentCash, locale)} positive />
            <BreakdownRow
              label={t("results.taxReserve")}
              value={`−${formatCurrency(result.taxReserve, locale)}`}
              note={t("results.taxReserveNote")}
            />
            <BreakdownRow
              label={t("results.upcomingCommitments")}
              value={`−${formatCurrency(result.upcomingCommitments, locale)}`}
              note={t("results.upcomingCommitmentsNote")}
            />
          </div>

          <div className="flex items-center justify-between pt-5 border-t-2 border-[#0D1B2B]/10 mb-8">
            <div>
              <p className="text-sm font-semibold text-[#0D1B2B]">{t("results.available")}</p>
              <p className="text-xs text-[#64748B] mt-0.5">{t("results.availableNote")}</p>
            </div>
            <p className={`text-3xl font-bold tabular-nums ${result.availableAfterProtections >= 0 ? "text-[#16A34A]" : "text-[#DC2626]"}`}>
              {formatCurrency(result.availableAfterProtections, locale)}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            <div className="bg-[#F5F3FF] rounded-2xl p-5">
              <p className="text-xs font-medium text-[#64748B] mb-2">{t("results.runway")}</p>
              <p className="text-xl font-bold text-[#0D1B2B]">
                {result.runwayMonths !== null ? t("results.months", { count: Math.round(result.runwayMonths * 10) / 10 }) : "—"}
              </p>
              <p className="text-xs text-[#94A3B8] mt-1">{t("results.runwayNote")}</p>
            </div>
            <div className="bg-[#F5F3FF] rounded-2xl p-5">
              <p className="text-xs font-medium text-[#64748B] mb-2">{t("results.runwayWithPayment")}</p>
              <p className="text-xl font-bold text-[#0D1B2B]">
                {result.runwayWithPaymentMonths !== null ? t("results.months", { count: Math.round(result.runwayWithPaymentMonths * 10) / 10 }) : "—"}
              </p>
              <p className="text-xs text-[#94A3B8] mt-1">
                {expectedDateLabel ? t("results.runwayWithPaymentOnDate", { date: expectedDateLabel }) : t("results.runwayWithPaymentNoDate")}
              </p>
            </div>
          </div>

          <p className="text-xs text-[#94A3B8] leading-relaxed mb-6">{t("results.disclaimer")}</p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/signup"
              className="inline-flex items-center bg-[#4F46E5] hover:bg-[#4338CA] text-white font-medium text-sm px-7 py-3 rounded-full transition-colors"
            >
              {t("results.cta")}
            </Link>
            <button type="button" onClick={handleEdit} className="text-sm font-medium text-[#4F46E5] hover:text-[#4338CA] transition-colors px-4 py-3">
              {t("results.editAnswers")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function BreakdownRow({ label, value, note, positive = false }: { label: string; value: string; note?: string; positive?: boolean }) {
  return (
    <div className="flex items-start justify-between py-3 border-b border-[#F1F5F9] last:border-0 gap-4">
      <div className="min-w-0">
        <p className="text-sm text-[#33465A]">{label}</p>
        {note && <p className="text-xs text-[#94A3B8] mt-0.5 leading-snug">{note}</p>}
      </div>
      <p className={`text-sm font-semibold tabular-nums shrink-0 ${positive ? "text-[#0D1B2B]" : "text-[#DC2626]"}`}>{value}</p>
    </div>
  );
}
