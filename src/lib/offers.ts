import { createClient } from "@supabase/supabase-js";
import type { OfferRecord, OfferSubmissionInput } from "@/types/offers";

const OFFERS_TABLE = process.env.CATALOG_OFFERS_TABLE ?? "catalogo_vehicle_offers";

function getOffersSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRole) return null;
  return createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function toSafeText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export async function createVehicleOffer(
  input: OfferSubmissionInput,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = getOffersSupabase();
  if (!supabase) {
    return { ok: false, error: "No se pudo enviar la oferta en este momento." };
  }

  const itemKey = toSafeText(input.itemKey);
  const vehicleTitle = toSafeText(input.vehicleTitle);
  const patent = toSafeText(input.patent).toUpperCase();
  const customerName = toSafeText(input.customerName);
  const customerEmail = toSafeText(input.customerEmail).toLowerCase();
  const customerPhone = toSafeText(input.customerPhone);

  if (
    !itemKey ||
    !vehicleTitle ||
    !patent ||
    !customerName ||
    !customerEmail ||
    !customerPhone ||
    !Number.isFinite(input.referencePrice) ||
    input.referencePrice <= 0 ||
    !Number.isFinite(input.offerAmount) ||
    input.offerAmount <= 0
  ) {
    return { ok: false, error: "Datos inválidos para registrar la oferta." };
  }

  const { error } = await supabase.from(OFFERS_TABLE).insert({
    item_key: itemKey,
    vehicle_title: vehicleTitle,
    patent,
    reference_price: Math.round(input.referencePrice),
    offer_amount: Math.round(input.offerAmount),
    customer_name: customerName,
    customer_email: customerEmail,
    customer_phone: customerPhone,
    created_at: input.createdAt ?? new Date().toISOString(),
  });

  if (error) {
    return {
      ok: false,
      error:
        `No se pudo guardar la oferta en '${OFFERS_TABLE}'. ` +
        "Verifica columnas: item_key, vehicle_title, patent, reference_price, offer_amount, customer_name, customer_email, customer_phone, created_at.",
    };
  }

  return { ok: true };
}

export async function readVehicleOffers(options: {
  limit?: number;
}): Promise<{ ok: boolean; offers: OfferRecord[]; error?: string }> {
  const supabase = getOffersSupabase();
  if (!supabase) return { ok: false, offers: [], error: "No hay conexión a ofertas." };

  const limit = Math.max(50, Math.min(options.limit ?? 5000, 10000));
  const { data, error } = await supabase
    .from(OFFERS_TABLE)
    .select(
      "id,item_key,vehicle_title,patent,reference_price,offer_amount,customer_name,customer_email,customer_phone,created_at",
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return {
      ok: false,
      offers: [],
      error: `No se pudo leer ofertas desde '${OFFERS_TABLE}'.`,
    };
  }

  const offers = (data ?? []).map((row) => {
    const safe = row as Record<string, unknown>;
    return {
      id: String(safe.id ?? crypto.randomUUID()),
      itemKey: String(safe.item_key ?? ""),
      vehicleTitle: String(safe.vehicle_title ?? ""),
      patent: String(safe.patent ?? ""),
      referencePrice: Number(safe.reference_price ?? 0),
      offerAmount: Number(safe.offer_amount ?? 0),
      customerName: String(safe.customer_name ?? ""),
      customerEmail: String(safe.customer_email ?? ""),
      customerPhone: String(safe.customer_phone ?? ""),
      createdAt: String(safe.created_at ?? ""),
    } satisfies OfferRecord;
  });

  return { ok: true, offers };
}
