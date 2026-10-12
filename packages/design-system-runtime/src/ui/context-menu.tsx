/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
import type * as React from "react";
import type {
  ReactNamespace,
  JsxNamespace,
  ContextMenuProps,
  RetainedContextMenu,
  PopupChangeDetails,
} from "../contracts/composition";
export function installUiContextMenu(runtime: RuntimeBindings): () => void {
  var reactContextMenu: ReactNamespace;
  var jsxChromeContextMenu: JsxNamespace;
  var ChromeContextMenuConstant: number;
  function ContextMenu({
    at: at2,
    onClose: onClose,
    children: children,
    title: title,
    "aria-label": ariaLabel,
    anchor: anchor,
    className: className,
    focusFirstItem = false,
  }: ContextMenuProps) {
    let open = at2 !== null,
      popupRef = reactContextMenu.useRef<HTMLDivElement | null>(null),
      onCloseRef = reactContextMenu.useRef(onClose);
    onCloseRef.current = onClose;
    let [retained, setRetained] = reactContextMenu.useState(false),
      lastContentRef = reactContextMenu.useRef<RetainedContextMenu | null>(
        null,
      );
    reactContextMenu.useLayoutEffect(() => {
      if (at2) {
        lastContentRef.current = {
          at: at2,
          children: children,
          title: title,
          name: title ?? ariaLabel,
          anchor: anchor ?? "point",
        };
        setRetained(true);
      }
    }, [at2, children, title, ariaLabel, anchor]);
    let content = at2
        ? {
            at: at2,
            children: children,
            title: title,
            name: title ?? ariaLabel,
            anchor: anchor ?? "point",
          }
        : lastContentRef.current,
      value = content?.anchor === "tap",
      value2 = content?.at.x,
      value3 = content?.at.y,
      memo = reactContextMenu.useMemo(() => {
        if (value2 === undefined || value3 === undefined) {
          return;
        }
        let state = {
          x: value2,
          y: value3,
          left: value2,
          top: value3,
          right: value2,
          bottom: value3,
          width: 0,
          height: 0,
          toJSON: () => ({
            x: value2,
            y: value3,
            width: 0,
            height: 0,
          }),
        };
        return {
          getBoundingClientRect: () => state,
        };
      }, [value2, value3]),
      ref = reactContextMenu.useRef<HTMLElement | null>(null);
    reactContextMenu.useLayoutEffect(() => {
      if (!open) {
        return;
      }
      let activeElement = document.activeElement;
      if (
        retained &&
        (activeElement === document.body ||
          (popupRef.current?.contains(activeElement) ?? false))
      ) {
        return;
      }
      ref.current =
        activeElement instanceof HTMLElement && activeElement !== document.body
          ? activeElement
          : null;
    }, [open, retained]);
    reactContextMenu.useEffect(() => {
      if (!open || !focusFirstItem) {
        return;
      }
      let value4 = requestAnimationFrame(() => {
        let current = popupRef.current;
        if (current === null) {
          return;
        }
        let activeElement = document.activeElement;
        if (
          activeElement !== null &&
          activeElement !== document.body &&
          activeElement !== current &&
          !current.contains(activeElement) &&
          activeElement !== ref.current
        ) {
          return;
        }
        let element = current.querySelector<HTMLElement>(
          '[role^="menuitem"]:not([aria-disabled="true"]):not([data-disabled])',
        );
        if (element !== null) {
          element.focus();
        }
      });
      return () => cancelAnimationFrame(value4);
    }, [open, focusFirstItem]);
    return (
      <jsxChromeContextMenu.Fragment>
        {[
          open ? (
            <runtime.PopupScrim onClose={() => onCloseRef.current()} />
          ) : null,
          <runtime.Menu.Root
            open={open}
            modal={false}
            onOpenChange={(input: boolean, options: PopupChangeDetails) => {
              if (input) {
                return;
              }
              if (options.reason === "outside-press") {
                let value4 = options.event?.target;
                if (
                  value4 instanceof Element &&
                  value4.hasAttribute("data-mc-scrim")
                ) {
                  options.cancel();
                  return;
                }
              }
              onCloseRef.current();
            }}
            onOpenChangeComplete={(input: boolean) => {
              if (!input) {
                setRetained(false);
              }
            }}
          >
            <runtime.Menu.Popup
              ref={popupRef}
              anchor={memo}
              side={"bottom"}
              align={value ? "center" : "start"}
              sideOffset={value ? ChromeContextMenuConstant : 0}
              aria-label={content?.name}
              data-mc-chrome={""}
              data-mc-menu={""}
              finalFocus={() => {
                let activeElement = document.activeElement;
                if (
                  activeElement instanceof HTMLElement &&
                  activeElement !== document.body &&
                  !(popupRef.current?.contains(activeElement) ?? false)
                ) {
                  return false;
                }
                let current = ref.current;
                if (current !== null && current.isConnected) {
                  current.focus({
                    preventScroll: true,
                  });
                }
                return false;
              }}
              onContextMenu={(event: React.MouseEvent<HTMLElement>) => {
                event.preventDefault();
                event.stopPropagation();
              }}
              onKeyDown={(input: React.KeyboardEvent<HTMLElement>) => {
                if (input.key !== "Tab" && !input.metaKey && !input.ctrlKey) {
                  input.stopPropagation();
                }
              }}
              className={className}
            >
              {[
                content?.title !== undefined ? (
                  <runtime.Menu.Header className={"truncate"}>
                    {content.title}
                  </runtime.Menu.Header>
                ) : null,
                content?.children,
              ]}
            </runtime.Menu.Popup>
          </runtime.Menu.Root>,
        ]}
      </jsxChromeContextMenu.Fragment>
    );
  }
  bindRuntimeValue(
    runtime,
    "reactContextMenu",
    () => reactContextMenu,
    (value) => {
      reactContextMenu = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxChromeContextMenu",
    () => jsxChromeContextMenu,
    (value) => {
      jsxChromeContextMenu = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ChromeContextMenuConstant",
    () => ChromeContextMenuConstant,
    (value) => {
      ChromeContextMenuConstant = value;
    },
  );
  bindRuntimeValue(runtime, "ContextMenu", () => ContextMenu);
  return () => {
    reactContextMenu = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    jsxChromeContextMenu = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
    ChromeContextMenuConstant = 14;
  };
}
