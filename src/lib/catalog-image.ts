import type { CatalogItem } from "@/types/catalog";

export const PLACEHOLDER_CATALOG_THUMBNAIL = "/placeholder-car.svg";

const THUMB_KEYS = [
  "thumb_url",
  "thumbnail",
  "thumb",
  "imagen_principal",
  "foto_portada",
  "image",
  "main_image",
  "cover",
  "preview",
  "preview_url",
  "poster",
  "image_url",
  "thumbnail_url",
] as const;

export function isPlaceholderCatalogThumbnail(value?: string | null): boolean {
  const trimmed = value?.trim();
  return !trimmed || trimmed === PLACEHOLDER_CATALOG_THUMBNAIL || trimmed.endsWith(PLACEHOLDER_CATALOG_THUMBNAIL);
}

function isLikelyCatalogImageUrl(url: string): boolean {
  const normalized = url.toLowerCase();
  if (normalized.includes("glo3d.net/iframe") || normalized.includes("<iframe")) return false;
  if (/\.(jpg|jpeg|png|webp|gif|bmp|avif)(\?|$)/i.test(normalized)) return true;
  return /cdn\.|cloudfront|amazonaws|supabase|cloudinary|glo3d|thumb|image|photo|media|foto/.test(
    normalized,
  );
}

function cleanImageUrl(value: string): string | undefined {
  const raw = value.trim().replace(/\$.*$/, "");
  const absolute = raw.startsWith("//") ? `https:${raw}` : raw;
  if (!absolute.startsWith("http") || !isLikelyCatalogImageUrl(absolute)) return undefined;
  return absolute;
}

function readThumb(record: Record<string, unknown>): string | undefined {
  for (const key of THUMB_KEYS) {
    const value = record[key];
    if (typeof value === "string") {
      const url = cleanImageUrl(value);
      if (url) return url;
    }
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const nested = (value as Record<string, unknown>).url;
      if (typeof nested === "string") {
        const url = cleanImageUrl(nested);
        if (url) return url;
      }
    }
  }
  return undefined;
}

/** Miniatura sin recorrer el JSON completo del vehículo. */
export function resolveGlo3dThumbnailFromRecord(raw: Record<string, unknown>): string | undefined {
  const direct = readThumb(raw);
  if (direct) return direct;
  for (const key of ["glo3d", "glo3d_campos", "main_frame"]) {
    const nested = raw[key];
    if (nested && typeof nested === "object" && !Array.isArray(nested)) {
      const url = readThumb(nested as Record<string, unknown>);
      if (url) return url;
    }
  }
  return undefined;
}

export function resolveCatalogItemThumbnail(item: CatalogItem): string | undefined {
  const raw = item.raw as Record<string, unknown>;
  const candidates = [
    item.thumbnail,
    ...item.images,
    resolveGlo3dThumbnailFromRecord(raw),
    typeof raw.thumbnail === "string" ? raw.thumbnail : undefined,
    typeof raw.foto_portada === "string" ? raw.foto_portada : undefined,
    typeof raw.imagen_principal === "string" ? raw.imagen_principal : undefined,
  ];
  for (const candidate of candidates) {
    if (typeof candidate !== "string" || isPlaceholderCatalogThumbnail(candidate)) continue;
    const url = cleanImageUrl(candidate);
    if (url) return url;
  }
  return undefined;
}

/** Pide una foto más chica en Cloudinary. El resto de CDNs se deja igual. */
export function catalogDisplaySrc(url: string, width: number): string {
  if (!url || url.startsWith("/") || url === PLACEHOLDER_CATALOG_THUMBNAIL) return url;
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes("res.cloudinary.com")) return url;
    if (parsed.pathname.includes("/upload/f_auto") || parsed.pathname.includes("/upload/w_")) return url;
    const marker = "/upload/";
    const index = parsed.pathname.indexOf(marker);
    if (index < 0) return url;
    const sized = Math.max(64, Math.min(1600, Math.round(width)));
    parsed.pathname =
      parsed.pathname.slice(0, index + marker.length) +
      `f_auto,q_auto,w_${sized},c_limit/` +
      parsed.pathname.slice(index + marker.length);
    return parsed.toString();
  } catch {
    return url;
  }
}
