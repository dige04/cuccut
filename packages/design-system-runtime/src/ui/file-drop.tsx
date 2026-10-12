/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
import type * as React from "react";
import type {
  ReactNamespace,
  JsxNamespace,
  FileDropOptions,
  FileDropHandlerOptions,
  FileDropOverlayProps,
} from "../contracts/composition";
export function installUiFileDrop(runtime: RuntimeBindings): () => void {
  var reactFileDropTarget: ReactNamespace;
  var jsxFileDropTarget: JsxNamespace;
  var jsxFileDropHints: JsxNamespace;
  var reactFileDropUiFileDrop: ReactNamespace;
  var jsxFileDropUiFileDrop: JsxNamespace;
  var jsxFileDropContent: JsxNamespace;
  var reactpC: ReactNamespace;
  var jsxFileDropOverlay: JsxNamespace;
  var FILE_DROP_RING_CLASS: string;
  var FILE_DROP_FADE_CLASS: string;
  var FILE_DROP_RING_ENTER_CLASS: string;
  var FILE_DROP_LABEL_ENTER_CLASS: string;
  var FILE_DROP_ICON_ENTER_CLASS: string;
  function dataTransferHasFiles(
    dataTransfer: DataTransfer | null,
  ): dataTransfer is DataTransfer {
    return (
      dataTransfer !== null && Array.from(dataTransfer.types).includes("Files")
    );
  }
  function createFileDropHandlers(options: FileDropHandlerOptions) {
    let callback = (input: React.DragEvent<HTMLElement>) =>
      options.internal?.current !== true &&
      dataTransferHasFiles(input.dataTransfer);
    return {
      onDragEnter: (event: React.DragEvent<HTMLElement>) => {
        if (!callback(event)) {
          return;
        }
        event.preventDefault();
        if (options.disabled) {
          return;
        }
        options.depth.current += 1;
        options.setOver(true);
      },
      onDragOver: (event: React.DragEvent<HTMLElement>) => {
        if (!callback(event)) {
          return;
        }
        event.preventDefault();
        event.dataTransfer.dropEffect = options.disabled ? "none" : "copy";
        if (options.disabled) {
          return;
        }
        options.depth.current = Math.max(options.depth.current, 1);
        options.setOver(true);
      },
      onDragLeave: (input: React.DragEvent<HTMLElement>) => {
        if (!callback(input)) {
          return;
        }
        options.depth.current = Math.max(0, options.depth.current - 1);
        if (options.depth.current === 0) {
          options.setOver(false);
        }
      },
      onDrop: (event: React.DragEvent<HTMLElement>) => {
        if (!callback(event)) {
          return;
        }
        options.depth.current = 0;
        options.setOver(false);
        event.preventDefault();
        if (options.disabled) {
          return;
        }
        let value = Array.from(event.dataTransfer.files),
          value2 =
            options.accept === undefined ? value : value.filter(options.accept);
        if (options.accept !== undefined && value2.length === 0) {
          return;
        }
        options.onFiles(value2, event);
      },
    };
  }
  function installInternalFileDragTracking(
    target: Window,
    onDrop: () => void,
    internalDragRef: React.RefObject<boolean>,
  ) {
    let value = target,
      callback = () => {
        internalDragRef.current = true;
      },
      callback2 = () => {
        internalDragRef.current = false;
      },
      callback3 = () => {
        internalDragRef.current = false;
        onDrop();
      },
      callback4 = (input: DragEvent) => {
        let value2 = input,
          value3 =
            value2.clientX > 0 &&
            value2.clientY > 0 &&
            value2.clientX < value.innerWidth &&
            value2.clientY < value.innerHeight;
        if (value2.relatedTarget === null && !value3) {
          callback3();
        }
      },
      callback5 = (input: DragEvent) => {
        let value2 = input,
          dataTransfer = value2.dataTransfer;
        if (
          internalDragRef.current ||
          value2.defaultPrevented ||
          !dataTransferHasFiles(dataTransfer)
        ) {
          return;
        }
        value2.preventDefault();
        if (value2.type === "dragover") {
          dataTransfer.dropEffect = "none";
        }
      };
    target.addEventListener("dragstart", callback, true);
    target.addEventListener("dragend", callback2, true);
    target.addEventListener("mousemove", callback2, true);
    target.addEventListener("drop", onDrop, true);
    target.addEventListener("dragleave", callback4, true);
    target.addEventListener("blur", callback3);
    target.addEventListener("dragover", callback5);
    target.addEventListener("drop", callback5);
    target.addEventListener("drop", callback2);
    return () => {
      target.removeEventListener("dragstart", callback, true);
      target.removeEventListener("dragend", callback2, true);
      target.removeEventListener("mousemove", callback2, true);
      target.removeEventListener("drop", onDrop, true);
      target.removeEventListener("dragleave", callback4, true);
      target.removeEventListener("blur", callback3);
      target.removeEventListener("dragover", callback5);
      target.removeEventListener("drop", callback5);
      target.removeEventListener("drop", callback2);
    };
  }
  function useFileDrop(options: FileDropOptions) {
    let [value, value2] = reactpC.useState(false),
      ref = reactpC.useRef(0),
      ref2 = reactpC.useRef(false);
    reactpC.useEffect(
      () =>
        installInternalFileDragTracking(
          window,
          () => {
            ref.current = 0;
            value2(false);
          },
          ref2,
        ),
      [],
    );
    reactpC.useEffect(() => {
      if (!options.disabled) {
        return;
      }
      ref.current = 0;
      value2(false);
    }, [options.disabled]);
    let memo = reactpC.useMemo(
      () =>
        createFileDropHandlers({
          disabled: options.disabled,
          onFiles: options.onFiles,
          accept: options.accept,
          depth: ref,
          internal: ref2,
          setOver: value2,
        }),
      [options.disabled, options.onFiles, options.accept],
    );
    return {
      over: value,
      targetProps: memo,
    };
  }
  function FileDropOverlay({
    show: show,
    label: label,
    hint: hint,
  }: FileDropOverlayProps) {
    if (!show) {
      return null;
    }
    return (
      <div
        aria-hidden={"true"}
        data-testid={"drop-overlay"}
        className={"pointer-events-none absolute inset-0 z-10"}
      >
        {[
          <div
            className={`absolute inset-0 backdrop-blur-[12px] ${FILE_DROP_FADE_CLASS}`}
          />,
          <div
            className={`absolute inset-0 bg-page opacity-60 ${FILE_DROP_FADE_CLASS}`}
          />,
          <div
            className={`absolute inset-3.5 flex flex-col items-center justify-center gap-sm rounded-card px-lg text-center ${FILE_DROP_RING_CLASS} ${FILE_DROP_RING_ENTER_CLASS}`}
          >
            {[
              <div
                className={`absolute inset-0 rounded-[inherit] shadow-[inset_0_0_24px_0_color-mix(in_srgb,var(--cds-fill-accent)_20%,transparent)] ${FILE_DROP_LABEL_ENTER_CLASS}`}
              />,
              <div
                className={"flex items-end gap-md"}
                style={{
                  color: "var(--cds-fill-accent)",
                }}
              >
                {[
                  <span className={"-rotate-[14deg]"}>
                    <runtime.KitIcon
                      name={"Image"}
                      size={28}
                      className={FILE_DROP_ICON_ENTER_CLASS}
                      style={{
                        ["--rise-delay"]: "60ms",
                      }}
                    />
                  </span>,
                  <span className={"-translate-y-3"}>
                    <runtime.KitIcon
                      name={"Files"}
                      size={28}
                      className={FILE_DROP_ICON_ENTER_CLASS}
                    />
                  </span>,
                  <span className={"rotate-[14deg]"}>
                    <runtime.KitIcon
                      name={"Folder"}
                      size={28}
                      className={FILE_DROP_ICON_ENTER_CLASS}
                      style={{
                        ["--rise-delay"]: "120ms",
                      }}
                    />
                  </span>,
                ]}
              </div>,
              <span className={"text-body font-medium text-accent"}>
                {label}
              </span>,
              hint !== undefined ? (
                <span className={"text-footnote text-secondary"}>{hint}</span>
              ) : null,
            ]}
          </div>,
        ]}
      </div>
    );
  }
  bindRuntimeValue(
    runtime,
    "reactFileDropTarget",
    () => reactFileDropTarget,
    (value) => {
      reactFileDropTarget = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxFileDropTarget",
    () => jsxFileDropTarget,
    (value) => {
      jsxFileDropTarget = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxFileDropHints",
    () => jsxFileDropHints,
    (value) => {
      jsxFileDropHints = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactFileDropUiFileDrop",
    () => reactFileDropUiFileDrop,
    (value) => {
      reactFileDropUiFileDrop = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxFileDropUiFileDrop",
    () => jsxFileDropUiFileDrop,
    (value) => {
      jsxFileDropUiFileDrop = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxFileDropContent",
    () => jsxFileDropContent,
    (value) => {
      jsxFileDropContent = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactpC",
    () => reactpC,
    (value) => {
      reactpC = value;
    },
  );
  bindRuntimeValue(runtime, "dataTransferHasFiles", () => dataTransferHasFiles);
  bindRuntimeValue(
    runtime,
    "createFileDropHandlers",
    () => createFileDropHandlers,
  );
  bindRuntimeValue(
    runtime,
    "installInternalFileDragTracking",
    () => installInternalFileDragTracking,
  );
  bindRuntimeValue(runtime, "useFileDrop", () => useFileDrop);
  bindRuntimeValue(
    runtime,
    "jsxFileDropOverlay",
    () => jsxFileDropOverlay,
    (value) => {
      jsxFileDropOverlay = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FILE_DROP_RING_CLASS",
    () => FILE_DROP_RING_CLASS,
    (value) => {
      FILE_DROP_RING_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FILE_DROP_FADE_CLASS",
    () => FILE_DROP_FADE_CLASS,
    (value) => {
      FILE_DROP_FADE_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FILE_DROP_RING_ENTER_CLASS",
    () => FILE_DROP_RING_ENTER_CLASS,
    (value) => {
      FILE_DROP_RING_ENTER_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FILE_DROP_LABEL_ENTER_CLASS",
    () => FILE_DROP_LABEL_ENTER_CLASS,
    (value) => {
      FILE_DROP_LABEL_ENTER_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FILE_DROP_ICON_ENTER_CLASS",
    () => FILE_DROP_ICON_ENTER_CLASS,
    (value) => {
      FILE_DROP_ICON_ENTER_CLASS = value;
    },
  );
  bindRuntimeValue(runtime, "FileDropOverlay", () => FileDropOverlay);
  return () => {
    reactFileDropTarget = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    jsxFileDropTarget = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
    jsxFileDropHints = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
    reactFileDropUiFileDrop = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    jsxFileDropUiFileDrop = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
    jsxFileDropContent = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
    reactpC = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    jsxFileDropOverlay = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
    FILE_DROP_RING_CLASS = "shadow-[inset_0_0_0_2px_var(--cds-fill-accent)]";
    FILE_DROP_FADE_CLASS =
      "motion-safe:animate-[cds-fade-in_0.15s_cubic-bezier(0.215,0.61,0.355,1)]";
    FILE_DROP_RING_ENTER_CLASS =
      "motion-safe:animate-[mc-drop-ring-in_0.15s_cubic-bezier(0.215,0.61,0.355,1)]";
    FILE_DROP_LABEL_ENTER_CLASS =
      "motion-safe:animate-[cds-fade-in_0.2s_cubic-bezier(0.215,0.61,0.355,1)_0.08s_backwards]";
    FILE_DROP_ICON_ENTER_CLASS =
      "motion-safe:animate-[mc-drop-icon-rise_0.22s_cubic-bezier(0.215,0.61,0.355,1)_var(--rise-delay,0ms)_backwards]";
  };
}
