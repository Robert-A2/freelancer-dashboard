import { describe, it, expect } from "vitest";
import { computeScoreFromFactors } from "../stability-score-engine";
import type { StabilityFactor } from "../stability-score-engine";

function factor(overrides: Partial<StabilityFactor> & Pick<StabilityFactor, "key">): StabilityFactor {
  return {
    available: true,
    points: 0,
    maxPoints: 20,
    detail: null,
    isPositive: null,
    ...overrides,
  };
}

const ALL_FIVE_MAX: StabilityFactor[] = [
  factor({ key: "runway", points: 20, isPositive: true, detail: { key: "insights.stability.runwayGood", values: { months: 6 } } }),
  factor({ key: "cashflowConsistency", points: 20, isPositive: true, detail: { key: "insights.stability.cashflowConsistent", values: { pct: 100 } } }),
  factor({ key: "incomeDiversification", points: 20, isPositive: true, detail: { key: "insights.stability.diversificationGood", values: { pct: 20 } } }),
  factor({ key: "clientReliability", points: 20, isPositive: true, detail: { key: "insights.stability.clientsReliable", values: { reliable: 3, total: 3 } } }),
  factor({ key: "taxReserveConfidence", points: 20, isPositive: true, detail: { key: "insights.stability.taxReserveKnown" } }),
];

describe("computeScoreFromFactors", () => {
  it("returns not-enough-data when the base maturity gate isn't met", () => {
    const result = computeScoreFromFactors(ALL_FIVE_MAX, false);
    expect(result.status).toBe("not-enough-data");
    expect(result.score).toBeNull();
    expect(result.band).toBeNull();
  });

  it("returns not-enough-data when fewer than 3 factors are available, even if the gate is met", () => {
    const onlyTwo = ALL_FIVE_MAX.map((f, i) => (i < 2 ? f : { ...f, available: false, points: 0 }));
    const result = computeScoreFromFactors(onlyTwo, true);
    expect(result.status).toBe("not-enough-data");
  });

  it("scores 100 when all 5 factors are maxed out and the gate is met", () => {
    const result = computeScoreFromFactors(ALL_FIVE_MAX, true);
    expect(result.status).toBe("known");
    expect(result.score).toBe(100);
    expect(result.band).toBe("stable");
  });

  it("renormalizes over only available factors — 3 of 5 maxed still scores 100, not 60", () => {
    const threeAvailable = ALL_FIVE_MAX.map((f, i) => (i < 3 ? f : { ...f, available: false, points: 0, detail: null }));
    const result = computeScoreFromFactors(threeAvailable, true);
    expect(result.status).toBe("known");
    expect(result.score).toBe(100);
  });

  it("bands correctly at the 75/50 cutoffs", () => {
    const zeroPoints = ALL_FIVE_MAX.map((f) => ({ ...f, points: 0, isPositive: false }));
    expect(computeScoreFromFactors(zeroPoints, true).band).toBe("at-risk");

    const midPoints = ALL_FIVE_MAX.map((f) => ({ ...f, points: 12 })); // 12/20 = 60%
    expect(computeScoreFromFactors(midPoints, true).band).toBe("watch");

    const highPoints = ALL_FIVE_MAX.map((f) => ({ ...f, points: 16 })); // 16/20 = 80%
    expect(computeScoreFromFactors(highPoints, true).band).toBe("stable");
  });

  it("splits factor details into positive vs. warning based on isPositive", () => {
    const mixed = [
      factor({ key: "runway", points: 20, isPositive: true, detail: { key: "insights.stability.runwayGood" } }),
      factor({ key: "cashflowConsistency", points: 5, isPositive: false, detail: { key: "insights.stability.cashflowInconsistent" } }),
      factor({ key: "incomeDiversification", points: 20, isPositive: true, detail: { key: "insights.stability.diversificationGood" } }),
    ];
    const result = computeScoreFromFactors(mixed, true);
    expect(result.positiveFactors).toHaveLength(2);
    expect(result.warningFactors).toHaveLength(1);
    expect(result.warningFactors[0].key).toBe("insights.stability.cashflowInconsistent");
  });

  it("never fabricates a score from zero available factors", () => {
    const noneAvailable = ALL_FIVE_MAX.map((f) => ({ ...f, available: false, points: 0, detail: null }));
    const result = computeScoreFromFactors(noneAvailable, true);
    expect(result.status).toBe("not-enough-data");
    expect(result.score).toBeNull();
  });
});
