# Financial Model

## 1. The problem with the current model

The current model has three blind spots that the Intent Layer exposes:

**Blind spot 1 — All income is one bucket.**
`totalIncome` mixes freelance client revenue, salary, dividends, and refunds. A freelancer
cannot see their actual business revenue vs passive income from the dashboard.

**Blind spot 2 — All expenses are one bucket.**
`totalExpenses` mixes costs of running the business (software, tax, subscriptions) with personal
spending (food, rent, health). Business profit cannot be calculated.

**Blind spot 3 — Transfers are invisible.**
Transactions classified as `transactionType: "transfer"` are fully excluded from income AND
expenses. This means:
- A €500/month WorldRemit payment to family → counted as zero in cashflow
- A €1,200/month loan repayment → counted as zero in cashflow
- The user's reported `netCashflow` is systematically higher than their true available cash

The intent layer resolves all three.

---

## 2. The new model: three financial lenses

The new model does not replace the existing `transactionType` bucketing. It adds three
independent lenses that can be computed from the `intent` field on `Transaction`.

### Lens A — Business P&L

Answers: *Is my freelance business profitable?*

```
Business Revenue  = sum of transactions where intent IN (freelance_income, salary)
Business Costs    = sum of transactions where intent IN (business_expense, tax_payment, subscription)
Business Profit   = Business Revenue − Business Costs
```

This is the primary new KPI. Every freelancer runs a business from their bank account.
Business Profit is what they are actually earning from that business before personal decisions
(how much to save, send to family, repay in debt) are made.

### Lens B — Personal financial activity

Answers: *What is my true personal burn rate?*

```
Personal Spend    = sum of transactions where intent IN (personal_expense, family_support)
Debt Service      = sum of transactions where intent = loan_repayment
Total Obligations = Personal Spend + Debt Service
```

This is what the current model misses entirely. `family_support` and `loan_repayment` were
previously classified as `transfer` and excluded. They are real cash outflows.

### Lens C — Wealth allocation

Answers: *Where is my money being put to work?*

```
Savings Movement  = sum of transactions where intent = savings_transfer
Investment Flow   = sum of transactions where intent = investment
Owner Draw        = sum of transactions where intent = owner_draw
Total Allocation  = Savings Movement + Investment Flow + Owner Draw
```

These are not income, not expenses, not costs. They are financial decisions about where
to deploy money that has already been earned. They affect liquidity but not profit.

---

## 3. True net cashflow (corrected)

The existing formula:
```
netCashflow = totalIncome − totalExpenses
```

This excludes transfers entirely. With intent, we can compute a corrected cashflow that
captures what previously fell through:

```
trueNetCashflow = businessRevenue
                + passiveIncome
                + refunds
                − businessCosts
                − personalSpend
                − debtService
```

`internal_transfer`, `savings_transfer`, `investment`, and `owner_draw` are still
excluded — they are within-ecosystem movements that do not change total wealth.

The difference between `netCashflow` (current) and `trueNetCashflow` (new) is the
sum of all transactions previously hidden as `transfer` that are actually cash outflows:
principally `family_support` and `loan_repayment`.

---

## 4. Intent impact on financial calculations — summary

| Intent | Business Profit | True Cashflow | Previous treatment |
|---|---|---|---|
| `freelance_income` | Revenue ↑ | In ↑ | income (correct) |
| `salary` | Revenue ↑ | In ↑ | income (correct) |
| `passive_income` | No effect | In ↑ | income (correct) |
| `refund` | Costs ↓ (business) or no effect (personal) | In ↑ | income (correct) |
| `business_expense` | Costs ↑ | Out ↑ | expense (correct) |
| `tax_payment` | Costs ↑ | Out ↑ | expense (correct) |
| `subscription` | Costs ↑ | Out ↑ | expense (correct) |
| `personal_expense` | No effect | Out ↑ | expense (correct) |
| `family_support` | No effect | **Out ↑ ← WAS INVISIBLE** | transfer (excluded) |
| `loan_repayment` | No effect | **Out ↑ ← WAS INVISIBLE** | transfer (excluded) |
| `savings_transfer` | No effect | No effect | savings (correct) |
| `investment` | No effect | No effect | savings (correct) |
| `owner_draw` | No effect | No effect | transfer (excluded, correct) |
| `internal_transfer` | No effect | No effect | transfer (excluded, correct) |

---

## 5. Forecasting model redesign

The current forecast engine (`src/lib/forecast-engine.ts`) computes a single weighted
average of `totalIncome` and `totalExpenses` across all months. With intent, four distinct
forecast patterns exist — each with different reliability characteristics.

### Pattern 1 — Business revenue (high variability, seasonality-sensitive)
Intent: `freelance_income`, `salary`

Forecast method: **retain existing weighted average + seasonal adjustment**.
Freelance income is already the hardest to forecast; the current algorithm handles it well.
Salary is more stable and would benefit from a recency bias.

### Pattern 2 — Fixed obligations (near-zero variability)
Intent: `loan_repayment`, recurring `subscription`

Forecast method: **use the actual last-known value, not an average**.
A mortgage payment does not change month to month. Averaging introduces artificial variance.
These should be treated as fixed commitments, not estimated.

### Pattern 3 — Business costs (low variability, spike risk)
Intent: `business_expense`, `tax_payment`, `subscription` (non-fixed)

Forecast method: **weighted average with tax-spike flagging**.
Tax payments create annual spikes (quarterly or yearly). The forecast should identify
months where tax has historically been paid and flag them with elevated expense projection.

### Pattern 4 — Personal spending (medium variability, lifestyle-stable)
Intent: `personal_expense`, `family_support`

Forecast method: **rolling 3-month average** (more stable than business revenue).
Personal spending patterns are more stable than business income. A simple recent-months
average outperforms a long weighted average because lifestyle changes are gradual.

### New forecast output shape

```ts
interface ForecastResult {
  // existing (unchanged)
  projectedIncome:   number;
  projectedExpenses: number;
  projectedSavings:  number;
  projectedCashflow: number;

  // new (intent-aware)
  projectedBusinessRevenue: number;
  projectedBusinessCosts:   number;
  projectedBusinessProfit:  number;
  projectedPersonalSpend:   number;
  projectedDebtService:     number;  // fixed commitment, high confidence
  projectedTrueNetCashflow: number;
}
```

---

## 6. Dashboard KPI redesign

### Current KPIs (unchanged, still present)

| KPI | Source | Notes |
|---|---|---|
| Total Income | `MonthlyAnalytics.totalIncome` | All income transactions |
| Total Expenses | `MonthlyAnalytics.totalExpenses` | All expense transactions |
| Net Cashflow | `totalIncome − totalExpenses` | Excludes transfers |
| Savings | `MonthlyAnalytics.totalSavings` | Savings-type transactions |

These remain as the base layer. They are what every other engine depends on and must not
change. The new KPIs sit alongside them.

### New KPIs (intent-aware, additive)

| KPI | Formula | Why it matters |
|---|---|---|
| Business Revenue | `sum(freelance_income + salary)` | The true revenue of the freelance business |
| Business Profit | `Business Revenue − Business Costs` | **Primary new headline metric** |
| Business Costs | `sum(business_expense + tax_payment + subscription)` | What it costs to run the business |
| Personal Burn Rate | `sum(personal_expense + family_support)` | True personal spending |
| Debt Service | `sum(loan_repayment)` | Fixed obligations, often invisible today |
| True Net Cashflow | See §3 formula | Actual liquidity change including hidden transfers |
| Investment Activity | `sum(investment)` | Capital deployed to markets |
| Profit Margin | `Business Profit / Business Revenue × 100` | Business efficiency ratio |

### Health status logic change

Current `healthStatus` in the intelligence engine uses `netCashflow` to determine
"healthy" / "watch" / "at-risk". With intent data available, health should use
`businessProfit` as the primary signal, since a positive `netCashflow` is possible
even when the business is losing money (e.g. if passive income or a one-off windfall
masks operating losses).

```
Proposed health thresholds:
  healthy   → businessProfit > 0 AND trueNetCashflow > 0
  watch     → businessProfit > 0 AND trueNetCashflow < 0  (spending more than earning)
              OR businessProfit < 0 AND trueNetCashflow > 0  (business losing, windfall masking it)
  at-risk   → businessProfit < 0 AND trueNetCashflow < 0
```

---

## 7. Dependency on back-fill

All intent-aware calculations require the `intent` field to be populated. Currently all
2,444 existing transactions have `intent = null`. Two categories of data exist:

**New transactions** (uploaded after the intent layer was deployed): intent is classified
at import time — fully functional.

**Existing transactions** (all 2,444 current rows): intent is null until the user runs
`POST /api/transactions/recategorize-all`. Until then, intent-aware KPIs will compute as
zero or be hidden from the dashboard with a "back-fill required" state.

This means **intent-aware KPIs cannot be the primary dashboard view until the user has
back-filled**. The implementation must handle the graceful fallback:
- If `businessRevenue = 0` AND `businessProfit = 0` AND user has transactions → show
  "Intent classification in progress" state, not "You earned €0".

---

## 8. What does not change

- `transactionType` values and their meaning
- `recalculateMonthlyAnalytics` bucketing logic
- `MonthlyAnalytics.totalIncome`, `totalExpenses`, `totalSavings`, `netCashflow`
- The forecast engine's core weighted-average algorithm
- All existing API response shapes (new fields are additive)
- The deduplication key on `Transaction`
