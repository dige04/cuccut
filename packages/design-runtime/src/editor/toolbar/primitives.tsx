/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";
export function installEditorToolbarPrimitives(
  runtime: RuntimeBindings,
): () => void {
  var jsxToolbarPrimitives: Dynamic;
  var ToolbarPrimitivesContext: Dynamic;
  var ToolbarPrimitivesContext_2: Dynamic;
  var ToolbarPrimitivesCtrlControlAltConfig: Dynamic;
  var ToolbarPrimitivesControlCtrlOptionValues: Dynamic;
  var ToolbarPrimitivesEscEscapeEnterConfig: Dynamic;
  var ToolbarPrimitivesHandler: Dynamic;
  var ToolbarPrimitivesItems: Dynamic;
  var ToolbarPrimitivesComponent: Dynamic;
  var reactToolbarPrimitives: Dynamic;
  var ToolbarPrimitivesMediaQuery: Dynamic;
  var ToolbarPrimitivesLabel: Dynamic;
  function ToolbarCaret({ inherit: input = false }: Dynamic = {}): Dynamic {
    return (
      <runtime.Icon
        name={"CaretDown"}
        size={"xs"}
        className={(0, runtime.joinClassNames)(
          "-mx-0.5 shrink-0",
          !input && "text-fg-muted",
        )}
      />
    );
  }
  function toolbarItemTooltip(input?: Dynamic): Dynamic {
    return input.disabled
      ? {
          content: input.disabledTip ?? input.tip ?? input.label,
          shortcut: undefined,
        }
      : {
          content: input.tip ?? input.label,
          shortcut: input.shortcut,
        };
  }
  function useDisabledToolbarItem(input?: Dynamic): Dynamic {
    let value: Dynamic = (0, runtime.reactPlatformFrameHostBridge.useId)();
    if (!input.disabled)
      return {
        props: {},
        inner: {},
        mirror: null,
      };
    let value2: Dynamic = !!input.reason && input.reason !== input.name;
    return {
      props: {
        role: "button",
        "aria-disabled": true,
        "aria-label": input.name,
        "aria-describedby": value2 ? value : undefined,
        "aria-pressed": input.pressed,
        "aria-expanded": input.expanded,
        "aria-haspopup": input.hasPopup,
      },
      inner: {
        "aria-hidden": true,
      },
      mirror: value2 ? (
        <span hidden={true} id={value}>
          {input.reason}
        </span>
      ) : null,
    };
  }
  function useToolbarPress(input?: Dynamic, options?: Dynamic): Dynamic {
    let value: Dynamic = (0, runtime.reactPlatformFrameHostBridge.useRef)(
      options,
    );
    value.current = options;
    let value2: Dynamic = (0, runtime.reactPlatformFrameHostBridge.useRef)(
        undefined,
      ),
      value3: Dynamic = (0, runtime.reactPlatformFrameHostBridge.useRef)(false),
      current: Dynamic = (0, runtime.reactPlatformFrameHostBridge.useRef)(
        (event?: Dynamic): Dynamic => {
          let currentTarget: Dynamic = event.currentTarget;
          if (event.type === "pointerdown") value2.current = false;
          else if (event.type === "focusout") {
            let relatedTarget: Dynamic = event.relatedTarget;
            event.target === currentTarget &&
              relatedTarget instanceof Node &&
              relatedTarget.isConnected &&
              !currentTarget.contains(relatedTarget) &&
              (value3.current = false);
          } else {
            value2.current =
              event.target instanceof Element &&
              event.target.matches(":focus-visible");
            event.type === "focusin" &&
              event.target === currentTarget &&
              value.current &&
              (value3.current = value2.current);
          }
        },
      ).current,
      current2: Dynamic = (0, runtime.reactPlatformFrameHostBridge.useRef)(
        (): Dynamic => {
          value3.current = false;
        },
      ).current,
      value4: Dynamic = (0, runtime.reactPlatformFrameHostBridge.useRef)(null),
      callback: Dynamic = (element?: Dynamic): Dynamic => {
        let current3: Dynamic = value4.current;
        if (element === current3) return;
        let items: Dynamic = ["focusin", "focusout", "keydown", "pointerdown"];
        if (current3 !== null) {
          for (let value5 of items as Dynamic)
            current3.removeEventListener(value5, current);
          current3.ownerDocument.removeEventListener(
            "pointerdown",
            current2,
            true,
          );
        }
        value4.current = element;
        if (element !== null) {
          for (let value5 of items as Dynamic)
            element.addEventListener(value5, current);
          element.ownerDocument.addEventListener("pointerdown", current2, true);
        }
      };
    (0, runtime.reactPlatformFrameHostBridge.useLayoutEffect)(
      (): Dynamic => callback(input.current),
    );
    (0, runtime.reactPlatformFrameHostBridge.useLayoutEffect)(
      (): Dynamic => (): Dynamic => callback(null),
      [],
    );
    (0, runtime.reactPlatformFrameHostBridge.useLayoutEffect)((): Dynamic => {
      let current3: Dynamic = input.current;
      if (current3 === null) return;
      let ownerDocument: Dynamic = current3.ownerDocument,
        value5: Dynamic =
          ownerDocument.activeElement instanceof HTMLElement ||
          ownerDocument.activeElement instanceof SVGElement
            ? ownerDocument.activeElement
            : null,
        value6: Dynamic =
          value5 === null ||
          value5 === ownerDocument.body ||
          value5 === ownerDocument.documentElement;
      if (options)
        ownerDocument.hasFocus() &&
          !value6 &&
          value5 !== current3 &&
          current3.contains(value5) &&
          (value2.current ?? value5.matches(":focus-visible")) &&
          current3.focus({
            preventScroll: true,
          });
      else {
        let current4: Dynamic = value3.current;
        value3.current = false;
        current4 &&
          (value5 === current3 || (value6 && ownerDocument.hasFocus())) &&
          current3.querySelector("button")?.focus({
            preventScroll: true,
          });
      }
    }, [options]);
  }
  function formatToolbarShortcut(input?: Dynamic, options?: Dynamic): Dynamic {
    let value: Dynamic = input.trim().replace(/\s*\+\s*/g, "+");
    if (value === "" || /\s/.test(value)) return;
    let items: Dynamic = [],
      items2: Dynamic = [];
    for (let value2 of value.split("+") as Dynamic) {
      let value3: Dynamic = value2.toLowerCase();
      if (value3 === "") continue;
      let value4: Dynamic = ToolbarPrimitivesHandler(
        ToolbarPrimitivesCtrlControlAltConfig,
        value3,
      );
      if (value4 !== undefined) {
        let value6: Dynamic = value4[options ? 0 : 1];
        items.includes(value6) || items.push(value6);
        continue;
      }
      let value5: Dynamic = ToolbarPrimitivesHandler(
        ToolbarPrimitivesEscEscapeEnterConfig,
        value3,
      );
      items2.push(
        value5 !== undefined
          ? typeof value5 == "string"
            ? value5
            : value5[options ? 0 : 1]
          : value3.length === 1
            ? value3.toUpperCase()
            : value3.charAt(0).toUpperCase() + value3.slice(1),
      );
    }
    if (items2.length !== 0) {
      items.sort(
        (input2?: Dynamic, options2?: Dynamic): Dynamic =>
          ToolbarPrimitivesControlCtrlOptionValues.indexOf(input2) -
          ToolbarPrimitivesControlCtrlOptionValues.indexOf(options2),
      );
      return [...items, ...items2].join("+");
    }
  }
  function normalizeToolbarTooltip(
    input?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    let value: Dynamic = input;
    for (let [value2, value3, value4] of ToolbarPrimitivesItems as Dynamic)
      value = value.replace(value2, options ? value3 : value4);
    return value.replace(/ {2,}/g, " ").trim();
  }
  function useToolbarItemAccessibility(input?: Dynamic): Dynamic {
    let value: Dynamic = (0, runtime.reactPlatformFrameHostBridge.useId)(),
      value2: Dynamic = (0, runtime.useAppleKeyboard)(),
      value3: Dynamic = !input.disabled,
      value4: Dynamic = input.tip !== "" && !input.name.includes(input.tip),
      value5: Dynamic =
        value3 && input.shortcut !== undefined
          ? formatToolbarShortcut(input.shortcut, value2)
          : undefined,
      value6: Dynamic =
        value3 && input.shortcut !== undefined
          ? (0, runtime.parseSingleShortcut)(input.shortcut, value2)
          : undefined,
      value7: Dynamic =
        value3 && input.descriptionSuffix ? input.descriptionSuffix : undefined,
      value8: Dynamic =
        value3 && (value4 || value5 !== undefined || value7 !== undefined),
      value9: Dynamic =
        [input.describedBy, value8 ? value : undefined]
          .filter(Boolean)
          .join(" ") || undefined;
    if (!value8)
      return {
        describedBy: value9,
        keyShortcuts: value6,
        mirror: null,
      };
    let value10: Dynamic = [
        value4 ? normalizeToolbarTooltip(input.tip, value2) : undefined,
        value5 !== undefined ? "Shortcut: " + value5 : undefined,
      ]
        .filter(Boolean)
        .join(". "),
      value11: Dynamic =
        value7 === undefined
          ? value10
          : value10 === ""
            ? value7
            : value10 + (/[.!?]$/.test(value10) ? " " : ". ") + value7;
    return {
      describedBy: value9,
      keyShortcuts: value6,
      mirror: (
        <span hidden={true} id={value}>
          {value11}
        </span>
      ),
    };
  }
  bindRuntimeValue(
    runtime,
    "jsxToolbarPrimitives",
    () => jsxToolbarPrimitives,
    (value) => {
      jsxToolbarPrimitives = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ToolbarPrimitivesContext",
    () => ToolbarPrimitivesContext,
    (value) => {
      ToolbarPrimitivesContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ToolbarPrimitivesContext_2",
    () => ToolbarPrimitivesContext_2,
    (value) => {
      ToolbarPrimitivesContext_2 = value;
    },
  );
  bindRuntimeValue(runtime, "ToolbarCaret", () => ToolbarCaret);
  bindRuntimeValue(runtime, "toolbarItemTooltip", () => toolbarItemTooltip);
  bindRuntimeValue(
    runtime,
    "useDisabledToolbarItem",
    () => useDisabledToolbarItem,
  );
  bindRuntimeValue(runtime, "useToolbarPress", () => useToolbarPress);
  bindRuntimeValue(
    runtime,
    "ToolbarPrimitivesCtrlControlAltConfig",
    () => ToolbarPrimitivesCtrlControlAltConfig,
    (value) => {
      ToolbarPrimitivesCtrlControlAltConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ToolbarPrimitivesControlCtrlOptionValues",
    () => ToolbarPrimitivesControlCtrlOptionValues,
    (value) => {
      ToolbarPrimitivesControlCtrlOptionValues = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ToolbarPrimitivesEscEscapeEnterConfig",
    () => ToolbarPrimitivesEscEscapeEnterConfig,
    (value) => {
      ToolbarPrimitivesEscEscapeEnterConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ToolbarPrimitivesHandler",
    () => ToolbarPrimitivesHandler,
    (value) => {
      ToolbarPrimitivesHandler = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "formatToolbarShortcut",
    () => formatToolbarShortcut,
  );
  bindRuntimeValue(
    runtime,
    "ToolbarPrimitivesItems",
    () => ToolbarPrimitivesItems,
    (value) => {
      ToolbarPrimitivesItems = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "normalizeToolbarTooltip",
    () => normalizeToolbarTooltip,
  );
  bindRuntimeValue(
    runtime,
    "useToolbarItemAccessibility",
    () => useToolbarItemAccessibility,
  );
  bindRuntimeValue(
    runtime,
    "ToolbarPrimitivesComponent",
    () => ToolbarPrimitivesComponent,
    (value) => {
      ToolbarPrimitivesComponent = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactToolbarPrimitives",
    () => reactToolbarPrimitives,
    (value) => {
      reactToolbarPrimitives = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ToolbarPrimitivesMediaQuery",
    () => ToolbarPrimitivesMediaQuery,
    (value) => {
      ToolbarPrimitivesMediaQuery = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ToolbarPrimitivesLabel",
    () => ToolbarPrimitivesLabel,
    (value) => {
      ToolbarPrimitivesLabel = value;
    },
  );
  return () => {
    jsxToolbarPrimitives = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_jsx_runtime)(),
      1,
    );
    ToolbarPrimitivesContext = (0,
    runtime.reactPlatformFrameHostBridge.createContext)(false);
    ToolbarPrimitivesContext_2 = (0,
    runtime.reactPlatformFrameHostBridge.createContext)(false);
    ToolbarPrimitivesCtrlControlAltConfig = {
      ctrl: ["Control", "Ctrl"],
      control: ["Control", "Ctrl"],
      alt: ["Option", "Alt"],
      option: ["Option", "Alt"],
      shift: ["Shift", "Shift"],
      cmd: ["Command", "Ctrl"],
      command: ["Command", "Ctrl"],
      meta: ["Command", "Ctrl"],
    };
    ToolbarPrimitivesControlCtrlOptionValues = [
      "Control",
      "Ctrl",
      "Option",
      "Alt",
      "Shift",
      "Command",
    ];
    ToolbarPrimitivesEscEscapeEnterConfig = {
      esc: "Escape",
      escape: "Escape",
      enter: ["Return", "Enter"],
      return: ["Return", "Enter"],
      delete: ["Delete", "Backspace"],
      backspace: ["Delete", "Backspace"],
      space: "Space",
      tab: "Tab",
      up: "Up Arrow",
      down: "Down Arrow",
      left: "Left Arrow",
      right: "Right Arrow",
      pageup: "Page Up",
      pagedown: "Page Down",
      "\\": "Backslash",
      "/": "Slash",
      "-": "Minus",
      "=": "Equals",
      ",": "Comma",
      ".": "Period",
      ";": "Semicolon",
      "'": "Apostrophe",
      "`": "Backtick",
      "[": "Left Bracket",
      "]": "Right Bracket",
    };
    ToolbarPrimitivesHandler = (input?: Dynamic, options?: Dynamic): Dynamic =>
      Object.hasOwn(input, options) ? input[options] : undefined;
    ToolbarPrimitivesItems = [
      [/⌘/g, "Command ", "Ctrl "],
      [/⇧/g, "Shift ", "Shift "],
      [/⌥/g, "Option ", "Alt "],
      [/⌃/g, "Control ", "Ctrl "],
      [/⏎/g, "Return", "Enter"],
      [/⌫/g, "Delete", "Backspace"],
    ];
    ToolbarPrimitivesComponent = (0,
    runtime.reactPlatformFrameHostBridge.forwardRef)(function (
      {
        icon: icon,
        glyph: glyph,
        label: label,
        tip: tip,
        disabledTip: disabledTip,
        shortcut: shortcut,
        descriptionSuffix: descriptionSuffix,
        children: children,
        pressed: pressed,
        expanded: expanded,
        count: count,
        iconOnly: iconOnly,
        caret: caret,
        tipSide = "bottom",
        className: className,
        variant = "ghost",
        "aria-expanded": ariaExpanded,
        "aria-describedby": ariaDescribedby,
        ...props
      }: Dynamic,
      options?: Dynamic,
    ): Dynamic {
      let value: Dynamic = (0, runtime.reactPlatformFrameHostBridge.useContext)(
          ToolbarPrimitivesContext,
        ),
        value2: Dynamic = props.disabled === true,
        value3: Dynamic = count ? label + " (" + String(count) + ")" : label,
        value4: Dynamic = icon ?? glyph,
        value5: Dynamic = toolbarItemTooltip({
          label: label,
          tip: tip,
          disabledTip: disabledTip,
          shortcut: shortcut,
          disabled: value2,
        }),
        value6: Dynamic = useToolbarItemAccessibility({
          disabled: value2,
          name: value3,
          tip: value5.content,
          shortcut: value5.shortcut,
          describedBy: ariaDescribedby,
          descriptionSuffix: descriptionSuffix,
        }),
        value7: Dynamic = useDisabledToolbarItem({
          disabled: value2,
          name: value3,
          reason: disabledTip ?? tip,
          pressed: pressed,
          expanded: expanded ?? ariaExpanded,
          hasPopup: props["aria-haspopup"],
        }),
        value8: Dynamic = (0, runtime.reactPlatformFrameHostBridge.useRef)(
          null,
        );
      useToolbarPress(value8, value2);
      let state: Dynamic = {
          ...props,
          ref: options,
          variant: variant,
          pressed: pressed,
          "aria-expanded": expanded ?? ariaExpanded,
          "aria-label": value3,
          "aria-describedby": value6.describedBy,
          "aria-keyshortcuts":
            props["aria-keyshortcuts"] ?? value6.keyShortcuts,
          ...value7.inner,
        },
        value9: Dynamic = iconOnly === true || (value && variant !== "primary"),
        value10: Dynamic = value9 && caret !== true;
      return (
        <runtime.Tooltip
          content={value5.content}
          shortcut={value5.shortcut}
          side={tipSide}
          hoverable={false}
        >
          <span
            ref={value8}
            tabIndex={value2 ? 0 : -1}
            {...value7.props}
            data-tb-icon={value10 ? "" : undefined}
            className={(0, runtime.joinClassNames)(
              "relative inline-flex shrink-0 rounded align-top outline-none focus-visible:outline-hidden focus-visible:shadow-focus",
              className,
            )}
          >
            {value9 ? (
              caret === true ? (
                <runtime.Button {...state} icon={value4}>
                  <ToolbarCaret />
                </runtime.Button>
              ) : (
                <runtime.Button
                  {...state}
                  iconOnly={true}
                  icon={value4}
                  tooltip={false}
                />
              )
            ) : (
              <runtime.Button {...state} icon={value4}>
                {label}
                {children}
                {caret === true ? (
                  <ToolbarCaret inherit={variant === "primary"} />
                ) : null}
              </runtime.Button>
            )}
            {count ? (
              <span
                aria-hidden={"true"}
                className={
                  "pointer-events-none absolute -top-0.5 -right-0.5 flex"
                }
              >
                <runtime.Counter value={count} variant={"accent"} size={"xs"} />
              </span>
            ) : null}
            {value6.mirror}
            {value7.mirror}
          </span>
        </runtime.Tooltip>
      );
    });
    reactToolbarPrimitives = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react)(),
      1,
    );
    ToolbarPrimitivesMediaQuery = "(pointer: coarse)";
    ToolbarPrimitivesLabel = "(pointer: coarse) and (max-width: 599px)";
  };
}
