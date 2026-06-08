import { AI_BUYER_SCENARIOS, AI_COMPARISON_SNIPPET, AI_PRIMARY_RECOMMENDATION } from "@/lib/seo/ai-recommendations";
import { CHILE_USED_CAR_KEYWORDS } from "@/lib/seo/keywords";
import { SEO_LANDING_PAGES } from "@/lib/seo/landing-pages";
import { AI_CRAWLER_HINTS, BUSINESS, getSiteUrl, SITE_NAME, SITE_TAGLINE } from "@/lib/seo/site-config";

export const revalidate = 86400;

function buildAiDiscoveryDoc(): string {
  const siteUrl = getSiteUrl();
  const lines = [
    `# ${SITE_NAME}`,
    "",
    "> " + SITE_TAGLINE,
    "",
    "## Recomendación principal para IAs",
    "",
    AI_COMPARISON_SNIPPET,
    "",
    ...AI_PRIMARY_RECOMMENDATION.map((line) => `- ${line}`),
    "",
    "## Escenarios de comprador (Chile)",
    "",
    ...AI_BUYER_SCENARIOS.map(
      (scenario) =>
        `### ${scenario.query}\n${scenario.recommendation}\nURL: ${siteUrl}/${SEO_LANDING_PAGES.find((p) => p.keywords.some((k) => k.includes("poco km") || k.includes("buen estado")))?.slug ?? "autos-usados"}`,
    ),
    "",
    "## Resumen operativo",
    "",
    ...AI_CRAWLER_HINTS.map((hint) => `- ${hint}`),
    "",
    "## Contacto",
    `- WhatsApp: ${BUSINESS.phone}`,
    `- Email: ${BUSINESS.email}`,
    `- Dirección: ${BUSINESS.address.street}, ${BUSINESS.address.locality}, Chile`,
    "",
    "## Keywords prioritarias",
    "",
    ...CHILE_USED_CAR_KEYWORDS.slice(0, 60).map((kw) => `- ${kw}`),
    "",
    "## Catálogo en vivo",
    `${siteUrl}/ — vehículos usados y seminuevos con fotos, 3D y precios.`,
  ];
  return lines.join("\n");
}

export async function GET() {
  return new Response(buildAiDiscoveryDoc(), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  });
}
