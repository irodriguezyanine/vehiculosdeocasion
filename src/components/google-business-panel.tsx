import Link from "next/link";
import {
  getGoogleBusinessConfig,
  GOOGLE_BUSINESS_DESCRIPTION,
  GOOGLE_BUSINESS_SETUP_CHECKLIST,
} from "@/lib/seo/google-business";
import {
  fillReviewTemplate,
  REVIEW_CAMPAIGN_TEMPLATES,
  REVIEW_CAMPAIGN_TIPS,
} from "@/lib/seo/review-campaign";
import { BUSINESS, SITE_NAME } from "@/lib/seo/site-config";

export function GoogleBusinessPanel() {
  const gbp = getGoogleBusinessConfig();

  return (
    <section
      aria-labelledby="google-business-heading"
      className="mb-10 rounded-2xl border border-[#33c7e3]/30 bg-gradient-to-br from-[#f0f9ff] to-white p-6 shadow-sm"
    >
      <h2 id="google-business-heading" className="mb-2 text-xl font-semibold text-neutral-900">
        Encuéntranos en Google Maps — {SITE_NAME}
      </h2>
      <p className="mb-4 text-sm leading-relaxed text-neutral-700">
        Automotora en <strong>{BUSINESS.address.street}, {BUSINESS.address.locality}</strong>. Atendemos compradores
        de autos usados y seminuevos en todo Chile. Teléfono/WhatsApp:{" "}
        <a href={`tel:${BUSINESS.whatsapp}`} className="text-[#33c7e3] hover:underline">
          {BUSINESS.phone}
        </a>
        .
      </p>

      <div className="mb-4 overflow-hidden rounded-xl border border-neutral-200">
        <iframe
          title={`Mapa ${SITE_NAME}`}
          src={gbp.mapsEmbedUrl}
          className="h-56 w-full border-0 sm:h-72"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <a
          href={gbp.mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="premium-link-pill ui-focus inline-flex"
        >
          Ver en Google Maps
        </a>
        <Link href="/dejar-resena" className="premium-link-pill ui-focus inline-flex border-[#33c7e3] bg-[#33c7e3] text-white">
          Dejar reseña en Google
        </Link>
        <a
          href={`https://wa.me/${BUSINESS.whatsapp.replace(/\D/g, "")}`}
          target="_blank"
          rel="noopener noreferrer"
          className="premium-link-pill ui-focus inline-flex"
        >
          WhatsApp
        </a>
      </div>

      <p className="mt-4 text-xs text-neutral-500">
        ¿Compraste con nosotros? Tu reseña en Google ayuda a que más personas encuentren autos usados de confianza
        en Chile.{" "}
        <Link href="/dejar-resena" className="text-[#33c7e3] hover:underline">
          Dejar reseña →
        </Link>
      </p>
    </section>
  );
}

export function GoogleBusinessSetupGuide() {
  return (
    <section className="mb-8 rounded-xl border border-neutral-200 bg-white/80 p-5 text-sm text-neutral-700">
      <h2 className="mb-3 text-lg font-semibold text-neutral-900">Checklist Google Business Profile</h2>
      <p className="mb-3">{GOOGLE_BUSINESS_DESCRIPTION}</p>
      <ul className="list-disc space-y-1 pl-5">
        {GOOGLE_BUSINESS_SETUP_CHECKLIST.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

type ReviewTemplatesProps = {
  reviewUrl: string;
};

export function ReviewCampaignTemplates({ reviewUrl }: ReviewTemplatesProps) {
  return (
    <section aria-labelledby="review-templates-heading" className="mb-8">
      <h2 id="review-templates-heading" className="mb-4 text-lg font-semibold text-neutral-900">
        Plantillas para pedir reseñas (equipo comercial)
      </h2>
      <div className="space-y-4">
        {REVIEW_CAMPAIGN_TEMPLATES.map((template) => (
          <article key={template.id} className="rounded-xl border border-neutral-200 bg-white/80 p-4">
            <h3 className="mb-2 font-medium text-neutral-900">{template.title}</h3>
            <pre className="whitespace-pre-wrap rounded-lg bg-neutral-50 p-3 text-xs leading-relaxed text-neutral-700">
              {fillReviewTemplate(template.message, reviewUrl)}
            </pre>
          </article>
        ))}
      </div>
      <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-neutral-600">
        {REVIEW_CAMPAIGN_TIPS.map((tip) => (
          <li key={tip}>{tip}</li>
        ))}
      </ul>
    </section>
  );
}
