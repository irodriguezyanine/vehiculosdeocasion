export function normalizePatentToken(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function parsePatentListInput(value: string): string[] {
  const raw = value.toUpperCase();
  const regexMatches =
    raw.match(/[A-Z]{4}\s*-?\s*\d{2}|[A-Z]{2}\s*-?\s*\d{4}/g) ?? [];
  const fromRegex = regexMatches
    .map((token) => normalizePatentToken(token))
    .filter((token) => /^[A-Z]{4}\d{2}$/.test(token) || /^[A-Z]{2}\d{4}$/.test(token));
  const fromSplit = raw
    .split(/[\s,;]+/)
    .map((token) => normalizePatentToken(token))
    .filter((token) => /^[A-Z]{4}\d{2}$/.test(token) || /^[A-Z]{2}\d{4}$/.test(token));
  return Array.from(new Set([...fromRegex, ...fromSplit]));
}

export function extractPatentTokens(value: string): string[] {
  return parsePatentListInput(value);
}
