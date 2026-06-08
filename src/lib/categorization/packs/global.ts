import type { MerchantEntry, MerchantPack } from "../types";

// "high" = unambiguous brand/company name, "medium" = generic descriptive term.
const h = (keyword: string, category: string): MerchantEntry => ({ keyword, category, confidence: "high" });
const m = (keyword: string, category: string): MerchantEntry => ({ keyword, category, confidence: "medium" });

// ── Global merchant database ───────────────────────────────────────────────────
// Worldwide brands a freelancer is likely to see on a bank or card statement,
// independent of which country they operate from. Country packs (see `packs/`)
// layer market-specific merchants — e.g. French banks, supermarkets, government
// bodies — on top of this base list.
const entries: MerchantEntry[] = [
  // ── AI tools ──────────────────────────────────────────────────────────────
  h("openai", "ai tools"), h("chatgpt", "ai tools"), h("anthropic", "ai tools"),
  h("claude.ai", "ai tools"), h("claude pro", "ai tools"), h("midjourney", "ai tools"),
  h("stability ai", "ai tools"), h("stable diffusion", "ai tools"), h("runwayml", "ai tools"),
  h("runway ml", "ai tools"), h("elevenlabs", "ai tools"), h("eleven labs", "ai tools"),
  h("perplexity", "ai tools"), h("character.ai", "ai tools"), h("replit", "ai tools"),
  h("hugging face", "ai tools"), h("huggingface", "ai tools"), h("cohere", "ai tools"),
  h("mistral ai", "ai tools"), h("groq", "ai tools"), h("deepseek", "ai tools"),
  h("leonardo.ai", "ai tools"), h("ideogram", "ai tools"), h("suno ai", "ai tools"),
  h("udio", "ai tools"), h("synthesia", "ai tools"), h("descript", "ai tools"),
  h("otter.ai", "ai tools"), h("jasper.ai", "ai tools"), h("copy.ai", "ai tools"),
  h("writesonic", "ai tools"), h("grammarly", "ai tools"), h("notion ai", "ai tools"),
  h("github copilot", "ai tools"), h("copilot subscription", "ai tools"), h("cursor.sh", "ai tools"),
  h("codeium", "ai tools"), h("tabnine", "ai tools"), h("you.com", "ai tools"),
  h("poe.com", "ai tools"), h("gamma.app", "ai tools"), h("krea.ai", "ai tools"),
  h("luma labs", "ai tools"), h("pika labs", "ai tools"), h("heygen", "ai tools"),
  h("murf.ai", "ai tools"), h("play.ht", "ai tools"), h("google gemini", "ai tools"),
  h("gemini advanced", "ai tools"),

  // ── Software & SaaS ───────────────────────────────────────────────────────
  h("adobe", "software"), h("adobe creative cloud", "software"), h("figma", "software"),
  h("notion.so", "software"), h("slack", "software"), h("zoom.us", "software"),
  h("microsoft 365", "software"), h("microsoft office", "software"), h("google workspace", "software"),
  h("dropbox", "software"), h("box.com", "software"), h("asana.com", "software"),
  h("trello.com", "software"), h("monday.com", "software"), h("clickup", "software"),
  h("airtable", "software"), h("basecamp", "software"), h("atlassian", "software"),
  h("jira software", "software"), h("confluence", "software"), h("linear.app", "software"),
  h("miro.com", "software"), h("canva", "software"), h("webflow", "software"),
  h("framer.com", "software"), h("wordpress.com", "software"), h("squarespace", "software"),
  h("wix.com", "software"), h("shopify", "software"), h("hubspot", "software"),
  h("salesforce", "software"), h("zendesk", "software"), h("intercom.com", "software"),
  h("freshdesk", "software"), h("mailchimp", "software"), h("sendgrid", "software"),
  h("twilio", "software"), h("zapier", "software"), h("make.com", "software"),
  h("n8n.io", "software"), h("ifttt", "software"), h("1password", "software"),
  h("lastpass", "software"), h("bitwarden", "software"), h("dashlane", "software"),
  h("evernote", "software"), h("todoist", "software"), h("superhuman", "software"),
  h("calendly", "software"), h("loom.com", "software"), h("typeform", "software"),
  h("surveymonkey", "software"), h("docusign", "software"), h("hellosign", "software"),
  h("pandadoc", "software"), h("quickbooks", "software"), h("xero.com", "software"),
  h("freshbooks", "software"), h("wave apps", "software"), h("gusto.com", "software"),
  h("deel.com", "software"), h("remote.com", "software"), h("coda.io", "software"),
  h("height.app", "software"), h("productboard", "software"), h("amplitude.com", "software"),
  h("mixpanel", "software"), h("segment.io", "software"), h("posthog", "software"),
  h("hotjar", "software"), h("fullstory", "software"), h("github.com", "software"),
  h("gitlab.com", "software"), h("bitbucket", "software"), h("jetbrains", "software"),
  h("sketch.com", "software"), h("invision app", "software"), h("zeplin.io", "software"),
  h("balsamiq", "software"), h("airbrake", "software"), h("sentry.io", "software"),
  h("datadog", "software"), h("new relic", "software"), h("pagerduty", "software"),
  h("statuspage", "software"), h("cloudinary", "software"), h("algolia", "software"),
  h("contentful", "software"), h("sanity.io", "software"), h("strapi.io", "software"),
  h("supabase", "software"), h("firebase", "software"), h("planetscale", "software"),
  h("mongodb atlas", "software"), h("redis labs", "software"), h("elastic.co", "software"),

  // ── Hosting & infrastructure ──────────────────────────────────────────────
  h("amazon web services", "software"), h("aws billing", "software"),
  h("google cloud platform", "software"), h("microsoft azure", "software"),
  h("digitalocean", "software"), h("linode", "software"), h("vultr.com", "software"),
  h("heroku", "software"), h("netlify", "software"), h("vercel", "software"),
  h("cloudflare", "software"), h("fastly", "software"), h("render.com", "software"),
  h("railway.app", "software"), h("fly.io", "software"), h("ovhcloud", "software"),
  h("ovh.com", "software"), h("hetzner", "software"), h("contabo", "software"),
  h("godaddy", "software"), h("namecheap", "software"), h("gandi.net", "software"),
  h("hover.com", "software"), h("porkbun", "software"), h("bluehost", "software"),
  h("hostgator", "software"), h("dreamhost", "software"), h("siteground", "software"),
  h("kinsta", "software"), h("wpengine", "software"), h("pantheon.io", "software"),

  // ── Banking, finance & payment processors ─────────────────────────────────
  // Income-side (positive amounts) is handled by the income-pattern layer;
  // these entries cover the expense side — processing fees, subscriptions, FX.
  m("stripe fee", "banking fees"), m("stripe payout fee", "banking fees"),
  m("paypal fee", "banking fees"), m("paypal subscription", "banking fees"),
  h("wise.com", "banking fees"), h("transferwise", "banking fees"), h("revolut", "banking fees"),
  h("n26 bank", "banking fees"), h("monzo bank", "banking fees"), h("starling bank", "banking fees"),
  h("chase bank", "banking fees"), h("wells fargo", "banking fees"), h("bank of america", "banking fees"),
  h("citibank", "banking fees"), h("hsbc bank", "banking fees"), h("barclays bank", "banking fees"),
  h("lloyds bank", "banking fees"), h("natwest bank", "banking fees"), h("santander bank", "banking fees"),
  h("bbva bank", "banking fees"), h("deutsche bank", "banking fees"), h("ing bank", "banking fees"),
  h("sumup", "banking fees"), h("square inc", "banking fees"), h("zettle", "banking fees"),
  h("izettle", "banking fees"), h("klarna", "banking fees"), h("afterpay", "banking fees"),
  h("affirm.com", "banking fees"), h("venmo", "banking fees"), h("cash app", "banking fees"),
  h("zelle pay", "banking fees"), h("plaid inc", "software"), h("mercury.com", "banking fees"),
  h("brex.com", "banking fees"), h("ramp.com", "banking fees"), h("payoneer", "banking fees"),
  h("adyen", "banking fees"), h("checkout.com", "banking fees"), h("gocardless", "banking fees"),
  h("mollie.com", "banking fees"), h("currencyfair", "banking fees"), h("ofx.com", "banking fees"),
  h("wirex", "banking fees"), h("coinbase", "banking fees"), h("binance", "banking fees"),
  h("kraken.com", "banking fees"), h("crypto.com", "banking fees"), h("bunq bank", "banking fees"),

  // ── Travel ────────────────────────────────────────────────────────────────
  h("airbnb", "travel"), h("booking.com", "travel"), h("expedia", "travel"),
  h("hotels.com", "travel"), h("tripadvisor", "travel"), h("kayak.com", "travel"),
  h("skyscanner", "travel"), h("trivago", "travel"), h("agoda.com", "travel"),
  h("vrbo.com", "travel"), h("hostelworld", "travel"), h("ryanair", "travel"),
  h("easyjet", "travel"), h("lufthansa", "travel"), h("air france", "travel"),
  h("klm royal dutch", "travel"), h("british airways", "travel"), h("delta air lines", "travel"),
  h("united airlines", "travel"), h("american airlines", "travel"), h("emirates airline", "travel"),
  h("qatar airways", "travel"), h("turkish airlines", "travel"), h("wizz air", "travel"),
  h("vueling", "travel"), h("transavia", "travel"), h("eurostar", "travel"),
  h("flixbus", "travel"), h("blablacar", "transport"), h("uber trip", "transport"),
  h("uber technologies", "transport"), h("lyft inc", "transport"), h("bolt eu", "transport"),
  h("grab transport", "transport"), h("didi chuxing", "transport"), h("hertz rent", "travel"),
  h("avis budget", "travel"), h("europcar", "travel"), h("sixt rent", "travel"),
  h("enterprise rent-a-car", "travel"), h("national car rental", "travel"),

  // ── Food & dining ─────────────────────────────────────────────────────────
  h("mcdonalds", "food"), h("mcdonald's", "food"), h("burger king", "food"),
  h("kfc ", "food"), h("subway restaurants", "food"), h("starbucks", "food"),
  h("costa coffee", "food"), h("pret a manger", "food"), h("dominos pizza", "food"),
  h("pizza hut", "food"), h("papa johns", "food"), h("deliveroo", "food"),
  h("uber eats", "food"), h("just eat", "food"), h("doordash", "food"),
  h("grubhub", "food"), h("wolt app", "food"), h("glovo app", "food"),
  h("chipotle", "food"), h("five guys", "food"), h("nandos", "food"),
  h("wagamama", "food"), h("taco bell", "food"), h("dunkin donuts", "food"),
  h("tim hortons", "food"), h("greggs", "food"), h("leon restaurants", "food"),
  h("itsu ", "food"), h("wasabi sushi", "food"), h("chick-fil-a", "food"),
  h("in-n-out", "food"), h("panera bread", "food"), h("olive garden", "food"),
  h("applebees", "food"), h("ihop ", "food"), h("denny's", "food"),
  h("cracker barrel", "food"), h("whole foods market", "food"), h("trader joes", "food"),
  h("kroger", "food"), h("safeway", "food"), h("publix", "food"),
  h("walmart grocery", "food"), h("tesco", "food"), h("sainsburys", "food"),
  h("asda stores", "food"), h("morrisons", "food"), h("waitrose", "food"),
  h("marks and spencer food", "food"), h("aldi ", "food"), h("lidl ", "food"),
  h("rewe ", "food"), h("edeka ", "food"), h("spar supermarket", "food"),

  // ── Telecommunications ────────────────────────────────────────────────────
  h("vodafone", "utilities"), h("o2 mobile", "utilities"), h("ee limited", "utilities"),
  h("three mobile", "utilities"), h("virgin media", "utilities"), h("sky uk", "utilities"),
  h("bt group", "utilities"), h("talktalk", "utilities"), h("t-mobile us", "utilities"),
  h("verizon wireless", "utilities"), h("at&t mobility", "utilities"), h("sprint corp", "utilities"),
  h("comcast xfinity", "utilities"), h("spectrum internet", "utilities"), h("telefonica", "utilities"),
  h("deutsche telekom", "utilities"), h("vivo telecom", "utilities"), h("claro brasil", "utilities"),
  h("telcel mexico", "utilities"), h("rogers communications", "utilities"), h("bell canada", "utilities"),
  h("telus mobility", "utilities"), h("optus", "utilities"), h("telstra", "utilities"),

  // ── Office & coworking ────────────────────────────────────────────────────
  h("wework inc", "office"), h("regus office", "office"), h("spaces coworking", "office"),
  h("industrious office", "office"), h("knotel", "office"), h("impact hub", "office"),
  h("second home", "office"), h("huckletree", "office"), h("mindspace office", "office"),
  h("novel coworking", "office"), h("staples inc", "office"), h("office depot", "office"),
  h("officeworks", "office"), h("the office group", "office"), h("convene meetings", "office"),
  h("breather space", "office"), h("croissant app", "office"), h("deskpass", "office"),

  // ── Government & taxes ────────────────────────────────────────────────────
  h("irs payment", "taxes"), h("internal revenue service", "taxes"), h("hmrc payment", "taxes"),
  h("revenue commissioners", "taxes"), h("australian taxation office", "taxes"),
  h("canada revenue agency", "taxes"), h("inland revenue dept", "taxes"),
  h("finanzamt zahlung", "taxes"), h("agenzia delle entrate", "taxes"),
  h("agencia tributaria", "taxes"), h("hacienda publica", "taxes"), h("belastingdienst", "taxes"),
  h("skatteverket", "taxes"), h("sars efiling", "taxes"), h("social security admin", "taxes"),
  h("centrelink payment", "taxes"), h("department of treasury", "taxes"),

  // ── Retail ────────────────────────────────────────────────────────────────
  h("amazon marketplace", "retail"), h("ebay inc", "retail"), h("etsy.com", "retail"),
  h("walmart inc", "retail"), h("target corp", "retail"), h("costco wholesale", "retail"),
  h("ikea group", "retail"), h("zara fashion", "retail"), h("h&m group", "retail"),
  h("uniqlo store", "retail"), h("gap inc", "retail"), h("nike store", "retail"),
  h("adidas shop", "retail"), h("asos.com", "retail"), h("next retail", "retail"),
  h("primark stores", "retail"), h("mango fashion", "retail"), h("decathlon sport", "retail"),
  h("fnac retail", "retail"), h("darty electro", "retail"), h("boulanger store", "retail"),
  h("apple store", "equipment"), h("apple.com/store", "equipment"), h("best buy co", "equipment"),
  h("currys pc world", "equipment"), h("john lewis", "retail"), h("argos retail", "retail"),
  h("wayfair inc", "retail"), h("wickes diy", "retail"), h("b&q store", "retail"),
  h("homebase ltd", "retail"), h("lowes home", "retail"), h("home depot", "retail"),
  h("sephora beauty", "personal spending"), h("boots pharmacy", "health"),
  h("superdrug store", "personal spending"), h("ulta beauty", "personal spending"),
  h("michael kors", "retail"), h("zalando se", "retail"), h("depop app", "retail"),
  h("vinted marketplace", "retail"), h("shein fashion", "retail"), h("temu shopping", "retail"),
  h("aliexpress", "retail"), h("wish shopping", "retail"), h("sportsdirect", "retail"),
  h("jd sports", "retail"), h("foot locker", "retail"), h("muji store", "retail"),

  // ── Subscriptions & entertainment ─────────────────────────────────────────
  h("netflix.com", "subscriptions"), h("disney plus", "subscriptions"), h("hbo max", "subscriptions"),
  h("hulu plus", "subscriptions"), h("amazon prime video", "subscriptions"), h("apple tv plus", "subscriptions"),
  h("spotify premium", "subscriptions"), h("apple music", "subscriptions"), h("youtube premium", "subscriptions"),
  h("deezer music", "subscriptions"), h("tidal hifi", "subscriptions"), h("audible.com", "subscriptions"),
  h("kindle unlimited", "subscriptions"), h("playstation plus", "subscriptions"), h("xbox game pass", "subscriptions"),
  h("nintendo eshop", "entertainment"), h("twitch tv", "entertainment"), h("patreon membership", "entertainment"),
  h("onlyfans", "entertainment"), h("paramount plus", "subscriptions"), h("peacock tv", "subscriptions"),
  h("crunchyroll", "subscriptions"), h("masterclass.com", "education"), h("headspace app", "health"),
  h("calm app", "health"), h("duolingo plus", "education"), h("babbel languages", "education"),

  // ── Equipment & electronics ───────────────────────────────────────────────
  h("macbook pro", "equipment"), h("imac purchase", "equipment"), h("iphone purchase", "equipment"),
  h("ipad device", "equipment"), h("airpods pro", "equipment"), h("samsung electronics", "equipment"),
  h("dell technologies", "equipment"), h("hp inc", "equipment"), h("lenovo group", "equipment"),
  h("logitech", "equipment"), h("microsoft surface", "equipment"), h("sony electronics", "equipment"),
  h("bose corp", "equipment"), h("jbl audio", "equipment"), h("anker innovations", "equipment"),
  h("sandisk storage", "equipment"), h("western digital", "equipment"), h("seagate tech", "equipment"),
  h("corsair gaming", "equipment"), h("razer inc", "equipment"), h("nvidia corp", "equipment"),

  // ── Education ─────────────────────────────────────────────────────────────
  h("udemy courses", "education"), h("coursera inc", "education"), h("pluralsight", "education"),
  h("skillshare", "education"), h("linkedin learning", "education"), h("domestika", "education"),
  h("codecademy", "education"), h("openclassrooms", "education"), h("edx.org", "education"),
  h("khan academy", "education"), h("treehouse", "education"), h("codewars", "education"),
  h("frontend masters", "education"), h("egghead.io", "education"), h("datacamp", "education"),
  h("brilliant.org", "education"), h("udacity", "education"), h("futurelearn", "education"),

  // ── Marketing & advertising ───────────────────────────────────────────────
  h("facebook ads", "marketing"), h("google ads", "marketing"), h("meta ads", "marketing"),
  h("instagram ads", "marketing"), h("linkedin ads", "marketing"), h("twitter ads", "marketing"),
  h("tiktok ads", "marketing"), h("pinterest ads", "marketing"), h("snapchat ads", "marketing"),
  h("convertkit", "marketing"), h("activecampaign", "marketing"), h("klaviyo", "marketing"),
  h("postmark app", "marketing"), h("campaign monitor", "marketing"), h("brevo email", "marketing"),
  h("sendinblue", "marketing"), h("mailjet", "marketing"), h("omnisend", "marketing"),
  h("beehiiv", "marketing"), h("substack inc", "marketing"), h("buffer app", "marketing"),
  h("hootsuite inc", "marketing"), h("later.com", "marketing"),

  // ── Health & wellness ─────────────────────────────────────────────────────
  h("cvs pharmacy", "health"), h("walgreens store", "health"), h("specsavers", "health"),
  h("vision express", "health"), h("bupa health", "health"), h("aviva health", "health"),
  h("axa health insurance", "health"), h("peloton fitness", "health"), h("planet fitness", "health"),
  h("equinox gym", "health"), h("soulcycle", "health"), h("classpass", "health"),
  h("betterhelp therapy", "health"), h("talkspace counseling", "health"),
  h("iherb", "health"), h("aroma-zone", "health"), h("bsport", "health"),

  // ── Additional brand coverage (parity with prior flat keyword lists) ─────
  h("replicate", "ai tools"), h("snappa", "ai tools"), h("vidiq", "ai tools"), h("gemini ai", "ai tools"),
  h("gcp ", "software"), h("linear app", "software"), h("bubble.io", "software"), h("envato", "software"),
  h("google one", "software"), h("google play", "software"), h("google drive", "software"),
  h("google domains", "software"), h("office 365", "software"), h("onedrive", "software"),
  h("skype", "software"), h("ionos", "software"), h("scaleway", "software"), h("hostinger", "software"),
  h("o2switch", "software"), h("infomaniak", "software"), h("copyscape", "software"),
  h("amazon.co.uk", "equipment"), h("amazon.com", "equipment"), h("amazon.de", "equipment"),
  h("amazon.fr", "equipment"), h("amazon.ie", "equipment"), h("arduino", "equipment"),
  h("la poste", "office"), h("laposte", "office"),
  h("bolt ride", "transport"), h("taxi ", "transport"), h("cab ride", "transport"),
  h("oyster card", "transport"), h("lime bike", "transport"), h("citi bike", "transport"),
  h("cycle hire", "transport"), h("ba.com", "travel"), h("aer lingus", "travel"),
  h("cafe ", "food"), h("matsuri", "food"),
  h("disney+", "subscriptions"),
  h("expert comptable", "business services"), h("huissier", "business services"),
  h("smile & pay", "business services"), h("smile and pay", "business services"),
  h("française des jeux", "entertainment"), h("pmu ", "entertainment"), h("pathe ", "entertainment"),
  h("ticketmaster", "entertainment"), h("treatwell", "entertainment"), h("wecandoo", "entertainment"),
  h("edf energy", "utilities"), h("british gas", "utilities"), h("scottish power", "utilities"),
  h("bt internet", "utilities"), h("sky broadband", "utilities"), h("o2 bill", "utilities"),
  h("adwords", "advertising"), h("adsense", "advertising"), h("kindle purchase", "education"),

  // ── Bare-brand aliases ────────────────────────────────────────────────────
  // Real bank/card statements frequently show just the brand name with no
  // qualifier ("Amazon", "Netflix", "FDJ"). The qualified entries above stay
  // (and win via longest-match when present, e.g. "Amazon Web Services"); these
  // bare forms are the fallback for the common case. Generic English words that
  // risk false positives ("wise", "next", "target", "three", "booking") are
  // deliberately excluded — qualified variants only for those.
  h("amazon", "retail"), h("etsy", "retail"), h("temu", "retail"), h("shein", "retail"),
  h("zalando", "retail"), h("vinted", "retail"), h("wayfair", "retail"), h("zara", "retail"),
  h("uniqlo", "retail"), h("primark", "retail"), h("decathlon", "retail"), h("ikea", "retail"),
  h("sephora", "personal spending"), h("asos", "retail"), h("depop", "retail"),
  h("netflix", "subscriptions"), h("spotify", "subscriptions"), h("deezer", "subscriptions"),
  h("audible", "subscriptions"), h("youtube", "subscriptions"), h("invideo", "ai tools"),
  h("uber", "transport"), h("lyft", "transport"), h("bolt", "transport"),
  h("kfc", "food"),
  h("github", "software"), h("gitlab", "software"), h("notion", "software"), h("zoom", "software"),
  h("calendly", "software"), h("xero", "software"), h("loom", "software"),
];

export const GLOBAL_PACK: MerchantPack = {
  id: "global",
  label: "Global merchants",
  entries,
};
