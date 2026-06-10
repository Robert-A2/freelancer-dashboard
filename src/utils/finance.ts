import { DEFAULT_LOCALE, INTL_LOCALES, type Locale } from "@/i18n/locales";

export function parseAmount(value: unknown): number {
  if (value === "" || value === null || value === undefined) return 0;
  const num = Number(
    String(value).replace(",", ".").replace(/[^\d.-]/g, "")
  );
  return isNaN(num) ? 0 : num;
}

export function formatCurrency(value: number, locale: Locale = DEFAULT_LOCALE): string {
  // No minimum fractional digits — €24,088 not €24,088.00; €24.50 still shows cents.
  return new Intl.NumberFormat(INTL_LOCALES[locale], {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatNumber(value: number): string {
  return value.toFixed(2);
}

export function pct(value: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((value / total) * 100);
}

export function monthLabel(month: number, year: number, locale: Locale = DEFAULT_LOCALE): string {
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString(INTL_LOCALES[locale], {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  });
}

// `period` is a locale-independent "YYYY-MM" string (e.g. "2027-03").
export function monthYearLabel(period: string, locale: Locale = DEFAULT_LOCALE): string {
  const [year, month] = period.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString(INTL_LOCALES[locale], {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
