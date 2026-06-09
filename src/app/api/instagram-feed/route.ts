import {
  decodeInstagramText,
  INSTAGRAM_FALLBACK_PROFILE,
  INSTAGRAM_PROFILE_URL,
  INSTAGRAM_USERNAME,
  type InstagramFeedResponse,
  type InstagramMediaItem,
  type InstagramProfile,
} from "@/lib/instagram";
import { NextResponse } from "next/server";

export const revalidate = 3600;

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const IG_APP_ID = "936619743392459";

type WebProfileUser = {
  username?: string;
  full_name?: string;
  biography?: string;
  profile_pic_url_hd?: string;
  profile_pic_url?: string;
  edge_followed_by?: { count?: number };
  edge_follow?: { count?: number };
  edge_owner_to_timeline_media?: {
    count?: number;
    edges?: Array<{
      node?: {
        id?: string;
        shortcode?: string;
        display_url?: string;
        thumbnail_src?: string;
        is_video?: boolean;
        edge_media_to_caption?: {
          edges?: Array<{ node?: { text?: string } }>;
        };
      };
    }>;
  };
};

function buildFallbackResponse(): InstagramFeedResponse {
  return {
    profile: INSTAGRAM_FALLBACK_PROFILE,
    items: [],
    source: "fallback",
  };
}

function mapWebProfileUser(user: WebProfileUser): {
  profile: InstagramProfile;
  items: InstagramMediaItem[];
} {
  const edges = user.edge_owner_to_timeline_media?.edges ?? [];
  const items = edges
    .map((edge): InstagramMediaItem | null => {
      const node = edge.node;
      if (!node?.shortcode) return null;
      const caption =
        node.edge_media_to_caption?.edges?.[0]?.node?.text?.trim() ??
        "Publicación de Instagram";
      return {
        id: node.id ?? node.shortcode,
        imageUrl: node.display_url ?? node.thumbnail_src,
        permalink: `https://www.instagram.com/p/${node.shortcode}/`,
        caption: decodeInstagramText(caption),
        isVideo: Boolean(node.is_video),
      };
    })
    .filter((item): item is InstagramMediaItem => item !== null)
    .slice(0, 12);

  const profile: InstagramProfile = {
    username: user.username ?? INSTAGRAM_USERNAME,
    fullName: decodeInstagramText(user.full_name ?? INSTAGRAM_FALLBACK_PROFILE.fullName),
    biography: decodeInstagramText(user.biography ?? INSTAGRAM_FALLBACK_PROFILE.biography),
    profilePictureUrl: user.profile_pic_url_hd ?? user.profile_pic_url,
    followersCount: user.edge_followed_by?.count,
    followingCount: user.edge_follow?.count,
    postsCount: user.edge_owner_to_timeline_media?.count,
    profileUrl: INSTAGRAM_PROFILE_URL,
  };

  return { profile, items };
}

async function fetchFromGraphApi(token: string): Promise<InstagramFeedResponse | null> {
  try {
    const profileRes = await fetch(
      `https://graph.instagram.com/me?fields=id,username,account_type,media_count,followers_count,follows_count,name,biography,profile_picture_url&access_token=${encodeURIComponent(token)}`,
      { next: { revalidate: 3600 } },
    );
    if (!profileRes.ok) return null;

    const profileData = (await profileRes.json()) as {
      id?: string;
      username?: string;
      name?: string;
      biography?: string;
      profile_picture_url?: string;
      followers_count?: number;
      follows_count?: number;
      media_count?: number;
    };

    const mediaRes = await fetch(
      `https://graph.instagram.com/me/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp&limit=12&access_token=${encodeURIComponent(token)}`,
      { next: { revalidate: 3600 } },
    );
    const mediaData = mediaRes.ok
      ? ((await mediaRes.json()) as {
          data?: Array<{
            id: string;
            caption?: string;
            media_type?: string;
            media_url?: string;
            thumbnail_url?: string;
            permalink?: string;
          }>;
        })
      : { data: [] };

    const items: InstagramMediaItem[] = (mediaData.data ?? [])
      .map((entry) => ({
        id: entry.id,
        imageUrl:
          entry.media_type === "VIDEO"
            ? entry.thumbnail_url ?? entry.media_url
            : entry.media_url ?? entry.thumbnail_url,
        permalink: entry.permalink ?? INSTAGRAM_PROFILE_URL,
        caption: entry.caption?.trim() || "Publicación de Instagram",
        isVideo: entry.media_type === "VIDEO",
      }))
      .filter((item) => Boolean(item.permalink));

    return {
      profile: {
        username: profileData.username ?? INSTAGRAM_USERNAME,
        fullName: profileData.name ?? INSTAGRAM_FALLBACK_PROFILE.fullName,
        biography: profileData.biography ?? INSTAGRAM_FALLBACK_PROFILE.biography,
        profilePictureUrl: profileData.profile_picture_url,
        followersCount: profileData.followers_count,
        followingCount: profileData.follows_count,
        postsCount: profileData.media_count,
        profileUrl: profileData.username
          ? `https://www.instagram.com/${profileData.username}/`
          : INSTAGRAM_PROFILE_URL,
      },
      items,
      source: "graph_api",
    };
  } catch {
    return null;
  }
}

async function fetchFromWebProfile(): Promise<InstagramFeedResponse | null> {
  try {
    const response = await fetch(
      `https://www.instagram.com/api/v1/users/web_profile_info/?username=${INSTAGRAM_USERNAME}`,
      {
        headers: {
          "user-agent": USER_AGENT,
          "x-ig-app-id": IG_APP_ID,
          "x-requested-with": "XMLHttpRequest",
          accept: "*/*",
          referer: `https://www.instagram.com/${INSTAGRAM_USERNAME}/`,
        },
        next: { revalidate: 3600 },
      },
    );

    if (!response.ok) return null;

    const payload = (await response.json()) as { data?: { user?: WebProfileUser } };
    const user = payload.data?.user;
    if (!user) return null;

    const mapped = mapWebProfileUser(user);
    return {
      ...mapped,
      source: "web_profile",
    };
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const graphToken = process.env.INSTAGRAM_ACCESS_TOKEN?.trim();
    if (graphToken) {
      const graphResult = await fetchFromGraphApi(graphToken);
      if (graphResult) {
        return NextResponse.json(graphResult satisfies InstagramFeedResponse);
      }
    }

    const webResult = await fetchFromWebProfile();
    if (webResult) {
      return NextResponse.json(webResult satisfies InstagramFeedResponse);
    }

    return NextResponse.json(buildFallbackResponse());
  } catch {
    return NextResponse.json(buildFallbackResponse());
  }
}
