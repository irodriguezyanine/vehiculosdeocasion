"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  buildMapEmbedUrl,
  buildMapExternalUrl,
  CONTACT_CHANNELS,
  FOOTER_DISCLAIMER,
  FOOTER_HOURS,
  SITE_LOCATIONS,
  SITE_NAV_LINKS,
  type SiteLocation,
} from "@/lib/site-content";
import { SITE_LEGAL_NAME, SITE_NAME } from "@/lib/seo/site-config";

function MapModal({ location, onClose }: { location: SiteLocation; onClose: () => void }) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[76] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Mapa — ${location.label}`}
        className="site-map-modal w-full max-w-3xl overflow-hidden rounded-2xl border border-cyan-200/40 bg-[#fffaf5] shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-cyan-200/60 bg-[#f8efe4] px-4 py-3 sm:px-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-cyan-900">{location.label}</p>
            <p className="mt-0.5 text-sm font-semibold text-[#0f172a]">{location.addressLine}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ui-focus inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-cyan-200/70 bg-white text-[#5c3a22] transition hover:bg-cyan-50"
            aria-label="Cerrar mapa"
          >
            ×
          </button>
        </div>
        <div className="relative aspect-[16/10] w-full bg-slate-200">
          <iframe
            title={`Mapa de ${location.label}`}
            src={buildMapEmbedUrl(location.mapsQuery)}
            className="absolute inset-0 h-full w-full border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-cyan-200/60 px-4 py-3 sm:px-5">
          <p className="text-xs text-slate-600">Haz clic en la dirección para volver a abrir el mapa cuando lo necesites.</p>
          <a
            href={buildMapExternalUrl(location.mapsQuery)}
            target="_blank"
            rel="noopener noreferrer"
            className="ui-focus rounded-full bg-cyan-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-cyan-500"
          >
            Abrir en Google Maps
          </a>
        </div>
      </div>
    </div>
  );
}

function FooterClock() {
  const [label, setLabel] = useState("");

  useEffect(() => {
    const format = () =>
      new Intl.DateTimeFormat("es-CL", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date());

    setLabel(format());
    const timer = window.setInterval(() => setLabel(format()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <p className="site-footer-clock text-sm font-medium capitalize text-cyan-900" suppressHydrationWarning>
      {label || "Actualizando hora…"}
    </p>
  );
}

export function SiteFooter() {
  const [mapLocation, setMapLocation] = useState<SiteLocation | null>(null);
  const year = new Date().getFullYear();

  return (
    <>
      <footer className="site-footer relative z-10 mt-auto border-t border-cyan-200/70 bg-[#e0f2fe] text-[#0f172a]">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="site-footer-disclaimer rounded-xl border border-[#c9b29a] bg-[#f8fafc] px-4 py-4 text-center text-sm leading-relaxed text-[#4a3428] sm:px-6">
            {FOOTER_DISCLAIMER}
          </div>

          <div className="mt-6 flex flex-col gap-4 border-b border-cyan-200/60 pb-6 sm:flex-row sm:items-center sm:justify-between">
            <FooterClock />
            <nav className="flex flex-wrap gap-x-4 gap-y-2 text-sm" aria-label="Enlaces legales y utilidades">
              <Link href="/contacto" className="site-footer-link ui-focus">
                Ayuda
              </Link>
              <a
                href="https://www.vedisaremates.cl"
                target="_blank"
                rel="noopener noreferrer"
                className="site-footer-link ui-focus"
              >
                Términos y condiciones
              </a>
              <a
                href="https://www.vedisaremates.cl"
                target="_blank"
                rel="noopener noreferrer"
                className="site-footer-link ui-focus"
              >
                Política de privacidad
              </a>
              <Link href="/sitemap.xml" className="site-footer-link ui-focus">
                Mapa del sitio
              </Link>
            </nav>
          </div>

          <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)_minmax(0,1fr)]">
            <div>
              <div className="flex items-center gap-3">
                <Image
                  src="/vehiculos-de-ocasion-logo.png"
                  alt=""
                  width={180}
                  height={48}
                  className="h-10 w-auto max-w-[180px] object-contain"
                  aria-hidden="true"
                />
                <div>
                  <p className="text-base font-bold text-[#0f172a]">{SITE_NAME}</p>
                  <p className="text-xs font-semibold uppercase tracking-wide text-cyan-900">VEDISA REMATES</p>
                </div>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-slate-700">
                Automotora de vehículos seminuevos con catálogo online, asesoría comercial y revisión presencial
                coordinada en nuestros recintos.
              </p>
              <nav className="mt-4 flex flex-wrap gap-2" aria-label="Navegación del sitio">
                {SITE_NAV_LINKS.map((link) => (
                  <Link key={link.href} href={link.href} className="premium-link-pill ui-focus text-xs">
                    {link.label}
                  </Link>
                ))}
              </nav>
            </div>

            <div className="space-y-4">
              {SITE_LOCATIONS.map((location) => (
                <div key={location.id} className="site-footer-location rounded-xl border border-cyan-200/70 bg-white/80 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-cyan-900">{location.label}</p>
                  <button
                    type="button"
                    onClick={() => setMapLocation(location)}
                    className="ui-focus mt-1 inline-flex items-start gap-2 text-left text-sm font-semibold text-[#164e63] underline decoration-amber-400/70 underline-offset-2 transition hover:text-cyan-800"
                  >
                    <span aria-hidden="true" className="mt-0.5 text-base">📍</span>
                    <span>{location.addressLine}</span>
                  </button>
                  <p className="mt-2 text-xs text-slate-600">Ver mapa interactivo</p>
                </div>
              ))}
            </div>

            <div className="site-footer-contact rounded-xl border border-cyan-200/70 bg-white/80 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-cyan-900">Contacto comercial</p>
              <ul className="mt-3 space-y-3 text-sm text-slate-700">
                <li>
                  <span className="font-semibold text-[#0f172a]">WhatsApp:</span>
                  {" "}
                  <a href={CONTACT_CHANNELS.whatsappUrl} target="_blank" rel="noreferrer" className="site-footer-link ui-focus">
                    {CONTACT_CHANNELS.phone}
                  </a>
                </li>
                <li>
                  <span className="font-semibold text-[#0f172a]">Correo:</span>
                  {" "}
                  <a href={`mailto:${CONTACT_CHANNELS.email}`} className="site-footer-link ui-focus">
                    {CONTACT_CHANNELS.email}
                  </a>
                </li>
                <li>
                  <span className="font-semibold text-[#0f172a]">Instagram:</span>
                  {" "}
                  <a href={CONTACT_CHANNELS.instagramUrl} target="_blank" rel="noreferrer" className="site-footer-link ui-focus">
                    {CONTACT_CHANNELS.instagramHandle}
                  </a>
                </li>
                <li>
                  <span className="font-semibold text-[#0f172a]">Horario:</span>
                  {" "}
                  {FOOTER_HOURS}
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="border-t border-[#3d2818]/20 bg-[#0f172a] px-4 py-4 text-center text-xs leading-relaxed text-stone-300 sm:px-6">
          <p>
            © Copyright {year} {SITE_LEGAL_NAME}. All Rights Reserved.
          </p>
          <p className="mt-1 opacity-90">
            Ninguna parte de esta página web puede reproducirse de ninguna manera sin el permiso previo por escrito
            de VEDISA REMATES.
          </p>
        </div>
      </footer>

      {mapLocation ? <MapModal location={mapLocation} onClose={() => setMapLocation(null)} /> : null}
    </>
  );
}
