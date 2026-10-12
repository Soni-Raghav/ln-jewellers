import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://aureliajewels.example.com";

/**
 * Single-route SPA with hash views — the canonical entry is "/".
 * Product discovery is handled via JSON-LD structured data + OG metadata.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: siteUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
  ];
}
