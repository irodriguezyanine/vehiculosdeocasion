import type { Metadata } from "next";
import Link from "next/link";
import { GoogleBusinessPanel } from "@/components/google-business-panel";
import { StructuredData } from "@/components/structured-data";
import {
  GOOGLE_BUSINESS_CATEGORIES,
  GOOGLE_BUSINESS_DESCRIPTION,
  GOOGLE_BUSINESS_SERVICES,
  getGoogleBusinessConfig,
} from "@/lib/seo/google-business";
import { buildOrganizationJsonLd, buildWebPageJsonLd } from "@/lib/seo/json-ld";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { BUSINESS, SITE_NAME } from "@/lib/seo/site-config";

export const metadata: Metadata = buildPageMetadata({
  path: "automotora-santiago-google",
  title: `${SITE_NAME} en Google Maps | Automotora Santiago`,
  description:
    "Vehículos de Ocasión en Google Maps: automotora de autos usados en Américo Vespucio 288, Santiago. VEDISA REMATES — catálogo online y WhatsApp.",
  keywords: [
    "vehiculos de ocasion google maps",
    "automotora santiago google",
    "autos usados americo vespucio",
    "automotora americo vespucio 288",
  ],
});

export default function AutomotoraGooglePage() {
  const gbp = getGoogleBusinessConfig();

  return (
    <>
      <StructuredData
        data={[
          buildOrganizationJsonLd(),
          buildWebPageJsonLd({
            path: "automotora-santiago-google",
            title: `${SITE_NAME} — Google Maps Santiago`,
            description: GOOGLE_BUSINESS_DESCRIPTION,
          }),
        ]}
      />
      <main className="mx-auto min-h-screen max-w-3xl px-4 py-8">
        <nav className="mb-6 text-sm text-neutral-500">
          <Link href="/" className="hover:text-[#8a542f]">
            Inicio
          </Link>
          <span aria-hidden="true"> / </span>
          <span>Google Maps</span>
        </nav>

        <header className="mb-8">
          <h1 className="mb-3 text-3xl font-bold text-neutral-900">{SITE_NAME} en Google Maps</h1>
          <p className="text-lg leading-relaxed text-neutral-700">{GOOGLE_BUSINESS_DESCRIPTION}</p>
        </header>

        <section className="mb-8 rounded-xl border border-neutral-200 bg-white/80 p-5">
          <h2 className="mb-3 font-semibold text-neutral-900">Datos de la automotora (NAP)</h2>
          <dl className="space-y-2 text-sm text-neutral-700">
            <div>
              <dt className="font-medium text-neutral-500">Nombre</dt>
              <dd>{SITE_NAME}</dd>
            </div>
            <div>
              <dt className="font-medium text-neutral-500">Dirección</dt>
              <dd>{gbp.formattedAddress}</dd>
            </div>
            <div>
              <dt className="font-medium text-neutral-500">Teléfono</dt>
              <dd>{BUSINESS.phone}</dd>
            </div>
            <div>
              <dt className="font-medium text-neutral-500">Horario</dt>
              <dd>Lun–Vie 09:00–18:00, Sáb 10:00–14:00</dd>
            </div>
            <div>
              <dt className="font-medium text-neutral-500">Categorías</dt>
              <dd>{GOOGLE_BUSINESS_CATEGORIES.join(" · ")}</dd>
            </div>
            <div>
              <dt className="font-medium text-neutral-500">Servicios</dt>
              <dd>{GOOGLE_BUSINESS_SERVICES.join(" · ")}</dd>
            </div>
          </dl>
        </section>

        <GoogleBusinessPanel />

        <div className="flex flex-wrap gap-3">
          <Link href="/" className="premium-link-pill ui-focus inline-flex">
            Ver catálogo de autos usados
          </Link>
          <Link href="/dejar-resena" className="premium-link-pill ui-focus inline-flex">
            Dejar reseña
          </Link>
        </div>
      </main>
    </>
  );
}
