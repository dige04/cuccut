import type * as React from "react";
import type * as Editor from "../contracts/editor-runtime";
import type * as Model from "../contracts";
import type * as Application from "../contracts/application";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installEditorAssetDrag(runtime: RuntimeBindings): () => void {
  var reactAssetDrag: typeof import("react");
  var ASSET_DRAG_START_DISTANCE_PX: number;
  var ASSET_DRAG_SCROLL_EDGE_PX: number;
  var ASSET_DRAG_MAX_SCROLL_STEP_PX: number;
  function assetDropTargetsEqual(
    left: Model.AssetDropTarget | null,
    right: Model.AssetDropTarget | null,
  ): boolean {
    if (left === null || right === null) {
      return left === right;
    }
    if (left.kind !== right.kind) {
      return false;
    }
    if (left.kind === "new") {
      return true;
    }
    return (
      left.group ===
        (
          right as Exclude<
            Model.AssetDropTarget,
            {
              kind: "new";
            }
          >
        ).group &&
      (left.kind === "group" ||
        left.before ===
          (
            right as Extract<
              Model.AssetDropTarget,
              {
                kind: "slot";
              }
            >
          ).before)
    );
  }
  function assetDropTargetAtPoint(
    document2: Document,
    clientX: number,
    clientY: number,
    leadIds: ReadonlySet<string>,
    allowNewGroup: Model.AssetDropTarget | null,
  ): Model.AssetDropTarget | null {
    let value = document2.elementFromPoint(clientX, clientY);
    if (value === null || typeof value.closest !== "function") {
      return null;
    }
    if (value.closest<HTMLElement>('[data-drop-zone="new"]') !== null) {
      return {
        kind: "new",
      };
    }
    let ancestor = value.closest<HTMLElement>("[data-drop-group]");
    if (ancestor === null) {
      return null;
    }
    let value2 = ancestor.dataset.dropGroup ?? "",
      ancestor2 = value.closest<HTMLElement>("[data-tile-id]");
    if (ancestor2 !== null && ancestor.contains(ancestor2)) {
      let value3 = ancestor2.dataset.tileId ?? "",
        items = [...ancestor.querySelectorAll<HTMLElement>("[data-tile-id]")],
        callback = (input: number) =>
          items
            .slice(input)
            .map((input2) => input2.dataset.tileId ?? "")
            .find((input2): boolean => !leadIds.has(input2)) ?? null;
      if (leadIds.has(value3)) {
        return {
          kind: "slot",
          group: value2,
          before: callback(items.indexOf(ancestor2) + 1),
        };
      }
      let bounds = ancestor2.getBoundingClientRect(),
        value4: boolean =
          ancestor2.dataset.tileAxis === "y"
            ? clientY < bounds.top + bounds.height / 2
            : clientX < bounds.left + bounds.width / 2;
      return {
        kind: "slot",
        group: value2,
        before: value4 ? value3 : callback(items.indexOf(ancestor2) + 1),
      };
    }
    if (value.closest<HTMLElement>("[data-drop-slot]") !== null) {
      return allowNewGroup;
    }
    if (
      allowNewGroup !== null &&
      allowNewGroup.kind !== "new" &&
      allowNewGroup.group === value2
    ) {
      return allowNewGroup;
    }
    return {
      kind: "group",
      group: value2,
    };
  }
  function assetDragScrollDelta(
    clientY: number,
    top: number,
    bottom: number,
  ): number {
    if (clientY < top + ASSET_DRAG_SCROLL_EDGE_PX) {
      return -Math.ceil(
        ASSET_DRAG_MAX_SCROLL_STEP_PX *
          Math.min(
            1,
            (top + ASSET_DRAG_SCROLL_EDGE_PX - clientY) /
              ASSET_DRAG_SCROLL_EDGE_PX,
          ),
      );
    }
    if (clientY > bottom - ASSET_DRAG_SCROLL_EDGE_PX) {
      return Math.ceil(
        ASSET_DRAG_MAX_SCROLL_STEP_PX *
          Math.min(
            1,
            (clientY - (bottom - ASSET_DRAG_SCROLL_EDGE_PX)) /
              ASSET_DRAG_SCROLL_EDGE_PX,
          ),
      );
    }
    return 0;
  }
  function useAssetDrag(
    options: Editor.AssetDragOptions,
  ): Editor.AssetDragController {
    let optionsRef = reactAssetDrag.useRef(options);
    optionsRef.current = options;
    let [drag, setDrag] = reactAssetDrag.useState<Editor.AssetDragView | null>(
        null,
      ),
      dragRef = reactAssetDrag.useRef<Editor.AssetDragView | null>(null),
      callback = (input: Editor.AssetDragView | null): void => {
        dragRef.current = input;
        setDrag(input);
      },
      ref = reactAssetDrag.useRef<Editor.AssetPointerSession | null>(null),
      ref2 = reactAssetDrag.useRef({
        x: 0,
        y: 0,
      }),
      ref3 = reactAssetDrag.useRef<HTMLElement | null>(null),
      ref4 = reactAssetDrag.useRef(false),
      ref5 = reactAssetDrag.useRef(0),
      ref6 = reactAssetDrag.useRef<Editor.AssetDragListeners | null>(null),
      callback2 = (): void => {
        let current = ref3.current;
        if (current !== null) {
          current.style.transform =
            "translate3d(" +
            String(ref2.current.x) +
            "px," +
            String(ref2.current.y) +
            "px,0)";
        }
      },
      callback3 = (): void => {
        let current = dragRef.current;
        if (current === null || typeof document === "undefined") {
          return;
        }
        let value = assetDropTargetAtPoint(
          document,
          ref2.current.x,
          ref2.current.y,
          new Set(current.ids),
          current.target,
        );
        if (!assetDropTargetsEqual(value, current.target)) {
          callback({
            ...current,
            target: value,
          });
        }
      },
      callback4 = (): void => {
        if (ref5.current !== 0) {
          cancelAnimationFrame(ref5.current);
        }
        ref5.current = 0;
      },
      callback5 = (): void => {
        ref5.current = 0;
        let current = optionsRef.current.scroller.current;
        if (dragRef.current === null || current === null) {
          return;
        }
        let bounds = current.getBoundingClientRect(),
          value = assetDragScrollDelta(
            ref2.current.y,
            bounds.top,
            bounds.bottom,
          );
        if (value !== 0) {
          current.scrollTop += value;
          callback3();
        }
        ref5.current = requestAnimationFrame(callback5);
      },
      callback6 = (): void => {
        let current = ref6.current;
        ref6.current = null;
        if (current === null) {
          return;
        }
        window.removeEventListener("pointermove", current.move);
        window.removeEventListener("pointerup", current.up);
        window.removeEventListener("pointercancel", current.cancel);
        window.removeEventListener("blur", current.cancel);
        window.removeEventListener("keydown", current.key, true);
      },
      callback7 = (): void => {
        ref.current = null;
        callback6();
        callback4();
        optionsRef.current.scroller.current?.removeAttribute("data-dragging");
        callback(null);
      },
      callback8 = (): void => {
        ref4.current = true;
        let callback13 = (): void => {
          window.removeEventListener("pointerup", callback13, true);
          window.removeEventListener("pointercancel", callback13, true);
          setTimeout(() => (ref4.current = false), 0);
        };
        window.addEventListener("pointerup", callback13, true);
        window.addEventListener("pointercancel", callback13, true);
      },
      callback9 = (input: PointerEvent) => {
        let current = ref.current;
        if (current === null || current.pointerId !== input.pointerId) {
          return;
        }
        if (input.pointerType === "mouse" && input.buttons === 0) {
          return callback7();
        }
        if (
          !current.moved &&
          Math.hypot(input.clientX - current.sx, input.clientY - current.sy) <
            ASSET_DRAG_START_DISTANCE_PX
        ) {
          return;
        }
        ref2.current = {
          x: input.clientX,
          y: input.clientY,
        };
        if (!current.moved) {
          current.moved = true;
          optionsRef.current.scroller.current?.setAttribute(
            "data-dragging",
            "",
          );
          callback({
            ids: current.ids,
            lead: current.id,
            grab: current.grab,
            target:
              typeof document === "undefined"
                ? null
                : assetDropTargetAtPoint(
                    document,
                    input.clientX,
                    input.clientY,
                    new Set(current.ids),
                    null,
                  ),
          });
          if (
            ref5.current === 0 &&
            typeof requestAnimationFrame === "function"
          ) {
            ref5.current = requestAnimationFrame(callback5);
          }
        } else {
          callback3();
        }
        callback2();
      },
      callback10 = (input: PointerEvent): void => {
        let current = ref.current;
        if (current === null || current.pointerId !== input.pointerId) {
          return;
        }
        let current2 = dragRef.current,
          moved = current.moved;
        callback7();
        if (!moved || current2 === null) {
          return;
        }
        ref4.current = true;
        setTimeout(() => (ref4.current = false), 0);
        if (current2.target !== null) {
          optionsRef.current.onDrop(current2.ids, current2.target);
        }
      },
      callback11 = (event: KeyboardEvent): void => {
        if (event.key !== "Escape" || ref.current === null) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        let moved = ref.current.moved;
        callback7();
        if (moved) {
          callback8();
        }
      };
    reactAssetDrag.useEffect(
      () => (): void => {
        callback6();
        callback4();
      },
      [],
    );
    let callback12 = reactAssetDrag.useCallback(
      (input: React.PointerEvent<HTMLElement>, options2: string): void => {
        let current = optionsRef.current;
        if (input.button !== 0 || ref.current !== null) {
          return;
        }
        if (
          input.shiftKey ||
          input.metaKey ||
          input.ctrlKey ||
          input.altKey ||
          input.pointerType === "touch"
        ) {
          return;
        }
        if (!current.selected.includes(options2)) {
          current.onGrab(options2);
        }
        if (!current.enabled) {
          return;
        }
        let bounds = input.currentTarget.getBoundingClientRect(),
          value = current.selected.includes(options2)
            ? current.selected
            : [options2],
          value2 =
            value.length > 1
              ? current.order.filter((input2) => value.includes(input2))
              : [options2];
        ref.current = {
          id: options2,
          ids: value2,
          pointerId: input.pointerId,
          sx: input.clientX,
          sy: input.clientY,
          moved: false,
          grab: {
            dx: input.clientX - bounds.left,
            dy: input.clientY - bounds.top,
            w: bounds.width,
            h: bounds.height,
          },
        };
        ref2.current = {
          x: input.clientX,
          y: input.clientY,
        };
        let state = {
          move: callback9,
          up: callback10,
          cancel: callback7,
          key: callback11,
        };
        ref6.current = state;
        window.addEventListener("pointermove", state.move);
        window.addEventListener("pointerup", state.up);
        window.addEventListener("pointercancel", state.cancel);
        window.addEventListener("blur", state.cancel);
        window.addEventListener("keydown", state.key, true);
      },
      [],
    );
    reactAssetDrag.useEffect((): void => {
      if (drag !== null) {
        callback2();
      }
    });
    return {
      drag: drag,
      onPointerDown: callback12,
      ghostRef: ref3,
      justDropped: () => ref4.current,
      cancel: callback7,
    };
  }
  bindRuntimeValue(
    runtime,
    "reactAssetDrag",
    () => reactAssetDrag,
    (value) => {
      reactAssetDrag = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "assetDropTargetsEqual",
    () => assetDropTargetsEqual,
  );
  bindRuntimeValue(
    runtime,
    "ASSET_DRAG_START_DISTANCE_PX",
    () => ASSET_DRAG_START_DISTANCE_PX,
    (value) => {
      ASSET_DRAG_START_DISTANCE_PX = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ASSET_DRAG_SCROLL_EDGE_PX",
    () => ASSET_DRAG_SCROLL_EDGE_PX,
    (value) => {
      ASSET_DRAG_SCROLL_EDGE_PX = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ASSET_DRAG_MAX_SCROLL_STEP_PX",
    () => ASSET_DRAG_MAX_SCROLL_STEP_PX,
    (value) => {
      ASSET_DRAG_MAX_SCROLL_STEP_PX = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "assetDropTargetAtPoint",
    () => assetDropTargetAtPoint,
  );
  bindRuntimeValue(runtime, "assetDragScrollDelta", () => assetDragScrollDelta);
  bindRuntimeValue(runtime, "useAssetDrag", () => useAssetDrag);
  return () => {
    reactAssetDrag = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    ASSET_DRAG_START_DISTANCE_PX = 5;
    ASSET_DRAG_SCROLL_EDGE_PX = 56;
    ASSET_DRAG_MAX_SCROLL_STEP_PX = 18;
  };
}
