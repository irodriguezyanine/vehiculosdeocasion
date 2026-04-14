import { cookies } from "next/headers";
import { ADMIN_SESSION_COOKIE_NAME, verifyAdminSessionToken } from "@/lib/admin-session";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE_NAME)?.value;
  const session = verifyAdminSessionToken(token);
  return Response.json({ loggedIn: session.valid, email: session.email });
}
