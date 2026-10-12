/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type JsxNamespace,
  type ReactNamespace,
} from "../bindings";
import type * as React from "react";

/** How much image quality the PDF keeps; higher makes a larger file. */
export type PdfExportQuality = "good" | "better" | "best";

/** What the user chooses in the PDF options dialog. */
export interface PdfExportOptions {
  quality: PdfExportQuality;
  /** Include the speaker notes. */
  notes: boolean;
}

/** What a caller asks the PDF options dialog to start from. */
export interface PdfExportOptionsAsk {
  defaults?: PdfExportOptions;
}

/** One choice of the image quality picker. */
export interface PdfExportQualityOption {
  value: PdfExportQuality;
  label: string;
}

/** A dialog request waiting for an answer; `resolve(null)` means the user cancelled. */
export interface PdfOptionsRequest {
  id: number;
  ask: PdfExportOptionsAsk;
  resolve: (options: PdfExportOptions | null) => void;
}

/** Called with the pending request whenever it changes. */
export type PdfOptionsSubscriber = (request: PdfOptionsRequest | null) => void;

/** Shown in the dialog when exporting now would leave slides out. */
export interface PdfExportWarning {
  title: string;
  message: string;
  confirmLabel?: string;
  /** Replaces the warning text once the missing slides have arrived. */
  cleared?: string;
}

export interface PdfExportOptionsDialogProps {
  p: PdfOptionsRequest;
  warning: PdfExportWarning | undefined;
  notesAvailable: boolean;
}

export interface PdfExportOptionsHostProps {
  warning?: PdfExportWarning | undefined;
  notesAvailable?: boolean;
}

declare module "../bindings" {
  interface RuntimeBindings {
    ReactPdfOptions: ReactNamespace;
    PdfOptionsJsx: JsxNamespace;
    DEFAULT_PDF_EXPORT_OPTIONS: PdfExportOptions;
    PDF_EXPORT_QUALITY_OPTIONS: PdfExportQualityOption[];
    pendingPdfOptionsRequest: PdfOptionsRequest | null;
    pdfOptionsRequestSequence: number;
    pdfOptionsSubscribers: Set<PdfOptionsSubscriber>;
    notifyPdfOptionsSubscribers: () => void;
    /** Opens the dialog; resolves with the choice, or null when it is cancelled or replaced. */
    requestPdfExportOptions: (
      ask?: PdfExportOptionsAsk,
    ) => Promise<PdfExportOptions | null>;
    dismissPdfExportOptions: () => void;
    resolvePdfExportOptions: (
      request: PdfOptionsRequest,
      options: PdfExportOptions | null,
    ) => void;
    /** The focused element and the menu button that opened it, to refocus after the dialog closes. */
    captureExportDialogReturnFocus: () => Element[];
    preventRepeatedExportDialogActivation: (
      event: React.KeyboardEvent,
    ) => void;
    PdfExportOptionsDialog: (
      props: PdfExportOptionsDialogProps,
    ) => React.ReactElement;
    PdfExportOptionsHost: (
      props: PdfExportOptionsHostProps,
    ) => React.ReactElement | null;
  }
}

export function installDeliveryPdfOptions(runtime: RuntimeBindings): () => void {
  var ReactPdfOptions: ReactNamespace;
  var PdfOptionsJsx: JsxNamespace;
  var DEFAULT_PDF_EXPORT_OPTIONS: RuntimeBindings["DEFAULT_PDF_EXPORT_OPTIONS"];
  var PDF_EXPORT_QUALITY_OPTIONS: RuntimeBindings["PDF_EXPORT_QUALITY_OPTIONS"];
  var pendingPdfOptionsRequest: RuntimeBindings["pendingPdfOptionsRequest"];
  var pdfOptionsRequestSequence: RuntimeBindings["pdfOptionsRequestSequence"];
  var pdfOptionsSubscribers: RuntimeBindings["pdfOptionsSubscribers"];
  var preventRepeatedExportDialogActivation: RuntimeBindings["preventRepeatedExportDialogActivation"];
  function notifyPdfOptionsSubscribers(): void {
    for (let value of pdfOptionsSubscribers)
      value(pendingPdfOptionsRequest);
  }
  function requestPdfExportOptions(
    ask: PdfExportOptionsAsk = {},
  ): Promise<PdfExportOptions | null> {
    return new Promise<PdfExportOptions | null>((input) => {
      let value = pendingPdfOptionsRequest;
      pendingPdfOptionsRequest = {
        id: pdfOptionsRequestSequence++,
        ask: ask,
        resolve: input,
      };
      if (value) {
        value.resolve(null);
      }
      if (pdfOptionsSubscribers.size === 0) {
        pendingPdfOptionsRequest = null;
        input(null);
        return;
      }
      notifyPdfOptionsSubscribers();
    });
  }
  function dismissPdfExportOptions(): void {
    let value = pendingPdfOptionsRequest;
    if (!value) {
      return;
    }
    pendingPdfOptionsRequest = null;
    value.resolve(null);
    notifyPdfOptionsSubscribers();
  }
  function resolvePdfExportOptions(
    request: PdfOptionsRequest,
    options: PdfExportOptions | null,
  ): void {
    if (pendingPdfOptionsRequest !== request) {
      return;
    }
    pendingPdfOptionsRequest = null;
    request.resolve(options);
    notifyPdfOptionsSubscribers();
  }
  function captureExportDialogReturnFocus(): Element[] {
    let activeElement = document.activeElement;
    if (
      activeElement === null ||
      activeElement === document.body ||
      activeElement === document.documentElement
    ) {
      return [];
    }
    let ancestor = activeElement.closest('[role="menu"]'),
      value =
        ancestor === null
          ? null
          : document.getElementById(
              ancestor.getAttribute("aria-labelledby") ?? "",
            );
    if (value === null) {
      return [activeElement];
    } else {
      return [activeElement, value];
    }
  }
  function PdfExportOptionsDialog({
    p: p,
    warning: warning,
    notesAvailable: notesAvailable,
  }: PdfExportOptionsDialogProps): React.ReactElement {
    let [value, value2] = ReactPdfOptions.useState(
        p.ask.defaults ?? DEFAULT_PDF_EXPORT_OPTIONS,
      ),
      ref = ReactPdfOptions.useRef<HTMLButtonElement>(null),
      [value3] = ReactPdfOptions.useState(
        () =>
          document.hasFocus()
            ? captureExportDialogReturnFocus()
            : [],
      ),
      callback = () =>
        (document.hasFocus() &&
          value3.find((input: Element) => input.isConnected)) ||
        false,
      [value4, value5] = ReactPdfOptions.useState(warning);
    if (warning !== undefined && value4 !== warning) {
      value5(warning);
    }
    let value6 =
      warning !== undefined
        ? warning.title + ". " + warning.message
        : value4?.cleared;
    return PdfOptionsJsx.jsx(runtime.DialogComponents.Root, {
      open: true,
      onOpenChange: (input: boolean) => {
        if (!input) {
          resolvePdfExportOptions(p, null);
        }
      },
      children: PdfOptionsJsx.jsx(runtime.DialogComponents.Popup, {
        size: "sm",
        initialFocus: ref,
        finalFocus: callback,
        "data-testid": "pdf-options-dialog",
        children: PdfOptionsJsx.jsxs(runtime.Form, {
          className: "contents",
          onSubmit: () => resolvePdfExportOptions(p, value),
          children: [
            PdfOptionsJsx.jsx(runtime.DialogComponents.Header, {
              showClose: false,
              description:
                value6 !== undefined
                  ? PdfOptionsJsx.jsx("span", {
                      "data-testid": "pdf-options-warning",
                      children: value6,
                    })
                  : undefined,
              children: "Download as PDF",
            }),
            PdfOptionsJsx.jsxs("div", {
              className: "flex flex-col gap-lg",
              children: [
                PdfOptionsJsx.jsxs(runtime.FieldComponents.Root, {
                  name: "quality",
                  className: "gap-md",
                  children: [
                    PdfOptionsJsx.jsx(runtime.FieldComponents.Label, {
                      children: "Image quality",
                    }),
                    PdfOptionsJsx.jsx(runtime.RADIO_CARD_CLASS, {
                      value: value.quality,
                      onChange: (input: PdfExportQuality) =>
                        value2({
                          ...value,
                          quality: input,
                        }),
                      options: PDF_EXPORT_QUALITY_OPTIONS,
                    }),
                    PdfOptionsJsx.jsx(runtime.FieldComponents.Description, {
                      children: "Higher quality makes a larger file.",
                    }),
                  ],
                }),
                PdfOptionsJsx.jsx(runtime.Checkbox, {
                  label: "Include speaker notes",
                  checked: value.notes,
                  onCheckedChange: (input: boolean) =>
                    value2({
                      ...value,
                      notes: input,
                    }),
                  disabled: !notesAvailable,
                  disabledReason:
                    "None of the slides being exported has speaker notes.",
                }),
              ],
            }),
            PdfOptionsJsx.jsxs(runtime.DialogComponents.Footer, {
              align: "end",
              children: [
                PdfOptionsJsx.jsx(runtime.DialogComponents.Close, {
                  render: PdfOptionsJsx.jsx(runtime.Button, {
                    variant: "secondary",
                    children: "Cancel",
                  }),
                }),
                PdfOptionsJsx.jsx(runtime.Button, {
                  ref: ref,
                  type: "submit",
                  variant: "primary",
                  "data-initial-focus": "",
                  onKeyDown: preventRepeatedExportDialogActivation,
                  children: warning?.confirmLabel ?? "Download",
                }),
              ],
            }),
          ],
        }),
      }),
    });
  }
  function PdfExportOptionsHost({
    warning: warning,
    notesAvailable = true,
  }: PdfExportOptionsHostProps): React.ReactElement | null {
    let [value, value2] = ReactPdfOptions.useState<PdfOptionsRequest | null>(
      pendingPdfOptionsRequest,
    );
    (0, runtime.usePopupFocusRestoration)(
      value,
      () => pendingPdfOptionsRequest !== null,
    );
    ReactPdfOptions.useEffect(() => {
      pdfOptionsSubscribers.add(value2);
      return () => {
        pdfOptionsSubscribers.delete(value2);
        if (pdfOptionsSubscribers.size === 0) {
          dismissPdfExportOptions();
        }
      };
    }, []);
    if (value) {
      return PdfOptionsJsx.jsx(
        PdfExportOptionsDialog,
        {
          p: value,
          warning: warning,
          notesAvailable: notesAvailable,
        },
        value.id,
      );
    } else {
      return null;
    }
  }
  bindRuntimeValue(
    runtime,
    "ReactPdfOptions",
    () => ReactPdfOptions,
    (value) => {
      ReactPdfOptions = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PdfOptionsJsx",
    () => PdfOptionsJsx,
    (value) => {
      PdfOptionsJsx = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DEFAULT_PDF_EXPORT_OPTIONS",
    () => DEFAULT_PDF_EXPORT_OPTIONS,
    (value) => {
      DEFAULT_PDF_EXPORT_OPTIONS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PDF_EXPORT_QUALITY_OPTIONS",
    () => PDF_EXPORT_QUALITY_OPTIONS,
    (value) => {
      PDF_EXPORT_QUALITY_OPTIONS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "pendingPdfOptionsRequest",
    () => pendingPdfOptionsRequest,
    (value) => {
      pendingPdfOptionsRequest = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "pdfOptionsRequestSequence",
    () => pdfOptionsRequestSequence,
    (value) => {
      pdfOptionsRequestSequence = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "pdfOptionsSubscribers",
    () => pdfOptionsSubscribers,
    (value) => {
      pdfOptionsSubscribers = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "notifyPdfOptionsSubscribers",
    () => notifyPdfOptionsSubscribers,
  );
  bindRuntimeValue(
    runtime,
    "requestPdfExportOptions",
    () => requestPdfExportOptions,
  );
  bindRuntimeValue(
    runtime,
    "dismissPdfExportOptions",
    () => dismissPdfExportOptions,
  );
  bindRuntimeValue(
    runtime,
    "resolvePdfExportOptions",
    () => resolvePdfExportOptions,
  );
  bindRuntimeValue(
    runtime,
    "captureExportDialogReturnFocus",
    () => captureExportDialogReturnFocus,
  );
  bindRuntimeValue(
    runtime,
    "preventRepeatedExportDialogActivation",
    () => preventRepeatedExportDialogActivation,
    (value) => {
      preventRepeatedExportDialogActivation = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PdfExportOptionsDialog",
    () => PdfExportOptionsDialog,
  );
  bindRuntimeValue(runtime, "PdfExportOptionsHost", () => PdfExportOptionsHost);
  return () => {
    (0, runtime.initializeUiInputs210)();
    ReactPdfOptions = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    PdfOptionsJsx = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
    DEFAULT_PDF_EXPORT_OPTIONS = {
      quality: "best",
      notes: false,
    };
    PDF_EXPORT_QUALITY_OPTIONS = [
      {
        value: "good",
        label: "Good",
      },
      {
        value: "better",
        label: "Better",
      },
      {
        value: "best",
        label: "Best",
      },
    ];
    pendingPdfOptionsRequest = null;
    pdfOptionsRequestSequence = 1;
    pdfOptionsSubscribers = new Set();
    preventRepeatedExportDialogActivation = (event: React.KeyboardEvent) => {
      if (event.repeat && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
      }
    };
  };
}
