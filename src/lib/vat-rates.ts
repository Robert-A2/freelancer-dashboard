// ── Standard VAT/GST rate defaults ──────────────────────────────────────────
// Only used to pre-fill the editable "Tax rate (%)" field when creating a
// milestone — never applied silently. A confident default is only offered
// for a country this app actually lets a user select today (see
// FinancialProfileSection's country dropdown: France, or "other"). Adding a
// new country here should happen alongside adding it to that dropdown, not
// before — offering a specific rate for a country we don't otherwise model
// would look authoritative without being backed by anything.
const STANDARD_VAT_RATES: Record<string, number> = {
  FR: 20,
};

export function getDefaultVatRatePct(country: string | null): number | null {
  if (!country) return null;
  return STANDARD_VAT_RATES[country] ?? null;
}
