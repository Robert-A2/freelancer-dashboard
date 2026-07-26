import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/stripe";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getSiteUrl();
  return [
    { url: base, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/data-privacy`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${base}/terms-of-service`, changeFrequency: "monthly", priority: 0.3 },
  ];
}
