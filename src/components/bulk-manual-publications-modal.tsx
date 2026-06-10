"use client";

import { useMemo, useState } from "react";
import {
  applyManualPublicationBundlesToConfig,
  buildManualDraftFromAutoredFields,
  buildManualPublicationFromDraft,
  type ManualPublicationBundle,
} from "@/lib/create-manual-publication";
import { parsePatentListInput } from "@/lib/patent-input";
import { lookupAutoredPatentsSequential } from "@/lib/autored-client-queue";
import type { EditorConfig, SectionId } from "@/types/editor";

const SECTION_OPTIONS: Array<{ id: SectionId; label: string }> = [
  { id: "ventas-directas", label: "Ventas directas" },
  { id: "novedades", label: "Novedades" },
  { id: "catalogo", label: "Catalogo" },
  { id: "proximos-remates", label: "Destacados" },
];

type BulkManualPublicationsModalProps = {
  config: EditorConfig;
  existingPatents: Set<string>;
  defaultSectionIds?: SectionId[];
  onClose: () => void;
  onApplyConfig: (nextConfig: EditorConfig) => void;
  onNotice: (tone: "success" | "error" | "info", title: string, message: string) => void;
};

type BulkResultRow = {
  patente: string;
  status: "created" | "skipped" | "error";
  detail: string;
};

export function BulkManualPublicationsModal({
  config,
  existingPatents,
  defaultSectionIds = ["catalogo"],
  onClose,
  onApplyConfig,
  onNotice,
}: BulkManualPublicationsModalProps) {
  const [input, setInput] = useState("");
  const [sectionIds, setSectionIds] = useState<SectionId[]>(defaultSectionIds);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState("");
  const [results, setResults] = useState<BulkResultRow[]>([]);

  const parsedPreview = useMemo(() => parsePatentListInput(input), [input]);
  const newPreview = useMemo(
    () => parsedPreview.filter((patente) => !existingPatents.has(patente)),
    [existingPatents, parsedPreview],
  );
  const skippedPreview = useMemo(
    () => parsedPreview.filter((patente) => existingPatents.has(patente)),
    [existingPatents, parsedPreview],
  );

  const toggleSection = (sectionId: SectionId) => {
    setSectionIds((prev) =>
      prev.includes(sectionId) ? prev.filter((id) => id !== sectionId) : [...prev, sectionId],
    );
  };

  const runBulkCreate = async () => {
    const patentes = parsePatentListInput(input);
    if (patentes.length === 0) {
      onNotice("error", "Patentes invalidas", "Pega al menos una patente valida separada por espacio o coma.");
      return;
    }
    if (sectionIds.length === 0) {
      onNotice("error", "Sin categoria", "Selecciona al menos una seccion donde publicar las unidades.");
      return;
    }

    const toCreate = patentes.filter((patente) => !existingPatents.has(patente));
    const skippedExisting = patentes.filter((patente) => existingPatents.has(patente));
    const rows: BulkResultRow[] = skippedExisting.map((patente) => ({
      patente,
      status: "skipped",
      detail: "Ya existe en inventario o publicaciones manuales.",
    }));

    if (toCreate.length === 0) {
      setResults(rows);
      onNotice("info", "Sin unidades nuevas", "Todas las patentes ingresadas ya existen en el sistema.");
      return;
    }

    setProcessing(true);
    setResults([]);
    setProgress(`Consultando Autored (0/${toCreate.length}, 1 cada 3s)...`);

    try {
      const autoredByPatent = new Map<string, Record<string, string | undefined>>();
      const sequential = await lookupAutoredPatentsSequential(toCreate, (current, total, patente) => {
        setProgress(`Consultando Autored ${current}/${total}: ${patente}...`);
      });
      for (const [patente, fields] of sequential.results.entries()) {
        autoredByPatent.set(patente, fields as Record<string, string | undefined>);
      }

      const bundles: ManualPublicationBundle[] = [];

      for (let index = 0; index < toCreate.length; index += 1) {
        const patente = toCreate[index];
        setProgress(`Creando unidades (${index + 1}/${toCreate.length})...`);

        const cached = autoredByPatent.get(patente);
        const entry = cached
          ? { patente, ok: true as const, fields: cached }
          : {
              patente,
              ok: false as const,
              error: sequential.stoppedByRateLimit
                ? "Autored pauso consultas por limite."
                : "Sin datos Autored.",
            };

        const draft = buildManualDraftFromAutoredFields(
          entry.patente,
          entry.ok ? (entry.fields ?? {}) : { patente: entry.patente },
          sectionIds,
        );
        const built = buildManualPublicationFromDraft(draft);
        if (!built.ok) {
          rows.push({ patente: entry.patente, status: "error", detail: built.error });
          continue;
        }

        bundles.push(built.bundle);
        rows.push({
          patente: entry.patente,
          status: "created",
          detail: entry.ok
            ? "Creada con datos Autored."
            : `Creada solo con patente (${entry.error ?? "sin datos Autored"}).`,
        });
      }

      if (bundles.length > 0) {
        onApplyConfig(applyManualPublicationBundlesToConfig(config, bundles));
      }

      setResults(rows);
      const createdCount = rows.filter((row) => row.status === "created").length;
      onNotice(
        sequential.stoppedByRateLimit ? "info" : "success",
        sequential.stoppedByRateLimit ? "Alta masiva parcial" : "Alta masiva completada",
        `${createdCount} unidad(es) nueva(s) creada(s).${
          sequential.stoppedByRateLimit
            ? " Autored pauso consultas: espera unos minutos y completa las patentes restantes manualmente."
            : ""
        }`,
      );
    } finally {
      setProcessing(false);
      setProgress("");
    }
  };

  return (
    <div
      className="fixed inset-0 z-[78] flex items-center justify-center bg-slate-900/75 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Alta masiva por patente"
        className="max-h-[92vh] w-full max-w-3xl overflow-auto rounded-2xl bg-white p-5 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
              Alta masiva
            </p>
            <h3 className="text-lg font-bold text-slate-900">Agregar vehiculos nuevos por patente</h3>
            <p className="mt-1 text-sm text-slate-600">
              Para unidades que aun no estan en bodega ni en GLO3D. Se consulta Autored y se crean
              publicaciones manuales visibles en las categorias seleccionadas.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={processing}
            className="ui-focus rounded border border-slate-300 px-3 py-1 text-xs text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
          >
            Cerrar
          </button>
        </div>

        <label className="mb-3 block">
          <span className="mb-1 block text-xs font-semibold text-slate-600">
            Patentes (separadas por espacio, coma o salto de linea)
          </span>
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            disabled={processing}
            placeholder="TPWP47 TKRD50 SYWV83 TCSL70 ..."
            className="ui-focus min-h-28 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm"
          />
        </label>

        <div className="mb-4 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">
            Detectadas: {parsedPreview.length}
          </span>
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-800">
            Nuevas: {newPreview.length}
          </span>
          {skippedPreview.length > 0 ? (
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-800">
              Ya existentes: {skippedPreview.length}
            </span>
          ) : null}
        </div>

        <div className="mb-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Publicar en
          </p>
          <div className="flex flex-wrap gap-2">
            {SECTION_OPTIONS.map(({ id, label }) => {
              const active = sectionIds.includes(id);
              return (
                <button
                  key={id}
                  type="button"
                  disabled={processing}
                  onClick={() => toggleSection(id)}
                  className={`ui-focus rounded-full border px-3 py-1 text-xs font-semibold transition ${
                    active
                      ? "border-amber-400 bg-amber-50 text-amber-900"
                      : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {progress ? (
          <p className="mb-3 text-sm font-medium text-amber-800">{progress}</p>
        ) : null}

        {results.length > 0 ? (
          <div className="mb-4 max-h-48 overflow-auto rounded-lg border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-3 py-2">Patente</th>
                  <th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2">Detalle</th>
                </tr>
              </thead>
              <tbody>
                {results.map((row) => (
                  <tr key={row.patente} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-semibold text-slate-800">{row.patente}</td>
                    <td className="px-3 py-2">
                      {row.status === "created"
                        ? "Creada"
                        : row.status === "skipped"
                          ? "Omitida"
                          : "Error"}
                    </td>
                    <td className="px-3 py-2 text-slate-600">{row.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={processing}
            className="ui-focus rounded border border-slate-300 px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void runBulkCreate()}
            disabled={processing || newPreview.length === 0}
            className="ui-focus rounded-md bg-amber-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {processing ? "Procesando..." : `Crear ${newPreview.length} unidad(es)`}
          </button>
        </div>
      </div>
    </div>
  );
}
