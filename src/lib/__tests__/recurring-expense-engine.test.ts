import { describe, it, expect } from "vitest";
import { clampDayOfMonth } from "../recurring-expense-engine";

describe("clampDayOfMonth", () => {
  it("returns the exact day for a normal month", () => {
    const d = clampDayOfMonth(2026, 0, 15); // January
    expect(d.getUTCFullYear()).toBe(2026);
    expect(d.getUTCMonth()).toBe(0);
    expect(d.getUTCDate()).toBe(15);
  });

  it("clamps day 28 in February of a non-leap year (unaffected — already valid)", () => {
    const d = clampDayOfMonth(2026, 1, 28); // Feb 2026, not a leap year
    expect(d.getUTCDate()).toBe(28);
  });

  it("clamps a day beyond a short month's real length", () => {
    // dayOfMonth is constrained to 1-28 at the form level, but the function
    // itself should stay safe even if that constraint is ever relaxed.
    const d = clampDayOfMonth(2026, 1, 30); // Feb 2026 only has 28 days
    expect(d.getUTCMonth()).toBe(1);
    expect(d.getUTCDate()).toBe(28);
  });

  it("clamps correctly in a leap year February", () => {
    const d = clampDayOfMonth(2028, 1, 30); // 2028 is a leap year — Feb has 29 days
    expect(d.getUTCDate()).toBe(29);
  });

  it("floors below 1", () => {
    const d = clampDayOfMonth(2026, 5, 0);
    expect(d.getUTCDate()).toBe(1);
  });
});
