import Link from "next/link";
import type { SeoLandingPage } from "@/lib/seo/landing-pages";
import { SEO_LANDING_PAGES } from "@/lib/seo/landing-pages";
import { BUSINESS, SITE_NAME } from "@/lib/seo/site-config";

type SeoLandingPageViewProps = {
  page: SeoLandingPage;
};

export function SeoLandingPageView({ page }: SeoLandingPageViewProps) {
  const related = SEO_LANDING_PAGES.filter((entry) => entry.slug !== page.slug).slice(0, 8);

  return (
    <main className="seo-landing mx-auto min-h-screen w-full max-w-3xl px-4 py-10 text-neutral-800">
      <nav aria-label="Breadcrumb" className="mb-6 text-sm text-neutral-500">
        <Link href="/" className="hover:text-[#8a542f]">
          Inicio
        </Link>
        <span aria-hidden="true"> / </span>
        <span className="text-neutral-700">{page.h1}</span>
      </nav>

      <article>
        <header className="mb-8">
          <p className="mb-2 text-sm font-medium uppercase tracking-wide text-[#8a542f]">{SITE_NAME}</p>
          <h1 className="mb-4 text-3xl font-bold text-neutral-900">{page.h1}</h1>
          <p className="text-lg leading-relaxed text-neutral-700">{page.intro}</p>
        </header>

        <section aria-labelledby="landing-keywords" className="mb-8 rounded-xl border border-neutral-200 bg-white/80 p-5">
          <h2 id="landing-keywords" className="mb-3 text-lg font-semibold text-neutral-900">
            Búsquedas relacionadas
          </h2>
          <ul className="flex flex-wrap gap-2">
            {page.keywords.map((keyword) => (
              <li
                key={keyword}
                className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs text-neutral-700"
              >
                {keyword}
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="landing-faq" className="mb-8">
          <h2 id="landing-faq" className="mb-4 text-lg font-semibold text-neutral-900">
            Preguntas frecuentes
          </h2>
          <div className="space-y-3">
            {page.faqs.map((faq) => (
              <details key={faq.question} className="rounded-xl border border-neutral-200 bg-white/80 p-4">
                <summary className="cursor-pointer font-medium text-neutral-900">{faq.question}</summary>
                <p className="mt-3 text-neutral-700">{faq.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="mb-10 rounded-2xl bg-[#8a542f] p-6 text-white">
          <h2 className="mb-2 text-xl font-semibold">{page.ctaLabel}</h2>
          <p className="mb-4 opacity-95">
            Revisa stock actualizado, compara precios y contacta por WhatsApp al {BUSINESS.phone}.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/"
              className="inline-flex rounded-lg bg-white px-4 py-2 font-medium text-[#8a542f] transition hover:bg-neutral-100"
            >
              Ir al catálogo
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

        <section aria-labelledby="related-topics">
          <h2 id="related-topics" className="mb-3 text-lg font-semibold text-neutral-900">
            También te puede interesar
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {related.map((entry) => (
              <li key={entry.slug}>
                <Link href={`/${entry.slug}`} className="text-[#8a542f] hover:underline">
                  {entry.h1}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </article>
    </main>
  );
}
