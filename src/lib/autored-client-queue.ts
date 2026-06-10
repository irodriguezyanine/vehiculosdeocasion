import type { ManualPublicationDraft } from "@/lib/manual-publication-draft";

export const AUTORED_CLIENT_INTERVAL_MS = 3200;
export const AUTORED_CLIENT_COOLDOWN_MS = 5 * 60_000;
export const AUTORED_CLIENT_CACHE_KEY = "vehiculosdeocasion_autored_cache_v1";
export const AUTORED_CLIENT_CACHE_TTL_MS = 24 * 60 * 60_000;

export type AutoredClientLookupResult = {
  ok: boolean;
  fields?: Partial<ManualPublicationDraft>;
  error?: string;
  code?: string;
  status: number;
  fromCache?: boolean;
};

type AutoredCacheEntry = {
  fields: Partial<ManualPublicationDraft>;
  cachedAt: number;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let queue: Promise<void> = Promise.resolve();
let lastLookupAt = 0;
let cooldownUntil = 0;

export function getAutoredClientCooldownMs(): number {
  return Math.max(0, cooldownUntil - Date.now());
}

export function setAutoredClientCooldown(ms = AUTORED_CLIENT_COOLDOWN_MS): void {
  cooldownUntil = Date.now() + ms;
}

function readCache(): Record<string, AutoredCacheEntry> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(AUTORED_CLIENT_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, AutoredCacheEntry>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeCache(cache: Record<string, AutoredCacheEntry>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(AUTORED_CLIENT_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // noop
  }
}

export function getCachedAutoredFields(
  patente: string,
): Partial<ManualPublicationDraft> | null {
  const normalized = patente.toUpperCase().replace(/\s+/g, "").replace(/-/g, "");
  const entry = readCache()[normalized];
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > AUTORED_CLIENT_CACHE_TTL_MS) return null;
  return entry.fields;
}

export function setCachedAutoredFields(
  patente: string,
  fields: Partial<ManualPublicationDraft>,
): void {
  const normalized = patente.toUpperCase().replace(/\s+/g, "").replace(/-/g, "");
  const cache = readCache();
  cache[normalized] = { fields, cachedAt: Date.now() };
  writeCache(cache);
}

export async function lookupAutoredPatentClient(
  patente: string,
): Promise<AutoredClientLookupResult> {
  const normalized = patente.toUpperCase().replace(/\s+/g, "").replace(/-/g, "");
  const cached = getCachedAutoredFields(normalized);
  if (cached) {
    return { ok: true, fields: cached, status: 200, fromCache: true };
  }

  return new Promise((resolve) => {
    queue = queue.then(async () => {
      const cooldown = getAutoredClientCooldownMs();
      if (cooldown > 0) {
        resolve({
          ok: false,
          status: 429,
          code: "RATE_LIMITED",
          error: `Autored en pausa por limite de consultas. Espera ${Math.ceil(cooldown / 60_000)} minuto(s).`,
        });
        return;
      }

      const waitMs = Math.max(0, AUTORED_CLIENT_INTERVAL_MS - (Date.now() - lastLookupAt));
      if (waitMs > 0) await sleep(waitMs);
      lastLookupAt = Date.now();

      const response = await fetch(
        `/api/admin/autored-lookup?patente=${encodeURIComponent(normalized)}`,
        { credentials: "include", cache: "no-store" },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        fields?: Partial<ManualPublicationDraft>;
        error?: string;
        code?: string;
        retryAfterMs?: number;
      };

      if (response.status === 429 || payload.code === "RATE_LIMITED") {
        setAutoredClientCooldown(payload.retryAfterMs ?? AUTORED_CLIENT_COOLDOWN_MS);
        resolve({
          ok: false,
          status: response.status || 429,
          code: "RATE_LIMITED",
          error:
            payload.error ??
            "Autored limito las consultas temporalmente. Espera unos minutos e intenta de nuevo.",
        });
        return;
      }

      if (!response.ok || !payload.ok || !payload.fields) {
        resolve({
          ok: false,
          status: response.status,
          code: payload.code,
          error: payload.error ?? "No se pudo consultar Autored para esta patente.",
        });
        return;
      }

      setCachedAutoredFields(normalized, payload.fields);
      resolve({
        ok: true,
        status: response.status,
        fields: payload.fields,
      });
    });
  });
}

export async function lookupAutoredPatentsSequential(
  patentes: string[],
  onProgress?: (current: number, total: number, patente: string) => void,
): Promise<{
  results: Map<string, Partial<ManualPublicationDraft>>;
  stoppedByRateLimit: boolean;
  processed: number;
}> {
  const results = new Map<string, Partial<ManualPublicationDraft>>();
  let stoppedByRateLimit = false;

  for (let index = 0; index < patentes.length; index += 1) {
    const patente = patentes[index];
    onProgress?.(index + 1, patentes.length, patente);
    const lookup = await lookupAutoredPatentClient(patente);
    if (lookup.ok && lookup.fields) {
      results.set(patente, lookup.fields);
    }
    if (lookup.code === "RATE_LIMITED") {
      stoppedByRateLimit = true;
      break;
    }
  }

  return { results, stoppedByRateLimit, processed: results.size };
}
