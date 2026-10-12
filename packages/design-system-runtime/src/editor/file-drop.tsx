import type * as React from "react";
import type * as Editor from "../contracts/editor-runtime";
import type * as Model from "../contracts";
import type * as Application from "../contracts/application";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installEditorFileDrop(runtime: RuntimeBindings): () => void {
  var reactAssetFileDrop: typeof import("react");
  var reactFileDrop: typeof import("react");
  var jsxFileDrop: typeof import("react/jsx-runtime");
  function FileDropZone({
    onFiles: onFiles,
    onLeftOut: onLeftOut,
    folder = false,
    large = false,
    line = "Drop files here or",
    hint: hint,
    testid: testid,
  }: Editor.FileDropZoneProps): React.ReactElement {
    let [value, value2] = reactFileDrop.useState(false),
      ref = reactFileDrop.useRef<HTMLInputElement | null>(null),
      callback = (items: File[], options: number = 0): void => {
        let value3 =
          options + Math.max(0, items.length - runtime.MAX_DROPPED_FILES);
        if (value3 > 0) {
          onLeftOut?.(value3);
        }
        if (items.length > 0) {
          onFiles(items.slice(0, runtime.MAX_DROPPED_FILES));
        }
      },
      callback2 = (event: React.DragEvent<HTMLDivElement>): void => {
        if (!event.dataTransfer.types.includes("Files")) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        value2(false);
        (0, runtime.extractDroppedFiles)(event.dataTransfer).then((input) =>
          callback(input.files, input.leftOut),
        );
      };
    return (
      <div
        className={
          "ds-file-drop" +
          (large ? " ds-file-drop-lg" : "") +
          (value ? " ds-file-drop-over" : "")
        }
        data-testid={testid + "-drop"}
        onDragEnter={(event: React.DragEvent<HTMLDivElement>): void => {
          if (event.dataTransfer.types.includes("Files")) {
            event.preventDefault();
            event.stopPropagation();
            value2(true);
          }
        }}
        onDragOver={(event: React.DragEvent<HTMLDivElement>): void => {
          if (event.dataTransfer.types.includes("Files")) {
            event.preventDefault();
            event.stopPropagation();
            event.dataTransfer.dropEffect = "copy";
          }
        }}
        onDragLeave={() => value2(false)}
        onDrop={callback2}
      >
        {[
          <runtime.Icon name={"Upload"} size={large ? "lg" : "md"} />,
          <span className={"text-center text-body text-secondary"}>
            {line}
          </span>,
          hint !== undefined ? (
            <span className={"text-center text-footnote text-secondary"}>
              {hint}
            </span>
          ) : null,
          <span className={"flex flex-wrap items-center justify-center gap-sm"}>
            {[
              <runtime.Button
                variant={large ? "ghost" : "secondary"}
                size={"sm"}
                onClick={() => ref.current?.click()}
                data-testid={testid + "-choose"}
              >
                {"Choose files…"}
              </runtime.Button>,
              folder ? (
                <runtime.Button
                  variant={large ? "ghost" : "secondary"}
                  size={"sm"}
                  onClick={() =>
                    void (0, runtime.pickUploadFiles)(true).then((input) =>
                      callback(input),
                    )
                  }
                  data-testid={testid + "-folder"}
                >
                  {"Choose a folder…"}
                </runtime.Button>
              ) : null,
            ]}
          </span>,
          <input
            ref={ref}
            type={"file"}
            multiple={true}
            hidden={true}
            data-testid={testid + "-input"}
            onChange={(input: React.ChangeEvent<HTMLInputElement>): void => {
              callback(Array.from(input.currentTarget.files ?? []));
              input.currentTarget.value = "";
            }}
          />,
        ]}
      </div>
    );
  }
  function PendingUploadFiles({
    files: files,
    onRemove: onRemove,
    testid: testid,
  }: Editor.PendingUploadFilesProps): React.ReactElement {
    return (
      <ul
        className={"ds-file-rows flex flex-col"}
        data-testid={testid + "-files"}
      >
        {files.map((input, options) =>
          (() => {
            const _Element = "li";
            const _elementProps = {
              className: "flex min-h-6 min-w-0 items-center gap-sm",
              children: [
                <span
                  className={"min-w-0 flex-1 truncate font-mono text-footnote"}
                  title={input.name}
                >
                  {input.name}
                </span>,
                onRemove !== undefined ? (
                  <runtime.Button
                    variant={"ghost"}
                    size={"sm"}
                    iconOnly={true}
                    icon={"X"}
                    aria-label={"Remove " + input.name}
                    tooltip={"Remove"}
                    onClick={() => onRemove(options)}
                    data-testid={testid + "-remove-" + String(options)}
                  />
                ) : null,
              ],
            };
            const _elementKey = input.name + ":" + String(options);
            return <_Element key={_elementKey} {..._elementProps} />;
          })(),
        )}
      </ul>
    );
  }
  bindRuntimeValue(
    runtime,
    "reactAssetFileDrop",
    () => reactAssetFileDrop,
    (value) => {
      reactAssetFileDrop = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactFileDrop",
    () => reactFileDrop,
    (value) => {
      reactFileDrop = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxFileDrop",
    () => jsxFileDrop,
    (value) => {
      jsxFileDrop = value;
    },
  );
  bindRuntimeValue(runtime, "FileDropZone", () => FileDropZone);
  bindRuntimeValue(runtime, "PendingUploadFiles", () => PendingUploadFiles);
  return () => {
    reactAssetFileDrop = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    reactFileDrop = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    jsxFileDrop = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
  };
}
