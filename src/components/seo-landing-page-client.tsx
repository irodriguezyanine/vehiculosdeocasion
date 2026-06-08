"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import {
  buildPriceLabelMap,
  getVehicleImage,
  getVehicleKey,
  getVehicleMileage,
  getVisibleCatalogItems,
} from "@/lib/catalog-visibility";
import { GOOGLE_PRIORITY_SLUGS } from "@/lib/seo/google-seo";
import { getLandingPageBySlug, type SeoLandingPage } from "@/lib/seo/landing-pages";
import { BUSINESS, SITE_NAME } from "@/lib/seo/site-config";
import type { CatalogFeed } from "@/types/catalog";
import type { EditorConfig } from "@/types/editor";

type SeoLandingPageClientProps = {
  page: SeoLandingPage;
  feed: CatalogFeed;
  config: EditorConfig;
};

export function SeoLandingPageClient({ page, feed, config }: SeoLandingPageClientProps) {
  const carouselRef = useRef<HTMLDivElement>(null);
  const visibleItems = getVisibleCatalogItems(feed.items, config);
  const priceLabels = buildPriceLabelMap(config);
  const [scrollIndex, setScrollIndex] = useState(0);

  const scrollCarousel = useCallback((direction: "prev" | "next") => {
    const node = carouselRef.current;
    if (!node) return;
    const card = node.querySelector<HTMLElement>("[data-seo-carousel-card]");
    const step = card ? card.offsetWidth + 16 : 320;
    node.scrollBy({ left: direction === "next" ? step : -step, behavior: "smooth" });
  }, []);

  const handleScroll = useCallback(() => {
    const node = carouselRef.current;
    if (!node) return;
    const card = node.querySelector<HTMLElement>("[data-seo-carousel-card]");
    const step = card ? card.offsetWidth + 16 : 320;
    setScrollIndex(Math.round(node.scrollLeft / step));
  }, []);

  return (
    <div className="seo-landing-page min-h-screen bg-[var(--background)] text-[var(--brand-text)]">
      <header className="top-nav-shell sticky top-0 z-30 border-b border-[var(--brand-border)] bg-[#f6efe8]/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/" className="inline-flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/vehiculos-ocasion-logo.png"
              alt={`Logo ${SITE_NAME}`}
              width={64}
              height={64}
              className="h-14 w-14 rounded-full object-cover"
            />
            <span className="brand-wordmark hidden text-lg text-[#4d2f1d] sm:inline-block">
              Vehículos de Ocasión
            </span>
          </Link>
          <Link href="/" className="premium-link-pill ui-focus text-sm font-medium">
            Ver catálogo completo
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <nav aria-label="Breadcrumb" className="mb-4 text-sm text-neutral-500">
          <Link href="/" className="hover:text-[#8a542f]">
            Inicio
          </Link>
          <span aria-hidden="true"> / </span>
          <span>{page.h1}</span>
        </nav>

        <section className="mb-8 rounded-2xl border border-[var(--brand-border)] bg-white/80 p-5 shadow-sm sm:p-6">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#8a542f]">{SITE_NAME}</p>
          <h1 className="mb-3 text-2xl font-bold text-neutral-900 sm:text-3xl">{page.h1}</h1>
          <p className="mb-4 max-w-3xl text-base leading-relaxed text-neutral-700">{page.intro}</p>
          <div className="flex flex-wrap gap-2">
            {page.keywords.map((keyword) => (
              <span
                key={keyword}
                className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs text-neutral-700"
              >
                {keyword}
              </span>
            ))}
          </div>
        </section>

        <section aria-labelledby="seo-carousel-heading" className="mb-8">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="seo-carousel-heading" className="text-xl font-semibold text-neutral-900 sm:text-2xl">
                Vehículos disponibles ahora
              </h2>
              <p className="mt-1 text-sm text-neutral-600">
                {visibleItems.length} unidad{visibleItems.length === 1 ? "" : "es"} en stock — desliza o usa las flechas
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => scrollCarousel("prev")}
                className="seo-carousel-nav ui-focus"
                aria-label="Anterior"
              >
                ‹
              </button>
              <span className="min-w-16 text-center text-sm text-neutral-600">
                {visibleItems.length > 0 ? `${Math.min(scrollIndex + 1, visibleItems.length)} / ${visibleItems.length}` : "0 / 0"}
              </span>
              <button
                type="button"
                onClick={() => scrollCarousel("next")}
                className="seo-carousel-nav ui-focus"
                aria-label="Siguiente"
              >
                ›
              </button>
            </div>
          </div>

          {visibleItems.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--brand-border)] bg-white/70 p-8 text-center">
              <p className="mb-4 text-neutral-700">No hay vehículos visibles en este momento.</p>
              <Link href="/" className="premium-link-pill ui-focus inline-flex">
                Ir al catálogo principal
              </Link>
            </div>
          ) : (
            <div
              ref={carouselRef}
              onScroll={handleScroll}
              className="seo-vehicle-carousel -mx-1 flex gap-4 overflow-x-auto px-1 pb-2 scroll-smooth"
            >
              {visibleItems.map((item) => {
                const key = getVehicleKey(item);
                const image = getVehicleImage(item);
                const price = priceLabels[key];
                const mileage = getVehicleMileage(item);
                const detailHref = `/?vehiculo=${encodeURIComponent(key)}`;

                return (
                  <article
                    key={key}
                    data-seo-carousel-card
                    className="seo-carousel-card shrink-0"
                  >
                    <div className="seo-carousel-card-image relative overflow-hidden bg-neutral-100">
                      {image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={image} alt={item.title} className="h-full w-full object-cover" loading="lazy" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-sm text-neutral-500">
                          Sin foto
                        </div>
                      )}
                    </div>
                    <div className="flex flex-1 flex-col p-4">
                      <h3 className="line-clamp-2 text-base font-semibold text-neutral-900">{item.title}</h3>
                      {item.subtitle ? (
                        <p className="mt-1 line-clamp-2 text-sm text-neutral-600">{item.subtitle}</p>
                      ) : null}
                      <dl className="mt-3 space-y-1 text-sm text-neutral-700">
                        <div className="flex justify-between gap-2">
                          <dt className="text-neutral-500">Patente</dt>
                          <dd className="font-medium">{key}</dd>
                        </div>
                        {mileage ? (
                          <div className="flex justify-between gap-2">
                            <dt className="text-neutral-500">Km</dt>
                            <dd className="font-medium">{mileage}</dd>
                          </div>
                        ) : null}
                        <div className="flex justify-between gap-2">
                          <dt className="text-neutral-500">Precio</dt>
                          <dd className="font-semibold text-[#8a542f]">{price ?? "Consultar"}</dd>
                        </div>
                      </dl>
                      <div className="mt-auto flex flex-col gap-2 pt-4">
                        <Link href={detailHref} className="seo-carousel-cta-primary ui-focus">
                          Ampliar en catálogo
                        </Link>
                        <Link href="/" className="seo-carousel-cta-secondary ui-focus">
                          Ir al home
                        </Link>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          <p className="mobile-scroll-hint mt-2 md:hidden">Desliza horizontalmente para ver más vehículos</p>
        </section>

        <section className="mb-8 rounded-2xl bg-[#8a542f] p-6 text-white">
          <h2 className="mb-2 text-xl font-semibold">¿Quieres el catálogo completo con búsqueda y visor 3D?</h2>
          <p className="mb-4 opacity-95">
            En el home puedes filtrar por marca, patente, comparar precios y contactar por WhatsApp al {BUSINESS.phone}.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/" className="inline-flex rounded-lg bg-white px-4 py-2 font-medium text-[#8a542f] transition hover:bg-neutral-100">
              Abrir catálogo completo
            </Link>
            <a
              href={`https://wa.me/${BUSINESS.whatsapp.replace(/\D/g, "")}`}
              className="inline-flex rounded-lg border border-white/70 px-4 py-2 font-medium text-white transition hover:bg-white/10"
              rel="noopener noreferrer"
              target="_blank"
            >
              WhatsApp
            </a>
          </div>
        </section>

        {page.faqs[0] ? (
          <section aria-labelledby="landing-faq" className="mb-8">
            <h2 id="landing-faq" className="mb-3 text-lg font-semibold text-neutral-900">
              Pregunta frecuente
            </h2>
            <details className="rounded-xl border border-neutral-200 bg-white/80 p-4">
              <summary className="cursor-pointer font-medium text-neutral-900">{page.faqs[0].question}</summary>
              <p className="mt-3 text-neutral-700">{page.faqs[0].answer}</p>
            </details>
          </section>
        ) : null}

        <section aria-labelledby="related-seo-pages" className="mb-6">
          <h2 id="related-seo-pages" className="mb-3 text-lg font-semibold text-neutral-900">
            Más búsquedas de autos usados en Chile
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {GOOGLE_PRIORITY_SLUGS.filter((slug) => slug !== page.slug)
              .slice(0, 9)
              .map((slug) => {
                const related = getLandingPageBySlug(slug);
                if (!related) return null;
                return (
                  <li key={slug}>
                    <Link href={`/${slug}`} className="text-[#8a542f] hover:underline">
                      {related.h1}
                    </Link>
                  </li>
                );
              })}
          </ul>
        </section>
      </main>
    </div>
  );
}
