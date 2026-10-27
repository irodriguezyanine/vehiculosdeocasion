function uniqueLabels(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const label = (raw ?? "").trim().replace(/\s+/g, " ");
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(label);
  }
  return out;
}

function asLabels(value: unknown): string[] {
  if (Array.isArray(value)) return uniqueLabels(value.map((item) => String(item ?? "")));
  if (typeof value === "string" && value.trim()) {
    return uniqueLabels(value.split(/[|,;]+/));
  }
  return [];
}

export function parsePublicationTags(input: {
  tags?: unknown;
  publication_tags?: unknown;
  tagsCsv?: unknown;
  status?: string | null;
  vehicleCondition?: string | null;
}): string[] {
  const fromTags = asLabels(input.tags);
  if (fromTags.length) return fromTags;
  const fromPub = asLabels(input.publication_tags);
  if (fromPub.length) return fromPub;
  const fromCsv = asLabels(input.tagsCsv);
  if (fromCsv.length) return fromCsv;
  return uniqueLabels([input.status, input.vehicleCondition]);
}

export function isGenericAvailabilityLabel(value?: string | null): boolean {
  const sample = (value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
  return sample === "disponible";
}

export function visiblePublicationTags(
  tags: string[],
  opts?: { hideOferta?: boolean },
): string[] {
  return tags.filter((item) => {
    if (isGenericAvailabilityLabel(item)) return false;
    if (opts?.hideOferta && item.trim().toLowerCase() === "oferta") return false;
    return true;
  });
}

export function publicationTagBadgeClass(label: string): string {
  const sample = label
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
  if (["reservado", "oferta", "oportunidad"].includes(sample)) return "bg-emerald-600 text-white";
  if (/100% operativo|operativo/.test(sample)) return "bg-emerald-600 text-white";
  if (/no arranca|desarme/.test(sample)) return "bg-rose-600 text-white";
  if (/problema|recuperado|robo/.test(sample)) return "bg-amber-600 text-white";
  if (["seminuevo", "usado", "acondicionado"].includes(sample)) return "bg-[#0891b2] text-white";
  return "bg-[#164e63] text-white";
}
