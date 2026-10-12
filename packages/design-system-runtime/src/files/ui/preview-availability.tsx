import type * as React from "react";
import type * as Preview from "../../contracts/preview";
import type * as Model from "../../contracts";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../../runtime-types";
export function installFilesUiPreviewAvailability(
  runtime: RuntimeBindings,
): () => void {
  var reactFileAvailability: typeof import("react");
  var fileAvailabilityCache: Map<string, boolean>;
  var fileAvailabilityPending: Set<string>;
  var fileAvailabilitySubscribers: Set<() => void>;
  var fileAvailabilityRevision: number;
  var fileAvailabilityCacheKey: (path: string, bytes: number) => string;
  var fileAvailabilityNotifyPending: boolean;
  var reactComponentPreviews: typeof import("react");
  var jsxComponentPreviews: typeof import("react/jsx-runtime");
  var MAX_RESPONSIVE_PREVIEW_HEIGHT: number;
  var STATIC_PREVIEW_NOTE: string;
  function getFileAvailabilityRevision(): number {
    return fileAvailabilityRevision;
  }
  function subscribeFileAvailability(input: () => void): () => boolean {
    fileAvailabilitySubscribers.add(input);
    return () => fileAvailabilitySubscribers.delete(input);
  }
  function fileAvailabilityUrlPath(path: string): string {
    let normalized = (0, runtime.encodeRelativeUrlPath)(path),
      baseUri = globalThis.document?.baseURI;
    if (typeof baseUri !== "string" || !/^https?:/i.test(baseUri)) {
      return normalized;
    }
    try {
      return new URL(normalized, baseUri).pathname;
    } catch {
      return normalized;
    }
  }
  function cachedFileAvailability(
    path: string,
    bytes: number,
  ): boolean | undefined {
    return fileAvailabilityCache.get(fileAvailabilityCacheKey(path, bytes));
  }
  function finishFileAvailabilityProbe(key: string, available: boolean): void {
    fileAvailabilityPending.delete(key);
    fileAvailabilityCache.set(key, available);
    if (!available) {
      return;
    }
    fileAvailabilityRevision++;
    if (fileAvailabilityNotifyPending) {
      return;
    }
    fileAvailabilityNotifyPending = true;
    queueMicrotask(() => {
      fileAvailabilityNotifyPending = false;
      for (let value of fileAvailabilitySubscribers) {
        value();
      }
    });
  }
  function probeFileAvailability(
    path: string,
    mimePrefix: string,
    bytes: number,
    headFetch?: Preview.FileHeadFetch,
  ): boolean | undefined {
    let key = fileAvailabilityCacheKey(path, bytes),
      cached = fileAvailabilityCache.get(key);
    if (cached !== undefined) {
      return cached;
    }
    if (fileAvailabilityPending.has(key)) {
      return;
    }
    let fetchHead =
      headFetch ??
      (typeof fetch === "function"
        ? (input: string) =>
            fetch(input, {
              method: "HEAD",
              credentials: "same-origin",
              cache: "no-cache",
            })
        : undefined);
    if (fetchHead === undefined) {
      fileAvailabilityCache.set(key, false);
      return false;
    }
    fileAvailabilityPending.add(key);
    (async (): Promise<void> => {
      let flag = false;
      try {
        let value = await fetchHead(fileAvailabilityUrlPath(path)),
          value2 = (value.headers?.get("content-type") ?? "").toLowerCase(),
          value3 = value.headers?.get("content-length") ?? null;
        flag =
          value.ok &&
          value2.startsWith(mimePrefix) &&
          (bytes <= 0 ||
            (value3 !== null && value3 !== "" && Number(value3) === bytes));
      } catch {
        flag = false;
      }
      finishFileAvailabilityProbe(key, flag);
    })();
    return;
  }
  function useFileAvailability(files: Preview.FileAvailabilityEntry[]): number {
    let revision = reactFileAvailability.useSyncExternalStore(
        subscribeFileAvailability,
        getFileAvailabilityRevision,
        getFileAvailabilityRevision,
      ),
      fingerprint = files.map((input) => input.path + ":" + String(input.bytes))
        .join(`
`);
    reactFileAvailability.useEffect(() => {
      for (let value of files) {
        probeFileAvailability(value.path, value.typePrefix, value.bytes);
      }
    }, [fingerprint]);
    return revision;
  }
  function responsivePreviewHeight(height: number, width: number): number {
    let scale = width <= 0 || width >= 660 ? 1 : width >= 480 ? 1.3 : 1.6;
    return Math.min(MAX_RESPONSIVE_PREVIEW_HEIGHT, Math.round(height * scale));
  }
  function componentPreviewSource(
    component: Preview.PreviewComponent,
    previewHead: Preview.PreviewHeadResult,
    stage?: Preview.ComponentPreviewStage,
  ): Preview.ComponentPreviewSource {
    return {
      html:
        stage !== undefined
          ? (0, runtime.generateComponentMountHtml)(component.name, stage)
          : component.previewHtml,
      file: (0, runtime.projectFilePath)(
        (0, runtime.componentPreviewPath)(component.name),
      ),
      fromProps: stage !== undefined,
      staticReason:
        previewHead.staticReason !== "" ? STATIC_PREVIEW_NOTE : undefined,
    };
  }
  function FluidComponentPreview({
    c: c,
    height: height,
    ph: ph,
    stage: stage,
  }: Preview.FluidComponentPreviewProps): React.ReactElement {
    let [value, value2] = reactComponentPreviews.useState(false);
    reactComponentPreviews.useEffect(() => value2(true), []);
    let ref = reactComponentPreviews.useRef<HTMLDivElement | null>(null),
      [value3, value4] = reactComponentPreviews.useState(0);
    reactComponentPreviews.useEffect(() => {
      let current = ref.current;
      if (current === null) {
        return;
      }
      let callback = () => value4(Math.round(current.clientWidth));
      callback();
      if (typeof ResizeObserver === "undefined") {
        return;
      }
      let observer = new ResizeObserver(callback);
      observer.observe(current);
      return () => observer.disconnect();
    }, []);
    let value5 = responsivePreviewHeight(height, value3),
      value6 = componentPreviewSource(c, ph, stage);
    return (
      <div
        ref={ref}
        className={"ds-comp-preview-fill"}
        style={{
          minHeight: value5,
        }}
      >
        {value && value6.html !== undefined ? (
          <runtime.ComponentPreview
            html={value6.html}
            cardFile={value6.file}
            fromProps={value6.fromProps}
            head={ph.head}
            height={value5}
            title={c.name + " preview"}
            {...(value6.staticReason !== undefined
              ? {
                  staticReason: value6.staticReason,
                }
              : {})}
            data-testid={"ds-comp-preview-" + c.name}
          />
        ) : null}
      </div>
    );
  }
  function ScaledComponentPreview({
    c: c,
    width: width,
    height: height,
    ph: ph,
    stage: stage,
  }: Preview.ScaledComponentPreviewProps): React.ReactElement {
    let [value, value2] = reactComponentPreviews.useState(false);
    reactComponentPreviews.useEffect(() => value2(true), []);
    let [value3, value4] = reactComponentPreviews.useState<string | null>(null),
      value5 = componentPreviewSource(c, ph, stage);
    return (
      <div className={"ds-comp-preview-fill"}>
        {[
          <runtime.PreviewFitBox
            width={width}
            height={height}
            data-testid={"ds-comp-scaled-" + c.name}
          >
            {value && value5.html !== undefined ? (
              <runtime.ComponentPreview
                html={value5.html}
                cardFile={value5.file}
                fromProps={value5.fromProps}
                head={ph.head}
                height={height}
                title={c.name + " preview"}
                {...(value5.staticReason !== undefined
                  ? {
                      staticReason: value5.staticReason,
                    }
                  : {})}
                staticPageWidth={width}
                onStaticNote={value4}
                data-testid={"ds-comp-preview-" + c.name}
              />
            ) : null}
          </runtime.PreviewFitBox>,
          value3 !== null ? (
            <p
              className={"ds-swatch-note ds-pad mt-xs text-footnote text-muted"}
              data-testid={"ds-comp-preview-note-" + c.name}
            >
              {value3}
            </p>
          ) : null,
        ]}
      </div>
    );
  }
  function renderComponentPreview(
    component: Preview.PreviewComponent,
    dimensions: {
      height: number;
    },
    previewHead: Preview.PreviewHeadResult,
    stage?: Preview.ComponentPreviewStage,
  ): React.ReactElement | null {
    if (component.previewHtml === undefined) {
      return null;
    }
    if (component.previewWidth !== undefined) {
      return (
        <ScaledComponentPreview
          c={component}
          width={component.previewWidth}
          height={dimensions.height}
          ph={previewHead}
          stage={stage}
        />
      );
    }
    return (
      <FluidComponentPreview
        c={component}
        height={dimensions.height}
        ph={previewHead}
        stage={stage}
      />
    );
  }
  bindRuntimeValue(
    runtime,
    "reactFileAvailability",
    () => reactFileAvailability,
    (value) => {
      reactFileAvailability = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "fileAvailabilityCache",
    () => fileAvailabilityCache,
    (value) => {
      fileAvailabilityCache = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "fileAvailabilityPending",
    () => fileAvailabilityPending,
    (value) => {
      fileAvailabilityPending = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "fileAvailabilitySubscribers",
    () => fileAvailabilitySubscribers,
    (value) => {
      fileAvailabilitySubscribers = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "fileAvailabilityRevision",
    () => fileAvailabilityRevision,
    (value) => {
      fileAvailabilityRevision = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "fileAvailabilityCacheKey",
    () => fileAvailabilityCacheKey,
    (value) => {
      fileAvailabilityCacheKey = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "getFileAvailabilityRevision",
    () => getFileAvailabilityRevision,
  );
  bindRuntimeValue(
    runtime,
    "subscribeFileAvailability",
    () => subscribeFileAvailability,
  );
  bindRuntimeValue(
    runtime,
    "fileAvailabilityUrlPath",
    () => fileAvailabilityUrlPath,
  );
  bindRuntimeValue(
    runtime,
    "cachedFileAvailability",
    () => cachedFileAvailability,
  );
  bindRuntimeValue(
    runtime,
    "fileAvailabilityNotifyPending",
    () => fileAvailabilityNotifyPending,
    (value) => {
      fileAvailabilityNotifyPending = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "finishFileAvailabilityProbe",
    () => finishFileAvailabilityProbe,
  );
  bindRuntimeValue(
    runtime,
    "probeFileAvailability",
    () => probeFileAvailability,
  );
  bindRuntimeValue(runtime, "useFileAvailability", () => useFileAvailability);
  bindRuntimeValue(
    runtime,
    "reactComponentPreviews",
    () => reactComponentPreviews,
    (value) => {
      reactComponentPreviews = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxComponentPreviews",
    () => jsxComponentPreviews,
    (value) => {
      jsxComponentPreviews = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_RESPONSIVE_PREVIEW_HEIGHT",
    () => MAX_RESPONSIVE_PREVIEW_HEIGHT,
    (value) => {
      MAX_RESPONSIVE_PREVIEW_HEIGHT = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "responsivePreviewHeight",
    () => responsivePreviewHeight,
  );
  bindRuntimeValue(
    runtime,
    "STATIC_PREVIEW_NOTE",
    () => STATIC_PREVIEW_NOTE,
    (value) => {
      STATIC_PREVIEW_NOTE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "componentPreviewSource",
    () => componentPreviewSource,
  );
  bindRuntimeValue(
    runtime,
    "FluidComponentPreview",
    () => FluidComponentPreview,
  );
  bindRuntimeValue(
    runtime,
    "ScaledComponentPreview",
    () => ScaledComponentPreview,
  );
  bindRuntimeValue(
    runtime,
    "renderComponentPreview",
    () => renderComponentPreview,
  );
  return () => {
    reactFileAvailability = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    fileAvailabilityCache = new Map();
    fileAvailabilityPending = new Set();
    fileAvailabilitySubscribers = new Set();
    fileAvailabilityRevision = 0;
    fileAvailabilityCacheKey = (input: string, options: number) =>
      input + "\x00" + String(options);
    fileAvailabilityNotifyPending = false;
    reactComponentPreviews = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    jsxComponentPreviews = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
    MAX_RESPONSIVE_PREVIEW_HEIGHT = 4000;
    STATIC_PREVIEW_NOTE = "Static preview — see the note above.";
  };
}
