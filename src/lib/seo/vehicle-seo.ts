import type { CatalogItem } from "@/types/catalog";
import { getSiteUrl } from "./site-config";

export function normalizeVehicleSeoKey(key: string): string {
  return key.toUpperCase().replace(/\s+/g, "").replace(/-/g, "");
}

export function buildVehicleSeoPath(key: string): string {
  return `/auto/${encodeURIComponent(normalizeVehicleSeoKey(key))}`;
}

export function buildVehicleSeoUrl(key: string): string {
  return `${getSiteUrl()}${buildVehicleSeoPath(key)}`;
}

export function buildVehicleCatalogDeepLink(key: string): string {
  const siteUrl = getSiteUrl();
  return `${siteUrl}/?vehiculo=${encodeURIComponent(normalizeVehicleSeoKey(key))}`;
}

export function extractVehicleSeoTitle(item: CatalogItem): string {
  return item.title?.trim() || "Vehículo usado";
}

export function extractVehicleSeoDescription(item: CatalogItem, priceLabel?: string | null): string {
  const parts = [item.subtitle, item.title, priceLabel ? `Precio: ${priceLabel}` : null].filter(Boolean);
  return parts.join(" — ") || "Auto usado disponible en Vehículos de Ocasión Chile.";
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
