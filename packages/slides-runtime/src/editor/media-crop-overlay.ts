/** Restored application module; prepare first, initialize in original order. */
import type {
  CSSProperties,
  PointerEvent as ReactPointerEvent,
  ReactElement,
} from "react";
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type JsxNamespace,
  type ReactNamespace,
} from "../bindings";
import type { ImageCrop } from "../deck-contracts";
import type {
  CropBox,
  CropFrameChange,
  CropHandlesOff,
  CropSize,
} from "./media-crop-session";

/** A corner handle of the crop frame, named by compass position. */
export type CropCornerHandle = "nw" | "ne" | "se" | "sw";
/** Any handle of the crop frame: the four edges and the four corners. */
export type CropHandle = "n" | "e" | "s" | "w" | CropCornerHandle;
/** A drag that resizes the crop frame from one of its handles. */
export interface CropSideDrag {
  of: "side";
  side: CropHandle;
}
/** A drag that pans the picture inside the crop frame. */
export interface CropMediaDrag {
  of: "media";
}
/** A drag that zooms the picture from one of its corners. */
export interface CropCornerDrag {
  of: "corner";
  corner: CropCornerHandle;
}
/** What a pointer drag on the crop overlay is doing. */
export type CropDrag = CropSideDrag | CropMediaDrag | CropCornerDrag;
/** How far one arrow key press moves the picture, as a [dx, dy] unit step. */
export type CropArrowDelta = readonly [number, number];
/** A point in the crop frame's coordinate space, in px. */
interface CropPoint {
  x: number;
  y: number;
}
/** A pointer gesture in progress on the overlay. */
interface CropGesture {
  /** The pointer that started the gesture. */
  pid: number;
  /** The element that captured the pointer. */
  el: Element;
  /** Pointer position when the gesture began. */
  sx: number;
  sy: number;
  /** The crop when the gesture began. */
  start: ImageCrop;
  /** The size of the crop frame when the gesture began. */
  frame: CropSize;
  /** The frame offset when the gesture began. */
  base: CropPoint;
  drag: CropDrag;
}
/** A touch-pad pinch event (WebKit's gesturechange), which lib.dom does not declare. */
interface CropGestureEvent extends Event {
  scale?: number;
  clientX?: number;
  clientY?: number;
}
/** The pointer handlers that start, track and end a crop drag. */
interface CropPointerHandlers {
  onPointerDown(event: ReactPointerEvent<Element>): void;
  onPointerMove(event: ReactPointerEvent<Element>): void;
  onPointerUp(event: ReactPointerEvent<Element>): void;
  onPointerCancel(event: ReactPointerEvent<Element>): void;
  onLostPointerCapture(event: ReactPointerEvent<Element>): void;
}
export interface MediaCropOverlayProps {
  /** The image box being cropped, in px. */
  frame: CropSize;
  /** The picture's natural size. */
  natural: CropSize;
  crop: ImageCrop;
  /** Screen px per frame px. */
  scale: number;
  /** The frame's rotation, in radians. */
  rotation?: number;
  /** The picture to preview, or null when there is none. */
  src: string | null;
  /** Whether `src` is a video poster. */
  video?: boolean;
  /** Why zooming is unavailable, or undefined when it is available. */
  zoomDisabledReason?: string;
  onLive(crop: ImageCrop): void;
  onDone(commit: boolean): void;
  onGesture?(active: boolean): void;
  /** Present when the crop frame can be resized by its handles. */
  onFrame?(change: CropFrameChange): void;
  /** Reasons the frame handles are off, by handle name. */
  frameHandleOff?: CropHandlesOff;
  /** The smallest frame side a handle drag may reach, in frame px. */
  minFrame?: number;
  /** Adjusts a dragged frame, for example to snap it to guides. */
  snapFrame?(frame: CropBox): CropBox;
  /** Returns true when the caller takes over a handle press. */
  onSideStart?(side: CropHandle, event: ReactPointerEvent<Element>): boolean;
}

declare module "../bindings" {
  interface RuntimeBindings {
    reactqY: ReactNamespace;
    jsxR4: JsxNamespace;
    CROP_CORNER_HANDLES: readonly CropCornerHandle[];
    CROP_ALL_HANDLES: readonly CropHandle[];
    CROP_HANDLE_LABELS: Record<CropHandle, string>;
    CROP_CORNER_LABELS: Record<CropCornerHandle, string>;
    CROP_HANDLE_CURSORS: Record<CropHandle, string>;
    CROP_CHANGE_EPSILON: number;
    CROP_HANDLE_SIZE: number;
    CROP_HANDLE_VISUAL_SIZE: number;
    CROP_HANDLE_BORDER_WIDTH: number;
    CROP_TOUCH_HANDLE_SIZE: number;
    CROP_DRAG_OPACITY: number;
    CROP_ZOOM_STEP: number;
    CROP_ARROW_DELTAS: Record<string, CropArrowDelta>;
    blurCropEditingTarget: () => void;
    MediaCropOverlay: (props: MediaCropOverlayProps) => ReactElement;
  }
}

export function installEditorMediaCropOverlay(
  runtime: RuntimeBindings,
): () => void {
  var reactqY: ReactNamespace;
  var jsxR4: JsxNamespace;
  var CROP_CORNER_HANDLES: RuntimeBindings["CROP_CORNER_HANDLES"];
  var CROP_ALL_HANDLES: RuntimeBindings["CROP_ALL_HANDLES"];
  var CROP_HANDLE_LABELS: RuntimeBindings["CROP_HANDLE_LABELS"];
  var CROP_CORNER_LABELS: RuntimeBindings["CROP_CORNER_LABELS"];
  var CROP_HANDLE_CURSORS: RuntimeBindings["CROP_HANDLE_CURSORS"];
  var CROP_CHANGE_EPSILON: RuntimeBindings["CROP_CHANGE_EPSILON"];
  var CROP_HANDLE_SIZE: RuntimeBindings["CROP_HANDLE_SIZE"];
  var CROP_HANDLE_VISUAL_SIZE: RuntimeBindings["CROP_HANDLE_VISUAL_SIZE"];
  var CROP_HANDLE_BORDER_WIDTH: RuntimeBindings["CROP_HANDLE_BORDER_WIDTH"];
  var CROP_TOUCH_HANDLE_SIZE: RuntimeBindings["CROP_TOUCH_HANDLE_SIZE"];
  var CROP_DRAG_OPACITY: RuntimeBindings["CROP_DRAG_OPACITY"];
  var CROP_ZOOM_STEP: RuntimeBindings["CROP_ZOOM_STEP"];
  var CROP_ARROW_DELTAS: RuntimeBindings["CROP_ARROW_DELTAS"];
  function blurCropEditingTarget(): void {
    let activeElement = document.activeElement;
    if (
      !(activeElement instanceof HTMLElement) ||
      activeElement.closest("[data-media-crop-keep]")
    ) {
      return;
    }
    if (
      activeElement.isContentEditable ||
      /^(INPUT|TEXTAREA|SELECT)$/.test(activeElement.tagName) ||
      activeElement.closest('button, a[href], [role="button"]')
    ) {
      activeElement.blur();
    }
  }
  function MediaCropOverlay({
    frame: frame,
    natural: natural,
    crop: crop,
    scale: scale,
    rotation = 0,
    src: src,
    video = false,
    zoomDisabledReason: zoomDisabledReason,
    onLive: onLive,
    onDone: onDone,
    onGesture: onGesture,
    onFrame: onFrame,
    frameHandleOff: frameHandleOff,
    minFrame = 0,
    snapFrame: snapFrame,
    onSideStart: onSideStart,
  }: MediaCropOverlayProps): ReactElement {
    let ref = reactqY.useRef({
      frame: frame,
      natural: natural,
      crop: crop,
      scale: scale,
      rotation: rotation,
      zoomDisabledReason: zoomDisabledReason,
      onLive: onLive,
      onDone: onDone,
      onGesture: onGesture,
      onFrame: onFrame,
    });
    ref.current = {
      frame: frame,
      natural: natural,
      crop: crop,
      scale: scale,
      rotation: rotation,
      zoomDisabledReason: zoomDisabledReason,
      onLive: onLive,
      onDone: onDone,
      onGesture: onGesture,
      onFrame: onFrame,
    };
    let ref2 = reactqY.useRef<HTMLDivElement>(null),
      ref3 = reactqY.useRef<CropGesture | null>(null),
      ref4 = reactqY.useRef<CropPoint>({
        x: 0,
        y: 0,
      }),
      ref5 = reactqY.useRef(false),
      [value, value2] = reactqY.useState(false),
      [value3, value4] = reactqY.useState(false),
      callback = (input: ImageCrop, options?: CropBox): void => {
        let current = ref.current;
        if (options && current.onFrame) {
          ref4.current = {
            x: options.x,
            y: options.y,
          };
          current.onFrame({
            crop: input,
            frame: options,
          });
        } else if (!(0, runtime.imageCropsEqual)(input, current.crop)) {
          current.onLive(input);
        }
      },
      callback2 = (input: boolean): void => {
        let current = ref3.current;
        if (!current) {
          return;
        }
        ref3.current = null;
        if (current.el.hasPointerCapture(current.pid)) {
          current.el.releasePointerCapture(current.pid);
        }
        if (input) {
          callback(
            current.start,
            current.drag.of === "side"
              ? {
                  ...current.base,
                  ...current.frame,
                }
              : undefined,
          );
        }
        value2(false);
        ref.current.onGesture?.(false);
      };
    reactqY.useEffect((): (() => void) => {
      let current = ref.current;
      (0, runtime.announceLiveMessage)(
        "Cropping. Press Enter when done. " +
          (current.onFrame ? "Drag an edge to crop. " : "") +
          "Arrow keys move the picture." +
          (current.zoomDisabledReason === undefined
            ? " Plus and minus zoom it."
            : ""),
      );
      let callback8 = (event: KeyboardEvent): void => {
          let current3 = ref.current,
            target = event.target;
          if (ref5.current) {
            return;
          }
          if (
            target instanceof HTMLElement &&
            (target.isContentEditable ||
              /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
          ) {
            return;
          }
          if (
            (event.key === "Enter" || event.key === " ") &&
            target instanceof Element &&
            target.closest('button, a[href], [role="button"]')
          ) {
            return;
          }
          let value17: boolean =
              (event.metaKey || event.ctrlKey) &&
              (event.key.toLowerCase() === "z" ||
                event.key.toLowerCase() === "y"),
            value18: number =
              !event.metaKey && !event.ctrlKey && !event.altKey
                ? event.key === "+" || event.key === "="
                  ? CROP_ZOOM_STEP
                  : event.key === "-" || event.key === "_"
                    ? 1 / CROP_ZOOM_STEP
                    : 0
                : 0,
            value19: CropArrowDelta | undefined =
              !event.metaKey && !event.ctrlKey && !event.altKey
                ? CROP_ARROW_DELTAS[event.key]
                : undefined;
          if (
            event.key !== "Escape" &&
            event.key !== "Enter" &&
            !value17 &&
            value18 === 0 &&
            value19 === undefined
          ) {
            if (
              !(
                event.key === " " ||
                event.key === "Tab" ||
                ((event.metaKey || event.ctrlKey) &&
                  /^[-=+01]$/.test(event.key))
              ) &&
              !/^(Shift|Control|Alt|AltGraph|Meta|OS|Hyper|Super|Fn|FnLock|Symbol|SymbolLock|CapsLock|NumLock|ScrollLock|Dead|Process|Unidentified)$/.test(
                event.key,
              ) &&
              !ref3.current
            ) {
              current3.onDone(true);
            }
            return;
          }
          event.preventDefault();
          event.stopImmediatePropagation();
          if (ref3.current) {
            if (event.key === "Escape") {
              return callback2(true);
            } else {
              return undefined;
            }
          }
          if (value19) {
            let value20 = (event.shiftKey ? 10 : 1) / current3.scale;
            callback(
              (0, runtime.panImageCrop)(
                current3.frame,
                current3.natural,
                current3.crop,
                value19[0] * value20,
                value19[1] * value20,
              ),
            );
          } else if (value18 !== 0) {
            if (current3.zoomDisabledReason === undefined) {
              callback(
                (0, runtime.zoomImageCrop)(
                  current3.frame,
                  current3.natural,
                  current3.crop,
                  value18,
                ),
              );
            } else {
              (0, runtime.announceLiveMessage)(current3.zoomDisabledReason);
            }
          } else if (!value17) {
            current3.onDone(true);
          } else if (event.key.toLowerCase() === "z" && !event.shiftKey) {
            current3.onDone(false);
          }
        },
        callback9 = (event: PointerEvent): void => {
          let value17 =
            event.target instanceof Element ? event.target : null;
          if (ref5.current) {
            return;
          }
          if (
            event.button === 0 &&
            !ref2.current?.contains(value17) &&
            !value17?.closest("[data-media-crop-keep]")
          ) {
            ref.current.onDone(true);
          }
        },
        callback10 = (input: number, options: number, context: number): void => {
          let current3 = ref.current,
            current4 = ref2.current;
          if (!current4 || ref3.current || ref5.current) {
            return;
          }
          let bounds = current4.getBoundingClientRect(),
            [items5, items6] = [
              (input - (bounds.left + bounds.width / 2)) / current3.scale,
              (options - (bounds.top + bounds.height / 2)) / current3.scale,
            ],
            [items7, items8] = [
              Math.cos(-current3.rotation),
              Math.sin(-current3.rotation),
            ],
            state6: CropPoint = {
              x: current3.frame.w / 2 + items5 * items7 - items6 * items8,
              y: current3.frame.h / 2 + items5 * items8 + items6 * items7,
            },
            value17: ImageCrop = (0, runtime.zoomImageCrop)(
              current3.frame,
              current3.natural,
              current3.crop,
              Math.min(2, Math.max(0.5, context)),
              state6,
            );
          if (!(0, runtime.imageCropsEqual)(value17, current3.crop)) {
            current3.onLive(value17);
          }
        },
        [items3, items4] = [0, 0],
        callback11 = (event: Event): void => {
          event.preventDefault();
          return event.stopPropagation();
        },
        callback12 = (input: WheelEvent): void => {
          if (
            !(input.ctrlKey || input.metaKey) ||
            ref.current.zoomDisabledReason !== undefined
          ) {
            return;
          }
          callback11(input);
          if (items3 !== 0 && Date.now() - items4 > 1000) {
            items3 = 0;
          }
          if (items3 === 0) {
            callback10(
              input.clientX,
              input.clientY,
              Math.exp(-input.deltaY * CROP_CHANGE_EPSILON),
            );
          }
        },
        callback13 = (): boolean =>
          ref.current.zoomDisabledReason !== undefined,
        callback14 = (input: Event): void =>
          void (
            callback13() ||
            (callback11(input), ([items3, items4] = [1, Date.now()]))
          ),
        callback15 = (input: Event): void => {
          if (callback13()) {
            return;
          }
          callback11(input);
          let value17 = input as CropGestureEvent;
          if (
            items3 === 0 ||
            !(typeof value17.scale === "number" && value17.scale > 0)
          ) {
            return;
          }
          callback10(
            value17.clientX ?? 0,
            value17.clientY ?? 0,
            value17.scale / items3,
          );
          [items3, items4] = [value17.scale, Date.now()];
        },
        callback16 = (input: Event): void =>
          void (callback13() || (callback11(input), (items3 = 0))),
        current2 = ref2.current;
      window.addEventListener("keydown", callback8, true);
      window.addEventListener("pointerdown", callback9, true);
      current2?.addEventListener("wheel", callback12, {
        passive: false,
      });
      current2?.addEventListener("gesturestart", callback14);
      current2?.addEventListener("gesturechange", callback15);
      current2?.addEventListener("gestureend", callback16);
      return (): void => {
        window.removeEventListener("keydown", callback8, true);
        window.removeEventListener("pointerdown", callback9, true);
        current2?.removeEventListener("wheel", callback12);
        current2?.removeEventListener("gesturestart", callback14);
        current2?.removeEventListener("gesturechange", callback15);
        current2?.removeEventListener("gestureend", callback16);
        callback2(false);
      };
    }, []);
    let callback3 = (
        event: ReactPointerEvent<Element>,
        options: CropDrag,
      ): void => {
        if (event.button !== 0 || ref3.current) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {}
        ref3.current = {
          pid: event.pointerId,
          el: event.currentTarget,
          sx: event.clientX,
          sy: event.clientY,
          start: ref.current.crop,
          frame: {
            w: frame.w,
            h: frame.h,
          },
          base: {
            ...ref4.current,
          },
          drag: options,
        };
        value2(true);
        onGesture?.(true);
      },
      callback4 = (input: ReactPointerEvent<Element>): void => {
        let current = ref3.current;
        if (!current || input.pointerId !== current.pid) {
          return;
        }
        let [items3, items4] = [
            (input.clientX - current.sx) / scale,
            (input.clientY - current.sy) / scale,
          ],
          [items5, items6] = [
            Math.cos(-rotation),
            Math.sin(-rotation),
          ],
          [items7, items8] = [
            items3 * items5 - items4 * items6,
            items3 * items6 + items4 * items5,
          ];
        if (current.drag.of === "side") {
          let value17: { crop: ImageCrop; frame: CropBox } = (
              0,
              runtime.resizeCropViewport
            )(
              current.frame,
              natural,
              current.start,
              current.drag.side,
              items7,
              items8,
              Math.max(CROP_HANDLE_SIZE / scale, minFrame),
            ),
            state6: CropBox = {
              x: current.base.x + value17.frame.x,
              y: current.base.y + value17.frame.y,
              w: value17.frame.w,
              h: value17.frame.h,
            },
            value18: CropBox = snapFrame ? snapFrame(state6) : state6,
            value19: ImageCrop = snapFrame
              ? (0, runtime.cropImageToRect)(
                  current.frame,
                  natural,
                  current.start,
                  {
                    x: value18.x - current.base.x,
                    y: value18.y - current.base.y,
                    w: value18.w,
                    h: value18.h,
                  },
                )
              : value17.crop;
          if (
            zoomDisabledReason === undefined ||
            value19.zoom <= Math.max(1, current.start.zoom) + 0.001
          ) {
            callback(value19, value18);
          }
        } else {
          callback(
            current.drag.of === "media"
              ? (0, runtime.panImageCrop)(
                  current.frame,
                  natural,
                  current.start,
                  items7,
                  items8,
                )
              : (0, runtime.resizeImageCropFromCorner)(
                  current.frame,
                  natural,
                  current.start,
                  current.drag.corner,
                  items7,
                  items8,
                ),
          );
        }
      },
      callback5 = (
        input: CropDrag,
        options?: () => void,
      ): CropPointerHandlers => ({
        onPointerDown: (input2: ReactPointerEvent<Element>) =>
          void (input2.button === 0 && (options?.(), callback3(input2, input))),
        onPointerMove: callback4,
        onPointerUp: (input2: ReactPointerEvent<Element>) =>
          ref3.current?.pid === input2.pointerId && callback2(false),
        onPointerCancel: (input2: ReactPointerEvent<Element>) =>
          ref3.current?.pid === input2.pointerId && callback2(true),
        onLostPointerCapture: (input2: ReactPointerEvent<Element>): void => {
          if (ref3.current?.pid !== input2.pointerId) {
            return;
          }
          if (input2.buttons === 0) {
            return callback2(false);
          }
          try {
            input2.currentTarget.setPointerCapture(input2.pointerId);
          } catch {
            callback2(false);
          }
        },
      }),
      callback6 = (input: CropHandle): CropPointerHandlers => {
        let value17 = callback5(
          {
            of: "side",
            side: input,
          },
          (): void => value4(false),
        );
        return {
          ...value17,
          onPointerDown: (input2: ReactPointerEvent<Element>): void => {
            if (input2.button !== 0 || !onSideStart?.(input, input2)) {
              return value17.onPointerDown(input2);
            }
            value4(false);
            ref5.current = true;
            let pointerId = input2.pointerId,
              callback8 = (): void => {
                ref5.current = false;
                window.removeEventListener("pointerup", callback9, true);
                window.removeEventListener("pointercancel", callback9, true);
                window.removeEventListener("blur", callback8);
              },
              callback9 = (input3: PointerEvent): void =>
                void (input3.pointerId === pointerId && callback8());
            window.addEventListener("pointerup", callback9, true);
            window.addEventListener("pointercancel", callback9, true);
            window.addEventListener("blur", callback8);
          },
        };
      },
      callback7 = (
        input: string | undefined,
      ): Pick<CropPointerHandlers, "onPointerDown"> => ({
        onPointerDown: (event: ReactPointerEvent<Element>): void => {
          event.preventDefault();
          event.stopPropagation();
          return (0, runtime.announceLiveMessage)(input);
        },
      }),
      value5: CropBox = (0, runtime.imageCropRect)(frame, natural, crop),
      value6: boolean =
        typeof matchMedia === "function" &&
        matchMedia("(pointer: coarse)").matches,
      value7: number =
        (value6
          ? runtime.SELECTION_POINT_METRICS.gripHitTouch
          : runtime.SELECTION_POINT_METRICS.grip + 4) / scale,
      value8: number = runtime.SELECTION_POINT_METRICS.grip / scale,
      value9: number =
        (value6 ? runtime.SELECTION_POINT_METRICS.gripHitTouch : 20) / scale,
      value10: boolean = zoomDisabledReason !== undefined,
      value11: boolean = onFrame !== undefined,
      [items, items2] = [
        CROP_HANDLE_VISUAL_SIZE / scale,
        CROP_HANDLE_BORDER_WIDTH / scale,
      ],
      state: CSSProperties = {
        position: "absolute",
        background: "var(--t-app-accent)",
        boxShadow: "0 0 0 " + String(1 / scale) + "px #fff",
        borderRadius: items2 / 2,
      },
      state2: CSSProperties = {
        ...state,
        boxShadow: undefined,
      },
      state3: CSSProperties = {
        ...state,
        background: "#fff",
      },
      [value12, value13, value14, value15] = [
        -value5.x,
        -value5.y,
        -value5.x + frame.w,
        -value5.y + frame.h,
      ].map((input: number): string => String(input) + "px"),
      value16: string = `polygon(evenodd, 0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${value12} ${value13}, ${value12} ${value15}, ${value14} ${value15}, ${value14} ${value13}, ${value12} ${value13})`,
      state4: CSSProperties = {
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        opacity: CROP_DRAG_OPACITY,
        pointerEvents: "none",
        userSelect: "none",
        clipPath: value16,
      },
      state5: CSSProperties = {
        position: "absolute",
        cursor: value ? "grabbing" : "grab",
        touchAction: "none",
        pointerEvents: "auto",
      };
    return jsxR4.jsxs("div", {
      ref: ref2,
      "data-media-crop": "",
      role: "group",
      "aria-label": "Crop",
      style: {
        position: "absolute",
        inset: 0,
      },
      children: [
        jsxR4.jsx("div", {
          "data-media-crop-pan": "",
          style: {
            ...state5,
            left: value5.x,
            top: value5.y,
            width: value5.w,
            height: value5.h,
          },
          ...callback5(
            {
              of: "media",
            },
            (): void => value4(true),
          ),
          children:
            src !== null &&
            (video
              ? jsxR4.jsx("video", {
                  src: src,
                  muted: true,
                  playsInline: true,
                  preload: "metadata",
                  style: state4,
                })
              : jsxR4.jsx("img", {
                  src: src,
                  alt: "",
                  draggable: false,
                  style: state4,
                })),
        }),
        value11 &&
          jsxR4.jsx("div", {
            "data-media-crop-inside": "",
            style: {
              ...state5,
              inset: 0,
            },
            ...callback5(
              {
                of: "media",
              },
              (): void => value4(false),
            ),
          }),
        jsxR4.jsx("div", {
          style: {
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            outlineWidth: runtime.SELECTION_POINT_METRICS.ring / scale,
            outlineStyle: "solid",
            outlineColor: "var(--t-app-accent)",
          },
        }),
        value11 &&
          value3 &&
          jsxR4.jsx("div", {
            style: {
              position: "absolute",
              left: value5.x,
              top: value5.y,
              width: value5.w,
              height: value5.h,
              pointerEvents: "none",
              outlineWidth: 1 / scale,
              outlineStyle: "solid",
              outlineColor: "var(--t-app-accent)",
            },
          }),
        value11 &&
          CROP_ALL_HANDLES.map((items3: CropHandle): ReactElement | null => {
            let value17 = frameHandleOff?.[items3],
              value18: boolean = items3.length === 2;
            if (
              !value18 &&
              (items3 === "n" || items3 === "s" ? frame.w : frame.h) * scale <
                CROP_TOUCH_HANDLE_SIZE
            ) {
              return null;
            }
            let [items4, items5] = [
                items3.includes("w")
                  ? 0
                  : items3.includes("e")
                    ? frame.w
                    : frame.w / 2,
                items3.includes("n")
                  ? 0
                  : items3.includes("s")
                    ? frame.h
                    : frame.h / 2,
              ],
              value19: number = items3.includes("e") ? -1 : 1,
              value20: number = items3.includes("s") ? -1 : 1,
              [items6, items7] = [
                value19 > 0
                  ? value9 / 2 - items2 / 2
                  : value9 / 2 + items2 / 2 - items,
                value20 > 0
                  ? value9 / 2 - items2 / 2
                  : value9 / 2 + items2 / 2 - items,
              ];
            return jsxR4.jsx(
              "div",
              {
                "data-media-crop-side": items3,
                role: "img",
                "aria-label": "Crop handle, " + CROP_HANDLE_LABELS[items3],
                title: value17 ?? "Drag to crop.",
                "aria-disabled": value17 !== undefined || undefined,
                style: {
                  position: "absolute",
                  left: items4 - value9 / 2,
                  top: items5 - value9 / 2,
                  width: value9,
                  height: value9,
                  cursor:
                    value17 !== undefined
                      ? "not-allowed"
                      : CROP_HANDLE_CURSORS[items3],
                  touchAction: "none",
                  pointerEvents: "auto",
                  opacity: value17 !== undefined ? 0.45 : undefined,
                },
                ...(value17 !== undefined
                  ? callback7(value17)
                  : callback6(items3)),
                children: value18
                  ? [state3, state2].map(
                      (input: CSSProperties, options: number): ReactElement =>
                        jsxR4.jsxs(
                          reactqY.Fragment,
                          {
                            children: [
                              jsxR4.jsx("div", {
                                style: {
                                  ...input,
                                  left: items6,
                                  top: value9 / 2 - items2 / 2,
                                  width: items,
                                  height: items2,
                                },
                              }),
                              jsxR4.jsx("div", {
                                style: {
                                  ...input,
                                  left: value9 / 2 - items2 / 2,
                                  top: items7,
                                  width: items2,
                                  height: items,
                                },
                              }),
                            ],
                          },
                          options,
                        ),
                    )
                  : items3 === "n" || items3 === "s"
                    ? jsxR4.jsx("div", {
                        style: {
                          ...state,
                          width: items * 1.5,
                          height: items2,
                          left: value9 / 2 - (items * 1.5) / 2,
                          top: value9 / 2 - items2 / 2,
                        },
                      })
                    : jsxR4.jsx("div", {
                        style: {
                          ...state,
                          width: items2,
                          height: items * 1.5,
                          left: value9 / 2 - items2 / 2,
                          top: value9 / 2 - (items * 1.5) / 2,
                        },
                      }),
              },
              items3,
            );
          }),
        (!value11 || value3) &&
          CROP_CORNER_HANDLES.map(
            (input: CropCornerHandle): ReactElement =>
              jsxR4.jsx(
                "div",
                {
                  "data-media-crop-handle": input,
                  role: "img",
                  "aria-label": "Zoom handle, " + CROP_CORNER_LABELS[input],
                  title: zoomDisabledReason ?? "Drag to zoom.",
                  "aria-disabled": value10 || undefined,
                  style: {
                    position: "absolute",
                    left:
                      (input === "nw" || input === "sw"
                        ? value5.x
                        : value5.x + value5.w) -
                      value7 / 2,
                    top:
                      (input === "nw" || input === "ne"
                        ? value5.y
                        : value5.y + value5.h) -
                      value7 / 2,
                    width: value7,
                    height: value7,
                    display: "grid",
                    placeItems: "center",
                    cursor: value10
                      ? "not-allowed"
                      : input === "nw" || input === "se"
                        ? "nwse-resize"
                        : "nesw-resize",
                    touchAction: "none",
                    pointerEvents: "auto",
                  },
                  ...(value10
                    ? callback7(zoomDisabledReason)
                    : callback5({
                        of: "corner",
                        corner: input,
                      })),
                  children: jsxR4.jsx("div", {
                    style: {
                      width: value8,
                      height: value8,
                      boxSizing: "border-box",
                      borderRadius: "50%",
                      background: "#fff",
                      borderWidth: 1.5 / scale,
                      borderStyle: "solid",
                      borderColor: "var(--t-app-accent)",
                      opacity: value10 ? 0.45 : undefined,
                    },
                  }),
                },
                input,
              ),
          ),
      ],
    });
  }
  bindRuntimeValue(
    runtime,
    "reactqY",
    () => reactqY,
    (value) => {
      reactqY = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxR4",
    () => jsxR4,
    (value) => {
      jsxR4 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CROP_CORNER_HANDLES",
    () => CROP_CORNER_HANDLES,
    (value) => {
      CROP_CORNER_HANDLES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CROP_ALL_HANDLES",
    () => CROP_ALL_HANDLES,
    (value) => {
      CROP_ALL_HANDLES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CROP_HANDLE_LABELS",
    () => CROP_HANDLE_LABELS,
    (value) => {
      CROP_HANDLE_LABELS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CROP_CORNER_LABELS",
    () => CROP_CORNER_LABELS,
    (value) => {
      CROP_CORNER_LABELS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CROP_HANDLE_CURSORS",
    () => CROP_HANDLE_CURSORS,
    (value) => {
      CROP_HANDLE_CURSORS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CROP_CHANGE_EPSILON",
    () => CROP_CHANGE_EPSILON,
    (value) => {
      CROP_CHANGE_EPSILON = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CROP_HANDLE_SIZE",
    () => CROP_HANDLE_SIZE,
    (value) => {
      CROP_HANDLE_SIZE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CROP_HANDLE_VISUAL_SIZE",
    () => CROP_HANDLE_VISUAL_SIZE,
    (value) => {
      CROP_HANDLE_VISUAL_SIZE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CROP_HANDLE_BORDER_WIDTH",
    () => CROP_HANDLE_BORDER_WIDTH,
    (value) => {
      CROP_HANDLE_BORDER_WIDTH = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CROP_TOUCH_HANDLE_SIZE",
    () => CROP_TOUCH_HANDLE_SIZE,
    (value) => {
      CROP_TOUCH_HANDLE_SIZE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CROP_DRAG_OPACITY",
    () => CROP_DRAG_OPACITY,
    (value) => {
      CROP_DRAG_OPACITY = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CROP_ZOOM_STEP",
    () => CROP_ZOOM_STEP,
    (value) => {
      CROP_ZOOM_STEP = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CROP_ARROW_DELTAS",
    () => CROP_ARROW_DELTAS,
    (value) => {
      CROP_ARROW_DELTAS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "blurCropEditingTarget",
    () => blurCropEditingTarget,
  );
  bindRuntimeValue(runtime, "MediaCropOverlay", () => MediaCropOverlay);
  return () => {
    (0, runtime.initializeUiInputs210)();
    (0, runtime.initializeUiAnnouncements)();
    (0, runtime.initializeImageCrop)();
    reactqY = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    jsxR4 = (0, runtime.toModuleNamespace)((0, runtime.loadJsxNamespace)(), 1);
    CROP_CORNER_HANDLES = ["nw", "ne", "se", "sw"];
    CROP_ALL_HANDLES = ["n", "e", "s", "w", "nw", "ne", "se", "sw"];
    CROP_HANDLE_LABELS = {
      n: "top edge",
      e: "right edge",
      s: "bottom edge",
      w: "left edge",
      nw: "top left",
      ne: "top right",
      se: "bottom right",
      sw: "bottom left",
    };
    CROP_CORNER_LABELS = {
      nw: "top left",
      ne: "top right",
      se: "bottom right",
      sw: "bottom left",
    };
    CROP_HANDLE_CURSORS = {
      n: "ns-resize",
      s: "ns-resize",
      e: "ew-resize",
      w: "ew-resize",
      nw: "nwse-resize",
      se: "nwse-resize",
      ne: "nesw-resize",
      sw: "nesw-resize",
    };
    CROP_CHANGE_EPSILON = 0.005;
    [
      CROP_HANDLE_SIZE,
      CROP_HANDLE_VISUAL_SIZE,
      CROP_HANDLE_BORDER_WIDTH,
      CROP_TOUCH_HANDLE_SIZE,
    ] = [16, 12, 3, 44];
    CROP_DRAG_OPACITY = 0.35;
    CROP_ZOOM_STEP = 1.1;
    CROP_ARROW_DELTAS = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
  };
}
