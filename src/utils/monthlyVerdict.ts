export type MonthlyVerdictKey = "verdictYes" | "verdictPartly" | "verdictSlightly" | "verdictNo";

// Mirrors the classification MonthlyComparison.tsx uses to color/word its verdict
// heading — extracted here so pages can compute the same verdict as a plain
// string for a CollapsibleSection "peek" subtitle without rendering the component.
export function getMonthlyVerdictKey(changes: { income: number; cashflow: number } | null | undefined): MonthlyVerdictKey | null {
  if (!changes) return null;
  return changes.income > 0 && changes.cashflow >= 0 ? "verdictYes" :
    changes.income > 0 && changes.cashflow < 0 ? "verdictPartly" :
    changes.income <= 0 && changes.cashflow >= 0 ? "verdictSlightly" :
    "verdictNo";
}
