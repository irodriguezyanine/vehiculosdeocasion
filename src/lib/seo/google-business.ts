import { BUSINESS, getSiteUrl, SITE_NAME } from "./site-config";

export type GoogleBusinessConfig = {
  reviewUrl: string | null;
  mapsUrl: string;
  mapsEmbedUrl: string;
  placeId: string | null;
  profileName: string;
  formattedAddress: string;
};

function buildDefaultMapsSearchUrl(): string {
  const query = encodeURIComponent(
    `${SITE_NAME} ${BUSINESS.address.street} ${BUSINESS.address.locality} Chile`,
  );
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

function buildMapsEmbedUrl(): string {
  const query = encodeURIComponent(
    `${BUSINESS.address.street}, ${BUSINESS.address.locality}, Chile`,
  );
  return `https://maps.google.com/maps?q=${query}&z=15&output=embed`;
}

/** Configura en Vercel: NEXT_PUBLIC_GOOGLE_REVIEW_URL o NEXT_PUBLIC_GOOGLE_PLACE_ID */
export function getGoogleBusinessConfig(): GoogleBusinessConfig {
  const placeId = process.env.NEXT_PUBLIC_GOOGLE_PLACE_ID?.trim() || null;
  const reviewUrlFromEnv = process.env.NEXT_PUBLIC_GOOGLE_REVIEW_URL?.trim() || null;
  const mapsUrl = process.env.NEXT_PUBLIC_GOOGLE_MAPS_URL?.trim() || buildDefaultMapsSearchUrl();

  const reviewUrl =
    reviewUrlFromEnv ||
    (placeId ? `https://search.google.com/local/writereview?placeid=${encodeURIComponent(placeId)}` : null);

  return {
    reviewUrl,
    mapsUrl,
    mapsEmbedUrl: buildMapsEmbedUrl(),
    placeId,
    profileName: SITE_NAME,
    formattedAddress: `${BUSINESS.address.street}, ${BUSINESS.address.locality}, ${BUSINESS.address.region}, Chile`,
  };
}

export function getGoogleBusinessSameAs(): string[] {
  const { mapsUrl } = getGoogleBusinessConfig();
  const siteUrl = getSiteUrl();
  return Array.from(
    new Set([...BUSINESS.sameAs, mapsUrl, `${siteUrl}/dejar-resena`, `${siteUrl}/automotora-santiago-google`]),
  );
}

export const GOOGLE_BUSINESS_CATEGORIES = [
  "Automotora",
  "Concesionario de autos usados",
  "Venta de vehículos seminuevos",
  "Compraventa de autos",
] as const;

export const GOOGLE_BUSINESS_SERVICES = [
  "Venta de autos usados",
  "Venta de seminuevos",
  "Venta de SUVs y camionetas",
  "Asesoría comercial por WhatsApp",
  "Visita presencial en automotora",
] as const;

export const GOOGLE_BUSINESS_DESCRIPTION =
  "Vehículos de Ocasión es la automotora de seminuevos de VEDISA REMATES en Américo Vespucio 288, Santiago. " +
  "Venta de autos usados y seminuevos con precios competitivos, catálogo online con fotos, visor 3D y atención comercial directa.";

export const GOOGLE_BUSINESS_SETUP_CHECKLIST = [
  "Nombre: Vehículos de Ocasión",
  "Categoría principal: Automotora o Concesionario de autos usados",
  "Dirección: Américo Vespucio 288, Santiago (debe coincidir con el sitio web)",
  "Teléfono: +56 9 7740 8758",
  "Sitio web: https://vehiculosdeocasion.cl",
  "Horario: Lun–Vie 09:00–18:00, Sáb 10:00–14:00",
  "Descripción: usar GOOGLE_BUSINESS_DESCRIPTION del sitio",
  "Fotos: fachada, sala, stock, logo y vehículos destacados (mínimo 10)",
  "Servicios: autos usados, seminuevos, SUVs, camionetas, WhatsApp comercial",
  "Atributos: venta presencial, venta online, estacionamiento si aplica",
  "Publicaciones semanales: 1–2 vehículos destacados con enlace al catálogo",
  "Preguntas y respuestas: copiar FAQs del sitio",
] as const;
