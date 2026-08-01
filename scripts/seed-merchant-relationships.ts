import { PrismaClient } from "@prisma/client";
import { recomputeMerchantConfidence } from "../src/lib/merchant-intelligence";

const prisma = new PrismaClient();

// Curated merchant-family relationships (Merchant.parentCompany) — the PDF's
// own worked examples. Deliberately a small, separate, idempotent concern
// from category/confidence seeding (prisma/seed.ts): parentCompany is a
// Merchant-table-only field the static packs (src/lib/categorization/packs/)
// have no equivalent for, so most of these rows already exist as
// source:"static-pack" Merchant rows (seeded by scripts/seed-static-merchants.ts)
// — this only ADDS parentCompany to them in place, never touching their
// existing category/confidence/source. "WhatsApp Business" doesn't exist as
// a merchant anywhere yet, so it's created fresh (source:"seed-curated").
const FAMILIES: Array<{
  canonicalName: string;
  normalizedKey: string;
  category: string;
  parentCompany: string;
}> = [
  { canonicalName: "Google Ads", normalizedKey: "google ads", category: "marketing", parentCompany: "Google" },
  { canonicalName: "Google Workspace", normalizedKey: "google workspace", category: "software", parentCompany: "Google" },
  { canonicalName: "Google Cloud Platform", normalizedKey: "google cloud platform", category: "software", parentCompany: "Google" },
  { canonicalName: "Google Domains", normalizedKey: "google domains", category: "software", parentCompany: "Google" },
  { canonicalName: "Facebook Ads", normalizedKey: "facebook ads", category: "marketing", parentCompany: "Meta" },
  { canonicalName: "Instagram Ads", normalizedKey: "instagram ads", category: "marketing", parentCompany: "Meta" },
  { canonicalName: "WhatsApp Business", normalizedKey: "whatsapp business", category: "software", parentCompany: "Meta" },
  { canonicalName: "Adobe", normalizedKey: "adobe", category: "software", parentCompany: "Adobe" },
  { canonicalName: "Adobe Creative Cloud", normalizedKey: "adobe creative cloud", category: "software", parentCompany: "Adobe" },
];

async function main() {
  let updated = 0;
  let created = 0;

  for (const f of FAMILIES) {
    const existing = await prisma.merchant.findUnique({
      where: { normalizedKey_transactionType: { normalizedKey: f.normalizedKey, transactionType: "expense" } },
    });

    if (existing) {
      await prisma.merchant.update({ where: { id: existing.id }, data: { parentCompany: f.parentCompany } });
      updated++;
    } else {
      const merchant = await prisma.merchant.create({
        data: {
          canonicalName: f.canonicalName,
          normalizedKey: f.normalizedKey,
          transactionType: "expense",
          category: f.category,
          confidence: "high",
          source: "seed-curated",
          parentCompany: f.parentCompany,
        },
      });
      await recomputeMerchantConfidence(merchant.id);
      created++;
    }
  }

  console.log(`Merchant relationships seeded: ${updated} existing row(s) updated, ${created} new row(s) created (${FAMILIES.length} total).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
