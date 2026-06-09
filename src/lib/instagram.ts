import { BUSINESS } from "@/lib/seo/site-config";

export const INSTAGRAM_USERNAME = "vehiculosdeocasioncl";
export const INSTAGRAM_HANDLE = `@${INSTAGRAM_USERNAME}`;
export const INSTAGRAM_PROFILE_URL = BUSINESS.sameAs.find((url) =>
  url.includes("instagram.com"),
) ?? `https://www.instagram.com/${INSTAGRAM_USERNAME}/`;

export type InstagramProfile = {
  username: string;
  fullName: string;
  biography: string;
  profilePictureUrl?: string;
  followersCount?: number;
  followingCount?: number;
  postsCount?: number;
  profileUrl: string;
};

export type InstagramMediaItem = {
  id: string;
  imageUrl?: string;
  permalink: string;
  caption: string;
  isVideo?: boolean;
};

export type InstagramFeedResponse = {
  profile: InstagramProfile;
  items: InstagramMediaItem[];
  source: "graph_api" | "web_profile" | "fallback";
};

export const INSTAGRAM_FALLBACK_PROFILE: InstagramProfile = {
  username: INSTAGRAM_USERNAME,
  fullName: "Vehículos de Ocasión",
  biography:
    "Automotora oficial de vehículos seminuevos de VEDISA REMATES. Catálogo, fotos, visor 3D y contacto directo por WhatsApp.",
  profileUrl: INSTAGRAM_PROFILE_URL,
};

export function formatInstagramCount(value?: number): string {
  if (value === undefined || Number.isNaN(value)) return "—";
  if (value >= 1_000_000) {
    const compact = value / 1_000_000;
    return `${compact >= 10 ? Math.round(compact) : compact.toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (value >= 10_000) {
    const compact = value / 1_000;
    return `${compact >= 100 ? Math.round(compact) : compact.toFixed(1).replace(/\.0$/, "")}K`;
  }
  return value.toLocaleString("es-CL");
}

export function decodeInstagramText(value: string): string {
  return value
    .replace(/\\u0026/g, "&")
    .replace(/\\\//g, "/")
    .replace(/\\n/g, "\n");
}
