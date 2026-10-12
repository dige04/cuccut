/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";
export function installCdsSheetsMenuPopup(
  runtime: RuntimeBindings,
): () => void {
  var reactSheetsMenuPopup: Dynamic;
  var PointerEventsNoneValue: Dynamic;
  var SheetsMenuPopupLimit: Dynamic;
  var initializeSheetsMenuPopup: Dynamic;
  var SheetsMenuPopupLabel: Dynamic;
  var SheetsMenuPopupLabel_2: Dynamic;
  var SheetsMenuPopupMediaQuery: Dynamic;
  var SheetsMenuPopupLabel_3: Dynamic;
  var initializeSheetsMenuPopup_2: Dynamic;
  var reactSheetsMenuPopup_2: Dynamic;
  var SheetsMenuPopupSCRIPTSTYLELINKSet: Dynamic;
  var SheetsMenuPopupLabel_4: Dynamic;
  var SheetsMenuPopupElementCache: Dynamic;
  var initializeSheetsMenuPopup_3: Dynamic;
  var reactSheetsMenuPopup_3: Dynamic;
  var jsxSheetsMenuPopup: Dynamic;
  var SheetsMenuPopupElementCache_2: Dynamic;
  var MenuSheetPopup: Dynamic;
  var initializeSheetsMenuPopup_4: Dynamic;
  var jsxSheetsMenuPopup_2: Dynamic;
  var initializeSheetsMenuPopup_5: Dynamic;
  var jsxSheetsMenuPopup_3: Dynamic;
  var initializeSheetsMenuPopup_6: Dynamic;
  function browserWindow(input?: Dynamic): Dynamic {
    return input ?? (typeof window === "undefined" ? undefined : window);
  }
  function windowMatchesMedia(input?: Dynamic, options?: Dynamic): Dynamic {
    let value: Dynamic = browserWindow(options);
    return (
      typeof value?.matchMedia == "function" && value.matchMedia(input).matches
    );
  }
  function usesCoarsePointer(input?: Dynamic): Dynamic {
    return windowMatchesMedia(SheetsMenuPopupLabel, input);
  }
  function shouldSkipSheetAnimation(input?: Dynamic): Dynamic {
    let value: Dynamic = browserWindow(input);
    return value?.navigator?.userAgent?.includes(SheetsMenuPopupLabel_3)
      ? true
      : !(
          windowMatchesMedia(SheetsMenuPopupMediaQuery, value) &&
          (value?.navigator?.maxTouchPoints ?? 0) > 0
        );
  }
  function subscribeSheetMedia(input?: Dynamic, options?: Dynamic): Dynamic {
    let value: Dynamic = browserWindow(options);
    if (typeof value?.matchMedia != "function") return (): Dynamic => {};
    let value2: Dynamic = [
      SheetsMenuPopupLabel,
      SheetsMenuPopupLabel_2,
      SheetsMenuPopupMediaQuery,
    ].map((input2?: Dynamic): Dynamic => value.matchMedia(input2));
    for (let value3 of value2 as Dynamic)
      value3.addEventListener("change", input);
    return (): Dynamic => {
      for (let value3 of value2 as Dynamic)
        value3.removeEventListener("change", input);
    };
  }
  function makeSheetSiblingsInert(element?: Dynamic): Dynamic {
    let items: Dynamic = [],
      callback: Dynamic = (input?: Dynamic): Dynamic => {
        let value2: Dynamic = SheetsMenuPopupElementCache.get(input) ?? 0;
        if (value2 === 0) {
          if (input.hasAttribute("inert")) return;
          input.setAttribute("inert", "");
          input.setAttribute("data-cds-sheet-inert", "");
        }
        SheetsMenuPopupElementCache.set(input, value2 + 1);
        items.push(input);
      },
      callback2: Dynamic = (element2?: Dynamic): Dynamic => {
        if (
          !(
            SheetsMenuPopupSCRIPTSTYLELINKSet.has(element2.tagName) ||
            element2.matches(SheetsMenuPopupLabel_4)
          )
        ) {
          if (element2.querySelector(SheetsMenuPopupLabel_4) === null) {
            callback(element2);
            return;
          }
          for (let value2 of Array.from(element2.children) as Dynamic)
            callback2(value2);
        }
      },
      value: Dynamic = element,
      body: Dynamic = element.ownerDocument.body;
    for (; value !== null && value !== body && value.parentElement !== null; ) {
      let parentElement: Dynamic = value.parentElement,
        value2: Dynamic = value;
      for (let value3 of Array.from(parentElement.children) as Dynamic)
        value3 !== value2 && callback2(value3);
      value = parentElement;
    }
    return (): Dynamic => {
      for (let value2 of items as Dynamic) {
        let value3: Dynamic =
          (SheetsMenuPopupElementCache.get(value2) ?? 1) - 1;
        value3 <= 0
          ? (SheetsMenuPopupElementCache.delete(value2),
            value2.hasAttribute("data-cds-sheet-inert") &&
              (value2.removeAttribute("inert"),
              value2.removeAttribute("data-cds-sheet-inert")))
          : SheetsMenuPopupElementCache.set(value2, value3);
      }
    };
  }
  function useSheetSiblingsInert({
    node: node,
    open: open,
    liftOnClose: liftOnClose,
  }: Dynamic): Dynamic {
    let value: Dynamic = (0, runtime.useCdsWindow)(),
      value2: Dynamic = (0, runtime.useOptionalStableCallback)(liftOnClose),
      value3: Dynamic = (0, reactSheetsMenuPopup_2.useRef)(null),
      value4: Dynamic = (0, reactSheetsMenuPopup_2.useRef)(null);
    (0, runtime.useIsomorphicLayoutEffect)((): Dynamic => {
      if (!open || node === null || value === undefined) return;
      let value5: Dynamic = value.requestAnimationFrame((): Dynamic => {
        if (value3.current === null) {
          let value6: Dynamic = sheetPortalAncestor(node);
          value6 !== null && (value3.current = makeSheetSiblingsInert(value6));
        }
      });
      return (): Dynamic => {
        value.cancelAnimationFrame(value5);
        let current: Dynamic = value3.current;
        value3.current = null;
        if (current === null) return;
        if ((value2?.() ?? "now") === "now" || !canAnimateSheetUnmount(value)) {
          current();
          return;
        }
        let value6: Dynamic = deferSheetInertRemoval(
          value,
          current,
          (): Dynamic => {
            value4.current === value6 && (value4.current = null);
          },
        );
        value4.current = value6;
      };
    }, [node, open, value, value2]);
    return (0, reactSheetsMenuPopup_2.useCallback)(
      (): Dynamic => value4.current?.(),
      [],
    );
  }
  function canAnimateSheetUnmount(input?: Dynamic): Dynamic {
    return (
      !shouldSkipSheetAnimation(input) &&
      !(0, runtime.prefersReducedMotion)() &&
      input.document.visibilityState !== "hidden"
    );
  }
  function deferSheetInertRemoval(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    let document2: Dynamic = input.document,
      flag: Dynamic = false,
      callback: Dynamic = (): Dynamic => {
        flag ||
          ((flag = true),
          input.cancelAnimationFrame(value),
          input.removeEventListener("pointerdown", callback, true),
          input.removeEventListener("keydown", callback, true),
          input.removeEventListener("pagehide", callback),
          document2.removeEventListener("visibilitychange", callback2),
          options(),
          context());
      },
      callback2: Dynamic = (): Dynamic => {
        document2.visibilityState === "hidden" && callback();
      },
      value: Dynamic = input.requestAnimationFrame((): Dynamic => {
        value = input.requestAnimationFrame(callback);
      });
    input.addEventListener("pointerdown", callback, true);
    input.addEventListener("keydown", callback, true);
    input.addEventListener("pagehide", callback);
    document2.addEventListener("visibilitychange", callback2);
    return callback;
  }
  function sheetPortalAncestor(element?: Dynamic): Dynamic {
    let body: Dynamic = element.ownerDocument.body,
      value: Dynamic = element,
      value2: Dynamic = null;
    for (; value !== null && value !== body; ) {
      if (
        value.hasAttribute("data-base-ui-portal") ||
        value.hasAttribute("data-cds-portal")
      )
        return value;
      value2 = value;
      value = value.parentElement;
    }
    return value2;
  }
  function preventSheetTab(event?: Dynamic): Dynamic {
    event.key === "Tab" && (event.preventDefault(), event.stopPropagation());
  }
  function hideCoveredSheet(input?: Dynamic, options?: Dynamic): Dynamic {
    let entry: Dynamic = SheetsMenuPopupElementCache_2.get(input);
    entry === undefined &&
      ((entry = new Set()), SheetsMenuPopupElementCache_2.set(input, entry));
    entry.add(options);
    input.setAttribute("aria-hidden", "true");
    input.setAttribute(runtime.drilledSheetAttribute, "");
  }
  function restoreCoveredSheet(input?: Dynamic, options?: Dynamic): Dynamic {
    let entry: Dynamic = SheetsMenuPopupElementCache_2.get(input);
    entry?.delete(options);
    (entry === undefined || entry.size === 0) &&
      (input.removeAttribute("aria-hidden"),
      input.removeAttribute(runtime.drilledSheetAttribute));
  }
  function sheetCloseInertDelay(input?: Dynamic): Dynamic {
    if (input?.reason === "outside-press") return "after-paint";
    let value: Dynamic = input?.event;
    if (
      input?.reason !== "item-press" ||
      value === undefined ||
      !("detail" in value) ||
      value.detail === 0
    )
      return "now";
    let target: Dynamic = value.target;
    return (target !== null && "closest" in target
      ? target.closest('[role^="menuitem"]')
      : null
    )?.hasAttribute("data-cds-focuses-nothing") === true
      ? "after-paint"
      : "now";
  }
  function SheetBackButton({ nested: nested }: Dynamic): Dynamic {
    let value: Dynamic = (0, reactSheetsMenuPopup_3.useContext)(
        runtime.MenuRootContext,
      ),
      { label: value2 }: Dynamic = (0, reactSheetsMenuPopup_3.useContext)(
        runtime.MenuItemContext,
      ),
      value3: Dynamic = (0, reactSheetsMenuPopup_3.useContext)(
        runtime.MenuSheetLabelsContext,
      ),
      value4: Dynamic = (0, runtime.useLabel)("back", "Back"),
      value5: Dynamic = value3.backLabel ?? value4;
    return (
      <runtime.SheetHeading
        title={nested ? value2 : value3.sheetTitle}
        leading={
          nested ? (
            <runtime.npm_Menu_La.Item
              closeOnClick={false}
              onClick={(): Dynamic => value?.close()}
              aria-label={value5}
              label={value5}
              className={(0, runtime.cn)(
                (0, runtime.menuItemVariants)({
                  variant: "default",
                }),
                "min-h-control w-auto",
              )}
            >
              <runtime.Icon
                name={"ArrowLeft"}
                size={"md"}
                className={"shrink-0 rtl:-scale-x-100"}
              />
            </runtime.npm_Menu_La.Item>
          ) : undefined
        }
      />
    );
  }
  function SheetCloseButton(): Dynamic {
    let value: Dynamic = (0, reactSheetsMenuPopup_3.useContext)(
        runtime.SheetPopupContext,
      ),
      value2: Dynamic = (0, runtime.useLabel)("close", "Close"),
      value3: Dynamic =
        (0, reactSheetsMenuPopup_3.useContext)(runtime.MenuSheetLabelsContext)
          .closeLabel ?? value2;
    return (
      <runtime.npm_Menu_La.Item
        closeOnClick={false}
        onClick={(): Dynamic => value?.dismiss()}
        aria-label={value3}
        label={value3}
        data-cds-sheet-control={""}
        className={
          "group/sheet-close cds-reset block w-full rounded outline-none select-none focus-visible:outline-hidden [&:not(:focus-visible):not([data-highlighted]):not([data-cds-sheet-control-held])]:sr-only"
        }
      >
        <span
          className={(0, runtime.cn)(
            (0, runtime.menuItemVariants)({
              variant: "default",
            }),
            "group-data-[highlighted]/sheet-close:bg-fill-ghost-hover",
          )}
        >
          <runtime.IconRenderer icon={"X"} />
          <span className={"min-w-0 flex-1 truncate"}>{value3}</span>
        </span>
      </runtime.npm_Menu_La.Item>
    );
  }
  function MobileSheetsPopoverSheetBackdrop({
    sheetPopup: sheetPopup,
  }: Dynamic): Dynamic {
    return (
      <runtime.npm_Popover_$f.Backdrop
        data-presentation={"sheet"}
        data-sheet-scrim={sheetPopup.frame?.treeId}
        className={
          sheetPopup.state.depth > 0
            ? runtime.PlatformReducedMotionClassNames_2
            : runtime.PlatformReducedMotionCss_4
        }
      />
    );
  }
  function MobileSheetsPopoverSheetContent({
    sheetPopup: sheetPopup,
    className: className,
    bodyRef: bodyRef,
    bodyClassName: bodyClassName,
    closeLabel: closeLabel,
    children: children,
  }: Dynamic): Dynamic {
    let { chrome: value }: Dynamic = sheetPopup;
    return (
      <runtime.SheetStackContext.Provider value={sheetPopup.stack}>
        <value.Handle />
        <value.Body
          className={(0, runtime.cn)(
            className,
            "h-auto max-h-none min-h-0 w-full min-w-0 max-w-none flex-auto",
          )}
        >
          <div
            ref={bodyRef}
            tabIndex={-1}
            data-cds-popover-body={""}
            {...{
              [runtime.sheetScrollAttribute]: "",
            }}
            className={bodyClassName}
          >
            {children}
          </div>
          <value.DismissButton
            as={runtime.npm_Popover_$f.Close}
            label={closeLabel}
          />
        </value.Body>
      </runtime.SheetStackContext.Provider>
    );
  }
  function MobileSheetsComboboxSheetBackdrop({
    sheetPopup: sheetPopup,
  }: Dynamic): Dynamic {
    return (
      <runtime.npm_Combobox_Yi.Backdrop
        data-presentation={"sheet"}
        data-sheet-scrim={sheetPopup.frame?.treeId}
        className={
          sheetPopup.state.depth > 0
            ? runtime.PlatformReducedMotionClassNames_2
            : runtime.PlatformReducedMotionCss_4
        }
      />
    );
  }
  bindRuntimeValue(
    runtime,
    "reactSheetsMenuPopup",
    () => reactSheetsMenuPopup,
    (value) => {
      reactSheetsMenuPopup = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PointerEventsNoneValue",
    () => PointerEventsNoneValue,
    (value) => {
      PointerEventsNoneValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SheetsMenuPopupLimit",
    () => SheetsMenuPopupLimit,
    (value) => {
      SheetsMenuPopupLimit = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeSheetsMenuPopup",
    () => initializeSheetsMenuPopup,
    (value) => {
      initializeSheetsMenuPopup = value;
    },
  );
  bindRuntimeValue(runtime, "browserWindow", () => browserWindow);
  bindRuntimeValue(runtime, "windowMatchesMedia", () => windowMatchesMedia);
  bindRuntimeValue(runtime, "usesCoarsePointer", () => usesCoarsePointer);
  bindRuntimeValue(
    runtime,
    "shouldSkipSheetAnimation",
    () => shouldSkipSheetAnimation,
  );
  bindRuntimeValue(runtime, "subscribeSheetMedia", () => subscribeSheetMedia);
  bindRuntimeValue(
    runtime,
    "SheetsMenuPopupLabel",
    () => SheetsMenuPopupLabel,
    (value) => {
      SheetsMenuPopupLabel = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SheetsMenuPopupLabel_2",
    () => SheetsMenuPopupLabel_2,
    (value) => {
      SheetsMenuPopupLabel_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SheetsMenuPopupMediaQuery",
    () => SheetsMenuPopupMediaQuery,
    (value) => {
      SheetsMenuPopupMediaQuery = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SheetsMenuPopupLabel_3",
    () => SheetsMenuPopupLabel_3,
    (value) => {
      SheetsMenuPopupLabel_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeSheetsMenuPopup_2",
    () => initializeSheetsMenuPopup_2,
    (value) => {
      initializeSheetsMenuPopup_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "makeSheetSiblingsInert",
    () => makeSheetSiblingsInert,
  );
  bindRuntimeValue(
    runtime,
    "useSheetSiblingsInert",
    () => useSheetSiblingsInert,
  );
  bindRuntimeValue(
    runtime,
    "canAnimateSheetUnmount",
    () => canAnimateSheetUnmount,
  );
  bindRuntimeValue(
    runtime,
    "deferSheetInertRemoval",
    () => deferSheetInertRemoval,
  );
  bindRuntimeValue(runtime, "sheetPortalAncestor", () => sheetPortalAncestor);
  bindRuntimeValue(runtime, "preventSheetTab", () => preventSheetTab);
  bindRuntimeValue(
    runtime,
    "reactSheetsMenuPopup_2",
    () => reactSheetsMenuPopup_2,
    (value) => {
      reactSheetsMenuPopup_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SheetsMenuPopupSCRIPTSTYLELINKSet",
    () => SheetsMenuPopupSCRIPTSTYLELINKSet,
    (value) => {
      SheetsMenuPopupSCRIPTSTYLELINKSet = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SheetsMenuPopupLabel_4",
    () => SheetsMenuPopupLabel_4,
    (value) => {
      SheetsMenuPopupLabel_4 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SheetsMenuPopupElementCache",
    () => SheetsMenuPopupElementCache,
    (value) => {
      SheetsMenuPopupElementCache = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeSheetsMenuPopup_3",
    () => initializeSheetsMenuPopup_3,
    (value) => {
      initializeSheetsMenuPopup_3 = value;
    },
  );
  bindRuntimeValue(runtime, "hideCoveredSheet", () => hideCoveredSheet);
  bindRuntimeValue(runtime, "restoreCoveredSheet", () => restoreCoveredSheet);
  bindRuntimeValue(runtime, "sheetCloseInertDelay", () => sheetCloseInertDelay);
  bindRuntimeValue(runtime, "SheetBackButton", () => SheetBackButton);
  bindRuntimeValue(runtime, "SheetCloseButton", () => SheetCloseButton);
  bindRuntimeValue(
    runtime,
    "reactSheetsMenuPopup_3",
    () => reactSheetsMenuPopup_3,
    (value) => {
      reactSheetsMenuPopup_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxSheetsMenuPopup",
    () => jsxSheetsMenuPopup,
    (value) => {
      jsxSheetsMenuPopup = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SheetsMenuPopupElementCache_2",
    () => SheetsMenuPopupElementCache_2,
    (value) => {
      SheetsMenuPopupElementCache_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MenuSheetPopup",
    () => MenuSheetPopup,
    (value) => {
      MenuSheetPopup = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeSheetsMenuPopup_4",
    () => initializeSheetsMenuPopup_4,
    (value) => {
      initializeSheetsMenuPopup_4 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MobileSheetsPopoverSheetBackdrop",
    () => MobileSheetsPopoverSheetBackdrop,
  );
  bindRuntimeValue(
    runtime,
    "MobileSheetsPopoverSheetContent",
    () => MobileSheetsPopoverSheetContent,
  );
  bindRuntimeValue(
    runtime,
    "jsxSheetsMenuPopup_2",
    () => jsxSheetsMenuPopup_2,
    (value) => {
      jsxSheetsMenuPopup_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeSheetsMenuPopup_5",
    () => initializeSheetsMenuPopup_5,
    (value) => {
      initializeSheetsMenuPopup_5 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MobileSheetsComboboxSheetBackdrop",
    () => MobileSheetsComboboxSheetBackdrop,
  );
  bindRuntimeValue(
    runtime,
    "jsxSheetsMenuPopup_3",
    () => jsxSheetsMenuPopup_3,
    (value) => {
      jsxSheetsMenuPopup_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeSheetsMenuPopup_6",
    () => initializeSheetsMenuPopup_6,
    (value) => {
      initializeSheetsMenuPopup_6 = value;
    },
  );
  return () => {
    initializeSheetsMenuPopup = (0, runtime.initializeOnce)((): Dynamic => {
      "use client";

      reactSheetsMenuPopup = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react)(),
      );
      PointerEventsNoneValue = "pointer-events-none";
      SheetsMenuPopupLimit = 2;
    });
    initializeSheetsMenuPopup_2 = (0, runtime.initializeOnce)((): Dynamic => {
      SheetsMenuPopupLabel = "(pointer: coarse), (hover: none)";
      SheetsMenuPopupLabel_2 = "(width < 40rem)";
      SheetsMenuPopupMediaQuery = "(pointer: coarse)";
      SheetsMenuPopupLabel_3 = " Electron/";
    });
    initializeSheetsMenuPopup_3 = (0, runtime.initializeOnce)((): Dynamic => {
      "use client";

      (0, runtime.initializeHooksLayoutEffect)();
      (0, runtime.initializeCdsRoot)();
      initializeSheetsMenuPopup_2();
      (0, runtime.initializeHooksStableCallback_2)();
      (0, runtime.initializePlatformReducedMotion)();
      reactSheetsMenuPopup_2 = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react)(),
      );
      SheetsMenuPopupSCRIPTSTYLELINKSet = new Set([
        "SCRIPT",
        "STYLE",
        "LINK",
        "TEMPLATE",
        "NOSCRIPT",
      ]);
      SheetsMenuPopupLabel_4 =
        '[aria-live]:not([aria-live="off"]), [role="status"], [role="alert"], [role="log"], [data-cds="Toast"]';
      SheetsMenuPopupElementCache = new WeakMap();
    });
    initializeSheetsMenuPopup_4 = (0, runtime.initializeOnce)((): Dynamic => {
      "use client";

      (0, runtime.initializeHooksLayoutEffect)();
      (0, runtime.initializeClassNames)();
      (0, runtime.initializeSheetsStyles_2)();
      (0, runtime.initializeCdsRoot)();
      (0, runtime.initializeOverlaysLayers)();
      (0, runtime.initializeOverlaysAndroidCloseWatcher)();
      (0, runtime.initializeDomRefComposition)();
      (0, runtime.initializePlatformRootFontSize_2)();
      (0, runtime.initializeComponentsIcon_2)();
      (0, runtime.initializeComponentsIcon_3)();
      (0, runtime.initializeThemeSurfaces)();
      (0, runtime.initializeSheetsLayout)();
      (0, runtime.initializeSheetsPresentation)();
      (0, runtime.initializeSheetsPopupStack)();
      (0, runtime.initializePlatformReducedMotion_2)();
      (0, runtime.initializeMenuConfiguration)();
      (0, runtime.initializeSheetsScrollArea)();
      (0, runtime.initializeMenuPopup)();
      (0, runtime.initializeMenuPassiveOpenGate)();
      (0, runtime.initializeMenuItemStyles)();
      (0, runtime.initializeMenuItemStyles_2)();
      (0, runtime.initializeMenuItemStyles_3)();
      initializeSheetsMenuPopup();
      (0, runtime.initializeSheetsStyles)();
      (0, runtime.initializeSheetsChrome)();
      (0, runtime.initializeSheetsChrome_2)();
      initializeSheetsMenuPopup_3();
      reactSheetsMenuPopup_3 = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react)(),
      );
      jsxSheetsMenuPopup = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react_jsx_runtime)(),
      );
      (0, runtime.initializeNpm__base_ui_react_jj)();
      SheetsMenuPopupElementCache_2 = new WeakMap();
      MenuSheetPopup = (0, reactSheetsMenuPopup_3.forwardRef)(
        (
          {
            side: side,
            align = "start",
            sideOffset: sideOffset,
            collisionPadding: collisionPadding,
            collisionAvoidance: collisionAvoidance,
            anchor: anchor,
            container: container,
            className: className,
            children: children,
            header: header,
            footer: footer,
            maxVisibleItems: maxVisibleItems,
            layerOffset: layerOffset,
            stableWhileOpen = false,
            "data-cds": dataCds = "Menu",
            style: style,
            initialFocus: initialFocus,
            ...props
          }: Dynamic,
          options?: Dynamic,
        ): Dynamic => {
          "use no memo";

          let value: Dynamic = (0, runtime.useOverlayRoot)(),
            value2: Dynamic = (0, reactSheetsMenuPopup_3.useContext)(
              runtime.MenuRootContext,
            ),
            value3: Dynamic =
              (0, reactSheetsMenuPopup_3.useContext)(
                runtime.MenuConfigurationContext,
              ) && value2 === null,
            value4: Dynamic = (0, runtime.useIsSheet)(),
            value5: Dynamic = value4 && value2 !== null,
            value6: Dynamic = (0, reactSheetsMenuPopup_3.useContext)(
              runtime.ComponentsIconContext,
            ),
            value7: Dynamic = collisionPadding ?? value6?.collisionPadding,
            value8: Dynamic = (0, reactSheetsMenuPopup_3.useMemo)(
              (): Dynamic =>
                anchor !== undefined || !value2
                  ? anchor
                  : (0, runtime.virtualTriggerAnchor)(value2),
              [anchor, value2],
            ),
            value9: Dynamic =
              sideOffset ??
              (value3 ? undefined : value2 && anchor === undefined ? 2 : 6),
            value10: Dynamic = (0, runtime.usePopupEntryAnimation)({
              enabled: stableWhileOpen && !value4 && !value3,
              side: side,
              align: align,
            }),
            value11: Dynamic = (0, reactSheetsMenuPopup_3.useContext)(
              runtime.SheetPopupContext,
            ),
            value12: Dynamic = (0, reactSheetsMenuPopup_3.useContext)(
              runtime.MenuItemContext,
            ),
            value13: Dynamic = (0, reactSheetsMenuPopup_3.useRef)(null),
            value14: Dynamic = (0, reactSheetsMenuPopup_3.useRef)(null),
            value15: Dynamic = (0,
            reactSheetsMenuPopup_3.useCallback)((): Dynamic => {
              let current: Dynamic = value14.current;
              current !== null &&
                (restoreCoveredSheet(current, value14),
                (value14.current = null));
            }, []),
            value16: Dynamic = (0, reactSheetsMenuPopup_3.useCallback)(
              (element?: Dynamic): Dynamic => {
                if (value2 === null) return;
                let value55: Dynamic =
                  value11 !== null
                    ? (value2.triggerRef.current?.closest(
                        `[data-sheet-tree="${CSS.escape(value11.treeId)}"][data-presentation="sheet"]`,
                      ) ?? null)
                    : null;
                value55 !== null &&
                  value14.current !== value55 &&
                  (value15(),
                  hideCoveredSheet(value55, value14),
                  (value14.current = value55));
                element.contains(element.ownerDocument.activeElement) ||
                  element.focus({
                    preventScroll: true,
                  });
              },
              [value2, value15, value11],
            ),
            [value17, value18]: Dynamic = (0, reactSheetsMenuPopup_3.useState)(
              false,
            ),
            value19: Dynamic = (0, reactSheetsMenuPopup_3.useRef)(false),
            value20: Dynamic = (0, reactSheetsMenuPopup_3.useCallback)(
              (input?: Dynamic): Dynamic => {
                value19.current = input;
                value18(input);
              },
              [],
            ),
            [value21, value22]: Dynamic = (0, reactSheetsMenuPopup_3.useState)(
              null,
            ),
            value23: Dynamic = value11?.takeCloseRequest,
            value24: Dynamic = (0, reactSheetsMenuPopup_3.useCallback)(
              (): Dynamic => sheetCloseInertDelay(value23?.() ?? null),
              [value23],
            ),
            value25: Dynamic = useSheetSiblingsInert({
              node: value21,
              open: value4 && !value5 && (value11?.open ?? false),
              liftOnClose: value24,
            }),
            value26: Dynamic = (0, runtime.useSheetState)(),
            value27: Dynamic = (0, reactSheetsMenuPopup_3.useContext)(
              runtime.SheetStackContext,
            ),
            value28: Dynamic = (0, reactSheetsMenuPopup_3.useContext)(
              runtime.SheetPopupBridgeContext,
            ),
            [value29, value30]: Dynamic = (0, reactSheetsMenuPopup_3.useState)(
              null,
            ),
            value31: Dynamic = (0, reactSheetsMenuPopup_3.useCallback)(
              (element?: Dynamic): Dynamic => {
                value13.current = value4 ? element : null;
                value30(value4 ? element : null);
                value22(value4 && !value5 ? element : null);
                if (element === null) {
                  value25();
                  value15();
                  value20(false);
                  return;
                }
                if (!value4) {
                  value20(false);
                  return;
                }
                if (!value5) {
                  let value55: Dynamic = (0, runtime.sheetContainsTextInput)(
                    element,
                  );
                  value55 &&
                    ((element.style.minHeight = runtime.SheetsLayoutCss_3),
                    (element.style.maxHeight = runtime.SheetsLayoutCss_3));
                  value20(value55);
                  value11?.pinHeight(
                    element.getBoundingClientRect().height,
                    (0, runtime.sheetNeedsScrolling)(element),
                  );
                  return;
                }
                value16(element);
                element.style.transition = "none";
                element.style.translate =
                  element.ownerDocument.defaultView?.getComputedStyle(element)
                    .direction === "rtl"
                    ? "-100% 0"
                    : "100% 0";
                element.getBoundingClientRect();
                element.style.transition = "";
                element.style.translate = "";
              },
              [value4, value5, value11, value15, value16, value20, value25],
            );
          (0, runtime.useSheetTextFocus)(value29, value11);
          (0, runtime.useCoveredSheetState)(value29);
          (0, runtime.useSheetDismissal)(value29, value11, value26.covered);
          let value32: Dynamic = value4 && value26.covered,
            value33: Dynamic = value4 && value26.inert;
          (0, runtime.useAndroidCloseWatcher)(
            value4 && (value5 ? value12.open : (value11?.open ?? false)),
            value5 ? value2?.close : value11?.dismiss,
          );
          let value34: Dynamic = (0, reactSheetsMenuPopup_3.useRef)(false),
            value35: Dynamic = value11?.open ?? false;
          (0, runtime.useIsomorphicLayoutEffect)((): Dynamic => {
            let current: Dynamic = value13.current,
              value55: Dynamic = value5 && value12.open && current !== null,
              current2: Dynamic = value34.current;
            value34.current = value55;
            value55 && !current2
              ? value16(current)
              : !value55 && value35 && value15();
          }, [value5, value12.open, value35, value16, value15]);
          let value36: Dynamic = (0, reactSheetsMenuPopup_3.useRef)(false),
            [value37, value38]: Dynamic = (0, reactSheetsMenuPopup_3.useState)(
              false,
            );
          (0, runtime.useIsomorphicLayoutEffect)((): Dynamic => {
            let value55: Dynamic = value5 && value12.open,
              current: Dynamic = value36.current;
            value36.current = value55;
            value55 !== current && value38(!value55 && value35);
          }, [value5, value12.open, value35]);
          (0, runtime.useIsomorphicLayoutEffect)((): Dynamic => {
            let current: Dynamic = value13.current;
            value5 &&
              value12.open &&
              current !== null &&
              (0, runtime.clearSheetTransition)(current);
          }, [value5, value12.open]);
          let value39: Dynamic = value11?.pushLevelHeight,
            value40: Dynamic = value11?.drag;
          (0, reactSheetsMenuPopup_3.useEffect)((): Dynamic => {
            if (
              !value5 ||
              !value12.open ||
              value29 === null ||
              value39 === undefined
            )
              return;
            let defaultView: Dynamic = value29.ownerDocument.defaultView,
              value55: Dynamic,
              flag: Dynamic = false,
              callback: Dynamic = (): Dynamic => {
                let value58: Dynamic = defaultView?.innerHeight ?? 1 / 0,
                  value59: Dynamic = value58 * runtime.SheetsLayoutConstant,
                  value60: Dynamic = (0, runtime.sheetContainsTextInput)(
                    value29,
                  ),
                  value61: Dynamic = (0, runtime.sheetNaturalHeight)(value29);
                flag = value61 > value59;
                let value62: Dynamic = value60
                    ? value58 * runtime.SheetsLayoutConstant_2
                    : Math.min(value61, value59),
                  value63: Dynamic = value60 || flag;
                value55 === undefined
                  ? (value55 = value39(value62, value63))
                  : value55.set(value62, value63);
              },
              callback2: Dynamic = (): Dynamic => {
                value56 = undefined;
                if (value40 !== undefined && value40.get() !== null) {
                  value56 = defaultView?.requestAnimationFrame(callback2);
                  return;
                }
                callback();
              },
              value56: Dynamic = defaultView?.requestAnimationFrame(callback2),
              value57: Dynamic =
                defaultView !== null &&
                typeof defaultView.MutationObserver !== "undefined"
                  ? new defaultView.MutationObserver(
                      (input?: Dynamic): Dynamic => {
                        if (
                          value56 !== undefined ||
                          value55 === undefined ||
                          (0, runtime.sheetMutationIsScrollOnly)(input, flag)
                        )
                          return;
                        let callback3: Dynamic = (): Dynamic => {
                          value56 = undefined;
                          if (value40 !== undefined && value40.get() !== null) {
                            value56 =
                              defaultView.requestAnimationFrame(callback3);
                            return;
                          }
                          callback();
                        };
                        value56 = defaultView.requestAnimationFrame(callback3);
                      },
                    )
                  : null;
            value57?.observe(value29, {
              childList: true,
              subtree: true,
            });
            return (): Dynamic => {
              value57?.disconnect();
              value56 !== undefined &&
                defaultView?.cancelAnimationFrame(value56);
              value55?.release();
            };
          }, [value5, value12.open, value29, value39, value40]);
          let value41: Dynamic = value11?.repinHeight,
            value42: Dynamic = value11?.open ?? false;
          (0, reactSheetsMenuPopup_3.useEffect)((): Dynamic => {
            if (
              !value4 ||
              value5 ||
              !value42 ||
              value29 === null ||
              value41 === undefined
            )
              return;
            let defaultView: Dynamic = value29.ownerDocument.defaultView;
            if (
              defaultView === null ||
              typeof defaultView.MutationObserver === "undefined"
            )
              return;
            let index: Dynamic = 0,
              flag: Dynamic = false,
              value55: Dynamic = new defaultView.MutationObserver(
                (input?: Dynamic): Dynamic => {
                  if (
                    index !== 0 ||
                    (0, runtime.sheetMutationIsScrollOnly)(input, flag)
                  )
                    return;
                  let callback: Dynamic = (): Dynamic => {
                    index = 0;
                    if (value40 !== undefined && value40.get() !== null) {
                      index = defaultView.requestAnimationFrame(callback);
                      return;
                    }
                    if ((0, runtime.sheetContainsTextInput)(value29)) {
                      value19.current ||
                        (value20(true),
                        value41(
                          defaultView.innerHeight *
                            runtime.SheetsLayoutConstant_2,
                          true,
                        ));
                      return;
                    }
                    let value56: Dynamic =
                        defaultView.innerHeight * runtime.SheetsLayoutConstant,
                      value57: Dynamic = (0, runtime.sheetNaturalHeight)(
                        value29,
                      );
                    flag = value57 > value56;
                    value41(Math.min(value57, value56), flag);
                  };
                  index = defaultView.requestAnimationFrame(callback);
                },
              );
            value55.observe(value29, {
              childList: true,
              subtree: true,
            });
            return (): Dynamic => {
              value55.disconnect();
              index !== 0 && defaultView.cancelAnimationFrame(index);
            };
          }, [value4, value5, value42, value29, value41, value40, value20]);
          let value43: Dynamic = value11?.height,
            value44: Dynamic = value11?.pinHeight;
          (0, runtime.useIsomorphicLayoutEffect)((): Dynamic => {
            let current: Dynamic = value13.current;
            !value4 ||
              value5 ||
              value43 !== undefined ||
              current === null ||
              ((0, runtime.clearSheetTransition)(current),
              value44?.(
                current.getBoundingClientRect().height,
                (0, runtime.sheetNeedsScrolling)(current),
              ));
          }, [value4, value5, value43, value44]);
          let value45: Dynamic = (0, runtime.useMenuPopupFocus)(
              value2?.triggerRef,
              props.finalFocus,
            ),
            value46: Dynamic = value3
              ? props.finalFocus === undefined || props.finalFocus === null
              : anchor != null &&
                value2 === null &&
                props.finalFocus === undefined,
            value47: Dynamic = (0, runtime.usePassiveOpenCell)(value2 === null);
          value47.root?.declareFocusProps(initialFocus, props.finalFocus);
          value2 !== null &&
            initialFocus !== undefined &&
            (0, runtime.warnNestedMenuInitialFocus)();
          let state: Dynamic = {
              ...props,
              onKeyDown: (input?: Dynamic): Dynamic => {
                props.onKeyDown?.(input);
                preventSheetTab(input);
              },
            },
            value48: Dynamic = (0, runtime.useEventRef)(
              (input?: Dynamic): Dynamic => {
                value10.popupRef(input);
                value31(input);
                value45(input);
                value47.root?.registerPopup(input);
              },
              options,
            ),
            value49: Dynamic = value4
              ? (0, runtime.getSheetFrameStyle)(value11, {
                  floor: value17 ? "half" : "content",
                  parentFrameHeight: value5 ? undefined : value27?.frameHeight,
                })
              : value10.held !== null
                ? {
                    pointerEvents: "auto",
                  }
                : undefined,
            value50: Dynamic =
              value49 === undefined
                ? style
                : typeof style == "function"
                  ? (input?: Dynamic): Dynamic => ({
                      ...style(input),
                      ...value49,
                    })
                  : {
                      ...style,
                      ...value49,
                    };
          value2 !== null &&
            layerOffset !== undefined &&
            (0, runtime.warnNestedMenuLayerOffset)();
          let value51: Dynamic = (0, runtime.useLayer)(
              value3 ? "contextmenu" : "menu",
              value2 === null ? layerOffset : undefined,
            ),
            value52: Dynamic = (0, runtime.useCdsWindow)(),
            value53: Dynamic = (0, runtime.sheetFrameHeight)(value11, value52),
            value54: Dynamic = (0, reactSheetsMenuPopup_3.useMemo)(
              (): Dynamic =>
                value4 && value28 !== null
                  ? {
                      depth: value26.depth,
                      frameHeight: value53,
                      cover: value28,
                    }
                  : null,
              [value4, value28, value26.depth, value53],
            );
          return (
            <runtime.npm_Menu_La.Portal container={container ?? value}>
              <runtime.PopupSurface
                {...value51.portalProps}
                surface={runtime.surfaceBackgroundTokens.popover}
                density={value4 ? runtime.ComfortableValue : undefined}
                companionModalCatcher={!value4}
                closeOnActivityHide={true}
              >
                {value4 && !value5 && (
                  <runtime.npm_Menu_La.Backdrop
                    data-presentation={"sheet"}
                    data-sheet-scrim={value11?.treeId}
                    className={
                      value26.depth > 0
                        ? "draggable-none fixed inset-0 bg-transparent"
                        : runtime.PlatformReducedMotionCss_4
                    }
                  />
                )}
                <runtime.CollisionPaddingProvider
                  override={value7}
                  container={container ?? value}
                  provideInherit={true}
                >
                  {(input?: Dynamic): Dynamic => (
                    <runtime.LayerBaseContext.Provider value={value51.base}>
                      <runtime.npm_Menu_La.Positioner
                        ref={value10.positionerRef}
                        data-sheet-tree={value4 ? value11?.treeId : undefined}
                        style={
                          value4
                            ? {
                                ...value51.style,
                                ...(0, runtime.getSheetFixedPosition)(value11),
                              }
                            : value10.held !== null
                              ? {
                                  ...value51.style,
                                  ...value10.held.positionerStyle,
                                }
                              : value51.style
                        }
                        side={value10.side}
                        align={value10.align}
                        sideOffset={value9}
                        collisionPadding={input}
                        collisionAvoidance={collisionAvoidance}
                        anchor={value8}
                        {...(value4
                          ? runtime.SheetsLayoutDisableAnchorTrackingCollisionAvoidanceConfig
                          : {})}
                        className={
                          value4
                            ? value5
                              ? runtime.ClipPathInset00200vh0Value
                              : value26.depth === 0
                                ? runtime.PlatformReducedMotionClassNames_3
                                : undefined
                            : value10.held?.positionerClassName
                        }
                      >
                        <runtime.PassiveOpenGate
                          cell={value4 ? null : value47.cell}
                          nested={value2 !== null}
                        >
                          {(input2?: Dynamic): Dynamic => (
                            <runtime.MenuPopupElement
                              anchoredWithoutFinalFocus={value46}
                              cursorAnchored={value3}
                              data-cds={dataCds}
                              data-presentation={value4 ? "sheet" : undefined}
                              data-sheet-tree={
                                value4 ? value11?.treeId : undefined
                              }
                              data-cds-sheet-depth={
                                value4 ? String(value26.depth) : undefined
                              }
                              {...(value32
                                ? {
                                    [runtime.coveredSheetAttribute]: "",
                                  }
                                : {})}
                              {...(value33 ? runtime.getInertPropsValue : {})}
                              {...(value5 && value11 !== null && !value11.open
                                ? {
                                    [runtime.CdsSheetTreeClosingAttribute]: "",
                                  }
                                : {})}
                              {...(value5 && value37 && !value12.open
                                ? {
                                    [runtime.CdsSheetPeelingAttribute]: "",
                                  }
                                : {})}
                              {...(value4
                                ? (0, runtime.getSizeAttribute)("lg")
                                : {})}
                              ref={value48}
                              {...input2(value4 ? state : props)}
                              style={value50}
                              className={(0, runtime.cn)(
                                runtime.MenuPopupCss,
                                value4 && runtime.PlatformReducedMotionCss_2,
                                value4 &&
                                  (value5
                                    ? "bg-transparent shadow-none [&[data-ending-style]:not([data-cds-sheet-tree-closing])]:translate-x-full rtl:[&[data-ending-style]:not([data-cds-sheet-tree-closing])]:-translate-x-full [&[data-ending-style][data-cds-sheet-peeling]]:translate-x-full rtl:[&[data-ending-style][data-cds-sheet-peeling]]:-translate-x-full [&[data-ending-style][data-cds-sheet-tree-closing]]:translate-y-[calc(100%+1.5rem)]"
                                    : "data-[starting-style]:translate-y-[calc(100%+1.5rem)] data-[ending-style]:translate-y-[calc(100%+1.5rem)]"),
                                value4 &&
                                  "origin-top [&[data-cds-sheet-covered]:not([data-starting-style]):not([data-ending-style])]:-translate-y-3 data-[cds-sheet-covered]:scale-[0.94] after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:bg-backdrop after:opacity-0 after:transition-opacity after:duration-sheet motion-reduce:after:transition-none data-[cds-sheet-covered]:after:opacity-100",
                                className,
                              )}
                            >
                              {value4 ? (
                                <runtime.SheetStackContext.Provider
                                  value={value54}
                                >
                                  <runtime.SheetHandle drawPill={!value5} />
                                  <div
                                    className={
                                      runtime.PlatformReducedMotionCss_3
                                    }
                                  >
                                    <runtime.PopupScrollArea
                                      header={header}
                                      headerClassName={
                                        runtime.PlatformReducedMotionLabel_2
                                      }
                                      footer={footer}
                                      fill={true}
                                    >
                                      {children}
                                      {!value5 && <SheetCloseButton />}
                                    </runtime.PopupScrollArea>
                                    <SheetBackButton nested={value5} />
                                  </div>
                                </runtime.SheetStackContext.Provider>
                              ) : (
                                <runtime.PopupScrollArea
                                  header={header}
                                  footer={footer}
                                  maxVisibleItems={maxVisibleItems}
                                >
                                  {children}
                                </runtime.PopupScrollArea>
                              )}
                            </runtime.MenuPopupElement>
                          )}
                        </runtime.PassiveOpenGate>
                      </runtime.npm_Menu_La.Positioner>
                    </runtime.LayerBaseContext.Provider>
                  )}
                </runtime.CollisionPaddingProvider>
              </runtime.PopupSurface>
            </runtime.npm_Menu_La.Portal>
          );
        },
      );
      MenuSheetPopup.displayName = "MenuSheetPopup";
    });
    initializeSheetsMenuPopup_5 = (0, runtime.initializeOnce)((): Dynamic => {
      "use client";

      (0, runtime.initializeClassNames)();
      (0, runtime.initializeSheetsPresentation)();
      (0, runtime.initializeSheetsPopupStack)();
      (0, runtime.initializePlatformReducedMotion_2)();
      jsxSheetsMenuPopup_2 = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react_jsx_runtime)(),
      );
      (0, runtime.initializeNpm__base_ui_react_pge)();
    });
    initializeSheetsMenuPopup_6 = (0, runtime.initializeOnce)((): Dynamic => {
      "use client";

      (0, runtime.initializePlatformReducedMotion_2)();
      jsxSheetsMenuPopup_3 = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react_jsx_runtime)(),
      );
      (0, runtime.initializeNpm__base_ui_react_wY)();
    });
  };
}
