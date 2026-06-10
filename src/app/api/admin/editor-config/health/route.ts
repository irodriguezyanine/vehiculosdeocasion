import { cookies } from "next/headers";
import { ADMIN_SESSION_COOKIE_NAME, verifyAdminSessionToken } from "@/lib/admin-session";
import { checkEditorPersistenceHealth, getEditorScopeId } from "@/lib/editor-config";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE_NAME)?.value;
  const session = verifyAdminSessionToken(token);
  if (!session.valid || !session.email) {
    return Response.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }

  const health = await checkEditorPersistenceHealth();
  if (!health.ok) {
    return Response.json({ ok: false, error: health.error }, { status: 503 });
  }

  return Response.json({ ok: true, scopeId: getEditorScopeId() });
}
