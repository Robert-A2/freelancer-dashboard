import { PrismaClient } from "@prisma/client";
import { normalizeMatchKey } from "../src/lib/payer-engine";
import { recomputeMerchantConfidence } from "../src/lib/merchant-intelligence";

const prisma = new PrismaClient();

// User-curated list of Paris coffee-shop/café merchants (50 rows), added to
// close a real coverage gap: independent/specialty cafés have zero keyword
// coverage today, unlike the big chains (Starbucks, Costa, Pret) already in
// the static packs. Same pattern as scripts/seed-merchant-relationships.ts:
// source: "seed-curated", confidence: "high" (tier), globalConfidence (the
// NUMERIC 0-100 score) computed via the same recomputeMerchantConfidence()
// used everywhere else in the system — not hand-set, so a fresh high-tier
// entry lands at 90 exactly like every other seed-curated/static-pack row.
//
// Deliberately deduped from the raw 50-row table down to real distinct
// identities: several rows were the same brand at different Paris locations
// (Café Kitsuné x3, Terres de Café x2, Columbus Café x2) — those become ONE
// Merchant with multiple MerchantAlias rows, not competing duplicate
// Merchants. Several other rows were already covered by an existing
// static-pack Merchant (Starbucks, Costa Coffee, Pret A Manger, Brioche
// Dorée) — those are extended in place (new alias / parentCompany fill-in)
// rather than re-created. "Paul" was dropped entirely: the table's only safe
// alias ("PAUL BOULANGERIE") already matches the existing entry, and the
// bare word "Paul" is a common personal name — adding it as a standalone
// merchant would misclassify money sent to actual people named Paul.
// Likewise a few single common-word aliases (bare "copains", "nuances",
// "coutume", "fragments") are intentionally left out for the same reason —
// kept to the qualified 2+-word form instead, matching this codebase's
// existing conservative-keyword convention.

interface NewCafe {
  canonicalName: string;
  aliases: string[]; // extra match phrases beyond canonicalName itself
  parentCompany: string | null;
  confidence?: "high" | "medium"; // defaults to "high"
}

const NEW_CAFES: NewCafe[] = [
  { canonicalName: "Café Kitsuné", aliases: ["Kitsune Cafe", "Cafe Kitsune Palais Royal", "Kitsune Palais Royal", "Cafe Kitsune Louvre", "Kitsune Vertbois"], parentCompany: "Maison Kitsuné" },
  { canonicalName: "Terres de Café", aliases: ["Terres de Cafe Paris"], parentCompany: null },
  { canonicalName: "La Caféothèque", aliases: ["The Caféothèque of Paris"], parentCompany: null },
  { canonicalName: "Noir Coffee", aliases: [], parentCompany: null },
  { canonicalName: "Le Peloton Café", aliases: ["Peloton Cafe"], parentCompany: null },
  { canonicalName: "Motors Coffee", aliases: [], parentCompany: null },
  { canonicalName: "The Beans on Fire", aliases: ["Beans on Fire"], parentCompany: null },
  { canonicalName: "Parallel Coffee", aliases: [], parentCompany: null },
  { canonicalName: "Café Joyeux", aliases: [], parentCompany: null },
  { canonicalName: "Sample Cafe", aliases: ["Sample Cafe Paris"], parentCompany: null },
  { canonicalName: "Shukery Coffee & Matcha", aliases: ["Shukery Coffee", "Shukery Matcha"], parentCompany: null },
  { canonicalName: "FIKA Paris", aliases: [], parentCompany: null },
  { canonicalName: "Oats Coffee", aliases: [], parentCompany: null },
  { canonicalName: "Grace Café", aliases: [], parentCompany: null },
  { canonicalName: "Baguett's Café", aliases: ["Baguetts Cafe"], parentCompany: null },
  { canonicalName: "Coeur Coffee Roasters", aliases: ["Coeur Coffee"], parentCompany: null },
  { canonicalName: "Dom Café", aliases: [], parentCompany: null },
  { canonicalName: "Café Nuances", aliases: [], parentCompany: null },
  { canonicalName: "Dreamin' Man", aliases: [], parentCompany: null }, // apostrophe -> space either way; canonical's own normalized key already equals "dreamin man"
  { canonicalName: "Kapé", aliases: [], parentCompany: null },
  { canonicalName: "Phin Mi", aliases: ["PhinMi"], parentCompany: null },
  { canonicalName: "Copains Paris", aliases: [], parentCompany: null },
  { canonicalName: "% Arabica", aliases: [], parentCompany: "% Arabica International" }, // canonical's own normalized key is already "arabica" ("%" stripped)
  { canonicalName: "Bacha Coffee", aliases: ["Bacha", "Bacha Coffee Paris"], parentCompany: null },
  { canonicalName: "Café de Flore", aliases: ["Cafe de Flore Paris"], parentCompany: null },
  { canonicalName: "Les Deux Magots", aliases: [], parentCompany: null },
  { canonicalName: "Café de la Paix", aliases: ["Cafe de la Paix Paris"], parentCompany: "InterContinental Paris Le Grand" },
  { canonicalName: "Caffè Nero", aliases: [], parentCompany: null },
  { canonicalName: "Joe & The Juice", aliases: ["Joe and the Juice"], parentCompany: null },
  { canonicalName: "Café Richard", aliases: [], parentCompany: null },
  { canonicalName: "Malongo", aliases: ["Cafe Malongo"], parentCompany: null },
  { canonicalName: "L'Arbre à Café", aliases: ["Larbre a Cafe"], parentCompany: null }, // contracted real-world form: "l arbre a cafe" (apostrophe->space) != "larbre a cafe" (contracted)
  { canonicalName: "Coutume Café", aliases: [], parentCompany: null },
  { canonicalName: "KB CaféShop", aliases: ["KB Cafe"], parentCompany: "KB Coffee Roasters" },
  { canonicalName: "Café Verlet", aliases: ["Verlet"], parentCompany: null },
  { canonicalName: "Café de la Presse", aliases: [], parentCompany: null, confidence: "medium" }, // only "Medium" row in the source table
  { canonicalName: "Holybelly", aliases: ["Holybelly Paris"], parentCompany: null },
  { canonicalName: "Fragments Paris", aliases: ["Fragments Cafe"], parentCompany: null },
];

// Existing static-pack merchants to enrich in place — either a real coverage
// gap (an alias variant the current single keyword doesn't reach) or real
// parentCompany data the seed-static-merchants.ts pass never populated.
const ENRICH_EXISTING: Array<{
  normalizedKey: string; // must match an existing Merchant.normalizedKey exactly
  addAliases?: string[];
  parentCompany?: string;
}> = [
  { normalizedKey: "columbus cafe", addAliases: ["Columbus Sebastopol", "Columbus Paris Sebastopol"] },
  { normalizedKey: "angelina paris", addAliases: ["Angelina Tea Room"], parentCompany: "Groupe Bertrand" },
  { normalizedKey: "ladurée patisserie", addAliases: ["Laduree Paris"] },
  { normalizedKey: "costa coffee", parentCompany: "The Coca-Cola Company" },
  { normalizedKey: "brioche dorée", parentCompany: "Groupe Le Duff" },
  { normalizedKey: "brioche doree", parentCompany: "Groupe Le Duff" },
];

const DRY_RUN = process.argv.includes("--dry-run");

async function createAliasIfNew(merchantId: string, aliasPhrase: string) {
  const keyword = normalizeMatchKey(aliasPhrase);
  if (keyword.length < 2) return "skipped (too short)";

  const existing = await prisma.merchantAlias.findUnique({ where: { keyword } });
  if (existing) return existing.merchantId === merchantId ? "already present" : `SKIPPED — "${keyword}" already aliases a different merchant`;

  if (DRY_RUN) return `would create alias "${keyword}"`;
  await prisma.merchantAlias.create({ data: { merchantId, keyword, source: "seed-curated" } });
  return `created alias "${keyword}"`;
}

async function main() {
  console.log(DRY_RUN ? "=== DRY RUN — no writes ===" : "=== LIVE RUN ===");

  console.log("\n--- Enriching existing static-pack merchants ---");
  for (const item of ENRICH_EXISTING) {
    const merchant = await prisma.merchant.findUnique({
      where: { normalizedKey_transactionType: { normalizedKey: item.normalizedKey, transactionType: "expense" } },
    });
    if (!merchant) {
      console.log(`  [MISS] "${item.normalizedKey}" not found in DB — skipping enrichment`);
      continue;
    }
    console.log(`  ${merchant.canonicalName} (${merchant.id})`);
    if (item.parentCompany && !DRY_RUN) {
      await prisma.merchant.update({ where: { id: merchant.id }, data: { parentCompany: item.parentCompany } });
    }
    if (item.parentCompany) console.log(`    parentCompany -> ${item.parentCompany}${DRY_RUN ? " (dry run)" : ""}`);
    for (const alias of item.addAliases ?? []) {
      console.log(`    alias "${alias}": ${await createAliasIfNew(merchant.id, alias)}`);
    }
  }

  console.log("\n--- New seed-curated café merchants ---");
  let created = 0, skipped = 0;
  for (const cafe of NEW_CAFES) {
    const normalizedKey = normalizeMatchKey(cafe.canonicalName);
    if (normalizedKey.length < 2) {
      console.log(`  [SKIP] "${cafe.canonicalName}" -> empty normalized key`);
      skipped++;
      continue;
    }

    const existing = await prisma.merchant.findUnique({
      where: { normalizedKey_transactionType: { normalizedKey, transactionType: "expense" } },
    });
    if (existing) {
      console.log(`  [EXISTS] "${cafe.canonicalName}" -> "${normalizedKey}" already a Merchant (${existing.source}) — adding aliases only`);
      for (const alias of cafe.aliases) {
        console.log(`    alias "${alias}": ${await createAliasIfNew(existing.id, alias)}`);
      }
      skipped++;
      continue;
    }

    console.log(`  [NEW] "${cafe.canonicalName}" -> "${normalizedKey}" (confidence: ${cafe.confidence ?? "high"}, parentCompany: ${cafe.parentCompany ?? "—"})`);
    if (!DRY_RUN) {
      const merchant = await prisma.merchant.create({
        data: {
          canonicalName: cafe.canonicalName,
          normalizedKey,
          transactionType: "expense",
          category: "food",
          confidence: cafe.confidence ?? "high",
          source: "seed-curated",
          country: "FR",
          parentCompany: cafe.parentCompany,
        },
      });
      await recomputeMerchantConfidence(merchant.id);
      for (const alias of cafe.aliases) {
        console.log(`    alias "${alias}": ${await createAliasIfNew(merchant.id, alias)}`);
      }
    } else {
      for (const alias of cafe.aliases) {
        console.log(`    would add alias "${normalizeMatchKey(alias)}"`);
      }
    }
    created++;
  }

  console.log(`\nDone. ${created} new merchant(s), ${skipped} already covered/enriched-only.${DRY_RUN ? " (DRY RUN — nothing written)" : ""}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
