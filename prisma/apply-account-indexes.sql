-- Run this AFTER `prisma db push` has applied the schema changes.
-- Replaces the old flat unique constraint with two partial indexes for
-- per-account deduplication while keeping the legacy no-account path.

-- 1. Drop old flat unique constraint (name used by Prisma's auto-naming)
DROP INDEX IF EXISTS "transactions_userId_transactionDate_description_amount_key";

-- 2. Per-account dedup: same file can't be re-imported to the same account
CREATE UNIQUE INDEX IF NOT EXISTS tx_dedup_with_account
  ON transactions("userId", "accountId", "transactionDate", description, amount)
  WHERE "accountId" IS NOT NULL;

-- 3. Legacy dedup: rows without an account keep cross-account dedup
CREATE UNIQUE INDEX IF NOT EXISTS tx_dedup_no_account
  ON transactions("userId", "transactionDate", description, amount)
  WHERE "accountId" IS NULL;
