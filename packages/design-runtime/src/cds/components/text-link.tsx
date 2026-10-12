/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";
export function installCdsComponentsTextLink(
  runtime: RuntimeBindings,
): () => void {
  var reactComponentsTextLink: Dynamic;
  var jsxComponentsTextLink: Dynamic;
  var ComponentsTextLinkClassNames: Dynamic;
  var ComponentsTextLinkClassNames_2: Dynamic;
  var ComponentsTextLinkCss: Dynamic;
  var ComponentsTextLinkClassNames_3: Dynamic;
  var ComponentsTextLinkClassNames_4: Dynamic;
  var ComponentsTextLinkCss_2: Dynamic;
  var ComponentsTextLinkClassNamesAlias: Dynamic;
  var TextLink: Dynamic;
  var initializeComponentsTextLink: Dynamic;
  var reactComponentsTextLink_2: Dynamic;
  var ComponentsTextLinkConstant: Dynamic;
  var ComponentsTextLinkCss_3: Dynamic;
  var ComponentsTextLinkLimit: Dynamic;
  var ComponentsTextLinkTopMaxHeightMinHeightValues: Dynamic;
  var ComponentsTextLinkBottomInsetTranslateValues: Dynamic;
  var ComponentsTextLinkTopValues: Dynamic;
  var initializeComponentsTextLink_2: Dynamic;
  function readStyleProperty(input?: Dynamic, options?: Dynamic): Dynamic {
    return {
      value: input.getPropertyValue(options),
      priority: input.getPropertyPriority(options),
    };
  }
  function isOwnedImportantStyle(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    return (
      context !== undefined &&
      input.getPropertyPriority(options) === "important" &&
      input.getPropertyValue(options) === context
    );
  }
  function restoreOwnedDialogStyles(input?: Dynamic): Dynamic {
    let style: Dynamic = input.node.style;
    for (let value of ComponentsTextLinkTopMaxHeightMinHeightValues as Dynamic)
      if (isOwnedImportantStyle(style, value, input.written[value])) {
        let { value: value2, priority: value3 }: Dynamic =
          input.baseline[value];
        style.setProperty(value, value2, value3);
      }
  }
  function useDialogKeyboardViewport(input?: Dynamic): Dynamic {
    let [value, value2]: Dynamic = (0, reactComponentsTextLink_2.useState)(
        null,
      ),
      [value3, value4]: Dynamic = (0, reactComponentsTextLink_2.useState)(null),
      value5: Dynamic = (0, reactComponentsTextLink_2.useCallback)(
        (input2?: Dynamic): Dynamic =>
          !input || value === null
            ? (): Dynamic => {}
            : (value.addEventListener("focusin", input2),
              value.addEventListener("focusout", input2),
              (): Dynamic => {
                value.removeEventListener("focusin", input2);
                value.removeEventListener("focusout", input2);
              }),
        [input, value],
      ),
      value6: Dynamic = (0,
      reactComponentsTextLink_2.useCallback)((): Dynamic => {
        if (!input || value === null) return false;
        let activeElement: Dynamic = value.ownerDocument.activeElement;
        return (
          value.contains(activeElement) &&
          (0, runtime.isTextInputElement)(activeElement)
        );
      }, [input, value]),
      value7: Dynamic = (0, reactComponentsTextLink_2.useSyncExternalStore)(
        value5,
        value6,
        (): Dynamic => false,
      );
    (0, runtime.useKeyboardViewport)(
      input && (value7 || value3 !== null),
      value4,
    );
    let value8: Dynamic = (0, reactComponentsTextLink_2.useMemo)(
        (): Dynamic => dialogKeyboardFrame(value3),
        [value3],
      ),
      value9: Dynamic = (0, reactComponentsTextLink_2.useRef)(null);
    (0, runtime.useIsomorphicLayoutEffect)((): Dynamic => {
      let current: Dynamic = value9.current;
      current !== null &&
        (current.node !== value || value8 === undefined) &&
        (restoreOwnedDialogStyles(current), (value9.current = null));
      if (value === null || value8 === undefined) return;
      let style: Dynamic = value.style,
        state: Dynamic = {
          top: value8.top,
          "max-height": value8.maxHeight,
          "min-height": "0px",
        },
        current2: Dynamic = value9.current;
      if (current2 === null) {
        if (
          ComponentsTextLinkTopValues.some(
            (input2?: Dynamic): Dynamic =>
              style.getPropertyValue(input2) !== "",
          )
        )
          return;
        current2 = {
          node: value,
          baseline: {
            top: readStyleProperty(style, "top"),
            "max-height": readStyleProperty(style, "max-height"),
            "min-height": readStyleProperty(style, "min-height"),
          },
          intended: {},
          written: {},
          cap: "",
        };
        value9.current = current2;
      } else {
        let value10: Dynamic =
          ComponentsTextLinkBottomInsetTranslateValues.some(
            (input2?: Dynamic): Dynamic =>
              style.getPropertyValue(input2) !== "",
          );
        for (let value11 of ComponentsTextLinkTopMaxHeightMinHeightValues as Dynamic)
          if (
            !isOwnedImportantStyle(style, value11, current2.written[value11])
          ) {
            let value12: Dynamic = readStyleProperty(style, value11);
            current2.baseline[value11] = value12;
            value11 === "top" && value12.value !== "" && (value10 = true);
          }
        if (value10) {
          restoreOwnedDialogStyles(current2);
          value9.current = null;
          return;
        }
      }
      for (let value10 of ComponentsTextLinkTopMaxHeightMinHeightValues as Dynamic)
        (current2.intended[value10] !== state[value10] ||
          !isOwnedImportantStyle(style, value10, current2.written[value10])) &&
          (style.setProperty(value10, state[value10], "important"),
          (current2.intended[value10] = state[value10]),
          (current2.written[value10] = style.getPropertyValue(value10)));
      if (current2.cap !== value8.maxHeight) {
        current2.cap = value8.maxHeight;
        let activeElement: Dynamic = value.ownerDocument.activeElement,
          defaultView: Dynamic = value.ownerDocument.defaultView;
        defaultView !== null &&
          activeElement instanceof defaultView.HTMLElement &&
          activeElement !== value &&
          value.contains(activeElement) &&
          scrollDialogInputIntoView(value, activeElement);
      }
    });
    (0, runtime.useIsomorphicLayoutEffect)(
      (): Dynamic => (): Dynamic => {
        value9.current !== null &&
          (restoreOwnedDialogStyles(value9.current), (value9.current = null));
      },
      [],
    );
    return value2;
  }
  function dialogKeyboardFrame(input?: Dynamic): Dynamic {
    if (!(input === null || input.visible < ComponentsTextLinkLimit))
      return {
        top: `calc(${input.offset + (input.visible + ComponentsTextLinkConstant) / 2}px - ${ComponentsTextLinkCss_3} / 2)`,
        maxHeight: `calc(${input.visible - ComponentsTextLinkConstant}px - ${ComponentsTextLinkCss_3})`,
      };
  }
  function scrollDialogInputIntoView(
    element?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    let defaultView: Dynamic = element.ownerDocument.defaultView;
    if (defaultView !== null)
      for (
        let parentElement: Dynamic = options.parentElement;
        parentElement !== null;
        parentElement =
          parentElement === element ? null : parentElement.parentElement
      ) {
        if (parentElement.scrollHeight <= parentElement.clientHeight) continue;
        let { overflowY: style }: Dynamic =
          defaultView.getComputedStyle(parentElement);
        if (style !== "auto" && style !== "scroll") continue;
        let bounds: Dynamic = parentElement.getBoundingClientRect(),
          bounds2: Dynamic = options.getBoundingClientRect();
        bounds2.bottom > bounds.bottom
          ? (parentElement.scrollTop +=
              bounds2.bottom - bounds.bottom + ComponentsTextLinkConstant)
          : bounds2.top < bounds.top &&
            (parentElement.scrollTop -=
              bounds.top - bounds2.top + ComponentsTextLinkConstant);
      }
  }
  function preventDialogMouseSelection(event?: Dynamic): Dynamic {
    event.preventDefault();
  }
  function preserveDialogFocus(event?: Dynamic): Dynamic {
    if (event.button !== 0) {
      event.preventDefault();
      return;
    }
    let currentTarget: Dynamic = event.currentTarget,
      parentElement: Dynamic = currentTarget.parentElement,
      ownerDocument: Dynamic = currentTarget.ownerDocument,
      value: Dynamic = (0, runtime.asElement)(ownerDocument.activeElement);
    if (
      parentElement === null ||
      value === null ||
      !parentElement.contains(value)
    )
      return;
    runtime.DialogDialogCurrentState?.abort();
    let value2: Dynamic = new (ownerDocument.defaultView?.AbortController ??
      AbortController)();
    runtime.DialogDialogCurrentState = value2;
    let { signal: value3 }: Dynamic = value2;
    value3.addEventListener(
      "abort",
      (): Dynamic => {
        runtime.DialogDialogCurrentState === value2 &&
          (runtime.DialogDialogCurrentState = null);
      },
      {
        once: true,
      },
    );
    ownerDocument.addEventListener("mousedown", (): Dynamic => value2.abort(), {
      capture: true,
      once: true,
      signal: value3,
    });
    ownerDocument.addEventListener(
      "mouseup",
      (event2?: Dynamic): Dynamic => {
        value2.abort();
        event2.target !== currentTarget &&
          ownerDocument.activeElement === ownerDocument.body &&
          value.isConnected &&
          value.focus({
            preventScroll: true,
          });
      },
      {
        capture: true,
        once: true,
        signal: value3,
      },
    );
  }
  bindRuntimeValue(
    runtime,
    "reactComponentsTextLink",
    () => reactComponentsTextLink,
    (value) => {
      reactComponentsTextLink = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxComponentsTextLink",
    () => jsxComponentsTextLink,
    (value) => {
      jsxComponentsTextLink = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsTextLinkClassNames",
    () => ComponentsTextLinkClassNames,
    (value) => {
      ComponentsTextLinkClassNames = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsTextLinkClassNames_2",
    () => ComponentsTextLinkClassNames_2,
    (value) => {
      ComponentsTextLinkClassNames_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsTextLinkCss",
    () => ComponentsTextLinkCss,
    (value) => {
      ComponentsTextLinkCss = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsTextLinkClassNames_3",
    () => ComponentsTextLinkClassNames_3,
    (value) => {
      ComponentsTextLinkClassNames_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsTextLinkClassNames_4",
    () => ComponentsTextLinkClassNames_4,
    (value) => {
      ComponentsTextLinkClassNames_4 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsTextLinkCss_2",
    () => ComponentsTextLinkCss_2,
    (value) => {
      ComponentsTextLinkCss_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsTextLinkClassNamesAlias",
    () => ComponentsTextLinkClassNamesAlias,
    (value) => {
      ComponentsTextLinkClassNamesAlias = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TextLink",
    () => TextLink,
    (value) => {
      TextLink = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeComponentsTextLink",
    () => initializeComponentsTextLink,
    (value) => {
      initializeComponentsTextLink = value;
    },
  );
  bindRuntimeValue(runtime, "readStyleProperty", () => readStyleProperty);
  bindRuntimeValue(
    runtime,
    "isOwnedImportantStyle",
    () => isOwnedImportantStyle,
  );
  bindRuntimeValue(
    runtime,
    "restoreOwnedDialogStyles",
    () => restoreOwnedDialogStyles,
  );
  bindRuntimeValue(
    runtime,
    "useDialogKeyboardViewport",
    () => useDialogKeyboardViewport,
  );
  bindRuntimeValue(runtime, "dialogKeyboardFrame", () => dialogKeyboardFrame);
  bindRuntimeValue(
    runtime,
    "scrollDialogInputIntoView",
    () => scrollDialogInputIntoView,
  );
  bindRuntimeValue(
    runtime,
    "reactComponentsTextLink_2",
    () => reactComponentsTextLink_2,
    (value) => {
      reactComponentsTextLink_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsTextLinkConstant",
    () => ComponentsTextLinkConstant,
    (value) => {
      ComponentsTextLinkConstant = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsTextLinkCss_3",
    () => ComponentsTextLinkCss_3,
    (value) => {
      ComponentsTextLinkCss_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsTextLinkLimit",
    () => ComponentsTextLinkLimit,
    (value) => {
      ComponentsTextLinkLimit = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsTextLinkTopMaxHeightMinHeightValues",
    () => ComponentsTextLinkTopMaxHeightMinHeightValues,
    (value) => {
      ComponentsTextLinkTopMaxHeightMinHeightValues = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsTextLinkBottomInsetTranslateValues",
    () => ComponentsTextLinkBottomInsetTranslateValues,
    (value) => {
      ComponentsTextLinkBottomInsetTranslateValues = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsTextLinkTopValues",
    () => ComponentsTextLinkTopValues,
    (value) => {
      ComponentsTextLinkTopValues = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeComponentsTextLink_2",
    () => initializeComponentsTextLink_2,
    (value) => {
      initializeComponentsTextLink_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "preventDialogMouseSelection",
    () => preventDialogMouseSelection,
  );
  bindRuntimeValue(runtime, "preserveDialogFocus", () => preserveDialogFocus);
  return () => {
    initializeComponentsTextLink = (0, runtime.initializeOnce)((): Dynamic => {
      "use client";

      (0, runtime.initializeClassNames)();
      (0, runtime.initializeSheetsStyles_2)();
      (0, runtime.initializeCdsLinks)();
      (0, runtime.initializeCdsLinks_2)();
      (0, runtime.initializeLinkRouter)();
      (0, runtime.initializeDomRefComposition_5)();
      (0, runtime.initializeComponentsIcon_2)();
      (0, runtime.initializeComponentsCounter_6)();
      reactComponentsTextLink = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react)(),
      );
      (0, runtime.initializeNpm_clsx_xh)();
      jsxComponentsTextLink = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react_jsx_runtime)(),
      );
      ComponentsTextLinkClassNames = "cds-reset cds-text-link";
      ComponentsTextLinkClassNames_2 = "cds-text-link-underline";
      ComponentsTextLinkCss = `${ComponentsTextLinkClassNames} ${ComponentsTextLinkClassNames_2} inline`;
      ComponentsTextLinkClassNames_3 =
        "text-inherit [transition-property:text-decoration-color,box-shadow]";
      ComponentsTextLinkClassNames_4 =
        "[transition-property:text-decoration-color]";
      ComponentsTextLinkCss_2 = `${ComponentsTextLinkClassNames} inline-flex items-baseline`;
      ComponentsTextLinkClassNamesAlias = ComponentsTextLinkClassNames_2;
      TextLink = (0, reactComponentsTextLink.forwardRef)(
        (
          {
            className: className,
            children: children,
            icon: icon,
            iconPosition = "end",
            external: external,
            inheritColor: inheritColor,
            render: render,
            "aria-describedby": ariaDescribedby,
            ...props
          }: Dynamic,
          options?: Dynamic,
        ): Dynamic => {
          let value: Dynamic = "href" in props && props.href !== undefined,
            value2: Dynamic = (0, reactComponentsTextLink.useContext)(
              runtime.DisabledContext,
            ),
            value3: Dynamic = inheritColor ?? value2,
            value4: Dynamic =
              external &&
              !(
                value &&
                !(0, reactComponentsTextLink.isValidElement)(render) &&
                (0, runtime.isBlockedHref)(
                  props.href,
                  (0, runtime.sanitizeHref)(props.href),
                )
              )
                ? external
                : false,
            value5: Dynamic = value
              ? (props.target ?? (value4 ? "_blank" : undefined))
              : undefined,
            value6: Dynamic = value
              ? (props.rel ??
                (value4 &&
                value5 !== undefined &&
                !(0, runtime.isNewBrowsingContext)(value5)
                  ? (0, runtime.getLinkRel)(props.href, value5)
                  : undefined))
              : undefined,
            value7: Dynamic = (0, reactComponentsTextLink.useId)(),
            value8: Dynamic = (
              <span id={value7} hidden={true} className={"sr-only"}>
                {(0, runtime.useLabel)("opensInNewTab", "(opens in new tab)")}
              </span>
            ),
            value9: Dynamic =
              icon || (value4 === "with-icon" ? "ArrowUpRight" : undefined),
            value10: Dynamic = !!value9,
            value11: Dynamic = `${(0, runtime.cn)(value10 ? (0, runtime.npm_clsx_Ea)(ComponentsTextLinkCss_2, icon ? "gap-[0.25em]" : "gap-0") : ComponentsTextLinkCss, value3 && ComponentsTextLinkClassNames_3)}`,
            value12: Dynamic = value10 ? (
              <jsxComponentsTextLink.Fragment>
                {iconPosition === "start" && (0, runtime.TextLinkIcon)(value9)}
                <span
                  className={(0, runtime.npm_clsx_Ea)(
                    ComponentsTextLinkClassNamesAlias,
                    value3 && ComponentsTextLinkClassNames_4,
                  )}
                >
                  {children}
                </span>
                {iconPosition === "end" && (0, runtime.TextLinkIcon)(value9)}
                {value4 && value8}
              </jsxComponentsTextLink.Fragment>
            ) : value4 ? (
              <jsxComponentsTextLink.Fragment>
                {children}
                {value8}
              </jsxComponentsTextLink.Fragment>
            ) : (
              children
            ),
            value13: Dynamic = (0, runtime.cn)(
              value11,
              "cursor-pointer",
              className,
            ),
            value14: Dynamic = props.disabled ?? false;
          return (
            <runtime.LinkElement
              stamp={{
                "data-cds": "TextLink",
              }}
              forwardedRef={options}
              linkInput={{
                href: value ? props.href : undefined,
                routerOptions: value ? props.routerOptions : undefined,
                target: value5,
                rel: value6,
                download: value ? props.download : undefined,
              }}
              render={render}
              body={value12}
              className={value13}
              actionClassName={(0, runtime.cn)(
                value11,
                value14 ? "cursor-default opacity-disabled" : "cursor-pointer",
                className,
              )}
              actionDisabled={value14}
              rest={{
                ...props,
                ...(value3 && {
                  "data-inherit-color": "",
                }),
                "aria-describedby":
                  [ariaDescribedby, value4 ? value7 : undefined]
                    .filter(Boolean)
                    .join(" ") || undefined,
              }}
            />
          );
        },
      );
      TextLink.displayName = "TextLink";
    });
    initializeComponentsTextLink_2 = (0, runtime.initializeOnce)(
      (): Dynamic => {
        "use client";

        (0, runtime.initializeHooksLayoutEffect)();
        (0, runtime.initializeSheetsKeyboardViewport)();
        reactComponentsTextLink_2 = (0, runtime.toModuleNamespace)(
          (0, runtime.load_react)(),
        );
        ComponentsTextLinkConstant = 8;
        ComponentsTextLinkCss_3 = `max(${ComponentsTextLinkConstant}px, env(safe-area-inset-bottom, 0px))`;
        ComponentsTextLinkLimit = 240;
        ComponentsTextLinkTopMaxHeightMinHeightValues = [
          "top",
          "max-height",
          "min-height",
        ];
        ComponentsTextLinkBottomInsetTranslateValues = [
          "bottom",
          "inset",
          "translate",
          "transform",
        ];
        ComponentsTextLinkTopValues = [
          "top",
          ...ComponentsTextLinkBottomInsetTranslateValues,
        ];
      },
    );
  };
}
