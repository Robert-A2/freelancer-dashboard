import { PrismaClient } from "@prisma/client";
import { ACTIVE_PACKS } from "../src/lib/categorization/packs";
import { KEYWORD_PATTERNS } from "../src/lib/categorization/keywords";
import type { MerchantEntry, MerchantPack } from "../src/lib/categorization/types";
import { recomputeMerchantConfidence } from "../src/lib/merchant-intelligence";

const prisma = new PrismaClient();

// Idempotent upsert of the ~1,093 static-pack keywords into Merchant, as
// source: "static-pack" rows. This is NOT a matching-behavior change — the
// static arrays in engine.ts are still checked first and still win every
// match (see docs/CATEGORIZATION_ENGINE.md's merge order); this is purely
// for identity completeness, so every static-pack hit has a Merchant.id to
// increment popularity/confidence against (see resolveMerchants()), and so
// there's one unified place to browse "everything Nonodia knows" instead of
// two disconnected sources. Mirrors prisma/seed.ts's upsert pattern exactly.

function countryForPack(pack: MerchantPack): string | null {
  return pack.id === "france" ? "FR" : null;
}

async function upsertEntry(entry: MerchantEntry, country: string | null) {
  const existing = await prisma.merchant.findUnique({
    where: { normalizedKey_transactionType: { normalizedKey: entry.keyword, transactionType: "expense" } },
  });

  const merchant = await prisma.merchant.upsert({
    where: { normalizedKey_transactionType: { normalizedKey: entry.keyword, transactionType: "expense" } },
    update: {
      category: entry.category,
      confidence: entry.confidence,
      country,
      isActive: true,
    },
    create: {
      canonicalName: entry.keyword,
      normalizedKey: entry.keyword,
      transactionType: "expense",
      category: entry.category,
      confidence: entry.confidence,
      country,
      source: "static-pack",
    },
  });

  await recomputeMerchantConfidence(merchant.id);

  return existing ? "updated" : "created";
}

async function main() {
  let created = 0;
  let updated = 0;

  for (const pack of ACTIVE_PACKS) {
    const country = countryForPack(pack);
    for (const entry of pack.entries) {
      const result = await upsertEntry(entry, country);
      if (result === "created") created++; else updated++;
    }
  }

  // Generic Layer-3 keyword patterns (e.g. "boulangerie" -> food) — no
  // specific country, always medium confidence per keywords.ts's own convention.
  for (const entry of KEYWORD_PATTERNS) {
    const result = await upsertEntry(entry, null);
    if (result === "created") created++; else updated++;
  }

  const total = ACTIVE_PACKS.reduce((s, p) => s + p.entries.length, 0) + KEYWORD_PATTERNS.length;
  console.log(`Static-merchant seed complete: ${created} created, ${updated} updated (${total} total entries).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
