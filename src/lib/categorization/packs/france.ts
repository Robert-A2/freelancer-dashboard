import type { MerchantEntry, MerchantPack } from "../types";

const h = (keyword: string, category: string): MerchantEntry => ({ keyword, category, confidence: "high" });
const m = (keyword: string, category: string): MerchantEntry => ({ keyword, category, confidence: "medium" });

// ── France merchant pack ───────────────────────────────────────────────────────
// French-market brands and institutions a freelancer based in France will see
// on their bank statements. Bare common-word brand names ("orange", "free",
// "spa") are deliberately avoided in favor of qualified variants ("orange.fr",
// "free mobile") to prevent false-positive substring matches against unrelated
// English-language transaction descriptions.
const entries: MerchantEntry[] = [
  // ── Government & taxes ────────────────────────────────────────────────────
  h("urssaf", "taxes"), h("impots.gouv", "taxes"), h("impots gouv", "taxes"),
  h("dgfip", "taxes"), h("service-public.fr", "taxes"), h("service public fr", "taxes"),
  h("caf.fr", "taxes"), h("caisse d'allocations familiales", "taxes"), h("ameli.fr", "health"),
  h("cpam", "health"), h("pole emploi", "taxes"), h("france travail", "taxes"),
  h("mairie de paris", "taxes"), h("prefecture de police", "taxes"), h("carsat", "taxes"),
  h("urssaf autoentrepreneur", "taxes"), h("net-entreprises", "taxes"), h("net entreprises", "taxes"),
  h("douanes.gouv", "taxes"), h("tresor public", "taxes"), h("amende.gouv", "taxes"),
  h("antai amende", "taxes"), h("cci formation", "taxes"), h("urssaf cotisation", "taxes"),

  // ── Banking (FR) ──────────────────────────────────────────────────────────
  h("boursorama banque", "banking fees"), h("societe generale", "banking fees"),
  h("bnp paribas", "banking fees"), h("credit agricole", "banking fees"),
  h("lcl banque", "banking fees"), h("banque postale", "banking fees"),
  h("caisse d'epargne", "banking fees"), h("credit mutuel", "banking fees"),
  h("cic banque", "banking fees"), h("hello bank", "banking fees"), h("fortuneo", "banking fees"),
  h("monabanq", "banking fees"), h("qonto business", "banking fees"), h("shine banque", "banking fees"),
  h("blank banque", "banking fees"), h("revolut france", "banking fees"), h("anytime banque", "banking fees"),
  h("frais de tenue de compte", "banking fees"), h("frais bancaires", "banking fees"),
  h("cotisation carte bancaire", "banking fees"), h("commission intervention", "banking fees"),

  // ── Transport (FR) ────────────────────────────────────────────────────────
  h("sncf connect", "transport"), h("sncf voyageurs", "transport"), h("trainline.fr", "transport"),
  h("ouigo", "transport"), h("ratp paris", "transport"), h("transilien", "transport"),
  h("navigo pass", "transport"), h("velib metropole", "transport"), h("blablacar bus", "transport"),
  h("flixbus france", "transport"), h("autolib", "transport"), h("citymapper", "transport"),
  h("uber france", "transport"), h("bolt france", "transport"), h("free-floating", "transport"),
  h("autoroutes du sud", "transport"), h("vinci autoroutes", "transport"), h("aprr peage", "transport"),
  h("sanef peage", "transport"), h("total energies station", "transport"), h("esso station", "transport"),
  h("bp france station", "transport"), h("indigo parking", "transport"), h("effia parking", "transport"),

  // ── Telecom (FR) — qualified to avoid collisions with bare English words ──
  h("orange.fr", "utilities"), h("orange telecom", "utilities"), h("facture orange", "utilities"),
  h("orange sa", "utilities"),
  h("sosh mobile", "utilities"), h("sfr.fr", "utilities"), h("sfr telecom", "utilities"),
  h("free mobile", "utilities"), h("free.fr", "utilities"), h("freebox", "utilities"),
  h("bouygues telecom", "utilities"), h("b&you mobile", "utilities"), h("la poste mobile", "utilities"),
  h("edf energie", "utilities"), h("engie energie", "utilities"), h("totalenergies electricite", "utilities"),
  h("veolia eau", "utilities"), h("suez eau", "utilities"), h("eau de paris", "utilities"),

  // ── Retail & food (FR) ────────────────────────────────────────────────────
  h("carrefour market", "food"), h("carrefour city", "food"), h("e.leclerc", "food"),
  h("leclerc drive", "food"), h("intermarche express", "food"), h("intermarche super", "food"),
  h("intermarché", "food"), h("système u", "food"),
  h("monoprix store", "food"), h("monop'", "food"), h("casino supermarche", "food"),
  h("franprix", "food"), h("picard surgeles", "food"), h("auchan supermarche", "food"),
  h("systeme u", "food"), h("super u", "food"), h("hyper u", "food"),
  h("g20 superette", "food"), h("biocoop", "food"), h("naturalia bio", "food"),
  h("grand frais", "food"), h("lidl france", "food"), h("aldi france", "food"),
  h("fnac.com", "retail"), h("fnac darty", "retail"), h("decathlon france", "sports"),
  h("zara france", "retail"), h("h&m france", "retail"), h("uniqlo france", "retail"),
  h("vinted france", "retail"), h("sephora france", "personal spending"), h("nocibe parfumerie", "personal spending"),
  h("marionnaud parfumerie", "personal spending"), h("leroy merlin", "retail"), h("castorama", "retail"),
  h("but ameublement", "retail"), h("ikea france", "retail"), h("conforama", "retail"),
  h("cultura.com", "retail"), h("la redoute", "retail"), h("cdiscount", "retail"),
  h("showroomprive", "retail"), h("vente-privee", "retail"), h("veepee", "retail"),

  // ── Cafés, bakeries, restaurants (FR) ─────────────────────────────────────
  h("paul boulangerie", "food"), h("brioche doree", "food"), h("brioche dorée", "food"),
  h("la mie caline", "food"), h("l'entrecôte", "food"), h("blow club", "personal spending"),
  h("mcdonalds france", "food"), h("quick restaurant", "food"), h("big fernand", "food"),
  h("ladurée patisserie", "food"), h("angelina paris", "food"), h("columbus cafe", "food"),
  h("starbucks france", "food"), h("class'croute", "food"), h("exki restaurant", "food"),
  h("cojean restaurant", "food"), h("pomme de pain", "food"), h("relay cafe", "food"),
  h("flunch restaurant", "food"), h("hippopotamus restaurant", "food"), h("buffalo grill", "food"),
  h("courtepaille", "food"), h("del arte restaurant", "food"), h("five guys france", "food"),

  // ── Health & insurance (FR) ───────────────────────────────────────────────
  h("pharmacie de garde", "health"), h("doctolib", "health"), h("mutuelle harmonie", "health"),
  h("alan assurance sante", "health"), h("maaf assurances", "health"), h("macif assurance", "health"),
  h("matmut assurance", "health"), h("maif assurance", "health"), h("axa france", "health"),
  h("malakoff humanis", "health"), h("april assurance", "health"), h("mgen mutuelle", "health"),
  h("groupama assurance", "health"), h("allianz france", "health"), h("generali france", "health"),

  // ── Office & coworking (FR) ───────────────────────────────────────────────
  h("morning coworking", "office"), h("anticafe paris", "office"), h("kwerk coworking", "office"),
  h("wojo coworking", "office"), h("now coworking", "office"), h("startway coworking", "office"),
  h("nextdoor coworking", "office"), h("chronopost", "office"), h("colissimo", "office"),
  h("mondial relay", "office"), h("la poste timbre", "office"), h("relais colis", "office"),
  h("anticafé", "office"),

  // ── Entertainment & subscriptions (FR) ────────────────────────────────────
  h("fnac spectacles", "entertainment"), h("billetweb", "entertainment"), h("francaise des jeux", "entertainment"),
  h("fdj.fr", "entertainment"), h("ugc cine cite", "entertainment"), h("pathe cinemas", "entertainment"),
  h("gaumont cinema", "entertainment"), h("cgr cinemas", "entertainment"), h("canal+", "entertainment"),
  h("canalplus", "entertainment"), h("molotov tv", "entertainment"), h("salto streaming", "entertainment"),
  h("deezer france", "subscriptions"), h("allocine", "entertainment"),

  // ── Business & professional services (FR) ─────────────────────────────────
  h("expert-comptable", "business services"), h("cabinet comptable", "business services"),
  h("ordre des avocats", "business services"), h("notaire office", "business services"),
  h("legalstart", "business services"), h("captain contrat", "business services"),
  h("indy comptabilite", "business services"), h("dougs comptabilite", "business services"),
  h("shine compta", "business services"), h("agence pole emploi", "business services"),

  // ── Generic France-specific keywords (Layer 3) ────────────────────────────
  m("autoentrepreneur", "taxes"), m("micro-entreprise", "taxes"), m("cotisation sociale", "taxes"),
  m("loyer appartement", "housing"), m("charges copropriete", "housing"), m("assurance habitation", "housing"),
  m("expert comptable", "business services"), m("huissier", "business services"),
  // Bare-brand aliases — bank statements often show just the brand name
  m("café", "food"),
  h("carrefour", "food"), h("monoprix", "food"), h("leclerc", "food"), h("intermarche", "food"),
  h("fdj", "entertainment"), h("fnac", "retail"), h("darty", "retail"), h("decathlon", "sports"),
  h("sncf", "transport"), h("keolis", "transport"), h("ratp", "transport"), h("semitan", "transport"),
  h("celio", "retail"), h("galeries lafayette", "retail"), h("naturalia", "food"), h("vival", "food"),
  h("ali baba", "food"), h("ali babà", "food"), h("on air fitness", "sports"),
  // French banking-fee phrasing (parity with prior flat keyword lists)
  m("commission d'intervention", "banking fees"), m("frais d'intervention", "banking fees"),
  m("frais de change", "banking fees"), m("frais de conversion", "banking fees"),
  m("commission de change", "banking fees"), m("agios", "banking fees"),
  m("cash withdrawal", "banking fees"), m("retrait especes", "banking fees"),
  m("retrait dab", "banking fees"), m("distributeur", "banking fees"),
  // French bakery/butcher/restaurant generic terms
  m("boucherie", "food"), m("boucher", "food"), m("fournil", "food"),
  m("rotisserie", "food"), m("rôtisserie", "food"), m("poulet", "food"),
  m("pâtisserie", "food"), m("douceurs", "food"), m("coffee shop", "food"),
  m("teleconsultation", "health"), m("télé-consultation", "health"),
  m("facture electricite", "utilities"), m("facture eau", "utilities"),
  m("abonnement internet", "utilities"), m("abonnement mobile", "utilities"),
  m("concert", "entertainment"), m("cinema ticket", "entertainment"), m("cinéma", "entertainment"),
  m("theatre", "entertainment"), m("cabaret", "entertainment"),
];

export const FRANCE_PACK: MerchantPack = {
  id: "france",
  label: "France",
  entries,
};
