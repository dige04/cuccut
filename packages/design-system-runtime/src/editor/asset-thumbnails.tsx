import type * as React from "react";
import type * as Editor from "../contracts/editor-runtime";
import type * as Model from "../contracts";
import type * as Application from "../contracts/application";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installEditorAssetThumbnails(
  runtime: RuntimeBindings,
): () => void {
  var reactAssetGroups: typeof import("react");
  var reactDomAssetGroups: typeof import("react-dom");
  var reactAssetThumbnail: typeof import("react");
  var assetThumbnailGeneration: number;
  var assetThumbnailSubscribers: Set<() => void>;
  var notifyAssetThumbnailSources: () => void;
  var subscribeAssetThumbnailSources: (listener: () => void) => () => void;
  var assetThumbnailSourceSnapshot: () => number;
  var ASSET_THUMBNAIL_RETRY_MS: number;
  var reportedAssetThumbnailFailures: Set<string>;
  var assetThumbnailRetryTimers: Map<
    string,
    Promise<Editor.ThumbnailProbeResult>
  >;
  var assetAddressRoot: (url: string) => string;
  function useAssetThumbnailSources(): void {
    reactAssetThumbnail.useSyncExternalStore(
      subscribeAssetThumbnailSources,
      assetThumbnailSourceSnapshot,
      assetThumbnailSourceSnapshot,
    );
  }
  function resolvedAssetFileBytes(
    files: Model.FileTable,
    path: string,
    bytes?: number,
  ): number {
    if (
      (bytes ?? 0) > 0 ||
      !(0, runtime.isHeldFilePointer)(path, files[path] ?? "")
    ) {
      return bytes ?? 0;
    }
    return (
      (0, runtime.addressedFileEntry)((0, runtime.projectFilePath)(path))
        ?.size ?? 0
    );
  }
  function retryAssetThumbnailAddress(
    files: string,
    image: Editor.ThumbnailEvent | undefined,
    path: () => void,
    reason: () => void,
  ): void {
    try {
      let value = globalThis.document?.baseURI ?? "",
        value2 =
          image?.currentTarget?.currentSrc ||
          image?.currentTarget?.src ||
          (0, runtime.encodeRelativeUrlPath)(
            (0, runtime.projectFilePath)(files),
          ),
        pathname = new URL(value2, value).pathname,
        value3 = assetAddressRoot(pathname),
        entry = assetThumbnailRetryTimers.get(pathname);
      if (entry === undefined) {
        entry = new Promise<void>((input) =>
          setTimeout(input, ASSET_THUMBNAIL_RETRY_MS),
        )
          .then(() =>
            fetch(pathname, {
              method: "HEAD",
              credentials: "same-origin",
              cache: "no-store",
            }),
          )
          .then(
            (state) => ({
              ok: state.ok,
              status: state.status,
            }),
            () => ({
              ok: false,
              status: 0,
            }),
          )
          .finally(() => assetThumbnailRetryTimers.delete(pathname));
        assetThumbnailRetryTimers.set(pathname, entry);
      }
      entry.then((state): void => {
        if (state.ok) {
          path();
          return;
        }
        reason();
        if (state.status === 0 || reportedAssetThumbnailFailures.has(value3)) {
          return;
        }
        reportedAssetThumbnailFailures.add(value3);
        if (
          value3 === assetAddressRoot(new URL(value).pathname) &&
          (0, runtime.isPublishedPreviewStillOffered)(pathname)
        ) {
          (0, runtime.notePublishedPreviewFailure)(pathname, files);
        } else {
          console.warn(
            "design-system: could not load " +
              files +
              " from its address (" +
              pathname +
              ", HTTP " +
              String(state.status) +
              "). Reload the page.",
          );
        }
      });
    } catch {
      reason();
    }
  }
  function useAssetThumbnailSource(
    files: Model.FileTable,
    path: string,
  ): Editor.ThumbnailSource {
    useAssetThumbnailSources();
    let value = (0, runtime.isHeldFilePointer)(path, files[path] ?? ""),
      ref = reactAssetThumbnail.useRef<Editor.AddressedLoadState | null>(null),
      [, value2] = reactAssetThumbnail.useReducer(
        (input: number) => input + 1,
        0,
      );
    if (!value) {
      ref.current = null;
      return {
        part: 0,
      };
    }
    let callback = () => (0, runtime.addressedProjectFileUrl)(path);
    if (ref.current === null) {
      ref.current = (0, runtime.createAddressedFileLoadState)(
        (0, runtime.resolveFileVersion)(path),
        callback(),
      );
    }
    let current = ref.current!,
      value3 = (0, runtime.refreshAddressedFileVersion)(
        current,
        (0, runtime.addressedFileEntry)((0, runtime.projectFilePath)(path))
          ?.sha256 ?? (0, runtime.resolveFileVersion)(path),
        callback,
      ),
      value4 = (0, runtime.currentAddressedFileSource)(current, callback);
    return {
      part: value3,
      ...(value4 !== undefined
        ? {
            src: value4,
          }
        : {}),
      onLoad: (): void => {
        current.loaded = true;
      },
      onError: (input: Editor.ThumbnailEvent): void => {
        if ((0, runtime.retryAddressedFileSource)(current, callback)) {
          setTimeout((): void => {
            (0, runtime.advanceAddressedFileSource)(current);
            value2();
          }, ASSET_THUMBNAIL_RETRY_MS);
          return;
        }
        if (current.next !== null) {
          return;
        }
        let last = current.last,
          value5 = callback();
        retryAssetThumbnailAddress(
          path,
          input,
          (): void => {
            if (current.last === last) {
              current.loaded = true;
            }
          },
          (): void => {
            if (current.last === last) {
              (0, runtime.refuseAddressedFileSource)(current, () => value5);
            }
          },
        );
      },
    };
  }
  bindRuntimeValue(
    runtime,
    "reactAssetGroups",
    () => reactAssetGroups,
    (value) => {
      reactAssetGroups = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactDomAssetGroups",
    () => reactDomAssetGroups,
    (value) => {
      reactDomAssetGroups = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactAssetThumbnail",
    () => reactAssetThumbnail,
    (value) => {
      reactAssetThumbnail = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "assetThumbnailGeneration",
    () => assetThumbnailGeneration,
    (value) => {
      assetThumbnailGeneration = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "assetThumbnailSubscribers",
    () => assetThumbnailSubscribers,
    (value) => {
      assetThumbnailSubscribers = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "notifyAssetThumbnailSources",
    () => notifyAssetThumbnailSources,
    (value) => {
      notifyAssetThumbnailSources = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "subscribeAssetThumbnailSources",
    () => subscribeAssetThumbnailSources,
    (value) => {
      subscribeAssetThumbnailSources = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "assetThumbnailSourceSnapshot",
    () => assetThumbnailSourceSnapshot,
    (value) => {
      assetThumbnailSourceSnapshot = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "useAssetThumbnailSources",
    () => useAssetThumbnailSources,
  );
  bindRuntimeValue(
    runtime,
    "resolvedAssetFileBytes",
    () => resolvedAssetFileBytes,
  );
  bindRuntimeValue(
    runtime,
    "ASSET_THUMBNAIL_RETRY_MS",
    () => ASSET_THUMBNAIL_RETRY_MS,
    (value) => {
      ASSET_THUMBNAIL_RETRY_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reportedAssetThumbnailFailures",
    () => reportedAssetThumbnailFailures,
    (value) => {
      reportedAssetThumbnailFailures = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "assetThumbnailRetryTimers",
    () => assetThumbnailRetryTimers,
    (value) => {
      assetThumbnailRetryTimers = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "assetAddressRoot",
    () => assetAddressRoot,
    (value) => {
      assetAddressRoot = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "retryAssetThumbnailAddress",
    () => retryAssetThumbnailAddress,
  );
  bindRuntimeValue(
    runtime,
    "useAssetThumbnailSource",
    () => useAssetThumbnailSource,
  );
  return () => {
    reactAssetGroups = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    reactDomAssetGroups = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactDomNamespace)(),
      1,
    );
    reactAssetThumbnail = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    assetThumbnailGeneration = 0;
    assetThumbnailSubscribers = new Set();
    notifyAssetThumbnailSources = (): void => {
      assetThumbnailGeneration++;
      for (let value of [...assetThumbnailSubscribers]) {
        try {
          value();
        } catch {}
      }
    };
    (0, runtime.subscribeAddressedFileEntries)(notifyAssetThumbnailSources);
    (0, runtime.subscribeAddressedFiles)(notifyAssetThumbnailSources);
    subscribeAssetThumbnailSources = (input: () => void) => {
      assetThumbnailSubscribers.add(input);
      return () => void assetThumbnailSubscribers.delete(input);
    };
    assetThumbnailSourceSnapshot = (): number => assetThumbnailGeneration;
    ASSET_THUMBNAIL_RETRY_MS = 300;
    reportedAssetThumbnailFailures = new Set();
    assetThumbnailRetryTimers = new Map();
    assetAddressRoot = (url: string) =>
      /^(.*?\/_f\/[^/]+\/)/.exec(url)?.[1] ?? url;
  };
}
