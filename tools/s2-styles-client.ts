// Dev-time merge and dedupe of S2 styles (brought in by the dev plugin of `s2-styles.ts`; production builds do not use it):
// each CSS chunk (one style-macro call site, or one S2 component) registers as it loads, and they are combined into one <style> by `s2-styles-merge.ts`. Identical rules keep only the last occurrence, and the layer order is unchanged, so the cascade result matches what Vite gets by inserting a separate <style> for each. A chunk that cannot be split reliably is still inserted as its own <style>, as before.

import { type LayeredCss, mergeLayeredCss, parseLayeredCss } from './s2-styles-merge.ts';

/** The registered CSS. The Map's order is registration order (re-registering the same id moves it to the end, matching a stylesheet inserted after the file changed). */
const sheets = new Map<string, LayeredCss>();
/** Chunks that cannot be split reliably; each is inserted as its own <style>. */
const loose = new Map<string, HTMLStyleElement>();
let element: HTMLStyleElement | null = null;
let scheduled = false;

/** Registers one CSS chunk. If the same id registers again (the file changed), the old one is replaced. */
export function addStyle(id: string, css: string): void {
  removeStyle(id);
  const parsed = parseLayeredCss(css);
  if (parsed) {
    sheets.set(id, parsed);
    schedule();
    return;
  }
  const style = document.createElement('style');
  style.setAttribute('data-vite-dev-id', id);
  style.textContent = css;
  document.head.appendChild(style);
  loose.set(id, style);
}

/** Unregisters one CSS chunk (it is no longer referenced after a hot update); rules that no one else uses are removed with it. */
export function removeStyle(id: string): void {
  loose.get(id)?.remove();
  loose.delete(id);
  if (sheets.delete(id)) schedule();
}

/** Registrations and unregistrations within the same round are combined, and the stylesheet is rewritten once in a microtask. */
function schedule(): void {
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(() => {
    scheduled = false;
    if (!element) {
      element = document.createElement('style');
      element.setAttribute('data-vite-dev-id', 'cuccut:s2-styles');
      document.head.appendChild(element);
    }
    element.textContent = mergeLayeredCss(sheets.values());
  });
}
