/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";

/** The CSS Custom Highlight API pieces of a document's window, when the browser has them. */
export interface CssHighlightApi {
  highlights: HighlightRegistry;
  Highlight: typeof Highlight;
  CSSStyleSheet: typeof CSSStyleSheet;
}

declare module "../bindings" {
  interface RuntimeBindings {
    findHighlightStylesheets: WeakMap<Document, CSSStyleSheet>;
    cssHighlightApi: (page: Document) => CssHighlightApi | null;
    adoptFindStylesheet: (page: Document, sheet: CSSStyleSheet) => void;
    removeFindStylesheet: (page: Document, sheet: CSSStyleSheet) => void;
    setFindHighlights: (
      page: Document,
      ranges: readonly Range[],
      current: Range | null,
    ) => boolean;
    clearFindHighlights: (page: Document) => void;
  }
}

export function installUiFindHighlights(runtime: RuntimeBindings): () => void {
  var findHighlightStylesheets: WeakMap<Document, CSSStyleSheet>;
  function cssHighlightApi(page: Document): CssHighlightApi | null {
    let defaultView = page.defaultView,
      value = defaultView?.CSS?.highlights;
    if (
      !defaultView ||
      !value ||
      typeof defaultView.Highlight !== "function" ||
      typeof defaultView.CSSStyleSheet !== "function"
    ) {
      return null;
    }
    return {
      highlights: value,
      Highlight: defaultView.Highlight,
      CSSStyleSheet: defaultView.CSSStyleSheet,
    };
  }
  function adoptFindStylesheet(page: Document, sheet: CSSStyleSheet): void {
    if (page.adoptedStyleSheets.includes(sheet)) {
      return;
    }
    try {
      page.adoptedStyleSheets.push(sheet);
    } catch {
      page.adoptedStyleSheets = [...page.adoptedStyleSheets, sheet];
    }
  }
  function removeFindStylesheet(page: Document, sheet: CSSStyleSheet): void {
    let value = page.adoptedStyleSheets.indexOf(sheet);
    if (value === -1) {
      return;
    }
    try {
      page.adoptedStyleSheets.splice(value, 1);
    } catch {
      page.adoptedStyleSheets = page.adoptedStyleSheets.filter(
        (input) => input !== sheet,
      );
    }
  }
  function setFindHighlights(
    page: Document,
    ranges: readonly Range[],
    current: Range | null,
  ): boolean {
    let value = cssHighlightApi(page);
    if (value === null) {
      return false;
    }
    let entry = findHighlightStylesheets.get(page);
    if (entry === undefined) {
      entry = new value.CSSStyleSheet();
      entry.replaceSync(
        "::highlight(mc-find) { background-color: rgb(255 213 0); color: #000; } ::highlight(mc-find-active) { background-color: rgb(255 150 50); color: #000; }",
      );
      findHighlightStylesheets.set(page, entry);
    }
    adoptFindStylesheet(page, entry);
    value.highlights.set(
      "mc-find",
      new value.Highlight(
        ...ranges.filter((input) => input !== current),
      ),
    );
    if (current === null) {
      value.highlights.delete("mc-find-active");
    } else {
      value.highlights.set("mc-find-active", new value.Highlight(current));
    }
    return true;
  }
  function clearFindHighlights(page: Document): void {
    let value = cssHighlightApi(page);
    value?.highlights.delete("mc-find");
    value?.highlights.delete("mc-find-active");
    let entry = findHighlightStylesheets.get(page);
    if (entry === undefined) {
      return;
    }
    removeFindStylesheet(page, entry);
    findHighlightStylesheets.delete(page);
  }
  bindRuntimeValue(
    runtime,
    "findHighlightStylesheets",
    () => findHighlightStylesheets,
    (value) => {
      findHighlightStylesheets = value;
    },
  );
  bindRuntimeValue(runtime, "cssHighlightApi", () => cssHighlightApi);
  bindRuntimeValue(runtime, "adoptFindStylesheet", () => adoptFindStylesheet);
  bindRuntimeValue(runtime, "removeFindStylesheet", () => removeFindStylesheet);
  bindRuntimeValue(runtime, "setFindHighlights", () => setFindHighlights);
  bindRuntimeValue(runtime, "clearFindHighlights", () => clearFindHighlights);
  return () => {
    findHighlightStylesheets = new WeakMap();
  };
}
