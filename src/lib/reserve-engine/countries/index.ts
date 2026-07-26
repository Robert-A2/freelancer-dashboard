import type { CountryReserveRules } from "../types";
import { franceRules } from "./france";

// ── Country registry ─────────────────────────────────────────────────────
// Adding a new country: write one file implementing CountryReserveRules,
// then register it here. Nothing else in the engine needs to change.
export const COUNTRY_REGISTRY: Record<string, CountryReserveRules> = {
  FR: franceRules,
  // DE: germanyRules,   — not implemented; no confident real rates to offer yet
  // GB: ukRules,        — not implemented
  // US: usRules,        — not implemented
};

export function getCountryRules(countryCode: string | null): CountryReserveRules | null {
  if (!countryCode) return null;
  return COUNTRY_REGISTRY[countryCode] ?? null;
}
