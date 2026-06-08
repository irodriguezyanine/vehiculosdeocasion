import type { MetadataRoute } from "next";
import { SEO_LANDING_PAGES } from "@/lib/seo/landing-pages";
import { getSiteUrl } from "@/lib/seo/site-config";

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();
  const now = new Date();

  const home: MetadataRoute.Sitemap = [
    {
      url: siteUrl,
      lastModified: now,
      changeFrequency: "hourly",
      priority: 1,
    },
  ];

  const landings: MetadataRoute.Sitemap = SEO_LANDING_PAGES.map((page) => ({
    url: `${siteUrl}/${page.slug}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.85,
  }));

  return [...home, ...landings];
}
