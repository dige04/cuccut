/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";
export function installCdsComponentsShortcut(
  runtime: RuntimeBindings,
): () => void {
  var reactComponentsShortcut: Dynamic;
  var jsxComponentsShortcut: Dynamic;
  var ComponentsShortcutClassNames: Dynamic;
  var ComponentsShortcutClassNames_2: Dynamic;
  var ComponentsShortcutClassNames_3: Dynamic;
  var ComponentsShortcutLabel: Dynamic;
  var ComponentsShortcutKeycapTextConfig: Dynamic;
  var ThenValue: Dynamic;
  var Value: Dynamic;
  var ComponentsShortcutIphoneIpadPattern: Dynamic;
  var ComponentsShortcutHandler: Dynamic;
  var ComponentsShortcutCmdCommandMetaValues: Dynamic;
  var ComponentsShortcutIncludes: Dynamic;
  var ComponentsShortcutCtrlControlAltValues: Dynamic;
  var ComponentsShortcutCtrlControlAltConfig: Dynamic;
  var ComponentsShortcutCtrlControlAltConfig_2: Dynamic;
  var ComponentsShortcutSpaceEnterReturnConfig: Dynamic;
  var ComponentsShortcutSpaceEnterReturnConfig_2: Dynamic;
  var ComponentsShortcutCmdCommandMetaConfig: Dynamic;
  var ComponentsShortcutCtrlControlAltConfig_3: Dynamic;
  var initializeComponentsShortcut: Dynamic;
  function shortcutKeycapClassName(input?: Dynamic): Dynamic {
    return `${ComponentsShortcutClassNames} ${Array.from(input ?? "").length === 1 ? ComponentsShortcutClassNames_2 : ComponentsShortcutClassNames_3}`;
  }
  function Shortcut({
    keys: keys,
    variant = "keycap",
    onFill = false,
    className: className,
    ...props
  }: Dynamic): Dynamic {
    let value: Dynamic = useAppleKeyboard(),
      value2: Dynamic = splitShortcutChords(keys).map(
        (input?: Dynamic): Dynamic => formatShortcutChord(input, value),
      ),
      value3: Dynamic = variant === "text" && !value;
    return (
      <span
        {...props}
        data-cds={"Shortcut"}
        data-variant={variant}
        className={(0, runtime.cn)(
          ComponentsShortcutKeycapTextConfig[variant],
          onFill && "[--cds-shortcut-cap-ink:currentColor]",
          className,
        )}
      >
        {value2.map(
          (input?: Dynamic, options?: Dynamic): Dynamic => (
            <reactComponentsShortcut.Fragment key={options}>
              {options > 0 && (
                <span
                  className={"px-[2px] [color:var(--cds-shortcut-cap-ink)]"}
                >
                  {ThenValue}
                </span>
              )}
              {input.map(
                (
                  { label: label, spoken: spoken }: Dynamic,
                  options2?: Dynamic,
                ): Dynamic => (
                  <reactComponentsShortcut.Fragment key={options2}>
                    {value3 && options2 > 0 && (
                      <span
                        className={
                          "mx-[-0.3em] [color:var(--cds-shortcut-cap-ink)]"
                        }
                      >
                        {Value}
                      </span>
                    )}
                    <kbd
                      className={
                        variant === "text"
                          ? ComponentsShortcutLabel
                          : shortcutKeycapClassName(label)
                      }
                    >
                      {spoken === undefined ? (
                        label
                      ) : value3 ? (
                        spoken
                      ) : (
                        <jsxComponentsShortcut.Fragment>
                          <span aria-hidden={"true"}>{label}</span>
                          <span className={"sr-only select-none"}>
                            {spoken}
                          </span>
                        </jsxComponentsShortcut.Fragment>
                      )}
                    </kbd>
                  </reactComponentsShortcut.Fragment>
                ),
              )}
            </reactComponentsShortcut.Fragment>
          ),
        )}
      </span>
    );
  }
  function useAppleKeyboard(): Dynamic {
    return (0, reactComponentsShortcut.useSyncExternalStore)(
      ComponentsShortcutHandler,
      (): Dynamic =>
        ComponentsShortcutIphoneIpadPattern.test(navigator.userAgent),
      (): Dynamic => false,
    );
  }
  function getOwnPropertyValue(input?: Dynamic, options?: Dynamic): Dynamic {
    return Object.hasOwn(input, options) ? input[options] : undefined;
  }
  function getShortcutKeyLabel(items?: Dynamic, options?: Dynamic): Dynamic {
    let value: Dynamic = getOwnPropertyValue(
      options
        ? ComponentsShortcutSpaceEnterReturnConfig
        : ComponentsShortcutSpaceEnterReturnConfig_2,
      items,
    );
    return value !== undefined
      ? value
      : /^f\d+$/.test(items) || items.length === 1
        ? items.toUpperCase()
        : items.charAt(0).toUpperCase() + items.slice(1);
  }
  function splitShortcutChords(input?: Dynamic): Dynamic {
    let value: Dynamic = input.trim().replace(/\s*\+\s*/g, "+");
    return value ? value.split(/\s+/) : [];
  }
  function parseShortcutChord(input?: Dynamic, options?: Dynamic): Dynamic {
    let value: Dynamic = input
        .toLowerCase()
        .split("+")
        .map((input2?: Dynamic): Dynamic => input2.trim())
        .filter((input2?: Dynamic): Dynamic => input2 !== ""),
      items: Dynamic = [],
      items2: Dynamic = [];
    for (let value2 of value as Dynamic)
      ComponentsShortcutIncludes(value2)
        ? items.push(value2)
        : items2.push(value2);
    let callback: Dynamic = (input2?: Dynamic): Dynamic =>
      ComponentsShortcutCtrlControlAltValues.indexOf(
        !options &&
          (input2 === "cmd" || input2 === "command" || input2 === "meta")
          ? "ctrl"
          : input2,
      );
    items.sort(
      (input2?: Dynamic, options2?: Dynamic): Dynamic =>
        callback(input2) - callback(options2),
    );
    return {
      modifiers: items,
      keys: items2,
    };
  }
  function formatShortcutChord(input?: Dynamic, options?: Dynamic): Dynamic {
    let { modifiers: value, keys: value2 }: Dynamic = parseShortcutChord(
        input,
        options,
      ),
      value3: Dynamic = options
        ? ComponentsShortcutCtrlControlAltConfig
        : ComponentsShortcutCtrlControlAltConfig_2,
      callback: Dynamic = (input2?: Dynamic, options2?: Dynamic): Dynamic => {
        if (/^[A-Za-z0-9 ]+$/.test(options2))
          return {
            label: options2,
          };
        let value4: Dynamic = getOwnPropertyValue(
          ComponentsShortcutCmdCommandMetaConfig,
          input2,
        );
        return value4 === undefined
          ? {
              label: options2,
            }
          : {
              label: options2,
              spoken: value4,
            };
      };
    return [
      ...value.map(
        (input2?: Dynamic): Dynamic => callback(input2, value3[input2]),
      ),
      ...value2.map(
        (input2?: Dynamic): Dynamic =>
          callback(input2, getShortcutKeyLabel(input2, options)),
      ),
    ];
  }
  function parseSingleShortcut(input?: Dynamic, options?: Dynamic): Dynamic {
    let [value, ...value2]: Dynamic = splitShortcutChords(input);
    if (value === undefined || value2.length > 0) return;
    let { modifiers: value3, keys: value4 }: Dynamic = parseShortcutChord(
      value,
      options,
    );
    if (value4.length !== 1) return;
    let value5: Dynamic = options ? "Meta" : "Control",
      callback: Dynamic = (items?: Dynamic): Dynamic =>
        items === "cmd" || items === "command" || items === "meta"
          ? value5
          : (getOwnPropertyValue(
              ComponentsShortcutCtrlControlAltConfig_3,
              items,
            ) ??
            (/^f\d+$/.test(items)
              ? items.toUpperCase()
              : items.length === 1
                ? items
                : items.charAt(0).toUpperCase() + items.slice(1)));
    return [...value3, ...value4].map(callback).join("+");
  }
  bindRuntimeValue(
    runtime,
    "shortcutKeycapClassName",
    () => shortcutKeycapClassName,
  );
  bindRuntimeValue(runtime, "Shortcut", () => Shortcut);
  bindRuntimeValue(runtime, "useAppleKeyboard", () => useAppleKeyboard);
  bindRuntimeValue(runtime, "getOwnPropertyValue", () => getOwnPropertyValue);
  bindRuntimeValue(runtime, "getShortcutKeyLabel", () => getShortcutKeyLabel);
  bindRuntimeValue(runtime, "splitShortcutChords", () => splitShortcutChords);
  bindRuntimeValue(runtime, "parseShortcutChord", () => parseShortcutChord);
  bindRuntimeValue(runtime, "formatShortcutChord", () => formatShortcutChord);
  bindRuntimeValue(runtime, "parseSingleShortcut", () => parseSingleShortcut);
  bindRuntimeValue(
    runtime,
    "reactComponentsShortcut",
    () => reactComponentsShortcut,
    (value) => {
      reactComponentsShortcut = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxComponentsShortcut",
    () => jsxComponentsShortcut,
    (value) => {
      jsxComponentsShortcut = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsShortcutClassNames",
    () => ComponentsShortcutClassNames,
    (value) => {
      ComponentsShortcutClassNames = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsShortcutClassNames_2",
    () => ComponentsShortcutClassNames_2,
    (value) => {
      ComponentsShortcutClassNames_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsShortcutClassNames_3",
    () => ComponentsShortcutClassNames_3,
    (value) => {
      ComponentsShortcutClassNames_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsShortcutLabel",
    () => ComponentsShortcutLabel,
    (value) => {
      ComponentsShortcutLabel = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsShortcutKeycapTextConfig",
    () => ComponentsShortcutKeycapTextConfig,
    (value) => {
      ComponentsShortcutKeycapTextConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ThenValue",
    () => ThenValue,
    (value) => {
      ThenValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "Value",
    () => Value,
    (value) => {
      Value = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsShortcutIphoneIpadPattern",
    () => ComponentsShortcutIphoneIpadPattern,
    (value) => {
      ComponentsShortcutIphoneIpadPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsShortcutHandler",
    () => ComponentsShortcutHandler,
    (value) => {
      ComponentsShortcutHandler = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsShortcutCmdCommandMetaValues",
    () => ComponentsShortcutCmdCommandMetaValues,
    (value) => {
      ComponentsShortcutCmdCommandMetaValues = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsShortcutIncludes",
    () => ComponentsShortcutIncludes,
    (value) => {
      ComponentsShortcutIncludes = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsShortcutCtrlControlAltValues",
    () => ComponentsShortcutCtrlControlAltValues,
    (value) => {
      ComponentsShortcutCtrlControlAltValues = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsShortcutCtrlControlAltConfig",
    () => ComponentsShortcutCtrlControlAltConfig,
    (value) => {
      ComponentsShortcutCtrlControlAltConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsShortcutCtrlControlAltConfig_2",
    () => ComponentsShortcutCtrlControlAltConfig_2,
    (value) => {
      ComponentsShortcutCtrlControlAltConfig_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsShortcutSpaceEnterReturnConfig",
    () => ComponentsShortcutSpaceEnterReturnConfig,
    (value) => {
      ComponentsShortcutSpaceEnterReturnConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsShortcutSpaceEnterReturnConfig_2",
    () => ComponentsShortcutSpaceEnterReturnConfig_2,
    (value) => {
      ComponentsShortcutSpaceEnterReturnConfig_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsShortcutCmdCommandMetaConfig",
    () => ComponentsShortcutCmdCommandMetaConfig,
    (value) => {
      ComponentsShortcutCmdCommandMetaConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsShortcutCtrlControlAltConfig_3",
    () => ComponentsShortcutCtrlControlAltConfig_3,
    (value) => {
      ComponentsShortcutCtrlControlAltConfig_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeComponentsShortcut",
    () => initializeComponentsShortcut,
    (value) => {
      initializeComponentsShortcut = value;
    },
  );
  return () => {
    initializeComponentsShortcut = (0, runtime.initializeOnce)((): Dynamic => {
      "use client";

      (0, runtime.initializeClassNames)();
      reactComponentsShortcut = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react)(),
      );
      jsxComponentsShortcut = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react_jsx_runtime)(),
      );
      ComponentsShortcutClassNames =
        "inline-flex shrink-0 items-center justify-center h-[calc(1em+6px)] rounded-[var(--cds-keycap-radius,4px)] [color:var(--cds-shortcut-cap-ink)] bg-[color:var(--cds-shortcut-cap-fill)] border border-[color:var(--cds-shortcut-cap-line)] font-inherit [font-variation-settings:inherit] [line-height:1]";
      ComponentsShortcutClassNames_2 = "w-[calc(1em+6px)] px-0";
      ComponentsShortcutClassNames_3 = "min-w-[calc(1em+6px)] px-[3px]";
      ComponentsShortcutLabel =
        "font-inherit [font-variation-settings:inherit] [color:var(--cds-shortcut-cap-ink)]";
      ComponentsShortcutKeycapTextConfig = {
        keycap: "inline-flex shrink-0 items-center gap-[2px] text-caption",
        text: "inline-flex shrink-0 items-baseline gap-[0.3em] text-caption",
      };
      ThenValue = "then";
      Value = "+";
      ComponentsShortcutIphoneIpadPattern = /mac|iphone|ipad|ipod/i;
      ComponentsShortcutHandler = (): Dynamic => (): Dynamic => {};
      ComponentsShortcutCmdCommandMetaValues = [
        "cmd",
        "command",
        "meta",
        "ctrl",
        "control",
        "alt",
        "option",
        "shift",
      ];
      ComponentsShortcutIncludes = (input?: Dynamic): Dynamic =>
        ComponentsShortcutCmdCommandMetaValues.includes(input);
      ComponentsShortcutCtrlControlAltValues = [
        "ctrl",
        "control",
        "alt",
        "option",
        "shift",
        "cmd",
        "command",
        "meta",
      ];
      ComponentsShortcutCtrlControlAltConfig = {
        ctrl: "\u2303",
        control: "\u2303",
        alt: "\u2325",
        option: "\u2325",
        shift: "\u21E7",
        cmd: "\u2318",
        command: "\u2318",
        meta: "\u2318",
      };
      ComponentsShortcutCtrlControlAltConfig_2 = {
        ctrl: "Ctrl",
        control: "Ctrl",
        alt: "Alt",
        option: "Alt",
        shift: "Shift",
        cmd: "Ctrl",
        command: "Ctrl",
        meta: "Ctrl",
      };
      ComponentsShortcutSpaceEnterReturnConfig = {
        space: "\u2423",
        enter: "\u23CE",
        return: "\u23CE",
        delete: "\u232B",
        backspace: "\u232B",
        escape: "Esc",
        esc: "Esc",
        tab: "\u21E5",
        up: "\u2191",
        down: "\u2193",
        left: "\u2190",
        right: "\u2192",
        pageup: "Page Up",
        pagedown: "Page Down",
        home: "Home",
        end: "End",
        insert: "Insert",
      };
      ComponentsShortcutSpaceEnterReturnConfig_2 = {
        space: "Space",
        enter: "\u23CE",
        return: "\u23CE",
        delete: "Backspace",
        backspace: "Backspace",
        escape: "Esc",
        esc: "Esc",
        tab: "Tab",
        up: "\u2191",
        down: "\u2193",
        left: "\u2190",
        right: "\u2192",
        pageup: "Page Up",
        pagedown: "Page Down",
        home: "Home",
        end: "End",
        insert: "Insert",
      };
      ComponentsShortcutCmdCommandMetaConfig = {
        cmd: "Command",
        command: "Command",
        meta: "Command",
        ctrl: "Control",
        control: "Control",
        alt: "Option",
        option: "Option",
        shift: "Shift",
        enter: "Enter",
        return: "Enter",
        space: "Space",
        tab: "Tab",
        delete: "Delete",
        backspace: "Delete",
        up: "Up",
        down: "Down",
        left: "Left",
        right: "Right",
      };
      ComponentsShortcutCtrlControlAltConfig_3 = {
        ctrl: "Control",
        control: "Control",
        alt: "Alt",
        option: "Alt",
        shift: "Shift",
        enter: "Enter",
        return: "Enter",
        escape: "Escape",
        esc: "Escape",
        space: "Space",
        tab: "Tab",
        delete: "Backspace",
        backspace: "Backspace",
        up: "ArrowUp",
        down: "ArrowDown",
        left: "ArrowLeft",
        right: "ArrowRight",
        home: "Home",
        end: "End",
        pageup: "PageUp",
        pagedown: "PageDown",
        insert: "Insert",
      };
    });
  };
}
