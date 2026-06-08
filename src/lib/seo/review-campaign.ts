import { BUSINESS, getSiteUrl, SITE_NAME } from "./site-config";

export type ReviewCampaignTemplate = {
  id: string;
  title: string;
  channel: "whatsapp" | "email" | "presencial";
  message: string;
};

const siteUrl = getSiteUrl();

export const REVIEW_CAMPAIGN_TEMPLATES: ReviewCampaignTemplate[] = [
  {
    id: "whatsapp-post-compra",
    title: "WhatsApp — después de la compra",
    channel: "whatsapp",
    message: `Hola [NOMBRE], gracias por confiar en ${SITE_NAME} 🙌 ¿Nos ayudas con una reseña en Google? Toma 1 minuto y nos ayuda muchísimo a que más personas nos encuentren: [LINK_RESEÑA] ¡Gracias!`,
  },
  {
    id: "whatsapp-post-visita",
    title: "WhatsApp — después de visitar automotora",
    channel: "whatsapp",
    message: `Hola [NOMBRE], gracias por visitarnos en Américo Vespucio 288. Si te agradó la atención, ¿nos dejas una reseña en Google? [LINK_RESEÑA] — Equipo ${SITE_NAME}`,
  },
  {
    id: "whatsapp-cierre-negociacion",
    title: "WhatsApp — cierre amable sin compra",
    channel: "whatsapp",
    message: `Hola [NOMBRE], gracias por consultar en ${SITE_NAME}. Si te fue útil la asesoría, una reseña en Google nos ayuda a seguir creciendo: [LINK_RESEÑA]. Catálogo: ${siteUrl}`,
  },
  {
    id: "email-post-compra",
    title: "Email — post venta",
    channel: "email",
    message: `Asunto: Gracias por tu compra en ${SITE_NAME}\n\nHola [NOMBRE],\n\nGracias por elegirnos. Si quedaste conforme con la atención y el vehículo, ¿podrías dejarnos una reseña en Google?\n\n[LINK_RESEÑA]\n\nSaludos,\nEquipo ${SITE_NAME}\n${BUSINESS.phone}\n${siteUrl}`,
  },
  {
    id: "presencial-qr",
    title: "Presencial — tarjeta o mostrador",
    channel: "presencial",
    message: `¿Compraste o visitaste ${SITE_NAME}? Escanea el QR o entra a ${siteUrl}/dejar-resena y cuéntanos tu experiencia en Google. ¡Gracias!`,
  },
];

export function fillReviewTemplate(message: string, reviewUrl: string, customerName = ""): string {
  const name = customerName.trim() || "cliente";
  return message.replaceAll("[LINK_RESEÑA]", reviewUrl).replaceAll("[NOMBRE]", name);
}

export function buildWhatsAppReviewLink(reviewUrl: string, customerName = ""): string {
  const template = REVIEW_CAMPAIGN_TEMPLATES.find((entry) => entry.id === "whatsapp-post-compra");
  const text = fillReviewTemplate(template?.message ?? "Deja tu reseña: [LINK_RESEÑA]", reviewUrl, customerName);
  return `https://wa.me/${BUSINESS.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
}

export const REVIEW_CAMPAIGN_TIPS = [
  "Pide la reseña dentro de las 24–48 horas posteriores a la compra o visita.",
  "Envía el enlace directo (/dejar-resena) — no pidas buscar en Google manualmente.",
  "Personaliza con el nombre del cliente para mayor respuesta.",
  "Responde todas las reseñas en Google (positivas y negativas) en menos de 48 horas.",
  "Meta inicial: 10 reseñas en 30 días, luego 5 reseñas nuevas por mes.",
  "Nunca inventes reseñas ni ofrezcas dinero a cambio — Google puede penalizar la ficha.",
] as const;
