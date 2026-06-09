"use client";

import {
  formatInstagramCount,
  INSTAGRAM_FALLBACK_PROFILE,
  INSTAGRAM_HANDLE,
  INSTAGRAM_PROFILE_URL,
  type InstagramFeedResponse,
  type InstagramMediaItem,
  type InstagramProfile,
} from "@/lib/instagram";
import { useEffect, useMemo, useState } from "react";

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
    </svg>
  );
}

function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="instagram-stat">
      <span className="instagram-stat-value">{value}</span>
      <span className="instagram-stat-label">{label}</span>
    </div>
  );
}

function ProfileAvatar({
  profile,
  loading,
}: {
  profile: InstagramProfile;
  loading: boolean;
}) {
  const initials = profile.fullName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div className="instagram-avatar-ring">
      <div className="instagram-avatar-inner">
        {loading ? (
          <div className="instagram-skeleton h-full w-full rounded-full" />
        ) : profile.profilePictureUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.profilePictureUrl}
            alt={`Foto de perfil de ${profile.username}`}
            className="h-full w-full rounded-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-[#f09433] via-[#dc2743] to-[#bc1888] text-lg font-bold text-white">
            {initials || "VO"}
          </div>
        )}
      </div>
    </div>
  );
}

function MediaTile({ item }: { item: InstagramMediaItem }) {
  return (
    <a
      href={item.permalink}
      target="_blank"
      rel="noreferrer"
      className="instagram-media-tile ui-focus group"
      aria-label={item.caption || "Ver publicación en Instagram"}
    >
      {item.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.imageUrl}
          alt={item.caption || "Publicación de Instagram"}
          className="instagram-media-image"
          loading="lazy"
        />
      ) : (
        <div className="instagram-media-placeholder">
          <InstagramIcon className="h-8 w-8 text-white/90" />
        </div>
      )}
      <div className="instagram-media-overlay">
        <div className="instagram-media-overlay-content">
          {item.isVideo ? (
            <span className="instagram-media-badge">Reel</span>
          ) : null}
          <p className="line-clamp-2 text-sm font-semibold text-white">
            {item.caption?.trim() || "Ver publicación"}
          </p>
          <span className="text-xs text-amber-100">Abrir en Instagram</span>
        </div>
      </div>
    </a>
  );
}

function PlaceholderGrid() {
  return (
    <div className="instagram-grid">
      {Array.from({ length: 6 }).map((_, index) => (
        <a
          key={`instagram-placeholder-${index}`}
          href={INSTAGRAM_PROFILE_URL}
          target="_blank"
          rel="noreferrer"
          className="instagram-media-tile instagram-media-tile--placeholder ui-focus"
          aria-label="Ver perfil en Instagram"
        >
          <div className="instagram-media-placeholder">
            <InstagramIcon className="h-7 w-7 text-white/85" />
          </div>
          <div className="instagram-media-overlay">
            <span className="text-xs font-semibold uppercase tracking-wide text-white">
              @{INSTAGRAM_FALLBACK_PROFILE.username}
            </span>
          </div>
        </a>
      ))}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="instagram-panel">
      <div className="instagram-profile-row">
        <div className="instagram-avatar-ring opacity-70">
          <div className="instagram-skeleton h-[76px] w-[76px] rounded-full sm:h-[88px] sm:w-[88px]" />
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div className="instagram-skeleton h-5 w-40 rounded-full" />
          <div className="flex gap-6">
            <div className="instagram-skeleton h-10 w-16 rounded-lg" />
            <div className="instagram-skeleton h-10 w-16 rounded-lg" />
            <div className="instagram-skeleton h-10 w-16 rounded-lg" />
          </div>
          <div className="instagram-skeleton h-4 w-full max-w-md rounded" />
        </div>
      </div>
      <div className="instagram-grid mt-5">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={`ig-skel-${index}`} className="instagram-skeleton aspect-square rounded-xl" />
        ))}
      </div>
    </div>
  );
}

export function InstagramSection() {
  const [loading, setLoading] = useState(true);
  const [feed, setFeed] = useState<InstagramFeedResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loadFeed = async () => {
      try {
        const response = await fetch("/api/instagram-feed");
        if (!response.ok) return;
        const payload = (await response.json()) as InstagramFeedResponse;
        if (!cancelled) setFeed(payload);
      } catch {
        // sin bloqueo del home
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void loadFeed();
    return () => {
      cancelled = true;
    };
  }, []);

  const profile = feed?.profile ?? INSTAGRAM_FALLBACK_PROFILE;
  const items = useMemo(
    () => (feed?.items ?? []).filter((item) => Boolean(item.permalink)).slice(0, 12),
    [feed?.items],
  );
  const hasMedia = items.length > 0;

  return (
    <section className="section-shell instagram-section" aria-labelledby="instagram-section-title">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="premium-kicker">Instagram</p>
          <h2 id="instagram-section-title" className="text-2xl font-bold text-[#2f1e13]">
            Galería social
          </h2>
          <p className="mt-1 max-w-xl text-sm text-[#6f583f]">
            Sigue nuestro día a día: unidades nuevas, behind the scenes y novedades del catálogo.
          </p>
        </div>
        <a
          href={INSTAGRAM_PROFILE_URL}
          target="_blank"
          rel="noreferrer"
          className="ui-focus premium-btn-secondary inline-flex items-center gap-2 text-xs sm:text-sm"
        >
          <InstagramIcon className="h-4 w-4" />
          Seguir {INSTAGRAM_HANDLE}
        </a>
      </div>

      {loading ? <LoadingSkeleton /> : null}

      {!loading ? (
        <div className="instagram-panel">
          <div className="instagram-profile-row">
            <ProfileAvatar profile={profile} loading={false} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <h3 className="text-lg font-bold text-[#2f1e13] sm:text-xl">{INSTAGRAM_HANDLE}</h3>
                <a
                  href={INSTAGRAM_PROFILE_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="ui-focus instagram-follow-btn"
                >
                  Seguir
                </a>
              </div>
              <p className="mt-0.5 text-sm font-semibold text-[#5a4030]">{profile.fullName}</p>

              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
                <StatBlock label="publicaciones" value={formatInstagramCount(profile.postsCount)} />
                <StatBlock label="seguidores" value={formatInstagramCount(profile.followersCount)} />
                <StatBlock label="siguiendo" value={formatInstagramCount(profile.followingCount)} />
              </div>

              {profile.biography ? (
                <p className="mt-3 max-w-2xl whitespace-pre-line text-sm leading-relaxed text-[#6f583f]">
                  {profile.biography}
                </p>
              ) : null}
            </div>
          </div>

          {hasMedia ? (
            <div className="instagram-grid mt-5">
              {items.map((item) => (
                <MediaTile key={`instagram-media-${item.id}`} item={item} />
              ))}
            </div>
          ) : (
            <div className="mt-5">
              <p className="mb-3 text-sm text-[#6f583f]">
                Explora el perfil y descubre las últimas publicaciones en Instagram.
              </p>
              <PlaceholderGrid />
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-amber-200/70 pt-4">
            <p className="text-xs text-[#8b6546]">
              {feed?.source === "graph_api" || feed?.source === "web_profile"
                ? "Contenido actualizado desde Instagram"
                : "Visita nuestro perfil para ver fotos y reels en vivo"}
            </p>
            <a
              href={INSTAGRAM_PROFILE_URL}
              target="_blank"
              rel="noreferrer"
              className="ui-focus text-sm font-semibold text-amber-800 underline decoration-amber-300 underline-offset-2 hover:text-amber-900"
            >
              Ver todo en Instagram →
            </a>
          </div>
        </div>
      ) : null}
    </section>
  );
}
