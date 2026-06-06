// ── Savings-specific transfer phrases ──────────────────────────────────────────
// Checked BEFORE general transfer detection so that "transfer to savings" is
// correctly classified as savings, not a neutral internal transfer.
const SAVINGS_TRANSFER_OVERRIDES = [
  "transfer to savings",
  "to savings account",
  "savings account transfer",
  "to my isa",
  "transfer to isa",
  "to isa account",
  "to pension",
  "transfer to pension",
  "pension transfer",
  "transfer to sipp",
  "to sipp account",
  "savings pot transfer",
  "to savings pot",
  "into savings",
  "to investment account",
  "transfer to investment",
  "to emergency fund",
];

// ── General transfer detection ─────────────────────────────────────────────────
// Internal account movements — excluded from income AND expenses so they never
// inflate cashflow figures.
const TRANSFER_KEYWORDS = [
  "transfer to", "transfer from", "internal transfer", "own transfer",
  "between accounts", "my account", "to my account", "from my account",
  "pocket transfer", "monzo pot", "revolut vault", "revolut savings",
  "bunq pocket", "bunq savings", "starling space", "round up",
  "spare change", "auto-save", "autosave",
  "virement interne", "virement propre",     // French
  "eigene überweisung", "umbuchung",          // German
  "traspaso propio", "transferencia propia",  // Spanish
];

// ── Savings detection ──────────────────────────────────────────────────────────
// Money being intentionally set aside. Treated separately from expenses so the
// freelancer's savings rate is calculated accurately.
const SAVINGS_KEYWORDS = [
  "savings transfer", "savings account", "to savings",
  "investment transfer", "emergency fund",
  " isa", "isa ", "sipp ", " sipp",
  "pension fund", "pension contribution", "pension payment",
  "vanguard", "fidelity investments", "fidelity fund",
  "trading 212", "wealthsimple", "degiro", "etoro ",
  "coinbase savings", "stock purchase", "etf purchase", "index fund",
  "schwab", "robinhood transfer", "betterment", "acorns",
];

// ── Tax payments ───────────────────────────────────────────────────────────────
const TAX_KEYWORDS = [
  "hmrc", "irs ", " irs", "revenue commissioners", "impôts", "impots.gouv",
  "vat payment", "income tax", "tax payment", "corporation tax",
  "social security", "prsi ", " prsi", "national insurance",
  "usc payment", "estimated tax", "preliminary tax", "tax return",
  "agenzia delle entrate",  // Italian
  "hacienda",               // Spanish
  "finanzamt",              // German
];

// ── Income patterns (ordered by specificity) ───────────────────────────────────
// Any positive amount that doesn't match savings/transfer keywords is treated as
// income, so client payments with generic descriptions are always captured.
const INCOME_PATTERNS: Array<{ keywords: string[]; subcategory: string }> = [
  { keywords: ["stripe"], subcategory: "stripe" },
  { keywords: ["paypal"], subcategory: "paypal" },
  {
    keywords: [
      "upwork", "freelancer.com", "fiverr", "toptal", "99designs",
      "guru.com", "peopleperhour", "malt ", "codementor", "contra.com",
    ],
    subcategory: "freelance platform",
  },
  {
    keywords: ["invoice payment", "inv-", " inv ", "#inv", "invoice #", "invoice ref", "invoice no"],
    subcategory: "invoice payment",
  },
  {
    keywords: [
      "client payment", "project payment", "consulting fee",
      "consulting payment", "retainer", "freelance payment",
      "contractor payment", "service payment",
    ],
    subcategory: "client payment",
  },
  { keywords: ["salary", "payroll", "wages ", " wage "], subcategory: "salary" },
  {
    keywords: [
      "wire transfer", "bank transfer", "sepa credit", "bacs credit",
      "ach deposit", "direct deposit", "faster payment", "chaps credit",
      "fps credit", "tfs credit",
    ],
    subcategory: "bank transfer",
  },
  { keywords: ["refund", "reimbursement", "cashback", "rebate"], subcategory: "refund" },
];

// ── Expense categories ─────────────────────────────────────────────────────────
const EXPENSE_CATEGORIES: Array<{ name: string; keywords: string[] }> = [
  {
    name: "ai tools",
    keywords: [
      "openai", "chatgpt", "claude.ai", "anthropic", "midjourney", "stability ai",
      "replicate", "cursor ", "github copilot", "copilot sub", "jasper.ai",
      "copy.ai", "writesonic", "perplexity", "elevenlabs", "runway ml",
      "leonardo.ai", "pika labs", "heygen", "otter.ai", "descript",
    ],
  },
  {
    name: "software",
    keywords: [
      "adobe", "figma", "notion ", "slack ", "github", "aws ", "amazon web services",
      "google cloud", "gcp ", "digitalocean", "netlify", "vercel", "heroku ",
      "zoom ", "dropbox", "microsoft 365", "microsoft sub", "1password",
      "lastpass", "bitwarden", "loom ", "linear app", "jira ", "confluence ",
      "basecamp", "asana ", "trello ", "hubspot", "xero ", "quickbooks", "freshbooks",
      "clickup", "monday.com", "airtable", "zapier", "make.com", "n8n",
      "cloudflare", "sentry ", "datadog", "mixpanel", "segment ", "intercom",
      "webflow", "framer", "bubble.io",
    ],
  },
  {
    name: "marketing",
    keywords: [
      "facebook ads", "google ads", "meta ads", "instagram ads", "linkedin ads",
      "twitter ads", "x ads", "tiktok ads", "pinterest ads", "snapchat ads",
      "mailchimp", "convertkit", "activecampaign", "klaviyo", "sendgrid",
      "postmark", "campaign monitor", "brevo", "beehiiv", "substack",
    ],
  },
  {
    name: "advertising",
    keywords: ["adwords", "adsense", "paid promotion", "sponsored post", "boosted post"],
  },
  {
    name: "education",
    keywords: [
      "udemy", "coursera", "pluralsight", "skillshare", "linkedin learning",
      "domestika", "masterclass", "codecademy", "bootcamp", "online course",
      "workshop fee", "conference ticket", "summit ticket",
      "kindle purchase", "audible", "book purchase", "textbook",
    ],
  },
  {
    name: "equipment",
    keywords: [
      "apple store", "apple.com", "macbook", "imac ", "iphone", "ipad ", "airpods",
      "amazon.co.uk", "amazon.com", "amazon.de", "amazon.fr", "amazon.ie",
      "laptop", "monitor ", "keyboard", "mouse ", "headphones", "webcam",
      "microphone", "camera lens", "tripod", "hard drive", "ssd ", "usb hub",
      "ring light", "standing desk", "ergonomic chair",
    ],
  },
  {
    name: "office",
    keywords: [
      "coworking", "wework", "regus ", "spaces cowork", "hot desk", "office space",
      "office supply", "stationery", "printer ink", "paper ream", "postage",
      "courier fee", "po box",
    ],
  },
  {
    name: "banking fees",
    keywords: [
      "bank fee", "account fee", "maintenance fee", "service charge", "monthly charge",
      "wire fee", "transfer fee", "atm fee", "atm withdrawal fee",
      "foreign transaction fee", "currency conversion fee", "fx fee",
      "overdraft fee", "late payment fee", "card fee", "annual card fee",
    ],
  },
  {
    name: "transport",
    keywords: [
      "uber ", "bolt ride", "lyft ", "taxi ", "cab ride", "sncf", "ratp",
      "tfl ", "oyster card", "citymapper", "lime bike", "citi bike",
      "cycle hire", "bus ticket", "train ticket",
    ],
  },
  {
    name: "travel",
    keywords: [
      "ryanair", "easyjet", "ba.com", "british airways", "klm ", "lufthansa",
      "airfrance", "delta air", "united airlines", "aer lingus",
      "flight booking", "hotel booking", "hostel", "airbnb", "booking.com",
      "expedia", "hotels.com", "car rental", "hertz ", "enterprise rent",
    ],
  },
  {
    name: "food",
    keywords: [
      "restaurant", "café", "cafe ", "coffee shop", "starbucks", "costa coffee",
      "mcdonalds", "mcdonald's", "burger king", "subway ", "kfc ", "pizza",
      "deliveroo", "just eat", "uber eats", "grubhub", "doordash", "takeaway",
      "grocery", "supermarket", "lidl", "aldi ", "tesco", "sainsbury",
      "waitrose", "whole foods", "carrefour", "rewe ", "edeka",
    ],
  },
  {
    name: "health",
    keywords: [
      "pharmacy", "pharmacie", "chemist", "doctor", "gp visit",
      "hospital", "dental", "dentist", "orthodontist", "clinic", "health insurance",
      "gym ", "fitness", "crossfit", "yoga class", "pilates", "physio",
    ],
  },
  {
    name: "housing",
    keywords: [
      "rent payment", "monthly rent", "mortgage ", "landlord", "property management",
      "letting agent", "estate agent",
    ],
  },
  {
    name: "utilities",
    keywords: [
      "electricity", "electric bill", "gas bill", "water bill",
      "internet bill", "broadband", "phone bill", "mobile plan",
      "edf energy", "british gas", "scottish power", "bt internet",
      "virgin media", "sky broadband", "vodafone bill", "o2 bill",
    ],
  },
  {
    name: "subscriptions",
    keywords: [
      "subscription", "monthly plan", "annual plan", "membership fee",
      "netflix", "spotify", "apple music", "youtube premium",
      "amazon prime", "hbo max", "disney+", "hulu ", "apple tv",
    ],
  },
];

// ── Public API ─────────────────────────────────────────────────────────────────

export function categorizeTransaction(
  description: string,
  amount: number
): {
  transactionType: "income" | "expense" | "savings" | "transfer";
  category: string;
} {
  const lower = description.toLowerCase();

  // PRIORITY 1 — Savings-specific transfers
  // These phrases contain "transfer" but describe money going to savings/investments.
  // Must be checked BEFORE the general transfer detection.
  if (SAVINGS_TRANSFER_OVERRIDES.some((kw) => lower.includes(kw))) {
    return { transactionType: "savings", category: "savings" };
  }

  // PRIORITY 2 — General internal transfers (neutral, excluded from cashflow)
  if (TRANSFER_KEYWORDS.some((kw) => lower.includes(kw))) {
    return { transactionType: "transfer", category: "transfer" };
  }

  // PRIORITY 3 — Savings (investment platforms, ISA, pension, etc.)
  if (SAVINGS_KEYWORDS.some((kw) => lower.includes(kw))) {
    return { transactionType: "savings", category: "savings" };
  }

  // PRIORITY 4 — Tax payments (categorised as expense/taxes)
  if (amount < 0 && TAX_KEYWORDS.some((kw) => lower.includes(kw))) {
    return { transactionType: "expense", category: "taxes" };
  }

  // PRIORITY 5 — Income
  // ANY positive amount is income. We try to sub-categorise it first, but the
  // fallback ensures no client payment is ever lost.
  if (amount > 0) {
    for (const pattern of INCOME_PATTERNS) {
      if (pattern.keywords.some((kw) => lower.includes(kw))) {
        return { transactionType: "income", category: pattern.subcategory };
      }
    }
    return { transactionType: "income", category: "income" };
  }

  // PRIORITY 6 — Expense (negative amounts)
  for (const cat of EXPENSE_CATEGORIES) {
    if (cat.keywords.some((kw) => lower.includes(kw))) {
      return { transactionType: "expense", category: cat.name };
    }
  }

  return { transactionType: "expense", category: "uncategorized" };
}
