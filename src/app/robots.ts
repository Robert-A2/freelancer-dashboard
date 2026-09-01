import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/stripe";

// Only the marketing homepage is meant to be found via search. The legal
// pages (/data-privacy, /terms-of-service) are real and reachable — they're
// just marked noindex on the page itself (see each page's own metadata
// export) rather than disallowed here, so they stay crawlable/linkable but
// never show up as their own search result. The demo, the actual app
// (behind login), and per-client payment links are all private or not
// standalone content — indexing any of them lets them compete with the
// homepage for the same brand search instead of being understood as part
// of it, so those are blocked from crawling entirely below.
export default function robots(): MetadataRoute.Robots {
  const base = getSiteUrl();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/demo",
        "/pay/",
        "/dashboard",
        "/upload",
        "/analytics",
        "/clients",
        "/forecast",
        "/history",
        "/settings",
        "/profile",
        "/projects",
        "/api/",
      ],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
