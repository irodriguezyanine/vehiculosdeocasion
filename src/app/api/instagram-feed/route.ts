import { NextResponse } from "next/server";

type InstagramMediaItem = {
  id: string;
  imageUrl?: string;
  permalink: string;
  caption: string;
};

const INSTAGRAM_PROFILE_URL = "https://www.instagram.com/autosdeoc/";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

function extractShortcodes(html: string): string[] {
  const plainMatches = html.match(/\/(p|reel)\/([A-Za-z0-9_-]{5,})\//g) ?? [];
  const escapedMatches = html.match(/\\\/(p|reel)\\\/([A-Za-z0-9_-]{5,})\\\//g) ?? [];
  const shortcodes = [...plainMatches, ...escapedMatches]
    .map((entry) => entry.match(/(?:\\\/|\/)(?:p|reel)(?:\\\/|\/)([A-Za-z0-9_-]{5,})/)?.[1] ?? "")
    .filter(Boolean);
  return Array.from(new Set(shortcodes)).slice(0, 12);
}

function extractMetaContent(html: string, property: string): string {
  const regex = new RegExp(
    `<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`,
    "i",
  );
  const match = html.match(regex);
  return match?.[1] ?? "";
}

export async function GET() {
  try {
    const profileResponse = await fetch(INSTAGRAM_PROFILE_URL, {
      headers: { "user-agent": USER_AGENT },
      cache: "no-store",
    });
    if (!profileResponse.ok) return NextResponse.json({ items: [] });

    const profileHtml = await profileResponse.text();
    const shortcodes = extractShortcodes(profileHtml);
    if (shortcodes.length === 0) return NextResponse.json({ items: [] });

    const postResults = await Promise.all(
      shortcodes.map(async (shortcode): Promise<InstagramMediaItem | null> => {
        try {
          const permalink = `https://www.instagram.com/p/${shortcode}/`;
          const postResponse = await fetch(permalink, {
            headers: { "user-agent": USER_AGENT },
            cache: "no-store",
          });
          if (!postResponse.ok) {
            return {
              id: shortcode,
              permalink,
              caption: "Publicacion de Instagram",
            };
          }
          const postHtml = await postResponse.text();
          const imageUrl = extractMetaContent(postHtml, "og:image");
          const rawTitle = extractMetaContent(postHtml, "og:title");
          const caption = rawTitle.replace(/\s+on Instagram.*$/i, "").trim();
          return {
            id: shortcode,
            imageUrl,
            permalink,
            caption: caption || "Publicacion de Instagram",
          };
        } catch {
          return {
            id: shortcode,
            permalink: `https://www.instagram.com/p/${shortcode}/`,
            caption: "Publicacion de Instagram",
          };
        }
      }),
    );
    const items = postResults.filter((item): item is InstagramMediaItem => Boolean(item));

    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ items: [] });
  }
}

