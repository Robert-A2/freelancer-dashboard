# Freelancer OS

Financial clarity for freelancers and independent contractors. Upload any bank statement CSV — any bank, any format — and get automatic categorization, cashflow analytics, plain-language insights, and next-month forecasts, all without connecting to a bank API.

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router, React Server Components) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS |
| Database | PostgreSQL via Supabase, accessed through Prisma |
| Auth | Supabase Auth (`@supabase/ssr`) |
| i18n | next-intl — English and French |
| Charts | Recharts |
| CSV parsing | PapaParse (runs in the browser — raw file never sent to the server) |

---

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, DATABASE_URL, DIRECT_URL, SUPABASE_SERVICE_ROLE_KEY
npx prisma generate
npx prisma migrate deploy
npm run db:seed              # seeds Merchant / MerchantAlias tables
npm run dev
```

---

## Key commands

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server (`http://localhost:3000`) |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm test` | Vitest unit tests |
| `npm run db:generate` | Re-generate the Prisma client after a schema change |
| `npm run db:migrate` | Run pending Prisma migrations |
| `npm run db:seed` | Seed global Merchant / MerchantAlias data |
| `npm run report:uncategorized` | CLI report of the most common uncategorized merchants across all users |

---

## Documentation

Full documentation lives in [`/docs`](./docs/README.md).

| Doc | Covers |
|---|---|
| [PRODUCT.md](./docs/PRODUCT.md) | What it is, who it's for, design philosophy |
| [USER_JOURNEY.md](./docs/USER_JOURNEY.md) | Every screen, in order, from landing → upload → insights |
| [ARCHITECTURE.md](./docs/ARCHITECTURE.md) | Codebase map — routing, auth, API routes, data-fetching patterns |
| [DATABASE.md](./docs/DATABASE.md) | Every Prisma model and field |
| [CSV_IMPORT.md](./docs/CSV_IMPORT.md) | How arbitrary bank CSVs are parsed into transactions |
| [CATEGORIZATION_ENGINE.md](./docs/CATEGORIZATION_ENGINE.md) | How transactions get categorized and how the learning loop works |
| [ANALYTICS_ENGINE.md](./docs/ANALYTICS_ENGINE.md) | How raw transactions become monthly analytics and insights |
| [FORECAST_ENGINE.md](./docs/FORECAST_ENGINE.md) | Next-month projections, business health score, cashflow risk |
| [INTELLIGENCE_ENGINE.md](./docs/INTELLIGENCE_ENGINE.md) | How numbers become plain-language insights |
| [TRANSACTION_UNDERSTANDING.md](./docs/TRANSACTION_UNDERSTANDING.md) | The intent layer — WHY money moved, not just how it was counted |
| [AUTHENTICATION.md](./docs/AUTHENTICATION.md) | Supabase Auth, middleware, session management |
| [TRANSLATIONS.md](./docs/TRANSLATIONS.md) | i18n conventions, EN/FR message files, the Insight pattern |

---

## Privacy model

The raw CSV file is parsed entirely in the browser. The server receives only structured JSON rows — dates, amounts, merchant descriptions, and categories. The raw bank statement never travels to the server. See [`/data-privacy`](http://localhost:3000/data-privacy) in the app or [`docs/PRODUCT.md §7`](./docs/PRODUCT.md) for the full privacy commitment.
