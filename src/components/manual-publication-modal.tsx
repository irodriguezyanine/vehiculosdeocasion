"use client";

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { ManualPublicationDraft } from "@/lib/manual-publication-draft";
import type { SectionId, UpcomingAuction } from "@/types/editor";

const VEHICLE_CATEGORY_OPTIONS = [
  { value: "vehiculo_liviano", label: "Vehiculo liviano" },
  { value: "vehiculo_pesado", label: "Vehiculo pesado" },
  { value: "maquinaria", label: "Maquinaria" },
  { value: "chatarra", label: "Chatarra" },
  { value: "otros", label: "Otros" },
] as const;

const SECTION_LABELS: Record<SectionId, string> = {
  "proximos-remates": "Destacados",
  "ventas-directas": "Ventas directas",
  novedades: "Novedades",
  catalogo: "Catalogo",
};

type ManualPublicationModalProps = {
  mode?: "create" | "edit";
  draft: ManualPublicationDraft;
  setDraft: Dispatch<SetStateAction<ManualPublicationDraft>>;
  uploadedImages: string[];
  setUploadedImages: Dispatch<SetStateAction<string[]>>;
  uploading: boolean;
  autoredLookupLoading?: boolean;
  onPatenteLookup?: (patente: string) => void;
  onUploadFiles: (files: File[]) => Promise<void>;
  onClose: () => void;
  onSubmit: () => void;
  onMarkSold?: () => void;
  onDeleteManual?: () => void;
  vehicleSubtitle?: string;
  initialTab?: ModalTab;
  upcomingAuctions: UpcomingAuction[];
  formatAuctionDateLabel: (value: string) => string;
  toggleSection: (sectionId: SectionId) => void;
};

type ModalTab = "general" | "tecnica" | "medios" | "publicacion";

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-semibold text-slate-600">{label}</span>
      {children}
    </label>
  );
}

const inputClass =
  "ui-focus w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-slate-900";

export function ManualPublicationModal({
  mode = "create",
  draft,
  setDraft,
  uploadedImages,
  setUploadedImages,
  uploading,
  autoredLookupLoading = false,
  onPatenteLookup,
  onUploadFiles,
  onClose,
  onSubmit,
  onMarkSold,
  onDeleteManual,
  vehicleSubtitle,
  initialTab = "general",
  upcomingAuctions,
  formatAuctionDateLabel,
  toggleSection,
}: ManualPublicationModalProps) {
  const [tab, setTab] = useState<ModalTab>(initialTab);
  const [dropActive, setDropActive] = useState(false);
  const [draggedImageIndex, setDraggedImageIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isEditMode = mode === "edit";

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab, mode]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const patch = (partial: Partial<ManualPublicationDraft>) => {
    setDraft((prev) => ({ ...prev, ...partial }));
  };

  const tabs: Array<{ id: ModalTab; label: string }> = [
    { id: "general", label: "Datos principales" },
    { id: "tecnica", label: "Ficha tecnica" },
    { id: "medios", label: "Fotos y visor" },
    { id: "publicacion", label: "Publicacion" },
  ];

  return (
    <div
      className="fixed inset-0 z-[75] flex items-center justify-center bg-slate-950/75 p-3 backdrop-blur-sm sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isEditMode ? "Editar publicacion" : "Crear nueva publicacion"}
        className="manual-publication-modal flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-amber-200/50 bg-[#fffaf5] shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="border-b border-amber-200/60 bg-gradient-to-r from-[#f8efe4] to-[#fff8f1] px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-900">
                {isEditMode ? "Editar unidad" : "Nueva publicacion manual"}
              </p>
              <h3 className="mt-1 text-xl font-bold text-[#2f1d12]">
                {isEditMode ? "Gestionar ficha completa" : "Crear unidad sin GLO3D"}
              </h3>
              <p className="mt-1 max-w-2xl text-sm text-slate-600">
                {isEditMode ? (
                  <>
                    {vehicleSubtitle ? (
                      <span className="font-medium text-slate-700">{vehicleSubtitle}</span>
                    ) : null}
                    {vehicleSubtitle ? " · " : null}
                    Edita todos los datos, fotos y canales de publicacion desde un solo lugar.
                  </>
                ) : (
                  <>
                    Publica una unidad completa desde cero. Si luego llega la misma patente desde GLO3D, el sistema
                    conservara precio, canales y ficha editada.
                  </>
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="ui-focus inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-amber-300/70 bg-white text-lg text-slate-600 transition hover:bg-amber-50"
              aria-label="Cerrar"
            >
              ×
            </button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {tabs.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => setTab(entry.id)}
                className={`ui-focus rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  tab === entry.id
                    ? "bg-amber-700 text-white shadow-sm"
                    : "border border-amber-200 bg-white text-amber-900 hover:bg-amber-50"
                }`}
              >
                {entry.label}
              </button>
            ))}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {tab === "general" ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <section className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-amber-900">
                  Identificacion
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Patente *">
                    <div className="flex gap-2">
                      <input
                        className={inputClass}
                        value={draft.patente ?? ""}
                        onChange={(event) => patch({ patente: event.target.value.toUpperCase() })}
                        onBlur={(event) => onPatenteLookup?.(event.target.value)}
                        placeholder="ABCD12"
                      />
                      {autoredLookupLoading ? (
                        <span className="inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-2 text-xs font-medium text-amber-800">
                          Autored...
                        </span>
                      ) : null}
                    </div>
                  </Field>
                  <Field label="Verificador (DV)">
                    <input
                      className={inputClass}
                      value={draft.patenteVerifier ?? ""}
                      onChange={(event) => patch({ patenteVerifier: event.target.value })}
                    />
                  </Field>
                  <Field label="Titulo publicacion">
                    <input
                      className={inputClass}
                      value={draft.title ?? ""}
                      onChange={(event) => patch({ title: event.target.value })}
                      placeholder="Se autocompleta con marca/modelo si queda vacio"
                    />
                  </Field>
                  <Field label="Subtitulo">
                    <input
                      className={inputClass}
                      value={draft.subtitle ?? ""}
                      onChange={(event) => patch({ subtitle: event.target.value })}
                    />
                  </Field>
                  <Field label="VIN">
                    <input className={inputClass} value={draft.vin ?? ""} onChange={(event) => patch({ vin: event.target.value })} />
                  </Field>
                  <Field label="N° Chasis">
                    <input className={inputClass} value={draft.nChasis ?? ""} onChange={(event) => patch({ nChasis: event.target.value })} />
                  </Field>
                  <Field label="N° Motor">
                    <input className={inputClass} value={draft.nMotor ?? ""} onChange={(event) => patch({ nMotor: event.target.value })} />
                  </Field>
                  <Field label="N° Serie">
                    <input className={inputClass} value={draft.nSerie ?? ""} onChange={(event) => patch({ nSerie: event.target.value })} />
                  </Field>
                  <Field label="N° Siniestro" className="sm:col-span-2">
                    <input className={inputClass} value={draft.nSiniestro ?? ""} onChange={(event) => patch({ nSiniestro: event.target.value })} />
                  </Field>
                </div>
              </section>

              <section className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-amber-900">
                  Clasificacion comercial
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Marca">
                    <input className={inputClass} value={draft.brand ?? ""} onChange={(event) => patch({ brand: event.target.value })} />
                  </Field>
                  <Field label="Modelo">
                    <input className={inputClass} value={draft.model ?? ""} onChange={(event) => patch({ model: event.target.value })} />
                  </Field>
                  <Field label="Ano">
                    <input className={inputClass} value={draft.year ?? ""} onChange={(event) => patch({ year: event.target.value })} />
                  </Field>
                  <Field label="Version / Trim">
                    <input className={inputClass} value={draft.version ?? ""} onChange={(event) => patch({ version: event.target.value })} />
                  </Field>
                  <Field label="Tipo vehiculo">
                    <input className={inputClass} value={draft.tipoVehiculo ?? ""} onChange={(event) => patch({ tipoVehiculo: event.target.value })} />
                  </Field>
                  <Field label="Tipo unidad">
                    <input className={inputClass} value={draft.tipo ?? ""} onChange={(event) => patch({ tipo: event.target.value })} />
                  </Field>
                  <Field label="Categoria" className="sm:col-span-2">
                    <select
                      className={inputClass}
                      value={draft.category ?? ""}
                      onChange={(event) => patch({ category: event.target.value })}
                    >
                      <option value="">Seleccionar categoria</option>
                      {VEHICLE_CATEGORY_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Estado comercial">
                    <input className={inputClass} value={draft.status} onChange={(event) => patch({ status: event.target.value })} />
                  </Field>
                  <Field label="Condicion vehiculo">
                    <input
                      className={inputClass}
                      value={draft.vehicleCondition ?? ""}
                      onChange={(event) => patch({ vehicleCondition: event.target.value })}
                    />
                  </Field>
                  <Field label="Ubicacion comercial" className="sm:col-span-2">
                    <input className={inputClass} value={draft.location} onChange={(event) => patch({ location: event.target.value })} />
                  </Field>
                  <Field label="Ubicacion fisica" className="sm:col-span-2">
                    <input className={inputClass} value={draft.ubicacionFisica ?? ""} onChange={(event) => patch({ ubicacionFisica: event.target.value })} />
                  </Field>
                </div>
              </section>

              <section className="rounded-xl border border-slate-200 bg-white p-4 lg:col-span-2">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-amber-900">
                  Descripcion comercial
                </p>
                <div className="grid gap-3">
                  <Field label="Descripcion corta">
                    <textarea
                      className={`${inputClass} min-h-24`}
                      value={draft.description ?? ""}
                      onChange={(event) => patch({ description: event.target.value })}
                    />
                  </Field>
                  <Field label="Observaciones extendidas (HTML permitido)">
                    <textarea
                      className={`${inputClass} min-h-28 font-mono text-xs`}
                      value={draft.extendedDescription ?? ""}
                      onChange={(event) => patch({ extendedDescription: event.target.value })}
                    />
                  </Field>
                </div>
              </section>
            </div>
          ) : null}

          {tab === "tecnica" ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <section className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-900">Mecanica</p>
                  {onPatenteLookup ? (
                    <button
                      type="button"
                      className="rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={autoredLookupLoading || !(draft.patente ?? "").trim()}
                      onClick={() => onPatenteLookup(draft.patente ?? "")}
                    >
                      {autoredLookupLoading ? "Consultando Autored..." : "Completar desde Autored"}
                    </button>
                  ) : null}
                </div>
                <p className="mb-3 text-xs text-slate-500">
                  Color, combustible, transmision, traccion, aro y cilindrada se obtienen de Autored al consultar la patente.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {(
                    [
                      ["kilometraje", "Kilometraje"],
                      ["color", "Color"],
                      ["combustible", "Combustible"],
                      ["transmision", "Transmision"],
                      ["traccion", "Traccion"],
                      ["aro", "Aro"],
                      ["cilindrada", "Cilindrada"],
                      ["estadoAirbags", "Estado airbags"],
                    ] as const
                  ).map(([key, label]) => (
                    <Field key={key} label={label}>
                      <input
                        className={inputClass}
                        value={draft[key] ?? ""}
                        onChange={(event) => patch({ [key]: event.target.value })}
                      />
                    </Field>
                  ))}
                </div>
              </section>

              <section className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-amber-900">
                  Operacion y documentacion
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {(
                    [
                      ["llaves", "Llaves (SI/NO)"],
                      ["aireAcondicionado", "Aire acondicionado"],
                      ["unicoPropietario", "Unico propietario"],
                      ["condicionado", "Condicionado"],
                      ["multas", "Multas"],
                      ["tag", "Tag"],
                      ["pruebaMotor", "Prueba motor"],
                      ["pruebaDesplazamiento", "Prueba desplazamiento"],
                      ["vencRevisionTecnica", "Venc. revision tecnica"],
                      ["vencPermisoCirculacion", "Venc. permiso circulacion"],
                      ["vencSeguroObligatorio", "Venc. seguro obligatorio"],
                      ["transportista", "Transportista"],
                      ["taller", "Taller"],
                      ["nombrePropietarioAnterior", "Propietario anterior"],
                      ["rutPropietarioAnterior", "RUT propietario anterior"],
                      ["rutVerificador", "RUT verificador"],
                    ] as const
                  ).map(([key, label]) => (
                    <Field key={key} label={label}>
                      <input
                        className={inputClass}
                        value={draft[key] ?? ""}
                        onChange={(event) => patch({ [key]: event.target.value })}
                      />
                    </Field>
                  ))}
                </div>
              </section>
            </div>
          ) : null}

          {tab === "medios" ? (
            <div className="space-y-4">
              <section
                onDragOver={(event) => {
                  event.preventDefault();
                  setDropActive(true);
                }}
                onDragLeave={() => setDropActive(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setDropActive(false);
                  void onUploadFiles(Array.from(event.dataTransfer.files ?? []));
                }}
                className={`rounded-xl border-2 border-dashed p-5 text-center transition ${
                  dropActive ? "border-amber-600 bg-amber-50" : "border-stone-300 bg-white"
                }`}
              >
                <p className="text-sm font-semibold text-slate-800">Sube fotos desde tu equipo</p>
                <p className="mt-1 text-xs text-slate-500">
                  Arrastra imagenes o seleccionalas. Tambien puedes pegar URLs de Cloudinary.
                </p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="ui-focus mt-3 rounded-md bg-amber-700 px-4 py-2 text-xs font-semibold text-white transition hover:bg-amber-600 disabled:opacity-60"
                >
                  {uploading ? "Subiendo..." : "Seleccionar fotos"}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(event) => {
                    void onUploadFiles(Array.from(event.target.files ?? []));
                  }}
                />
              </section>

              {uploadedImages.length > 0 ? (
                <section className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Galeria ({uploadedImages.length}) — arrastra para ordenar
                  </p>
                  <div className="grid gap-2 sm:grid-cols-3 md:grid-cols-4">
                    {uploadedImages.map((imageUrl, index) => (
                      <div
                        key={`${imageUrl}-${index}`}
                        draggable
                        onDragStart={() => setDraggedImageIndex(index)}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={() => {
                          if (draggedImageIndex === null || draggedImageIndex === index) return;
                          setUploadedImages((prev) => {
                            const list = [...prev];
                            const [moved] = list.splice(draggedImageIndex, 1);
                            list.splice(index, 0, moved);
                            return list;
                          });
                          setDraggedImageIndex(null);
                        }}
                        className="group relative overflow-hidden rounded-lg border border-slate-200 bg-slate-100"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={imageUrl} alt={`Imagen ${index + 1}`} className="h-28 w-full object-cover" />
                        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/55 px-2 py-1 text-[10px] text-white">
                          <span>#{index + 1}</span>
                          <button
                            type="button"
                            onClick={() =>
                              setUploadedImages((prev) => prev.filter((_, imageIndex) => imageIndex !== index))
                            }
                            className="ui-focus rounded bg-white/20 px-1.5 py-0.5"
                          >
                            Quitar
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              <section className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-2">
                <Field label="URLs Cloudinary adicionales (separadas por coma)">
                  <textarea
                    className={`${inputClass} min-h-24`}
                    value={draft.imagesCsv}
                    onChange={(event) => patch({ imagesCsv: event.target.value })}
                    placeholder="https://res.cloudinary.com/..."
                  />
                </Field>
                <div className="space-y-3">
                  <Field label="Portada (URL opcional)">
                    <input className={inputClass} value={draft.thumbnail ?? ""} onChange={(event) => patch({ thumbnail: event.target.value })} />
                  </Field>
                  <Field label="Visor 3D (URL opcional)">
                    <input className={inputClass} value={draft.view3dUrl ?? ""} onChange={(event) => patch({ view3dUrl: event.target.value })} />
                  </Field>
                </div>
              </section>
            </div>
          ) : null}

          {tab === "publicacion" ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <section className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-amber-900">Precios</p>
                <div className="space-y-3">
                  <Field label="Precio normal (CLP)">
                    <input
                      className={inputClass}
                      value={draft.normalPrice}
                      onChange={(event) => patch({ normalPrice: event.target.value })}
                    />
                  </Field>
                  <label className="inline-flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
                    <input
                      type="checkbox"
                      checked={draft.promoEnabled}
                      onChange={(event) => patch({ promoEnabled: event.target.checked })}
                    />
                    Activar precio promocional
                  </label>
                  {draft.promoEnabled ? (
                    <Field label="Precio promocional (CLP)">
                      <input
                        className={`${inputClass} font-semibold text-amber-900`}
                        value={draft.promoPrice}
                        onChange={(event) => patch({ promoPrice: event.target.value })}
                      />
                    </Field>
                  ) : null}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Impuesto / tasas">
                      <input className={inputClass} value={draft.taxFee ?? ""} onChange={(event) => patch({ taxFee: event.target.value })} />
                    </Field>
                    <Field label="Gastos transferencia">
                      <input className={inputClass} value={draft.transferFee ?? ""} onChange={(event) => patch({ transferFee: event.target.value })} />
                    </Field>
                  </div>
                </div>
              </section>

              <section className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-amber-900">
                  Canales y visibilidad
                </p>
                <div className="flex flex-wrap gap-2">
                  {(["proximos-remates", "ventas-directas", "novedades", "catalogo"] as SectionId[]).map(
                    (sectionId) => (
                      <label
                        key={`manual-section-${sectionId}`}
                        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                          draft.sectionIds.includes(sectionId)
                            ? "border-amber-400 bg-amber-100 text-amber-900"
                            : "border-stone-300 bg-white text-slate-700"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={draft.sectionIds.includes(sectionId)}
                          onChange={() => toggleSection(sectionId)}
                        />
                        {SECTION_LABELS[sectionId]}
                      </label>
                    ),
                  )}
                </div>
                <label className="mt-4 inline-flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={draft.visible}
                    onChange={(event) => patch({ visible: event.target.checked })}
                  />
                  Visible en el home
                </label>
                <Field label="Remate asociado" className="mt-4">
                  <select
                    className={inputClass}
                    value={draft.upcomingAuctionId}
                    onChange={(event) => patch({ upcomingAuctionId: event.target.value })}
                  >
                    <option value="">Sin remate</option>
                    {upcomingAuctions.map((auction) => (
                      <option key={auction.id} value={auction.id}>
                        {auction.name} ({formatAuctionDateLabel(auction.date)})
                      </option>
                    ))}
                  </select>
                </Field>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Field label="Lote">
                    <input className={inputClass} value={draft.lot} onChange={(event) => patch({ lot: event.target.value })} />
                  </Field>
                  <Field label="Fecha (YYYY-MM-DD)">
                    <input className={inputClass} value={draft.auctionDate} onChange={(event) => patch({ auctionDate: event.target.value })} />
                  </Field>
                </div>
              </section>
            </div>
          ) : null}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-amber-200/60 bg-[#f8efe4] px-5 py-4">
          <p className="text-xs text-slate-600">
            {isEditMode
              ? "Los cambios se guardan en la configuracion global del inventario."
              : "Patente recomendada para sincronizar automaticamente cuando GLO3D publique la unidad."}
          </p>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {isEditMode && onMarkSold ? (
              <button
                type="button"
                onClick={onMarkSold}
                className="ui-focus rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700 transition hover:bg-amber-100"
              >
                Marcar como vendida
              </button>
            ) : null}
            {isEditMode && onDeleteManual ? (
              <button
                type="button"
                onClick={onDeleteManual}
                className="ui-focus rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
              >
                Borrar unidad manual
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="ui-focus rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={onSubmit}
              className="ui-focus rounded-md bg-amber-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-600"
            >
              {isEditMode ? "Guardar cambios" : "Crear publicacion"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
