// ── Emergency Buffer ──────────────────────────────────────────────────────
// Not a tax or legal figure — a personal-finance recommendation, sized to
// how volatile the freelancer's own income actually is. Fully data-driven
// (real income history), works identically regardless of country, and needs
// zero profile information — available from a freelancer's very first
// months of data.

export interface EmergencyBufferResult {
  pct: number;
  volatility: "low" | "medium" | "high" | "unknown";
}

export function computeEmergencyBuffer(monthlyIncomeSamples: number[]): EmergencyBufferResult {
  const samples = monthlyIncomeSamples.filter((v) => v > 0);
  if (samples.length < 3) {
    // Not enough history to measure volatility yet — use a conservative
    // middle-ground default rather than claiming false precision.
    return { pct: 10, volatility: "unknown" };
  }

  const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
  const variance = samples.reduce((sum, v) => sum + (v - mean) ** 2, 0) / samples.length;
  const stdDev = Math.sqrt(variance);
  const coefficientOfVariation = mean > 0 ? stdDev / mean : 0;

  if (coefficientOfVariation < 0.2) return { pct: 5, volatility: "low" };
  if (coefficientOfVariation < 0.5) return { pct: 10, volatility: "medium" };
  return { pct: 20, volatility: "high" };
}
