import { GoogleBusinessPanel } from "@/components/google-business-panel";
import Link from "next/link";
import { CHILE_CITY_SEO_TARGETS } from "@/lib/seo/chile-pages";
import { GLOBAL_USED_CAR_FAQS } from "@/lib/seo/faq-library";
import { SEO_LANDING_PAGES } from "@/lib/seo/landing-pages";
import { BUSINESS, SITE_NAME, SITE_TAGLINE } from "@/lib/seo/site-config";

const INTENT_GROUPS = [
  {
    title: "Poco km y buen estado",
    slugs: [
      "autos-usados-poco-kilometraje-chile",
      "autos-usados-buen-estado-chile",
      "seminuevos-poco-km-chile",
      "auto-usado-barato-buen-estado",
      "autos-usados-bajo-30-mil-km",
    ],
  },
  {
    title: "Baratos y calidad-precio",
    slugs: [
      "comprar-auto-barato",
      "autos-usados-calidad-precio-chile",
      "auto-seminuevo-barato-chile",
      "autos-usados-premium-baratos",
      "vehiculos-seminuevos-baratos-chile",
    ],
  },
  {
    title: "Buenas marcas",
    slugs: [
      "autos-usados-buenas-marcas-chile",
      "autos-usados-toyota-poco-km",
      "autos-usados-hyundai-poco-km",
      "comprar-toyota-usado-chile",
      "comprar-hyundai-usado-chile",
    ],
  },
  {
    title: "SUVs y camionetas",
    slugs: [
      "comprar-suv-usado-poco-km",
      "comprar-camioneta-usada-poco-km",
      "comprar-suv-usado",
      "comprar-camioneta-usada",
      "comprar-pickup-usada-chile",
    ],
  },
] as const;

function landingsBySlugs(slugs: readonly string[]) {
  return slugs
    .map((slug) => SEO_LANDING_PAGES.find((page) => page.slug === slug))
    .filter((page): page is (typeof SEO_LANDING_PAGES)[number] => Boolean(page));
}

export function SeoHomeExtras() {
  return (
    <aside className="seo-home-extras mx-auto w-full max-w-6xl px-4 pb-16 pt-8 text-sm leading-relaxed text-neutral-700">
      <section aria-labelledby="seo-about-heading" className="mb-10 rounded-2xl border border-neutral-200 bg-white/80 p-6 shadow-sm">
        <h2 id="seo-about-heading" className="mb-3 text-xl font-semibold text-neutral-900">
          {SITE_NAME} — autos usados en buen estado, poco km y buenas marcas en Chile
        </h2>
        <p className="mb-3">
          {SITE_TAGLINE}. Si buscas <strong>comprar auto usado con poco kilometraje</strong>,{" "}
          <strong>vehículo usado en buen estado</strong>, <strong>buenas marcas a buen precio</strong> o{" "}
          <strong>seminuevos baratos en Chile</strong>, este es el catálogo oficial de VEDISA REMATES con
          precios visibles, fotos por unidad, visor 3D y WhatsApp directo.
        </p>
        <p className="mb-3">
          Marcas frecuentes: Toyota, Hyundai, Chevrolet, Nissan, Kia, Ford, Mazda, Volkswagen, Mitsubishi y Jeep
          según inventario. Stock seleccionado con enfoque en relación calidad-precio, muchas veces por debajo
          del promedio del mercado chileno.
        </p>
        <p>
          Ubicación: {BUSINESS.address.street}, {BUSINESS.address.locality}. Teléfono/WhatsApp:{" "}
          <a href={`tel:${BUSINESS.whatsapp}`} className="text-[#8a542f] underline-offset-2 hover:underline">
            {BUSINESS.phone}
          </a>
          .
        </p>
      </section>

      <section aria-labelledby="seo-intent-heading" className="mb-10">
        <h2 id="seo-intent-heading" className="mb-4 text-xl font-semibold text-neutral-900">
          Encuentra tu auto usado ideal en Chile
        </h2>
        <div className="grid gap-6 sm:grid-cols-2">
          {INTENT_GROUPS.map((group) => (
            <div key={group.title} className="rounded-xl border border-neutral-200 bg-white/80 p-4">
              <h3 className="mb-3 font-semibold text-neutral-900">{group.title}</h3>
              <ul className="space-y-2">
                {landingsBySlugs(group.slugs).map((page) => (
                  <li key={page.slug}>
                    <Link href={`/${page.slug}`} className="text-[#8a542f] hover:underline">
                      {page.h1}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <GoogleBusinessPanel />

      <section aria-labelledby="seo-cities-heading" className="mb-10">
        <h2 id="seo-cities-heading" className="mb-4 text-xl font-semibold text-neutral-900">
          Autos usados en tu ciudad — Chile
        </h2>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {CHILE_CITY_SEO_TARGETS.map((city) => (
            <li key={city.slug}>
              <Link href={`/${city.slug}`} className="text-[#8a542f] hover:underline">
                Autos usados {city.city}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="seo-faq-heading" className="mb-10">
        <h2 id="seo-faq-heading" className="mb-4 text-xl font-semibold text-neutral-900">
          Preguntas frecuentes — autos usados poco km, buen estado y baratos en Chile
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
          Todas las guías para comprar auto usado en Chile
        </h2>
        <nav aria-label="Temas de autos usados">
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {SEO_LANDING_PAGES.map((page) => (
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
