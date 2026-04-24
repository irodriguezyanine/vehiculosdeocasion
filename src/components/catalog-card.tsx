import { useEffect, useMemo, useState } from "react";
import type { CatalogItem } from "@/types/catalog";

type CatalogCardProps = {
  item: CatalogItem;
  priceLabel?: string | null;
  promoEnabled?: boolean;
  originalPriceLabel?: string | null;
  upcomingAuctionLabel?: string;
  density?: "compact" | "detailed";
  onOpen?: () => void;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  isCompared?: boolean;
  onToggleCompare?: () => void;
  onWhatsappClick?: () => void;
};

const WHATSAPP_BASE_URL = "https://api.whatsapp.com/send/?phone=5694550660";

function formatDate(date?: string): string {
  if (!date) return "";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;

  return parsed.toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function shortText(value?: string, max = 90): string | undefined {
  if (!value) return undefined;
  return value.length > max ? `${value.slice(0, max)}...` : value;
}

function isLikelyImageUrl(url?: string): boolean {
  if (!url || !url.startsWith("http")) return false;
  const normalized = url.toLowerCase();
  if (normalized.includes("glo3d.net/iframe") || normalized.includes("<iframe")) return false;
  if (/\.(jpg|jpeg|png|webp|gif|bmp|avif)(\?|$)/i.test(normalized)) return true;
  return /cdn\.|cloudfront|amazonaws|supabase|img|image|media/.test(normalized);
}

function getPatent(item: CatalogItem): string {
  const raw = item.raw as Record<string, unknown>;
  const value = [raw.patente, raw.PATENTE, raw.PPU, raw.stock_number].find(
    (entry) => typeof entry === "string" && entry.trim().length > 0,
  ) as string | undefined;
  return value?.trim().toUpperCase().replace(/\s+/g, "").replace(/-/g, "") ?? "S/PATENTE";
}

function getBrandModel(item: CatalogItem): string {
  const raw = item.raw as Record<string, unknown>;
  const brand = [raw.marca, raw.brand].find(
    (entry) => typeof entry === "string" && entry.trim().length > 0,
  ) as string | undefined;
  const model = [raw.modelo, raw.model, item.title].find(
    (entry) => typeof entry === "string" && entry.trim().length > 0,
  ) as string | undefined;
  return `${brand ?? ""} ${model ?? ""}`.trim() || item.title;
}

function getVehicleKey(item: CatalogItem): string {
  const raw = item.raw as Record<string, unknown>;
  const patent = [raw.patente, raw.PATENTE, raw.PPU, raw.stock_number].find(
    (entry) => typeof entry === "string" && entry.trim().length > 0,
  ) as string | undefined;
  if (patent) return patent.toUpperCase().replace(/\s+/g, "").replace(/-/g, "");
  return item.id;
}

function getVehicleCondition(item: CatalogItem): string | null {
  const raw = item.raw as Record<string, unknown>;
  const value = [
    raw.condicion,
    raw["condicion"],
    raw.condicion_vehiculo,
    raw.estado_vehiculo,
    raw.estado,
    raw.status,
  ].find((entry) => typeof entry === "string" && entry.trim().length > 0) as string | undefined;
  return value?.trim() ?? null;
}

function getConditionBadgeClasses(condition?: string | null): string {
  const sample = (condition ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
  if (!sample) return "bg-[#4f311f] text-amber-50";
  if (/100% operativo|operativo/.test(sample)) return "bg-emerald-600 text-white";
  if (/no arranca|desarme/.test(sample)) return "bg-rose-600 text-white";
  if (/problema|recuperado|robo/.test(sample)) return "bg-amber-500 text-white";
  return "bg-[#7a4724] text-amber-50";
}

export function CatalogCard({
  item,
  priceLabel,
  promoEnabled: promoEnabledOverride,
  originalPriceLabel: originalPriceLabelOverride,
  upcomingAuctionLabel,
  density = "detailed",
  onOpen,
  isFavorite,
  onToggleFavorite,
  isCompared,
  onToggleCompare,
  onWhatsappClick,
}: CatalogCardProps) {
  const raw = item.raw as Record<string, unknown>;
  const coverCandidate = item.thumbnail ?? item.images[0];
  const cover = isLikelyImageUrl(coverCandidate) ? (coverCandidate as string) : "/placeholder-car.svg";
  const [coverSrc, setCoverSrc] = useState(cover);
  const formattedDate = formatDate(item.auctionDate);
  const patent = getPatent(item);
  const brandModel = getBrandModel(item);
  const itemKey = getVehicleKey(item);
  const conditionLabel = getVehicleCondition(item);
  const promoEnabledFromRaw =
    raw.promo_enabled === true ||
    raw.promo_enabled === "true" ||
    raw.promo_enabled === "1" ||
    raw.promo_enabled === 1;
  const originalPriceLabelFromRaw =
    typeof raw.precio_normal === "string" && raw.precio_normal.trim()
      ? raw.precio_normal.trim()
      : typeof raw.original_price === "string" && raw.original_price.trim()
        ? raw.original_price.trim()
        : null;
  const promoEnabled = promoEnabledOverride ?? promoEnabledFromRaw;
  const originalPriceLabel = originalPriceLabelOverride ?? originalPriceLabelFromRaw;
  const [shareCopied, setShareCopied] = useState(false);
  const shareUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    const url = new URL(window.location.href);
    url.searchParams.set("vehiculo", itemKey);
    if (!url.hash) url.hash = "catalogo";
    return url.toString();
  }, [itemKey]);
  const whatsappText = `Hola, estoy interesado en ofertar por el vehiculo ${patent} ${brandModel}`;
  const whatsappUrl = `${WHATSAPP_BASE_URL}&text=${encodeURIComponent(
    `${whatsappText}${shareUrl ? `. Link: ${shareUrl}` : ""}`,
  )}&type=phone_number&app_absent=0`;
  const isCompact = density === "compact";

  useEffect(() => {
    setCoverSrc(cover);
  }, [cover]);

  return (
    <article className="group glass-soft vehicle-card flex h-full w-full flex-col overflow-hidden rounded-2xl text-left shadow-md transition duration-300 hover:-translate-y-1 hover:border-amber-300 hover:shadow-xl">
      <button type="button" onClick={onOpen} className="ui-focus flex flex-1 flex-col w-full text-left">
        <div className={`relative w-full bg-[#e6ddd2] ${isCompact ? "h-44" : "h-56"}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={coverSrc}
            alt={item.title}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
            loading="lazy"
            onError={() => setCoverSrc("/placeholder-car.svg")}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/5 to-transparent" />
          <div className="absolute left-3 top-3 flex flex-wrap gap-1">
            {item.view3dUrl ? (
              <span className="rounded-full border border-amber-200/70 bg-[#3d2518]/90 px-2 py-1 text-[10px] font-semibold text-amber-50">3D</span>
            ) : null}
            {priceLabel ? (
              <span className={`rounded-full px-2 py-1 text-[10px] font-semibold text-white ${promoEnabled ? "bg-rose-600" : "bg-[#9a5d33]"}`}>
                {promoEnabled ? "Oferta" : "Precio"}
              </span>
            ) : null}
            {conditionLabel ? (
              <span
                className={`max-w-[12rem] truncate rounded-full px-2 py-1 text-[10px] font-semibold ${getConditionBadgeClasses(
                  conditionLabel,
                )}`}
              >
                {shortText(conditionLabel, 32)}
              </span>
            ) : null}
          </div>
          {item.status ? (
            <span className="absolute right-3 top-3 max-w-[12rem] truncate rounded-full border border-emerald-200 bg-emerald-600 px-3 py-1 text-xs font-semibold text-white">
              {shortText(item.status, 30)}
            </span>
          ) : null}
        </div>

        <div className={`flex flex-1 flex-col space-y-3 p-4 ${isCompact ? "space-y-2" : ""}`}>
          <div className={isCompact ? "min-h-[3.2rem]" : "min-h-[5.2rem]"}>
            <h3 className="line-clamp-2 break-words text-base font-semibold text-[#2f1f14]">
              {item.title}
            </h3>
            {!isCompact && item.subtitle ? (
              <p className="mt-1 break-words text-sm text-[#6c5440] [overflow-wrap:anywhere]">{shortText(item.subtitle)}</p>
            ) : null}
          </div>

          <div className="flex min-h-[2.6rem] min-w-0 flex-wrap content-start gap-2 text-xs text-[#604734]">
            {item.lot ? (
              <span className="max-w-full truncate rounded-full border border-amber-300/60 bg-[#f4ebe2] px-2 py-1">Lote {item.lot}</span>
            ) : null}
            {formattedDate ? (
              <span className="max-w-full truncate rounded-full border border-amber-300/60 bg-[#f4ebe2] px-2 py-1">
                Fecha {formattedDate}
              </span>
            ) : null}
            {item.location ? (
              <span className="max-w-full truncate rounded-full border border-amber-300/60 bg-[#f4ebe2] px-2 py-1">
                {shortText(item.location, 35)}
              </span>
            ) : null}
            {upcomingAuctionLabel ? (
              <span className="max-w-full truncate rounded-full border border-amber-300/70 bg-[#eddccf] px-2 py-1 font-semibold text-[#6c3e1f]">
                {shortText(`Categoria: ${upcomingAuctionLabel}`, 38)}
              </span>
            ) : null}
          </div>

          <div className="mt-auto flex items-center justify-between border-t border-amber-200/70 pt-3">
            <div className="flex flex-col">
              {promoEnabled && originalPriceLabel && priceLabel ? (
                <span className="text-xs text-[#9b856f] line-through">{originalPriceLabel}</span>
              ) : null}
              {priceLabel ? (
                <span className={`text-sm font-semibold ${promoEnabled ? "text-rose-700" : "text-[#673b1f]"}`}>
                  {priceLabel}
                </span>
              ) : null}
              <span className="text-xs text-[#7a624f]">
                {item.images.length} foto{item.images.length === 1 ? "" : "s"}
              </span>
            </div>
            {item.view3dUrl ? (
              <span className="rounded-md border border-amber-300 bg-amber-100 px-3 py-1.5 text-xs font-medium text-[#6b3d1e]">
                Ver detalle 3D
              </span>
            ) : (
              <span className="text-xs text-[#99816b]">Ver detalle</span>
            )}
          </div>
        </div>
      </button>

      <div className="border-t border-amber-200/60 px-4 pb-4 pt-3">
        <div className="grid grid-cols-4 gap-2">
          <button
            type="button"
            onClick={onToggleFavorite}
            className={`ui-focus inline-flex items-center justify-center rounded-full border px-3 py-2 text-xs font-semibold transition ${
              isFavorite
                ? "border-amber-300 bg-amber-100 text-[#6f431f]"
                : "border-amber-300/60 bg-white text-[#7c624d] hover:bg-[#f7eee6]"
            }`}
            aria-label={isFavorite ? `Quitar guardado ${item.title}` : `Guardar ${item.title}`}
            title={isFavorite ? "Guardado" : "Guardar"}
          >
            <svg viewBox="0 0 20 20" className="h-[18px] w-[18px]" fill={isFavorite ? "currentColor" : "none"} aria-hidden="true">
              <path
                d="M10 2.75l2.16 4.37 4.82.7-3.49 3.4.83 4.8L10 13.74l-4.32 2.28.83-4.8-3.49-3.4 4.82-.7L10 2.75Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <button
            type="button"
            onClick={onToggleCompare}
            className={`ui-focus inline-flex items-center justify-center rounded-full border px-3 py-2 text-xs font-semibold transition ${
              isCompared
                ? "border-amber-300 bg-amber-100 text-[#6f431f]"
                : "border-amber-300/60 bg-white text-[#7c624d] hover:bg-[#f7eee6]"
            }`}
            aria-label={isCompared ? `Quitar comparacion ${item.title}` : `Comparar ${item.title}`}
            title={isCompared ? "Comparando" : "Comparar"}
          >
            <svg viewBox="0 0 20 20" className="h-[18px] w-[18px]" fill="none" aria-hidden="true">
              {isCompared ? (
                <path d="M4.5 10.5l3.1 3.1L15.5 5.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              ) : (
                <>
                  <path d="M5 6.25h3M5 13.75h3M12 10h3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5" />
                </>
              )}
            </svg>
          </button>
          <button
            type="button"
            onClick={async () => {
              try {
                if (navigator.share && shareUrl) {
                  await navigator.share({
                    title: item.title,
                    text: `Revisa este vehiculo: ${patent}`,
                    url: shareUrl,
                  });
                } else if (navigator.clipboard && shareUrl) {
                  await navigator.clipboard.writeText(shareUrl);
                  setShareCopied(true);
                  window.setTimeout(() => setShareCopied(false), 1800);
                } else if (shareUrl) {
                  window.open(shareUrl, "_blank", "noreferrer");
                }
              } catch {
                // no-op if user cancels share
              }
            }}
            className="ui-focus inline-flex items-center justify-center rounded-full border border-amber-300/60 bg-white px-3 py-2 text-xs font-semibold text-[#6f553f] shadow-sm transition hover:-translate-y-0.5 hover:bg-[#f7eee6]"
            aria-label={`Compartir ${item.title}`}
            title={shareCopied ? "Copiado" : "Compartir"}
          >
            <svg viewBox="0 0 20 20" className="h-[18px] w-[18px]" fill="none" aria-hidden="true">
              {shareCopied ? (
                <path d="M4.5 10.5l3.1 3.1L15.5 5.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              ) : (
                <>
                  <path d="M11.5 4h4.5v4.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                  <path d="M15.8 4.2l-6.7 6.7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                  <rect x="4" y="8.5" width="8.5" height="7.5" rx="1.8" stroke="currentColor" strokeWidth="1.5" />
                </>
              )}
            </svg>
          </button>
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noreferrer"
            onClick={onWhatsappClick}
            className="ui-focus inline-flex items-center justify-center rounded-full border border-[#2ac76d] bg-[#25D366] px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:brightness-95"
            aria-label={`Contactar por WhatsApp por ${item.title}`}
            title="WhatsApp"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
              <path d="M12.04 2C6.58 2 2.16 6.42 2.16 11.88c0 1.75.46 3.45 1.32 4.95L2 22l5.33-1.4a9.83 9.83 0 0 0 4.7 1.2h.01c5.45 0 9.88-4.43 9.88-9.89A9.86 9.86 0 0 0 12.04 2zm0 17.96h-.01a8.08 8.08 0 0 1-4.11-1.12l-.3-.18-3.16.83.84-3.09-.2-.32a8.03 8.03 0 0 1-1.24-4.2 8.2 8.2 0 1 1 8.19 8.08zm4.49-6.14c-.25-.12-1.48-.73-1.71-.81-.23-.09-.4-.12-.56.12-.16.24-.65.8-.79.97-.15.17-.3.19-.55.07-.25-.12-1.07-.4-2.03-1.28-.75-.66-1.25-1.48-1.4-1.73-.15-.24-.01-.37.11-.49.11-.11.25-.29.37-.43.12-.14.16-.24.24-.4.08-.17.04-.31-.02-.43-.06-.12-.56-1.36-.77-1.87-.2-.48-.41-.41-.56-.42h-.48c-.17 0-.43.06-.65.3-.22.24-.85.83-.85 2.03s.87 2.35.99 2.51c.12.17 1.7 2.6 4.12 3.64.58.25 1.03.4 1.38.51.58.18 1.1.15 1.52.09.46-.07 1.48-.6 1.68-1.17.21-.58.21-1.07.15-1.17-.06-.1-.22-.16-.47-.28z" />
            </svg>
          </a>
        </div>
      </div>
    </article>
  );
}

