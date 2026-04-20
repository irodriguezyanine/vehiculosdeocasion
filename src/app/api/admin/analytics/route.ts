import { cookies } from "next/headers";
import { ADMIN_SESSION_COOKIE_NAME, verifyAdminSessionToken } from "@/lib/admin-session";
import { readAnalyticsEvents } from "@/lib/analytics";

export async function GET(req: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE_NAME)?.value;
  const session = verifyAdminSessionToken(token);
  if (!session.valid || !session.email) {
    return Response.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const days = Number(searchParams.get("days") ?? "30");
  const limit = Number(searchParams.get("limit") ?? "5000");

  const result = await readAnalyticsEvents({ days, limit });
  if (!result.ok) {
    return Response.json({ ok: false, error: result.error, events: [] }, { status: 400 });
  }

  return Response.json({ ok: true, events: result.events, source: "supabase" });
}
