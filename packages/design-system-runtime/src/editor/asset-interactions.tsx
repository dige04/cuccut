import type * as React from "react";
import type * as Editor from "../contracts/editor-runtime";
import type * as Model from "../contracts";
import type * as Application from "../contracts/application";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installEditorAssetInteractions(
  runtime: RuntimeBindings,
): () => void {
  var ASSET_LONG_PRESS_MS: number;
  var ASSET_LONG_PRESS_MOVE_TOLERANCE_PX: number;
  function findAssetTile(
    root: HTMLElement | null,
    id: string,
  ): HTMLElement | null {
    for (let value of root?.querySelectorAll<HTMLElement>("[data-tile-id]") ??
      []) {
      if (value instanceof HTMLElement && value.dataset.tileId === id) {
        return value;
      }
    }
    return null;
  }
  function assetKeyboardDestination(
    key: string,
    id: string,
    order: string[],
    columns: (id: string) => DOMRect | null,
  ): string | null {
    let index = order.indexOf(id);
    if (index < 0) {
      return order[0] ?? null;
    }
    if (key === "ArrowLeft") {
      return order[Math.max(0, index - 1)] ?? null;
    }
    if (key === "ArrowRight") {
      return order[Math.min(order.length - 1, index + 1)] ?? null;
    }
    let value: boolean = key === "ArrowUp",
      value2 = order[value ? index - 1 : index + 1];
    if (value2 !== undefined && columns(value2) === null) {
      return value2;
    }
    let value3 = columns(id);
    if (value3 === null) {
      return id;
    }
    let value4 = value3.left + value3.width / 2,
      value5: {
        id: string;
        dy: number;
        dx: number;
      } | null = null;
    for (let value6 of order) {
      if (value6 === id) {
        continue;
      }
      let value7 = columns(value6);
      if (value7 === null) {
        continue;
      }
      let value8 = value
        ? value3.top - (value7.top + value7.height)
        : value7.top - (value3.top + value3.height);
      if (value8 < -value7.height / 2) {
        continue;
      }
      let value9: number = Math.abs(value7.left + value7.width / 2 - value4);
      if (
        value5 === null ||
        value8 < value5.dy - 1 ||
        (Math.abs(value8 - value5.dy) <= 1 && value9 < value5.dx)
      ) {
        value5 = {
          id: value6,
          dy: value8,
          dx: value9,
        };
      }
    }
    return value5?.id ?? id;
  }
  function useAssetGridInteractions(
    options: Editor.AssetGridOptions,
  ): Editor.AssetGridInteractions {
    let {
        order: value,
        editable: value2,
        coarse: value3,
        scroller: value4,
      } = options,
      ref = (runtime.reactAssetInteractions as typeof React).useRef(options);
    ref.current = options;
    let value5 = (0, runtime.useAssetSelection)(value),
      memo = (runtime.reactAssetInteractions as typeof React).useMemo(
        () => new Set<string>(value5.selected),
        [value5.selected],
      ),
      [value6, value7] = (
        runtime.reactAssetInteractions as typeof React
      ).useState<Editor.AssetGridMenu | null>(null),
      callback = (runtime.reactAssetInteractions as typeof React).useCallback(
        () => value7(null),
        [],
      ),
      callback2 = (
        input: string,
        options2: {
          x: number;
          y: number;
        },
        context: "tap" | "point",
      ): void => {
        let value10 = value5.selected.includes(input)
          ? value.filter((input2) => value5.has(input2))
          : [input];
        if (!value5.selected.includes(input)) {
          value5.only(input);
        }
        value7({
          ...options2,
          paths: value10,
          anchor: context,
        });
      },
      value8 = (0, runtime.useAssetDrag)({
        enabled: value2 && !value3,
        order: value,
        selected: value5.selected,
        onGrab: value5.only,
        scroller: value4,
        onDrop: (input: string[], options2: Model.AssetDropTarget) =>
          ref.current.onDrop(input, options2),
      }),
      ref2 = (runtime.reactAssetInteractions as typeof React).useRef<
        import("../contracts/token-editors").RowTouchSession | null
      >(null),
      callback3 = () => {
        let current = ref2.current;
        if (current === null) {
          return false;
        }
        window.clearTimeout(current.timer);
        ref2.current = null;
        return current.fired;
      },
      ref3 = (runtime.reactAssetInteractions as typeof React).useRef(false),
      callback4 = (runtime.reactAssetInteractions as typeof React).useCallback(
        (input: React.PointerEvent<HTMLElement>, options2: string): void => {
          ref4.current = null;
          if (input.pointerType === "touch" && input.button === 0) {
            callback3();
            let state = {
              x: input.clientX,
              y: input.clientY,
            };
            ref2.current = {
              x: state.x,
              y: state.y,
              fired: false,
              timer: window.setTimeout((): void => {
                if (ref2.current !== null) {
                  ref2.current.fired = true;
                }
                callback2(options2, state, "tap");
              }, ASSET_LONG_PRESS_MS),
            };
          }
          value8.onPointerDown(input, options2);
        },
        [value8.onPointerDown, value, value5],
      );
    (runtime.reactAssetInteractions as typeof React).useEffect(() => {
      let callback11 = (input: PointerEvent): void => {
          let current = ref2.current;
          if (
            current !== null &&
            Math.hypot(input.clientX - current.x, input.clientY - current.y) >
              ASSET_LONG_PRESS_MOVE_TOLERANCE_PX
          ) {
            callback3();
          }
        },
        callback12 = (): void => {
          if (callback3()) {
            ref3.current = true;
            setTimeout(() => (ref3.current = false), 0);
          }
        };
      window.addEventListener("pointermove", callback11, true);
      window.addEventListener("pointerup", callback12, true);
      window.addEventListener("pointercancel", callback12, true);
      return (): void => {
        window.removeEventListener("pointermove", callback11, true);
        window.removeEventListener("pointerup", callback12, true);
        window.removeEventListener("pointercancel", callback12, true);
      };
    }, []);
    let callback5 = (
        runtime.reactAssetInteractions as typeof React
      ).useCallback(
        (input: React.MouseEvent<HTMLElement>, options2: string): void => {
          if (value8.justDropped() || ref3.current) {
            return;
          }
          if (
            !ref.current.editable &&
            !input.shiftKey &&
            !(0, runtime.hasSelectionModifier)(input)
          ) {
            value5.only(options2);
            ref.current.onOpen(options2);
            return;
          }
          value5.click(options2, input);
        },
        [value8, value5],
      ),
      callback6 = (runtime.reactAssetInteractions as typeof React).useCallback(
        (input: string) => ref.current.onOpen(input),
        [],
      ),
      callback7 = (runtime.reactAssetInteractions as typeof React).useCallback(
        (event: React.MouseEvent<HTMLElement>, options2: string): void => {
          event.preventDefault();
          if (ref2.current?.fired === true) {
            return;
          }
          callback3();
          callback2(
            options2,
            {
              x: event.clientX,
              y: event.clientY,
            },
            "point",
          );
        },
        [value, value5],
      ),
      callback8 = (input: HTMLElement): void => {
        input.focus({
          preventScroll: true,
        });
        input.scrollIntoView({
          block: "nearest",
          inline: "nearest",
        });
      },
      ref4 = (runtime.reactAssetInteractions as typeof React).useRef<
        string | null
      >(null);
    (runtime.reactAssetInteractions as typeof React).useEffect((): void => {
      if (ref4.current === null) {
        return;
      }
      let value10 = findAssetTile(value4.current, ref4.current);
      if (value10 === null) {
        return;
      }
      ref4.current = null;
      callback8(value10);
    });
    let callback9 = (
        runtime.reactAssetInteractions as typeof React
      ).useCallback((input: string | null): void => {
        ref4.current = input;
      }, []),
      callback10 = (runtime.reactAssetInteractions as typeof React).useCallback(
        (event: React.KeyboardEvent<HTMLElement>, options2: string): void => {
          if (event.defaultPrevented || event.target !== event.currentTarget) {
            return;
          }
          let current = ref.current,
            value10 = event.metaKey || event.ctrlKey;
          if (event.key === "Enter" && !value10) {
            event.preventDefault();
            current.onOpen(options2);
          } else if (event.key === " ") {
            event.preventDefault();
            value5.click(options2, {
              shiftKey: false,
              metaKey: true,
              ctrlKey: false,
              altKey: false,
            });
          } else if (event.key === "Escape") {
            if (value5.selected.length === 0) {
              return;
            }
            event.preventDefault();
            value5.clear();
          } else if (
            value10 &&
            !event.shiftKey &&
            !event.altKey &&
            (event.key === "a" || event.key === "A")
          ) {
            event.preventDefault();
            value5.all();
          } else if (
            (event.key === "Delete" || event.key === "Backspace") &&
            !value10 &&
            !event.altKey
          ) {
            event.preventDefault();
            if (!current.editable) {
              return;
            }
            current.onRemove(
              value5.selected.includes(options2)
                ? current.order.filter((input) => value5.has(input))
                : [options2],
            );
          } else if (
            event.key === "ContextMenu" ||
            (event.key === "F10" && event.shiftKey)
          ) {
            event.preventDefault();
            let bounds = event.currentTarget.getBoundingClientRect();
            callback2(
              options2,
              {
                x: bounds.left + Math.min(40, bounds.width / 2),
                y: bounds.top + Math.min(24, bounds.height / 2),
              },
              "point",
            );
          } else if (
            event.key.startsWith("Arrow") &&
            !value10 &&
            !event.altKey
          ) {
            event.preventDefault();
            let entries = new Map<string, HTMLElement>();
            for (let value13 of current.scroller.current?.querySelectorAll<HTMLElement>(
              "[data-tile-id]",
            ) ?? []) {
              entries.set(value13.dataset.tileId ?? "", value13);
            }
            let value11 = current.order.filter((input) => {
                let entry2 = entries.get(input);
                return (
                  entry2 === undefined || entry2.getClientRects().length > 0
                );
              }),
              value12 = assetKeyboardDestination(
                event.key,
                options2,
                value11,
                (input) => entries.get(input)?.getBoundingClientRect() ?? null,
              );
            if (value12 === null) {
              return;
            }
            if (event.shiftKey) {
              value5.extend(value12);
            } else {
              value5.only(value12);
            }
            let entry = entries.get(value12);
            if (entry !== undefined) {
              callback8(entry);
            } else {
              callback9(value12);
            }
          }
        },
        [value5],
      ),
      ref5 = (runtime.reactAssetInteractions as typeof React).useRef(value5);
    ref5.current = value5;
    (runtime.reactAssetInteractions as typeof React).useEffect(() => {
      let current = value4.current;
      if (current === null) {
        return;
      }
      let callback11 = (event: PointerEvent): void => {
        if (event.button !== 0 || ref5.current.selected.length === 0) {
          return;
        }
        let target = event.target;
        if (
          !(target instanceof Element) ||
          target.closest(
            '[data-tile-id],[data-drop-slot],button,input,textarea,select,label,a,[role="button"],[role="radio"],[role="switch"],[role="checkbox"],[role="slider"],[role="menu"],[role="menuitem"],[role="dialog"],[contenteditable="true"],[data-mc-chrome]',
          ) !== null
        ) {
          return;
        }
        ref5.current.clear();
      };
      current.addEventListener("pointerdown", callback11);
      return () => current.removeEventListener("pointerdown", callback11);
    }, [value4]);
    let value9 =
      value5.focus !== null && value.includes(value5.focus)
        ? value5.focus
        : (value5.selected.at(-1) ?? null);
    return {
      selection: value5,
      selected: memo,
      focusId: value9,
      editable: value2,
      coarse: value3,
      drag: value8.drag,
      ghostRef: value8.ghostRef,
      menu: value6,
      closeMenu: callback,
      focus: callback9,
      remove: (input: string[]) => ref.current.onRemove(input),
      onPointerDown: callback4,
      onClick: callback5,
      onDoubleClick: callback6,
      onContextMenu: callback7,
      onKeyDown: callback10,
    };
  }
  bindRuntimeValue(
    runtime,
    "ASSET_LONG_PRESS_MS",
    () => ASSET_LONG_PRESS_MS,
    (value) => {
      ASSET_LONG_PRESS_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ASSET_LONG_PRESS_MOVE_TOLERANCE_PX",
    () => ASSET_LONG_PRESS_MOVE_TOLERANCE_PX,
    (value) => {
      ASSET_LONG_PRESS_MOVE_TOLERANCE_PX = value;
    },
  );
  bindRuntimeValue(runtime, "findAssetTile", () => findAssetTile);
  bindRuntimeValue(
    runtime,
    "assetKeyboardDestination",
    () => assetKeyboardDestination,
  );
  bindRuntimeValue(
    runtime,
    "useAssetGridInteractions",
    () => useAssetGridInteractions,
  );
  return () => {
    ASSET_LONG_PRESS_MS = 500;
    ASSET_LONG_PRESS_MOVE_TOLERANCE_PX = 10;
  };
}
