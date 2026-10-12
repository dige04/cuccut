/**
 * Reconstructed document subsystem of the Design Component runtime.
 * Source declarations: dc-runtime.js offsets 143180..148344.
 * Semantic names are inferred from the shipped behavior; see runtime-map.json.
 */
/* @jsxRuntime classic */
/* @jsx renderJSX */
import { createElement as renderJSX, getReact, getReactDOM } from "./react";
import type {
  RuntimeValue,
  Keyframe,
  PropsMetadata,
  ParsedDesignComponent,
  ComponentRegistry,
  StreamingTracker,
  RenderValues,
  TemplateContext,
  CompiledTemplate,
  DesignRuntime,
  RuntimeOptions,
} from "./types";
export function parseDesignDocument(
  documentNode: Document,
): ParsedDesignComponent | null {
  const templateElement: RuntimeValue = documentNode.querySelector("x-dc");
  if (!templateElement) return null;
  const scriptElement: RuntimeValue = documentNode.querySelector(
      "script[data-dc-script]",
    ),
    { props: props, preview: preview } = parsePropsMetadata(
      scriptElement?.getAttribute("data-props") ?? null,
    );
  return {
    template: templateElement.innerHTML,
    js: (scriptElement && scriptElement.textContent) || "",
    props: props,
    preview: preview,
  };
}
export function parseDesignHtml(html: string): ParsedDesignComponent | null {
  const openingTag: RuntimeValue = /<x-dc(?:\s[^>]*)?>/.exec(html);
  if (!openingTag) return null;
  const closingOffset: RuntimeValue = html.lastIndexOf("</x-dc>");
  if (closingOffset === -1 || closingOffset < openingTag.index) return null;
  const template: RuntimeValue = html.slice(
      openingTag.index + openingTag[0].length,
      closingOffset,
    ),
    scriptElement: RuntimeValue = new DOMParser()
      .parseFromString(html, "text/html")
      .querySelector("script[data-dc-script]"),
    { props: props, preview: preview } = parsePropsMetadata(
      scriptElement?.getAttribute("data-props") ?? null,
    );
  return {
    template: template,
    js: (scriptElement && scriptElement.textContent) || "",
    props: props,
    preview: preview,
  };
}
export function parsePropsMetadata(
  json: string | null | undefined,
): PropsMetadata {
  if (!json)
    return {
      props: null,
      preview: null,
    };
  let parsed: RuntimeValue;
  try {
    parsed = JSON.parse(json);
  } catch {
    return {
      props: null,
      preview: null,
    };
  }
  if (!parsed || typeof parsed != "object" || Array.isArray(parsed))
    return {
      props: null,
      preview: null,
    };
  const metadata: RuntimeValue = parsed,
    preview: RuntimeValue =
      metadata.$preview && typeof metadata.$preview == "object"
        ? metadata.$preview
        : null,
    props: RuntimeValue = {};
  for (const key of Object.keys(metadata))
    key[0] !== "$" && (props[key] = metadata[key]);
  return {
    props: Object.keys(props).length ? props : null,
    preview: preview,
  };
}
export function rootNameFromPath(pathname: string | null | undefined): string {
  let decodedPath: RuntimeValue = pathname || "";
  try {
    decodedPath = decodeURIComponent(decodedPath);
  } catch {}
  return (
    (decodedPath.split("/").pop() || "Root").replace(
      /\.dc\.html$|\.html?$/,
      "",
    ) || "Root"
  );
}
export var RUNTIME_CSS = `
    .sc-placeholder{background:color-mix(in srgb,currentColor 8%,transparent);
      border:1px solid color-mix(in srgb,currentColor 50%,transparent);
      border-radius:2px;box-sizing:border-box;overflow:hidden}
    @keyframes sc-shine{0%{background-position:100% 50%}100%{background-position:0% 50%}}
    html.sc-dc-streaming .sc-placeholder,
    html.sc-dc-streaming .sc-interp.sc-missing{position:relative;
      background:color-mix(in srgb,currentColor 5%,transparent);
      border-color:transparent}
    html.sc-dc-streaming .sc-placeholder::before,
    html.sc-dc-streaming .sc-interp.sc-missing::before{content:'';
      position:absolute;inset:0;pointer-events:none;
      background:linear-gradient(90deg,rgba(217,119,87,0) 25%,rgba(247,225,211,.95) 37%,rgba(217,119,87,0) 63%);
      background-size:400% 100%;animation:sc-shine 1.4s ease infinite}
    html.sc-dc-streaming .sc-placeholder:nth-child(n+9 of .sc-placeholder)::before,
    html.sc-dc-streaming .sc-interp.sc-missing:nth-child(n+9 of .sc-interp.sc-missing)::before{animation:none;
      background:color-mix(in srgb,currentColor 8%,transparent)}
    .sc-placeholder-error{padding:4px 8px;font:11px/1.4 ui-monospace,monospace;
      color:color-mix(in srgb,currentColor 70%,transparent);word-break:break-word}
    .sc-interp.sc-missing{display:inline-block;width:2em;height:1em;overflow:hidden;
      vertical-align:text-bottom;background:rgba(255,255,255,.3);border:1px solid rgba(0,0,0,.5);
      border-radius:2px;box-sizing:border-box;color:transparent;
      user-select:none}
    .sc-interp.sc-unresolved{font-family:ui-monospace,monospace;font-size:.85em;
      color:color-mix(in srgb,currentColor 50%,transparent);
      background:color-mix(in srgb,currentColor 10%,transparent);border-radius:3px;
      padding:0 3px}
    .sc-host.sc-has-error{position:relative}
    .sc-logic-error{position:absolute;top:8px;left:8px;z-index:2147483647;max-width:60ch;
      padding:6px 10px;background:#b00020;color:#fff;font:12px/1.4 ui-monospace,monospace;
      border-radius:4px;white-space:pre-wrap;pointer-events:none}
    /* Mirrors PRINT_BASELINE_CSS in apps/web deck-stage-export.ts \u2014 keep both
       in sync until dc-runtime regains a build step. */
    @media print {
      @page { margin: 0.5cm; }
      figure, table { break-inside: avoid; }
      #dc-root, #dc-root > .sc-host { height: auto; }
      *, *::before, *::after {
        print-color-adjust: exact; -webkit-print-color-adjust: exact;
        backdrop-filter: none !important; -webkit-backdrop-filter: none !important;
        animation-delay: -99s !important; animation-duration: .001s !important;
        animation-iteration-count: 1 !important; animation-fill-mode: both !important;
        animation-play-state: running !important; transition-duration: 0s !important;
      }
    }
  `,
  FULL_HEIGHT_CSS =
    "html,body{height:100%;margin:0}#dc-root,#dc-root>.sc-host{height:100%}";
export function resolveRootName(
  documentNode: Document,
  locationInfo: Pick<Location, "pathname">,
): string {
  let pathname: RuntimeValue = locationInfo.pathname || "";
  if (!/\.dc\.html?$/i.test(decodePath(pathname)))
    try {
      pathname = new URL(documentNode.baseURI || "/").pathname;
    } catch {}
  return rootNameFromPath(pathname);
}
export function decodePath(pathname: string): string {
  try {
    return decodeURIComponent(pathname);
  } catch {
    return pathname;
  }
}
export function mountDesignDocument(
  runtime: DesignRuntime,
  documentNode: Document = document,
): string | null {
  const parsed: RuntimeValue = parseDesignDocument(documentNode);
  if (!parsed) return null;
  const react: RuntimeValue = getReact(),
    rootName: RuntimeValue = resolveRootName(documentNode, location);
  runtime.markFetched(rootName);
  runtime.setRootName(rootName);
  runtime.adoptParsed(rootName, parsed);
  window.__resources ||
    fetch(location.href)
      .then(
        (response?: RuntimeValue): RuntimeValue =>
          response.ok ? response.text() : "",
      )
      .then((html?: RuntimeValue): RuntimeValue => {
        const parsed: RuntimeValue = html ? parseDesignHtml(html) : null;
        parsed?.template && runtime.updateHtml(rootName, parsed.template);
      })
      .catch((): RuntimeValue => {});
  const sourceElement: RuntimeValue = documentNode.querySelector("x-dc"),
    rootElement: RuntimeValue = documentNode.createElement("div");
  if (
    ((rootElement.id = "dc-root"),
    sourceElement.replaceWith(rootElement),
    !parsed.preview)
  ) {
    const heightStyle: RuntimeValue = documentNode.createElement("style");
    heightStyle.textContent = FULL_HEIGHT_CSS;
    documentNode.head.appendChild(heightStyle);
  }
  const RootComponent: RuntimeValue = runtime.getDC(rootName),
    entry: RuntimeValue = runtime.registry.get(rootName);
  function RootWithDefaults(): RuntimeValue {
    const [, setVersion] = react.useState(0);
    react.useEffect((): RuntimeValue => {
      const refresh: RuntimeValue = (): RuntimeValue =>
        setVersion((version?: RuntimeValue): RuntimeValue => version + 1);
      entry.subs.add(refresh);
      return (): RuntimeValue => {
        entry.subs.delete(refresh);
      };
    }, []);
    const defaultProps: RuntimeValue = react.useMemo((): RuntimeValue => {
      const defaults: RuntimeValue = {};
      for (const propName in entry.propsMeta || {}) {
        const defaultValue: RuntimeValue = entry.propsMeta?.[propName]?.default;
        defaultValue !== undefined && (defaults[propName] = defaultValue);
      }
      return defaults;
    }, [entry.propsMeta]);
    return <RootComponent {...defaultProps} {...(entry.propOverrides || {})} />;
  }
  const reactDOM: RuntimeValue = getReactDOM();
  reactDOM.createRoot
    ? reactDOM.createRoot(rootElement).render(<RootWithDefaults />)
    : reactDOM.render(<RootWithDefaults />, rootElement);
  return rootName;
}
