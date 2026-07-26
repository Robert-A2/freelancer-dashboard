import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/stripe";

// Only the marketing homepage and the two legal pages are meant to be found
// via search. The demo, the actual app (behind login), and per-client
// payment links are all private or not standalone content — indexing any of
// them lets them compete with the homepage for the same brand search instead
// of being understood as part of it.
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
