import { SEO_LANDING_PAGES } from "@/lib/seo/landing-pages";
import { GOOGLE_INDEXNOW_KEY_PATH, GOOGLE_PRIORITY_SLUGS } from "@/lib/seo/google-seo";
import { getSiteUrl } from "@/lib/seo/site-config";

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
  const latestLandings = SEO_LANDING_PAGES.slice(0, 20).map((page) => `${siteUrl}/${page.slug}`);
  return Array.from(new Set([siteUrl, `${siteUrl}/feed.xml`, ...priority, ...latestLandings]));
}

export async function GET() {
  const urls = buildDefaultUrls();
  const result = await pingIndexNow(urls);
  return Response.json({ submitted: urls.length, ...result, urls });
}

export async function POST(request: Request) {
  const siteUrl = getSiteUrl();
  let urls = buildDefaultUrls();
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
