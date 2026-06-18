import {
  useEffect,
  useMemo,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { getPublicVehicleSubtitle } from "@/lib/public-patent-policy";
import type { CatalogItem } from "@/types/catalog";
import { resolveCatalogItemThumbnail } from "@/lib/catalog";
import { WHATSAPP_API_BASE } from "@/lib/contact";

const WHATSAPP_BASE_URL = WHATSAPP_API_BASE;

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
  imageLoading?: "lazy" | "eager";
  canInlineEdit?: boolean;
  showPatent?: boolean;
  editablePriceValue?: string;
  onInlineSave?: (changes: { title?: string; subtitle?: string; price?: string }) => void;
};

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
  return /cdn\.|cloudfront|amazonaws|supabase|cloudinary|glo3d|thumb|image|photo|media|foto/.test(
    normalized,
  );
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

function getFirstRawValue(raw: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

function normalizeMileage(value: string | null): string | null {
  if (!value) return null;
  const compact = value.trim();
  if (!compact) return null;
  const digits = compact.replace(/[^\d]/g, "");
  if (!digits) return compact;
  const formatted = Number(digits).toLocaleString("es-CL");
  return `${formatted} kms.`;
}

function normalizeBinaryStatus(value: string | null): "yes" | "no" | "unknown" | null {
  if (!value) return null;
  const normalized = value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
  if (!normalized) return null;
  if (["si", "s", "yes", "y", "true", "1", "arranca", "se mueve", "se desplaza"].includes(normalized)) {
    return "yes";
  }
  if (["no", "n", "false", "0", "no arranca", "no se mueve", "no se desplaza"].includes(normalized)) {
    return "no";
  }
  return "unknown";
}

function getMotorTestLabel(value: string | null): string | null {
  const status = normalizeBinaryStatus(value);
  if (!status) return null;
  if (status === "yes") return "MOTOR ARRANCA";
  if (status === "no") return "MOTOR NO ARRANCA";
  return value?.trim().toUpperCase() ?? null;
}

function getMovementTestLabel(value: string | null): string | null {
  const status = normalizeBinaryStatus(value);
  if (!status) return null;
  if (status === "yes") return "SE DESPLAZA";
  if (status === "no") return "NO SE DESPLAZA";
  return value?.trim().toUpperCase() ?? null;
}

function isAffirmativeStatus(value: string | null): boolean {
  return normalizeBinaryStatus(value) === "yes";
}

function getVehicleSpecs(
  item: CatalogItem,
): Array<{
  key: string;
  label: string;
  icon:
    | "km"
    | "year"
    | "fuel"
    | "gear"
    | "engineTest"
    | "movementTest"
    | "conditioned"
    | "singleOwner"
    | "airConditioning"
    | "keys"
    | "traction"
    | "airbags";
  wide?: boolean;
}> {
  const raw = item.raw as Record<string, unknown>;
  const mileage = normalizeMileage(
    getFirstRawValue(raw, [
      "kilometraje",
      "km",
      "kms",
      "odometro",
      "odómetro",
      "glo3d.kilometraje",
    ]),
  );
  const year = getFirstRawValue(raw, ["ano", "anio", "year", "glo3d.year"]);
  const fuel = getFirstRawValue(raw, ["combustible", "fuel", "glo3d.combustible"]);
  const transmission = getFirstRawValue(raw, ["transmision", "transmisión", "caja", "transmission", "glo3d.transmision"]);
  const motorTestRaw = getFirstRawValue(raw, [
    "prueba_motor",
    "pdm",
    "pruebaMotor",
    "motor_test",
    "glo3d.prueba_motor",
  ]);
  const movementTestRaw = getFirstRawValue(raw, [
    "prueba_desplazamiento",
    "pdd",
    "pruebaDesplazamiento",
    "movement_test",
    "glo3d.prueba_desplazamiento",
  ]);
  const conditionedRaw = getFirstRawValue(raw, ["condicionado", "glo3d.condicionado"]);
  const singleOwnerRaw = getFirstRawValue(raw, [
    "unico_propietario",
    "single_owner",
    "one_owner",
    "glo3d.unico_propietario",
  ]);
  const airConditioningRaw = getFirstRawValue(raw, [
    "aire_acondicionado",
    "air_conditioning",
    "has_ac",
    "ac",
    "glo3d.aire_acondicionado",
  ]);
  const keysRaw = getFirstRawValue(raw, [
    "llaves",
    "keys",
    "has_keys",
    "tiene_llaves",
    "glo3d.llaves",
  ]);
  const tractionRaw = getFirstRawValue(raw, ["traccion", "traction", "glo3d.traccion"]);
  const airbagsRaw = getFirstRawValue(raw, ["estado_airbags", "airbags", "eda", "glo3d.estado_airbags"]);
  const motorTest = getMotorTestLabel(motorTestRaw);
  const movementTest = getMovementTestLabel(movementTestRaw);
  const specs: Array<{
    key: string;
    label: string;
    icon:
      | "km"
      | "year"
      | "fuel"
      | "gear"
      | "engineTest"
      | "movementTest"
      | "conditioned"
      | "singleOwner"
      | "airConditioning"
      | "keys"
      | "traction"
      | "airbags";
    wide?: boolean;
  }> = [];
  if (mileage) specs.push({ key: "km", label: mileage, icon: "km" });
  if (year) specs.push({ key: "year", label: year, icon: "year" });
  if (fuel) specs.push({ key: "fuel", label: fuel, icon: "fuel" });
  if (transmission) specs.push({ key: "gear", label: transmission, icon: "gear" });
  if (motorTest) specs.push({ key: "engineTest", label: motorTest, icon: "engineTest", wide: true });
  if (movementTest) {
    specs.push({
      key: "movementTest",
      label: movementTest,
      icon: "movementTest",
      wide: true,
    });
  }
  if (isAffirmativeStatus(conditionedRaw)) {
    specs.push({ key: "conditioned", label: "ACONDICIONADO", icon: "conditioned", wide: true });
  }
  if (isAffirmativeStatus(singleOwnerRaw)) {
    specs.push({ key: "singleOwner", label: "UNICO DUEÑO", icon: "singleOwner", wide: true });
  }
  if (isAffirmativeStatus(airConditioningRaw)) {
    specs.push({
      key: "airConditioning",
      label: "AIRE ACONDICIONADO",
      icon: "airConditioning",
      wide: true,
    });
  }
  if (isAffirmativeStatus(keysRaw)) {
    specs.push({ key: "keys", label: "CON LLAVES", icon: "keys", wide: true });
  }
  if (tractionRaw) {
    specs.push({ key: "traction", label: `TRACCION ${tractionRaw.toUpperCase()}`, icon: "traction", wide: true });
  }
  if (airbagsRaw) {
    specs.push({ key: "airbags", label: `AIRBAGS: ${airbagsRaw.toUpperCase()}`, icon: "airbags", wide: true });
  }
  return specs.slice(0, 10);
}

function SpecIcon({
  icon,
}: {
  icon:
    | "km"
    | "year"
    | "fuel"
    | "gear"
    | "engineTest"
    | "movementTest"
    | "conditioned"
    | "singleOwner"
    | "airConditioning"
    | "keys"
    | "traction"
    | "airbags";
}) {
  if (icon === "km") {
    return (
      <svg viewBox="0 0 20 20" className="h-4 w-4 text-[#7a624f]" fill="none" aria-hidden="true">
        <circle cx="10" cy="10" r="6.8" stroke="currentColor" strokeWidth="1.6" />
        <path d="M10 10 13.5 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="10" cy="10" r="1.1" fill="currentColor" />
      </svg>
    );
  }
  if (icon === "year") {
    return (
      <svg viewBox="0 0 20 20" className="h-4 w-4 text-[#7a624f]" fill="none" aria-hidden="true">
        <rect x="3.5" y="4.5" width="13" height="11.5" rx="1.8" stroke="currentColor" strokeWidth="1.6" />
        <path d="M6.5 3.5v2M13.5 3.5v2M3.5 8h13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }
  if (icon === "fuel") {
    return (
      <svg viewBox="0 0 20 20" className="h-4 w-4 text-[#7a624f]" fill="none" aria-hidden="true">
        <path d="M4.5 4.5h6v11h-6z" stroke="currentColor" strokeWidth="1.6" />
        <path d="M10.5 7h1.8l1.4 1.6v4.4a1.7 1.7 0 0 0 3.4 0V9.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (icon === "engineTest") {
    return (
      <svg viewBox="0 0 20 20" className="h-4 w-4 text-[#7a624f]" fill="none" aria-hidden="true">
        <rect x="3.5" y="7" width="9.8" height="6" rx="1.2" stroke="currentColor" strokeWidth="1.6" />
        <path d="M13.3 8.4h2.2M13.3 11.6h2.2M6.4 7V5.4M10.4 7V5.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }
  if (icon === "movementTest") {
    return (
      <svg viewBox="0 0 20 20" className="h-4 w-4 text-[#7a624f]" fill="none" aria-hidden="true">
        <path d="M4 10h9.8M10.8 6l3.5 4-3.5 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (icon === "conditioned") {
    return (
      <svg viewBox="0 0 20 20" className="h-4 w-4 text-[#7a624f]" fill="none" aria-hidden="true">
        <path d="M4.2 10.2h11.6M10.5 4.4c2.8.2 5 2.5 5 5.3 0 2.9-2.3 5.3-5.3 5.3-2.8 0-5.1-2.2-5.3-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }
  if (icon === "singleOwner") {
    return (
      <svg viewBox="0 0 20 20" className="h-4 w-4 text-[#7a624f]" fill="none" aria-hidden="true">
        <circle cx="10" cy="6.5" r="2.3" stroke="currentColor" strokeWidth="1.6" />
        <path d="M5 15.3c.6-2.1 2.5-3.6 5-3.6s4.4 1.5 5 3.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }
  if (icon === "airConditioning") {
    return (
      <svg viewBox="0 0 20 20" className="h-4 w-4 text-[#7a624f]" fill="none" aria-hidden="true">
        <path d="M5 6.5h10M10 4.5v2M7.2 10.2l2.8-1.7 2.8 1.7M10 8.5V15.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (icon === "keys") {
    return (
      <svg viewBox="0 0 20 20" className="h-4 w-4 text-[#7a624f]" fill="none" aria-hidden="true">
        <circle cx="7" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.6" />
        <path d="M9.5 10h6M13.5 10v1.8M15.5 10v1.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }
  if (icon === "traction") {
    return (
      <svg viewBox="0 0 20 20" className="h-4 w-4 text-[#7a624f]" fill="none" aria-hidden="true">
        <circle cx="6" cy="14" r="1.7" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="14" cy="14" r="1.7" stroke="currentColor" strokeWidth="1.6" />
        <path d="M5.5 12h9l-1-3.2H7.1L5.5 12Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    );
  }
  if (icon === "airbags") {
    return (
      <svg viewBox="0 0 20 20" className="h-4 w-4 text-[#7a624f]" fill="none" aria-hidden="true">
        <circle cx="8.2" cy="7" r="2" stroke="currentColor" strokeWidth="1.6" />
        <path d="M4.8 14.8c.4-2 1.9-3.4 3.9-3.7M10.8 12.2h4.4M13 9.5v5.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4 text-[#7a624f]" fill="none" aria-hidden="true">
      <path d="M4.5 4.5v11M8 4.5v11M12 4.5v11M15.5 4.5v11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="4.5" cy="10" r="1.3" fill="currentColor" />
      <circle cx="8" cy="10" r="1.3" fill="currentColor" />
      <circle cx="12" cy="10" r="1.3" fill="currentColor" />
      <circle cx="15.5" cy="10" r="1.3" fill="currentColor" />
    </svg>
  );
}

function getConditionBadgeClasses(condition?: string | null): string {
  const sample = (condition ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
  if (!sample) return "bg-[#164e63] text-white";
  if (/100% operativo|operativo/.test(sample)) return "bg-emerald-600 text-white";
  if (/no arranca|desarme/.test(sample)) return "bg-rose-600 text-white";
  if (/problema|recuperado|robo/.test(sample)) return "bg-amber-600 text-white";
  return "bg-[#0891b2] text-white";
}

export function CatalogCard({
  item,
  priceLabel,
  promoEnabled: promoEnabledOverride,
  originalPriceLabel: originalPriceLabelOverride,
  upcomingAuctionLabel,
  density = "detailed",
  onOpen,
  onWhatsappClick,
  imageLoading = "lazy",
  canInlineEdit = false,
  showPatent = false,
  editablePriceValue,
  onInlineSave,
}: CatalogCardProps) {
  const raw = item.raw as Record<string, unknown>;
  const coverCandidate = resolveCatalogItemThumbnail(item) ?? item.thumbnail ?? item.images[0];
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
  const [editingField, setEditingField] = useState<"title" | "subtitle" | "price" | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const shareUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    const url = new URL(window.location.href);
    url.searchParams.set("vehiculo", itemKey);
    if (!url.hash) url.hash = "catalogo";
    return url.toString();
  }, [itemKey]);
  const publicSubtitle = getPublicVehicleSubtitle(item, showPatent);
  const whatsappText = showPatent
    ? `Hola, estoy interesado en ofertar por el vehiculo ${patent} ${brandModel}`
    : `Hola, estoy interesado en ofertar por el vehiculo ${brandModel}`;
  const whatsappUrl = `${WHATSAPP_BASE_URL}&text=${encodeURIComponent(
    `${whatsappText}${shareUrl ? `. Link: ${shareUrl}` : ""}`,
  )}&type=phone_number&app_absent=0`;
  const isCompact = density === "compact";
  const editablePrice = editablePriceValue ?? (priceLabel ?? "");
  const vehicleSpecs = useMemo(() => getVehicleSpecs(item), [item]);

  useEffect(() => {
    setCoverSrc(cover);
  }, [cover]);

  const beginInlineEdit = (field: "title" | "subtitle" | "price") => {
    if (!canInlineEdit || !onInlineSave) return;
    const initialValue =
      field === "title" ? item.title : field === "subtitle" ? (item.subtitle ?? "") : editablePrice;
    setEditingField(field);
    setEditingValue(initialValue);
  };

  const cancelInlineEdit = () => {
    setEditingField(null);
    setEditingValue("");
  };

  const submitInlineEdit = () => {
    if (!editingField || !onInlineSave) return;
    const cleanValue = editingValue.trim();
    if (!cleanValue && editingField === "title") return;
    if (editingField === "title") onInlineSave({ title: cleanValue });
    if (editingField === "subtitle") onInlineSave({ subtitle: cleanValue });
    if (editingField === "price") onInlineSave({ price: cleanValue });
    cancelInlineEdit();
  };

  const onCardKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const target = event.target as HTMLElement;
    if (target.closest("[data-inline-control='true']")) return;
    event.preventDefault();
    onOpen?.();
  };

  const onCardClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest("[data-inline-control='true']")) return;
    onOpen?.();
  };

  return (
    <article className="group vehicle-card flex h-full w-full flex-col overflow-hidden rounded-3xl border border-[#cbd5e1] bg-[#f8fafc] text-left shadow-[0_10px_26px_rgba(73,46,26,0.08)] transition duration-300 hover:-translate-y-1 hover:border-cyan-200/80 hover:shadow-[0_16px_34px_rgba(73,46,26,0.16)] max-md:hover:translate-y-0 max-md:active:scale-[0.995]">
      <div
        role="button"
        tabIndex={0}
        onClick={onCardClick}
        onKeyDown={onCardKeyDown}
        className="ui-focus flex w-full flex-1 flex-col text-left"
      >
        <div className={`relative w-full overflow-hidden bg-[#e2e8f0] ${isCompact ? "h-40 max-md:h-36" : "h-48 max-md:h-44 md:h-56"}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={coverSrc}
            alt={item.title}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
            loading={imageLoading}
            onError={() => setCoverSrc("/placeholder-car.svg")}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/10 to-transparent" />
          <div className="absolute left-3 top-3 flex flex-wrap gap-1">
            {item.view3dUrl ? (
              <span className="rounded-full border border-cyan-200/70 bg-[#3d2518]/90 px-2.5 py-1 text-[10px] font-semibold tracking-wide text-white">3D</span>
            ) : null}
            {priceLabel ? (
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-wide text-white ${promoEnabled ? "bg-rose-600" : "bg-[#22d3ee]"}`}>
                {promoEnabled ? "Oferta" : "Precio"}
              </span>
            ) : null}
            {conditionLabel ? (
              <span
                className={`max-w-[12rem] truncate rounded-full px-2.5 py-1 text-[10px] font-semibold ${getConditionBadgeClasses(
                  conditionLabel,
                )}`}
              >
                {shortText(conditionLabel, 32)}
              </span>
            ) : null}
          </div>
          {item.status ? (
            <span className="absolute right-3 top-3 max-w-[12rem] truncate rounded-full border border-emerald-200 bg-emerald-600 px-3 py-1 text-[11px] font-semibold text-white">
              {shortText(item.status, 30)}
            </span>
          ) : null}
        </div>

        <div className={`flex flex-1 flex-col ${isCompact ? "space-y-2 p-3 max-md:space-y-1.5" : "space-y-3 p-3.5 max-md:space-y-2 md:p-5 md:space-y-3.5"}`}>
          <div className={isCompact ? "min-h-[3.2rem]" : "min-h-[5rem]"}>
            {editingField === "title" ? (
              <div data-inline-control="true" className="space-y-1">
                <input
                  value={editingValue}
                  onChange={(event) => setEditingValue(event.target.value)}
                  className="ui-focus w-full rounded border border-cyan-200 bg-white px-2 py-1 text-sm font-semibold text-[#0f172a]"
                  placeholder="Titulo"
                  onClick={(event) => event.stopPropagation()}
                />
                <div className="flex gap-1">
                  <button type="button" onClick={submitInlineEdit} className="rounded border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                    Guardar
                  </button>
                  <button type="button" onClick={cancelInlineEdit} className="rounded border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-2">
                <h3 className="line-clamp-2 break-words text-[1.08rem] font-semibold leading-tight tracking-[0.01em] text-[#0f172a]">
                  {item.title}
                </h3>
                {canInlineEdit ? (
                  <button
                    type="button"
                    data-inline-control="true"
                    onClick={() => beginInlineEdit("title")}
                    className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-cyan-200 bg-cyan-50 text-cyan-800"
                    aria-label="Editar titulo"
                    title="Editar titulo"
                  >
                    <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
                      <path d="M13.9 3.6a1.8 1.8 0 0 1 2.5 2.5l-8.6 8.6-3.3.8.8-3.3 8.6-8.6Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="m12.4 5.1 2.5 2.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                ) : null}
              </div>
            )}
            {!isCompact ? (
              editingField === "subtitle" ? (
                <div data-inline-control="true" className="mt-1 space-y-1">
                  <input
                    value={editingValue}
                    onChange={(event) => setEditingValue(event.target.value)}
                    className="ui-focus w-full rounded border border-cyan-200 bg-white px-2 py-1 text-xs text-[#475569]"
                    placeholder="Subtitulo"
                    onClick={(event) => event.stopPropagation()}
                  />
                  <div className="flex gap-1">
                    <button type="button" onClick={submitInlineEdit} className="rounded border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                      Guardar
                    </button>
                    <button type="button" onClick={cancelInlineEdit} className="rounded border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-1 flex items-start justify-between gap-2">
                  <p className="break-words text-[0.93rem] text-[#475569] [overflow-wrap:anywhere]">
                    {shortText(publicSubtitle) ?? "-"}
                  </p>
                  {canInlineEdit ? (
                    <button
                      type="button"
                      data-inline-control="true"
                      onClick={() => beginInlineEdit("subtitle")}
                      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-cyan-200 bg-cyan-50 text-cyan-800"
                      aria-label="Editar subtitulo"
                      title="Editar subtitulo"
                    >
                      <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
                        <path d="M13.9 3.6a1.8 1.8 0 0 1 2.5 2.5l-8.6 8.6-3.3.8.8-3.3 8.6-8.6Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="m12.4 5.1 2.5 2.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  ) : null}
                </div>
              )
            ) : null}
          </div>

          {vehicleSpecs.length > 0 ? (
            <div className="rounded-xl border border-cyan-200/60 bg-gradient-to-b from-[#fdfaf5] to-[#f8f1e7] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] max-md:p-1.5">
              <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-sm text-[#4f5a66] max-md:gap-x-1.5 max-md:gap-y-1">
              {vehicleSpecs.map((spec) => (
                <div
                  key={spec.key}
                  className={`flex items-center gap-2 ${spec.wide ? "col-span-2" : ""}`}
                >
                  <SpecIcon icon={spec.icon} />
                  <span className={`${spec.wide ? "text-[10px] font-semibold uppercase tracking-[0.012em] max-md:leading-tight md:text-xs" : "truncate text-xs max-md:text-[11px]"} text-[#5a616d]`}>
                    {spec.label}
                  </span>
                </div>
              ))}
              </div>
            </div>
          ) : null}
          {(item.lot || formattedDate || item.location || upcomingAuctionLabel) ? (
            <div className="flex min-w-0 flex-wrap content-start gap-2 text-xs text-[#475569]">
              {item.lot ? (
                <span className="max-w-full truncate rounded-full border border-cyan-200/60 bg-[#f4ebe2] px-2.5 py-1">Lote {item.lot}</span>
              ) : null}
              {formattedDate ? (
                <span className="max-w-full truncate rounded-full border border-cyan-200/60 bg-[#f4ebe2] px-2.5 py-1">
                  Fecha {formattedDate}
                </span>
              ) : null}
              {item.location ? (
                <span className="max-w-full truncate rounded-full border border-cyan-200/60 bg-[#f4ebe2] px-2.5 py-1">
                  {shortText(item.location, 35)}
                </span>
              ) : null}
              {upcomingAuctionLabel ? (
                <span className="max-w-full truncate rounded-full border border-cyan-200/70 bg-[#eddccf] px-2.5 py-1 font-semibold text-[#155e75]">
                  {shortText(`Categoria: ${upcomingAuctionLabel}`, 38)}
                </span>
              ) : null}
            </div>
          ) : null}

          <div className="mt-auto border-t border-cyan-200/70 pt-3">
            <div className="flex flex-col">
              {promoEnabled && originalPriceLabel && priceLabel ? (
                <span className="text-xs text-[#9b856f] line-through">{originalPriceLabel}</span>
              ) : null}
              {editingField === "price" ? (
                <div data-inline-control="true" className="space-y-1">
                  <input
                    value={editingValue}
                    onChange={(event) => setEditingValue(event.target.value)}
                    className="ui-focus w-full rounded border border-cyan-200 bg-white px-2 py-1 text-xs font-semibold text-[#155e75]"
                    placeholder="Precio"
                    onClick={(event) => event.stopPropagation()}
                  />
                  <div className="flex gap-1">
                    <button type="button" onClick={submitInlineEdit} className="rounded border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                      Guardar
                    </button>
                    <button type="button" onClick={cancelInlineEdit} className="rounded border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : priceLabel ? (
                <div className="flex items-center gap-1.5">
                  <span className={`text-[1.05rem] font-extrabold tracking-tight ${promoEnabled ? "text-rose-700" : "text-[#155e75]"}`}>
                    {priceLabel}
                  </span>
                  {canInlineEdit ? (
                    <button
                      type="button"
                      data-inline-control="true"
                      onClick={() => beginInlineEdit("price")}
                      className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-cyan-200 bg-cyan-50 text-cyan-800"
                      aria-label="Editar precio"
                      title="Editar precio"
                    >
                      <svg viewBox="0 0 20 20" className="h-3 w-3" fill="none" aria-hidden="true">
                        <path d="M13.9 3.6a1.8 1.8 0 0 1 2.5 2.5l-8.6 8.6-3.3.8.8-3.3 8.6-8.6Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="m12.4 5.1 2.5 2.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-cyan-200/60 bg-white/35 px-3 pb-3 pt-2.5 max-md:px-3 max-md:pb-3 md:px-4 md:pb-4 md:pt-3">
        <div className="vehicle-card-actions-grid grid grid-cols-2 gap-1.5 md:gap-2">
          <button
            type="button"
            onClick={async () => {
              try {
                if (navigator.share && shareUrl) {
                  await navigator.share({
                    title: item.title,
                    text: showPatent ? `Revisa este vehiculo: ${patent}` : `Revisa este vehiculo: ${item.title}`,
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
            className="ui-focus inline-flex items-center justify-center rounded-full border border-cyan-200/60 bg-white px-3 py-2 text-xs font-semibold text-[#6f553f] shadow-[0_2px_6px_rgba(55,35,19,0.08)] transition hover:-translate-y-0.5 hover:bg-[#f7eee6]"
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
            className="ui-focus inline-flex min-h-11 items-center justify-center rounded-full border border-[#2ac76d] bg-[#25D366] px-3 py-2 text-xs font-semibold text-white shadow-[0_3px_10px_rgba(37,211,102,0.35)] transition hover:-translate-y-0.5 hover:brightness-95"
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

