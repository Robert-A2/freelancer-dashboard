# User Journey

- **What it does**: Walks through every screen a user sees, in order — from the public landing page, through signup/login, the first (empty) dashboard, uploading a CSV, and on to the analytics/forecast/history pages and account settings.
- **Why it exists**: The engine docs ([ANALYTICS_ENGINE.md](./ANALYTICS_ENGINE.md), [INTELLIGENCE_ENGINE.md](./INTELLIGENCE_ENGINE.md), etc.) explain *how the numbers are computed*. This doc explains *what the user actually experiences* — which page calls which engine, what each screen looks like in each state (empty vs. populated), and how the pieces connect end-to-end.
- **Where the code is**: `src/app/(auth)/*`, `src/app/(dashboard)/*`, `src/app/page.tsx` (landing), `src/components/{landing,upload,dashboard,history,settings}/`.
- **How to modify it safely**: see [How to modify](#how-to-modify-safely) at the bottom.

---

## 1. The whole journey at a glance

```mermaid
flowchart TD
    A["/ — Landing page\n(public)"] -->|"Get Started"| B["/signup"]
    A -->|"Sign In"| C["/login"]
    A -->|"Explore Sample Freelancer"| Demo["/demo — no-auth workspace\n(Sophie Martin, 3 years of data)"]
    A -->|"Download CSV persona"| Upload2["/upload (after signing up)"]
    Demo -->|"Create Account →"| B
    B -->|"signUp() succeeds,\nsession returned immediately"| D["/dashboard?firstUpload=true\n(empty state)"]
    B -->|"signUp() succeeds,\nemail confirmation required"| B2["'Check your email' screen"]
    B2 -->|"clicks confirmation link"| C
    C -->|"signInWithPassword()"| E["/dashboard\n(empty or populated)"]
    C -->|"Forgot password"| F["/login (forgot mode)\n→ resetPasswordForEmail()"]
    F --> F2["'Check your email' screen"]
    F2 -->|"clicks recovery link"| G["/reset-password\n(updateUser with new password)"]
    G -->|"success, 2s delay"| E

    D -->|"Upload your first CSV"| H["/upload"]
    H -->|"browser parses CSV locally\n→ /api/uploads/process (structured JSON)"| I["Done screen:\nimport stats + category breakdown"]
    I -->|"View Dashboard"| J["/dashboard?firstUpload=true\n(FirstUploadBanner + full widgets)"]

    J -->|"ongoing visits"| K["/dashboard\n(SummaryCards, TrendsChart,\nForecastWidget, etc.)"]
    K --> L["/analytics — Financial Story,\nCashflow chart, Client insights"]
    K --> M["/forecast — Health Score,\nrisk/opportunity, projections"]
    K --> N["/history — review & recategorize\ntransactions"]
    K --> O["/settings — sign out,\ndelete account"]
    N -->|"upload more CSVs"| H
```

---

## 2. Landing page (`/`)

**File**: `src/app/page.tsx` + `src/components/landing/DemoSection.tsx`.

- A Server Component. If `supabase.auth.getUser()` returns a user, it immediately `redirect("/dashboard")` — logged-in users never see the marketing page (middleware also enforces this, see [ARCHITECTURE.md §3](./ARCHITECTURE.md)).
- For anonymous visitors, the page renders (in order): a sticky navbar (app name, language switcher, Sign In / Get Started), a hero section with `<DemoSection>` in the right column, an "Understand your finances" 4-card grid, a "recognition" list, a "history" tier section, a "philosophy" section, and a "privacy" section.
- All copy comes from the `landing` translation namespace via `t.raw(...)` for arrays of `{title, body}` / `string[]` objects — see [TRANSLATIONS.md](./TRANSLATIONS.md) for how to edit this content.
- The hero's right column `<DemoSection>` (`src/components/landing/DemoSection.tsx`) offers two paths: **Explore Sample Freelancer** → `/demo` (no login) and **Upload Sample CSV** → 4 downloadable personas in `public/samples/`. The trust note "The demo uses the exact same engine as real accounts" is intentional — see §2a below.
- Both CTAs (`Sign In`, `Get Started`) link to `/login` and `/signup` respectively.
- The product narrative ("what Freelancer OS is for") is covered in [PRODUCT.md](./PRODUCT.md) — this doc only covers the page's role in the navigation flow.

### 2a. Demo workspace (`/demo/*`)

**Files**: `src/app/demo/` (7 pages/layouts), `src/components/demo/DemoNavbar.tsx`, `src/lib/demo/` (in-memory engine).

An unauthenticated user who clicks "Explore Sample Freelancer" enters a fully navigable demo workspace pre-loaded with a fictional freelancer profile (Sophie Martin, UX Designer, 3 years of transaction data). Every page is a real Server Component — no JavaScript-only modal or iframe.

Key properties:
- **No login required** — `/demo` is in `publicPaths`; authenticated users can also access it (not bounced to `/dashboard`).
- **Amber banner** at the top of every demo page: "Demo Account — All data shown is fictional. This is Sophie Martin, Freelance UX Designer." with a "Use your own data →" link to `/signup`.
- **Same engines, no shortcuts** — `getDemoDataset(locale)` feeds the same `generateDashboardIntelligence()`, `buildHistoricalInsights()`, forecast algorithms, and client-risk functions used by real accounts. Nothing is hardcoded.
- **`DEMO_REF_DATE = new Date(Date.UTC(2026, 0, 1))`** is used instead of `new Date()` for all date-relative calculations so clients don't falsely appear inactive.

Full architecture: [ARCHITECTURE.md §10](./ARCHITECTURE.md).

---

## 3. Sign up (`/signup`)

**File**: `src/app/(auth)/signup/page.tsx` (253 lines), `"use client"`.

```mermaid
flowchart TD
    A["User fills in\nfull name / email / password"] --> B["supabase.auth.signUp()\n(browser client)"]
    B -->|"error"| C["friendlyError() maps Supabase's\nraw error message → translated string\n(alreadyRegistered, passwordTooShort,\ninvalidEmail, rateLimit, generic)"]
    B -->|"success, data.user exists"| D["POST /api/users/create\n{ id, fullName, email }\n→ prisma.user.upsert"]
    D --> E{"data.session\nreturned?"}
    E -- yes --> F["router.push('/dashboard?firstUpload=true')"]
    E -- no\n(email confirmation required) --> G["mode = 'confirm':\n'Check your email' screen\n+ Resend button"]
    G -->|"clicks link in email"| H["/login (now confirmed)"]
```

- **Two outcomes after a successful `signUp()`** depend entirely on the Supabase project's email-confirmation setting: if confirmation is **off**, Supabase returns a session immediately and the user lands straight on the dashboard. If confirmation is **on**, no session is returned and the UI switches to `mode: "confirm"` — a "check your inbox" screen with a **Resend** button (`supabase.auth.resend({ type: "signup", email })`).
- **`POST /api/users/create`** is the only reason the app needs a dedicated route for this — the browser's `supabase.auth.signUp()` call creates the *auth* user but has no way to write to the app's own `User` table (Postgres via Prisma). This route does `prisma.user.upsert({ where: { id }, create: { id, fullName, email } })`. See [AUTHENTICATION.md](./AUTHENTICATION.md) for why `upsert` (not `create`) is used here.
- `?firstUpload=true` is appended to the dashboard redirect, but at this point `hasData` is `false` (no transactions yet) — so the dashboard shows its **empty state** (§8), not the `FirstUploadBanner`. The query param only takes effect *after* the first successful CSV import (§9–10).

---

## 4. Log in (`/login`)

**File**: `src/app/(auth)/login/page.tsx` (267 lines), `"use client"`. Three modes in one component:

| Mode | Trigger | What happens |
|---|---|---|
| `"signin"` (default) | — | Email + password form → `supabase.auth.signInWithPassword()`. On success: `router.push("/dashboard")` + `router.refresh()` (the refresh re-runs Server Components so the now-authenticated layout renders). On error, `friendlyError()` maps Supabase's message to one of: `invalidCredentials`, `emailNotConfirmed`, `tooManyRequests`, `userNotFound`, `invalidEmail`, `network`, `generic`. |
| `"forgot"` | User clicks "Forgot password?" | Email-only form → `supabase.auth.resetPasswordForEmail(email, { redirectTo: "<origin>/reset-password" })`. |
| `"sent"` | After `resetPasswordForEmail()` succeeds | "Check your email" confirmation screen, with a link back to `"forgot"` to try again. |

Full password-reset mechanics (the recovery-code exchange, the `PASSWORD_RECOVERY` auth event) are in [AUTHENTICATION.md](./AUTHENTICATION.md) and §5 below.

---

## 5. Reset password (`/reset-password`)

**File**: `src/app/(auth)/reset-password/page.tsx` (254 lines), `"use client"`, wrapped in `<Suspense>` (it reads `useSearchParams()`).

```mermaid
flowchart TD
    A["User clicks recovery link\nin email → /reset-password?code=..."] --> B["Supabase browser client\nauto-detects the code on init"]
    B --> C{"onAuthStateChange\nfires PASSWORD_RECOVERY\nwithin ~6s?"}
    C -- yes --> D["ready = true\nShow new-password form"]
    C -- no (timeout) --> E["error = 'expired link'\nShow 'Request new link' → /login"]
    D --> F["User enters new password\n(min 8 chars, must match confirm)"]
    F --> G["supabase.auth.updateUser({ password })"]
    G -->|"success"| H["Show success message,\nrouter.push('/dashboard') after 2s"]
    G -->|"error"| I["Show 'updateFailed' error"]
```

> **Why no `exchangeCodeForSession()` call here**: the Supabase browser client automatically consumes the recovery code/token in the URL on initialization and emits a `PASSWORD_RECOVERY` auth event once the session is established. Calling `exchangeCodeForSession()` again manually would consume the (single-use) code a second time and always fail — so the page just **listens** for that event (`onAuthStateChange`) and also checks `getSession()` directly in case the event fired before the listener attached. A 6-second timeout shows an "expired link" state if neither fires.
- If the URL has neither a `?code=` param nor a `#...type=recovery` hash, the page immediately shows the "invalid link" state — it was opened directly, not via a real recovery email.
- This page is the one exception to middleware's "bounce authenticated users away from auth pages" rule — see [ARCHITECTURE.md §3](./ARCHITECTURE.md) for why.

---

## 6. The auth gate (middleware)

Every request — including all of the above — passes through `src/middleware.ts` first. Full mechanics: [ARCHITECTURE.md §3](./ARCHITECTURE.md) and [AUTHENTICATION.md](./AUTHENTICATION.md). Summary for this journey:

- Not signed in + visiting anything other than `/`, `/login`, `/signup`, `/reset-password` → bounced to `/login`.
- Signed in + visiting `/`, `/login`, or `/signup` → bounced to `/dashboard`.
- `/reset-password` is reachable either way (see §5).

---

## 7. `(dashboard)` layout — shared chrome

**File**: `src/app/(dashboard)/layout.tsx`. Every page from here on (`/dashboard`, `/upload`, `/history`, `/clients`, `/analytics`, `/forecast`, `/settings`) is wrapped in:

- `<Navbar />` (`src/components/ui/Navbar.tsx`) — a sticky top bar (desktop) with **6 nav links** (Dashboard, Upload, History, Clients, Analytics, Forecast) via `NAV_LINKS`, plus a language switcher, a feedback button, a settings icon, and sign-out; plus a fixed **bottom tab bar (mobile) with 5 links** — `MOBILE_NAV_LINKS` filters out History (accessible via the dashboard's "View all transactions" link) so the bar fits cleanly at 320 px. `usePathname()` highlights the active link; a `pending` state highlights the link being navigated *to* before the route transition completes.
- A centered `<main>` container (`max-w-5xl`), with extra bottom padding on mobile (`pb-28`) to clear the fixed bottom nav.

---

## 8. First dashboard visit — empty state

**File**: `src/app/(dashboard)/dashboard/page.tsx` (281 lines).

Before any CSV has been uploaded, `totalTx === 0` → `hasData = false`. The page renders:
- The header (`"Welcome, {firstName}"` or generic title) — **without** the health-status badge or the `transactionsMonths` subtitle (both gated on `hasData`).
- **No** `DataCoverageBar`, **no** `FirstUploadBanner` (gated on `isFirstUpload = params.firstUpload === "true" && hasData` — false here since `hasData` is false).
- A single centered **empty-state card**: a 📊 emoji, `emptyState.heading`/`emptyState.body` text, and a primary button **"Upload your first CSV"** linking to `/upload`.

None of `SummaryCards`, `TrendsChart`, `ForecastWidget`, `MonthlyComparisonWidget`, `RecentTransactions`, or `HistoricalInsights` render in this state. `generateDashboardIntelligence(null, ...)` (called with `current = null`) returns the `empty` object described in [INTELLIGENCE_ENGINE.md §6](./INTELLIGENCE_ENGINE.md) — `snapshotSummary: { key: "insights.snapshot.uploadPrompt" }` — but this particular field isn't rendered in the empty-state branch (the empty-state card's copy is static, not insight-driven).

---

## 9. Upload a CSV (`/upload`)

**File**: `src/app/(dashboard)/upload/page.tsx` (Server Component) + `src/components/upload/CsvUploader.tsx` (`"use client"`).

The page shows: a heading and subtitle, the `<CsvUploader>` drop zone (with a privacy line and four trust chips below it), an "uploading again?" tip (only if the user has previous imports), an "Expected CSV Format" card (static Date/Description/Amount example), a **"How we handle your data →"** footer link to `/data-privacy`, and — if any imports exist — a **Recent Imports** list (last 5, with file name, date, imported/duplicate row counts, and a `<DeleteImportButton>` per row).

### `CsvUploader` state machine

```mermaid
stateDiagram-v2
    [*] --> idle
    idle --> parsing: file selected/dropped\n(must end in .csv)
    parsing --> processing: parseCsv() succeeds\n(browser-side, no network)
    parsing --> error: file empty / no valid transactions / parse threw
    processing --> done: POST /api/uploads/process succeeds
    processing --> error: process API returns error
    idle --> error: file is not .csv
    done --> idle: "Upload another"
    error --> idle: "Try a different file"
```

- **idle**: a dashed drop zone (drag-and-drop or click to browse). Four trust chips below the zone: "Your file never leaves this tab", "Transaction data stored privately, never your raw file", "Delete everything in one click", "No bank login required". Only `.csv` files accepted (checked immediately before anything else runs).
- **parsing**: the file is read with `file.text()` entirely in the browser. `GET /api/uploads/rules` fetches the user's learned `CategoryRule` and `UserIntentRule` rows (small JSON, no file content). `parseCsv()` runs client-side with these rules and an empty merchant index. The raw CSV never leaves the browser tab.
- **processing**: `POST /api/uploads/process` sends the structured parsed rows as JSON (`{ transactions[], fileName, totalRows, skippedRows, currencies, ... }`). The server does a merchant-DB second pass, writes `Transaction` rows, recalculates analytics, and regenerates the forecast. See [ARCHITECTURE.md §8a](./ARCHITECTURE.md) for the full pipeline and [CSV_IMPORT.md](./CSV_IMPORT.md) / [CATEGORIZATION_ENGINE.md](./CATEGORIZATION_ENGINE.md) for parsing/categorization details.
- **done**: a results card —
  - 4 stat tiles: imported, duplicates, total rows, invalid/skipped rows.
  - An "Analysis range" + "Transactions imported" + "Categories detected" summary (if a date range was found).
  - A "What we found" breakdown by `transactionType` (income/expense/savings/transfer counts), with a note about transfers if any were detected, and a link to `/history` to review categorization.
  - A mixed-currencies warning if `hasMixedCurrencies` (see [CSV_IMPORT.md](./CSV_IMPORT.md) for currency detection).
  - Two buttons: **"Upload another"** (back to idle) and **"View Dashboard"** (`router.push("/dashboard?firstUpload=true")`).
- **error**: `parseUploadError()` maps the raw error string to one of 5 friendly error cards (`unsupportedFile`, `noTransactions`, `emptyFile`, `connectionProblem`, `generic`), each with a heading, reason, and a bulleted "What to try" list. A **"Try a different file"** button resets to idle; a `mailto:` link offers support contact for persistent issues.

### `/data-privacy` page

**File**: `src/app/data-privacy/page.tsx`. A standalone public page (no dashboard layout, no auth required conceptually — though it's linked from the authenticated upload page). Explains in plain language: what stays in the browser, what the server stores (dates, amounts, merchant descriptions, categories), what is never stored (raw CSV, bank account numbers, IBANs), the "delete everything" flow, who runs the service, and GDPR rights. Linked from the upload page footer via `upload.dataPrivacyLink`.

---

## 10. Back to the dashboard — `FirstUploadBanner`

After clicking **"View Dashboard"**, the user lands on `/dashboard?firstUpload=true`. Now `hasData = true` (the import just completed), so `isFirstUpload = true`, and — in addition to the full populated dashboard (§11) — `<FirstUploadBanner>` renders at the top:

- **File**: `src/components/dashboard/FirstUploadBanner.tsx` (80 lines), `"use client"`.
- Shows: a "Ready" label, a personalized welcome (`"Welcome, {firstName}"` or generic), the number of months of history and transactions analyzed (`t.rich(...)` with bold values), and — if `intel.snapshotSummary` is set — the first generated `<InsightText>` insight, displayed in a highlighted blockquote.
- Three actions: **"See Forecast"** (`/forecast`), **"Explore Analytics"** (`/analytics`), and **"Dismiss"**.
- Dismissing (either button or the X) calls `router.replace("/dashboard")` — this strips `?firstUpload=true` from the URL **without** a full reload, so the banner won't reappear on refresh but the rest of the dashboard stays mounted.

> This banner only ever appears once per upload — it's driven entirely by the `?firstUpload=true` query param set by the upload page's "View Dashboard" button, not by any persisted "is this the user's first upload ever" flag. Re-uploading more CSVs later and clicking "View Dashboard" again will show it again (by design — "uploadingAgain" tip on the upload page hints at this).

---

## 11. The populated dashboard (`/dashboard`, ongoing)

Once `hasData = true`, the full dashboard renders (data fetching covered in [ARCHITECTURE.md §7a](./ARCHITECTURE.md), insight generation in [INTELLIGENCE_ENGINE.md](./INTELLIGENCE_ENGINE.md)):

| Section | Component | Driven by |
|---|---|---|
| Account filter bar | `<AccountFilterBar>` | `prisma.account.findMany` — pill row above the header showing "All accounts" + one pill per uploaded account with a colored dot. Only renders when the user has **2 or more** accounts; new users never see it. Clicking a pill sets `?accountId=xxx` in the URL; all dashboard data functions filter to that account. Uses `?accountId` URL param — navigation is a plain `<Link>` (no JS state). |
| Header (verdict-first) | inline JSX | `h1` = "How is my business doing?" (when `hasData`). Below the title: a colored one-line verdict (`verdictHealthy` / `verdictWatch` / `verdictAtRisk`) driven by `intel.healthStatus`. `welcomeBack` name line renders *above* the title in smaller text. Below the verdict: "Based on data through {date}" derived from `coverage.latest`. |
| Stale coverage banner | inline JSX | Shown when `coverageIsStale` — i.e. `coverage.latest` is 2+ months before today. Amber box: "Your most recent data is from {month}. Upload recent months…" Only users whose data ends before the current period see this. |
| Data coverage | `<DataCoverageBar>` | `getDataCoverage(userId, accountId?)` |
| Summary cards | `<SummaryCards>` | `current`/`previous` totals, `riskLevel`, `intel.snapshotSummary`/`snapshotContext` — the narrative block now renders **above** the number grid (verdict-first). |
| Trends chart | `<TrendsChart>` | `chartData` (12-month `MonthPoint[]`), `intel.trajectoryInsight`/`trajectoryDetails` — **clickable**: tapping a month opens `<MonthDrawer>` with a 2-level drill-down (month totals → category → transactions) |
| Forecast widget | `<ForecastWidget>` | `forecast` (`getLatestForecast`), `intel.forecastReasons`/`forecastImprovements`/`cashflowDeficitReason` — **hidden when `accountId` is set** (forecast is user-wide; showing it per-account would display invented data) |
| Monthly comparison | `<MonthlyComparisonWidget>` | `comparison` (`getMonthlyComparison`), `intel.comparisonInterpretation`. Receives `isDataRecent={!coverageIsStale}` — when `false`, the section label switches from "Should I feel better than last month?" to "Was {currMonth} better than {prevMonth}?" and verdicts use past-tense historical phrasing. |
| Recent transactions | `<RecentTransactions>` | `recent` (last transactions from `getDashboardSummary`, including `intent`/`intentConfidence`/`needsReview` and `accountName`/`accountColor` for the account badge on each row), `intel.notableTransactions` — **clickable**: each row opens a `<TransactionDrawer>` with full intent context (no API call — data is passed from server at page load) |
| Historical insights | `<HistoricalInsights>` | `rankedInsights` (`buildHistoricalInsights`) — only rendered if non-empty |

`riskLevel` (low/medium/high/critical) is computed inline on this page using the **same formula** as the Forecast page's cashflow-risk calculation — see [FORECAST_ENGINE.md §9](./FORECAST_ENGINE.md) and [INTELLIGENCE_ENGINE.md](./INTELLIGENCE_ENGINE.md) for why these two pages are kept in lock-step.

**Coverage staleness vs. data age**: two separate signals are tracked. `dataIsStale` (>28 days since the last import) is a freshness hint. `coverageIsStale` (`coverageMonthsAgo >= 2`, where `coverageMonthsAgo` = months between `coverage.latest` and today) indicates the transaction data ends before the current period — this drives both the amber stale-coverage banner and `isDataRecent` for the monthly comparison widget.

---

## 12. Analytics (`/analytics`)

**File**: `src/app/(dashboard)/analytics/page.tsx`. Same auth-check + `force-dynamic` pattern. Fetches `getHistoricalData`, `getCategoryInsights`, `getClientInsights`, `getDataCoverage`, `getIncomeConcentration`, `getCategorizationHealth`, plus `buildHistoricalInsights()` for the **"Financial Story"** section.

**Page question**: "What is working and what is hurting?" (shown in `h1` when `hasData`).

**Habit verdict block** — rendered immediately below the header, before any numbers. Uses `dataYear` (anchored to the user's latest data record) vs `prevYear` to compare YTD income and expenses. Four states: `growingIncomeStableExp` (green) · `growingIncomeGrowingExp` (amber) · `decliningIncome` (red) · `stableAll` (neutral). All verdict strings embed the exact years being compared (e.g. "Income in 2023 was lower than 2022") — never "last year" or "this year" — so the verdict is unambiguous regardless of when the user views it. Only shown when `showPrevYearComparison` is true (prior-year data actually covers a full comparable window).

**Year-aware labels** — every label that previously said "last yr", "this year", or "last year" on this page now uses the explicit year number. `lastYr` shows "{amount} in {year}", `marginLastYr` shows "{pct}% in {year}", and client-section labels like "First-time clients who paid this year" render as "First-time clients who paid in {dataYear}". This applies to the `<ClientInsights>` component (receives `dataYear` as a prop) and all habit verdict strings. The rule: the product never implies a year — it always states it.

Rendered sections (each a `<CollapsibleSection>`):
- **YTD summary** — anchored to the user's *last data month* (`latestDataRecord`), not wall-clock "today" — consistent with the "anchor to the data" principle (see [ANALYTICS_ENGINE.md](./ANALYTICS_ENGINE.md)). Comparison tiles show "{amount} in {prevYear}" rather than "last yr".
- **Cashflow chart** (`<CashflowChart>`, Recharts) — income/expenses/cashflow over time. **Clickable**: tapping a bar opens `<MonthDrawer>` (shared with TrendsChart) with the same 2-level drill-down (month overview with Cashflow/Expenses/Income tabs → category → transactions).
- **Client insights** (`<ClientInsights>`) — from `getClientInsights()`, income concentration / top clients. The section footer links to `/clients` (also directly reachable via the top Navbar and mobile bottom tab since Clients was added to `NAV_LINKS`).
- **Financial Story** (`<FinancialStory>`) — renders `rankedInsights` (the same `buildHistoricalInsights()` output used on the Dashboard, see [INTELLIGENCE_ENGINE.md §5](./INTELLIGENCE_ENGINE.md)), grouped by `InsightCategory`.
- **Data coverage** (`<DataCoverageBar>`) and categorization health stats.

Analytics does **not** call `generateDashboardIntelligence()` — it only uses the historical "Financial Story" insights, not the dashboard narrative fields (snapshot/trajectory/health/risk).

---

## 12b. Client Trust & Risk Center (`/clients`, `/clients/[name]`)

**Files**: `src/app/(dashboard)/clients/page.tsx` (list), `src/app/(dashboard)/clients/[name]/page.tsx` (detail). Both are server components with `force-dynamic`. Data comes entirely from `getClientRiskProfiles(userId)` in `src/lib/client-risk-engine.ts`.

**Page question**: "Who can I depend on?" (shown in `h1`).

**Verdict line** — immediately below the title: a count-based colored verdict driven by `currentCount` and `followUpCount`. Green when all clients are reliable, amber when some need follow-up, red when all need attention.

**List page** shows: total clients, reliable / watch / high-risk counts, alert bar for RED-status clients, full ranked client table with status badge, last payment date, revenue contribution bar, and total revenue. Each row links to the detail page via `/clients/[encodeURIComponent(name)]`.

**Detail page** shows (in order):
1. **Header** — client name, status badge, client rank (e.g. "Your #1 client by total revenue"), client-since date.
2. **Relationship Health** — narrative paragraph ("You have worked with X for 14 months. 11 payments totalling €42,000. Average €3,818 per payment."), plus 4 metric tiles (first payment, last payment, relationship duration, payment count).
3. **Reliability Assessment** — Excellent / Good / Watch / Risk label derived purely from payment history (status, payment count, months active, revenue trend — no AI scoring), plus a plain-text description, avg interval, current gap, and avg payment size.
4. **Revenue Story** — all-time total, % of income contribution, 6-month mini bar chart, and a period-comparison section (recent 3-month avg vs prior 3-month avg).
5. **Client Momentum** — Growing / Stable / Shrinking / New label with a visual side-by-side bar comparing prior-period average to recent-period average (using `recentMonthlyAvg` and `priorMonthlyAvg` from the engine).
6. **Dependency Simulator** — "If this client stopped paying": monthly loss, annual loss, % of income, impact level (Manageable / Significant / Major / Critical), an income share bar, and a plain-text consequence statement. Impact thresholds: <15% Manageable · 15–29% Significant · 30–49% Major · 50%+ Critical.
7. **Payment Timeline** — chronological list (oldest first, capped at 24 most recent), with gap labels between each payment, unusual-gap flagging (>1.5× average interval and >30 days), proportional amount bars, and "First", "Largest", and "Most recent" badges.
8. **Insights and Recommended Actions** — auto-generated from actual data (reliable, delay warning, dependency, decline, single-payment) and actions (Follow up / Monitor / No action needed).

**Follow-up threshold**: a client only receives a follow-up action / `risk` status if `paymentCount >= 3`. Clients with 1–2 payments have no established cadence — they may become `watch` if their gap is unusual, but never `risk` and never trigger a follow-up alert. Long-inactive clients (gap ≥ inactive threshold: `min(max(avgInterval × 3, 180 days), 548 days)`) are labeled `inactive` — no follow-up implied. Payment processors are always excluded from follow-up actions regardless of gap.

**Per-client verdict**: the detail page shows a colored verdict line under the client name — e.g. "Yes — Acme Ltd is paying consistently" (green) · "Follow up needed — Acme Ltd is overdue" (red) — driven by `client.status`.

**Date anchoring exception**: `client-risk-engine.ts` uses `new Date()` (real wall-clock today) for `currentGapDays` and the 6-month trend window. Every other analytics engine anchors to the user's last data point — this page is the intentional exception because client risk questions are real-world ("is this client overdue *right now*?"), not historical.

---

## 13. Forecast (`/forecast`)

**File**: `src/app/(dashboard)/forecast/page.tsx`. Calls `generateForecast(userId)` (regenerates on every page load — see [FORECAST_ENGINE.md §2](./FORECAST_ENGINE.md) for why this is cheap and idempotent) plus the same analytics-engine calls as the Dashboard, then `generateDashboardIntelligence()`.

**Page question**: "Should I worry about next month?" (shown in `h1` when `hasData`).

**Verdict subtitle** — immediately below the title: a one-line answer colored by `cashflowRisk`. Low → "No — your cashflow is consistently positive." · Medium → "Stay alert — some months show cashflow pressure." · High → "Yes, be careful…" · Critical → "Take action now…"

**Stale coverage banner** — same `coverageIsStale` logic as the Dashboard. Shown between `<DataCoverageBar>` and the main sections when data ends 2+ months before today.

**Payer revenue disclosure** — when `forecast.usedPayerRevenue` is true, the "How This Forecast Was Built" panel shows a green disclosure: "Income projection is based on payments from verified and likely clients only." When false (fallback to total income), it shows an amber prompt to upload more data. If `excludedReviewRevenue > 0`, an additional line names the excluded amount: "€{amount} in single-payment inflows excluded."

Rendered sections (in page order):
1. **Health overview row** — a 3-column grid: **Business Health Score** (0–100, see [FORECAST_ENGINE.md §8](./FORECAST_ENGINE.md)) + **Cashflow Risk** badge (see [FORECAST_ENGINE.md §9](./FORECAST_ENGINE.md)) + **Business Direction** card (`intel.businessTrendDirection` + `intel.trajectoryInsight`). Followed by an optional health-status narrative banner.
2. **Year-End Projection** — four tiles (Income, Expenses, Cashflow, Margin) for the next 12 months — see [FORECAST_ENGINE.md §11](./FORECAST_ENGINE.md). Values are prefixed with `~` (e.g. `~€24,000`) to signal they are estimates, not certainties.
3. **"How This Forecast Was Built"** panel — data range, months of history, transaction count, confidence level, a confidence-score progress bar with reasons, and a recurring-expenses floor callout. Positioned here (before Key Drivers) so methodology is visible before conclusions. See [FORECAST_ENGINE.md §12](./FORECAST_ENGINE.md).
4. **Key Drivers** — see [FORECAST_ENGINE.md §10](./FORECAST_ENGINE.md).
5. **Biggest Risk** / **Biggest Opportunity** cards — `intel.biggestRisk` / `intel.biggestOpportunity`.
6. **Recommended Actions** — `intel.forecastImprovements` (up to 4 items).
7. **Seasonal Insights** — `intel.seasonalInsights`.
8. **Trends Chart** — the same `<TrendsChart>` as the Dashboard, at the bottom for historical context.

---

## 14. History (`/history`) — review and fix categorization

**File**: `src/app/(dashboard)/history/page.tsx` (149 lines) + `src/components/history/*`.

- **Filters** (`<HistoryFilters>`): transaction type, category, year, month, free-text search, and a "low confidence only" toggle — all via URL search params (`?type=&category=&year=&month=&q=&confidence=low`), so filtered views are shareable/bookmarkable links.
- **`<NeedsReviewBanner>`** — shown if `lowConfidenceCount > 0` (transactions where `categoryConfidence === "low"`), nudging the user toward the `confidence=low` filter.
- **`<DataCoverageBar>`** — same component as Dashboard/Analytics.
- **`<RecategorizeAllButton>`** — calls `POST /api/transactions/recategorize-all`, re-running categorization on every stored transaction (useful after the categorization engine or the user's learned rules have improved). See [ARCHITECTURE.md §8b](./ARCHITECTURE.md) and [CATEGORIZATION_ENGINE.md](./CATEGORIZATION_ENGINE.md).
- **`<TransactionList>`** — paginated (50/page) list of transactions. Each row has a **`<RecategorizeButton>`**: pick a new category, optionally **"apply to all transactions with this description"** (the learning-loop checkbox). Calls `PATCH /api/transactions/recategorize` — see [ARCHITECTURE.md §8b](./ARCHITECTURE.md) for the full flow (learned-rule upsert, audit log, analytics/forecast recalculation).
- **Month filtering caveat**: filtering by month *without* a year requires loading **all** matching transactions and filtering in-memory by `getUTCMonth()` (Prisma can't filter by month-of-year directly across arbitrary years) — `useMonthFilter` branch in the page. Filtering by year (with or without month) uses a proper `gte`/`lt` date-range query and is paginated server-side.

---

## 15. Settings (`/settings`)

**File**: `src/app/(dashboard)/settings/page.tsx` (46 lines) + `src/components/settings/{SignOutButton,DeleteAccountSection}.tsx`.

- **Account card** — shows the user's email + `<SignOutButton>` (`supabase.auth.signOut()` → redirect to `/login`).
- **`<ExportDataButton>`** — calls `GET /api/export`, which streams all of the user's transactions as a downloadable CSV. The export includes every transaction field (date, description, amount, type, category, account name, intent).
- **Data notice** — a static reassurance banner about data handling.
- **`<DeleteAccountSection>`** — a confirmation-gated **"Delete account"** flow → `DELETE /api/account`. See [ARCHITECTURE.md §8c](./ARCHITECTURE.md) for the full cascade (Storage files → `User` row, cascading to all owned tables → Supabase Auth user → sign-out).

---

## How to modify safely

### Adding a new step to the signup/login flow

- Both `login/page.tsx` and `signup/page.tsx` use a local `Mode` union (`"signin" | "forgot" | "sent"` / `"signup" | "confirm"`) to switch between full-screen states **within the same component** — there's no separate route per state. If you need a new state (e.g. a "2FA" step), follow this pattern rather than creating a new page, so the shared `<BrandHeader>`/spinner/error styling stays consistent.
- Every `friendlyError()` function is a manual `string.includes()` mapping from Supabase's raw English error messages to translation keys. If Supabase changes its error wording, these mappings silently stop matching and fall through to `"generic"` — if users start seeing generic errors for what should be a specific case (e.g. "email already registered"), check these mappings first.

### Changing what happens after upload

- The "View Dashboard" button's `?firstUpload=true` query param is the **only** signal that drives `<FirstUploadBanner>`. If you change the upload-success screen's navigation, make sure this param (or an equivalent) is preserved, or the banner will never show.
- `recalculateMonthlyAnalytics` + `generateForecast` run **inside** `POST /api/uploads/process`, so the "Done" screen's stats reflect the *full* updated dataset, not just the new file — don't move these calls to be async/fire-and-forget without also updating what the done-screen can show immediately.

### Adding a new `(dashboard)` page

- Follow the pattern in any existing page: `createClient()` → `getUser()` → `redirect("/login")` if absent, `export const dynamic = "force-dynamic"`, fetch via `Promise.all([...lib calls])`. It automatically gets `<Navbar />` from the layout.
- Add an entry to `NAV_LINKS` in `src/components/ui/Navbar.tsx` (the 6-item desktop array). The mobile bottom bar uses `MOBILE_NAV_LINKS`, which is `NAV_LINKS` filtered to 5 items (currently excludes `history`). Decide whether the new page should appear on mobile and update that filter accordingly. Add `common.nav.<key>` (full label) and `common.nav.<key>Mobile` (short label) translation keys to both `messages/en.json` and `messages/fr.json`.

### Things to be careful about

- **The empty-state dashboard (§8) and the populated dashboard (§11) are two almost entirely different render trees** inside the same `if (!hasData) {...} else {...}` block — if you add a widget that should also show useful information with zero data (e.g. an onboarding checklist), it needs to be added to *both* branches deliberately, not just the populated one.
- **`/reset-password` and middleware**: if you ever add new auth-related pages, double check the `authOnlyPaths`/`publicPaths` lists in `middleware.ts` — a new auth page that's missing from `publicPaths` will bounce unauthenticated users to `/login` before they can use it (as happened historically with `/reset-password`, which is why it has its own carve-out — see [AUTHENTICATION.md](./AUTHENTICATION.md)).
- **History's month-only filter loads all matching rows into memory** (§14) — if a user has tens of thousands of transactions, filtering "March, any year" is `O(all transactions)`, not `O(50)`. This is a known, deliberate trade-off (Prisma/Postgres can't easily express "month of year across all years" without raw SQL) — if it becomes a performance problem, the fix is a raw SQL query with `EXTRACT(MONTH FROM "transactionDate")`, not a quick tweak to the existing Prisma query.
