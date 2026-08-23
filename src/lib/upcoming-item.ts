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
