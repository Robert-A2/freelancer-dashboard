// Shared by every manual-entry form (Onboarding, Quick Add, Expected
// Payment drawer) that needs a `<input type="date">`-compatible string —
// kept in one place instead of three near-identical copies.
export function todayInputValue(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Same format, from a UTC-stored Date (e.g. an ExpectedPayment.expectedDate
// read back from the database) rather than "now".
export function dateInputValue(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}
