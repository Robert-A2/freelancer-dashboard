import type { SeedMerchant } from "./types";

/**
 * "Office & Equipment" — the 8 merchants the user named, enriched with full
 * knowledge (all 8 already existed as bare static-pack keywords — none
 * needed a new keyword, just a real identity), plus real, well-known peers
 * in the same space added the same way ("as much as you can").
 *
 * Category mapping note: Amazon, IKEA, and Fnac are deliberately left at
 * their existing broad category ("retail") rather than narrowed to
 * "office" — they sell far more than office supplies, and retagging their
 * category would mis-categorize every non-office purchase through them
 * (groceries, clothes, books...). The user's "Office Supplies"/"Office
 * Setup"/"Technology Purchases" intent is captured in businessPurpose
 * instead, which doesn't affect matching. Everything else below (Staples,
 * Office Depot, Apple, Dell, etc.) already had a category specific enough
 * to safely match the user's intent as-is.
 *
 * Confidence is "high" tier for all — see income-platforms.ts's comment on
 * why globalConfidence itself is never hand-typed as a decimal.
 */
export const OFFICE_EQUIPMENT_MERCHANTS: SeedMerchant[] = [
  // ── User-provided list — all 8 already existed as static-pack keywords ──
  {
    name: "Amazon", keyword: "amazon", category: "retail", transactionType: "expense", confidence: "high",
    parentCompany: "Amazon.com, Inc.", industry: "Retail", businessPurpose: "Office Purchases",
    country: "US", website: "amazon.com", recurring: false,
  },
  {
    name: "IKEA", keyword: "ikea", category: "retail", transactionType: "expense", confidence: "high",
    parentCompany: "Inter IKEA Group", industry: "Furniture", businessPurpose: "Office Setup",
    country: "SE", website: "ikea.com", recurring: false,
  },
  {
    name: "Staples", keyword: "staples inc", category: "office", transactionType: "expense", confidence: "high",
    parentCompany: "Staples, Inc.", industry: "Office Retail", businessPurpose: "Consumables",
    country: "US", website: "staples.com", recurring: false,
  },
  {
    name: "Office Depot", keyword: "office depot", category: "office", transactionType: "expense", confidence: "high",
    parentCompany: "The ODP Corporation", industry: "Office Retail", businessPurpose: "Consumables",
    country: "US", website: "officedepot.com", recurring: false,
  },
  {
    name: "Fnac", keyword: "fnac", category: "retail", transactionType: "expense", confidence: "high",
    parentCompany: "Fnac Darty S.A.", industry: "Electronics Retail", businessPurpose: "Technology Purchases",
    country: "FR", website: "fnac.com", recurring: false,
  },
  {
    name: "Apple", keyword: "apple store", category: "equipment", transactionType: "expense", confidence: "high",
    parentCompany: "Apple Inc.", industry: "Consumer Electronics", businessPurpose: "Mac, iPhone, iPad",
    country: "US", website: "apple.com", recurring: false,
  },
  {
    name: "Dell", keyword: "dell technologies", category: "equipment", transactionType: "expense", confidence: "high",
    parentCompany: "Dell Technologies Inc.", industry: "Computer Hardware", businessPurpose: "Computers",
    country: "US", website: "dell.com", recurring: false,
  },
  {
    name: "Lenovo", keyword: "lenovo group", category: "equipment", transactionType: "expense", confidence: "high",
    parentCompany: "Lenovo Group Limited", industry: "Computer Hardware", businessPurpose: "Computers",
    country: "CN", website: "lenovo.com", recurring: false,
  },

  // ── Real peers, added the same way ───────────────────────────────────────
  {
    name: "HP", keyword: "hp inc", category: "equipment", transactionType: "expense", confidence: "high",
    parentCompany: "HP Inc.", industry: "Computer Hardware", businessPurpose: "Computers & Printers",
    country: "US", website: "hp.com", recurring: false,
  },
  {
    name: "Samsung", keyword: "samsung electronics", category: "equipment", transactionType: "expense", confidence: "high",
    parentCompany: "Samsung Electronics Co., Ltd.", industry: "Consumer Electronics", businessPurpose: "Devices & Monitors",
    country: "KR", website: "samsung.com", recurring: false,
  },
  {
    name: "Logitech", keyword: "logitech", category: "equipment", transactionType: "expense", confidence: "high",
    parentCompany: "Logitech International S.A.", industry: "Computer Peripherals", businessPurpose: "Peripherals",
    country: "CH", website: "logitech.com", recurring: false,
  },
  {
    name: "Best Buy", keyword: "best buy co", category: "equipment", transactionType: "expense", confidence: "high",
    parentCompany: "Best Buy Co., Inc.", industry: "Electronics Retail", businessPurpose: "Technology Purchases",
    country: "US", website: "bestbuy.com", recurring: false,
  },
  {
    name: "Currys", keyword: "currys pc world", category: "equipment", transactionType: "expense", confidence: "high",
    parentCompany: "Currys plc", industry: "Electronics Retail", businessPurpose: "Technology Purchases",
    country: "GB", website: "currys.co.uk", recurring: false,
  },
  {
    name: "Darty", keyword: "darty electro", category: "retail", transactionType: "expense", confidence: "high",
    parentCompany: "Fnac Darty S.A.", industry: "Electronics Retail", businessPurpose: "Technology Purchases",
    country: "FR", website: "darty.com", recurring: false,
  },
  {
    name: "Wayfair", keyword: "wayfair inc", category: "retail", transactionType: "expense", confidence: "high",
    parentCompany: "Wayfair Inc.", industry: "Furniture", businessPurpose: "Office Furniture",
    country: "US", website: "wayfair.com", recurring: false,
  },

  // ── Genuinely new keywords (not previously in any pack) ─────────────────
  {
    name: "Canon", keyword: "canon inc", category: "equipment", transactionType: "expense", confidence: "high",
    parentCompany: "Canon Inc.", industry: "Imaging & Printers", businessPurpose: "Printers & Cameras",
    country: "JP", website: "canon.com", recurring: false,
  },
  {
    name: "Epson", keyword: "epson", category: "equipment", transactionType: "expense", confidence: "high",
    parentCompany: "Seiko Epson Corporation", industry: "Imaging & Printers", businessPurpose: "Printers",
    country: "JP", website: "epson.com", recurring: false,
  },
  {
    name: "Brother", keyword: "brother printer", category: "equipment", transactionType: "expense", confidence: "high",
    parentCompany: "Brother Industries, Ltd.", industry: "Imaging & Printers", businessPurpose: "Printers",
    country: "JP", website: "brother.com", recurring: false,
  },
  {
    name: "Asus", keyword: "asus", category: "equipment", transactionType: "expense", confidence: "high",
    parentCompany: "ASUSTeK Computer Inc.", industry: "Computer Hardware", businessPurpose: "Computers",
    country: "TW", website: "asus.com", recurring: false,
  },
  {
    name: "Acer", keyword: "acer inc", category: "equipment", transactionType: "expense", confidence: "high",
    parentCompany: "Acer Inc.", industry: "Computer Hardware", businessPurpose: "Computers",
    country: "TW", website: "acer.com", recurring: false,
  },
  {
    name: "MediaMarkt", keyword: "mediamarkt", category: "equipment", transactionType: "expense", confidence: "high",
    parentCompany: "MediaMarktSaturn Retail Group", industry: "Electronics Retail", businessPurpose: "Technology Purchases",
    country: "DE", website: "mediamarkt.com", recurring: false,
  },
  {
    name: "Microsoft Store", keyword: "microsoft store", category: "equipment", transactionType: "expense", confidence: "high",
    parentCompany: "Microsoft Corporation", industry: "Computer Hardware", businessPurpose: "Computers & Devices",
    country: "US", website: "microsoft.com", recurring: false,
  },
  {
    name: "Viking Direct", keyword: "viking direct", category: "office", transactionType: "expense", confidence: "high",
    parentCompany: "The ODP Corporation", industry: "Office Retail", businessPurpose: "Consumables",
    country: "GB", website: "viking-direct.co.uk", recurring: false,
  },
  {
    name: "WH Smith", keyword: "wh smith", category: "office", transactionType: "expense", confidence: "high",
    parentCompany: "WHSmith PLC", industry: "Office Retail", businessPurpose: "Stationery & Consumables",
    country: "GB", website: "whsmith.co.uk", recurring: false,
  },
  {
    name: "Bureau Vallée", keyword: "bureau vallee", category: "office", transactionType: "expense", confidence: "high",
    parentCompany: "Bureau Vallée", industry: "Office Retail", businessPurpose: "Consumables",
    country: "FR", website: "bureau-vallee.fr", recurring: false,
  },
  {
    name: "Herman Miller", keyword: "herman miller", category: "office", transactionType: "expense", confidence: "high",
    parentCompany: "MillerKnoll, Inc.", industry: "Furniture", businessPurpose: "Office Furniture",
    country: "US", website: "hermanmiller.com", recurring: false,
  },
  {
    name: "Steelcase", keyword: "steelcase", category: "office", transactionType: "expense", confidence: "high",
    parentCompany: "Steelcase Inc.", industry: "Furniture", businessPurpose: "Office Furniture",
    country: "US", website: "steelcase.com", recurring: false,
  },
];
