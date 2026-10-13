import crypto from 'node:crypto';

/**
 * Canonical JSON: object keys in lexicographic order, no whitespace, and `undefined` fields omitted. Same rules as the function of the same name in `@cuccut/jobs`.
 * The storage layer cannot depend on jobs (dependency direction), so a copy is kept here.
 */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return `[${value.map((v) => canonicalJson(v)).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
}

export function sha256Hex(data: string | Uint8Array): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/** Content digest of an entry, `sha256:<hex>`. */
export function contentHashOf(content: unknown): string {
  return `sha256:${sha256Hex(canonicalJson(content))}`;
}
