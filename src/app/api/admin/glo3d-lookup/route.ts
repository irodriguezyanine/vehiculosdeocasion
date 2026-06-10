import { cookies } from "next/headers";
import { ADMIN_SESSION_COOKIE_NAME, verifyAdminSessionToken } from "@/lib/admin-session";
import { isGlo3dConfigured, lookupGlo3dByStocks } from "@/lib/catalog";
import { normalizePatentToken } from "@/lib/patent-input";

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE_NAME)?.value;
  const session = verifyAdminSessionToken(token);
  if (!session.valid || !session.email) {
    return Response.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }

  if (!isGlo3dConfigured()) {
    return Response.json(
      {
        ok: false,
        error:
          "GLO3D no esta configurado. Agrega GLO3D_API_USERNAME y GLO3D_API_PASSWORD en las variables de entorno.",
        code: "GLO3D_NOT_CONFIGURED",
      },
      { status: 503 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as { patentes?: string[] };
  const patentes = Array.from(
    new Set(
      (Array.isArray(body.patentes) ? body.patentes : [])
        .map((value) => normalizePatentToken(String(value ?? "")))
        .filter(Boolean),
    ),
  );

  if (patentes.length === 0) {
    return Response.json({ ok: false, error: "Indica al menos una patente." }, { status: 400 });
  }

  const glo3dMap = await lookupGlo3dByStocks(patentes);
  const byPatent: Record<
    string,
    { view3dUrl?: string; technicalFields: Record<string, unknown>; raw: Record<string, unknown> }
  > = {};

  for (const [patent, entry] of glo3dMap.entries()) {
    byPatent[patent] = {
      view3dUrl: entry.view3dUrl,
      technicalFields: entry.technicalFields,
      raw: entry.raw,
    };
  }

  return Response.json({
    ok: true,
    requested: patentes.length,
    matched: glo3dMap.size,
    byPatent,
    missing: patentes.filter((patente) => !glo3dMap.has(patente)),
  });
}
