// Dedupe and merge of S2 styles, shared by dev time (`s2-styles-client.ts`, in the browser) and production builds (the build plugin of `s2-styles.ts`, in Node).
//
// The input is a sequence of CSS chunks in order (in dev, one per style-macro call and one per component; at build time, one combined s2-styles chunk). The output is one CSS with the same cascade result:
// - The layer order is set by the position where each layer name first appears (a declaration statement or a rule block). All layer names are recorded in order of first appearance and declared at the top with one `@layer a, b, …;`. The layer order does not change; dotted names declare each level in turn, which is equivalent to nested writing.
// - Between rules in different layers, and between rules inside a layer and rules outside any layer, order does not affect the cascade (the layer is compared first, and only when the layers match are specificity and order compared), so rules can be grouped by layer.
// - Within the same layer (rules outside any layer also count as one group), when a rule appears more than once, only its last occurrence is kept. Identical rules give the same declarations for any element, and in a tie the later one wins; keeping the last copy and leaving the other rules in their original relative order does not change which of any two rules comes later, so the cascade result stays the same.
// Rules are the unit of text: @media, @supports, @keyframes, @font-face and so on are treated as one block together with their contents.
// Forms that cannot be split reliably (anonymous layers, @import, @layer nested inside conditional rules) are not handled: `parseLayeredCss` returns null, and the caller keeps that CSS unchanged.

/** One rule: the layer it belongs to (the full path of a named layer, or null when it is outside any layer) and its source text. */
export interface CssItem {
  layer: string | null;
  text: string;
}

/** One CSS chunk split apart: layer names in order of first appearance, and rules in their original order. */
export interface LayeredCss {
  layers: string[];
  items: CssItem[];
}

/** Splits one CSS chunk into layer names and rules; returns null on forms that cannot be split reliably. Top-level comments (including source map comments) are dropped. */
export function parseLayeredCss(css: string): LayeredCss | null {
  const parsed: LayeredCss = { layers: [], items: [] };
  return collect(css, 0, css.length, null, parsed) ? parsed : null;
}

/** Merges several split CSS chunks in order, keeping only the last occurrence of identical rules. `separator` is the separator between rules (production builds use an empty string to keep the output minified). */
export function mergeLayeredCss(sheets: Iterable<LayeredCss>, separator = '\n'): string {
  const order = new Set<string>();
  // A rule that appears again moves to the end: the Map's order is the order of each rule's last occurrence.
  const last = new Map<string, CssItem>();
  for (const sheet of sheets) {
    for (const name of sheet.layers) order.add(name);
    for (const item of sheet.items) {
      const key = `${item.layer ?? ''}\n${item.text}`;
      last.delete(key);
      last.set(key, item);
    }
  }
  const groups = new Map<string | null, string[]>();
  for (const { layer, text } of last.values()) {
    const group = groups.get(layer);
    if (group) group.push(text);
    else groups.set(layer, [text]);
  }
  const out: string[] = [];
  if (order.size > 0) out.push(`@layer ${[...order].join(',')};`);
  for (const name of order) {
    const group = groups.get(name);
    if (group) out.push(`@layer ${name}{${separator}${group.join(separator)}${separator}}`);
  }
  const unlayered = groups.get(null);
  if (unlayered) out.push(...unlayered);
  return out.join(separator);
}

function collect(css: string, start: number, end: number, layer: string | null, out: LayeredCss): boolean {
  const declare = (name: string) => {
    const full = layer ? `${layer}.${name}` : name;
    if (!out.layers.includes(full)) out.layers.push(full);
    return full;
  };
  let i = start;
  while (i < end) {
    i = skipSpaceAndComments(css, i, end);
    if (i >= end) break;
    // Where this one ends: a top-level `;` (a statement), or `{` (the start of a block, then find its matching `}`).
    const stop = scan(css, i, end, ';{');
    if (stop < 0) return false;
    const prelude = css.slice(i, stop).trim();
    const isBlock = css[stop] === '{';
    const close = isBlock ? scan(css, stop + 1, end, '}') : stop;
    if (close < 0) return false;
    const atLayer = /^@layer(?=[\s{;]|$)/i.test(prelude);
    if (atLayer) {
      const names = prelude
        .slice('@layer'.length)
        .split(',')
        .map((name) => name.trim());
      if (names.some((name) => !/^[\w-]+(\.[\w-]+)*$/.test(name))) return false; // Anonymous layer, or a misspelled name
      if (isBlock) {
        if (names.length !== 1) return false;
        if (!collect(css, stop + 1, close, declare(names[0]!), out)) return false;
      } else {
        for (const name of names) declare(name);
      }
    } else {
      if (/^@(import|charset|namespace)\b/i.test(prelude)) return false;
      const text = css.slice(i, close + 1).trim();
      // A @layer nested inside a conditional rule also declares a layer; moving the whole block would change the layer order.
      if (/@layer\b/i.test(text)) return false;
      out.items.push({ layer, text });
    }
    i = close + 1;
  }
  return true;
}

/** From `i` onward, finds the first character in `chars` that is not inside a string, comment, brackets, or a nested block; returns -1 if there is none. */
function scan(css: string, i: number, end: number, chars: string): number {
  let depth = 0;
  let parens = 0;
  while (i < end) {
    const c = css.charAt(i);
    if (c === '\\') {
      i += 2;
      continue;
    }
    if (c === '"' || c === "'") {
      i = skipString(css, i, end);
      continue;
    }
    if (c === '/' && css[i + 1] === '*') {
      const close = css.indexOf('*/', i + 2);
      if (close < 0 || close >= end) return -1;
      i = close + 2;
      continue;
    }
    if (depth === 0 && parens === 0 && chars.includes(c)) return i;
    if (c === '(') parens++;
    else if (c === ')') parens = Math.max(0, parens - 1);
    else if (c === '{') depth++;
    else if (c === '}') depth--;
    i++;
  }
  return -1;
}

function skipString(css: string, i: number, end: number): number {
  const quote = css[i];
  i++;
  while (i < end && css[i] !== quote) i += css[i] === '\\' ? 2 : 1;
  return i + 1;
}

function skipSpaceAndComments(css: string, i: number, end: number): number {
  while (i < end) {
    if (/\s/.test(css.charAt(i))) i++;
    else if (css[i] === '/' && css[i + 1] === '*') {
      const close = css.indexOf('*/', i + 2);
      i = close < 0 ? end : close + 2;
    } else break;
  }
  return i;
}
