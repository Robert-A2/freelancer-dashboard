import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Ranked worklist of real, user-derived merchants the intelligence pipeline
// hasn't confidently resolved yet — candidates for manual curation (or a
// future AI-assisted pass, see resolve.ts's onUnknownMerchant seam). Kept
// alongside UncategorizedMerchantReport (see merchant-reports.ts), not a
// replacement for it: that table tracks raw uncategorized description
// strings pre-identity; this tracks resolved-but-low-confidence Merchant
// rows post-identity, ranked by real-world reach (popularity).
async function main() {
  const candidates = await prisma.merchant.findMany({
    where: { source: "user-derived", confidence: "low" },
    orderBy: { popularity: "desc" },
    take: 50,
    select: {
      canonicalName: true,
      normalizedKey: true,
      category: true,
      globalConfidence: true,
      popularity: true,
      country: true,
      _count: { select: { transactions: true } },
    },
  });

  if (candidates.length === 0) {
    console.log("No low-confidence user-derived merchants found — nothing to review.");
    return;
  }

  console.log(`${candidates.length} low-confidence merchant(s) awaiting curation, ranked by popularity:\n`);
  for (const m of candidates) {
    console.log(
      `${m.canonicalName.padEnd(35)} key=${m.normalizedKey.padEnd(25)} ` +
      `category=${m.category.padEnd(15)} popularity=${String(m.popularity).padEnd(4)} ` +
      `globalConfidence=${m.globalConfidence} txCount=${m._count.transactions} country=${m.country ?? "-"}`
    );
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
