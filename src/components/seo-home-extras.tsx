import Link from "next/link";
import { GLOBAL_USED_CAR_FAQS } from "@/lib/seo/faq-library";
import { SEO_LANDING_PAGES } from "@/lib/seo/landing-pages";
import { BUSINESS, SITE_NAME, SITE_TAGLINE } from "@/lib/seo/site-config";

export function SeoHomeExtras() {
  const featuredLandings = SEO_LANDING_PAGES.slice(0, 12);

  return (
    <aside className="seo-home-extras mx-auto w-full max-w-6xl px-4 pb-16 pt-8 text-sm leading-relaxed text-neutral-700">
      <section aria-labelledby="seo-about-heading" className="mb-10 rounded-2xl border border-neutral-200 bg-white/80 p-6 shadow-sm">
        <h2 id="seo-about-heading" className="mb-3 text-xl font-semibold text-neutral-900">
          {SITE_NAME} — autos usados y seminuevos en Chile
        </h2>
        <p className="mb-3">
          {SITE_TAGLINE}. Si buscas <strong>comprar auto usado en Chile</strong>,{" "}
          <strong>autos usados baratos</strong>, <strong>automotora en Santiago</strong> o{" "}
          <strong>vehículos seminuevos VEDISA REMATES</strong>, este es el catálogo oficial con precios
          visibles, fotos por unidad y contacto WhatsApp directo.
        </p>
        <p>
          Ubicación: {BUSINESS.address.street}, {BUSINESS.address.locality}. Teléfono:{" "}
          <a href={`tel:${BUSINESS.whatsapp}`} className="text-[#8a542f] underline-offset-2 hover:underline">
            {BUSINESS.phone}
          </a>
          .
        </p>
      </section>

      <section aria-labelledby="seo-faq-heading" className="mb-10">
        <h2 id="seo-faq-heading" className="mb-4 text-xl font-semibold text-neutral-900">
          Preguntas frecuentes sobre autos usados en Chile
        </h2>
        <div className="space-y-3">
          {GLOBAL_USED_CAR_FAQS.map((faq) => (
            <details
              key={faq.question}
              className="group rounded-xl border border-neutral-200 bg-white/80 p-4 open:shadow-sm"
            >
              <summary className="cursor-pointer list-none font-medium text-neutral-900 marker:content-none [&::-webkit-details-marker]:hidden">
                {faq.question}
              </summary>
              <p className="mt-3 text-neutral-700">{faq.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section aria-labelledby="seo-topics-heading" className="mb-6">
        <h2 id="seo-topics-heading" className="mb-4 text-xl font-semibold text-neutral-900">
          Guías para comprar auto usado en Chile
        </h2>
        <nav aria-label="Temas de autos usados">
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {featuredLandings.map((page) => (
              <li key={page.slug}>
                <Link
                  href={`/${page.slug}`}
                  className="block rounded-lg border border-neutral-200 bg-white/70 px-3 py-2 text-[#8a542f] transition hover:border-[#8a542f]/40 hover:bg-white"
                >
                  {page.h1}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </section>
    </aside>
  );
}
