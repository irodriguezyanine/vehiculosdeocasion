import type { CatalogItem } from "@/types/catalog";

export const PUBLIC_PATENT_FIELD_LABELS = new Set(["Patente", "Patente verificador"]);

export function shouldExposePatentToViewer(isAdmin: boolean): boolean {
  return isAdmin;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function resolvePatentFromCatalogItem(item: CatalogItem): string {
  const raw = item.raw as Record<string, unknown>;
  const patent = [raw.patente, raw.PATENTE, raw.PPU, raw.stock_number].find(
    (value) => typeof value === "string" && value.trim().length > 0,
  ) as string | undefined;
  return patent?.toUpperCase().replace(/\s+/g, "").replace(/-/g, "") ?? "";
}

export function looksLikePatentToken(value: string): boolean {
  const normalized = value.toUpperCase().replace(/\s+/g, "").replace(/-/g, "");
  if (!normalized || normalized.length < 4 || normalized.length > 8) return false;
  return /^[A-Z0-9]+$/.test(normalized) && /\d/.test(normalized) && /[A-Z]/.test(normalized);
}

export function opaquePublicIdFromSeed(seed: string): string {
  const normalized = seed.trim().toUpperCase().replace(/[\s-]/g, "");
  let h1 = 2166136261;
  let h2 = 1597334677;
  for (let i = 0; i < normalized.length; i += 1) {
    const code = normalized.charCodeAt(i);
    h1 ^= code;
    h1 = Math.imul(h1, 16777619);
    h2 = Math.imul(h2 ^ code, 2246822519);
  }
  const a = (h1 >>> 0).toString(16).padStart(8, "0");
  const b = (h2 >>> 0).toString(16).padStart(8, "0");
  return `vh${a}${b}`;
}

export function toPublicCatalogId(rawId?: string | null, patent?: string | null): string {
  const id = (rawId ?? "").trim();
  if (id && !looksLikePatentToken(id)) return id;
  const seed = id || (patent ?? "").trim();
  if (!seed) return "";
  if (!looksLikePatentToken(seed)) return seed;
  return opaquePublicIdFromSeed(seed);
}

export function stripPatentFromPublicText(
  text: string | undefined | null,
  patent: string,
): string | undefined {
  if (!text?.trim()) return undefined;
  let result = text.trim();
  if (patent) {
    const escaped = escapeRegExp(patent);
    result = result
      .replace(new RegExp(`^${escaped}\\s*[·\\-,|]\\s*`, "i"), "")
      .replace(new RegExp(`\\s*[·\\-,|]\\s*${escaped}(\\s|$)`, "gi"), " ")
      .replace(new RegExp(`^${escaped}$`, "i"), "")
      .trim();
  }
  if (!result) return undefined;
  if (looksLikePatentToken(result)) return undefined;
  return result;
}

export function getPublicVehicleSubtitle(
  item: CatalogItem,
  isAdmin: boolean,
): string | undefined {
  if (isAdmin) return item.subtitle?.trim() || undefined;
  return stripPatentFromPublicText(item.subtitle, resolvePatentFromCatalogItem(item));
}

export function getPublicShareKey(item: CatalogItem, vehicleKey: string, isAdmin: boolean): string {
  if (isAdmin) return vehicleKey;
  return toPublicCatalogId(item.id, resolvePatentFromCatalogItem(item)) || item.id;
}
