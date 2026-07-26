# Product

- **What it does**: Describes Nonodia at the product level — what it is, who it's for, the philosophy behind its design decisions, and the value it promises users.
- **Why it exists**: Every other doc in `/docs` explains *how* something works. This one explains *why it works that way* — the intent behind the categorization engine, the forecast, the insights, and the "your data is yours" privacy posture all trace back to the philosophy in §3.
- **Where the code is**: The product's "voice" lives in `src/app/page.tsx` (the landing page) and the `landing` namespace in `messages/en.json` / `messages/fr.json`. The actual *delivery* of these promises is spread across the engines documented elsewhere (cross-referenced throughout).
- **How to modify it safely**: see [How to modify](#how-to-modify-safely) at the bottom.

---

## 1. What Nonodia is

**Nonodia** ("Nonodia: Financial Clarity" — `src/app/layout.tsx` metadata) is a financial-clarity tool for freelancers and independent contractors. A user uploads a bank-statement CSV (any bank, any format), and the app:

1. Parses and categorizes every transaction automatically ([CSV_IMPORT.md](./CSV_IMPORT.md), [CATEGORIZATION_ENGINE.md](./CATEGORIZATION_ENGINE.md)).
2. Builds a dashboard of income, expenses, and cashflow over time ([ANALYTICS_ENGINE.md](./ANALYTICS_ENGINE.md)).
3. Explains, in plain language, what changed and why ([INTELLIGENCE_ENGINE.md](./INTELLIGENCE_ENGINE.md)).
4. Forecasts what's likely to happen next, with a confidence level and a "business health score" ([FORECAST_ENGINE.md](./FORECAST_ENGINE.md)).

The tagline on the landing page sums it up: **"Finally understand where your money goes."**

It is explicitly *not* a budgeting app, an invoicing tool, or an accounting/bookkeeping system. It doesn't connect to bank APIs (no Plaid/TrueLayer integration) — the user exports a CSV themselves and uploads it. This is a deliberate simplicity/privacy trade-off (see §5).

---

## 2. Who it's for

> **Note (2026-07-02)**: the landing page (`src/app/page.tsx`) was substantially redesigned and simplified — the `landing.recognition`/`understand`/`philosophy`/`privacy`/`history` sections quoted below no longer exist as literal landing-page copy. They're preserved here because they remain the accurate description of the target user and the product's design principles; the current landing page states this more briefly (see §2 in [USER_JOURNEY.md](./USER_JOURNEY.md) for its actual current structure).

The target user is best summarized by things *they themselves would say*:

> - "I don't know if this month was actually good, or just felt good."
> - "I have no idea where 400 euros a month quietly disappears to."
> - "I can't tell if my business is growing, or I'm just busier."
> - "The only time I really look at this properly is at tax time."

This describes a **freelancer or independent contractor with irregular income** — someone who:
- Gets paid in lump sums from multiple clients, not a predictable monthly salary.
- Has *some* visibility into their finances (a spreadsheet "updated sometimes") but no real system.
- Feels broadly "okay" but can't point to numbers to confirm it.
- Only engages with their finances reactively (tax time, or when something feels tight).

The product is built **by a freelancer, for freelancers** — every design decision (see §3 and [FORECAST_ENGINE.md](./FORECAST_ENGINE.md)'s income-type detection, [INTELLIGENCE_ENGINE.md](./INTELLIGENCE_ENGINE.md)'s seasonal/income-gap insights) is built around *irregular* income patterns, not the steady biweekly-paycheck assumption that most consumer finance apps (Mint, YNAB, etc.) are designed around.

---

## 3. Core philosophy

Three statements that double as design principles (previously stated verbatim on the landing page under `landing.philosophy`, before the 2026-07 simplification — see note in §2):

| Principle | What it means in practice |
|---|---|
| **"You shouldn't need an accountant to understand your own business. Your bank statement already has the answers — we just make them visible."** | The app adds *zero* new data entry. Everything — categories, trends, forecasts, insights — is derived purely from the CSV the user already has. No manual budgets, no manual categorization setup, no connected accounts. |
| **"Irregular income doesn't mean uninformed decisions. Forecasts and insights built for how freelancers actually get paid, not how salaried tools assume everyone gets paid."** | Directly realized in `detectIncomeType()` ([INTELLIGENCE_ENGINE.md §4](./INTELLIGENCE_ENGINE.md)), which distinguishes salary/freelance/mixed/unknown income patterns using coefficient-of-variation, and in the forecast's confidence scoring ([FORECAST_ENGINE.md](./FORECAST_ENGINE.md)), which is explicitly *lower* when income is lumpy — the app tells the user *how sure* it is, rather than presenting a single number with false confidence. |
| **"Your data is yours. Upload it, learn from it, make better decisions, make improvements, and stop stressing."** | Realized as: account deletion removes *everything* (Storage files + all DB rows via cascade, [ARCHITECTURE.md §8c](./ARCHITECTURE.md)); recategorizing a transaction **immediately** recalculates totals, forecasts, and insights ([ARCHITECTURE.md §8b](./ARCHITECTURE.md)); and the categorization engine *learns* from corrections via `CategoryRule` ([CATEGORIZATION_ENGINE.md](./CATEGORIZATION_ENGINE.md)) so the system improves specifically for *that user's* data. |

---

## 4. The main value proposition

The product answers four questions, each mapped to a real engine (previously stated verbatim on the landing page under `landing.understand` — "After one upload… Real answers. Not just numbers." — before the 2026-07 simplification; see note in §2):

| Promise | Landing copy | Delivered by |
|---|---|---|
| **What happened this month** | "Income vs expenses vs your historical average. Know immediately if this was a strong month or a difficult one." | `<SummaryCards>` + `intel.snapshotSummary`/`snapshotContext`/`comparisonInterpretation` — [ANALYTICS_ENGINE.md](./ANALYTICS_ENGINE.md), [INTELLIGENCE_ENGINE.md §6](./INTELLIGENCE_ENGINE.md) |
| **Where your money is going** | "Every transaction categorised automatically. Subscriptions, tools, travel, taxes, visible in one clear view." | The categorization engine + `/history` page — [CATEGORIZATION_ENGINE.md](./CATEGORIZATION_ENGINE.md), [USER_JOURNEY.md §14](./USER_JOURNEY.md) |
| **What is coming next** | "Cashflow forecasts built from your actual patterns. Know if next month looks tight before it arrives." | `generateForecast()` + `<ForecastWidget>` — [FORECAST_ENGINE.md](./FORECAST_ENGINE.md) |
| **What to do about it** | "Specific recommendations based on your real numbers. Not generic advice. Actions from your own financial data." | `intel.biggestRisk`/`biggestOpportunity`/`forecastImprovements` on `/forecast` — [INTELLIGENCE_ENGINE.md §6](./INTELLIGENCE_ENGINE.md), [FORECAST_ENGINE.md](./FORECAST_ENGINE.md) |

> **Why this table matters for maintenance**: every bullet on the landing page is a *promise*. If you change or remove how `biggestRisk`/`biggestOpportunity` are computed, for example, and the landing page still says "specific recommendations… from your own financial data," the product copy and the product behavior have drifted apart. When changing an engine, check this table for a corresponding landing-page promise.

### 4a. Verdict-first page design

Each page in the app is structured to answer **one human question** before presenting any numbers. The question appears in the `h1`; the answer (a colored verdict) appears immediately below it; the supporting data follows as evidence. The mapping:

| Page | Question answered | Verdict source |
|---|---|---|
| `/dashboard` | "How is my business doing?" | `intel.healthStatus` → green / amber / red verdict |
| `<MonthlyComparison>` | "Should I feel better than last month?" (or "Was {month} better than {prev}?" for historical data) | Income + cashflow change direction |
| `/forecast` | "Should I worry about next month?" | `cashflowRisk` level → one-line answer |
| `/clients` | "Who can I depend on?" | Count of reliable vs. follow-up clients |
| `/clients/[name]` | "Can I depend on this client?" | Per-client `status` → verdict sentence |
| `/analytics` | "What is working and what is hurting?" | Year-over-year income + expense comparison |

**Why this matters**: a dashboard that shows fifty numbers and labels them all equally leaves the user to form their own conclusion under cognitive load. Leading with the verdict — and colouring it — tells the user how to feel before they read the numbers. The numbers then serve as *evidence* for a conclusion already stated, rather than a puzzle to solve. Any new page or card added to the product should follow this pattern: ask yourself "what is the one question this answers?" and make that question the `h1`.

**Historical data handling**: when `coverageIsStale` (data ends 2+ months before today), present-tense questions switch to past-tense. "Should I feel better than last month?" becomes "Was April 2023 better than March 2023?" — so the verdict is always accurate about *what period it describes*. See [USER_JOURNEY.md §11](./USER_JOURNEY.md) for the `isDataRecent` prop and [USER_JOURNEY.md §12](./USER_JOURNEY.md) for year-explicit labels on the Analytics page.

---

## 5. The interactive demo — landing page trust experience

The landing page's "Live demo" section links to `/demo/upload` → the demo workspace. This replaced two earlier approaches in sequence: first `<ProductWalkthrough>` (a hardcoded animated illustration of what the app might say — "Software costs are up 14%…" — disconnected from actual engine behavior), then `<DemoSection>` (a two-path hero widget). Both were retired; `<ProductWalkthrough>` and `<DemoSection>` no longer exist in the codebase.

| Path | What happens |
|---|---|
| **Explore Interactive Demo** (→ `/demo/upload` → `/demo`) | Opens a fully navigable demo workspace (no login). Sophie Martin's 3 years of UX designer transactions, processed by the same real engines used by paying users. Dashboard, History, Analytics, Forecast, Clients, Reports — all populated with genuine engine output. |
| **Upload Sample CSV** (→ `public/samples/*.csv`, linked from `/upload`) | Downloads one of 4 persona CSVs (designer, developer, consultant, photographer). After signing up, the user uploads it through the standard pipeline — the real categorization, analytics, and forecast engines process it exactly as they would real data. |

**Why the shift from scripted walkthrough to real engine demo**: the retired `<ProductWalkthrough>` showed a hardcoded illustration disconnected from actual engine behavior. The demo workspace shows what the engine **actually** produces from realistic freelancer transactions, making the product promise verifiable before signup.

**This principle also governs the landing page's device-mockup illustrations.** `<AnalyticsDevices>` and `<ForecastPhone>` (`src/components/landing/`, rendered in the "How It Works" and "Accounts" sections) look like static screenshots but are async Server Components that call `getDemoDataset(locale)` / `computeCategoryBreakdown()` from `src/lib/demo/engine.ts` — the same demo engine behind `/demo/analytics` and `/demo/forecast`. Every number shown (the bar chart, top expense categories, next-month forecast, year-end projection) is real, computed output, not an invented placeholder. An earlier version of these two components hardcoded plausible-looking numbers (e.g. a fixed "€4,800" forecast, a fixed "+18%" change) — this was caught and fixed on 2026-07-02 because it reintroduced the exact "fake illustration" problem that `<ProductWalkthrough>` was originally retired for. **Any future change to these two components must keep pulling from the real demo engine — do not hardcode illustrative figures.**

The underlying claim — "the demo uses the exact same engine as real accounts" — is both a product claim and a technical constraint: any change that introduces demo-only fake data or hardcoded insight strings violates this principle. See [ARCHITECTURE.md §10](./ARCHITECTURE.md) for the demo engine implementation.

---

## 6. Why depth of history matters

The product's pitch for uploading *multiple years* of statements, not just the latest one (previously stated verbatim on the landing page under `landing.history` — "The more history you upload, the smarter it gets" — before the 2026-07 simplification; see note in §2). Three tiers:

| History uploaded | What becomes possible |
|---|---|
| **1 year** | Monthly patterns: income trends, expense categories, cashflow health, and a first forecast. |
| **5 years** | Seasonal cycles: which months are consistently strong vs. slow, year-over-year growth. |
| **10+ years** | The complete financial journey: long-term trends and shifts only visible across a decade. |

This directly motivates several engine features that only "activate" with enough data:
- Seasonal insights and quarter-based comparisons need ≥2 years of the same month to compare ([INTELLIGENCE_ENGINE.md §5.5](./INTELLIGENCE_ENGINE.md)).
- `detectIncomeType()`'s confidence improves with more months of income data ([INTELLIGENCE_ENGINE.md §4](./INTELLIGENCE_ENGINE.md)).
- The `<DataCoverageBar>` (shown on Dashboard, Analytics, History) visually communicates *how much* history the app currently has — directly supporting this "the more you give it, the smarter it gets" narrative.

---

## 7. Privacy & trust as a product feature

These commitments aren't just legal boilerplate — they're load-bearing for the target user (§2), who is handing over their *entire bank statement history*. They were previously stated verbatim on the landing page under `landing.privacy` ("Private. Secure. Yours.") plus a hero trust strip (🔒 Encrypted · 🚫 Never sold · 🗑️ Delete anytime); the 2026-07 landing simplification removed that section from the homepage, but every commitment below is still fully implemented and stated in full on `/data-privacy` (`src/app/data-privacy/page.tsx`, linked from the landing footer). Six commitments, each with a real implementation:

| Commitment | Implementation |
|---|---|
| **Raw CSV never leaves the browser** | `parseCsv()` runs client-side; the server receives only structured JSON rows (dates, amounts, merchant descriptions, categories). The raw bank statement is never uploaded anywhere. — [CSV_IMPORT.md §1](./CSV_IMPORT.md), [ARCHITECTURE.md §8a](./ARCHITECTURE.md) |
| Bank-level encryption, in transit and at rest | Supabase/Postgres + TLS (infrastructure-level, not app code) |
| Never sold / no advertising | Product policy — no analytics/ad SDKs in the codebase |
| "You're always in control" — recategorize and everything updates instantly | `PATCH /api/transactions/recategorize` recalculates analytics + forecast synchronously — [ARCHITECTURE.md §8b](./ARCHITECTURE.md) |
| Delete anytime, permanently, one click | `DELETE /api/account` — [ARCHITECTURE.md §8c](./ARCHITECTURE.md) |
| No third-party tracking | No third-party scripts in `layout.tsx` |
| "Early days, real numbers" — categorization won't be perfect, but it learns | `CategoryRule` learning loop — [CATEGORIZATION_ENGINE.md](./CATEGORIZATION_ENGINE.md) |
| Transparent data policy | `/data-privacy` page explains in plain English exactly what is stored (transaction rows: dates, amounts, merchant descriptions, categories) and what is not (raw CSVs, account numbers, IBANs) — `src/app/data-privacy/page.tsx` |

The last item is worth calling out: the product **does not pretend categorization is perfect**. It's framed as a collaborative, improving system — which is also why the `/history` page foregrounds the `<NeedsReviewBanner>` and `<RecategorizeButton>` rather than hiding low-confidence categorizations.

---

## 8. Financial Reserve Engine & Pipeline Coverage

Two Dashboard cards extend the four value-proposition questions (§4) into forward-looking money management — "what can I safely spend" and "am I covered if a client pays late" — without becoming tax software or asking the user to manually enter a bank balance.

### 8a. Financial Reserve Engine (`src/lib/reserve-engine/`)

Replaces an earlier, rejected approach that hardcoded a single tax percentage (24.6%, France's micro-entrepreneur BNC rate) for every user regardless of country or situation. The product rule going forward: **Nonodia must never present a guessed number as an exact figure, and must never hardcode one country's rates for every user.**

Instead of a single "Tax" number, the `<FinancialReserveCard>` on `/dashboard` shows a reserve broken into buckets (Social Contributions, Income Tax, VAT, Emergency Buffer) plus "Available to spend this month":

- **Pluggable per-country rules**: `CountryReserveRules` (`src/lib/reserve-engine/types.ts`) is implemented once per country and registered in `src/lib/reserve-engine/countries/index.ts`. Only France (`countries/france.ts`) is implemented today — Germany/UK/US are explicitly left uncommented rather than guessed at, because the engine has no confident rates for them yet. Adding a country never requires touching the core engine, only writing and registering one new file.
- **Profile-driven, never blocking**: a user's Country / Business legal status / Activity type / VAT status (optional Settings fields — §8b) determine whether a country's rule set can compute a *precise* bucket breakdown (`isProfileComplete()`). Until then, the card shows a clearly-labeled "Estimated Reserve" (generic 25%) with a disclaimer, and the user can adjust the percentage manually at any time via inline `<ReserveAdjustment>` — no blocking onboarding step.
- **Emergency Buffer is genuinely automatic**: `emergency-buffer.ts` computes a country-independent buffer % from the real coefficient of variation of the user's last 6 months of income (low volatility → 5%, medium → 10%, high → 20%, or "unknown" with <3 months of data). This one bucket needs no profile at all — it's derived entirely from transaction history, consistent with the "your bank statement already has the answers" philosophy (§3).
- **Every estimate is labeled**: each bucket carries a `confidence: "known" | "unavailable"` and, when unavailable, a `noteKey` explaining *why* (e.g. income tax depends on the user's personal tax bracket, which nothing in a bank statement can reveal — it's reported as unavailable rather than guessed).

### 8b. Financial profile (Settings)

`<FinancialProfileSection>` on `/settings` collects Country / Business legal status / Activity type / VAT status via `PATCH /api/financial-profile`. Entirely optional — the Dashboard card works from the moment of signup using the generic estimate. Completing it upgrades the card from "estimate" to "exact," consistent with §7's principle that the app should be usable with zero manual setup.

### 8c. Pipeline Coverage (`src/lib/pipeline-coverage-engine.ts`)

Answers "if my next payment is late, how covered am I?" without ever asking the user for their bank balance (a true cash-runway calculation is mathematically impossible to derive from CSV transaction flows alone — there's no way to know a starting balance). Instead it compares outstanding Milestone Tracker value against the user's average monthly burn rate, giving a coverage figure computed entirely from data the app already has. Rendered by `<PipelineCoverageCard>` alongside `<FinancialReserveCard>` on `/dashboard`.

---

## How to modify safely

### Editing landing-page copy / messaging

- All visible landing-page copy lives under the `landing` namespace in `messages/en.json` and `messages/fr.json` — see [TRANSLATIONS.md](./TRANSLATIONS.md) for the editing workflow. `src/app/page.tsx` is a Server Component using `getTranslations("landing")`; `howItWorks.steps` is read via `t.raw(...)`. `CsvHelpPanel.tsx` is a Client Component reading `landing.csvHelp` via `useTranslations()`.
- `<AnalyticsDevices>` and `<ForecastPhone>` (`src/components/landing/`) are also Server Components, but they do **not** pull their numbers from the `landing` namespace — they compute real figures from `getDemoDataset()` / `computeCategoryBreakdown()` (`src/lib/demo/engine.ts`). Only their static labels (chart captions, "Next month forecast", etc.) come from `landing.howItWorks.mockup` / `landing.accounts.mockup`. See §5 for why this matters — do not replace the computed values with hardcoded numbers.

### Changing a promise (§4 table)

- Before changing a claim about what the product delivers (e.g. "specific recommendations based on your real numbers"), check what engine actually backs it (§4 table) — and vice versa: before changing what an engine outputs, check whether product copy (landing page or `/data-privacy`) promises something specific about it. The two should never diverge silently.

### Things to be careful about

- **The demo workspace (§5) uses the real engine** — it will automatically reflect any engine change. If you change how an insight is worded or a metric is calculated, the demo (and the landing page's device mockups, which share the same engine) will show the updated output without any manual copy update. This is a feature, not a risk — but it means you can't "control" what the demo says independently of the engine.
- **The target user (§2) is the lens for every UX decision.** When evaluating a new feature idea, ask: does this help someone with *irregular* income understand "was this month actually good?" If a feature only makes sense for someone with a steady monthly paycheck, it's probably out of scope — or needs to be reframed (this is exactly why `detectIncomeType()` exists rather than assuming a fixed pay cycle).
- **"Your data is yours" (§3) is a constraint on *every* future feature**, not just account deletion. Any new feature that stores derived data, calls a third-party API with user data, or makes data harder to fully delete should be checked against this principle before being built.
- **Never hardcode a single country's tax rates as the default for every user (§8a).** Any change to the Financial Reserve Engine must go through the `CountryReserveRules` interface — no shortcuts that assume France, and no bucket presented as `"known"` unless the underlying rate is actually a stable, published, country-specific figure.
