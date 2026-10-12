/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";
export function installEditorClipboardTrustDialog(
  runtime: RuntimeBindings,
): () => void {
  var reactClipboardTrustDialog: Dynamic;
  var jsxClipboardTrustDialog: Dynamic;
  var ClipboardTrustDialogTitleMessageKeepCodeConfig: Dynamic;
  var ClipboardTrustDialogAlias: Dynamic;
  var ClipboardTrustDialogConstant: Dynamic;
  var ClipboardTrustDialogSubscribers: Dynamic;
  var ClipboardTrustDialogHandler: Dynamic;
  function askTrustForCodePaste(input?: Dynamic, options?: Dynamic): Dynamic {
    return new Promise((input2?: Dynamic): Dynamic => {
      if (options.aborted || ClipboardTrustDialogSubscribers.size === 0)
        return input2("cancel");
      let callback: Dynamic = (): Dynamic => state.settle("cancel"),
        state: Dynamic = {
          id: ClipboardTrustDialogConstant++,
          n: input,
          settle: (input3?: Dynamic): Dynamic => {
            options.removeEventListener("abort", callback);
            ClipboardTrustDialogAlias === state &&
              ((ClipboardTrustDialogAlias = null),
              ClipboardTrustDialogHandler());
            input2(input3);
          },
        };
      options.addEventListener("abort", callback, {
        once: true,
      });
      let value: Dynamic = ClipboardTrustDialogAlias;
      ClipboardTrustDialogAlias = state;
      value?.settle("cancel");
      ClipboardTrustDialogHandler();
    });
  }
  function CodePasteTrustDialog(): Dynamic {
    let [value, value2]: Dynamic = (0, reactClipboardTrustDialog.useState)(
      (): Dynamic =>
        ClipboardTrustDialogAlias
          ? {
              p: ClipboardTrustDialogAlias,
              open: true,
            }
          : null,
    );
    (0, reactClipboardTrustDialog.useEffect)((): Dynamic => {
      let callback: Dynamic = (input?: Dynamic): Dynamic =>
        value2(
          (input2?: Dynamic): Dynamic =>
            input
              ? {
                  p: input,
                  open: true,
                }
              : input2 && {
                  ...input2,
                  open: false,
                },
        );
      ClipboardTrustDialogSubscribers.add(callback);
      return (): Dynamic => {
        ClipboardTrustDialogSubscribers.delete(callback);
        ClipboardTrustDialogSubscribers.size === 0 &&
          ClipboardTrustDialogAlias?.settle("cancel");
      };
    }, []);
    let value3: Dynamic = (0, reactClipboardTrustDialog.useRef)(null);
    if (!value) return null;
    let { p: value4, open: value5 }: Dynamic = value;
    return (() => {
      const _Component = runtime.DialogDialogRootTriggerPopupConfig_2.Root;
      const _props = {
        open: value5,
        onOpenChange: (input?: Dynamic): Dynamic => {
          input || value4.settle("cancel");
        },
        onOpenChangeComplete: (input?: Dynamic): Dynamic => {
          input ||
            value2(
              (input2?: Dynamic): Dynamic =>
                input2?.p === value4 ? null : input2,
            );
        },
        children: (
          <runtime.DialogDialogRootTriggerPopupConfig_2.Popup
            size={"sm"}
            initialFocus={value3}
            data-testid={"design-paste-code-dialog"}
          >
            <runtime.DialogDialogRootTriggerPopupConfig_2.Header
              description={ClipboardTrustDialogTitleMessageKeepCodeConfig.message(
                value4.n,
              )}
            >
              {ClipboardTrustDialogTitleMessageKeepCodeConfig.title}
            </runtime.DialogDialogRootTriggerPopupConfig_2.Header>
            <runtime.DialogDialogRootTriggerPopupConfig_2.Footer>
              <runtime.Button
                ref={value3}
                data-initial-focus={""}
                onClick={(): Dynamic => value4.settle("without-code")}
              >
                {ClipboardTrustDialogTitleMessageKeepCodeConfig.dropCode}
              </runtime.Button>
              <runtime.Button
                variant={"primary"}
                onClick={(): Dynamic => value4.settle("with-code")}
              >
                {ClipboardTrustDialogTitleMessageKeepCodeConfig.keepCode}
              </runtime.Button>
            </runtime.DialogDialogRootTriggerPopupConfig_2.Footer>
          </runtime.DialogDialogRootTriggerPopupConfig_2.Popup>
        ),
      } as const;
      const _key = value4.id;
      return <_Component key={_key} {..._props} />;
    })();
  }
  bindRuntimeValue(
    runtime,
    "reactClipboardTrustDialog",
    () => reactClipboardTrustDialog,
    (value) => {
      reactClipboardTrustDialog = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxClipboardTrustDialog",
    () => jsxClipboardTrustDialog,
    (value) => {
      jsxClipboardTrustDialog = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ClipboardTrustDialogTitleMessageKeepCodeConfig",
    () => ClipboardTrustDialogTitleMessageKeepCodeConfig,
    (value) => {
      ClipboardTrustDialogTitleMessageKeepCodeConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ClipboardTrustDialogAlias",
    () => ClipboardTrustDialogAlias,
    (value) => {
      ClipboardTrustDialogAlias = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ClipboardTrustDialogConstant",
    () => ClipboardTrustDialogConstant,
    (value) => {
      ClipboardTrustDialogConstant = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ClipboardTrustDialogSubscribers",
    () => ClipboardTrustDialogSubscribers,
    (value) => {
      ClipboardTrustDialogSubscribers = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ClipboardTrustDialogHandler",
    () => ClipboardTrustDialogHandler,
    (value) => {
      ClipboardTrustDialogHandler = value;
    },
  );
  bindRuntimeValue(runtime, "askTrustForCodePaste", () => askTrustForCodePaste);
  bindRuntimeValue(runtime, "CodePasteTrustDialog", () => CodePasteTrustDialog);
  return () => {
    reactClipboardTrustDialog = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react)(),
      1,
    );
    (0, runtime.initializeCdsIndex)();
    jsxClipboardTrustDialog = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_jsx_runtime)(),
      1,
    );
    ClipboardTrustDialogTitleMessageKeepCodeConfig = {
      title: "Paste with code?",
      message: (input?: Dynamic): Dynamic =>
        input === 1
          ? "Only if you copied this artboard from a canvas you trust."
          : "Only if you copied these artboards from a canvas you trust.",
      keepCode: "Paste with code",
      dropCode: "Paste without code",
      dropped: (input?: Dynamic): Dynamic =>
        input === 1 ? ", without its code" : ", without their code",
    };
    ClipboardTrustDialogAlias = null;
    ClipboardTrustDialogConstant = 1;
    ClipboardTrustDialogSubscribers = new Set();
    ClipboardTrustDialogHandler = (): Dynamic => {
      for (let value of ClipboardTrustDialogSubscribers as Dynamic)
        value(ClipboardTrustDialogAlias);
    };
  };
}
