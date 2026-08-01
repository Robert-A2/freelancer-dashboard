import { prisma } from "../prisma";
import { extractMerchantCandidate } from "./extract";
import { recomputeMerchantConfidence } from "./confidence";
import type { MerchantResolutionOptions } from "./types";

// Geography/entity noise that legitimately trails a merchant name without
// being part of its identity (e.g. "AMAZON WEB SERVICES EU" is the same
// merchant as "Amazon Web Services"). Deliberately separate from
// payer-engine.ts's LEGAL_SUFFIXES (already stripped upstream by
// normalizeMatchKey() before this ever runs) — this list is pure
// geography/region words, never product-distinguishing ones, so "Amazon"
// and "Amazon Prime" never collide. Does NOT solve brand-substitution cases
// (e.g. "GOOGLE IRELAND" for "Google Ads" — there's no shared root to strip
// down to); those need a curated alias or fuzzy/AI matching, out of scope here.
const GEO_NOISE_TOKENS = [
  "ireland", "uk", "usa", "us", "america", "europe", "eu",
  "global", "intl", "international", "worldwide", "emea", "apac",
];

export function stripGeoNoise(key: string): string | null {
  let stripped = key;
  let changed = true;
  while (changed) {
    changed = false;
    for (const token of GEO_NOISE_TOKENS) {
      const re = new RegExp(`(?:^|\\s+)${token}\\s*$`);
      const cleaned = stripped.replace(re, "").trim();
      if (cleaned !== stripped && cleaned.length >= 2) {
        stripped = cleaned;
        changed = true;
      }
    }
  }
  return stripped !== key ? stripped : null;
}

// Merchant Relationships (Phase 4) — a small, curated prefix list mirroring
// scripts/seed-merchant-relationships.ts's own family list. When a brand-new
// unknown merchant's normalized key STARTS WITH one of these, it inherits
// parentCompany at creation time — no need to wait for a human to correct it
// first. Deliberately prefix-based (not substring) to stay conservative: a
// merchant literally named "Google Analytics Consulting LLC" is plausibly
// still Google-family, but a merchant merely MENTIONING "google" mid-string
// (e.g. "Payment via Google Pay to Bob's Diner") is not — prefix matching
// avoids that false-positive class entirely.
const KNOWN_PARENT_COMPANY_PREFIXES: Array<{ prefix: string; parentCompany: string }> = [
  { prefix: "google", parentCompany: "Google" },
  { prefix: "facebook", parentCompany: "Meta" },
  { prefix: "instagram", parentCompany: "Meta" },
  { prefix: "whatsapp", parentCompany: "Meta" },
  { prefix: "adobe", parentCompany: "Adobe" },
];

function inferParentCompany(normalizedKey: string): string | null {
  const match = KNOWN_PARENT_COMPANY_PREFIXES.find((f) => normalizedKey.startsWith(f.prefix));
  return match?.parentCompany ?? null;
}

/**
 * Batch merchant-identity resolution, run once per import in the background
 * (mirrors resolvePayers()'s shape exactly — see payer-engine.ts). Two paths:
 *
 *  - KNOWN merchant (categorizeTransaction already found a matchedMerchantId
 *    — a static-pack or DB match — persisted onto Transaction.merchantId at
 *    creation time): O(1) — bump Merchant.popularity. This is what makes
 *    "every merchant accumulates knowledge over time" true even for
 *    already-correctly-categorized merchants, at negligible cost.
 *  - UNKNOWN merchant (category === "uncategorized", the true fallback, no
 *    merchantId set): full extractMerchantCandidate() → dedupe against
 *    existing Merchant by normalizedKey (GLOBAL lookup — Merchant has no
 *    userId, unlike Payer) → create-or-increment.
 *
 * Never re-categorizes — this only builds/enriches identity around whatever
 * the fast synchronous waterfall already decided.
 */
export async function resolveMerchants(
  userId: string,
  transactionIds: string[],
  // Reserved AI-assist seam, never passed by any v1 call site. The intended
  // fast-follow: a `resolveUnknownMerchantWithAI(candidate, context):
  // Promise<{ category, industry?, confidence, explanation } | null>` passed
  // in as `options.onUnknownMerchant` below, invoked only for merchants that
  // reach the "unknown" branch below AND whose existing globalConfidence is
  // < 30 (i.e. genuinely uncategorized or barely-resolved) — never for
  // anything the static packs or DB already solved. Its result would be
  // written with `source: "ai-assisted"` (already a valid Merchant.source
  // value) and the `explanation` stored in `Merchant.metadata` (already a
  // Json? column) — no schema migration needed when this lands.
  options?: MerchantResolutionOptions,
): Promise<void> {
  if (transactionIds.length === 0) return;
  void options; // reserved, unused in v1 — see MerchantResolutionOptions

  const txs = await prisma.transaction.findMany({
    where: { id: { in: transactionIds }, userId, transactionType: "expense" },
    select: { id: true, description: true, category: true, amount: true, merchantId: true },
  });
  if (txs.length === 0) return;

  const known = txs.filter((t) => t.merchantId);
  const unknown = txs.filter((t) => !t.merchantId && t.category === "uncategorized");

  // ── Known merchants: O(1) popularity bump ────────────────────────────────
  if (known.length > 0) {
    const byMerchant = new Map<string, number>();
    for (const t of known) byMerchant.set(t.merchantId!, (byMerchant.get(t.merchantId!) ?? 0) + 1);
    for (const [merchantId, count] of byMerchant) {
      await prisma.merchant.update({
        where: { id: merchantId },
        data: { popularity: { increment: count } },
      }).catch(() => { /* non-critical */ });
    }
  }

  if (unknown.length === 0) return;

  // ── Unknown merchants: extract, dedupe globally, create-or-increment ────
  const existingAliases = await prisma.merchantAlias.findMany({
    where: { merchant: { transactionType: "expense" } },
    select: { keyword: true, merchantId: true, id: true },
  });
  const aliasMap = new Map<string, { merchantId: string; aliasId: string }>(
    existingAliases.map((a) => [a.keyword, { merchantId: a.merchantId, aliasId: a.id }]),
  );

  const txUpdates: Array<{ id: string; merchantId: string }> = [];
  const newMerchants = new Map<string, { candidateName: string; txIds: string[] }>();
  const aliasHits = new Map<string, { merchantId: string; aliasId: string; txIds: string[] }>();
  // New aliases to write for variants resolved via the geo-noise fallback
  // below — deduped by keyword so a repeated variant within one batch
  // doesn't attempt the same insert twice.
  const newAliasesToCreate = new Map<string, string>(); // keyword -> merchantId

  for (const tx of unknown) {
    // Transaction.amount is always stored as a positive absolute value
    // (direction lives in transactionType) — extractMerchantCandidate expects
    // a signed amount (matching categorizeTransaction()'s live-parse calling
    // convention), so re-sign it negative here: this query already filtered
    // to transactionType: "expense", so that's always the correct sign.
    const extraction = extractMerchantCandidate(tx.description, -Math.abs(Number(tx.amount)));
    if (!extraction) continue; // stays uncategorized — nothing extractable, no false identity created

    const { normalizedKey, candidateName } = extraction;
    const existingMatch = aliasMap.get(normalizedKey);

    if (existingMatch) {
      const hit = aliasHits.get(normalizedKey) ?? { ...existingMatch, txIds: [] };
      hit.txIds.push(tx.id);
      aliasHits.set(normalizedKey, hit);
      txUpdates.push({ id: tx.id, merchantId: existingMatch.merchantId });
      continue;
    }

    // Geography/entity noise fallback (see resolveMerchantForDescription for
    // the single-transaction version). Checks both existing aliases AND a
    // merchant's own normalizedKey directly — most merchants this function
    // creates have no alias row for their own key (see the comment below),
    // so an alias-only check would miss the common case of a plain merchant
    // created by an earlier import.
    const reducedKey = stripGeoNoise(normalizedKey);
    if (reducedKey) {
      const reducedAliasMatch = aliasMap.get(reducedKey);
      const reducedMerchantId = reducedAliasMatch?.merchantId ?? (
        await prisma.merchant.findUnique({
          where: { normalizedKey_transactionType: { normalizedKey: reducedKey, transactionType: "expense" } },
          select: { id: true },
        })
      )?.id;
      if (reducedMerchantId) {
        newAliasesToCreate.set(normalizedKey, reducedMerchantId);
        txUpdates.push({ id: tx.id, merchantId: reducedMerchantId });
        continue;
      }
    }

    if (newMerchants.has(normalizedKey)) {
      newMerchants.get(normalizedKey)!.txIds.push(tx.id);
    } else {
      newMerchants.set(normalizedKey, { candidateName, txIds: [tx.id] });
    }
  }

  // Persist new Merchant identities. Merchant.normalizedKey is itself the
  // unique match key (unlike Payer, which has no matchKey of its own and
  // relies entirely on PayerAlias) — a fresh unknown merchant needs no
  // separate alias row for its own canonical key. The upsert's unique
  // constraint also makes this safe against the same unknown merchant
  // resurfacing in a later import that this batch's in-memory aliasMap
  // (built once, at the top of this function) didn't know about.
  for (const [normalizedKey, data] of newMerchants) {
    const merchant = await prisma.merchant.upsert({
      where: { normalizedKey_transactionType: { normalizedKey, transactionType: "expense" } },
      update: { popularity: { increment: data.txIds.length } },
      create: {
        canonicalName: data.candidateName,
        normalizedKey,
        transactionType: "expense",
        category: "uncategorized",
        confidence: "low",
        source: "user-derived",
        popularity: data.txIds.length,
        parentCompany: inferParentCompany(normalizedKey),
      },
    });
    for (const txId of data.txIds) txUpdates.push({ id: txId, merchantId: merchant.id });
    await recomputeMerchantConfidence(merchant.id);
  }

  // Increment hit counts for existing aliases
  for (const hit of aliasHits.values()) {
    if (hit.aliasId) {
      await prisma.merchantAlias.update({
        where: { id: hit.aliasId },
        data: { hitCount: { increment: hit.txIds.length } },
      }).catch(() => { /* non-critical */ });
    }
  }

  // Write new aliases for variants resolved via the geo-noise fallback above
  // — the concrete "aliases continuously expand over time" mechanism.
  for (const [keyword, merchantId] of newAliasesToCreate) {
    await prisma.merchantAlias.create({
      data: { merchantId, keyword, source: "user-derived" },
    }).catch(() => { /* race with a concurrent identical alias insert — non-critical */ });
  }

  // Apply merchantId to resolved transactions. Batched to avoid exhausting
  // the DB connection pool on large imports (matches resolvePayers()).
  const UPDATE_BATCH = 50;
  for (let i = 0; i < txUpdates.length; i += UPDATE_BATCH) {
    await Promise.all(
      txUpdates.slice(i, i + UPDATE_BATCH).map((u) =>
        prisma.transaction.update({ where: { id: u.id }, data: { merchantId: u.merchantId } })
      )
    );
  }
}

async function findExistingMerchantByKey(normalizedKey: string): Promise<string | null> {
  const existingAlias = await prisma.merchantAlias.findUnique({
    where: { keyword: normalizedKey },
    select: { merchantId: true },
  });
  if (existingAlias) return existingAlias.merchantId;

  const existingMerchant = await prisma.merchant.findUnique({
    where: { normalizedKey_transactionType: { normalizedKey, transactionType: "expense" } },
    select: { id: true },
  });
  return existingMerchant?.id ?? null;
}

/**
 * Single-transaction lookup-or-create merchant identity, used by the manual
 * recategorize route's feedback loop (see recategorize/route.ts) — unlike
 * resolveMerchants(), this resolves one correction event synchronously
 * instead of batching an import. Expense-side only, matching
 * extractMerchantCandidate()'s scope (the amount sign only ever gates that
 * function's expense check, so a fixed negative placeholder is sufficient
 * here — callers only invoke this for expense-type transactions).
 */
export async function resolveMerchantForDescription(description: string): Promise<string | null> {
  const extraction = extractMerchantCandidate(description, -1);
  if (!extraction) return null;

  const { normalizedKey, candidateName } = extraction;

  const existingMatch = await findExistingMerchantByKey(normalizedKey);
  if (existingMatch) return existingMatch;

  // Geography/entity noise fallback (see GEO_NOISE_TOKENS above) — e.g.
  // "AMAZON WEB SERVICES EU" resolves to the same identity as an existing
  // "Amazon Web Services" merchant even with no exact-key match. On a hit,
  // write a new alias for the ORIGINAL variant's key so the next occurrence
  // is an O(1) exact match next time — this is the "aliases continuously
  // expand over time" mechanism.
  const reducedKey = stripGeoNoise(normalizedKey);
  if (reducedKey) {
    const reducedMatch = await findExistingMerchantByKey(reducedKey);
    if (reducedMatch) {
      await prisma.merchantAlias.create({
        data: { merchantId: reducedMatch, keyword: normalizedKey, source: "user-derived" },
      }).catch(() => { /* race with a concurrent identical alias insert — non-critical */ });
      return reducedMatch;
    }
  }

  const merchant = await prisma.merchant.create({
    data: {
      canonicalName: candidateName,
      normalizedKey,
      transactionType: "expense",
      category: "uncategorized",
      confidence: "low",
      source: "user-derived",
      popularity: 1,
      parentCompany: inferParentCompany(normalizedKey),
    },
  });
  return merchant.id;
}
