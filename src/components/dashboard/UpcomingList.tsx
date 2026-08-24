"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import { formatCurrency } from "@/utils/finance";
import { INTL_LOCALES, type Locale } from "@/i18n/locales";
import { getExpectedPaymentDisplayStatus, type UpcomingItem } from "@/lib/upcoming-item";
import type { ReserveForPayment } from "@/lib/reserve-engine";
import type { MoneyBreakdown, MoneyBreakdownProjection } from "@/lib/money-breakdown";
import ExpectedPaymentDrawer from "./ExpectedPaymentDrawer";

// The Dashboard's "Coming up" card (spec sections 3-4) — only the expected-
// income rows are interactive (tap → detail/mark-received/edit, spec
// section 5); recurring-expense rows stay exactly as they were, plain and
// non-interactive, since that flow lives in Quick Add, not here.
export default function UpcomingList({
  upcoming,
  demoAutoPlayTargetId,
  demoScenario,
  demoAfter,
}: {
  upcoming: UpcomingItem[];
  /** Landing-page product showcase only (src/lib/landing-demo-data.ts) — the
   * id of the item to auto-open in a loop while this card is in the
   * viewport. Undefined for every real dashboard usage, so real behavior
   * (click-only) is unchanged. */
  demoAutoPlayTargetId?: string;
  demoScenario?: { reserve: ReserveForPayment; current: MoneyBreakdown; scenario: MoneyBreakdownProjection };
  demoAfter?: { currentCash: number; moneyInThisMonth: number };
}) {
  const t = useTranslations("manual.today");
  const tStatus = useTranslations("manual.expectedPayment.status");
  const locale = useLocale() as Locale;
  const [selected, setSelected] = useState<UpcomingItem | null>(null);
  const [autoPlayActive, setAutoPlayActive] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const dateFmt = (d: Date) => d.toLocaleDateString(INTL_LOCALES[locale], { day: "numeric", month: "short", timeZone: "UTC" });

  // Landing-page product showcase only — pause the loop when scrolled out
  // of view, resume when back in view. No-op when demoAutoPlayTargetId is
  // unset (every real dashboard usage).
  useEffect(() => {
    if (!demoAutoPlayTargetId) return;
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setAutoPlayActive(entry.isIntersecting), { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, [demoAutoPlayTargetId]);

  // Opens the target item after a short delay whenever autoplay is active
  // and nothing is currently open. ExpectedPaymentDrawer's own demoAutoPlay
  // effect drives detail -> markReceived -> received -> onClose(); once
  // onClose fires, selected becomes null again and this effect re-fires,
  // looping for as long as the card stays in view.
  useEffect(() => {
    if (!demoAutoPlayTargetId || !autoPlayActive || selected) return;
    const target = upcoming.find((i) => i.id === demoAutoPlayTargetId);
    if (!target) return;
    const timer = setTimeout(() => setSelected(target), 1800);
    return () => clearTimeout(timer);
  }, [demoAutoPlayTargetId, autoPlayActive, selected, upcoming]);

  return (
    <div className="card-sm" ref={rootRef}>
      <p className="label mb-3">{t("comingUp")}</p>
      {upcoming.length === 0 ? (
        <p className="text-sm text-[#6A97B4]">{t("comingUpEmpty")}</p>
      ) : (
        <ul className="space-y-3">
          {upcoming.map((item) => {
            const isExpectedIncome = item.kind === "expected_income";
            const display = isExpectedIncome ? getExpectedPaymentDisplayStatus(item.date) : null;

            const row = (
              <>
                <div className="min-w-0">
                  <p className="text-[#C8DCF0] truncate">
                    {item.label}
                    {/* item.label already falls back to projectName when there's no
                        client name (see expectedPaymentDisplayName) — only show this
                        suffix when it'd add something label doesn't already say. */}
                    {item.projectName && item.projectName !== item.label ? (
                      <span className="text-[#6A97B4]"> · {item.projectName}</span>
                    ) : null}
                  </p>
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-[#6A97B4]">
                      {isExpectedIncome ? t("expectedOn", { date: dateFmt(item.date) }) : t("dueOn", { date: dateFmt(item.date) })}
                    </p>
                    {display && display.status !== "expected" && (
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                        display.status === "overdue" ? "text-[#E5484D] bg-[#4A2A2A]" : "text-[#D4A254] bg-[#332C1A]"
                      }`}>
                        {display.status === "overdue" ? tStatus("overdue", { days: display.overdueDays }) : tStatus("dueToday")}
                      </span>
                    )}
                  </div>
                </div>
                <span className={`font-semibold tabular-nums flex-shrink-0 ${isExpectedIncome ? "text-[#4CC4A4]" : "text-[#D4A254]"}`}>
                  {isExpectedIncome ? "+" : "−"}{formatCurrency(item.amount, locale)}
                </span>
              </>
            );

            if (!isExpectedIncome) {
              return (
                <li key={`${item.kind}-${item.id}`} className="flex items-center justify-between gap-3 text-sm">
                  {row}
                </li>
              );
            }

            const isAutoPlayTarget = demoAutoPlayTargetId === item.id && autoPlayActive && !selected;

            return (
              <li key={`${item.kind}-${item.id}`}>
                <button
                  onClick={() => setSelected(item)}
                  className={`w-full flex items-center justify-between gap-3 text-sm text-left hover:bg-[#1E3446] -mx-2 px-2 py-1 rounded-lg transition-colors ${
                    isAutoPlayTarget ? "ring-1 ring-[#3AB5A0]/60 animate-pulse" : ""
                  }`}
                >
                  {row}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <ExpectedPaymentDrawer
        item={selected}
        onClose={() => setSelected(null)}
        demoScenario={demoAutoPlayTargetId && selected?.id === demoAutoPlayTargetId ? demoScenario : undefined}
        demoAfter={demoAfter}
        demoAutoPlay={!!demoAutoPlayTargetId}
      />
    </div>
  );
}
