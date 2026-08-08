import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/stripe";

// lastModified dates are the real last-commit dates for each page's content
// (checked via git log), not today's date — an honest freshness signal to
// Google, not an inflated one. Update these when the corresponding page's
// copy actually changes.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = getSiteUrl();
  return [
    { url: base, lastModified: "2026-07-28", changeFrequency: "weekly", priority: 1 },
    { url: `${base}/data-privacy`, lastModified: "2026-07-26", changeFrequency: "monthly", priority: 0.3 },
    { url: `${base}/terms-of-service`, lastModified: "2026-07-26", changeFrequency: "monthly", priority: 0.3 },
  ];
}
