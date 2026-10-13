import type { FontFaceStyle } from '@cuccut/protocol';

/**
 * Google Fonts' public CSS endpoint (`/css2`, no API key needed): the request carries only the family name, weight, and italic; the response is a set of `@font-face` rules. With a non-browser User-Agent, each face is one complete TrueType file (`format('truetype')`; CJK fonts are also a single file).
 */

export const DEFAULT_CSS_ENDPOINT = 'https://fonts.googleapis.com';
export const DEFAULT_FILE_ENDPOINT = 'https://fonts.gstatic.com';
/** User-Agent for CSS requests: not a browser, so the endpoint serves TrueType files (no WOFF2 and no per-character slices). */
export const CSS_USER_AGENT = 'CucCut';

/** `<base>/css2?family=<family name>:<axis>@<values>`: spaces in the family name become `+`; values are sorted ascending by (italic, weight), since the endpoint does not accept unsorted values. */
export function cssUrl(endpoint: string, family: string, faces: readonly FontFaceStyle[]): string {
  const name = family
    .trim()
    .split(/\s+/)
    .map((part) => encodeURIComponent(part))
    .join('+');
  const sorted = [...faces].sort((a, b) => Number(a.italic) - Number(b.italic) || a.weight - b.weight);
  const unique = sorted.filter((f, i) => i === 0 || f.weight !== sorted[i - 1]!.weight || f.italic !== sorted[i - 1]!.italic);
  const axes = unique.some((f) => f.italic)
    ? `ital,wght@${unique.map((f) => `${f.italic ? 1 : 0},${f.weight}`).join(';')}`
    : `wght@${unique.map((f) => f.weight).join(';')}`;
  return `${endpoint.replace(/\/+$/, '')}/css2?family=${name}:${axes}`;
}

/** One `@font-face` in the response: family name, weight (a variable font is a range), italic, file URL, and whether it covers only some characters (`unicode-range`). */
export interface CssFontFace {
  family: string;
  weight: [number, number];
  italic: boolean;
  url: string;
  format: string | null;
  partial: boolean;
}

/** Parses the `@font-face` rules in the response: blocks without a readable family name, weight, or URL are skipped. */
export function parseFontFaceCss(css: string): CssFontFace[] {
  const faces: CssFontFace[] = [];
  for (const match of css.matchAll(/@font-face\s*\{([^}]*)\}/g)) {
    const body = match[1]!;
    const prop = (name: string) => new RegExp(`(?:^|;)\\s*${name}\\s*:\\s*([^;]+)`, 'i').exec(body)?.[1]?.trim() ?? null;
    const family = prop('font-family')?.replace(/^['"]|['"]$/g, '');
    const weightText = prop('font-weight');
    const src = prop('src');
    if (!family || !weightText || !src) continue;
    const weights = weightText.split(/\s+/).map(Number);
    if (weights.length === 0 || weights.length > 2 || weights.some((w) => !Number.isInteger(w))) continue;
    const url = /url\(\s*['"]?([^'")\s]+)['"]?\s*\)/.exec(src)?.[1];
    if (!url) continue;
    const format = /format\(\s*['"]?([^'")]+)['"]?\s*\)/.exec(src)?.[1] ?? null;
    faces.push({
      family,
      weight: [weights[0]!, weights[1] ?? weights[0]!],
      italic: /^(italic|oblique)/i.test(prop('font-style') ?? ''),
      url,
      format,
      partial: prop('unicode-range') !== null,
    });
  }
  return faces;
}

/** Whether the file URL is under the file base (`https`, same origin, and a path under the base's path). */
export function underEndpoint(url: string, endpoint: string): boolean {
  let file: URL;
  let base: URL;
  try {
    file = new URL(url);
    base = new URL(endpoint);
  } catch {
    return false;
  }
  if (file.protocol !== 'https:' || base.protocol !== 'https:' || file.origin !== base.origin || file.username || file.password)
    return false;
  const prefix = base.pathname.endsWith('/') ? base.pathname : `${base.pathname}/`;
  return file.pathname.startsWith(prefix);
}
