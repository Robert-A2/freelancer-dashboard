# Revenue Trust Audit

> **Phase 1 — Revenue Foundation**
> This document maps every place in the product where positive incoming transactions
> influence a metric. For each surface: what is calculated today, the trust risk,
> and the desired calculation after the Payer Identity Engine is wired.

---

## Governing Principle

The product must answer:

> **"How much money did this freelancer actually earn from clients?"**

Not: how much entered the bank account.
Not: which transactions have `transactionType = "income"`.
Not: which amounts are above a threshold.

Revenue is established through **payer behaviour** — repeated payments from a
known identity, at recognisable intervals, from a non-institutional source.

---

## Trust Architecture (implemented)

### Payer Identity Engine (`src/lib/payer-engine.ts`)

Every incoming transaction is answered with "who sent this money?" before any
revenue classification occurs.

**Payer types:**

| Type | Revenue? | Basis |
|---|---|---|
| `client` | Yes — confidence from payment history | Freelance client |
| `employer` | Yes — HIGH confidence | Payroll / salary source |
| `platform` | Yes — HIGH when 2+ payments | Upwork, Stripe, PayPal, Fiverr, Malt… |
| `bank` | **Never** | Financial institution transfers |
| `government` | **Never** | Tax refunds, social benefits, CAF, HMRC |
| `refund_source` | **Never** | Purchase reversals, cashback |
| `unknown` | Accumulates — rises with each payment | Unclassified on first appearance |

**Revenue confidence levels (per payer):**

| Confidence | Condition | MonthlyAnalytics column |
|---|---|---|
| `high` | 3+ payments with cadence, OR 6+ payments total | `verifiedRevenue` |
| `medium` | 2+ payments from same payer | `likelyRevenue` |
| `low` | Single payment, unknown payer | `reviewRevenue` |
| `none` | Payer type = bank / government / refund_source | Excluded from all revenue |

---

## Calculation Surface Map

### 1. Dashboard Revenue Card

| | Before | After |
|---|---|---|
| **Current calculation** | `MonthlyAnalytics.totalIncome` — sum of all `transactionType = "income"` rows | `MonthlyAnalytics.verifiedRevenue` — sum from HIGH-confidence payers only |
| **Trust risk** | A €10,000 savings withdrawal displays as "€10,000 income this month." A loan disbursement becomes the "best month of the year." | — |
| **Desired calculation** | Payer-derived: only payments from payers with `revenueConfidence = "high"` | **Implemented in schema** — wiring to UI card is Phase 3 |

---

### 2. Monthly Comparison (income change %)

| | Before | After |
|---|---|---|
| **Current calculation** | `changePct(curr.totalIncome, prev.totalIncome)` | `changePct(curr.verifiedRevenue, prev.verifiedRevenue)` |
| **Trust risk** | March has a €5,000 loan → April has €5,000 real client payment. Comparison reads "Income down 0%". A loan repayment month vs a strong client month shows a phantom collapse. | — |
| **Desired calculation** | Compare verified revenue month-over-month | **Implemented** — `changes.income` now uses `verifiedRevenue` |

---

### 3. Historical Trend Chart

| | Before | After |
|---|---|---|
| **Current calculation** | `getHistoricalData` returns `income: rec.totalIncome` — 12–24 months of raw inflows | Returns `verifiedRevenue`, `likelyRevenue`, `reviewRevenue` per month |
| **Trust risk** | Savings withdrawal every December creates an annual spike. The chart tells the user "Q4 is always strong." The forecast learns from this false seasonal pattern. | — |
| **Desired calculation** | Three bars: verified (dark) + likely (medium) + review (muted). Raw inflows visible only in a separate "Bank Activity" view. | **`MonthPoint` type updated** — UI bar chart wiring is Phase 3 |

---

### 4. Forecast — Projected Income

| | Before | After |
|---|---|---|
| **Current calculation** | `weightedAvg(records.map(r => r.totalIncome))` — loan or savings withdrawal inflates 3× weighted recent months | `weightedAvg(records.map(r => r.verifiedRevenue))` |
| **Trust risk** | A user who took a €20,000 business loan in March will receive a forecast of "~€20,000 next month." They may plan spending against income that does not exist. | — |
| **Desired calculation** | Project verified revenue only. Unresolved inflows are surfaced as "unclassified incoming" — excluded from forward projection. | **Pending** — forecast engine still reads `totalIncome` (Phase 6) |

---

### 5. Forecast — Seasonality Model

| | Before | After |
|---|---|---|
| **Current calculation** | `buildSeasonalMap(records.map(r => r.totalIncome))` | Built from `verifiedRevenue` series |
| **Trust risk** | User withdraws savings every December → December seasonal factor is inflated. Every December projection is permanently too high. | — |
| **Desired calculation** | Seasonal pattern derived from payer payment history, not bank activity | **Pending** — Phase 6 |

---

### 6. Forecast — Confidence / Volatility Score

| | Before | After |
|---|---|---|
| **Current calculation** | `stdDev(incomes) / mean(incomes)` where `incomes = records.map(r => r.totalIncome)` | Same formula applied to `verifiedRevenue` series |
| **Trust risk** | One loan disbursement creates high variance → confidence score drops → forecast shows "low confidence." The freelancer's actual client revenue may be perfectly stable. | — |
| **Desired calculation** | Volatility of verified revenue only | **Pending** — Phase 6 |

---

### 7. Income Concentration Risk

| | Before | After |
|---|---|---|
| **Current calculation** | `transactionType = "income"` last 12 months, grouped by description prefix | Transactions with resolved `payerId`, grouped by payer canonical name, excluding bank/government/refund payers |
| **Trust risk** | User's savings account (monthly transfer: "VIREMENT CIC LIVRET A") appears as the "2nd largest income source" with 40% concentration. Dashboard fires a false high-concentration warning. | — |
| **Desired calculation** | Concentration measured only over identified revenue payers | **Implemented** — `getIncomeConcentration` now uses payer identity |

---

### 8. Client Insights / Trust Center

| | Before | After |
|---|---|---|
| **Primary path** | `intent IN ("freelance_income", "salary")` — correct but limited coverage | Payer-resolved transactions (excludes bank/government/refund payers) |
| **Fallback path** | `transactionType = "income" AND amount >= 5 AND NOT category = "refund"` — savings and loans leak through | Payer-resolved transactions as the fallback — if payer engine hasn't run, fall back to intent-classified |
| **Trust risk** | Savings bank appears as "Client #2". Loan disbursement bank appears as a one-time client. Revenue share percentages computed against inflated denominator. | — |
| **Desired calculation** | Clients = identified payers with at least MEDIUM confidence (2+ payments) | **Implemented** — both `getClientInsights` and `getClientRiskProfiles` updated |

---

### 9. Business Intelligence Insights

| | Before | After |
|---|---|---|
| **Current calculation** | All insights built from `current.totalIncome`, `history[].income` (MonthlyAnalytics raw) | Should use `verifiedRevenue` and `likelyRevenue` for all "earned income" language |
| **Trust risk** | "Your income was €3,200 above average this month" fires because of a savings withdrawal. Health status shows "Healthy" because a loan padded cashflow. Income trend direction computed incorrectly. | — |
| **Desired calculation** | All intelligence text referencing "revenue", "income", or "earnings" must draw from payer-derived figures | **Pending** — Phase 7 (Insight Verification) |

---

### 10. Financial Life Engine

| | Before | After |
|---|---|---|
| **Current calculation** | Uses `INCOME_INTENTS: ["freelance_income", "salary"]` — nominally correct. But savings withdrawals that received `freelance_income` intent via medium-confidence fallback pollute the figures. | Should use payer confidence directly — `revenueConfidence IN ("high", "medium")` |
| **Trust risk** | `avgMonthlyRevenue12m` is overstated. Health scoring inflated. "Strongest income month" is the month of a savings withdrawal. | — |
| **Desired calculation** | Revenue = sum over payers with HIGH or MEDIUM confidence | **Pending** — Phase 7 |

---

## What Is Implemented

| # | Surface | Status |
|---|---|---|
| Schema | `Payer`, `PayerAlias`, `PayerType` enum | ✅ Done |
| Schema | `MonthlyAnalytics.verifiedRevenue / likelyRevenue / reviewRevenue` | ✅ Done |
| Schema | `Transaction.payerId` FK to Payer | ✅ Done |
| Engine | `payer-engine.ts` — extract, normalize, resolve, profile, confidence | ✅ Done |
| Engine | `resolvePayers()` called on every import | ✅ Done |
| Engine | `recomputeVerifiedRevenue()` updates MonthlyAnalytics after each import | ✅ Done |
| Analytics | `MonthPoint` type includes `verifiedRevenue`, `likelyRevenue`, `reviewRevenue` | ✅ Done |
| Analytics | `getMonthlyComparison.changes.income` uses `verifiedRevenue` | ✅ Done |
| Analytics | `getIncomeConcentration` uses payer identity | ✅ Done |
| Analytics | `getClientInsights` fallback uses payer identity | ✅ Done |
| Client Risk | `getClientRiskProfiles` primary uses payer identity | ✅ Done |
| Forecast | Uses `verifiedRevenue` for income projection | ⏳ Phase 6 |
| Intelligence | All insight copy uses `verifiedRevenue` | ⏳ Phase 7 |
| UI | Dashboard revenue card shows `verifiedRevenue` | ⏳ Phase 3 |
| UI | Trend chart shows three revenue tiers | ⏳ Phase 3 |
| UI | Revenue Audit Center (clickable monthly breakdown) | ⏳ Phase 3 |

---

## Payer Engine — Confidence Rules

```
NONE   → payerType in (bank, government, refund_source)
         Zero revenue contribution regardless of amount or frequency.

LOW    → 1 payment, unknown payer
         Shows in "Needs Review" queue.
         Cannot be forecast or relied upon.

MEDIUM → 2+ payments from same payer (they returned — likely real)
         Contributes to likelyRevenue.
         Shown with a "likely" indicator in UI.

HIGH   → 3+ payments with detectable cadence (weekly / bi-weekly / monthly / quarterly)
         OR 6+ payments regardless of cadence
         Contributes to verifiedRevenue.
         Shown as confirmed earnings.
```

---

## Phase Roadmap

| Phase | What | Status |
|---|---|---|
| 1 | Revenue Foundation — audit every calculation surface | ✅ This document |
| 2 | Payer Identity Engine — extract, normalize, confidence | ✅ Implemented |
| 3 | Revenue Audit Center — clickable monthly breakdown UI | ⏳ Next |
| 4 | Multi-Account Readiness — architecture for transfer detection | ⏳ Design only |
| 5 | Client Identity Resolution — alias grouping improvements | ⏳ Partially in payer engine |
| 6 | Forecast Trust Audit — wire forecast to `verifiedRevenue` | ⏳ Pending |
| 7 | Insight Verification — all intelligence text traceable to evidence | ⏳ Pending |
