// Projects/Milestones/invoicing (client payment links via Stripe Connect) is
// paused product-wide as of 2026-08-21 — the team is validating whether
// freelancers actually want in-app invoicing now that manual cash/tax
// tracking (src/lib/cash-balance-engine.ts, tax-reserve-engine.ts) covers
// the core need. Nothing was deleted: every page, component, and API route
// behind this feature is untouched and fully restorable by flipping this
// flag back to true. Every entry point that could let a user build a
// project or get paid is gated on it — see PROJECTS_ENABLED usages.
export const PROJECTS_ENABLED = false;
