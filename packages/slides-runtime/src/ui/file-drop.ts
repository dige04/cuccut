/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type ReactNamespace,
} from "../bindings";
import type * as React from "react";

/** Options for `useFileDrop`. */
export interface FileDropOptions {
  disabled?: boolean;
  /** Receives the dropped files (already filtered by `accept`). */
  onFiles: (files: File[], event: React.DragEvent) => void;
  /** Keeps only the files this predicate approves; a drop with none left is ignored. */
  accept?: (file: File) => boolean;
}
/** `FileDropOptions` plus the shared state the drag handlers update. */
export interface FileDropHandlerOptions extends FileDropOptions {
  /** Nested drag-enter depth, so child elements do not flicker the overlay. */
  depth: React.RefObject<number>;
  /** True while a drag started inside the page, which is never a file drop. */
  internal?: React.RefObject<boolean>;
  setOver: (over: boolean) => void;
}
/** Drag handlers to spread on the drop target. */
export interface FileDropTargetProps {
  onDragEnter: (event: React.DragEvent) => void;
  onDragOver: (event: React.DragEvent) => void;
  onDragLeave: (event: React.DragEvent) => void;
  onDrop: (event: React.DragEvent) => void;
}
export interface FileDropState {
  /** True while files are dragged over the target. */
  over: boolean;
  targetProps: FileDropTargetProps;
}

declare module "../bindings" {
  interface RuntimeBindings {
    reactpC: ReactNamespace;
    dataTransferHasFiles: (dataTransfer: DataTransfer | null) => dataTransfer is DataTransfer;
    createFileDropHandlers: (options: FileDropHandlerOptions) => FileDropTargetProps;
    installInternalFileDragTracking: (
      target: Window,
      onDrop: () => void,
      internalDragRef: React.RefObject<boolean>,
    ) => () => void;
    useFileDrop: (options: FileDropOptions) => FileDropState;
  }
}

export function installUiFileDrop(runtime: RuntimeBindings): () => void {
  var reactpC: ReactNamespace;
  function dataTransferHasFiles(dataTransfer: DataTransfer | null): dataTransfer is DataTransfer {
    return (
      dataTransfer !== null &&
      Array.from(dataTransfer.types).includes("Files")
    );
  }
  function createFileDropHandlers(options: FileDropHandlerOptions): FileDropTargetProps {
    let callback = (input: React.DragEvent): boolean =>
      options.internal?.current !== true &&
      dataTransferHasFiles(input.dataTransfer);
    return {
      onDragEnter: (event: React.DragEvent): void => {
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
      onDragOver: (event: React.DragEvent): void => {
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
      onDragLeave: (input: React.DragEvent): void => {
        if (!callback(input)) {
          return;
        }
        options.depth.current = Math.max(0, options.depth.current - 1);
        if (options.depth.current === 0) {
          options.setOver(false);
        }
      },
      onDrop: (event: React.DragEvent): void => {
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
  ): () => void {
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
      callback4 = (input: DragEvent): void => {
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
      callback5 = (input: DragEvent): void => {
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
  function useFileDrop(options: FileDropOptions): FileDropState {
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
  return () => {
    reactpC = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
  };
}
