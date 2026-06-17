# Intent-Aware Financial Calculations — Implementation Status

All changes below have been implemented and are live in production (as of 2026-06-17).
Companion to FINANCIAL_MODEL.md and INTENT_TO_CALCULATION_MAPPING.md.

---

## Change 1 — New analytics function: `getIntentBreakdown` ✓ DONE

**File:** `src/lib/analytics-engine.ts`
**Type:** Additive — new export, no existing code changed.
**Schema migration required:** No.

Adds a new function that queries `Transaction` directly (not `MonthlyAnalytics`) and
groups amounts by `intent`. Returns the full intent-based financial picture for a given
month, or for all time.

```ts
export interface IntentBreakdown {
  // Business P&L
  businessRevenue:  number;
  businessCosts:    number;
  businessProfit:   number;
  profitMarginPct:  number | null;  // null when revenue = 0

  // Personal
  personalSpend:    number;
  debtService:      number;
  totalObligations: number;

  // Allocation
  savingsMovement:  number;
  investmentFlow:   number;
  ownerDraw:        number;

  // Other income
  passiveIncome:    number;
  refunds:          number;

  // True cashflow (corrects the transfer blind spot)
  trueNetCashflow:  number;

  // Coverage — how much of the data has intent populated
  totalTransactions:        number;
  intentClassifiedCount:    number;
  intentCoveragePct:        number;
  hasEnoughDataForDisplay:  boolean;  // true when intentCoveragePct >= 80
}

export async function getIntentBreakdown(
  userId: string,
  year?: number,
  month?: number,
): Promise<IntentBreakdown>
```

Implementation logic:
- If `year` and `month` provided: filter to that month only.
- If neither provided: all-time totals.
- Group by `intent`, sum `amount`.
- Apply sign by `transactionType` (income = positive, expense = negative, savings/transfer = as-is).
- Compute derived fields from the raw intent sums.
- `intentCoveragePct` = count of rows where `intent IS NOT NULL` / total count.
- `hasEnoughDataForDisplay` = `intentCoveragePct >= 80`.

**Why not pre-aggregate into `MonthlyAnalytics`?**
Querying `Transaction` directly keeps this Change 1. Pre-aggregating would require a
schema migration (Change 2 below). Start with on-the-fly computation — optimise only
if profiling shows it is slow (it will not be at this data scale).

---

## Change 2 — Extend `MonthlyAnalytics` with intent columns ⏸ DEFERRED

**File:** `prisma/schema.prisma` + `src/lib/analytics-engine.ts`
**Type:** Schema migration required.
**Defer until:** `getIntentBreakdown` has been validated in production for ≥1 sprint.

Adds pre-aggregated intent columns to `MonthlyAnalytics` so intent KPIs are as fast as
the existing dashboard queries. This is an optimisation, not a correctness change.

```prisma
model MonthlyAnalytics {
  // ... existing fields unchanged ...
  businessRevenue  Decimal @db.Decimal(12, 2) @default(0)
  businessCosts    Decimal @db.Decimal(12, 2) @default(0)
  businessProfit   Decimal @db.Decimal(12, 2) @default(0)
  personalSpend    Decimal @db.Decimal(12, 2) @default(0)
  debtService      Decimal @db.Decimal(12, 2) @default(0)
  investmentFlow   Decimal @db.Decimal(12, 2) @default(0)
}
```

Update `recalculateMonthlyAnalytics` to also compute and upsert these fields alongside
the existing `totalIncome`/`totalExpenses`/`totalSavings`/`netCashflow`.

Migration is safe: all new columns have `@default(0)` so existing rows are not affected.
Existing rows will show 0 until `recategorize-all` is run (same graceful-fallback logic
as `getIntentBreakdown`).

**Deferred indefinitely.** `getIntentBreakdown` is fast enough at the current dataset size (~2,500 transactions). Revisit if the dataset exceeds ~10,000 transactions.

---

## Change 3 — Extend the forecast engine ✓ DONE

**File:** `src/lib/forecast-engine.ts`
**Type:** Additive — extend `ForecastResult`, extend `generateForecast`.
**Schema migration required:** Yes (extend `Forecast` model) OR store as JSON.

Adds intent-aware projected values to the forecast. Two sub-changes:

### 3a — Extend `ForecastResult`

```ts
interface ForecastResult {
  // existing (unchanged)
  projectedIncome:   number;
  projectedExpenses: number;
  projectedSavings:  number;
  projectedCashflow: number;

  // new
  projectedBusinessRevenue: number;
  projectedBusinessCosts:   number;
  projectedBusinessProfit:  number;
  projectedPersonalSpend:   number;
  projectedDebtService:     number;
}
```

### 3b — Per-intent forecast algorithms

`generateForecast` currently queries `MonthlyAnalytics`. Intent-based projections must
query `Transaction` directly (or `MonthlyAnalytics` if Change 2 has been implemented).

Four distinct algorithms (see FINANCIAL_MODEL.md §5):
1. `freelance_income` + `salary` → existing weighted average (no change needed)
2. `loan_repayment` + `subscription` → fixed commitment (last 3-month average, not long window)
3. `business_expense` + `tax_payment` → weighted average with tax-spike month detection
4. `personal_expense` + `family_support` → rolling 3-month average

### 3c — Schema change for `Forecast` model

Option A: Add columns to the `Forecast` table (requires migration).
Option B: Store the intent breakdown as a `Json` field on `Forecast` (no migration).

**Recommend Option B for Phase 1** — avoids a migration while the shape of the new
forecast is still being validated. Migrate to columns in Phase 2.

```prisma
model Forecast {
  // ... existing fields unchanged ...
  intentBreakdown Json?  // IntentForecastBreakdown — null until intent is back-filled
}
```

---

## Change 4 — Update the intelligence engine ✓ DONE

**File:** `src/lib/intelligence-engine.ts`
**Type:** Additive for new insights; one change to `healthStatus` logic.
**Schema migration required:** No.

### 4a — `healthStatus` correction

Current logic (approximate):
```ts
healthStatus = netCashflow > 0 ? "healthy" : netCashflow > -X ? "watch" : "at-risk"
```

Proposed logic (when intent data is available):
```ts
if (businessProfit > 0 && trueNetCashflow > 0)  → "healthy"
if (businessProfit > 0 && trueNetCashflow <= 0)  → "watch"   // spending more than earning
if (businessProfit <= 0 && trueNetCashflow > 0)  → "watch"   // business losing, masked by other income
if (businessProfit <= 0 && trueNetCashflow <= 0) → "at-risk"
```

Graceful fallback: if `intentCoveragePct < 80`, use existing `netCashflow`-based logic.

### 4b — New insights

New insight keys to add to the intelligence engine (rendered via i18n):

```ts
// Business profit health
"businessProfitHealthy"      // "Your business generated €X profit in {month}"
"businessProfitNegative"     // "Business costs exceeded revenue by €X in {month}"
"profitMarginStrong"         // "Profit margin is X% — strong for a freelance business"
"profitMarginLow"            // "Profit margin is X% — {month}'s costs are compressing it"

// Hidden cashflow corrections
"familySupportCost"          // "Family support commitments total €X/month"
"debtServiceBurden"          // "Loan repayments commit €X/month before any spending"
"trueVsReportedCashflow"     // "Including transfers, your true cashflow is €X (not €Y)"

// Investment and savings
"investmentActivity"         // "You deployed €X to investments in {month}"
"savingsConsistency"         // "You've saved consistently for N months"
```

---

## Change 5 — New API endpoint ✓ DONE

**File:** `src/app/api/analytics/intent-breakdown/route.ts`
**Type:** New file.
**Schema migration required:** No.

```ts
GET /api/analytics/intent-breakdown?year=2025&month=3
```

Returns `IntentBreakdown` for the requested month (or all-time if no params).
Used by the dashboard and analytics pages to display intent-aware KPIs.

The dashboard page already calls `/api/dashboard` for the existing summary. Intent KPIs
are fetched separately so the main dashboard load is not blocked by the intent query,
and intent KPIs can be hidden gracefully when coverage is insufficient.

---

## Change 6 — Dashboard API response extension ✓ DONE

**File:** `src/app/api/dashboard/route.ts`
**Type:** Additive — new optional fields in the response.
**Schema migration required:** No.

Add `intentBreakdown: IntentBreakdown | null` to the dashboard API response. Pass `null`
when `intentCoveragePct < 80`. The frontend renders the "back-fill required" state when
this field is null.

---

## Implementation order

These changes are designed to be independent and safe to ship in sequence:

| Order | Change | Risk | Prerequisite |
|---|---|---|---|
| 1 | `getIntentBreakdown` function | Very low | Back-fill via recategorize-all |
| 2 | New API endpoint (Change 5) | Very low | Change 1 |
| 3 | Dashboard API extension (Change 6) | Low | Change 1 |
| 4 | Intelligence engine insights (Change 4b) | Low | Change 1 |
| 5 | `healthStatus` correction (Change 4a) | Medium | Change 1 + sufficient intent coverage |
| 6 | Forecast engine extension (Change 3) | Medium | Change 1 |
| 7 | `MonthlyAnalytics` extension (Change 2) | Low (migration) | All above validated |

**Do not implement Changes 2 or 3 before Change 1 has been running in production for
at least one upload cycle.**

---

## What is explicitly not changing

- `recalculateMonthlyAnalytics` bucketing (income/expense/savings/transfer)
- `MonthlyAnalytics.totalIncome`, `totalExpenses`, `totalSavings`, `netCashflow` values or meaning
- The forecast engine's core weighted-average and seasonal adjustment algorithms
- Any existing API response fields (only additions)
- The `Transaction` unique constraint or deduplication behaviour
- The categorization engine
