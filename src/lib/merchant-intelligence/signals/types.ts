// Types for the modular Signal Evaluation Engine (Phase 2 of the Decision
// Engine plan). Deliberately pure/synchronous, no DB access anywhere in this
// directory — every signal takes a plain, pre-fetched SignalContext and
// returns a verdict. Building the real SignalContext from the database is a
// separate, later concern (the "decisionIndex" — see engine.ts wiring, Phase
// 3), exactly mirroring how src/lib/categorization/engine.ts itself never
// touches Prisma and only ever receives plain pre-built objects.

export interface SignalMerchantInfo {
  id: string;
  category: string;
  confidence: "high" | "medium" | "low";
  popularity: number;
  country: string | null;
  parentCompany: string | null;
}

export interface SignalFeedbackInfo {
  category: string;
  agreeCount: number;
  disagreeCount: number;
}

export interface SignalContext {
  /** null when no merchant identity was resolved at all — nothing to evaluate. */
  merchant: SignalMerchantInfo | null;
  /** All MerchantFeedback rows for this merchant, across every category ever proposed for it. */
  feedback: SignalFeedbackInfo[];
  /** How many OTHER transactions this same user has with the same normalized description. 0 if unknown. */
  sameDescriptionCount: number;
  /** 0-1: how consistent this user's past amounts were for this description. 0 if unknown/no history. */
  amountConsistency: number;
}

export interface SignalResult {
  present: boolean;
  /** Which category this signal supports. Omitted = defaults to ctx.merchant.category. */
  category?: string;
  /** 0-100 contribution when present. Ignored when present is false. */
  weight: number;
  reason?: string;
}

export type Signal = (ctx: SignalContext) => SignalResult;
