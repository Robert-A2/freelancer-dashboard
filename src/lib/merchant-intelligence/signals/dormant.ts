import type { Signal } from "./types";

// Placeholder signals for Merchant fields that exist in the schema but are
// currently 100% unpopulated anywhere in the codebase — confirmed during
// Phase 2 planning research: no seed file, static pack, or user-facing flow
// writes industry, businessType, website, taxClassificationHint,
// businessFunction, or a merchant category code (MCC) for any row.
// (parentCompanySignal was here too until Phase 4 activated it — see
// ./parentCompany.ts — once scripts/seed-merchant-relationships.ts gave it
// real data to act on.)
//
// Each is still a real, named, independently-addressable entry in
// SIGNAL_REGISTRY (see ./index.ts) — the PDF's "every signal must be
// independently extendable" requirement — but honestly returns
// present: false rather than pretending data exists. Activating one later is
// a one-file change: rewrite ONLY that signal's body once a data source
// exists (manual curation, an external MCC lookup, a future AI enrichment
// pass) — no changes anywhere else in the registry or scoring logic.

export const industrySignal: Signal = () => ({ present: false, weight: 0 });
export const businessTypeSignal: Signal = () => ({ present: false, weight: 0 });
export const websiteSignal: Signal = () => ({ present: false, weight: 0 });
export const taxBehaviourSignal: Signal = () => ({ present: false, weight: 0 });
export const businessFunctionSignal: Signal = () => ({ present: false, weight: 0 });
export const merchantCategoryCodeSignal: Signal = () => ({ present: false, weight: 0 });
