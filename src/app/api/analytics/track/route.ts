import { trackAnalyticsEvent } from "@/lib/analytics";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    event?: string;
    timestamp?: string;
    itemKey?: string;
    section?: string;
    payload?: Record<string, unknown>;
  };

  const event = (body.event ?? "").trim();
  if (!event) {
    return Response.json({ ok: false, error: "event es requerido." }, { status: 400 });
  }

  const timestamp = body.timestamp ?? new Date().toISOString();
  const result = await trackAnalyticsEvent({
    event,
    timestamp,
    itemKey: body.itemKey,
    section: body.section,
    payload: body.payload,
  });

  if (!result.ok) {
    return Response.json({ ok: false, error: result.error }, { status: 400 });
  }

  return Response.json({ ok: true });
}
