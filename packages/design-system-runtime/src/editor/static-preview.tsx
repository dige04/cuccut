import type * as React from "react";
import type * as Editor from "../contracts/editor-runtime";
import type * as Model from "../contracts";
import type * as Application from "../contracts/application";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installEditorStaticPreview(
  runtime: RuntimeBindings,
): () => void {
  var reactStaticPreview: typeof import("react");
  var jsxStaticPreview: typeof import("react/jsx-runtime");
  var EMPTY_STATIC_PREVIEW_HTML: string;
  var validatedPreviewDimension: (
    value: number | undefined,
    fallback: number,
  ) => number;
  function staticPreviewDocumentHtml(
    html: string,
    head: Editor.PreviewRuntimeHead,
  ): string {
    let callback = (input: string): string =>
      input === ""
        ? ""
        : "<style>" + input.replace(/<\/(?=style)/gi, "<\\/") + "</style>";
    return (
      "<!doctype html><html" +
      (0, runtime.swatchHtmlAttributes)(head) +
      '><head><meta name="referrer" content="no-referrer">' +
      callback("html{overflow:hidden!important}") +
      callback(head.tokensCss) +
      callback(head.bundleCss) +
      "</head><body>" +
      html +
      "</body></html>"
    );
  }
  function StaticPreviewFrame({
    html: html,
    head: head,
    pageW: pageW,
    pageH: pageH,
    fitWidth: fitWidth,
    title: title,
    ...props
  }: Editor.StaticPreviewFrameProps): React.ReactElement {
    let memo = reactStaticPreview.useMemo(
        () =>
          head === undefined ? html : staticPreviewDocumentHtml(html, head),
        [html, head],
      ),
      value = validatedPreviewDimension(pageW, 1280),
      value2 = validatedPreviewDimension(pageH, 720),
      value3 = fitWidth / value,
      state: React.CSSProperties = {
        width: fitWidth,
        height: value2 * value3,
        overflow: "hidden",
        position: "relative",
      },
      state2: React.CSSProperties = {
        width: value,
        height: value2,
        transform: "scale(" + String(value3) + ")",
        transformOrigin: "top left",
        border: "0",
        display: "block",
      };
    return (
      <div className={"ds-page-box"} style={state}>
        {[
          <iframe
            {...props}
            sandbox={EMPTY_STATIC_PREVIEW_HTML}
            srcDoc={memo}
            title={title}
            loading={"lazy"}
            tabIndex={-1}
            style={state2}
          />,
          <span className={"ds-page-shield"} />,
        ]}
      </div>
    );
  }
  bindRuntimeValue(
    runtime,
    "reactStaticPreview",
    () => reactStaticPreview,
    (value) => {
      reactStaticPreview = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxStaticPreview",
    () => jsxStaticPreview,
    (value) => {
      jsxStaticPreview = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "EMPTY_STATIC_PREVIEW_HTML",
    () => EMPTY_STATIC_PREVIEW_HTML,
    (value) => {
      EMPTY_STATIC_PREVIEW_HTML = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "staticPreviewDocumentHtml",
    () => staticPreviewDocumentHtml,
  );
  bindRuntimeValue(
    runtime,
    "validatedPreviewDimension",
    () => validatedPreviewDimension,
    (value) => {
      validatedPreviewDimension = value;
    },
  );
  bindRuntimeValue(runtime, "StaticPreviewFrame", () => StaticPreviewFrame);
  return () => {
    reactStaticPreview = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    jsxStaticPreview = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
    EMPTY_STATIC_PREVIEW_HTML = "";
    validatedPreviewDimension = (
      value: number | undefined,
      fallback: number,
    ) =>
      Number.isFinite(value) &&
      (value as number) >= 16 &&
      (value as number) <= 1e4
        ? value!
        : fallback;
  };
}
