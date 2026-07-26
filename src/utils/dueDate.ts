// A milestone's dueDate comes from an <input type="date"> value (e.g.
// "2026-07-13") and is stored as `new Date("2026-07-13")`, which JavaScript
// always parses as UTC midnight — not the freelancer's local midnight.
// Comparing that instant directly against `new Date()` (the exact current
// moment) flips a milestone to "overdue" partway through its own due date —
// up to a full day early for anyone in a timezone west of UTC. "Due on
// July 13" should mean the client has the entire 13th; it only becomes
// overdue once that UTC calendar day has fully passed. This compares by UTC
// calendar day instead of by exact instant so that never happens early.
export function isPastDueDate(dueDate: Date | string, now: Date = new Date()): boolean {
  const due = typeof dueDate === "string" ? new Date(dueDate) : dueDate;
  const todayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const dueUTC = Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate());
  return todayUTC > dueUTC;
}
