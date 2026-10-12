// CucCut theme: agentcut's "Liquid Glass" palette applied to every Spectrum 2 style the UI ships.
//
// S2 compiles its tokens into literal colours (`light-dark(<light>, <dark>)`) inside the style macro output and
// inside the prebuilt component CSS, so there is no variable to override. CucCut is dark only (agentcut DESIGN.md:
// "dark only; one :root token block and no light variant"), so this pass:
//   1. collapses every `light-dark(a, b)` to `b`;
//   2. maps neutral greys onto agentcut's ramp (#101010 ground, #171717 surfaces, #1f1f1f popovers, #262626 raised,
//      #333 hairlines, a readable muted grey);
//   3. maps the Spectrum blue accent family onto agentcut's yellow (#ffda2a), keeping relative lightness and alpha.
// Reds, greens, oranges and purples (status colours) are left alone.
//
// The same function runs in development (Vite transform) and in production builds (generateBundle over the CSS
// assets), so both paths render the same colours.

import type { Plugin } from 'vite';

type Rgba = { r: number; g: number; b: number; a: number };

/** S2 dark grey level → agentcut neutral level (sRGB channel value). Piecewise linear between anchors. */
const GREY_ANCHORS: Array<[number, number]> = [
  [0, 0],
  [17, 16], // gray-25 / base → #101010 ground
  [27, 23], // gray-50 / layer-1 → #171717 surfaces
  [34, 31], // gray-75 / layer-2 → #1f1f1f popovers
  [44, 38], // gray-100 → #262626 raised fills
  [50, 43],
  [57, 51], // gray-300 → #333 hairlines
  [68, 60],
  [109, 125],
  [138, 166], // gray-600 → muted text that still clears 4.5:1 on #171717
  [175, 196],
  [219, 232],
  [242, 246],
  [255, 255],
];

function mapGrey(v: number): number {
  for (let i = 1; i < GREY_ANCHORS.length; i++) {
    const [x1, y1] = GREY_ANCHORS[i]!;
    const [x0, y0] = GREY_ANCHORS[i - 1]!;
    if (v <= x1) return Math.round(y0 + ((v - x0) * (y1 - y0)) / (x1 - x0));
  }
  return v;
}

function rgbToHsl({ r, g, b }: Rgba): { h: number; s: number; l: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return { h: h * 60, s, l };
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let [r, g, b] = [0, 0, 0];
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return { r: Math.round((r + m) * 255), g: Math.round((g + m) * 255), b: Math.round((b + m) * 255) };
}

/** agentcut's accent hue (#ffda2a ≈ hsl(49 100% 58%)). */
const ACCENT_HUE = 49;

export function mapColor(c: Rgba): Rgba {
  const { h, s, l } = rgbToHsl(c);
  const spread = Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b);
  if (spread <= 10) {
    // Neutral: map by its mean level.
    const v = mapGrey(Math.round((c.r + c.g + c.b) / 3));
    return { r: v, g: v, b: v, a: c.a };
  }
  // Spectrum's accent / informative blues and indigo (hue 205°–250°) become the yellow accent.
  if (h >= 205 && h <= 250 && s >= 0.25) {
    const rgb = hslToRgb(ACCENT_HUE, Math.min(1, s * 1.05), Math.min(0.62, l * 0.87));
    return { ...rgb, a: c.a };
  }
  return c;
}

function clamp255(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function parseAlpha(raw: string | undefined): number {
  if (raw === undefined) return 1;
  const t = raw.trim();
  if (t.endsWith('%')) return Number.parseFloat(t) / 100;
  return Number.parseFloat(t);
}

function parseColor(token: string): Rgba | null {
  const t = token.trim();
  let m = /^#([0-9a-f]{3,8})$/i.exec(t);
  if (m) {
    const hex = m[1]!;
    if (hex.length === 3 || hex.length === 4) {
      const [r = 0, g = 0, b = 0, a] = hex.split('').map((ch) => Number.parseInt(ch + ch, 16));
      return { r, g, b, a: a === undefined ? 1 : a / 255 };
    }
    if (hex.length === 6 || hex.length === 8) {
      const n = (i: number) => Number.parseInt(hex.slice(i, i + 2), 16);
      return { r: n(0), g: n(2), b: n(4), a: hex.length === 8 ? n(6) / 255 : 1 };
    }
    return null;
  }
  m = /^rgba?\(\s*([\d.]+)\s*[,\s]\s*([\d.]+)\s*[,\s]\s*([\d.]+)\s*(?:[,/]\s*([\d.]+%?)\s*)?\)$/i.exec(t);
  if (m) return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]), a: parseAlpha(m[4]) };
  return null;
}

function formatColor(c: Rgba): string {
  const hex = (n: number) => clamp255(n).toString(16).padStart(2, '0');
  const base = `#${hex(c.r)}${hex(c.g)}${hex(c.b)}`;
  if (c.a >= 1) return base;
  return `${base}${hex(c.a * 255)}`;
}

/** Index of the matching `)` for the `(` at `open`, or -1. */
function matchParen(text: string, open: number): number {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') depth++;
    else if (ch === ')') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Splits `a, b` at the first top-level comma. */
function splitTopLevel(args: string): [string, string] | null {
  let depth = 0;
  for (let i = 0; i < args.length; i++) {
    const ch = args[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (ch === ',' && depth === 0) return [args.slice(0, i), args.slice(i + 1)];
  }
  return null;
}

/** Replaces every `light-dark(a, b)` with `b` (recursively), so the dark value always wins. */
export function collapseLightDark(text: string): string {
  const needle = 'light-dark(';
  let out = '';
  let from = 0;
  for (;;) {
    const at = text.indexOf(needle, from);
    if (at === -1) break;
    const open = at + needle.length - 1;
    const close = matchParen(text, open);
    if (close === -1) break;
    const parts = splitTopLevel(text.slice(open + 1, close));
    out += text.slice(from, at);
    out += parts ? collapseLightDark(parts[1].trim()) : text.slice(at, close + 1);
    from = close + 1;
  }
  return out + text.slice(from);
}

const COLOR_LITERAL = /#[0-9a-fA-F]{3,8}\b|rgba?\([^()]*\)/g;

/** Remaps colour literals (hex, rgb/rgba) through `mapColor`. */
export function remapColors(text: string): string {
  return text.replace(COLOR_LITERAL, (match) => {
    const parsed = parseColor(match);
    if (!parsed) return match;
    return formatColor(mapColor(parsed));
  });
}

/** The whole pass for a stylesheet. */
export function rethemeCss(css: string): string {
  return remapColors(collapseLightDark(css));
}

/** For JS: only touch `light-dark(...)` expressions (style macro values inlined into code). */
export function rethemeScript(code: string): string {
  if (!code.includes('light-dark(')) return code;
  const needle = 'light-dark(';
  let out = '';
  let from = 0;
  for (;;) {
    const at = code.indexOf(needle, from);
    if (at === -1) break;
    const open = at + needle.length - 1;
    const close = matchParen(code, open);
    if (close === -1) break;
    out += code.slice(from, at) + rethemeCss(code.slice(at, close + 1));
    from = close + 1;
  }
  return out + code.slice(from);
}

const CSS_ASSET = /\.css$/;
/** Modules whose code carries stylesheet text in development (Vite's CSS modules and the S2 dedupe modules). */
const DEV_CSS_MODULE = /\.css($|\?)|\/@cuccut-s2-style\//;

/** Vite plugin: retheme stylesheets and inlined macro colours, in dev and in builds. */
export function cuccutTheme(): Plugin {
  return {
    name: 'cuccut:theme',
    enforce: 'post',
    transform(code, id) {
      if (id.includes('/node_modules/') && !id.includes('@react-spectrum') && !DEV_CSS_MODULE.test(id)) return null;
      if (DEV_CSS_MODULE.test(id)) {
        const next = rethemeCss(code);
        return next === code ? null : { code: next, map: null };
      }
      if (!/\.(m?[jt]sx?)($|\?)/.test(id)) return null;
      const next = rethemeScript(code);
      return next === code ? null : { code: next, map: null };
    },
    generateBundle: {
      order: 'post',
      handler(_options, bundle) {
        for (const output of Object.values(bundle)) {
          if (output.type !== 'asset' || !CSS_ASSET.test(output.fileName)) continue;
          const css = typeof output.source === 'string' ? output.source : new TextDecoder().decode(output.source);
          output.source = rethemeCss(css);
        }
      },
    },
  };
}

/**
 * `@react-spectrum/s2` → `packages/ui/src/theme/s2.tsx` (exact specifier only; subpaths such as `/style`, `/icons/*`
 * and the shim's own `/index` import resolve normally).
 */
export function s2ShimAlias(): { find: RegExp; replacement: string } {
  return {
    find: /^@react-spectrum\/s2$/,
    replacement: new URL('../packages/ui/src/theme/s2.tsx', import.meta.url).pathname,
  };
}
