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
  return isAdmin ? vehicleKey : item.id;
}
