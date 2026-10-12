/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installCanvasArtboardFocus(
  runtime: RuntimeBindings,
): () => void {
  var react_nh: Dynamic;
  function useArtboardRuntimeInstallation(
    webviewRef?: Dynamic,
    readyGeneration?: Dynamic,
    panelMounted?: Dynamic,
    enabled?: Dynamic,
    keepDesignMode?: Dynamic,
    forceCanvasMode: Dynamic = false,
    readOnly: Dynamic = false,
  ): Dynamic {
    let [canvasMode, setCanvasMode]: Dynamic = (0, react_nh.useState)(false),
      canvasModeRef: Dynamic = (0, react_nh.useRef)(canvasMode);
    canvasModeRef.current = canvasMode;
    let installPanelHooks: Dynamic = enabled && panelMounted,
      installPanelHooksRef: Dynamic = (0, react_nh.useRef)(installPanelHooks);
    installPanelHooksRef.current = installPanelHooks;
    let readOnlyRef: Dynamic = (0, react_nh.useRef)(readOnly);
    readOnlyRef.current = readOnly;
    let [installGeneration, setInstallGeneration]: Dynamic = (0,
      react_nh.useState)(0),
      [designModePending, setDesignModePending]: Dynamic = (0,
      react_nh.useState)(false),
      { resolved: resolvedTheme }: Dynamic = (0, runtime.useDocumentTheme)(),
      resolvedThemeRef: Dynamic = (0, react_nh.useRef)(resolvedTheme);
    resolvedThemeRef.current = resolvedTheme;
    (0, react_nh.useEffect)((): Dynamic => {
      setCanvasMode(false);
      setDesignModePending(false);
    }, [readyGeneration]);
    (0, runtime.npm_useEventListener_bc)(
      "message",
      (input?: Dynamic): Dynamic => {
        if (!(0, runtime.isPreviewMessage)(input, webviewRef.current)) return;
        let data: Dynamic = input.data;
        data?.type === "__dc_design_mode" &&
          (data.mode === "canvas"
            ? (setDesignModePending(false), setCanvasMode(true))
            : setDesignModePending(true));
      },
    );
    (0, react_nh.useEffect)((): Dynamic => {
      if (readyGeneration === 0) return;
      let value: Dynamic = (0, runtime.createPreviewHandle)(webviewRef.current);
      value && (0, runtime.setPickerTheme)(value, resolvedTheme);
    }, [resolvedTheme]);
    (0, react_nh.useEffect)((): Dynamic => {
      if (!designModePending || keepDesignMode) return;
      let value: Dynamic = setTimeout((): Dynamic => {
        setCanvasMode(false);
        setDesignModePending(false);
      }, 500);
      return (): Dynamic => clearTimeout(value);
    }, [designModePending, keepDesignMode]);
    let shouldInstall: Dynamic = enabled || canvasMode;
    (0, react_nh.useEffect)((): Dynamic => {
      if (readyGeneration === 0 || !shouldInstall) return;
      let value: Dynamic = (0, runtime.createPreviewHandle)(webviewRef.current);
      if (!value) return;
      (0, runtime.installPicker)(value, resolvedThemeRef.current);
      (0, runtime.setPickerReadOnly)(value, readOnlyRef.current);
      installPanelHooksRef.current
        ? (0, runtime.enablePicker)(value)
        : (0, runtime.enablePickerPanZoom)(value);
      setInstallGeneration((input?: Dynamic): Dynamic => input + 1);
      let flag: Dynamic = false,
        value2: Dynamic = [700, 2e3].map(
          (input?: Dynamic): Dynamic =>
            setTimeout((): Dynamic => {
              (0, runtime.isPickerInstalled)(value).then(
                (input2?: Dynamic): Dynamic => {
                  flag ||
                    input2 ||
                    ((0, runtime.installPicker)(
                      value,
                      resolvedThemeRef.current,
                    ),
                    (0, runtime.setPickerPanZoomArmed)(
                      value,
                      forceCanvasMode || canvasModeRef.current,
                    ),
                    (0, runtime.setPickerReadOnly)(value, readOnlyRef.current),
                    installPanelHooksRef.current
                      ? (0, runtime.enablePicker)(value)
                      : (0, runtime.enablePickerPanZoom)(value),
                    setInstallGeneration(
                      (input3?: Dynamic): Dynamic => input3 + 1,
                    ));
                },
              );
            }, input),
        );
      return (): Dynamic => {
        flag = true;
        for (let value3 of value2 as Dynamic) clearTimeout(value3);
        (0, runtime.disablePicker)(value);
      };
    }, [readyGeneration, shouldInstall]);
    (0, react_nh.useEffect)((): Dynamic => {
      if (readyGeneration === 0 || !shouldInstall) return;
      let value: Dynamic = (0, runtime.createPreviewHandle)(webviewRef.current);
      value &&
        (0, runtime.setPickerPanZoomArmed)(
          value,
          forceCanvasMode || canvasMode,
        );
    }, [readyGeneration, shouldInstall, canvasMode, forceCanvasMode]);
    (0, react_nh.useEffect)((): Dynamic => {
      if (readyGeneration === 0 || !shouldInstall) return;
      let value: Dynamic = (0, runtime.createPreviewHandle)(webviewRef.current);
      value &&
        ((0, runtime.setPickerReadOnly)(value, readOnly),
        installPanelHooks
          ? (0, runtime.enablePicker)(value)
          : (0, runtime.enablePickerPanZoom)(value));
    }, [readyGeneration, shouldInstall, installPanelHooks, readOnly]);
    return {
      installGen: installGeneration,
      canvasMode: canvasMode,
    };
  }
  bindRuntimeValue(
    runtime,
    "react_nh",
    () => react_nh,
    (value) => {
      react_nh = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "useArtboardRuntimeInstallation",
    () => useArtboardRuntimeInstallation,
  );
  return () => {
    react_nh = (0, runtime.toModuleNamespace)((0, runtime.load_react)(), 1);
    (0, runtime.initializeNpm_usehooks_ts_p0)();
    (0, runtime.initializePlatformTheme)();
  };
}
