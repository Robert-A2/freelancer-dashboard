import type { MerchantEntry } from "./types";

const m = (keyword: string, category: string): MerchantEntry => ({ keyword, category, confidence: "medium" });

/**
 * Layer 3 — generic descriptive keywords that strongly imply a category without
 * naming a specific merchant (e.g. "BOULANGERIE PAUL DURAND" → food & dining
 * even though "Paul Durand" the bakery isn't in any merchant pack). All entries
 * are "medium" confidence: the word is suggestive but not a brand guarantee.
 *
 * Note: bare "spa" is intentionally omitted — too short and collision-prone
 * (matches "espace", "spasme", etc.); "institut de beauté"/"sauna"/"hammam"
 * cover the personal-care case more safely.
 */
export const KEYWORD_PATTERNS: MerchantEntry[] = [
  // Food & dining
  m("boulangerie", "food"), m("patisserie", "food"), m("superette", "food"),
  m("epicerie", "food"), m("brasserie", "food"), m("bistrot", "food"),
  m("kebab", "food"), m("traiteur", "food"), m("fromagerie", "food"),
  m("poissonnerie", "food"), m("primeur", "food"), m("caviste", "food"),
  m("restaurant", "food"), m("pizzeria", "food"), m("creperie", "food"),
  m("cafeteria", "food"), m("snack bar", "food"),

  // Health
  m("pharmacie", "health"), m("opticien", "health"), m("dentiste", "health"),
  m("cabinet medical", "health"), m("kinesitherapeute", "health"), m("osteopathe", "health"),
  m("laboratoire analyses", "health"), m("clinique medicale", "health"),

  // Personal spending
  m("tabac", "personal spending"), m("pressing", "personal spending"),
  m("salon de coiffure", "personal spending"), m("coiffeur", "personal spending"),
  m("institut de beaute", "personal spending"), m("sauna", "personal spending"),
  m("hammam", "personal spending"), m("veterinaire", "personal spending"),
  m("laverie", "personal spending"), m("manucure", "personal spending"),
  m("barbier", "personal spending"), m("esthetique", "personal spending"),

  // Retail
  m("droguerie", "retail"), m("quincaillerie", "retail"), m("fleuriste", "retail"),
  m("papeterie", "retail"), m("librairie", "retail"), m("animalerie", "retail"),
  m("jardinerie", "retail"), m("brocante", "retail"), m("friperie", "retail"),
  m("bijouterie", "retail"), m("cordonnerie", "retail"),

  // Transport
  m("garage automobile", "transport"), m("station essence", "transport"),
  m("station-service", "transport"), m("station service", "transport"),
  m("peage autoroute", "transport"), m("parking souterrain", "transport"),
  m("auto-ecole", "transport"), m("location de voiture", "transport"),
  m("bus ticket", "transport"), m("train ticket", "transport"),

  // ── International generic keywords (parity with prior flat keyword lists) ──
  // Software & SaaS
  m("saas subscription", "software"), m("cloud hosting", "software"), m("web hosting", "software"),
  m("domain renewal", "software"), m("domain registration", "software"), m("google", "software"),
  // Marketing & advertising
  m("ppc campaign", "marketing"), m("social media ads", "marketing"),
  m("influencer payment", "marketing"), m("sponsorship", "marketing"),
  m("paid promotion", "advertising"), m("sponsored post", "advertising"), m("boosted post", "advertising"),
  // Education
  m("bootcamp", "education"), m("online course", "education"), m("workshop fee", "education"),
  m("conference ticket", "education"), m("summit ticket", "education"), m("book purchase", "education"),
  m("textbook", "education"), m("formation professionnelle", "education"),
  // Equipment & electronics
  m("laptop", "equipment"), m("keyboard", "equipment"), m("mouse ", "equipment"),
  m("headphones", "equipment"), m("webcam", "equipment"), m("microphone", "equipment"),
  m("camera lens", "equipment"), m("tripod", "equipment"), m("hard drive", "equipment"),
  m("ssd ", "equipment"), m("usb hub", "equipment"), m("ring light", "equipment"),
  m("standing desk", "equipment"), m("ergonomic chair", "equipment"),
  // Office
  m("hot desk", "office"), m("office space", "office"), m("office supply", "office"),
  m("stationery", "office"), m("printer ink", "office"), m("paper ream", "office"),
  m("postage", "office"), m("courier fee", "office"), m("po box", "office"),
  // Banking fees
  m("bank fee", "banking fees"), m("account fee", "banking fees"), m("maintenance fee", "banking fees"),
  m("service charge", "banking fees"), m("monthly charge", "banking fees"), m("wire fee", "banking fees"),
  m("transfer fee", "banking fees"), m("atm fee", "banking fees"), m("atm withdrawal fee", "banking fees"),
  m("foreign transaction fee", "banking fees"), m("currency conversion fee", "banking fees"),
  m("fx fee", "banking fees"), m("overdraft fee", "banking fees"), m("late payment fee", "banking fees"),
  m("card fee", "banking fees"), m("annual card fee", "banking fees"),
  // Travel & transport
  m("hotel booking", "travel"), m("flight booking", "travel"), m("airport", "travel"),
  // Food & dining
  m("coffee shop", "food"), m("takeaway", "food"), m("noodle", "food"),
  m("supermarket", "food"), m("grocery", "food"),
  // Health
  m("gp visit", "health"), m("hospital", "health"), m("dental", "health"), m("orthodontist", "health"),
  m("clinic", "health"), m("crossfit", "health"), m("yoga class", "health"), m("pilates", "health"),
  m("physio", "health"), m("chemist", "health"), m("doctor", "health"),
  m("teleconsultation", "health"), m("télé-consultation", "health"),
  // Housing
  m("rent payment", "housing"), m("monthly rent", "housing"), m("mortgage ", "housing"),
  m("landlord", "housing"), m("property management", "housing"), m("letting agent", "housing"),
  m("estate agent", "housing"), m("syndic", "housing"), m("charges de copropriete", "housing"),
  // Utilities
  m("electricity", "utilities"), m("electric bill", "utilities"), m("gas bill", "utilities"),
  m("water bill", "utilities"), m("internet bill", "utilities"), m("broadband", "utilities"),
  m("phone bill", "utilities"), m("mobile plan", "utilities"),
  // Subscriptions
  m("monthly plan", "subscriptions"), m("annual plan", "subscriptions"), m("membership fee", "subscriptions"),
  // Business services
  m("accounting fee", "business services"), m("legal fee", "business services"),
  m("consulting service", "business services"), m("notary fee", "business services"),
  m("legal services", "business services"),
  // Entertainment
  m("concert", "entertainment"), m("cinema ticket", "entertainment"), m("cinéma", "entertainment"),
  m("theatre", "entertainment"), m("cabaret", "entertainment"),
];
