import { PrismaClient } from "@prisma/client";
import { ALL_SEED_MERCHANTS } from "./seed-data";

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
      where: { keyword_transactionType: { keyword: m.keyword, transactionType: m.transactionType } },
    });

    const merchant = await prisma.merchant.upsert({
      where: { keyword_transactionType: { keyword: m.keyword, transactionType: m.transactionType } },
      update: {
        name: m.name,
        category: m.category,
        confidence: m.confidence,
        country: m.country ?? null,
        notes: m.notes ?? null,
        isActive: true,
      },
      create: {
        name: m.name,
        keyword: m.keyword,
        transactionType: m.transactionType,
        category: m.category,
        confidence: m.confidence,
        country: m.country ?? null,
        notes: m.notes ?? null,
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
