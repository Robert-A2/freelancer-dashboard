import { describe, it, expect } from "vitest";
import { computeTrend, computeReliabilityScore, type PartialProfile, type MonthlyRevenue } from "@/lib/client-risk-engine";

// Regression coverage for the "fake info on a single-payment client" bug:
// a client with too few real payments was getting a confident-sounding
// revenue trend and reliability verdict fabricated from essentially zero
// signal (client detail page — 2026-08-26).

function months(amounts: number[]): MonthlyRevenue[] {
  return amounts.map((amount, i) => ({ year: 2026, month: i + 1, label: String(i + 1), amount }));
}

function basePartial(overrides: Partial<PartialProfile>): PartialProfile {
  return {
    name: "Test Client",
    payerId: null,
    canonicalName: "Test Client",
    confidence: "high",
    isProcessor: false,
    totalRevenue: 1000,
    revenueContributionPct: 20,
    paymentCount: 1,
    avgPayment: 1000,
    largestPayment: 1000,
    firstPayment: "2026-01-01T00:00:00.000Z",
    lastPayment: "2026-01-01T00:00:00.000Z",
    monthsActive: 1,
    avgIntervalDays: null,
    currentGapDays: 5,
    status: "current",
    lifecycle: "current",
    dependencyRisk: "low",
    monthlyRevenue: months([0, 0, 0, 0, 0, 1000]),
    revenueTrend: null,
    revenueTrendPct: null,
    payments: [],
    reliabilityScore: "good",
    recentMonthlyAvg: 1000,
    priorMonthlyAvg: 0,
    rawDescriptions: [],
    avgDaysLate: null,
    daysLateSampleCount: 0,
    ...overrides,
  };
}

describe("computeTrend", () => {
  it("does not fabricate an 'increasing' trend from a single recent payment", () => {
    // One payment ever, landing in the most-recent 3-month window.
    const { trend, trendPct } = computeTrend(months([0, 0, 0, 0, 0, 1000]), 1);
    expect(trend).toBeNull();
    expect(trendPct).toBeNull();
  });

  it("does not fabricate a 'declining 100%' trend from a single old payment", () => {
    // One payment ever, landing in the prior 3-month window, nothing since.
    const { trend, trendPct } = computeTrend(months([1000, 0, 0, 0, 0, 0]), 1);
    expect(trend).toBeNull();
    expect(trendPct).toBeNull();
  });

  it("does not fabricate a trend from two payments", () => {
    const { trend, trendPct } = computeTrend(months([500, 0, 0, 0, 0, 500]), 2);
    expect(trend).toBeNull();
    expect(trendPct).toBeNull();
  });

  it("still detects a real increasing trend once 3+ payments exist", () => {
    const { trend, trendPct } = computeTrend(months([100, 100, 100, 200, 200, 200]), 3);
    expect(trend).toBe("increasing");
    expect(trendPct).toBe(100);
  });

  it("still detects a real declining trend once 3+ payments exist", () => {
    const { trend, trendPct } = computeTrend(months([200, 200, 200, 100, 100, 100]), 3);
    expect(trend).toBe("declining");
    expect(trendPct).toBe(50);
  });

  it("returns null when there is genuinely no revenue in the 6-month window", () => {
    const { trend, trendPct } = computeTrend(months([0, 0, 0, 0, 0, 0]), 5);
    expect(trend).toBeNull();
    expect(trendPct).toBeNull();
  });
});

describe("computeReliabilityScore", () => {
  it("labels a single-payment client 'new' instead of fabricating a 'watch' verdict", () => {
    const score = computeReliabilityScore(basePartial({ paymentCount: 1, status: "current" }));
    expect(score).toBe("new");
  });

  it("labels a two-payment client 'new' too", () => {
    const score = computeReliabilityScore(basePartial({ paymentCount: 2, status: "current" }));
    expect(score).toBe("new");
  });

  it("still returns 'good' for an established client with 3+ payments", () => {
    const score = computeReliabilityScore(basePartial({ paymentCount: 3, status: "current", monthsActive: 2 }));
    expect(score).toBe("good");
  });

  it("still returns 'excellent' for a long, consistent history", () => {
    const score = computeReliabilityScore(
      basePartial({ paymentCount: 6, status: "current", monthsActive: 4, revenueTrend: "stable" })
    );
    expect(score).toBe("excellent");
  });

  it("still short-circuits to 'watch'/'risk'/'inactive' regardless of payment count", () => {
    expect(computeReliabilityScore(basePartial({ paymentCount: 1, status: "watch" }))).toBe("watch");
    expect(computeReliabilityScore(basePartial({ paymentCount: 1, status: "risk" }))).toBe("risk");
    expect(computeReliabilityScore(basePartial({ paymentCount: 1, status: "inactive" }))).toBe("inactive");
  });
});
