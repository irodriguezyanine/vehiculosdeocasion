import type { Metadata } from "next";
import Link from "next/link";
import {
  GoogleBusinessPanel,
  ReviewCampaignTemplates,
} from "@/components/google-business-panel";
import { StructuredData } from "@/components/structured-data";
import { getGoogleBusinessConfig } from "@/lib/seo/google-business";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { buildWebPageJsonLd, buildOrganizationJsonLd } from "@/lib/seo/json-ld";
import { SITE_NAME } from "@/lib/seo/site-config";

export const metadata: Metadata = buildPageMetadata({
  path: "dejar-resena",
  title: `Dejar reseña en Google | ${SITE_NAME}`,
  description:
    "Deja tu reseña de Vehículos de Ocasión en Google. Automotora de autos usados en Américo Vespucio 288, Santiago — VEDISA REMATES.",
  keywords: ["reseña vehiculos de ocasion", "opinion automotora santiago", "google maps vehiculos de ocasion"],
});

export default function DejarResenaPage() {
  const gbp = getGoogleBusinessConfig();
  const reviewLink = gbp.reviewUrl ?? gbp.mapsUrl;

  return (
    <>
      <StructuredData
        data={[
          buildOrganizationJsonLd(),
          buildWebPageJsonLd({
            path: "dejar-resena",
            title: `Dejar reseña — ${SITE_NAME}`,
            description: "Página para dejar reseña en Google de Vehículos de Ocasión.",
          }),
        ]}
      />
      <main className="mx-auto min-h-screen max-w-3xl px-4 py-8">
        <nav className="mb-6 text-sm text-neutral-500">
          <Link href="/" className="hover:text-[#33c7e3]">
            Inicio
          </Link>
          <span aria-hidden="true"> / </span>
          <span>Dejar reseña</span>
        </nav>

        <header className="mb-8">
          <h1 className="mb-3 text-3xl font-bold text-neutral-900">¿Cómo fue tu experiencia con {SITE_NAME}?</h1>
          <p className="text-lg text-neutral-700">
            Tu opinión en Google nos ayuda a que más personas en Chile encuentren autos usados y seminuevos de
            confianza. Gracias por tomarte un minuto.
          </p>
        </header>

        <section className="mb-8 rounded-2xl bg-[#33c7e3] p-6 text-white">
          <h2 className="mb-2 text-xl font-semibold">Dejar reseña en Google</h2>
          <p className="mb-4 opacity-95">
            {gbp.reviewUrl
              ? "Haz clic en el botón para abrir Google y publicar tu reseña."
              : "Abre nuestra ficha en Google Maps y selecciona «Escribir una reseña»."}
          </p>
          <a
            href={reviewLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex rounded-lg bg-white px-5 py-3 font-semibold text-[#33c7e3] transition hover:bg-neutral-100"
          >
            {gbp.reviewUrl ? "Escribir reseña en Google" : "Abrir Google Maps"}
          </a>
        </section>

        <GoogleBusinessPanel />

        <ReviewCampaignTemplates reviewUrl={reviewLink} />

        <p className="text-center text-sm text-neutral-500">
          <Link href="/" className="text-[#33c7e3] hover:underline">
            ← Volver al catálogo de autos usados
          </Link>
        </p>
      </main>
    </>
  );
}
