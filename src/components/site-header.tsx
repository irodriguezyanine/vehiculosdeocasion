"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useState } from "react";
import { SITE_NAV_LINKS } from "@/lib/site-content";

type SiteHeaderProps = {
  onLogoClick?: (event: React.MouseEvent<HTMLAnchorElement>) => void;
  onLoginClick?: () => void;
  isAdmin?: boolean;
  adminView?: "home" | "editor";
  onViewHome?: () => void;
  onOpenEditor?: () => void;
  onLogout?: () => void;
  children?: ReactNode;
};

function navLinkClass(isActive: boolean) {
  return `premium-link-pill ui-focus ${isActive ? "border-amber-400 bg-amber-700 text-white" : ""}`;
}

export function SiteHeader({
  onLogoClick,
  onLoginClick,
  isAdmin = false,
  adminView = "home",
  onViewHome,
  onOpenEditor,
  onLogout,
  children,
}: SiteHeaderProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const loginButton =
    onLoginClick != null ? (
      <button
        type="button"
        className="ui-focus rounded-full bg-amber-700 px-3 py-1 text-xs text-white transition hover:-translate-y-0.5 hover:bg-amber-600"
        onClick={onLoginClick}
      >
        Login
      </button>
    ) : (
      <Link
        href="/?login=1"
        className="ui-focus rounded-full bg-amber-700 px-3 py-1 text-xs text-white transition hover:-translate-y-0.5 hover:bg-amber-600"
        onClick={() => setMobileMenuOpen(false)}
      >
        Login
      </Link>
    );

  const adminButtons = isAdmin ? (
    <>
      {adminView === "editor" ? (
        <button
          type="button"
          className="ui-focus rounded-full border border-slate-300 bg-white px-3 py-1 text-xs text-slate-700 transition hover:-translate-y-0.5 hover:bg-slate-100"
          onClick={() => {
            onViewHome?.();
            setMobileMenuOpen(false);
          }}
        >
          Ver home
        </button>
      ) : (
        <button
          type="button"
          className="ui-focus rounded-full border border-amber-300 bg-stone-100 px-3 py-1 text-xs text-amber-800 transition hover:-translate-y-0.5 hover:bg-stone-200"
          onClick={() => {
            onOpenEditor?.();
            setMobileMenuOpen(false);
          }}
        >
          Volver al editor
        </button>
      )}
      <button
        type="button"
        className="ui-focus rounded-full bg-slate-900 px-3 py-1 text-xs text-white transition hover:-translate-y-0.5 hover:bg-slate-700"
        onClick={() => {
          onLogout?.();
          setMobileMenuOpen(false);
        }}
      >
        Salir editor
      </button>
    </>
  ) : (
    loginButton
  );

  return (
    <section className="top-nav-shell sticky z-30">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-3 py-2 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-3 md:gap-4">
          <Link href="/" className="inline-flex items-center gap-2" onClick={onLogoClick}>
            <Image
              src="/vehiculos-ocasion-logo.png"
              alt="Logo Vehículos de Ocasión"
              width={72}
              height={72}
              priority
              className="h-14 w-14 rounded-full object-cover sm:h-16 sm:w-16"
            />
            <span className="brand-wordmark hidden text-xl text-[#4d2f1d] sm:inline-block">
              Vehiculos de Ocasion
            </span>
          </Link>
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="ui-focus touch-target inline-flex items-center justify-center rounded-lg border border-amber-300/70 bg-[#fff8f1] text-[#6b3d1e] md:hidden"
            aria-label={mobileMenuOpen ? "Cerrar menu" : "Abrir menu"}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-main-menu"
          >
            <span className="text-lg leading-none">{mobileMenuOpen ? "×" : "☰"}</span>
          </button>
          <div className="hidden items-center gap-2 md:flex">
            <nav className="flex flex-wrap gap-2 text-sm">
              {SITE_NAV_LINKS.map((link) => {
                const isActive = pathname === link.pathMatch;
                return (
                  <Link key={link.href} href={link.href} className={navLinkClass(isActive)}>
                    {link.label}
                  </Link>
                );
              })}
            </nav>
            {adminButtons}
          </div>
        </div>
        {mobileMenuOpen ? (
          <>
            <button
              type="button"
              className="mobile-menu-backdrop md:hidden"
              aria-label="Cerrar menu"
              onClick={() => setMobileMenuOpen(false)}
            />
            <div id="mobile-main-menu" className="mobile-menu-panel rounded-lg border border-slate-200 bg-white p-3 md:hidden">
              <nav className="flex flex-col gap-2 text-sm">
                {SITE_NAV_LINKS.map((link) => {
                  const isActive = pathname === link.pathMatch;
                  return (
                    <Link
                      key={`mobile-${link.href}`}
                      href={link.href}
                      className={`${navLinkClass(isActive)} text-center`}
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      {link.label}
                    </Link>
                  );
                })}
              </nav>
              <div className="mt-3 flex flex-wrap gap-2">{adminButtons}</div>
            </div>
          </>
        ) : null}
        {children}
      </div>
    </section>
  );
}
