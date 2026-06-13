# Freelancer OS — Documentation

This is the source of truth for how Freelancer OS works — written so a developer who has never seen the project (including a future version of you, or Claude in a brand-new session) can understand, maintain, and extend it without prior context.

Every doc follows the same shape:
- **What it does** / **Why it exists** / **Where the code is** / **How to modify it safely**
- Mermaid diagrams for flows and decision logic
- Tables for formulas, thresholds, and enumerable data
- Cross-references to related docs instead of duplicated explanations

> **Keeping this in sync**: whenever code changes, update the matching doc(s) below in the same pass — don't let this drift into a historical snapshot. See the "How to modify safely" section of each doc for what triggers an update.

---

## Start here

| Doc | What it covers |
|---|---|
| [PRODUCT.md](./PRODUCT.md) | What Freelancer OS *is*, who it's for, the core philosophy, and the value proposition — the "why" behind every other doc. |
| [USER_JOURNEY.md](./USER_JOURNEY.md) | The full walkthrough: landing → signup → first (empty) dashboard → CSV upload → insights → ongoing usage → settings. The best entry point for understanding what a user actually experiences. |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | The map of the codebase — Next.js routing, Supabase + Prisma, `src/lib` services, the two data-fetching patterns, and the three end-to-end data-flow pipelines (upload, recategorize, account deletion). |

## Data

| Doc | What it covers |
|---|---|
| [DATABASE.md](./DATABASE.md) | Every Prisma model and field, what it's for, and how the tables relate to each other. |
| [CSV_IMPORT.md](./CSV_IMPORT.md) | How an arbitrary bank CSV (any bank, any column layout/date/amount format) is detected, parsed, and validated into `Transaction` rows. |

## Core engines

| Doc | What it covers |
|---|---|
| [CATEGORIZATION_ENGINE.md](./CATEGORIZATION_ENGINE.md) | How each transaction's type (income/expense/savings/transfer), category, and confidence are determined — plus merchant recognition and the user-correction learning loop. |
| [ANALYTICS_ENGINE.md](./ANALYTICS_ENGINE.md) | How raw transactions become monthly aggregates, month-over-month comparisons, category trends, client concentration, and data-coverage/health stats. |
| [FORECAST_ENGINE.md](./FORECAST_ENGINE.md) | The next-month projection formulas, confidence scoring, the 0–100 Business Health Score, cashflow risk levels, and year-end projections. |
| [INTELLIGENCE_ENGINE.md](./INTELLIGENCE_ENGINE.md) | How raw numbers become plain-language insights — the `Insight {key, values}` pattern, historical insights, and the dashboard's narrative fields (snapshot, trajectory, risk, opportunity). |

## Platform

| Doc | What it covers |
|---|---|
| [AUTHENTICATION.md](./AUTHENTICATION.md) | Supabase Auth setup (browser/server/admin clients), the `middleware.ts` auth gate, login/signup/password-reset flows, session persistence, and sign-out. |
| [TRANSLATIONS.md](./TRANSLATIONS.md) | Where all user-facing text lives (`messages/en.json` / `fr.json`), next-intl setup, and how to add or edit English/French content — including the `Insight`/`cat()`/`<InsightText>` rendering conventions. |

---

## Suggested reading order for a new developer

1. [PRODUCT.md](./PRODUCT.md) — understand *why* this exists before *how*.
2. [USER_JOURNEY.md](./USER_JOURNEY.md) — see the app through a user's eyes.
3. [ARCHITECTURE.md](./ARCHITECTURE.md) — get the technical map.
4. [DATABASE.md](./DATABASE.md) + [CSV_IMPORT.md](./CSV_IMPORT.md) — understand the data that flows in.
5. [CATEGORIZATION_ENGINE.md](./CATEGORIZATION_ENGINE.md) → [ANALYTICS_ENGINE.md](./ANALYTICS_ENGINE.md) → [FORECAST_ENGINE.md](./FORECAST_ENGINE.md) → [INTELLIGENCE_ENGINE.md](./INTELLIGENCE_ENGINE.md) — follow the data through the engine pipeline, in the order it actually runs.
6. [AUTHENTICATION.md](./AUTHENTICATION.md) and [TRANSLATIONS.md](./TRANSLATIONS.md) — cross-cutting concerns, reference as needed.
