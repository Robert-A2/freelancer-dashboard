import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/stripe";

// lastModified dates are the real last-commit dates for each page's content
// (checked via git log), not today's date — an honest freshness signal to
// Google, not an inflated one. Update these when the corresponding page's
// copy actually changes.
//
// The homepage is the only URL submitted here — /data-privacy and
// /terms-of-service are real, reachable pages (linked from the homepage
// footer) but are marked noindex on the page itself (see each page's own
// metadata export) specifically so they never show up as their own search
// result competing with the homepage. Listing a noindex URL in the sitemap
// would contradict that signal, so it's deliberately left out.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = getSiteUrl();
  return [
    { url: base, lastModified: "2026-07-28", changeFrequency: "weekly", priority: 1 },
  ];
}
