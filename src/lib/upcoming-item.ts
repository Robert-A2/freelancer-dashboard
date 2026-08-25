// Client-safe types/helpers shared between server (today-facts.ts) and
// client components (UpcomingList.tsx, ExpectedPaymentDrawer.tsx). Kept
// deliberately free of any server-only import (prisma, etc.) — today-
// facts.ts pulls in prisma at module scope, so a client component
// importing anything from that file (even just a type) drags prisma's
// Node-only internals (fs, etc.) into the browser bundle and breaks the
// build ("Module not found: Can't resolve 'fs'").

export interface UpcomingItem {
  kind: "expected_income" | "recurring_expense";
  id: string;
  /** Display name — already resolved via expectedPaymentDisplayName's clientName/projectName/generic fallback chain. Use this to render, never to seed an edit form. */
  label: string;
  /** Raw stored values, set only for expected_income items — use these (not label) when seeding an edit form, since label may be a fallback rather than what's actually stored. */
  clientName?: string | null;
  projectName?: string | null;
  amount: number;
  date: Date;
}

// Both clientName and projectName are optional on ExpectedPayment — this is
// the one place that decides what to show/store when neither, either, or
// both are set, so every caller (Transaction.description, UpcomingItem.label,
// the Dashboard card) agrees. Never returns an empty string.
export function expectedPaymentDisplayName(clientName: string | null, projectName: string | null): string {
  return clientName?.trim() || projectName?.trim() || "Expected payment";
}

export interface CashWindowBucket {
  throughDay: 30 | 60 | 90;
  expectedIncome: number;
  committedExpenses: number;
  net: number;
}

// Cumulative 30/60/90-day buckets over the real upcoming items (expected
// income + every projected recurring-expense occurrence within the horizon —
// see today-facts.ts's getUpcomingCashWindow, which is the only caller that
// actually projects multiple occurrences; getTodayFacts()'s own `upcoming`
// stays single-next-occurrence and is not a valid input here for expenses
// beyond the first one). Cumulative because "what's coming in the next 60
// days" naturally includes the next 30, not a separate slice of it.
//
// An item whose date has already passed (days < 0) is still pending, not
// resolved — it didn't stop being expected just because it's late. It's
// counted in every window rather than dropped, so it can't silently vanish
// from this view while the exact same item is still shown "overdue"
// elsewhere (e.g. TodayLayer's "Coming up" list).
export function bucketUpcomingByWindow(items: UpcomingItem[], now: Date = new Date()): CashWindowBucket[] {
  const dayMs = 24 * 60 * 60 * 1000;
  const daysFromNow = (d: Date) => Math.ceil((d.getTime() - now.getTime()) / dayMs);

  const windows: Array<30 | 60 | 90> = [30, 60, 90];
  return windows.map((throughDay) => {
    let expectedIncome = 0;
    let committedExpenses = 0;
    for (const item of items) {
      const days = daysFromNow(item.date);
      if (days > throughDay) continue;
      if (item.kind === "expected_income") expectedIncome += item.amount;
      else committedExpenses += item.amount;
    }
    return { throughDay, expectedIncome, committedExpenses, net: expectedIncome - committedExpenses };
  });
}

export type ExpectedPaymentDisplayStatus = "expected" | "dueToday" | "overdue";

// Derived at read time, never stored — an expected payment's expectedDate
// passing never auto-converts it to income (spec section 8); this only
// changes how it's labeled until the user acts on it.
export function getExpectedPaymentDisplayStatus(expectedDate: Date, now: Date = new Date()): {
  status: ExpectedPaymentDisplayStatus;
  overdueDays: number;
} {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const due = Date.UTC(expectedDate.getUTCFullYear(), expectedDate.getUTCMonth(), expectedDate.getUTCDate());
  const diffDays = Math.round((today - due) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return { status: "dueToday", overdueDays: 0 };
  if (diffDays > 0) return { status: "overdue", overdueDays: diffDays };
  return { status: "expected", overdueDays: 0 };
}
