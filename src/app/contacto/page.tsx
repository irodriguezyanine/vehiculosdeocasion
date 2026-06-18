import type { Metadata } from "next";
import Link from "next/link";
import { ContactLeadForm } from "@/components/contact-lead-form";
import { SiteHeader } from "@/components/site-header";
import { StructuredData } from "@/components/structured-data";
import { buildOrganizationJsonLd, buildWebPageJsonLd } from "@/lib/seo/json-ld";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { BUSINESS, SITE_NAME } from "@/lib/seo/site-config";
import { CONTACT_CHANNELS } from "@/lib/site-content";

export const metadata: Metadata = buildPageMetadata({
  path: "contacto",
  title: `Contacto | ${SITE_NAME} — WhatsApp y asesoría comercial`,
  description:
    "Contacta a Vehículos de Ocasión por WhatsApp, correo o formulario. Automotora en Américo Vespucio 288, Santiago — VEDISA REMATES.",
  keywords: [
    "contacto vehiculos de ocasion",
    "whatsapp automotora santiago",
    "asesoria autos usados chile",
  ],
});

export default function ContactoPage() {
  return (
    <>
      <StructuredData
        data={[
          buildOrganizationJsonLd(),
          buildWebPageJsonLd({
            path: "contacto",
            title: `Contacto — ${SITE_NAME}`,
            description: "Contacto comercial de Vehículos de Ocasión.",
          }),
        ]}
      />
      <main className="premium-bg min-h-screen overflow-x-hidden text-[#18181b]">
        <SiteHeader />
        <div className="relative z-10 mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <header className="section-shell mb-8">
            <p className="premium-kicker">Atención comercial</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900 sm:text-4xl">Contacto</h1>
            <p className="mt-4 max-w-2xl text-base text-slate-700">
              Escríbenos por WhatsApp, completa el formulario o contáctanos por correo. Te respondemos en horario
              comercial para ayudarte con reservas, revisiones y compra de tu próximo vehículo.
            </p>
          </header>

          <section className="mb-8 grid gap-6 lg:grid-cols-2">
            <div className="section-shell">
              <p className="premium-kicker">Canales directos</p>
              <h2 className="text-2xl font-bold text-slate-900">Hablemos hoy</h2>
              <dl className="mt-4 space-y-4 text-sm text-slate-700">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-cyan-900">WhatsApp</dt>
                  <dd className="mt-1">
                    <a href={CONTACT_CHANNELS.whatsappUrl} target="_blank" rel="noreferrer" className="font-semibold text-cyan-800 underline">
                      {CONTACT_CHANNELS.phone}
                    </a>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-cyan-900">Correo comercial</dt>
                  <dd className="mt-1">
                    <a href={`mailto:${CONTACT_CHANNELS.email}`} className="font-semibold text-cyan-800 underline">
                      {CONTACT_CHANNELS.email}
                    </a>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-cyan-900">Instagram</dt>
                  <dd className="mt-1">
                    <a href={CONTACT_CHANNELS.instagramUrl} target="_blank" rel="noreferrer" className="font-semibold text-cyan-800 underline">
                      {CONTACT_CHANNELS.instagramHandle}
                    </a>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-cyan-900">Dirección</dt>
                  <dd className="mt-1 font-semibold text-slate-900">{CONTACT_CHANNELS.address}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-cyan-900">Horario</dt>
                  <dd className="mt-1">{CONTACT_CHANNELS.openingHours}</dd>
                </div>
              </dl>
              <a
                href={CONTACT_CHANNELS.whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="premium-btn-primary ui-focus mt-6 inline-flex"
              >
                Escribir por WhatsApp
              </a>
            </div>

            <div className="section-shell">
              <p className="premium-kicker">{BUSINESS.parentOrganization}</p>
              <h2 className="text-2xl font-bold text-slate-900">Ubicación</h2>
              <p className="mt-3 text-sm text-slate-700">
                Visítanos en {BUSINESS.address.street}, {BUSINESS.address.locality},{" "}
                {BUSINESS.address.region}. Coordinamos revisiones presenciales y apoyo comercial para compradores
                de todo Chile.
              </p>
              <p className="mt-4 text-sm text-slate-600">
                También puedes revisar el catálogo online con fotos, ficha técnica y visor 3D cuando esté disponible.
              </p>
              <Link href="/#catalogo" className="premium-link-pill ui-focus mt-6 inline-flex">
                Ver catálogo disponible
              </Link>
            </div>
          </section>

          <ContactLeadForm />

          <p className="mt-10 text-center text-sm text-slate-600">
            <Link href="/nosotros" className="text-cyan-800 hover:underline">
              Conoce más sobre nosotros
            </Link>
            {" · "}
            <Link href="/" className="text-cyan-800 hover:underline">
              Volver al inicio
            </Link>
          </p>
        </div>
      </main>
    </>
  );
}
