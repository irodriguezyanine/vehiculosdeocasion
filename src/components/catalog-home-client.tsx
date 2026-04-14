"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { CatalogCard } from "@/components/catalog-card";
import type { CatalogFeed, CatalogItem } from "@/types/catalog";
import { DEFAULT_EDITOR_CONFIG, type EditorConfig, type SectionId, type VehicleTypeId } from "@/types/editor";

const EDITOR_STORAGE_KEY = "vedisa_editor_config_local";
const SECTION_LABELS: Record<SectionId, string> = {
  "proximos-remates": "Proximos remates",
  "ventas-directas": "Ventas directas",
  novedades: "Novedades",
  catalogo: "Catalogo",
};

function normalizeText(value?: string): string {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function getVehicleKey(item: CatalogItem): string {
  const raw = item.raw as Record<string, unknown>;
  const patent = [raw.patente, raw.PATENTE, raw.PPU, raw.stock_number]
    .find((value) => typeof value === "string" && value.trim().length > 0) as string | undefined;
  if (patent) return patent.toUpperCase().replace(/\s+/g, "").replace(/-/g, "");
  return item.id;
}

function inferVehicleType(item: CatalogItem): VehicleTypeId {
  const raw = item.raw as Record<string, unknown>;
  const sample = normalizeText(
    [item.title, item.subtitle, raw.categoria, raw.tipo_vehiculo, raw.description]
      .filter(Boolean)
      .join(" "),
  );

  if (/(camion|camión|bus|tracto|tolva|pesad|semi|rampla|grua)/.test(sample)) return "pesados";
  if (/(retro|excav|motoniv|bulldo|cargador|grua horquilla|maquinaria)/.test(sample)) return "maquinaria";
  if (/(auto|suv|sedan|hatch|pickup|camioneta|station)/.test(sample)) return "livianos";
  return "otros";
}

function formatPrice(value?: string): string | null {
  if (!value?.trim()) return null;
  const clean = value.replace(/[^\d]/g, "");
  if (!clean) return null;
  const amount = Number(clean);
  if (!Number.isFinite(amount)) return null;
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(amount);
}

function sectionFallback(items: CatalogItem[], start: number, count: number): CatalogItem[] {
  return items.slice(start, start + count);
}

type FeaturedStripProps = {
  items: CatalogItem[];
};

function FeaturedStrip({ items }: FeaturedStripProps) {
  if (items.length === 0) return null;

  return (
    <section className="section-shell">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="premium-kicker">Selecciones premium</p>
          <h2 className="text-2xl font-bold text-slate-900">Vitrina destacada</h2>
        </div>
        <p className="text-xs text-slate-500">Desliza horizontalmente</p>
      </div>
      <div className="featured-strip">
        {items.map((item) => (
          <article key={`featured-${item.id}`} className="featured-item">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.thumbnail ?? item.images[0] ?? "/placeholder-car.svg"}
              alt={item.title}
              className="featured-image"
              loading="lazy"
            />
            <div className="featured-overlay" />
            <div className="featured-content">
              <p className="line-clamp-1 text-sm font-semibold uppercase tracking-wide text-cyan-700">
                {item.status ?? "Unidad disponible"}
              </p>
              <h3 className="line-clamp-2 text-xl font-bold text-white">{item.title}</h3>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-100">
                {item.subtitle ? <span className="featured-chip">{item.subtitle}</span> : null}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

type SectionProps = {
  id: SectionId;
  title: string;
  subtitle: string;
  items: CatalogItem[];
  priceMap: Record<string, string>;
};

function Section({ id, title, subtitle, items, priceMap }: SectionProps) {
  return (
    <section id={id} className="section-shell scroll-mt-24">
      <header className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="premium-kicker">Seccion destacada</p>
          <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
          <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
        </div>
        <span className="inline-flex w-fit rounded-full bg-cyan-100 px-3 py-1 text-xs font-semibold text-cyan-900">
          {items.length} publicaciones
        </span>
      </header>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
          No hay elementos disponibles en esta seccion por ahora.
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <CatalogCard key={`${id}-${item.id}`} item={item} priceLabel={formatPrice(priceMap[getVehicleKey(item)])} />
          ))}
        </div>
      )}
    </section>
  );
}

type Props = {
  feed: CatalogFeed;
};

export function CatalogHomeClient({ feed }: Props) {
  const [config, setConfig] = useState<EditorConfig>(DEFAULT_EDITOR_CONFIG);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeEditorSection, setActiveEditorSection] = useState<SectionId>("proximos-remates");
  const [activeTypeTab, setActiveTypeTab] = useState<VehicleTypeId>("livianos");
  const [searchTerm, setSearchTerm] = useState("");
  const [loginEmail, setLoginEmail] = useState("jpmontero@vedisaremates.cl");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const items = feed.items;

  useEffect(() => {
    void (async () => {
      const sessionRes = await fetch("/api/admin/session", { cache: "no-store" });
      const session = (await sessionRes.json()) as { loggedIn?: boolean };
      setIsAdmin(Boolean(session.loggedIn));
      const configRes = await fetch("/api/admin/editor-config", { cache: "no-store" });
      if (configRes.ok) {
        const payload = (await configRes.json()) as { config?: EditorConfig };
        if (payload.config) {
          setConfig(payload.config);
          localStorage.setItem(EDITOR_STORAGE_KEY, JSON.stringify(payload.config));
          return;
        }
      }
      const local = localStorage.getItem(EDITOR_STORAGE_KEY);
      if (local) {
        setConfig(JSON.parse(local) as EditorConfig);
      }
    })();
  }, []);

  const itemsByKey = useMemo(() => {
    const map = new Map<string, CatalogItem>();
    for (const item of items) {
      map.set(getVehicleKey(item), item);
    }
    return map;
  }, [items]);

  const visibleItems = useMemo(
    () => items.filter((item) => !config.hiddenVehicleIds.includes(getVehicleKey(item))),
    [items, config.hiddenVehicleIds],
  );

  const getSectionItems = (sectionId: SectionId, fallback: CatalogItem[]): CatalogItem[] => {
    const selected = config.sectionVehicleIds[sectionId] ?? [];
    if (selected.length === 0) return fallback;
    return selected.map((id) => itemsByKey.get(id)).filter((item): item is CatalogItem => !!item);
  };

  const proximosByKeyword = visibleItems.filter((item) =>
    normalizeText([item.status, item.subtitle, item.title, item.location].filter(Boolean).join(" ")).includes("proxim"),
  );
  const ventasByKeyword = visibleItems.filter((item) =>
    normalizeText([item.status, item.subtitle, item.title].filter(Boolean).join(" ")).includes("venta directa"),
  );
  const novedadesByKeyword = visibleItems.filter((item) =>
    normalizeText([item.status, item.subtitle, item.title].filter(Boolean).join(" ")).includes("novedad"),
  );

  const proximosRemates = getSectionItems(
    "proximos-remates",
    proximosByKeyword.length > 0 ? proximosByKeyword.slice(0, 12) : sectionFallback(visibleItems, 0, 12),
  );
  const ventasDirectas = getSectionItems(
    "ventas-directas",
    ventasByKeyword.length > 0 ? ventasByKeyword.slice(0, 12) : sectionFallback(visibleItems, 10, 12),
  );
  const novedades = getSectionItems(
    "novedades",
    novedadesByKeyword.length > 0 ? novedadesByKeyword.slice(0, 12) : sectionFallback(visibleItems, 20, 12),
  );
  const catalogoItems = getSectionItems("catalogo", visibleItems);
  const filteredCatalogItems = catalogoItems.filter((item) => inferVehicleType(item) === activeTypeTab);

  const stats = [
    { label: "Publicaciones activas", value: String(visibleItems.length) },
    { label: "Cobertura", value: "Nacional" },
    { label: "Vehiculos con fotos", value: String(visibleItems.filter((item) => item.images.length > 0).length) },
    { label: "Visores 3D activos", value: String(visibleItems.filter((item) => !!item.view3dUrl).length) },
  ];

  const filteredEditorItems = useMemo(() => {
    const query = normalizeText(searchTerm);
    const source = query
      ? items.filter((item) => normalizeText(`${item.title} ${item.subtitle ?? ""}`).includes(query))
      : items;
    return source.slice(0, 120);
  }, [items, searchTerm]);

  const toggleItemInSection = (sectionId: SectionId, itemKey: string) => {
    setConfig((prev) => {
      const current = new Set(prev.sectionVehicleIds[sectionId] ?? []);
      if (current.has(itemKey)) current.delete(itemKey);
      else current.add(itemKey);
      return {
        ...prev,
        sectionVehicleIds: { ...prev.sectionVehicleIds, [sectionId]: Array.from(current) },
      };
    });
  };

  const toggleHidden = (itemKey: string) => {
    setConfig((prev) => {
      const set = new Set(prev.hiddenVehicleIds);
      if (set.has(itemKey)) set.delete(itemKey);
      else set.add(itemKey);
      return { ...prev, hiddenVehicleIds: Array.from(set) };
    });
  };

  const setPrice = (itemKey: string, value: string) => {
    setConfig((prev) => ({
      ...prev,
      vehiclePrices: { ...prev.vehiclePrices, [itemKey]: value },
    }));
  };

  const saveConfig = async () => {
    setSaving(true);
    localStorage.setItem(EDITOR_STORAGE_KEY, JSON.stringify(config));
    const response = await fetch("/api/admin/editor-config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ config }),
    });
    setSaving(false);
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({ error: "No se pudo guardar." }))) as { error?: string };
      alert(payload.error ?? "No se pudo guardar en servidor. Se dejó guardado localmente.");
      return;
    }
    alert("Configuración guardada.");
  };

  const login = async () => {
    setLoginError("");
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: loginEmail, password: loginPassword }),
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({ error: "No se pudo iniciar sesión." }))) as { error?: string };
      setLoginError(payload.error ?? "No se pudo iniciar sesión.");
      return;
    }
    setShowLogin(false);
    setLoginPassword("");
    setIsAdmin(true);
  };

  const logout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    setIsAdmin(false);
  };

  return (
    <main className="premium-bg min-h-screen text-slate-900">
      <div className="premium-glow premium-glow-cyan" />
      <div className="premium-glow premium-glow-gold" />

      <section className="relative z-10 border-b border-cyan-100 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <Image src="/vedisa-logo.png" alt="Logo Vedisa Remates" width={440} height={90} priority className="h-auto w-full max-w-md" />
            <div className="flex items-center gap-2">
              <nav className="flex flex-wrap gap-2 text-sm">
                <a href="#proximos-remates" className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-700 transition hover:border-cyan-400 hover:text-cyan-700">
                  Proximos remates
                </a>
                <a href="#ventas-directas" className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-700 transition hover:border-cyan-400 hover:text-cyan-700">
                  Ventas directas
                </a>
                <a href="#novedades" className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-700 transition hover:border-cyan-400 hover:text-cyan-700">
                  Novedades
                </a>
                <a href="#catalogo" className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-700 transition hover:border-cyan-400 hover:text-cyan-700">
                  Catalogo
                </a>
              </nav>
              {isAdmin ? (
                <button className="rounded-full bg-slate-900 px-3 py-1 text-xs text-white" onClick={logout}>
                  Salir editor
                </button>
              ) : (
                <button className="rounded-full bg-cyan-600 px-3 py-1 text-xs text-white" onClick={() => setShowLogin(true)}>
                  Modo editor
                </button>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-600">Plataforma de exhibicion de remates e inventario con integración automatica.</p>
            <span className="rounded-full bg-cyan-600 px-3 py-1 text-xs font-semibold text-white">{visibleItems.length} vehiculos</span>
          </div>
          {feed.warning ? (
            <p className="rounded-md border border-amber-300/60 bg-amber-100 px-3 py-2 text-sm text-amber-900">{feed.warning}</p>
          ) : null}
        </div>
      </section>

      {isAdmin ? (
        <section className="relative z-10 mx-auto mt-6 max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="section-shell space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-slate-900">Modo editor administrador</h3>
              <button onClick={saveConfig} disabled={saving} className="rounded-md bg-cyan-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
                {saving ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(SECTION_LABELS) as SectionId[]).map((section) => (
                <button
                  key={section}
                  onClick={() => setActiveEditorSection(section)}
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    section === activeEditorSection ? "bg-cyan-600 text-white" : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {SECTION_LABELS[section]}
                </button>
              ))}
            </div>
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Buscar vehículo para editar..."
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
            />
            <div className="max-h-96 overflow-auto rounded-lg border border-slate-200">
              {filteredEditorItems.map((item) => {
                const key = getVehicleKey(item);
                const selected = (config.sectionVehicleIds[activeEditorSection] ?? []).includes(key);
                const hidden = config.hiddenVehicleIds.includes(key);
                return (
                  <div key={`editor-${key}`} className="grid grid-cols-12 items-center gap-2 border-b border-slate-100 px-3 py-2 text-xs">
                    <div className="col-span-4 font-medium text-slate-700">{item.title}</div>
                    <label className="col-span-2 flex items-center gap-1">
                      <input type="checkbox" checked={selected} onChange={() => toggleItemInSection(activeEditorSection, key)} />
                      Mostrar en seccion
                    </label>
                    <label className="col-span-2 flex items-center gap-1">
                      <input type="checkbox" checked={!hidden} onChange={() => toggleHidden(key)} />
                      Visible
                    </label>
                    <input
                      className="col-span-4 rounded border border-slate-200 px-2 py-1"
                      placeholder="Precio CLP (opcional)"
                      value={config.vehiclePrices[key] ?? ""}
                      onChange={(event) => setPrice(key, event.target.value)}
                    />
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-slate-500">Se muestran 120 resultados por búsqueda para edición rápida.</p>
          </div>
        </section>
      ) : null}

      <section className="relative z-10 mx-auto grid max-w-7xl gap-6 px-4 py-10 sm:px-6 lg:grid-cols-5 lg:px-8">
        <div className="premium-panel premium-panel-hero lg:col-span-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">Landing Premium</p>
          <h1 className="mt-3 text-3xl font-black leading-tight text-slate-900 md:text-5xl">
            Plataforma corporativa para exhibir remates y ventas de alto impacto.
          </h1>
          <p className="mt-4 max-w-2xl text-sm text-slate-600 md:text-base">
            Vedisaremates conecta inventario, fotografias y visores 3D para una vitrina digital moderna, confiable y enfocada en conversion.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a href="#catalogo" className="premium-btn-primary">Ver catalogo completo</a>
            <a href="#proximos-remates" className="premium-btn-secondary">Explorar secciones</a>
          </div>
        </div>
        <div className="grid gap-3 lg:col-span-2">
          {stats.map((stat) => (
            <div key={stat.label} className="premium-stat">
              <p className="text-xs uppercase tracking-widest text-slate-500">{stat.label}</p>
              <p className="mt-1 text-xl font-bold text-slate-900">{stat.value}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="relative z-10 mx-auto flex max-w-7xl flex-col gap-14 px-4 pb-14 sm:px-6 lg:px-8">
        <FeaturedStrip items={visibleItems.slice(0, 8)} />
        <Section id="proximos-remates" title="Proximos remates" subtitle="Vehiculos en agenda con mayor prioridad comercial." items={proximosRemates} priceMap={config.vehiclePrices} />
        <Section id="ventas-directas" title="Ventas Directas" subtitle="Stock disponible para cierre rapido." items={ventasDirectas} priceMap={config.vehiclePrices} />
        <Section id="novedades" title="Novedades" subtitle="Ultimas unidades ingresadas al ecosistema Vedisa." items={novedades} priceMap={config.vehiclePrices} />

        <section id="catalogo" className="section-shell scroll-mt-24">
          <header className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="premium-kicker">Catalogo</p>
              <h2 className="text-2xl font-bold text-slate-900">Inventario por tipo de vehiculo</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {(["livianos", "pesados", "maquinaria", "otros"] as VehicleTypeId[]).map((type) => (
                <button
                  key={type}
                  onClick={() => setActiveTypeTab(type)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    activeTypeTab === type ? "bg-cyan-600 text-white" : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {type === "livianos" ? "Vehiculos livianos" : type === "pesados" ? "Vehiculos pesados" : type === "maquinaria" ? "Maquinaria" : "Otros"}
                </button>
              ))}
            </div>
          </header>
          {filteredCatalogItems.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
              No hay vehículos para esta pestaña.
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {filteredCatalogItems.map((item) => (
                <CatalogCard key={`catalog-${item.id}`} item={item} priceLabel={formatPrice(config.vehiclePrices[getVehicleKey(item)])} />
              ))}
            </div>
          )}
        </section>
      </div>

      {showLogin ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-2xl">
            <h3 className="text-lg font-semibold text-slate-900">Ingresar a modo editor</h3>
            <p className="mt-1 text-sm text-slate-500">Solo administradores pueden editar categorías y vehículos.</p>
            <div className="mt-4 space-y-2">
              <input value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm" placeholder="Correo" />
              <input type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm" placeholder="Contraseña" />
            </div>
            {loginError ? <p className="mt-2 text-xs text-red-600">{loginError}</p> : null}
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setShowLogin(false)} className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-600">Cancelar</button>
              <button onClick={login} className="rounded-md bg-cyan-600 px-3 py-2 text-sm font-semibold text-white">Entrar</button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
