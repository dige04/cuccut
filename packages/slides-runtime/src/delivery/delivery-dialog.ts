/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type JsxNamespace,
  type ReactNamespace,
} from "../bindings";
import type * as React from "react";
import type { ExportDeliveryRequest } from "../editor/app";

/** Props of the dialog that offers a file the host could not save by itself. */
export interface ExportDeliveryDialogProps {
  delivery: ExportDeliveryRequest | null;
  onClose: () => void;
}

declare module "../bindings" {
  interface RuntimeBindings {
    ReactExportDelivery: ReactNamespace;
    ExportDeliveryJsx: JsxNamespace;
    PPTX_MIME_TYPE: string;
    PDF_MIME_TYPE: string;
    HTML_MIME_TYPE: string;
    PNG_MIME_TYPE: string;
    /** Explains why the host did not save the file; `code` is the reason the host gave. */
    exportDeliveryFailureMessage: (
      code: string,
      extension: string,
      bytes: number,
    ) => string;
    ExportDeliveryDialog: (
      props: ExportDeliveryDialogProps,
    ) => React.ReactElement | null;
  }
}

export function installDeliveryDialog(
  runtime: RuntimeBindings,
): () => void {
  var ReactExportDelivery: ReactNamespace;
  var ExportDeliveryJsx: JsxNamespace;
  var PPTX_MIME_TYPE: RuntimeBindings["PPTX_MIME_TYPE"];
  var PDF_MIME_TYPE: RuntimeBindings["PDF_MIME_TYPE"];
  var HTML_MIME_TYPE: RuntimeBindings["HTML_MIME_TYPE"];
  var PNG_MIME_TYPE: RuntimeBindings["PNG_MIME_TYPE"];
  function exportDeliveryFailureMessage(
    code: string,
    extension: string,
    bytes: number,
  ): string {
    let lowerExtension = extension.toLowerCase();
    switch (code) {
      case "extension_not_enabled":
        return "This host can’t save ." + lowerExtension + " files yet.";
      case "too_large":
        return (
          "This host wouldn’t save a " +
          (Math.ceil((bytes / 1048576) * 10) / 10).toFixed(1) +
          " MB " +
          extension +
          "."
        );
      case "no_shell_save":
        return "If the download didn’t start, save it from here.";
      case "unavailable":
        return "The save didn’t go through. Close and try again, or save it from here.";
      case "rate_limited":
        return "The save didn’t go through right now (another prompt may be open). Close and try again, or save it from here.";
      default:
        return "The file couldn’t be saved from here.";
    }
  }
  function ExportDeliveryDialog({
    delivery: delivery,
    onClose: onClose,
  }: ExportDeliveryDialogProps): React.ReactElement | null {
    let memo = ReactExportDelivery.useMemo(
      () => (delivery ? URL.createObjectURL(delivery.blob) : null),
      [delivery],
    );
    ReactExportDelivery.useEffect(() => {
      if (memo === null) {
        return;
      }
      return () => URL.revokeObjectURL(memo);
    }, [memo]);
    if (!delivery || memo === null) {
      return null;
    }
    let value = Math.max(1, Math.round(delivery.blob.size / 1024));
    return ExportDeliveryJsx.jsx(runtime.DialogComponents.Root, {
      open: true,
      onOpenChange: (input: boolean) => {
        if (!input) {
          onClose();
        }
      },
      children: ExportDeliveryJsx.jsxs(runtime.DialogComponents.Popup, {
        size: "sm",
        children: [
          ExportDeliveryJsx.jsx(runtime.DialogComponents.Header, {
            showClose: true,
            children: delivery.kind + " ready",
          }),
          ExportDeliveryJsx.jsxs("div", {
            className: "mt-3 flex flex-col gap-3 text-sm",
            children: [
              ExportDeliveryJsx.jsx("p", {
                className: "text-sm",
                children: exportDeliveryFailureMessage(
                  delivery.reason,
                  delivery.kind,
                  delivery.blob.size,
                ),
              }),
              ExportDeliveryJsx.jsxs("div", {
                draggable: true,
                onDragStart: (input: React.DragEvent<HTMLDivElement>) => {
                  input.dataTransfer.effectAllowed = "copy";
                  input.dataTransfer.setData(
                    "DownloadURL",
                    delivery.mime + ":" + delivery.filename + ":" + memo,
                  );
                },
                title: "Drag this out of the window to save the file",
                className:
                  "flex cursor-grab items-center gap-2.5 rounded-lg border border-border-line bg-panel px-3 py-2.5 shadow-sm select-none hover:bg-wash-1 active:cursor-grabbing",
                children: [
                  ExportDeliveryJsx.jsx(runtime.KitIcon, {
                    name: "File",
                    size: 18,
                    className: "shrink-0 text-fg-secondary",
                  }),
                  ExportDeliveryJsx.jsxs("div", {
                    className: "min-w-0 flex-1",
                    children: [
                      ExportDeliveryJsx.jsx("div", {
                        className: "truncate text-sm font-medium",
                        children: delivery.filename,
                      }),
                      ExportDeliveryJsx.jsxs("div", {
                        className: "text-xs text-fg-muted",
                        children: [value, " KB"],
                      }),
                    ],
                  }),
                  ExportDeliveryJsx.jsx("span", {
                    className:
                      "shrink-0 rounded border border-border-line bg-page px-1.5 py-0.5 text-[11px] text-fg-muted",
                    children: "drag me out",
                  }),
                ],
              }),
              ExportDeliveryJsx.jsxs("p", {
                className: "text-xs text-fg-muted",
                children: [
                  ExportDeliveryJsx.jsx("strong", {
                    children: "Drag the chip",
                  }),
                  " onto your desktop or a folder to save it (Chrome and Edge; may not work in the desktop app). Or ask the agent for the file.",
                ],
              }),
            ],
          }),
          ExportDeliveryJsx.jsx(runtime.DialogComponents.Footer, {
            align: "end",
            children: ExportDeliveryJsx.jsx(runtime.DialogComponents.Close, {
              render: ExportDeliveryJsx.jsx(runtime.Button, {
                variant: "primary",
                children: "Done",
              }),
            }),
          }),
        ],
      }),
    });
  }
  bindRuntimeValue(
    runtime,
    "ReactExportDelivery",
    () => ReactExportDelivery,
    (value) => {
      ReactExportDelivery = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ExportDeliveryJsx",
    () => ExportDeliveryJsx,
    (value) => {
      ExportDeliveryJsx = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PPTX_MIME_TYPE",
    () => PPTX_MIME_TYPE,
    (value) => {
      PPTX_MIME_TYPE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PDF_MIME_TYPE",
    () => PDF_MIME_TYPE,
    (value) => {
      PDF_MIME_TYPE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "HTML_MIME_TYPE",
    () => HTML_MIME_TYPE,
    (value) => {
      HTML_MIME_TYPE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PNG_MIME_TYPE",
    () => PNG_MIME_TYPE,
    (value) => {
      PNG_MIME_TYPE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "exportDeliveryFailureMessage",
    () => exportDeliveryFailureMessage,
  );
  bindRuntimeValue(runtime, "ExportDeliveryDialog", () => ExportDeliveryDialog);
  return () => {
    (0, runtime.initializeUiInputs210)();
    ReactExportDelivery = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    ExportDeliveryJsx = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
    PPTX_MIME_TYPE =
      "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    PDF_MIME_TYPE = "application/pdf";
    HTML_MIME_TYPE = "text/html";
    PNG_MIME_TYPE = "image/png";
  };
}
