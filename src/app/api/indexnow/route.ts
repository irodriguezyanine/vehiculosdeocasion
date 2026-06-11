import { SEO_LANDING_PAGES } from "@/lib/seo/landing-pages";
import { GOOGLE_INDEXNOW_KEY_PATH, GOOGLE_PRIORITY_SLUGS } from "@/lib/seo/google-seo";
import { getSiteUrl } from "@/lib/seo/site-config";
import { buildVehicleSeoPath, normalizeVehicleSeoKey } from "@/lib/seo/vehicle-seo";
import { getCatalogFeed } from "@/lib/catalog";
import { getVehicleKey, getVisibleCatalogItems } from "@/lib/catalog-visibility";
import { getEditorConfig } from "@/lib/editor-config";

const INDEXNOW_ENDPOINTS = [
  "https://api.indexnow.org/indexnow",
  "https://www.bing.com/indexnow",
];

async function pingIndexNow(urls: string[]): Promise<{ ok: boolean; details: string[] }> {
  const siteUrl = getSiteUrl();
  const host = siteUrl.replace(/^https?:\/\//, "");
  const key = GOOGLE_INDEXNOW_KEY_PATH;
  const keyLocation = `${siteUrl}/${key}.txt`;
  const body = JSON.stringify({ host, key, keyLocation, urlList: urls });
  const details: string[] = [];

  for (const endpoint of INDEXNOW_ENDPOINTS) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body,
      });
      details.push(`${endpoint}: ${response.status}`);
    } catch (error) {
      details.push(`${endpoint}: error ${error instanceof Error ? error.message : "unknown"}`);
    }
  }

  return { ok: details.some((line) => line.includes(": 200") || line.includes(": 202")), details };
}

function buildDefaultUrls(): string[] {
  const siteUrl = getSiteUrl();
  const priority = GOOGLE_PRIORITY_SLUGS.map((slug) => `${siteUrl}/${slug}`);
  const allLandings = SEO_LANDING_PAGES.map((page) => `${siteUrl}/${page.slug}`);
  return Array.from(new Set([siteUrl, `${siteUrl}/feed.xml`, `${siteUrl}/sitemap.xml`, ...priority, ...allLandings]));
}

async function buildAllUrls(): Promise<string[]> {
  const siteUrl = getSiteUrl();
  const base = buildDefaultUrls();
  const [feed, editorConfigResult] = await Promise.all([getCatalogFeed(), getEditorConfig()]);
  const visibleItems = getVisibleCatalogItems(feed.items, editorConfigResult.config);
  const vehicleUrls = visibleItems.map(
    (item) => `${siteUrl}${buildVehicleSeoPath(normalizeVehicleSeoKey(getVehicleKey(item)))}`,
  );
  return Array.from(new Set([...base, ...vehicleUrls]));
}

export async function GET() {
  const urls = await buildAllUrls();
  const result = await pingIndexNow(urls);
  return Response.json({ submitted: urls.length, ...result, urls });
}

export async function POST(request: Request) {
  const siteUrl = getSiteUrl();
  let urls = await buildAllUrls();
  try {
    const payload = (await request.json()) as { urls?: string[] };
    if (Array.isArray(payload.urls) && payload.urls.length > 0) {
      urls = payload.urls.map((url) => (url.startsWith("http") ? url : `${siteUrl}${url.startsWith("/") ? url : `/${url}`}`));
    }
  } catch {
    // use defaults
  }
  const result = await pingIndexNow(urls);
  return Response.json({ submitted: urls.length, ...result, urls });
}
