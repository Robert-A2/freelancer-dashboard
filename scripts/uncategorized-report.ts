import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Worklist for the next prisma/seed-data update — the most common merchants
// that fell through to "uncategorized" across all users, grouped by
// normalized merchant key (see normalizeMerchantKey in src/lib/categorization).
async function main() {
  const rows = await prisma.uncategorizedMerchantReport.findMany({
    where: { status: "new" },
    orderBy: { occurrenceCount: "desc" },
    take: 30,
  });

  if (rows.length === 0) {
    console.log("No new uncategorized merchants reported.");
    return;
  }

  for (const row of rows) {
    console.log(`${String(row.occurrenceCount).padStart(4)} x  ${row.sampleDescription}  (key: ${row.merchantKey})`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
