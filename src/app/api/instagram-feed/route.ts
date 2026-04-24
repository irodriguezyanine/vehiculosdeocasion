import { NextResponse } from "next/server";

type InstagramEdge = {
  node?: {
    id?: string;
    display_url?: string;
    thumbnail_src?: string;
    permalink?: string;
    edge_media_to_caption?: {
      edges?: Array<{ node?: { text?: string } }>;
    };
  };
};

export async function GET() {
  try {
    const response = await fetch(
      "https://www.instagram.com/api/v1/users/web_profile_info/?username=autosdeoc",
      {
        headers: {
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
          "x-ig-app-id": "936619743392459",
        },
        cache: "no-store",
      },
    );

    if (!response.ok) {
      return NextResponse.json({ items: [] });
    }

    const payload = (await response.json()) as {
      data?: {
        user?: {
          edge_owner_to_timeline_media?: {
            edges?: InstagramEdge[];
          };
        };
      };
    };

    const edges = payload.data?.user?.edge_owner_to_timeline_media?.edges ?? [];
    const items = edges
      .map((edge) => {
        const node = edge.node;
        if (!node?.id) return null;
        return {
          id: node.id,
          imageUrl: node.display_url ?? node.thumbnail_src ?? "",
          permalink: node.permalink ?? "https://www.instagram.com/autosdeoc/",
          caption: node.edge_media_to_caption?.edges?.[0]?.node?.text ?? "",
        };
      })
      .filter((item): item is { id: string; imageUrl: string; permalink: string; caption: string } =>
        Boolean(item?.id && item.imageUrl),
      );

    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ items: [] });
  }
}

