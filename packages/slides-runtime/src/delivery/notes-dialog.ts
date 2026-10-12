/** Restored application module; prepare first, initialize in original order. */
import type { ReactElement } from "react";
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type JsxNamespace,
  type ReactNamespace,
} from "../bindings";

/** Props of the dialog that lists what the last export could not carry over. */
export interface ExportNotesDialogProps {
  notes: readonly string[];
  /** Called once the dialog has finished closing. */
  onClosed: () => void;
}

declare module "../bindings" {
  interface RuntimeBindings {
    ReactExportNotes: ReactNamespace;
    ExportNotesJsx: JsxNamespace;
    ExportNotesDialog: (props: ExportNotesDialogProps) => ReactElement;
  }
}

export function installDeliveryNotesDialog(
  runtime: RuntimeBindings,
): () => void {
  var ReactExportNotes: ReactNamespace;
  var ExportNotesJsx: JsxNamespace;
  function ExportNotesDialog({
    notes: notes,
    onClosed: onClosed,
  }: ExportNotesDialogProps): ReactElement {
    let [value, value2] = ReactExportNotes.useState(true);
    (0, runtime.usePopupFocusRestoration)(true);
    return ExportNotesJsx.jsx(runtime.DialogComponents.Root, {
      open: value,
      onOpenChange: (input: boolean) => {
        if (!input) {
          value2(false);
        }
      },
      onOpenChangeComplete: (input: boolean) => {
        if (!input) {
          onClosed();
        }
      },
      children: ExportNotesJsx.jsxs(runtime.DialogComponents.Popup, {
        size: "sm",
        "data-testid": "export-notes-dialog",
        children: [
          ExportNotesJsx.jsx(runtime.DialogComponents.Header, {
            showClose: true,
            children: "Export notes",
          }),
          ExportNotesJsx.jsx("ul", {
            className: "flex list-disc flex-col gap-xs pl-lg text-body",
            children: notes.map(
              (input, options) =>
                ExportNotesJsx.jsx(
                  "li",
                  {
                    children: input,
                  },
                  options,
                ),
            ),
          }),
          ExportNotesJsx.jsx(runtime.DialogComponents.Footer, {
            align: "end",
            children: ExportNotesJsx.jsx(runtime.DialogComponents.Close, {
              render: ExportNotesJsx.jsx(runtime.Button, {
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
    "ReactExportNotes",
    () => ReactExportNotes,
    (value) => {
      ReactExportNotes = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ExportNotesJsx",
    () => ExportNotesJsx,
    (value) => {
      ExportNotesJsx = value;
    },
  );
  bindRuntimeValue(runtime, "ExportNotesDialog", () => ExportNotesDialog);
  return () => {
    (0, runtime.initializeUiInputs210)();
    ReactExportNotes = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    ExportNotesJsx = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
  };
}
