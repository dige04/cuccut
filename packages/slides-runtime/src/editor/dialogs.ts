/** Restored application module; prepare first, initialize in original order. */
import type {
  ChangeEvent,
  FocusEvent,
  KeyboardEvent,
  ReactElement,
  ReactNode,
} from "react";
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type JsxNamespace,
  type ReactNamespace,
} from "../bindings";

/** What a confirm dialog shows. */
export interface EditorConfirmOptions {
  title: string;
  message?: string;
  /** Defaults to "Delete" for dangerous actions and "OK" otherwise. */
  confirmLabel?: string;
  cancelLabel?: string;
  /** Marks a destructive action: red confirm button and "Delete" label. */
  danger?: boolean;
}
/** What a text-prompt dialog shows. */
export interface EditorPromptOptions {
  title: string;
  message?: string;
  /** Accessible label of the input; defaults to the title. */
  inputLabel?: string;
  placeholder?: string;
  initialValue?: string;
  maxLength?: number;
  confirmLabel?: string;
  cancelLabel?: string;
}
/** A queued confirm dialog; `resolve` settles the caller's promise. */
export interface EditorConfirmRequest {
  id: number;
  kind: "confirm";
  opts: EditorConfirmOptions;
  resolve(confirmed: boolean): void;
}
/** A queued prompt dialog; `resolve` receives the trimmed text, or null when cancelled. */
export interface EditorPromptRequest {
  id: number;
  kind: "prompt";
  opts: EditorPromptOptions;
  resolve(text: string | null): void;
}
export type EditorDialogRequest = EditorConfirmRequest | EditorPromptRequest;
/** Hears the dialog that is now showing, or null when none is. */
export type EditorDialogSubscriber = (
  request: EditorDialogRequest | null,
) => void;
export interface EditorDialogLayoutProps {
  title: ReactNode;
  onDismiss(): void;
  footer: ReactNode;
  children?: ReactNode;
}
export interface EditorConfirmDialogProps {
  p: EditorConfirmRequest;
}
export interface EditorPromptDialogProps {
  p: EditorPromptRequest;
}

declare module "../bindings" {
  interface RuntimeBindings {
    ReactEditorDialogs: ReactNamespace;
    EditorDialogsJsx: JsxNamespace;
    pendingEditorDialog: EditorDialogRequest | null;
    editorDialogSequence: number;
    editorDialogSubscribers: Set<EditorDialogSubscriber>;
    notifyEditorDialogSubscribers: () => void;
    cancelEditorDialogRequest: (request: EditorDialogRequest) => void;
    enqueueEditorDialog: (request: EditorDialogRequest) => void;
    confirmEditorAction: (options: EditorConfirmOptions) => Promise<boolean>;
    promptEditorText: (options: EditorPromptOptions) => Promise<string | null>;
    dismissEditorDialog: () => void;
    resolveEditorDialog: (
      request: EditorDialogRequest,
      value?: unknown,
    ) => void;
    dismissMatchingEditorDialog: (request: EditorDialogRequest) => void;
    EditorDialogLayout: (props: EditorDialogLayoutProps) => ReactElement;
    EditorConfirmDialog: (props: EditorConfirmDialogProps) => ReactElement;
    EditorPromptDialog: (props: EditorPromptDialogProps) => ReactElement;
    EditorDialogHost: () => ReactElement | null;
  }
}

export function installEditorDialogs(runtime: RuntimeBindings): () => void {
  var ReactEditorDialogs: ReactNamespace;
  var EditorDialogsJsx: JsxNamespace;
  var pendingEditorDialog: RuntimeBindings["pendingEditorDialog"];
  var editorDialogSequence: RuntimeBindings["editorDialogSequence"];
  var editorDialogSubscribers: RuntimeBindings["editorDialogSubscribers"];
  function notifyEditorDialogSubscribers(): void {
    for (let value of editorDialogSubscribers) value(pendingEditorDialog);
  }
  function cancelEditorDialogRequest(request: EditorDialogRequest): void {
    if (request.kind === "confirm") {
      request.resolve(false);
    } else {
      request.resolve(null);
    }
  }
  function enqueueEditorDialog(request: EditorDialogRequest): void {
    let previous = pendingEditorDialog;
    pendingEditorDialog = request;
    if (previous) {
      cancelEditorDialogRequest(previous);
    }
    if (editorDialogSubscribers.size === 0) {
      pendingEditorDialog = null;
      cancelEditorDialogRequest(request);
      return;
    }
    notifyEditorDialogSubscribers();
  }
  function confirmEditorAction(
    options: EditorConfirmOptions,
  ): Promise<boolean> {
    return new Promise<boolean>((input): void => {
      enqueueEditorDialog({
        id: editorDialogSequence++,
        kind: "confirm",
        opts: options,
        resolve: input,
      });
    });
  }
  function promptEditorText(
    options: EditorPromptOptions,
  ): Promise<string | null> {
    return new Promise<string | null>((input): void => {
      enqueueEditorDialog({
        id: editorDialogSequence++,
        kind: "prompt",
        opts: options,
        resolve: input,
      });
    });
  }
  function dismissEditorDialog(): void {
    let value = pendingEditorDialog;
    if (!value) {
      return;
    }
    pendingEditorDialog = null;
    cancelEditorDialogRequest(value);
    notifyEditorDialogSubscribers();
  }
  function resolveEditorDialog(
    request: EditorDialogRequest,
    value?: unknown,
  ): void {
    if (pendingEditorDialog !== request) {
      return;
    }
    pendingEditorDialog = null;
    if (request.kind === "confirm") {
      request.resolve(value === true);
    } else {
      request.resolve(typeof value === "string" ? value : null);
    }
    notifyEditorDialogSubscribers();
  }
  function dismissMatchingEditorDialog(request: EditorDialogRequest): void {
    if (pendingEditorDialog === request) {
      dismissEditorDialog();
    }
  }
  function EditorDialogLayout({
    title: title,
    onDismiss: onDismiss,
    footer: footer,
    children: children,
  }: EditorDialogLayoutProps): ReactElement {
    return EditorDialogsJsx.jsx(runtime.DialogComponents.Root, {
      open: true,
      onOpenChange: (input: boolean): void => {
        if (!input) {
          onDismiss();
        }
      },
      children: EditorDialogsJsx.jsxs(runtime.DialogComponents.Popup, {
        size: "sm",
        children: [
          EditorDialogsJsx.jsx(runtime.DialogComponents.Header, {
            showClose: true,
            children: title,
          }),
          EditorDialogsJsx.jsx("div", {
            className: "mt-3 text-sm",
            children: children,
          }),
          EditorDialogsJsx.jsx(runtime.DialogComponents.Footer, {
            align: "end",
            children: footer,
          }),
        ],
      }),
    });
  }
  function EditorConfirmDialog({ p: p }: EditorConfirmDialogProps): ReactElement {
    let { opts: opts } = p,
      callback = (): void => dismissMatchingEditorDialog(p);
    return EditorDialogsJsx.jsx(runtime.ConfirmationDialog, {
      open: true,
      initialFocus: "cancel",
      onOpenChange: (input: boolean): void => {
        if (!input) {
          callback();
        }
      },
      title: opts.title,
      description: opts.message,
      confirmLabel: opts.confirmLabel ?? (opts.danger ? "Delete" : "OK"),
      cancelLabel: opts.cancelLabel ?? "Cancel",
      confirmVariant: opts.danger ? "danger" : "primary",
      size: "sm",
      onConfirm: (): void => resolveEditorDialog(p, true),
    });
  }
  function EditorPromptDialog({ p: p }: EditorPromptDialogProps): ReactElement {
    let { opts: opts } = p,
      [value, value2] = ReactEditorDialogs.useState(opts.initialValue ?? ""),
      value3 = value.trim(),
      value4 = value3.length === 0,
      callback = (): void => {
        if (!value4) {
          resolveEditorDialog(p, value3);
        }
      },
      callback2 = (): void => dismissMatchingEditorDialog(p);
    return EditorDialogsJsx.jsxs(EditorDialogLayout, {
      title: opts.title,
      onDismiss: callback2,
      footer: EditorDialogsJsx.jsxs(EditorDialogsJsx.Fragment, {
        children: [
          EditorDialogsJsx.jsx(runtime.Button, {
            onClick: callback2,
            children: opts.cancelLabel ?? "Cancel",
          }),
          EditorDialogsJsx.jsx(runtime.DisabledReasonTooltip, {
            wrapperClassName: "grid",
            reason: value4 ? "Type something first" : undefined,
            children: EditorDialogsJsx.jsx(runtime.Button, {
              variant: "primary",
              disabled: value4,
              "data-testid": "mc-alert-confirm",
              onClick: callback,
              children: opts.confirmLabel ?? "OK",
            }),
          }),
        ],
      }),
      children: [
        opts.message
          ? EditorDialogsJsx.jsx("p", {
              className: "text-fg-secondary",
              children: opts.message,
            })
          : null,
        EditorDialogsJsx.jsx(runtime.TextInput, {
          className: opts.message ? "mt-2" : undefined,
          "data-testid": "mc-alert-input",
          "aria-label": opts.inputLabel ?? opts.title,
          autoFocus: true,
          value: value,
          placeholder: opts.placeholder,
          maxLength: opts.maxLength,
          onChange: (input: ChangeEvent<HTMLInputElement>): void =>
            value2(input.currentTarget.value),
          onFocus: (input: FocusEvent<HTMLInputElement>): void =>
            input.currentTarget.select(),
          onKeyDown: (event: KeyboardEvent<HTMLInputElement>): void => {
            if (event.key !== "Enter") {
              return;
            }
            if (event.nativeEvent.isComposing || event.keyCode === 229) {
              return;
            }
            event.preventDefault();
            if (event.repeat) {
              return;
            }
            callback();
          },
        }),
      ],
    });
  }
  function EditorDialogHost(): ReactElement | null {
    let [value, value2] =
      ReactEditorDialogs.useState<EditorDialogRequest | null>(
        pendingEditorDialog,
      );
    (0, runtime.usePopupFocusRestoration)(
      value,
      (): boolean => pendingEditorDialog !== null,
    );
    ReactEditorDialogs.useEffect((): (() => void) => {
      editorDialogSubscribers.add(value2);
      return (): void => {
        editorDialogSubscribers.delete(value2);
        if (editorDialogSubscribers.size === 0) {
          dismissEditorDialog();
        }
      };
    }, []);
    if (!value) {
      return null;
    }
    if (value.kind === "confirm") {
      return EditorDialogsJsx.jsx(
        EditorConfirmDialog,
        {
          p: value,
        },
        value.id,
      );
    } else {
      return EditorDialogsJsx.jsx(
        EditorPromptDialog,
        {
          p: value,
        },
        value.id,
      );
    }
  }
  bindRuntimeValue(
    runtime,
    "ReactEditorDialogs",
    () => ReactEditorDialogs,
    (value) => {
      ReactEditorDialogs = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "EditorDialogsJsx",
    () => EditorDialogsJsx,
    (value) => {
      EditorDialogsJsx = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "pendingEditorDialog",
    () => pendingEditorDialog,
    (value) => {
      pendingEditorDialog = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "editorDialogSequence",
    () => editorDialogSequence,
    (value) => {
      editorDialogSequence = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "editorDialogSubscribers",
    () => editorDialogSubscribers,
    (value) => {
      editorDialogSubscribers = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "notifyEditorDialogSubscribers",
    () => notifyEditorDialogSubscribers,
  );
  bindRuntimeValue(
    runtime,
    "cancelEditorDialogRequest",
    () => cancelEditorDialogRequest,
  );
  bindRuntimeValue(runtime, "enqueueEditorDialog", () => enqueueEditorDialog);
  bindRuntimeValue(runtime, "confirmEditorAction", () => confirmEditorAction);
  bindRuntimeValue(runtime, "promptEditorText", () => promptEditorText);
  bindRuntimeValue(runtime, "dismissEditorDialog", () => dismissEditorDialog);
  bindRuntimeValue(runtime, "resolveEditorDialog", () => resolveEditorDialog);
  bindRuntimeValue(
    runtime,
    "dismissMatchingEditorDialog",
    () => dismissMatchingEditorDialog,
  );
  bindRuntimeValue(runtime, "EditorDialogLayout", () => EditorDialogLayout);
  bindRuntimeValue(runtime, "EditorConfirmDialog", () => EditorConfirmDialog);
  bindRuntimeValue(runtime, "EditorPromptDialog", () => EditorPromptDialog);
  bindRuntimeValue(runtime, "EditorDialogHost", () => EditorDialogHost);
  return () => {
    (0, runtime.initializeUiInputs210)();
    ReactEditorDialogs = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    EditorDialogsJsx = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
    pendingEditorDialog = null;
    editorDialogSequence = 1;
    editorDialogSubscribers = new Set();
  };
}
