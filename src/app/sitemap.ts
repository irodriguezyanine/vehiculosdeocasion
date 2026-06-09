import type { MetadataRoute } from "next";
import { getSitemapPriority } from "@/lib/seo/google-seo";
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
    priority: getSitemapPriority(page.slug),
  }));

  const discovery: MetadataRoute.Sitemap = [
    {
      url: `${siteUrl}/nosotros`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.85,
    },
    {
      url: `${siteUrl}/contacto`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.85,
    },
    {
      url: `${siteUrl}/dejar-resena`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${siteUrl}/automotora-santiago-google`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${siteUrl}/feed.xml`,
      lastModified: now,
      changeFrequency: "hourly",
      priority: 0.6,
    },
    {
      url: `${siteUrl}/llms.txt`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.3,
    },
    {
      url: `${siteUrl}/ai.txt`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.3,
    },
  ];

  return [...home, ...landings, ...discovery];
}
