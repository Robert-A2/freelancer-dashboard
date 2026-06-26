# Product

- **What it does**: Describes Freelancer OS at the product level — what it is, who it's for, the philosophy behind its design decisions, and the value it promises users.
- **Why it exists**: Every other doc in `/docs` explains *how* something works. This one explains *why it works that way* — the intent behind the categorization engine, the forecast, the insights, and the "your data is yours" privacy posture all trace back to the philosophy in §3.
- **Where the code is**: The product's "voice" lives in `src/app/page.tsx` (the landing page) and the `landing` namespace in `messages/en.json` / `messages/fr.json`. The actual *delivery* of these promises is spread across the engines documented elsewhere (cross-referenced throughout).
- **How to modify it safely**: see [How to modify](#how-to-modify-safely) at the bottom.

---

## 1. What Freelancer OS is

**Freelancer OS** ("Freelancer OS: Financial Clarity" — `src/app/layout.tsx` metadata) is a financial-clarity tool for freelancers and independent contractors. A user uploads a bank-statement CSV (any bank, any format), and the app:

1. Parses and categorizes every transaction automatically ([CSV_IMPORT.md](./CSV_IMPORT.md), [CATEGORIZATION_ENGINE.md](./CATEGORIZATION_ENGINE.md)).
2. Builds a dashboard of income, expenses, and cashflow over time ([ANALYTICS_ENGINE.md](./ANALYTICS_ENGINE.md)).
3. Explains, in plain language, what changed and why ([INTELLIGENCE_ENGINE.md](./INTELLIGENCE_ENGINE.md)).
4. Forecasts what's likely to happen next, with a confidence level and a "business health score" ([FORECAST_ENGINE.md](./FORECAST_ENGINE.md)).

The tagline on the landing page sums it up: **"Finally understand where your money goes."**

It is explicitly *not* a budgeting app, an invoicing tool, or an accounting/bookkeeping system. It doesn't connect to bank APIs (no Plaid/TrueLayer integration) — the user exports a CSV themselves and uploads it. This is a deliberate simplicity/privacy trade-off (see §5).

---

## 2. Who it's for

The landing page's "recognition" section (`landing.recognition` in `messages/en.json`) is the clearest statement of the target user — written as things *they themselves would say*:

> - "I don't know if this month was actually good, or just felt good."
> - "I have no idea where 400 euros a month quietly disappears to."
> - "I can't tell if my business is growing, or I'm just busier."
> - "The only time I really look at this properly is at tax time."

This describes a **freelancer or independent contractor with irregular income** — someone who:
- Gets paid in lump sums from multiple clients, not a predictable monthly salary.
- Has *some* visibility into their finances (a spreadsheet "updated sometimes") but no real system.
- Feels broadly "okay" but can't point to numbers to confirm it.
- Only engages with their finances reactively (tax time, or when something feels tight).

The product is built **by a freelancer, for freelancers** (`landing.hero.badge`) — every design decision (see §3 and [FORECAST_ENGINE.md](./FORECAST_ENGINE.md)'s income-type detection, [INTELLIGENCE_ENGINE.md](./INTELLIGENCE_ENGINE.md)'s seasonal/income-gap insights) is built around *irregular* income patterns, not the steady biweekly-paycheck assumption that most consumer finance apps (Mint, YNAB, etc.) are designed around.

---

## 3. Core philosophy

From `landing.philosophy.items` — three statements that double as design principles:

| Principle | What it means in practice |
|---|---|
| **"You shouldn't need an accountant to understand your own business. Your bank statement already has the answers — we just make them visible."** | The app adds *zero* new data entry. Everything — categories, trends, forecasts, insights — is derived purely from the CSV the user already has. No manual budgets, no manual categorization setup, no connected accounts. |
| **"Irregular income doesn't mean uninformed decisions. Forecasts and insights built for how freelancers actually get paid, not how salaried tools assume everyone gets paid."** | Directly realized in `detectIncomeType()` ([INTELLIGENCE_ENGINE.md §4](./INTELLIGENCE_ENGINE.md)), which distinguishes salary/freelance/mixed/unknown income patterns using coefficient-of-variation, and in the forecast's confidence scoring ([FORECAST_ENGINE.md](./FORECAST_ENGINE.md)), which is explicitly *lower* when income is lumpy — the app tells the user *how sure* it is, rather than presenting a single number with false confidence. |
| **"Your data is yours. Upload it, learn from it, make better decisions, make improvements, and stop stressing."** | Realized as: account deletion removes *everything* (Storage files + all DB rows via cascade, [ARCHITECTURE.md §8c](./ARCHITECTURE.md)); recategorizing a transaction **immediately** recalculates totals, forecasts, and insights ([ARCHITECTURE.md §8b](./ARCHITECTURE.md)); and the categorization engine *learns* from corrections via `CategoryRule` ([CATEGORIZATION_ENGINE.md](./CATEGORIZATION_ENGINE.md)) so the system improves specifically for *that user's* data. |

---

## 4. The main value proposition

`landing.understand` ("After one upload… Real answers. Not just numbers.") frames the product as answering four questions, each mapped to a real engine:

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

The landing page's hero right column contains `<DemoSection>` (`src/components/landing/DemoSection.tsx`), which replaced the original `<ProductWalkthrough>` static-steps slider. It offers two paths:

| Path | What happens |
|---|---|
| **Explore Sample Freelancer** (→ `/demo`) | Opens a fully navigable demo workspace (no login). Sophie Martin's 3 years of UX designer transactions, processed by the same real engines used by paying users. Dashboard, History, Analytics, Forecast, Clients — all populated with genuine engine output. |
| **Upload Sample CSV** (→ `public/samples/*.csv`) | Downloads one of 4 persona CSVs (designer, developer, consultant, photographer). After signing up, the user uploads it through the standard pipeline — the real categorization, analytics, and forecast engines process it exactly as they would real data. |

**Why the shift from scripted walkthrough to real engine demo**: the `<ProductWalkthrough>` showed a hardcoded illustration of what the app might say — "Software costs are up 14%…" — disconnected from actual engine behavior. The demo workspace shows what the engine **actually** produces from realistic freelancer transactions, making the product promise verifiable before signup.

The trust note on `<DemoSection>` — "The demo uses the exact same engine as real accounts." — is both a product claim and a technical constraint: any change that introduces demo-only fake data or hardcoded insight strings violates this principle. See [ARCHITECTURE.md §10](./ARCHITECTURE.md) for the demo engine implementation.

---

## 6. Why depth of history matters

`landing.history` ("The more history you upload, the smarter it gets") is the product's pitch for uploading *multiple years* of statements, not just the latest one. Three tiers (`landing.history.tiers`):

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

`landing.privacy` ("Private. Secure. Yours.") and the hero's trust strip (🔒 Encrypted · 🚫 Never sold · 🗑️ Delete anytime) aren't just legal boilerplate — they're load-bearing for the target user (§2), who is handing over their *entire bank statement history*. Six commitments, each with a real implementation:

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

## How to modify safely

### Editing landing-page copy / messaging

- All visible product copy lives under the `landing` namespace in `messages/en.json` and `messages/fr.json` — see [TRANSLATIONS.md](./TRANSLATIONS.md) for the editing workflow. The landing page itself (`src/app/page.tsx`) contains almost no hardcoded English text; it's all `t("...")` / `t.raw("...")` lookups, plus a handful of emoji icons (`understandIcons`, `privacyIcons`, `tierIntensities`) that are positional — if you reorder or add/remove items in an array (e.g. `landing.understand.cards`), update the corresponding icon array in `page.tsx` to match the new length/order.
- `<DemoSection>` (`src/components/landing/DemoSection.tsx`) is hardcoded in English (not i18n'd) and references `/demo` and `public/samples/` links directly. The preview metrics shown (income growth, top-client share, months of data) are hardcoded display values derived from the demo dataset design — if the demo data changes significantly, update these values to stay accurate.

### Changing a promise (§4 table)

- Before changing a landing-page claim (e.g. "specific recommendations based on your real numbers"), check what engine actually backs it (§4 table) — and vice versa: before changing what an engine outputs, check whether the landing page promises something specific about it. The two should never diverge silently.
- If you're adding an entirely new feature (a new card, a new insight type, a new forecast metric), consider whether it changes the *product story* enough to warrant a new row in `landing.understand.cards` or a new `landing.walkthrough.steps` entry — and whether the existing 4-card / 6-step framing still makes sense, or whether it's better described as part of an existing promise.

### Things to be careful about

- **The demo workspace (§5) uses the real engine** — unlike the old static `<ProductWalkthrough>`, it will automatically reflect any engine change. If you change how an insight is worded or a metric is calculated, the demo will show the updated output without any manual copy update. This is a feature, not a risk — but it means you can't "control" what the demo says independently of the engine.
- **The target user (§2) is the lens for every UX decision.** When evaluating a new feature idea, ask: does this help someone with *irregular* income understand "was this month actually good?" If a feature only makes sense for someone with a steady monthly paycheck, it's probably out of scope — or needs to be reframed (this is exactly why `detectIncomeType()` exists rather than assuming a fixed pay cycle).
- **"Your data is yours" (§3) is a constraint on *every* future feature**, not just account deletion. Any new feature that stores derived data, calls a third-party API with user data, or makes data harder to fully delete should be checked against this principle before being built.
