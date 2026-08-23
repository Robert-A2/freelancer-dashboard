"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { formatCurrency } from "@/utils/finance";
import { INTL_LOCALES, type Locale } from "@/i18n/locales";
import { getExpectedPaymentDisplayStatus, type UpcomingItem } from "@/lib/upcoming-item";
import ExpectedPaymentDrawer from "./ExpectedPaymentDrawer";

// The Dashboard's "Coming up" card (spec sections 3-4) — only the expected-
// income rows are interactive (tap → detail/mark-received/edit, spec
// section 5); recurring-expense rows stay exactly as they were, plain and
// non-interactive, since that flow lives in Quick Add, not here.
export default function UpcomingList({ upcoming }: { upcoming: UpcomingItem[] }) {
  const t = useTranslations("manual.today");
  const tStatus = useTranslations("manual.expectedPayment.status");
  const locale = useLocale() as Locale;
  const [selected, setSelected] = useState<UpcomingItem | null>(null);

  const dateFmt = (d: Date) => d.toLocaleDateString(INTL_LOCALES[locale], { day: "numeric", month: "short", timeZone: "UTC" });

  return (
    <div className="card-sm">
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

            return (
              <li key={`${item.kind}-${item.id}`}>
                <button
                  onClick={() => setSelected(item)}
                  className="w-full flex items-center justify-between gap-3 text-sm text-left hover:bg-[#1E3446] -mx-2 px-2 py-1 rounded-lg transition-colors"
                >
                  {row}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <ExpectedPaymentDrawer item={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
