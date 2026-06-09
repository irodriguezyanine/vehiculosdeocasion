import type { Metadata } from "next";
import Link from "next/link";
import { AboutTrustSections } from "@/components/about-trust-sections";
import { SiteHeader } from "@/components/site-header";
import { StructuredData } from "@/components/structured-data";
import { buildOrganizationJsonLd, buildWebPageJsonLd } from "@/lib/seo/json-ld";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { BUSINESS, SITE_NAME } from "@/lib/seo/site-config";
import { ABOUT_HIGHLIGHTS, ABOUT_INTRO, CONTACT_CHANNELS } from "@/lib/site-content";

export const metadata: Metadata = buildPageMetadata({
  path: "nosotros",
  title: `Nosotros | ${SITE_NAME} — Automotora VEDISA REMATES`,
  description:
    "Conoce Vehículos de Ocasión: más de 40 años de experiencia en vehículos seminuevos, precios competitivos y respaldo de VEDISA REMATES en Chile.",
  keywords: [
    "nosotros vehiculos de ocasion",
    "automotora vedisa remates",
    "autos seminuevos chile",
    "experiencia automotora santiago",
  ],
});

export default function NosotrosPage() {
  return (
    <>
      <StructuredData
        data={[
          buildOrganizationJsonLd(),
          buildWebPageJsonLd({
            path: "nosotros",
            title: `Nosotros — ${SITE_NAME}`,
            description: ABOUT_INTRO,
          }),
        ]}
      />
      <main className="premium-bg min-h-screen overflow-x-hidden text-[#2d2118]">
        <SiteHeader />
        <div className="relative z-10 mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <header className="section-shell mb-8">
            <p className="premium-kicker">VEDISA REMATES · Automotora oficial</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900 sm:text-4xl">Nosotros</h1>
            <p className="mt-4 max-w-3xl text-base leading-relaxed text-slate-700">{ABOUT_INTRO}</p>
            <p className="mt-4 max-w-3xl text-base leading-relaxed text-slate-700">
              Con más de 40 años de trayectoria, somos expertos en la comercialización de vehículos seminuevos y
              usados. Nuestro equipo combina experiencia comercial, selección curada de unidades y acompañamiento
              directo para que compres con información clara y respaldo profesional.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/#catalogo" className="premium-btn-primary ui-focus">
                Ver vehículos disponibles
              </Link>
              <Link href="/contacto" className="premium-link-pill ui-focus">
                Contactar al equipo
              </Link>
            </div>
          </header>

          <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {ABOUT_HIGHLIGHTS.map((item) => (
              <article key={item.title} className="rounded-xl border border-slate-200 bg-white/90 p-5">
                <h2 className="text-base font-semibold text-slate-900">{item.title}</h2>
                <p className="mt-2 text-sm text-slate-600">{item.text}</p>
              </article>
            ))}
          </section>

          <section className="section-shell mb-8">
            <p className="premium-kicker">Nuestra propuesta</p>
            <h2 className="text-2xl font-bold text-slate-900">Automotora especializada en valor real</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <p className="text-sm leading-relaxed text-slate-700">
                En {SITE_NAME} publicamos un catálogo actualizado con fotos, ficha técnica y visor GLO3D en las
                unidades que lo permiten. Priorizamos transparencia comercial, precios visibles y contacto directo
                por WhatsApp para resolver dudas en el momento.
              </p>
              <p className="text-sm leading-relaxed text-slate-700">
                Formamos parte del ecosistema de {BUSINESS.parentOrganization}, lo que nos permite ofrecer un flujo
                comercial sólido: revisión de unidades, reserva, gestión documental y cierre con acompañamiento
                personalizado en {BUSINESS.address.locality}.
              </p>
            </div>
          </section>

          <AboutTrustSections />

          <p className="mt-10 text-center text-sm text-slate-600">
            <Link href="/" className="text-amber-800 hover:underline">
              ← Volver al catálogo
            </Link>
            {" · "}
            <a href={CONTACT_CHANNELS.whatsappUrl} target="_blank" rel="noreferrer" className="text-amber-800 hover:underline">
              WhatsApp {CONTACT_CHANNELS.phone}
            </a>
          </p>
        </div>
      </main>
    </>
  );
}
