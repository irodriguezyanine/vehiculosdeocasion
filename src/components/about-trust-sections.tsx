import {
  COMMERCIAL_FAQS,
  CONTACT_CHANNELS,
  EXPERIENCE_TILES,
} from "@/lib/site-content";

export function AboutTrustSections() {
  return (
    <section className="grid gap-6 lg:grid-cols-2">
      <div className="section-shell">
        <p className="premium-kicker">Confianza Vehículos de Ocasión</p>
        <h2 className="text-2xl font-bold text-slate-900">Experiencia respaldada</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {EXPERIENCE_TILES.map(([title, text]) => (
            <div key={title} className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
              <p className="mt-1 text-sm text-slate-600">{text}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="section-shell">
        <p className="premium-kicker">Preguntas frecuentes</p>
        <h2 className="text-2xl font-bold text-slate-900">Resuelve dudas rápidas</h2>
        <div className="mt-4 space-y-2">
          {COMMERCIAL_FAQS.map(([question, answer]) => (
            <details key={question} className="rounded-lg border border-slate-200 bg-white p-3">
              <summary className="cursor-pointer py-1 text-sm font-semibold text-slate-900">{question}</summary>
              <p className="mt-2 text-sm text-slate-600">{answer}</p>
            </details>
          ))}
        </div>
        <div className="mt-4 rounded-lg border border-stone-300 bg-stone-100/70 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-cyan-900">Contacto comercial</p>
          <p className="mt-1 text-sm text-slate-700">
            <a href={`mailto:${CONTACT_CHANNELS.email}`} className="ui-focus text-cyan-800 underline">
              {CONTACT_CHANNELS.email}
            </a>
          </p>
          <p className="mt-1 text-sm text-slate-700">
            WhatsApp:
            {" "}
            <a
              href={CONTACT_CHANNELS.whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="ui-focus text-cyan-800 underline"
            >
              {CONTACT_CHANNELS.phone}
            </a>
            {" "}
            · Instagram:
            {" "}
            <a
              href={CONTACT_CHANNELS.instagramUrl}
              target="_blank"
              rel="noreferrer"
              className="ui-focus text-cyan-800 underline"
            >
              {CONTACT_CHANNELS.instagramHandle}
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}
