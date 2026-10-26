import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function isAuthorized(req: Request): boolean {
  const secret = (
    process.env.OCASION_SYNC_WEBHOOK_SECRET ||
    process.env.CATALOG_SYNC_WEBHOOK_SECRET ||
    ""
  ).trim();
  if (!secret) return false;
  const header = req.headers.get("authorization") || "";
  const token = header.replace(/^Bearer\s+/i, "").trim();
  return token === secret;
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return Response.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }

  revalidatePath("/");
  revalidatePath("/api/catalogo");

  return Response.json({
    ok: true,
    eventType: "reconcile",
    revalidatedAt: new Date().toISOString(),
  });
}
