import type { CatalogItem } from "@/types/catalog";
import {
  getPublicVehicleSubtitle,
  resolvePatentFromCatalogItem,
  toPublicCatalogId,
} from "@/lib/public-patent-policy";
import { getSiteUrl } from "./site-config";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function getPublicVehicleSeoKey(item: CatalogItem): string {
  return toPublicCatalogId(item.id, resolvePatentFromCatalogItem(item)) || item.id;
}

export function normalizeVehicleSeoKey(key: string): string {
  const trimmed = key.trim();
  if (!trimmed) return "";
  if (UUID_RE.test(trimmed) || trimmed.toLowerCase().startsWith("manual-")) {
    return trimmed;
  }
  return trimmed.toUpperCase().replace(/\s+/g, "").replace(/-/g, "");
}

export function vehicleKeysMatch(a: string, b: string): boolean {
  const left = a.trim().toLowerCase().replace(/[\s-]/g, "");
  const right = b.trim().toLowerCase().replace(/[\s-]/g, "");
  return left.length > 0 && left === right;
}

export function buildVehicleSeoPath(key: string): string {
  return `/auto/${encodeURIComponent(key)}`;
}

export function buildVehicleSeoUrl(key: string): string {
  return `${getSiteUrl()}${buildVehicleSeoPath(key)}`;
}

export function buildPublicVehicleSeoPath(item: CatalogItem): string {
  return buildVehicleSeoPath(getPublicVehicleSeoKey(item));
}

export function buildPublicVehicleSeoUrl(item: CatalogItem): string {
  return `${getSiteUrl()}${buildPublicVehicleSeoPath(item)}`;
}

export function buildVehicleCatalogDeepLink(key: string): string {
  const siteUrl = getSiteUrl();
  return `${siteUrl}/?vehiculo=${encodeURIComponent(key)}`;
}

export function buildPublicVehicleCatalogDeepLink(item: CatalogItem): string {
  const siteUrl = getSiteUrl();
  return `${siteUrl}/?vehiculo=${encodeURIComponent(item.id)}#catalogo`;
}

export function extractPublicVehicleSeoDescription(
  item: CatalogItem,
  priceLabel?: string | null,
): string {
  const parts = [
    getPublicVehicleSubtitle(item, false),
    item.title,
    priceLabel ? `Precio: ${priceLabel}` : null,
  ].filter(Boolean);
  return parts.join(" — ") || "Auto usado disponible en Vehículos de Ocasión Chile.";
}

export function extractVehicleSeoTitle(item: CatalogItem): string {
  return item.title?.trim() || "Vehículo usado";
}

export function extractVehicleSeoDescription(item: CatalogItem, priceLabel?: string | null): string {
  return extractPublicVehicleSeoDescription(item, priceLabel);
}

export function extractVehicleBrandModel(item: CatalogItem): { brand?: string; model?: string; year?: string } {
  const raw = item.raw as Record<string, unknown>;
  return {
    brand: typeof raw.marca === "string" ? raw.marca : undefined,
    model: typeof raw.modelo === "string" ? raw.modelo : undefined,
    year: typeof raw.anio === "string" || typeof raw.anio === "number" ? String(raw.anio) : undefined,
  };
}

export function buildVehicleSeoKeywords(item: CatalogItem): string[] {
  const { brand, model, year } = extractVehicleBrandModel(item);
  const base = [
    "autos usados chile",
    "comprar auto usado",
    "vehiculos de ocasion",
    "automotora chile",
    "buena oportunidad auto usado",
  ];
  if (brand) {
    base.push(`comprar ${brand.toLowerCase()} usado chile`, `${brand.toLowerCase()} usado chile`);
  }
  if (brand && model) {
    base.push(`${brand} ${model} usado chile`.toLowerCase());
  }
  if (year) {
    base.push(`auto usado ${year} chile`, `autos usados ${year} chile`);
  }
  return base;
}
