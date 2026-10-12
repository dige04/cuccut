import type * as React from "react";
import type * as Editor from "../contracts/editor-runtime";
import type * as Model from "../contracts";
import type * as Application from "../contracts/application";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installEditorCoverPreview(
  runtime: RuntimeBindings,
): () => void {
  var jsxCoverPreview: typeof import("react/jsx-runtime");
  var COVER_PREVIEW_WIDTH: number;
  function coverPreviewHead(
    cover: import("../contracts/preview").PreviewHeadResult,
  ): import("../contracts/preview").PreviewHead {
    if (cover.staticReason === "") {
      return cover.head;
    } else {
      return {
        ...cover.head,
        runtimeScripts: [],
        bundleJs: "",
      };
    }
  }
  function CoverPreview({
    cover: cover,
    head: head,
  }: Editor.CoverPreviewProps): React.ReactElement {
    let [value, value2] = (
      runtime.reactPreviewComponents as typeof React
    ).useState(false);
    (runtime.reactPreviewComponents as typeof React).useEffect(
      () => value2(true),
      [],
    );
    let value3 = (0, runtime.clampComponentStageHeight)(cover.height),
      memo = (runtime.reactPreviewComponents as typeof React).useMemo(
        () => coverPreviewHead(head),
        [head],
      ),
      [value4, value5] = (
        runtime.reactPreviewComponents as typeof React
      ).useState<string | null>(null);
    return (
      <jsxCoverPreview.Fragment>
        {[
          <div
            className={"ds-cover ds-comp-preview-box relative"}
            role={"group"}
            aria-label={"Cover"}
            data-testid={"ds-cover"}
            {...(0, runtime.commentTargetProps)("ds", "cover")}
          >
            {[
              <runtime.PreviewFitBox
                width={COVER_PREVIEW_WIDTH}
                height={value3}
                data-testid={"ds-cover"}
              >
                {value ? (
                  <runtime.ComponentPreview
                    html={cover.previewHtml}
                    cardFile={(0, runtime.projectFilePath)(
                      (0, runtime.componentPreviewPath)(
                        runtime.COVER_COMPONENT_NAME,
                      ),
                    )}
                    head={memo}
                    height={value3}
                    staticPageWidth={COVER_PREVIEW_WIDTH}
                    onStaticNote={value5}
                    title={"Cover"}
                    data-testid={"ds-cover-preview"}
                  />
                ) : null}
              </runtime.PreviewFitBox>,
              <span
                className={"ds-page-shield rounded-[inherit]"}
                aria-hidden={"true"}
                data-testid={"ds-cover-shield"}
              />,
            ]}
          </div>,
          value4 !== null ? (
            <p
              className={"ds-swatch-note text-footnote text-muted"}
              role={"note"}
              data-testid={"ds-cover-note"}
              {...runtime.UNCOMMENTABLE_PROPS}
            >
              {value4}
            </p>
          ) : null,
        ]}
      </jsxCoverPreview.Fragment>
    );
  }
  bindRuntimeValue(
    runtime,
    "jsxCoverPreview",
    () => jsxCoverPreview,
    (value) => {
      jsxCoverPreview = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COVER_PREVIEW_WIDTH",
    () => COVER_PREVIEW_WIDTH,
    (value) => {
      COVER_PREVIEW_WIDTH = value;
    },
  );
  bindRuntimeValue(runtime, "coverPreviewHead", () => coverPreviewHead);
  bindRuntimeValue(runtime, "CoverPreview", () => CoverPreview);
  return () => {
    jsxCoverPreview = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
    COVER_PREVIEW_WIDTH = 960;
  };
}
