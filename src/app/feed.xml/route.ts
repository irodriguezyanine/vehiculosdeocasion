import { getCatalogFeed } from "@/lib/catalog";
import { getVisibleCatalogItems, getVehicleKey } from "@/lib/catalog-visibility";
import { getEditorConfig } from "@/lib/editor-config";
import { getSiteUrl, SITE_NAME } from "@/lib/seo/site-config";
import { buildVehicleSeoUrl, normalizeVehicleSeoKey } from "@/lib/seo/vehicle-seo";

export const revalidate = 300;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET() {
  const siteUrl = getSiteUrl();
  const [feed, editorConfigResult] = await Promise.all([getCatalogFeed(), getEditorConfig()]);
  const items = getVisibleCatalogItems(feed.items, editorConfigResult.config).slice(0, 50);
  const now = new Date().toUTCString();

  const itemXml = items
    .map((item) => {
      const key = normalizeVehicleSeoKey(getVehicleKey(item));
      const link = buildVehicleSeoUrl(key);
      return [
        "<item>",
        `<title>${escapeXml(item.title)}</title>`,
        `<link>${escapeXml(link)}</link>`,
        `<guid isPermaLink="true">${escapeXml(link)}</guid>`,
        `<description>${escapeXml(item.subtitle ?? item.title)}</description>`,
        `<pubDate>${now}</pubDate>`,
        "</item>",
      ].join("");
    })
    .join("");

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    "<channel>",
    `<title>${escapeXml(SITE_NAME)} — Autos usados Chile</title>`,
    `<link>${siteUrl}</link>`,
    `<description>Stock actualizado de autos usados y seminuevos en Chile</description>`,
    `<language>es-cl</language>`,
    `<lastBuildDate>${now}</lastBuildDate>`,
    `<atom:link href="${siteUrl}/feed.xml" rel="self" type="application/rss+xml"/>`,
    itemXml,
    "</channel>",
    "</rss>",
  ].join("");

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
}
