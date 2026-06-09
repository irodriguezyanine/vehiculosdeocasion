import { cookies } from "next/headers";
import { lookupAutoredDraftFields } from "@/lib/autored-lookup";
import { ADMIN_SESSION_COOKIE_NAME, verifyAdminSessionToken } from "@/lib/admin-session";

export async function GET(req: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE_NAME)?.value;
  const session = verifyAdminSessionToken(token);
  if (!session.valid || !session.email) {
    return Response.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }

  const patente = new URL(req.url).searchParams.get("patente")?.trim() ?? "";
  const normalized = patente.toUpperCase().replace(/\s+/g, "").replace(/-/g, "");
  if (normalized.length < 4) {
    return Response.json(
      { ok: false, error: "Patente invalida. Ingresa al menos 4 caracteres." },
      { status: 400 },
    );
  }

  try {
    const fields = await lookupAutoredDraftFields(normalized);
    if (!fields || Object.keys(fields).length === 0) {
      return Response.json(
        { ok: false, error: "No se encontraron datos para esta patente en Autored." },
        { status: 404 },
      );
    }
    return Response.json({ ok: true, fields });
  } catch {
    return Response.json(
      { ok: false, error: "No se pudo consultar Autored en este momento." },
      { status: 502 },
    );
  }
}
