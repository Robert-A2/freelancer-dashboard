import { describe, it, expect } from "vitest";
import { bucketUpcomingByWindow } from "../upcoming-item";
import type { UpcomingItem } from "../upcoming-item";

const now = new Date("2026-08-24T00:00:00Z");
const daysFromNow = (n: number) => new Date(now.getTime() + n * 24 * 60 * 60 * 1000);

function income(amount: number, inDays: number): UpcomingItem {
  return { kind: "expected_income", id: `inc-${inDays}`, label: "x", amount, date: daysFromNow(inDays) };
}
function expense(amount: number, inDays: number): UpcomingItem {
  return { kind: "recurring_expense", id: `exp-${inDays}`, label: "x", amount, date: daysFromNow(inDays) };
}

describe("bucketUpcomingByWindow", () => {
  it("returns zeroed buckets for no items", () => {
    const buckets = bucketUpcomingByWindow([], now);
    expect(buckets).toEqual([
      { throughDay: 30, expectedIncome: 0, committedExpenses: 0, net: 0 },
      { throughDay: 60, expectedIncome: 0, committedExpenses: 0, net: 0 },
      { throughDay: 90, expectedIncome: 0, committedExpenses: 0, net: 0 },
    ]);
  });

  it("is cumulative — a day-45 item counts in the 60 and 90 buckets but not 30", () => {
    const buckets = bucketUpcomingByWindow([income(1000, 45)], now);
    expect(buckets[0].expectedIncome).toBe(0);   // 30
    expect(buckets[1].expectedIncome).toBe(1000); // 60
    expect(buckets[2].expectedIncome).toBe(1000); // 90
  });

  it("separates income and expenses, and computes net", () => {
    const buckets = bucketUpcomingByWindow([income(1000, 10), expense(300, 20)], now);
    expect(buckets[0]).toEqual({ throughDay: 30, expectedIncome: 1000, committedExpenses: 300, net: 700 });
  });

  it("still counts an overdue (past-due, still-pending) item in every window — it didn't stop being expected just because it's late", () => {
    const buckets = bucketUpcomingByWindow([income(500, -5)], now);
    expect(buckets[0].expectedIncome).toBe(500); // 30
    expect(buckets[1].expectedIncome).toBe(500); // 60
    expect(buckets[2].expectedIncome).toBe(500); // 90
  });

  it("excludes items beyond the 90-day horizon", () => {
    const buckets = bucketUpcomingByWindow([income(500, 91)], now);
    expect(buckets[2].expectedIncome).toBe(0);
  });

  it("includes multiple occurrences of the same recurring expense independently", () => {
    const buckets = bucketUpcomingByWindow([expense(50, 5), expense(50, 35), expense(50, 65)], now);
    expect(buckets[0].committedExpenses).toBe(50);
    expect(buckets[1].committedExpenses).toBe(100);
    expect(buckets[2].committedExpenses).toBe(150);
  });
});
