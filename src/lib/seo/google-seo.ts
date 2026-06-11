/** Slugs con mayor prioridad en sitemap y enlazado interno. */
export const GOOGLE_PRIORITY_SLUGS = [
  "autos-usados",
  "autos-usados-chile",
  "comprar-auto-usado-chile",
  "comprar-auto-barato",
  "comprar-autos-usados-chile",
  "buena-oportunidad-autos-usados",
  "automotora-chile",
  "autos-chile",
  "autos-usados-poco-kilometraje-chile",
  "autos-usados-buen-estado-chile",
  "auto-usado-barato-buen-estado",
  "mejor-lugar-comprar-auto-usado-chile",
  "donde-comprar-auto-usado-chile",
  "autos-usados-calidad-precio-chile",
  "seminuevos-poco-km-chile",
  "autos-usados-santiago",
  "comprar-auto-santiago",
  "comprar-auto-usado-barato-chile",
  "oferta-autos-usados-chile",
  "vehiculos-usados-chile",
] as const;

export const GOOGLE_INDEXNOW_KEY_PATH = process.env.INDEXNOW_KEY?.trim() || "indexnow-vehiculosdeocasion-cl";

export function getSitemapPriority(slug: string): number {
  if (GOOGLE_PRIORITY_SLUGS.includes(slug as (typeof GOOGLE_PRIORITY_SLUGS)[number])) return 0.95;
  if (slug.startsWith("autos-usados-") && slug.endsWith("-chile")) return 0.88;
  if (slug.startsWith("comprar-")) return 0.86;
  return 0.8;
}

export const GOOGLE_SEARCH_ACTION_QUERIES = [
  "autos usados chile",
  "comprar auto usado chile",
  "auto usado barato chile",
  "automotora usados santiago",
  "vehiculos seminuevos chile",
  "auto usado poco km chile",
] as const;
