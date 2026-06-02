import { NextRequest, NextResponse } from "next/server";

function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local")) return true;
  if (/^127\./.test(host)) return true;
  if (/^10\./.test(host)) return true;
  if (/^192\.168\./.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return true;
  return false;
}

function isAllowedImageUrl(url: URL): boolean {
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  if (isPrivateHost(url.hostname)) return false;

  const href = url.href.toLowerCase();
  if (href.includes("glo3d.net/iframe") || href.includes("<iframe")) return false;

  return (
    /\.(jpg|jpeg|png|webp|gif|bmp|avif)(\?|$)/i.test(href) ||
    /cloudinary|cloudfront|amazonaws|glo3d|supabase|cdn\.|img|image|media|vedisa|tasacion|foto|photo|thumb/i.test(
      href,
    )
  );
}

export async function GET(request: NextRequest) {
  const rawUrl = request.nextUrl.searchParams.get("url")?.trim();
  if (!rawUrl) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }

  if (!isAllowedImageUrl(parsed)) {
    return NextResponse.json({ error: "URL not allowed" }, { status: 403 });
  }

  try {
    const response = await fetch(parsed.toString(), {
      cache: "no-store",
      headers: {
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      },
    });
    if (!response.ok) {
      return NextResponse.json({ error: "Fetch failed" }, { status: 502 });
    }

    const contentType = (response.headers.get("content-type") ?? "image/jpeg").split(";")[0]?.trim() ?? "image/jpeg";
    if (!contentType.startsWith("image/")) {
      return NextResponse.json({ error: "Not an image" }, { status: 415 });
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength === 0) {
      return NextResponse.json({ error: "Empty image" }, { status: 502 });
    }

    const base64 = buffer.toString("base64");
    return NextResponse.json({
      dataUrl: `data:${contentType};base64,${base64}`,
      contentType,
    });
  } catch {
    return NextResponse.json({ error: "Proxy error" }, { status: 502 });
  }
}
