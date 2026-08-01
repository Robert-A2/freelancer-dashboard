import { PrismaClient } from "@prisma/client";
import { ALL_SEED_MERCHANTS } from "./seed-data";
import { recomputeMerchantConfidence } from "../src/lib/merchant-intelligence";

const prisma = new PrismaClient();

// Idempotent upsert of the curated merchant directory (prisma/seed-data/).
// Re-run any time with `npm run db:seed` after editing a seed-data file —
// existing rows are updated in place, nothing is duplicated.
async function main() {
  let created = 0;
  let updated = 0;
  let aliasCount = 0;

  for (const m of ALL_SEED_MERCHANTS) {
    const existing = await prisma.merchant.findUnique({
      where: { normalizedKey_transactionType: { normalizedKey: m.keyword, transactionType: m.transactionType } },
    });

    // undefined (not null) for every knowledge field below when the seed
    // entry doesn't specify one — Prisma omits undefined keys from the SQL
    // SET/INSERT entirely, so an entry that only names a keyword/category
    // never clobbers a richer value set by a later, more detailed edit to
    // the same entry (or vice versa on re-run).
    const recurringIndicator = m.recurring === undefined ? undefined : m.recurring ? "always" : "never";

    const merchant = await prisma.merchant.upsert({
      where: { normalizedKey_transactionType: { normalizedKey: m.keyword, transactionType: m.transactionType } },
      update: {
        canonicalName: m.name,
        category: m.category,
        confidence: m.confidence,
        country: m.country ?? null,
        notes: m.notes ?? null,
        isActive: true,
        // Corrects rows created before `source` existed on this table — they
        // picked up the column's schema default ("static-pack") on that
        // migration, which is wrong for anything from this file specifically.
        source: "seed-curated",
        parentCompany: m.parentCompany,
        industry: m.industry,
        businessFunction: m.businessPurpose,
        website: m.website,
        recurringIndicator,
      },
      create: {
        canonicalName: m.name,
        normalizedKey: m.keyword,
        transactionType: m.transactionType,
        category: m.category,
        confidence: m.confidence,
        country: m.country ?? null,
        notes: m.notes ?? null,
        source: "seed-curated",
        parentCompany: m.parentCompany,
        industry: m.industry,
        businessFunction: m.businessPurpose,
        website: m.website,
        recurringIndicator,
      },
    });

    if (existing) updated++;
    else created++;

    for (const alias of m.aliases ?? []) {
      await prisma.merchantAlias.upsert({
        where: { keyword: alias },
        update: { merchantId: merchant.id },
        create: { merchantId: merchant.id, keyword: alias },
      });
      aliasCount++;
    }

    await recomputeMerchantConfidence(merchant.id);
  }

  console.log(
    `Seed complete: ${created} merchants created, ${updated} updated, ${aliasCount} aliases upserted ` +
    `(${ALL_SEED_MERCHANTS.length} total entries).`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
