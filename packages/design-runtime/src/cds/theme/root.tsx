import type {
  ColorMode,
  ControlSize,
  Density,
  DesignStyle,
} from "../../contracts/ui";
import type * as React from "react";
/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";
export function installCdsThemeRoot(runtime: RuntimeBindings): () => void {
  var reactThemeRoot: Dynamic;
  var jsxThemeRoot: Dynamic;
  var ThemeRootHandler: Dynamic;
  var ThemeRootDefaultText: Dynamic;
  var stylesheetsInspected: Dynamic;
  var ThemeRootCompactComfortableConfig: Dynamic;
  var ThemeRootXsSmBaseConfig: Dynamic;
  var DensityContext: Dynamic;
  var DensityContextAlias: Dynamic;
  var ColorModeContext: Dynamic;
  var defaultColorModeStore: Dynamic;
  var ThemeRootMediaQuery: Dynamic;
  var ThemeRootHandler_2: Dynamic;
  var PlatformContext: Dynamic;
  var LocaleContext: Dynamic;
  var FontContext: Dynamic;
  var LabelsContext: Dynamic;
  var ThemeRootContext: Dynamic;
  var ThemeRootContext_2: Dynamic;
  var PageBackgroundContext: Dynamic;
  var ExperimentalSettingsContext: Dynamic;
  var RootElementContext: Dynamic;
  var OverlayRootContext: Dynamic;
  var RootPresenceContext: Dynamic;
  var ThemeRootFromEntriesValue: Dynamic;
  var ThemeRootSurface0Surface1Surface2Set: Dynamic;
  var initializeCdsRoot: Dynamic;
  function rootUsesCdsFont(element?: Dynamic): Dynamic {
    return (
      element === element.ownerDocument.documentElement &&
      element.style.fontSize.includes("--cds-font-size-body")
    );
  }
  function inspectCdsStylesheets(): Dynamic {
    if (!(stylesheetsInspected || typeof document === "undefined")) {
      stylesheetsInspected = true;
      try {
        let items: Dynamic = [],
          values: Dynamic = new Set(),
          callback: Dynamic = (input?: Dynamic): Dynamic => {
            if (!input) return;
            let value3: Dynamic = input.split(".")[0] ?? input;
            values.has(value3) || (values.add(value3), items.push(value3));
          },
          callback2: Dynamic = (input?: Dynamic): Dynamic => {
            let value3: Dynamic;
            try {
              value3 = input.cssRules;
            } catch {
              return;
            }
            for (let value4 of value3 as Dynamic) {
              let name: Dynamic = value4.constructor.name;
              if (name === "CSSLayerStatementRule")
                for (let value5 of value4.nameList as Dynamic) callback(value5);
              else if (name === "CSSLayerBlockRule") callback(value4.name);
              else if (name === "CSSImportRule") {
                let value5: Dynamic = value4;
                callback(value5.layerName);
                value5.styleSheet && callback2(value5.styleSheet);
              }
            }
          };
        for (let value3 of (document as Dynamic).styleSheets as Dynamic)
          callback2(value3);
        let value: Dynamic = items.indexOf("utilities");
        if (value === -1) return;
        let value2: Dynamic = items.indexOf("cds-card");
        (value2 === -1 || value2 > value) &&
          console.error(
            "cds: the `cds-card` cascade layer is " +
              (value2 === -1 ? "not declared" : "declared after `utilities`") +
              " in this document, so Card's stretched-link lift rules outrank consumer positioning utilities \u2014 `absolute`/`z-*` on interactive children inside <Card> will silently lose, and a `backgroundClassName` surface override stops applying, since the fill layer's resting color and hover step sit in the same layer and must rank below consumer utilities to be overridable. Fix: add `@layer cds-card;` before the `@import \"tailwindcss\"` line in this app's Tailwind entry CSS (see packages/cds/src/component-base.css \xA7 cds-card).",
          );
      } catch {}
    }
  }
  function getSizeAttribute(input?: ControlSize): {
    "data-size"?: Exclude<ControlSize, "base">;
  } {
    return input && input !== "base"
      ? {
          "data-size": input,
        }
      : {};
  }
  function getControlSizeRank(input: Density, options?: ControlSize): number {
    let value =
      ThemeRootCompactComfortableConfig[input] +
      ThemeRootXsSmBaseConfig[options ?? "base"];
    return value < 1 ? 1 : value > 5 ? 5 : value;
  }
  function createColorModeStore(input?: Dynamic): Dynamic {
    let value: Dynamic = null,
      value2: Dynamic =
        input === undefined && typeof document !== "undefined"
          ? (document as Dynamic).documentElement.getAttribute("data-mode")
          : null,
      callback: Dynamic = (): Dynamic => input ?? ThemeRootHandler_2(value2),
      callback2: Dynamic = (input2?: Dynamic): Dynamic =>
        input2 ? "dark" : "light",
      value3: Dynamic,
      value4: Dynamic,
      flag: Dynamic = false,
      callback3: Dynamic = (): Dynamic => {
        flag ||
          ((flag = true),
          (value3 =
            input !== "light" &&
            input !== "dark" &&
            typeof window !== "undefined" &&
            typeof (window as Dynamic).matchMedia == "function"
              ? (window as Dynamic).matchMedia(ThemeRootMediaQuery)
              : undefined),
          (value4 = value3 ? callback2(value3.matches) : undefined));
      },
      callback4: Dynamic = (): Dynamic => {
        value &&
          (value2 =
            value.closest("[data-mode]")?.getAttribute("data-mode") ??
            (value.isConnected
              ? null
              : (document as Dynamic).documentElement.getAttribute(
                  "data-mode",
                )));
      },
      callback5: Dynamic = (input2?: Dynamic): Dynamic =>
        input2 === "light" || input2 === "dark" ? input2 : undefined,
      values: Dynamic = new Set(),
      callback6: Dynamic = (): Dynamic =>
        values.forEach((input2?: Dynamic): Dynamic => input2()),
      flag2: Dynamic = false,
      callback7: Dynamic = (): Dynamic => {
        let items: Dynamic = [];
        callback3();
        let value6: Dynamic = value3;
        if (value6) {
          let callback8: Dynamic = (): Dynamic => {
            value4 = callback2(value6.matches);
            callback6();
          };
          value6.addEventListener("change", callback8);
          items.push(
            (): Dynamic => value6.removeEventListener("change", callback8),
          );
          let value7: Dynamic = callback2(value6.matches);
          value7 !== value4 && ((value4 = value7), (flag2 = true));
        }
        if (input === undefined && typeof MutationObserver !== "undefined") {
          let value7: Dynamic = value2;
          callback4();
          value2 !== value7 && (flag2 = true);
          let observer: Dynamic = new MutationObserver((): Dynamic => {
            let value8: Dynamic = value2;
            callback4();
            value2 !== value8 && callback6();
          });
          observer.observe((document as Dynamic).documentElement, {
            attributes: true,
            attributeFilter: ["data-mode"],
            subtree: true,
          });
          items.push((): Dynamic => observer.disconnect());
        }
        flag2 && ((flag2 = false), queueMicrotask(callback6));
        return (): Dynamic =>
          items.forEach((input2?: Dynamic): Dynamic => input2());
      },
      value5: Dynamic;
    return {
      setElement: (input2?: Dynamic): Dynamic => {
        value = input2;
        if (input === undefined && input2 !== null) {
          let value6: Dynamic = value2;
          callback4();
          value2 !== value6 && values.size === 0 && (flag2 = true);
          callback6();
        }
      },
      subscribe: (input2?: Dynamic): Dynamic => (
        values.size === 0 && (value5 = callback7()),
        values.add(input2),
        (): Dynamic => {
          values.delete(input2);
          values.size === 0 && (value5?.(), (value5 = undefined));
        }
      ),
      getSnapshot: (): Dynamic => (
        callback3(),
        callback5(callback()) ?? value4
      ),
      getServerSnapshot: (): Dynamic => callback5(input),
      getAttrSnapshot: (): Dynamic => (
        callback3(),
        input !== undefined ? (callback5(input) ?? value4 ?? input) : undefined
      ),
      getServerAttrSnapshot: (): Dynamic => input,
      getSettingSnapshot: (): Dynamic => callback(),
      getServerSettingSnapshot: (): Dynamic => input,
    };
  }
  function useCdsLabels(): Dynamic {
    return (0, reactThemeRoot.useContext)(LabelsContext);
  }
  function useDensity(): Density {
    return (0, reactThemeRoot.useContext)(DensityContext);
  }
  function useResolvedColorMode(): ColorMode {
    return useColorMode() ?? "light";
  }
  function useColorMode(): Dynamic {
    let value: Dynamic =
      (0, reactThemeRoot.useContext)(ColorModeContext) ?? defaultColorModeStore;
    return (0, reactThemeRoot.useSyncExternalStore)(
      value.subscribe,
      value.getSnapshot,
      value.getServerSnapshot,
    );
  }
  function usePlatform(): Dynamic {
    return (0, reactThemeRoot.useContext)(PlatformContext) ?? "web";
  }
  function useLocale(): Dynamic {
    return (0, reactThemeRoot.useContext)(LocaleContext);
  }
  function useCdsFont(): Dynamic {
    return (0, reactThemeRoot.useContext)(FontContext);
  }
  function monoFontOverrideStyle(input?: string | null): DesignStyle {
    if (input === null)
      return {
        "--cds-font-mono-override": "initial",
      };
    let value = input?.trim();
    return value
      ? {
          "--cds-font-mono-override": `"${value
            .replaceAll(/[\u0000-\u001f\u007f]/g, "")
            .replaceAll("\\", "\\\\")
            .replaceAll('"', '\\"')}",`,
        }
      : {};
  }
  function usePageBackground(): Dynamic {
    return (0, reactThemeRoot.useContext)(PageBackgroundContext);
  }
  function pageBackgroundStyle(input?: string): DesignStyle {
    return input
      ? {
          "--cds-page-bg": isBackgroundToken(input)
            ? `var(--cds-${input})`
            : sanitizeBackgroundValue(input),
          ...(isFillBackgroundToken(input) ? ThemeRootFromEntriesValue : {}),
        }
      : {};
  }
  function isFillBackgroundToken(input: string): boolean {
    return isBackgroundToken(input) && input.startsWith("fill-");
  }
  function sanitizeBackgroundValue(input: string): string {
    return input.replaceAll(/[\u0000-\u001f\u007f;{}*]/g, "");
  }
  function isBackgroundToken(input: string): boolean {
    return ThemeRootSurface0Surface1Surface2Set.has(input);
  }
  function useExperimentalSettings(): Dynamic {
    return (0, reactThemeRoot.useContext)(ExperimentalSettingsContext);
  }
  function useCdsRootElement(): Dynamic {
    return (0, reactThemeRoot.useContext)(RootElementContext);
  }
  function useOverlayRoot(): Dynamic {
    let value: Dynamic = (0, reactThemeRoot.useContext)(RootElementContext),
      value2: Dynamic = (0, reactThemeRoot.useContext)(OverlayRootContext),
      value3: Dynamic = (0, reactThemeRoot.useContext)(RootPresenceContext);
    return value ?? (value3 ? undefined : value2);
  }
  function useCdsWindow(): Dynamic {
    return (0, runtime.getOwnerWindow)(
      (0, reactThemeRoot.useContext)(RootElementContext),
    );
  }
  function CdsRoot({
    density: density,
    mode: mode,
    platform: platform,
    font: font,
    fontMono: fontMono,
    pageBackground: pageBackground,
    locale: locale,
    router: router,
    labels: labels,
    experimental: experimental,
    render: render,
    className: className,
    children: children,
  }: Dynamic): Dynamic {
    let value: Dynamic = (0, reactThemeRoot.useContext)(DensityContext),
      value2: Dynamic = (0, reactThemeRoot.useContext)(PlatformContext),
      value3: Dynamic = (0, reactThemeRoot.useContext)(LocaleContext),
      value4: Dynamic = (0, reactThemeRoot.useContext)(LabelsContext),
      value5: Dynamic = (0, runtime.useLinkRouter)(),
      value6: Dynamic = (0, reactThemeRoot.useContext)(
        runtime.LabelsProviderContext,
      ),
      value7: Dynamic = (0, reactThemeRoot.useContext)(ThemeRootContext_2),
      value8: Dynamic = experimental?.densityOverride ?? value7,
      value9: Dynamic = value8 ?? density ?? value,
      value10: Dynamic = router ?? value5,
      value11: Dynamic = (0, reactThemeRoot.useMemo)(
        (): Dynamic =>
          labels && value6
            ? (
                input?: Dynamic,
                options?: Dynamic,
                context?: Dynamic,
              ): Dynamic =>
                labels(input, options, context) ||
                value6(input, options, context)
            : (labels ?? value6),
        [labels, value6],
      ),
      value12: Dynamic = (0, reactThemeRoot.useContext)(ThemeRootContext),
      value13: Dynamic = experimental?.naturalImageTiles ?? value12;
    (0, runtime.useMobileSheetPreload)(value3 === undefined, useCdsWindow());
    let value14: Dynamic = font ?? value3 ?? "anthropic",
      value15: Dynamic = (0, reactThemeRoot.useContext)(FontContext),
      value16: Dynamic =
        fontMono === null
          ? null
          : ((fontMono?.trim() ? fontMono.trim() : undefined) ?? value15),
      value17: Dynamic = pageBackground ?? value4,
      value18: Dynamic = (0, reactThemeRoot.useContext)(PageBackgroundContext),
      value19: Dynamic = pageBackground ?? value18,
      value20: Dynamic = (0, reactThemeRoot.useContext)(
        ExperimentalSettingsContext,
      ),
      value21: Dynamic = locale?.trim() ? locale.trim() : undefined,
      value22: Dynamic = value21 ?? value20,
      value23: Dynamic = (0, reactThemeRoot.useSyncExternalStore)(
        ThemeRootHandler,
        runtime.detectRuntimePlatform,
        ThemeRootDefaultText,
      ),
      value24: Dynamic = platform ?? value2 ?? value23,
      value25: Dynamic = (0, reactThemeRoot.useRef)(null),
      value26: Dynamic = (0, reactThemeRoot.useContext)(ColorModeContext),
      value27: Dynamic = mode !== undefined || value26 === undefined,
      [value28, value29]: Dynamic = (0, reactThemeRoot.useState)(
        (): Dynamic =>
          value27
            ? {
                mode: mode,
                scope: createColorModeStore(mode),
              }
            : null,
      ),
      value30: Dynamic = value27 ? undefined : value26,
      value31: Dynamic;
    value30 !== undefined
      ? (value31 = value30)
      : value28 !== null && value28.mode === mode
        ? (value31 = value28.scope)
        : ((value31 = createColorModeStore(mode)),
          value29({
            mode: mode,
            scope: value31,
          }));
    (0, runtime.useIsomorphicLayoutEffect)((): Dynamic => {
      (0, runtime.observeDocumentInput)(value25.current?.ownerDocument);
    }, []);
    (0, runtime.useIsomorphicLayoutEffect)((): Dynamic => {
      if (value27) {
        value31.setElement(value25.current);
        return (): Dynamic => value31.setElement(null);
      }
    }, [value27, value31]);
    let value32: Dynamic = (0, runtime.useExperimentalTheme)(
        experimental?.theme,
        value25,
      ),
      value33: Dynamic = (0, reactThemeRoot.useSyncExternalStore)(
        value31.subscribe,
        value27 ? value31.getAttrSnapshot : value31.getSnapshot,
        value27 ? value31.getServerAttrSnapshot : value31.getServerSnapshot,
      );
    (0, reactThemeRoot.useEffect)((): Dynamic => {}, [value21]);
    let flag: Dynamic = false;
    (0, reactThemeRoot.useEffect)((): Dynamic => {}, [flag]);
    (0, reactThemeRoot.useEffect)((): Dynamic => {}, []);
    let value34: Dynamic = render;
    typeof value34 == "object" &&
      value34 !== null &&
      value34.$$typeof === Symbol.for("react.lazy") &&
      (value34 = reactThemeRoot.Children.toArray(value34)[0]);
    let value35: Dynamic =
        (0, reactThemeRoot.isValidElement)(value34) && value34.type === "html",
      value36: Dynamic = (0, runtime.npm_useRender_LL)({
        render: value34,
        defaultTagName: "div",
        ref: value25,
        props: {
          className: (0, runtime.cn)("cds-root text-primary", className),
          "data-density": value9,
          "data-mode": value33,
          "data-platform": value24,
          "data-font": value14,
          "data-page-bg": value17,
          style: {
            ...(!value35 && {
              fontSize: "var(--cds-font-size-body)",
            }),
            ...pageBackgroundStyle(value19),
            ...monoFontOverrideStyle(value16),
          },
          children: children,
        },
      });
    return (
      <DensityContext.Provider value={value9}>
        <ColorModeContext.Provider value={value31}>
          <PlatformContext.Provider value={value24}>
            <LocaleContext.Provider value={value14}>
              <FontContext.Provider value={value16}>
                <LabelsContext.Provider value={value17}>
                  <PageBackgroundContext.Provider value={value19}>
                    <ExperimentalSettingsContext.Provider value={value22}>
                      <runtime.LinkRouterContext.Provider value={value10}>
                        <runtime.LabelsProviderContext.Provider value={value11}>
                          <ThemeRootContext.Provider value={value13}>
                            <ThemeRootContext_2.Provider value={value8}>
                              <runtime.ExperimentalThemeContext.Provider
                                value={value32}
                              >
                                {value36}
                              </runtime.ExperimentalThemeContext.Provider>
                            </ThemeRootContext_2.Provider>
                          </ThemeRootContext.Provider>
                        </runtime.LabelsProviderContext.Provider>
                      </runtime.LinkRouterContext.Provider>
                    </ExperimentalSettingsContext.Provider>
                  </PageBackgroundContext.Provider>
                </LabelsContext.Provider>
              </FontContext.Provider>
            </LocaleContext.Provider>
          </PlatformContext.Provider>
        </ColorModeContext.Provider>
      </DensityContext.Provider>
    );
  }
  bindRuntimeValue(runtime, "rootUsesCdsFont", () => rootUsesCdsFont);
  bindRuntimeValue(
    runtime,
    "inspectCdsStylesheets",
    () => inspectCdsStylesheets,
  );
  bindRuntimeValue(runtime, "getSizeAttribute", () => getSizeAttribute);
  bindRuntimeValue(runtime, "getControlSizeRank", () => getControlSizeRank);
  bindRuntimeValue(runtime, "createColorModeStore", () => createColorModeStore);
  bindRuntimeValue(runtime, "useCdsLabels", () => useCdsLabels);
  bindRuntimeValue(runtime, "useDensity", () => useDensity);
  bindRuntimeValue(runtime, "useResolvedColorMode", () => useResolvedColorMode);
  bindRuntimeValue(runtime, "useColorMode", () => useColorMode);
  bindRuntimeValue(runtime, "usePlatform", () => usePlatform);
  bindRuntimeValue(runtime, "useLocale", () => useLocale);
  bindRuntimeValue(runtime, "useCdsFont", () => useCdsFont);
  bindRuntimeValue(
    runtime,
    "monoFontOverrideStyle",
    () => monoFontOverrideStyle,
  );
  bindRuntimeValue(runtime, "usePageBackground", () => usePageBackground);
  bindRuntimeValue(runtime, "pageBackgroundStyle", () => pageBackgroundStyle);
  bindRuntimeValue(
    runtime,
    "isFillBackgroundToken",
    () => isFillBackgroundToken,
  );
  bindRuntimeValue(
    runtime,
    "sanitizeBackgroundValue",
    () => sanitizeBackgroundValue,
  );
  bindRuntimeValue(runtime, "isBackgroundToken", () => isBackgroundToken);
  bindRuntimeValue(
    runtime,
    "useExperimentalSettings",
    () => useExperimentalSettings,
  );
  bindRuntimeValue(runtime, "useCdsRootElement", () => useCdsRootElement);
  bindRuntimeValue(runtime, "useOverlayRoot", () => useOverlayRoot);
  bindRuntimeValue(runtime, "useCdsWindow", () => useCdsWindow);
  bindRuntimeValue(runtime, "CdsRoot", () => CdsRoot);
  bindRuntimeValue(
    runtime,
    "reactThemeRoot",
    () => reactThemeRoot,
    (value) => {
      reactThemeRoot = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxThemeRoot",
    () => jsxThemeRoot,
    (value) => {
      jsxThemeRoot = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ThemeRootHandler",
    () => ThemeRootHandler,
    (value) => {
      ThemeRootHandler = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ThemeRootDefaultText",
    () => ThemeRootDefaultText,
    (value) => {
      ThemeRootDefaultText = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "stylesheetsInspected",
    () => stylesheetsInspected,
    (value) => {
      stylesheetsInspected = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ThemeRootCompactComfortableConfig",
    () => ThemeRootCompactComfortableConfig,
    (value) => {
      ThemeRootCompactComfortableConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ThemeRootXsSmBaseConfig",
    () => ThemeRootXsSmBaseConfig,
    (value) => {
      ThemeRootXsSmBaseConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DensityContext",
    () => DensityContext,
    (value) => {
      DensityContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DensityContextAlias",
    () => DensityContextAlias,
    (value) => {
      DensityContextAlias = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ColorModeContext",
    () => ColorModeContext,
    (value) => {
      ColorModeContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "defaultColorModeStore",
    () => defaultColorModeStore,
    (value) => {
      defaultColorModeStore = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ThemeRootMediaQuery",
    () => ThemeRootMediaQuery,
    (value) => {
      ThemeRootMediaQuery = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ThemeRootHandler_2",
    () => ThemeRootHandler_2,
    (value) => {
      ThemeRootHandler_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformContext",
    () => PlatformContext,
    (value) => {
      PlatformContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "LocaleContext",
    () => LocaleContext,
    (value) => {
      LocaleContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FontContext",
    () => FontContext,
    (value) => {
      FontContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "LabelsContext",
    () => LabelsContext,
    (value) => {
      LabelsContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ThemeRootContext",
    () => ThemeRootContext,
    (value) => {
      ThemeRootContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ThemeRootContext_2",
    () => ThemeRootContext_2,
    (value) => {
      ThemeRootContext_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PageBackgroundContext",
    () => PageBackgroundContext,
    (value) => {
      PageBackgroundContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ExperimentalSettingsContext",
    () => ExperimentalSettingsContext,
    (value) => {
      ExperimentalSettingsContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "RootElementContext",
    () => RootElementContext,
    (value) => {
      RootElementContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "OverlayRootContext",
    () => OverlayRootContext,
    (value) => {
      OverlayRootContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "RootPresenceContext",
    () => RootPresenceContext,
    (value) => {
      RootPresenceContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ThemeRootFromEntriesValue",
    () => ThemeRootFromEntriesValue,
    (value) => {
      ThemeRootFromEntriesValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ThemeRootSurface0Surface1Surface2Set",
    () => ThemeRootSurface0Surface1Surface2Set,
    (value) => {
      ThemeRootSurface0Surface1Surface2Set = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeCdsRoot",
    () => initializeCdsRoot,
    (value) => {
      initializeCdsRoot = value;
    },
  );
  return () => {
    initializeCdsRoot = (0, runtime.initializeOnce)((): Dynamic => {
      "use client";

      (0, runtime.initializeDomOwnerWindow_2)();
      (0, runtime.initializeDomInputObservation)();
      (0, runtime.initializeSheetsLazyLoader_2)();
      (0, runtime.initializeHooksLayoutEffect)();
      (0, runtime.initializeExperimentalTheme)();
      (0, runtime.initializeClassNames)();
      (0, runtime.initializeSheetsStyles_2)();
      (0, runtime.initializePlatformRuntime)();
      (0, runtime.initializeLinkRouter)();
      (0, runtime.initializeDomOwnerWindow)();
      (0, runtime.initializeNpm__base_ui_react_SY)();
      reactThemeRoot = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react)(),
      );
      jsxThemeRoot = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react_jsx_runtime)(),
      );
      ThemeRootHandler = (): Dynamic => (): Dynamic => {};
      ThemeRootDefaultText = (): Dynamic => "web";
      stylesheetsInspected = false;
      ThemeRootCompactComfortableConfig = {
        compact: 2,
        comfortable: 4,
      };
      ThemeRootXsSmBaseConfig = {
        xs: -2,
        sm: -1,
        base: 0,
        lg: 1,
      };
      DensityContext = (0, reactThemeRoot.createContext)("comfortable");
      DensityContextAlias = DensityContext;
      ColorModeContext = (0, reactThemeRoot.createContext)(undefined);
      defaultColorModeStore = {
        setElement: (): Dynamic => {},
        subscribe: (): Dynamic => (): Dynamic => {},
        getSnapshot: (): Dynamic => {},
        getServerSnapshot: (): Dynamic => {},
        getAttrSnapshot: (): Dynamic => {},
        getServerAttrSnapshot: (): Dynamic => {},
        getSettingSnapshot: (): Dynamic => {},
        getServerSettingSnapshot: (): Dynamic => {},
      };
      ThemeRootMediaQuery = "(prefers-color-scheme: dark)";
      ThemeRootHandler_2 = (input?: Dynamic): Dynamic =>
        input === "dark" || input === "light"
          ? input
          : input === "auto" || input === "system"
            ? "system"
            : undefined;
      PlatformContext = (0, reactThemeRoot.createContext)(undefined);
      LocaleContext = (0, reactThemeRoot.createContext)(undefined);
      FontContext = (0, reactThemeRoot.createContext)(undefined);
      LabelsContext = (0, reactThemeRoot.createContext)(undefined);
      ThemeRootContext = (0, reactThemeRoot.createContext)(undefined);
      ThemeRootContext_2 = (0, reactThemeRoot.createContext)(undefined);
      PageBackgroundContext = (0, reactThemeRoot.createContext)(undefined);
      ExperimentalSettingsContext = (0, reactThemeRoot.createContext)(
        undefined,
      );
      RootElementContext = (0, reactThemeRoot.createContext)(undefined);
      OverlayRootContext = (0, reactThemeRoot.createContext)(undefined);
      RootPresenceContext = (0, reactThemeRoot.createContext)(false);
      ThemeRootFromEntriesValue = Object.fromEntries(
        runtime.accentColorNames.map(
          (input?: Dynamic): Dynamic => [
            `--cds-bg-tint-${input}`,
            `var(--cds-bg-tint-${input}-opaque)`,
          ],
        ),
      );
      ThemeRootSurface0Surface1Surface2Set = new Set([
        "surface-0",
        "surface-1",
        "surface-2",
        "surface-3",
        "fill-accent",
      ]);
    });
  };
}
