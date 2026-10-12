/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installFindHighlights(runtime: RuntimeBindings): () => void {
  var findHighlightName: Dynamic;
  var activeFindHighlightName: Dynamic;
  var findHighlightStyles: Dynamic;
  var findHighlightStylesheetCache: Dynamic;
  function getFindHighlightApi(document2?: Dynamic): Dynamic {
    let defaultView: Dynamic = document2.defaultView,
      value: Dynamic = defaultView?.CSS?.highlights;
    return !defaultView ||
      !value ||
      typeof defaultView.Highlight != "function" ||
      typeof defaultView.CSSStyleSheet != "function"
      ? null
      : {
          highlights: value,
          Highlight: defaultView.Highlight,
          CSSStyleSheet: defaultView.CSSStyleSheet,
        };
  }
  function adoptFindStylesheet(
    document2?: Dynamic,
    stylesheet?: Dynamic,
  ): Dynamic {
    if (!document2.adoptedStyleSheets.includes(stylesheet))
      try {
        document2.adoptedStyleSheets.push(stylesheet);
      } catch {
        document2.adoptedStyleSheets = [
          ...document2.adoptedStyleSheets,
          stylesheet,
        ];
      }
  }
  function unadoptFindStylesheet(
    document2?: Dynamic,
    stylesheet?: Dynamic,
  ): Dynamic {
    let value: Dynamic = document2.adoptedStyleSheets.indexOf(stylesheet);
    if (value !== -1)
      try {
        document2.adoptedStyleSheets.splice(value, 1);
      } catch {
        document2.adoptedStyleSheets = document2.adoptedStyleSheets.filter(
          (input?: Dynamic): Dynamic => input !== stylesheet,
        );
      }
  }
  function applyFindHighlights(
    document2?: Dynamic,
    ranges?: Dynamic,
    activeRange?: Dynamic,
  ): Dynamic {
    let value: Dynamic = getFindHighlightApi(document2);
    if (value === null) return false;
    let entry: Dynamic = findHighlightStylesheetCache.get(document2);
    entry === undefined &&
      ((entry = new value.CSSStyleSheet()),
      entry.replaceSync(findHighlightStyles),
      findHighlightStylesheetCache.set(document2, entry));
    adoptFindStylesheet(document2, entry);
    value.highlights.set(
      findHighlightName,
      new value.Highlight(
        ...ranges.filter((input?: Dynamic): Dynamic => input !== activeRange),
      ),
    );
    activeRange === null
      ? value.highlights.delete(activeFindHighlightName)
      : value.highlights.set(
          activeFindHighlightName,
          new value.Highlight(activeRange),
        );
    return true;
  }
  function clearFindHighlights(document2?: Dynamic): Dynamic {
    let value: Dynamic = getFindHighlightApi(document2);
    value?.highlights.delete(findHighlightName);
    value?.highlights.delete(activeFindHighlightName);
    let entry: Dynamic = findHighlightStylesheetCache.get(document2);
    entry !== undefined &&
      (unadoptFindStylesheet(document2, entry),
      findHighlightStylesheetCache.delete(document2));
  }
  bindRuntimeValue(
    runtime,
    "findHighlightName",
    () => findHighlightName,
    (value) => {
      findHighlightName = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "activeFindHighlightName",
    () => activeFindHighlightName,
    (value) => {
      activeFindHighlightName = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "findHighlightStyles",
    () => findHighlightStyles,
    (value) => {
      findHighlightStyles = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "findHighlightStylesheetCache",
    () => findHighlightStylesheetCache,
    (value) => {
      findHighlightStylesheetCache = value;
    },
  );
  bindRuntimeValue(runtime, "getFindHighlightApi", () => getFindHighlightApi);
  bindRuntimeValue(runtime, "adoptFindStylesheet", () => adoptFindStylesheet);
  bindRuntimeValue(
    runtime,
    "unadoptFindStylesheet",
    () => unadoptFindStylesheet,
  );
  bindRuntimeValue(runtime, "applyFindHighlights", () => applyFindHighlights);
  bindRuntimeValue(runtime, "clearFindHighlights", () => clearFindHighlights);
  return () => {
    findHighlightName = "mc-find";
    activeFindHighlightName = "mc-find-active";
    findHighlightStyles = `::highlight(${findHighlightName}) { background-color: rgb(255 213 0); color: #000; } ::highlight(${activeFindHighlightName}) { background-color: rgb(255 150 50); color: #000; }`;
    findHighlightStylesheetCache = new WeakMap();
  };
}
