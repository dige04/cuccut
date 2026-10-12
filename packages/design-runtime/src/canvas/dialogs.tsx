/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";
export function installCanvasDialogs(runtime: RuntimeBindings): () => void {
  var react_M6: Dynamic;
  var jsx_Af: Dynamic;
  var activeCanvasDialog: Dynamic;
  var nextCanvasDialogId: Dynamic;
  var canvasDialogSubscribers: Dynamic;
  function publishCanvasDialog(): Dynamic {
    for (let value of canvasDialogSubscribers as Dynamic)
      value(activeCanvasDialog);
  }
  function rejectCanvasDialog(dialog?: Dynamic): Dynamic {
    dialog.kind === "confirm" ? dialog.resolve(false) : dialog.resolve(null);
  }
  function openCanvasDialog(dialog?: Dynamic): Dynamic {
    let value: Dynamic = activeCanvasDialog;
    activeCanvasDialog = dialog;
    value && rejectCanvasDialog(value);
    if (canvasDialogSubscribers.size === 0) {
      activeCanvasDialog = null;
      rejectCanvasDialog(dialog);
      return;
    }
    publishCanvasDialog();
  }
  function confirmCanvasAction(options?: Dynamic): Dynamic {
    return new Promise((input?: Dynamic): Dynamic => {
      openCanvasDialog({
        id: nextCanvasDialogId++,
        kind: "confirm",
        opts: options,
        resolve: input,
      });
    });
  }
  function promptCanvasValue(options?: Dynamic): Dynamic {
    return new Promise((input?: Dynamic): Dynamic => {
      openCanvasDialog({
        id: nextCanvasDialogId++,
        kind: "prompt",
        opts: options,
        resolve: input,
      });
    });
  }
  function dismissCanvasDialog(): Dynamic {
    let value: Dynamic = activeCanvasDialog;
    value &&
      ((activeCanvasDialog = null),
      rejectCanvasDialog(value),
      publishCanvasDialog());
  }
  function resolveCanvasDialog(dialog?: Dynamic, value?: Dynamic): Dynamic {
    activeCanvasDialog === dialog &&
      ((activeCanvasDialog = null),
      dialog.kind === "confirm"
        ? dialog.resolve(value === true)
        : dialog.resolve(typeof value == "string" ? value : null),
      publishCanvasDialog());
  }
  function dismissMatchingCanvasDialog(dialog?: Dynamic): Dynamic {
    activeCanvasDialog === dialog && dismissCanvasDialog();
  }
  function CanvasPromptDialogShell({
    title: title,
    onDismiss: onDismiss,
    footer: footer,
    children: children,
  }: Dynamic): Dynamic {
    return (
      <runtime.DialogDialogRootTriggerPopupConfig.Root
        open={true}
        onOpenChange={(input?: Dynamic): Dynamic => {
          input || onDismiss();
        }}
      >
        <runtime.DialogDialogRootTriggerPopupConfig.Popup size={"sm"}>
          <runtime.DialogDialogRootTriggerPopupConfig.Header showClose={true}>
            {title}
          </runtime.DialogDialogRootTriggerPopupConfig.Header>
          <div className={"mt-3 text-sm"}>{children}</div>
          <runtime.DialogDialogRootTriggerPopupConfig.Footer align={"end"}>
            {footer}
          </runtime.DialogDialogRootTriggerPopupConfig.Footer>
        </runtime.DialogDialogRootTriggerPopupConfig.Popup>
      </runtime.DialogDialogRootTriggerPopupConfig.Root>
    );
  }
  function CanvasConfirmationDialog({ p: p }: Dynamic): Dynamic {
    let { opts: value }: Dynamic = p,
      callback: Dynamic = (): Dynamic => dismissMatchingCanvasDialog(p);
    return (
      <runtime.ConfirmationDialog
        open={true}
        initialFocus={"cancel"}
        onOpenChange={(input?: Dynamic): Dynamic => {
          input || callback();
        }}
        title={value.title}
        description={value.message}
        confirmLabel={value.confirmLabel ?? (value.danger ? "Delete" : "OK")}
        cancelLabel={value.cancelLabel ?? "Cancel"}
        confirmVariant={value.danger ? "danger" : "primary"}
        size={"sm"}
        onConfirm={(): Dynamic => resolveCanvasDialog(p, true)}
      />
    );
  }
  function CanvasValuePromptDialog({ p: p }: Dynamic): Dynamic {
    let { opts: value }: Dynamic = p,
      [value2, value3]: Dynamic = (0, react_M6.useState)(
        value.initialValue ?? "",
      ),
      value4: Dynamic = value2.trim(),
      value5: Dynamic = value4.length === 0,
      callback: Dynamic = (): Dynamic => {
        value5 || resolveCanvasDialog(p, value4);
      },
      callback2: Dynamic = (): Dynamic => dismissMatchingCanvasDialog(p);
    return (
      <CanvasPromptDialogShell
        title={value.title}
        onDismiss={callback2}
        footer={
          <jsx_Af.Fragment>
            <runtime.Button onClick={callback2}>
              {value.cancelLabel ?? "Cancel"}
            </runtime.Button>
            <runtime.DisabledReasonTooltip
              wrapperClassName={"grid"}
              reason={value5 ? "Type something first" : undefined}
            >
              <runtime.Button
                variant={"primary"}
                disabled={value5}
                data-testid={"mc-alert-confirm"}
                onClick={callback}
              >
                {value.confirmLabel ?? "OK"}
              </runtime.Button>
            </runtime.DisabledReasonTooltip>
          </jsx_Af.Fragment>
        }
      >
        {value.message ? (
          <p className={"text-fg-secondary"}>{value.message}</p>
        ) : null}
        <runtime.TextInput
          className={value.message ? "mt-2" : undefined}
          data-testid={"mc-alert-input"}
          aria-label={value.inputLabel ?? value.title}
          autoFocus={true}
          value={value2}
          placeholder={value.placeholder}
          maxLength={value.maxLength}
          onChange={(input?: Dynamic): Dynamic =>
            value3(input.currentTarget.value)
          }
          onFocus={(input?: Dynamic): Dynamic => input.currentTarget.select()}
          onKeyDown={(event?: Dynamic): Dynamic => {
            event.key === "Enter" &&
              (event.nativeEvent.isComposing ||
                event.keyCode === 229 ||
                (event.preventDefault(), !event.repeat && callback()));
          }}
        />
      </CanvasPromptDialogShell>
    );
  }
  function CanvasDialogHost(): Dynamic {
    let [value, value2]: Dynamic = (0, react_M6.useState)(activeCanvasDialog);
    (0, runtime.usePanelClose)(
      value,
      (): Dynamic => activeCanvasDialog !== null,
    );
    (0, react_M6.useEffect)(
      (): Dynamic => (
        canvasDialogSubscribers.add(value2),
        (): Dynamic => {
          canvasDialogSubscribers.delete(value2);
          canvasDialogSubscribers.size === 0 && dismissCanvasDialog();
        }
      ),
      [],
    );
    return value
      ? value.kind === "confirm"
        ? (() => {
            const _Component = CanvasConfirmationDialog;
            const _props = {
              p: value,
            } as const;
            const _key = value.id;
            return <_Component key={_key} {..._props} />;
          })()
        : (() => {
            const _Component2 = CanvasValuePromptDialog;
            const _props2 = {
              p: value,
            } as const;
            const _key2 = value.id;
            return <_Component2 key={_key2} {..._props2} />;
          })()
      : null;
  }
  bindRuntimeValue(
    runtime,
    "react_M6",
    () => react_M6,
    (value) => {
      react_M6 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsx_Af",
    () => jsx_Af,
    (value) => {
      jsx_Af = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "activeCanvasDialog",
    () => activeCanvasDialog,
    (value) => {
      activeCanvasDialog = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "nextCanvasDialogId",
    () => nextCanvasDialogId,
    (value) => {
      nextCanvasDialogId = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "canvasDialogSubscribers",
    () => canvasDialogSubscribers,
    (value) => {
      canvasDialogSubscribers = value;
    },
  );
  bindRuntimeValue(runtime, "publishCanvasDialog", () => publishCanvasDialog);
  bindRuntimeValue(runtime, "rejectCanvasDialog", () => rejectCanvasDialog);
  bindRuntimeValue(runtime, "openCanvasDialog", () => openCanvasDialog);
  bindRuntimeValue(runtime, "confirmCanvasAction", () => confirmCanvasAction);
  bindRuntimeValue(runtime, "promptCanvasValue", () => promptCanvasValue);
  bindRuntimeValue(runtime, "dismissCanvasDialog", () => dismissCanvasDialog);
  bindRuntimeValue(runtime, "resolveCanvasDialog", () => resolveCanvasDialog);
  bindRuntimeValue(
    runtime,
    "dismissMatchingCanvasDialog",
    () => dismissMatchingCanvasDialog,
  );
  bindRuntimeValue(
    runtime,
    "CanvasPromptDialogShell",
    () => CanvasPromptDialogShell,
  );
  bindRuntimeValue(
    runtime,
    "CanvasConfirmationDialog",
    () => CanvasConfirmationDialog,
  );
  bindRuntimeValue(
    runtime,
    "CanvasValuePromptDialog",
    () => CanvasValuePromptDialog,
  );
  bindRuntimeValue(runtime, "CanvasDialogHost", () => CanvasDialogHost);
  return () => {
    react_M6 = (0, runtime.toModuleNamespace)((0, runtime.load_react)(), 1);
    (0, runtime.initializeCdsIndex)();
    jsx_Af = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_jsx_runtime)(),
      1,
    );
    activeCanvasDialog = null;
    nextCanvasDialogId = 1;
    canvasDialogSubscribers = new Set();
  };
}
