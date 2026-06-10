import { cookies } from "next/headers";
import {
  AutoredLookupError,
  getAutoredRateLimitStatus,
  isAutoredConfigured,
  lookupAutoredDraftFields,
} from "@/lib/autored-lookup";
import { getAutoredMinIntervalMs } from "@/lib/autored-request-queue";
import { normalizePatentToken } from "@/lib/patent-input";
import { ADMIN_SESSION_COOKIE_NAME, verifyAdminSessionToken } from "@/lib/admin-session";
import type { ManualPublicationDraft } from "@/lib/manual-publication-draft";

const MAX_BULK_LOOKUPS = Number(process.env.AUTORED_BULK_MAX ?? "20");

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE_NAME)?.value;
  const session = verifyAdminSessionToken(token);
  if (!session.valid || !session.email) {
    return Response.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }

  if (!isAutoredConfigured()) {
    return Response.json(
      {
        ok: false,
        error:
          "Autored no esta configurado. Agrega AUTORED_EMAIL y AUTORED_PASSWORD en las variables de entorno.",
        code: "AUTORED_NOT_CONFIGURED",
      },
      { status: 503 },
    );
  }

  const rateLimit = getAutoredRateLimitStatus();
  if (rateLimit.blocked) {
    return Response.json(
      {
        ok: false,
        error: "Autored limito las consultas temporalmente. Espera unos minutos e intenta de nuevo.",
        code: "RATE_LIMITED",
        retryAfterMs: rateLimit.retryAfterMs,
      },
      { status: 429 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as { patentes?: string[] };
  const rawList = Array.isArray(body.patentes) ? body.patentes : [];
  const patentes = Array.from(
    new Set(
      rawList
        .map((value) => normalizePatentToken(String(value ?? "")))
        .filter((value) => value.length >= 5),
    ),
  ).slice(0, MAX_BULK_LOOKUPS);

  if (patentes.length === 0) {
    return Response.json(
      { ok: false, error: "Ingresa al menos una patente valida (minimo 5 caracteres)." },
      { status: 400 },
    );
  }

  const results: Array<{
    patente: string;
    ok: boolean;
    fields?: Partial<ManualPublicationDraft>;
    error?: string;
    code?: string;
  }> = [];

  let stoppedByRateLimit = false;

  for (const patente of patentes) {
    try {
      const fields = await lookupAutoredDraftFields(patente);
      results.push({ patente, ok: true, fields });
    } catch (error) {
      if (error instanceof AutoredLookupError) {
        results.push({
          patente,
          ok: false,
          error: error.message,
          code: error.code,
        });
        if (error.code === "RATE_LIMITED") {
          stoppedByRateLimit = true;
          break;
        }
      } else {
        results.push({
          patente,
          ok: false,
          error: "No se pudo consultar Autored.",
          code: "UPSTREAM_ERROR",
        });
      }
    }
  }

  const rateLimitAfter = getAutoredRateLimitStatus();

  return Response.json({
    ok: true,
    results,
    truncated: rawList.length > MAX_BULK_LOOKUPS,
    max: MAX_BULK_LOOKUPS,
    stoppedByRateLimit,
    intervalMs: getAutoredMinIntervalMs(),
    retryAfterMs: rateLimitAfter.retryAfterMs,
  });
}
