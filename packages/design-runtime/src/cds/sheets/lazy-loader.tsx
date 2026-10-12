/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installCdsSheetsLazyLoader(
  runtime: RuntimeBindings,
): () => void {
  var MobileSheetsExports: Dynamic;
  var initializeSheetsLazyLoader: Dynamic;
  var reactSheetsLazyLoader: Dynamic;
  var SheetsLazyLoaderCurrentState: Dynamic;
  var mobileSheetsFailed: Dynamic;
  var SheetsLazyLoaderConstant: Dynamic;
  var SheetsLazyLoaderConstant_2: Dynamic;
  var SheetsLazyLoaderCurrentState_2: Dynamic;
  var SheetsLazyLoaderSubscribers: Dynamic;
  var SheetsLazyLoaderHandler: Dynamic;
  var SheetsLazyLoaderHandler_2: Dynamic;
  var SheetsLazyLoaderHandler_3: Dynamic;
  var SheetsLazyLoaderHandler_4: Dynamic;
  var SheetsLazyLoaderHandler_5: Dynamic;
  var initializeMobileSheetLoader: Dynamic;
  var reactSheetsLazyLoader_2: Dynamic;
  var initializeSheetsLazyLoader_2: Dynamic;
  function subscribeMobileSheets(input?: Dynamic): Dynamic {
    SheetsLazyLoaderSubscribers.add(input);
    return (): Dynamic => {
      SheetsLazyLoaderSubscribers.delete(input);
    };
  }
  function loadMobileSheets(): Dynamic {
    let value: Dynamic = SheetsLazyLoaderConstant_2;
    SheetsLazyLoaderCurrentState_2 ??= (0, runtime.loadApplicationFeature)(
      "cds_mobile_sheets",
      (): Dynamic =>
        Promise.resolve().then(
          (): Dynamic => (initializeSheetsLazyLoader(), MobileSheetsExports),
        ),
    )
      .then(
        (input?: Dynamic): Dynamic =>
          typeof input == "object" &&
          input !== null &&
          "SheetPopupHost" in input
            ? input
            : null,
        (): Dynamic => null,
      )
      .then((input?: Dynamic): Dynamic => {
        if (value !== SheetsLazyLoaderConstant_2) return input;
        input === null
          ? (mobileSheetsFailed = true)
          : (SheetsLazyLoaderCurrentState = input);
        for (let value2 of SheetsLazyLoaderSubscribers as Dynamic) value2();
        return input;
      });
    return SheetsLazyLoaderCurrentState_2;
  }
  function preloadMobileSheets(): Dynamic {
    SheetsLazyLoaderCurrentState !== null ||
      mobileSheetsFailed ||
      ((SheetsLazyLoaderConstant += 1), loadMobileSheets());
  }
  function areMobileSheetsLoaded(): Dynamic {
    return SheetsLazyLoaderCurrentState !== null;
  }
  function useMobileSheetsLoaded(): Dynamic {
    return (0, reactSheetsLazyLoader.useSyncExternalStore)(
      subscribeMobileSheets,
      SheetsLazyLoaderHandler_2,
      SheetsLazyLoaderHandler_5,
    );
  }
  function useMobileSheetsUnavailable(): Dynamic {
    return (0, reactSheetsLazyLoader.useSyncExternalStore)(
      subscribeMobileSheets,
      SheetsLazyLoaderHandler_3,
      SheetsLazyLoaderHandler_5,
    );
  }
  function useMobileSheetComponents(): Dynamic {
    return (0, reactSheetsLazyLoader.useSyncExternalStore)(
      subscribeMobileSheets,
      SheetsLazyLoaderHandler,
      SheetsLazyLoaderHandler_4,
    );
  }
  function useMobileSheetPreload(input?: Dynamic, options?: Dynamic): Dynamic {
    let value: Dynamic = (0, runtime.useWindowMediaQuery)(
      input ? options : undefined,
      runtime.coarsePointerMediaQuery,
    );
    (0, reactSheetsLazyLoader_2.useEffect)((): Dynamic => {
      input && value && preloadMobileSheets();
    }, [input, value]);
  }
  bindRuntimeValue(
    runtime,
    "MobileSheetsExports",
    () => MobileSheetsExports,
    (value) => {
      MobileSheetsExports = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeSheetsLazyLoader",
    () => initializeSheetsLazyLoader,
    (value) => {
      initializeSheetsLazyLoader = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "subscribeMobileSheets",
    () => subscribeMobileSheets,
  );
  bindRuntimeValue(runtime, "loadMobileSheets", () => loadMobileSheets);
  bindRuntimeValue(runtime, "preloadMobileSheets", () => preloadMobileSheets);
  bindRuntimeValue(
    runtime,
    "areMobileSheetsLoaded",
    () => areMobileSheetsLoaded,
  );
  bindRuntimeValue(
    runtime,
    "useMobileSheetsLoaded",
    () => useMobileSheetsLoaded,
  );
  bindRuntimeValue(
    runtime,
    "useMobileSheetsUnavailable",
    () => useMobileSheetsUnavailable,
  );
  bindRuntimeValue(
    runtime,
    "useMobileSheetComponents",
    () => useMobileSheetComponents,
  );
  bindRuntimeValue(
    runtime,
    "reactSheetsLazyLoader",
    () => reactSheetsLazyLoader,
    (value) => {
      reactSheetsLazyLoader = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SheetsLazyLoaderCurrentState",
    () => SheetsLazyLoaderCurrentState,
    (value) => {
      SheetsLazyLoaderCurrentState = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "mobileSheetsFailed",
    () => mobileSheetsFailed,
    (value) => {
      mobileSheetsFailed = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SheetsLazyLoaderConstant",
    () => SheetsLazyLoaderConstant,
    (value) => {
      SheetsLazyLoaderConstant = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SheetsLazyLoaderConstant_2",
    () => SheetsLazyLoaderConstant_2,
    (value) => {
      SheetsLazyLoaderConstant_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SheetsLazyLoaderCurrentState_2",
    () => SheetsLazyLoaderCurrentState_2,
    (value) => {
      SheetsLazyLoaderCurrentState_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SheetsLazyLoaderSubscribers",
    () => SheetsLazyLoaderSubscribers,
    (value) => {
      SheetsLazyLoaderSubscribers = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SheetsLazyLoaderHandler",
    () => SheetsLazyLoaderHandler,
    (value) => {
      SheetsLazyLoaderHandler = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SheetsLazyLoaderHandler_2",
    () => SheetsLazyLoaderHandler_2,
    (value) => {
      SheetsLazyLoaderHandler_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SheetsLazyLoaderHandler_3",
    () => SheetsLazyLoaderHandler_3,
    (value) => {
      SheetsLazyLoaderHandler_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SheetsLazyLoaderHandler_4",
    () => SheetsLazyLoaderHandler_4,
    (value) => {
      SheetsLazyLoaderHandler_4 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SheetsLazyLoaderHandler_5",
    () => SheetsLazyLoaderHandler_5,
    (value) => {
      SheetsLazyLoaderHandler_5 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeMobileSheetLoader",
    () => initializeMobileSheetLoader,
    (value) => {
      initializeMobileSheetLoader = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "useMobileSheetPreload",
    () => useMobileSheetPreload,
  );
  bindRuntimeValue(
    runtime,
    "reactSheetsLazyLoader_2",
    () => reactSheetsLazyLoader_2,
    (value) => {
      reactSheetsLazyLoader_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeSheetsLazyLoader_2",
    () => initializeSheetsLazyLoader_2,
    (value) => {
      initializeSheetsLazyLoader_2 = value;
    },
  );
  return () => {
    MobileSheetsExports = {};
    (0, runtime.defineLiveExports)(MobileSheetsExports, {
      ComboboxSheetBackdrop: (): Dynamic =>
        runtime.MobileSheetsComboboxSheetBackdrop,
      MenuSheetPopup: (): Dynamic => runtime.MenuSheetPopup,
      PopoverSheetBackdrop: (): Dynamic =>
        runtime.MobileSheetsPopoverSheetBackdrop,
      PopoverSheetContent: (): Dynamic =>
        runtime.MobileSheetsPopoverSheetContent,
      SheetPopupHost: (): Dynamic => runtime.MobileSheetsSheetPopupHost,
    });
    initializeSheetsLazyLoader = (0, runtime.initializeOnce)((): Dynamic => {
      "use client";

      (0, runtime.initializeSheetsChrome_3)();
      (0, runtime.initializeSheetsMenuPopup_4)();
      (0, runtime.initializeSheetsMenuPopup_5)();
      (0, runtime.initializeSheetsMenuPopup_6)();
    });
    initializeMobileSheetLoader = (0, runtime.initializeOnce)((): Dynamic => {
      "use client";

      (0, runtime.initializePlatformFeatureLoader)();
      reactSheetsLazyLoader = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react)(),
      );
      SheetsLazyLoaderCurrentState = null;
      mobileSheetsFailed = false;
      SheetsLazyLoaderConstant = 0;
      SheetsLazyLoaderConstant_2 = 0;
      SheetsLazyLoaderCurrentState_2 = null;
      SheetsLazyLoaderSubscribers = new Set();
      SheetsLazyLoaderHandler = (): Dynamic => SheetsLazyLoaderCurrentState;
      SheetsLazyLoaderHandler_2 = (): Dynamic =>
        SheetsLazyLoaderCurrentState !== null;
      SheetsLazyLoaderHandler_3 = (): Dynamic => mobileSheetsFailed;
      SheetsLazyLoaderHandler_4 = (): Dynamic => null;
      SheetsLazyLoaderHandler_5 = (): Dynamic => false;
    });
    initializeSheetsLazyLoader_2 = (0, runtime.initializeOnce)((): Dynamic => {
      "use client";

      initializeMobileSheetLoader();
      (0, runtime.initializeHooksMediaQuery)();
      reactSheetsLazyLoader_2 = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react)(),
      );
    });
  };
}
