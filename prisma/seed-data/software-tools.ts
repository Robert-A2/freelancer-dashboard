import type { SeedMerchant } from "./types";

/**
 * "Software" — all 19 of the user's named tools already existed as
 * static-pack keywords (no genuinely new keyword needed anywhere in this
 * batch); this only attaches real knowledge to each. Adobe was already
 * enriched in income-platforms.ts's sibling batch — not repeated here.
 *
 * Category mapping note: the app's category taxonomy (messages/en.json) has
 * no "Hosting" / "Cloud Services" / "Infrastructure" / "Database" keys — only
 * "software" exists at that granularity, so Vercel/Netlify/DigitalOcean/AWS/
 * Supabase/Cloudflare all map there unchanged. "AI Software" and "AI
 * Development" DO now exist as real categories (added after this file was
 * first written, splitting the old single "ai tools" bucket) — OpenAI and
 * Anthropic use "ai software", Cursor uses "ai development". See
 * src/lib/categorization/packs/global.ts's AI section for the same split
 * applied to the static keyword list. "ai tools" itself is kept in the
 * taxonomy only for backward compatibility with transactions categorized
 * before this split — nothing new is assigned to it going forward.
 *
 * Some merchants have two existing keyword variants (e.g. "notion" and
 * "notion.so") — both are enriched identically so knowledge doesn't depend
 * on which one happens to win a given match.
 *
 * parentCompany reflects real corporate ownership, not just the product
 * brand, where that's publicly known and different from the product name
 * (GitHub -> Microsoft, Slack -> Salesforce) — this is exactly the
 * "Merchant Relationships" the knowledge graph is for.
 */
export const SOFTWARE_TOOL_MERCHANTS: SeedMerchant[] = [
  {
    name: "Canva", keyword: "canva", category: "software", transactionType: "expense", confidence: "high",
    parentCompany: "Canva Pty Ltd", industry: "Software", businessPurpose: "Marketing & Design",
    country: "AU", website: "canva.com", recurring: true,
  },
  {
    name: "Figma", keyword: "figma", category: "software", transactionType: "expense", confidence: "high",
    parentCompany: "Figma, Inc.", industry: "Software", businessPurpose: "UI/UX Design",
    country: "US", website: "figma.com", recurring: true,
  },
  {
    name: "Notion", keyword: "notion", category: "software", transactionType: "expense", confidence: "high",
    parentCompany: "Notion Labs, Inc.", industry: "Productivity Software", businessPurpose: "Documentation",
    country: "US", website: "notion.so", recurring: true,
  },
  {
    name: "Notion", keyword: "notion.so", category: "software", transactionType: "expense", confidence: "high",
    parentCompany: "Notion Labs, Inc.", industry: "Productivity Software", businessPurpose: "Documentation",
    country: "US", website: "notion.so", recurring: true,
  },
  {
    name: "Slack", keyword: "slack", category: "software", transactionType: "expense", confidence: "high",
    parentCompany: "Salesforce, Inc.", industry: "Communication Software", businessPurpose: "Team Communication",
    country: "US", website: "slack.com", recurring: true,
  },
  {
    name: "Zoom", keyword: "zoom", category: "software", transactionType: "expense", confidence: "high",
    parentCompany: "Zoom Video Communications, Inc.", industry: "Communication Software", businessPurpose: "Video Meetings",
    country: "US", website: "zoom.us", recurring: true,
  },
  {
    name: "Zoom", keyword: "zoom.us", category: "software", transactionType: "expense", confidence: "high",
    parentCompany: "Zoom Video Communications, Inc.", industry: "Communication Software", businessPurpose: "Video Meetings",
    country: "US", website: "zoom.us", recurring: true,
  },
  {
    name: "Dropbox", keyword: "dropbox", category: "software", transactionType: "expense", confidence: "high",
    parentCompany: "Dropbox, Inc.", industry: "Cloud Storage", businessPurpose: "File Storage",
    country: "US", website: "dropbox.com", recurring: true,
  },
  {
    name: "Google Workspace", keyword: "google workspace", category: "software", transactionType: "expense", confidence: "high",
    parentCompany: "Google", industry: "Productivity Software", businessPurpose: "Email & Collaboration",
    country: "US", website: "workspace.google.com", recurring: true,
  },
  {
    name: "Microsoft 365", keyword: "microsoft 365", category: "software", transactionType: "expense", confidence: "high",
    parentCompany: "Microsoft Corporation", industry: "Productivity Software", businessPurpose: "Office Productivity",
    country: "US", website: "microsoft.com", recurring: true,
  },
  {
    name: "GitHub", keyword: "github", category: "software", transactionType: "expense", confidence: "high",
    parentCompany: "Microsoft Corporation", industry: "Developer Platform", businessPurpose: "Code Hosting",
    country: "US", website: "github.com", recurring: true,
  },
  {
    name: "GitHub", keyword: "github.com", category: "software", transactionType: "expense", confidence: "high",
    parentCompany: "Microsoft Corporation", industry: "Developer Platform", businessPurpose: "Code Hosting",
    country: "US", website: "github.com", recurring: true,
  },
  {
    name: "OpenAI", keyword: "openai", category: "ai software", transactionType: "expense", confidence: "high",
    parentCompany: "OpenAI, Inc.", industry: "Artificial Intelligence", businessPurpose: "AI Productivity",
    country: "US", website: "openai.com", recurring: true,
  },
  {
    name: "Anthropic (Claude)", keyword: "anthropic", category: "ai software", transactionType: "expense", confidence: "high",
    parentCompany: "Anthropic, PBC", industry: "Artificial Intelligence", businessPurpose: "AI Productivity",
    country: "US", website: "anthropic.com", recurring: true,
  },
  {
    name: "Anthropic (Claude)", keyword: "claude.ai", category: "ai software", transactionType: "expense", confidence: "high",
    parentCompany: "Anthropic, PBC", industry: "Artificial Intelligence", businessPurpose: "AI Productivity",
    country: "US", website: "anthropic.com", recurring: true,
  },
  {
    name: "Cursor", keyword: "cursor.sh", category: "ai development", transactionType: "expense", confidence: "high",
    parentCompany: "Anysphere, Inc.", industry: "Developer Tools", businessPurpose: "AI Coding",
    country: "US", website: "cursor.sh", recurring: true,
  },
  {
    name: "Vercel", keyword: "vercel", category: "software", transactionType: "expense", confidence: "high",
    parentCompany: "Vercel Inc.", industry: "Cloud Platform", businessPurpose: "Web Deployment",
    country: "US", website: "vercel.com", recurring: true,
  },
  {
    name: "Netlify", keyword: "netlify", category: "software", transactionType: "expense", confidence: "high",
    parentCompany: "Netlify, Inc.", industry: "Cloud Platform", businessPurpose: "Web Deployment",
    country: "US", website: "netlify.com", recurring: true,
  },
  {
    name: "DigitalOcean", keyword: "digitalocean", category: "software", transactionType: "expense", confidence: "high",
    parentCompany: "DigitalOcean Holdings, Inc.", industry: "Cloud Infrastructure", businessPurpose: "Servers",
    country: "US", website: "digitalocean.com", recurring: true,
  },
  {
    name: "Amazon Web Services", keyword: "amazon web services", category: "software", transactionType: "expense", confidence: "high",
    parentCompany: "Amazon.com, Inc.", industry: "Cloud Infrastructure", businessPurpose: "Infrastructure",
    country: "US", website: "aws.amazon.com", recurring: true,
  },
  {
    name: "Supabase", keyword: "supabase", category: "software", transactionType: "expense", confidence: "high",
    parentCompany: "Supabase Inc.", industry: "Database Platform", businessPurpose: "Backend Services",
    country: "US", website: "supabase.com", recurring: true,
  },
  {
    name: "Cloudflare", keyword: "cloudflare", category: "software", transactionType: "expense", confidence: "high",
    parentCompany: "Cloudflare, Inc.", industry: "Internet Infrastructure", businessPurpose: "DNS & Security",
    country: "US", website: "cloudflare.com", recurring: true,
  },
];
