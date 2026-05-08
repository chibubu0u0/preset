export function truncate(value: string, max = 1900): string {
  if (!value) return "";
  return value.length > max ? value.slice(0, max - 1) + "…" : value;
}

export function sanitizeSelectName(value: string): string {
  return (value || "待整理")
    .replace(/[，,]/g, "・")
    .replace(/[\n\r\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 90) || "待整理";
}

export function normalizeTags(tags: string[] | string | undefined): string[] {
  const raw = Array.isArray(tags) ? tags : typeof tags === "string" ? tags.split(/[，,、/|]/g) : [];
  const cleaned = raw
    .flatMap((tag) => String(tag).split(/[，,、/|]/g))
    .map((tag) => sanitizeSelectName(tag))
    .filter(Boolean);
  return Array.from(new Set(cleaned)).slice(0, 12);
}

export function asPrettyJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value ?? "");
  }
}
