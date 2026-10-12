/** Restored application module; prepare first, initialize in original order. */
import type { ReactElement } from "react";
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type ReactNamespace,
} from "../bindings";
import type {
  Axis,
  Frame,
  ImageCrop,
  ImageNode,
  Slide,
  SlideId,
  SlideNode,
  TransformValue,
} from "../deck-contracts";
import type { NodePath, NodeSelection } from "../layout/selection-groups";

/** Position and size of a box, in px. */
export interface CropBox {
  x: number;
  y: number;
  w: number;
  h: number;
}
/** Width and height of a box, in px. */
export interface CropSize {
  w: number;
  h: number;
}
/** Identifies the image being cropped, so an edit elsewhere can be told apart from a crop target change. */
export interface CropImageLocation {
  key: string;
  file: string | undefined;
}
/** Who decides the size of a cropped image: its own width/height, its container, or nobody. */
export type CropSizeOwnership = "own" | "frozen" | "none";
/** Reasons the handles of a cropped frame are off, by handle name. */
export type CropHandlesOff = Record<string, string>;
/** An open crop session on one image. */
export interface CropSession {
  unit: NodeSelection;
  slideId: SlideId;
  /** Where the image sits in the slide; a change ends the session. */
  identity: string;
  file: string | undefined;
  /** The image box when the session began. */
  frame: CropBox;
  size: CropSize;
  natural: CropSize;
  /** The crop the image had when the session began. */
  opened: ImageCrop | undefined;
  /** The crop being dragged. */
  live: ImageCrop;
  /** The frame being dragged, relative to the original frame. */
  local: CropBox;
}
/** A frame and crop change from dragging the crop frame handles. */
export interface CropFrameChange {
  frame: CropBox;
  crop: ImageCrop;
}
export interface MediaCropSessionOptions {
  slide: Slide;
  selection: readonly NodeSelection[];
  assets: ReadonlyMap<string, string>;
  editable: boolean;
  busy: boolean;
  /** The rendered element of one frame. */
  frameEl(frameId: string): Element | null | undefined;
  /** The element whose image loads can make an unavailable picture croppable. */
  root(): EventTarget | null;
  onCommit?: (slide: Slide) => void;
}
export interface MediaCropSessionController {
  session: CropSession | null;
  /** The slide with the live crop applied, while a session is open. */
  slide: Slide | null;
  /** Why the unit cannot be cropped, or undefined when it can. */
  reason(unit: NodeSelection): string | undefined;
  /** Opens a session; false when the unit cannot be cropped right now. */
  begin(unit: NodeSelection): boolean;
  end(commit: boolean): void;
  setLive(crop: ImageCrop): void;
  setFrame(change: CropFrameChange): void;
  /** False when frame handles are unavailable; otherwise the handles that are off, with reasons. */
  handlesOff: false | CropHandlesOff;
}

declare module "../bindings" {
  interface RuntimeBindings {
    reactp4: ReactNamespace;
    announceSlideStatus: (text: string, page?: Document) => void;
    CROP_IMAGE_UNAVAILABLE_REASON: string;
    CROP_IMAGE_EMPTY_REASON: string;
    CROP_SVG_REASON: string;
    CROP_VIDEO_NO_POSTER_REASON: string;
    CROP_TRANSFORM_REASON: string;
    CROP_GROUP_SIZE_REASON: string;
    CROP_LAYOUT_REASON: string;
    cropImageSource: (
      node: ImageNode,
      assets: ReadonlyMap<string, string>,
    ) => string | undefined;
    cropImageLocation: (
      slide: Slide,
      at: NodeSelection,
      source: ReadonlyMap<string, string>,
    ) => CropImageLocation | undefined;
    matchesCropImageIdentity: (
      identity: CropImageLocation | undefined,
      current: Pick<CropSession, "identity" | "file">,
    ) => boolean;
    cropImageSizeOwnership: (
      slide: Slide,
      at: NodeSelection,
    ) => CropSizeOwnership;
    materializeCropImageSize: (
      slide: Slide,
      at: NodeSelection,
      rectangle: CropSize,
    ) => Slide | null;
    hasCropTransform: (transform: TransformValue | undefined) => boolean;
    cropImageTransformSupport: (
      slide: Slide,
      at: NodeSelection,
    ) => false | CropHandlesOff;
    applyCropFrameChange: (
      slide: Slide,
      at: NodeSelection,
      previous: CropBox,
      next: CropBox,
      natural: CropSize,
    ) => Slide;
    cropImageElements: (
      surface: Element | null | undefined,
      at: NodeSelection,
    ) => { box: HTMLElement; img: HTMLImageElement } | null;
    computedCropFrameSize: (element: Element) => CropSize;
    useMediaCropSession: (
      options: MediaCropSessionOptions,
    ) => MediaCropSessionController;
  }
}

export function installEditorMediaCropSession(
  runtime: RuntimeBindings,
): () => void {
  var reactp4: ReactNamespace;
  var CROP_IMAGE_UNAVAILABLE_REASON: RuntimeBindings["CROP_IMAGE_UNAVAILABLE_REASON"];
  var CROP_IMAGE_EMPTY_REASON: RuntimeBindings["CROP_IMAGE_EMPTY_REASON"];
  var CROP_SVG_REASON: RuntimeBindings["CROP_SVG_REASON"];
  var CROP_VIDEO_NO_POSTER_REASON: RuntimeBindings["CROP_VIDEO_NO_POSTER_REASON"];
  var CROP_TRANSFORM_REASON: RuntimeBindings["CROP_TRANSFORM_REASON"];
  var CROP_GROUP_SIZE_REASON: RuntimeBindings["CROP_GROUP_SIZE_REASON"];
  var CROP_LAYOUT_REASON: RuntimeBindings["CROP_LAYOUT_REASON"];
  var cropImageSource: RuntimeBindings["cropImageSource"];
  var matchesCropImageIdentity: RuntimeBindings["matchesCropImageIdentity"];
  var hasCropTransform: RuntimeBindings["hasCropTransform"];
  function announceSlideStatus(text: string, page: Document = document): void {
    let value = page.getElementById("slides-announcer");
    if (value === null) {
      value = page.createElement("div");
      value.id = "slides-announcer";
      value.setAttribute("role", "status");
      value.setAttribute("aria-live", "polite");
      value.style.cssText =
        "position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0";
      page.body.appendChild(value);
    }
    let value2 = value;
    value2.textContent = "";
    (page.defaultView ?? globalThis).setTimeout((): void => {
      value2.textContent = text;
    }, 50);
  }
  function cropImageLocation(
    slide: Slide,
    at: NodeSelection,
    source: ReadonlyMap<string, string>,
  ): CropImageLocation | undefined {
    let value: Frame | undefined = (0, runtime.frameById)(slide, at.frameId),
      value2: NodePath = (0, runtime.selectionNodePath)(at),
      value3: SlideNode | undefined = value?.node,
      value4: SlideNode | undefined,
      items: number[] = [];
    for (let value7 of value2) {
      let value8 = value3 && (0, runtime.nodeChildren)(value3);
      if (!value8) {
        return;
      }
      items.push(value8.length);
      value4 = value3;
      value3 = value8[value7];
    }
    if (!value || value3?.kind !== "img") {
      return;
    }
    let callback = (input: number | undefined): string =>
        input === undefined ? "" : String(Math.round(input * 100) / 100),
      value5 =
        value4 &&
        (0, runtime.isOverlayNode)(value4) &&
        value2[value2.length - 1]! >= 1
          ? value4.layers[value2[value2.length - 1]! - 1]
          : undefined,
      callback2 = (input: Axis, options: number | undefined): string =>
        input.anchor !== "fill"
          ? callback(input.size)
          : options === undefined
            ? "fill"
            : callback(options - (2 * Math.round(input.margin * 100)) / 100),
      value6 =
        value2.length === 0
          ? callback2(value.x, runtime.SLIDE_WIDTH) +
            "x" +
            callback2(value.y, runtime.SLIDE_HEIGHT)
          : value5
            ? callback2(value5.x, undefined) +
              "x" +
              callback2(value5.y, undefined)
            : callback(value3.w) + "x" + callback(value3.h);
    return {
      key: items.join("/") + "|" + (value3.video ?? "") + "|" + value6,
      file: cropImageSource(value3, source),
    };
  }
  function cropImageSizeOwnership(
    slide: Slide,
    at: NodeSelection,
  ): CropSizeOwnership {
    let value: Frame | undefined = (0, runtime.frameById)(slide, at.frameId),
      value2: NodePath = (0, runtime.selectionNodePath)(at),
      value3: SlideNode | undefined =
        value && (0, runtime.nodeAtPath)(value.node, value2);
    if (!value || value3?.kind !== "img") {
      return "none";
    }
    if (value2.length === 0) {
      if ((0, runtime.axisSpecsAreSized)(value.x, value.y)) {
        return "own";
      } else {
        return "frozen";
      }
    }
    let value4: SlideNode | undefined = (0, runtime.nodeAtPath)(
        value.node,
        value2.slice(0, -1),
      ),
      value5 = value2[value2.length - 1]!,
      value6 = value3.w !== undefined && value3.h !== undefined;
    if (value4 && (0, runtime.isOverlayNode)(value4)) {
      if (value5 >= 1) {
        if (
          (0, runtime.axisSpecsAreSized)(
            value4.layers[value5 - 1]!.x,
            value4.layers[value5 - 1]!.y,
          )
        ) {
          return "own";
        } else {
          return "none";
        }
      }
      let value7: SlideNode | undefined =
        value2.length >= 2
          ? (0, runtime.nodeAtPath)(value.node, value2.slice(0, -2))
          : undefined;
      if (
        value6 &&
        value7 !== undefined &&
        (0, runtime.isFlowContainer)(value7)
      ) {
        return "own";
      } else {
        return "none";
      }
    }
    if (!value4 || !(0, runtime.isFlowContainer)(value4)) {
      return "none";
    }
    if (value6) {
      return "own";
    } else {
      if ((0, runtime.nodeSupportsSizing)(value3)) {
        return "frozen";
      } else {
        return "none";
      }
    }
  }
  function materializeCropImageSize(
    slide: Slide,
    at: NodeSelection,
    rectangle: CropSize,
  ): Slide | null {
    let value = cropImageSizeOwnership(slide, at);
    if (value === "own") {
      return slide;
    }
    if (value === "none" || !(rectangle.w > 0 && rectangle.h > 0)) {
      return null;
    }
    let value2: NodePath = (0, runtime.selectionNodePath)(at);
    if (value2.length === 0) {
      return (0, runtime.updateSlideFrame)(
        slide,
        at.frameId,
        (input: Frame): Frame => ({
          ...input,
          x: {
            ...input.x,
            size: input.x.size ?? rectangle.w,
          },
          y: {
            ...input.y,
            size: input.y.size ?? rectangle.h,
          },
        }),
      );
    }
    let value3: SlideNode = (0, runtime.nodeAtPath)(
        (0, runtime.frameById)(slide, at.frameId)!.node,
        value2.slice(0, -1),
      )!,
      value4: "x" | "y" | undefined =
        value3.kind === "stack" ? (value3.dir === "h" ? "x" : "y") : undefined;
    return (0, runtime.updateSelectedNode)(
      slide,
      at,
      (source: SlideNode): SlideNode => {
        if (source.kind !== "img") {
          return source;
        }
        let value5: SlideNode =
          source.w !== undefined
            ? source
            : (0, runtime.setNodeAxisSize)(source, "x", rectangle.w, value4);
        if (source.h !== undefined) {
          return value5;
        } else {
          return (0, runtime.setNodeAxisSize)(value5, "y", rectangle.h, value4);
        }
      },
    );
  }
  function cropImageTransformSupport(
    slide: Slide,
    at: NodeSelection,
  ): false | CropHandlesOff {
    let value: NodePath = (0, runtime.selectionNodePath)(at),
      value2: Frame | undefined = (0, runtime.frameById)(slide, at.frameId);
    if (!value2) {
      return {};
    }
    let value3: TransformValue | undefined = (0, runtime.nodeTransform)(
      (0, runtime.nodeAtPath)(value2.node, value),
    );
    if (value.length === 0) {
      if (value3?.skewX || value3?.skewY) {
        return false;
      } else {
        return {};
      }
    }
    let value4: SlideNode | undefined = (0, runtime.nodeAtPath)(
      value2.node,
      value.slice(0, -1),
    );
    if (
      !value4 ||
      !(0, runtime.isFlowContainer)(value4) ||
      hasCropTransform(value3)
    ) {
      return false;
    }
    return Object.fromEntries(
      ["n", "w", "nw", "ne", "sw"].map(
        (input: string): [string, string] => [input, CROP_LAYOUT_REASON],
      ),
    );
  }
  function applyCropFrameChange(
    slide: Slide,
    at: NodeSelection,
    previous: CropBox,
    next: CropBox,
    natural: CropSize,
  ): Slide {
    let [items, items2] = [next.w - previous.w, next.h - previous.h];
    if (next.x === 0 && next.y === 0 && items === 0 && items2 === 0) {
      return slide;
    }
    let value: Frame | undefined = (0, runtime.frameById)(slide, at.frameId),
      value2: SlideNode | undefined =
        value &&
        (0, runtime.nodeAtPath)(value.node, (0, runtime.selectionNodePath)(at));
    if (!value || value2?.kind !== "img") {
      return slide;
    }
    if ((0, runtime.selectionNodePath)(at).length === 0) {
      let value5 = (0, runtime.frameBounds)(value.x, value.y),
        value6: TransformValue | undefined = (0, runtime.nodeTransform)(value2),
        state = {
          x: next.x + items / 2,
          y: next.y + items2 / 2,
        },
        value7 = (0, runtime.transformPositionCompensation)(
          state.x,
          state.y,
          ((value6?.rotate ?? 0) * Math.PI) / 180,
          value6?.scale ?? 1,
        ),
        [items3, items4]: [number, number] = [
          value5.x + next.x + value7.dx,
          value5.y + next.y + value7.dy,
        ],
        [items5, items6] = [
          items3 === value5.x && items === 0,
          items4 === value5.y && items2 === 0,
        ];
      return (0, runtime.updateSlideFrame)(
        slide,
        value.id,
        (input: Frame): Frame => ({
          ...input,
          x: items5
            ? input.x
            : (0, runtime.axisSpecFromRect)(
                input.x,
                items3,
                Math.max(1, value5.w + items),
                runtime.SLIDE_WIDTH,
              ),
          y: items6
            ? input.y
            : (0, runtime.axisSpecFromRect)(
                input.y,
                items4,
                Math.max(1, value5.h + items2),
                runtime.SLIDE_HEIGHT,
              ),
        }),
      );
    }
    let value3: SlideNode | undefined = (0, runtime.nodeAtPath)(
      value.node,
      (0, runtime.selectionNodePath)(at).slice(0, -1),
    );
    if (!value3 || !(0, runtime.isFlowContainer)(value3)) {
      return slide;
    }
    let value4: "x" | "y" | undefined =
      value3.kind === "stack" ? (value3.dir === "h" ? "x" : "y") : undefined;
    return (0, runtime.updateSelectedNode)(
      slide,
      at,
      (input: SlideNode): SlideNode => {
        let value5: SlideNode =
          items === 0
            ? input
            : (0, runtime.setNodeAxisSize)(
                input,
                "x",
                natural.w + items,
                value4,
              );
        if (items2 === 0) {
          return value5;
        } else {
          return (0, runtime.setNodeAxisSize)(
            value5,
            "y",
            natural.h + items2,
            value4,
          );
        }
      },
    );
  }
  function cropImageElements(
    surface: Element | null | undefined,
    at: NodeSelection,
  ): { box: HTMLElement; img: HTMLImageElement } | null {
    let value = surface?.querySelector<HTMLElement>(
        '[data-img-path="' +
          (0, runtime.selectionNodePath)(at).join(".") +
          '"]',
      ),
      value2 =
        value?.tagName === "IMG"
          ? (value as HTMLImageElement)
          : value?.querySelector("img");
    if (
      value &&
      value2 &&
      value2.naturalWidth > 0 &&
      value2.naturalHeight > 0
    ) {
      return {
        box: value,
        img: value2,
      };
    } else {
      return null;
    }
  }
  function computedCropFrameSize(element: Element): CropSize {
    let value = getComputedStyle(element),
      callback = (input: string): number =>
        Math.round(parseFloat(input) * 100) / 100 || 0;
    return {
      w: callback(value.width),
      h: callback(value.height),
    };
  }
  function useMediaCropSession(
    options: MediaCropSessionOptions,
  ): MediaCropSessionController {
    let [value, value2] = reactp4.useState<CropSession | null>(null),
      ref = reactp4.useRef<
        MediaCropSessionOptions & { session: CropSession | null }
      >({
        ...options,
        session: value,
      });
    ref.current = {
      ...options,
      session: value,
    };
    let ref2 = reactp4.useRef<Slide | null>(null);
    if (value !== null && options.slide.id === value.slideId) {
      ref2.current = options.slide;
    }
    let callback = (input: NodeSelection): string | undefined => {
        let value8: SlideNode | undefined = (0, runtime.selectedNode)(
          options.slide,
          input,
        );
        if (value8?.kind !== "img" || !(0, runtime.imageHasMedia)(value8)) {
          return CROP_IMAGE_EMPTY_REASON;
        }
        if (
          cropImageSource(value8, options.assets)?.startsWith(
            "data:image/svg+xml",
          ) === true
        ) {
          return CROP_SVG_REASON;
        }
        if (
          (value8.video !== undefined || value8.videoLink !== undefined) &&
          cropImageSource(value8, options.assets) === undefined
        ) {
          return CROP_VIDEO_NO_POSTER_REASON;
        }
        let value9: SlideNode | undefined = (0, runtime.frameById)(
          options.slide,
          input.frameId,
        )?.node;
        if (
          value9 &&
          (0, runtime.selectionNodePath)(input).some(
            (input2: number, options2: number, context: NodePath): boolean =>
              hasCropTransform(
                (0, runtime.nodeTransform)(
                  (0, runtime.nodeAtPath)(value9, context.slice(0, options2)),
                ),
              ),
          )
        ) {
          return CROP_TRANSFORM_REASON;
        }
        if (!cropImageElements(options.frameEl(input.frameId), input)) {
          return CROP_IMAGE_UNAVAILABLE_REASON;
        }
        if (cropImageSizeOwnership(options.slide, input) === "none") {
          return CROP_GROUP_SIZE_REASON;
        } else {
          return undefined;
        }
      },
      value3 =
        options.editable &&
        value === null &&
        options.selection.length === 1 &&
        callback(options.selection[0]!) === CROP_IMAGE_UNAVAILABLE_REASON,
      [, value4] = reactp4.useState(0);
    reactp4.useEffect((): (() => void) | undefined => {
      let value8 = value3 ? options.root() : null;
      if (value8 === null) {
        return;
      }
      let callback6 = (): void =>
        value4((input: number): number => input + 1);
      value8.addEventListener("load", callback6, true);
      return (): void => value8.removeEventListener("load", callback6, true);
    }, [value3]);
    let callback2 = (input: NodeSelection): boolean => {
        let value8: SlideNode | undefined = (0, runtime.selectedNode)(
            options.slide,
            input,
          ),
          value9 = cropImageElements(options.frameEl(input.frameId), input),
          value10 = cropImageLocation(
            options.slide,
            input,
            options.assets,
          );
        if (
          !options.editable ||
          options.busy ||
          options.onCommit === undefined ||
          value !== null ||
          value8?.kind !== "img" ||
          value10 === undefined ||
          !value9 ||
          callback(input) !== undefined
        ) {
          return false;
        }
        let { box: value11, img: value12 } = value9,
          state: CropBox = {
            x: value11.clientLeft,
            y: value11.clientTop,
            w: value11.clientWidth,
            h: value11.clientHeight,
          },
          state2: CropSize = {
            w: value12.naturalWidth,
            h: value12.naturalHeight,
          },
          value13 = computedCropFrameSize(value11),
          value14: ImageCrop | undefined =
            value8.fit === "cover" &&
            cropImageSizeOwnership(options.slide, input) === "own"
              ? value8.crop
              : undefined;
        ref2.current = options.slide;
        value2({
          unit: input,
          slideId: options.slide.id,
          identity: value10.key,
          file: value10.file,
          frame: state,
          size: value13,
          natural: state2,
          opened:
            value14 &&
            (0, runtime.centerUncroppedImageAxes)(state, state2, value14),
          live: value14 ?? runtime.defaultImageCrop,
          local: {
            x: 0,
            y: 0,
            w: state.w,
            h: state.h,
          },
        });
        return true;
      },
      callback3 = reactp4.useCallback((input: boolean): void => {
        let { session: current, onCommit: current2 } = ref.current,
          current3 = ref2.current;
        if (current === null) {
          return;
        }
        ref.current.session = null;
        value2(null);
        if (
          !input ||
          current3 === null ||
          current2 === undefined ||
          !matchesCropImageIdentity(
            cropImageLocation(current3, current.unit, ref.current.assets),
            current,
          )
        ) {
          return;
        }
        let value8: ImageCrop | undefined = (0, runtime.centerUncroppedImageAxes)(
            current.local,
            current.natural,
            current.live,
          ),
          value9 =
            current.local.x !== 0 ||
            current.local.y !== 0 ||
            current.local.w !== current.frame.w ||
            current.local.h !== current.frame.h;
        if (!value9 && (0, runtime.imageCropsEqual)(value8, current.opened)) {
          return;
        }
        let value10 =
          value8 === undefined && !value9
            ? current3
            : materializeCropImageSize(current3, current.unit, current.size);
        if (value10 === null) {
          return;
        }
        current2(
          (0, runtime.updateSelectedNode)(
            applyCropFrameChange(
              value10,
              current.unit,
              current.frame,
              current.local,
              current.size,
            ),
            current.unit,
            (source: SlideNode): SlideNode => {
              if (source.kind !== "img") {
                return source;
              }
              let state: ImageNode = {
                ...source,
                fit: "cover",
              };
              if (value8 !== undefined) {
                state.crop = value8;
              } else {
                delete state.crop;
              }
              return state;
            },
          ),
        );
        announceSlideStatus(
          value8 !== undefined || value9 ? "Cropped." : "Crop removed.",
        );
      }, []),
      value5 = value !== null && options.slide.id === value.slideId,
      value6 =
        value !== null &&
        value5 &&
        (!options.editable ||
          !matchesCropImageIdentity(
            cropImageLocation(options.slide, value.unit, options.assets),
            value,
          )),
      value7 =
        value !== null &&
        (!value5 ||
          options.busy ||
          options.selection.length !== 1 ||
          !(0, runtime.selectionsEqual)(options.selection[0]!, value.unit));
    reactp4.useEffect((): void => {
      if (value6) {
        callback3(false);
      } else if (value7) {
        callback3(true);
      }
    }, [value6, value7, callback3]);
    reactp4.useEffect(
      (): (() => void) => (): void => callback3(true),
      [callback3],
    );
    let memo = reactp4.useMemo((): Slide | null => {
        if (value === null || options.slide.id !== value.slideId) {
          return null;
        }
        let value8 = applyCropFrameChange(
          materializeCropImageSize(options.slide, value.unit, value.size) ??
            options.slide,
          value.unit,
          value.frame,
          value.local,
          value.size,
        );
        return (0, runtime.updateSelectedNode)(
          value8,
          value.unit,
          (source: SlideNode): SlideNode =>
            source.kind === "img"
              ? {
                  ...source,
                  fit: "cover",
                  crop: value.live,
                }
              : source,
        );
      }, [options.slide, value]),
      callback4 = reactp4.useCallback(
        (input: ImageCrop): void =>
          value2(
            (input2: CropSession | null): CropSession | null =>
              input2 === null
                ? input2
                : {
                    ...input2,
                    live: input,
                  },
          ),
        [],
      ),
      callback5 = reactp4.useCallback(
        (input: CropFrameChange): void =>
          value2(
            (input2: CropSession | null): CropSession | null =>
              input2 === null ||
              Math.max(
                input2.size.w + input.frame.w - input2.frame.w,
                input2.size.h + input.frame.h - input2.frame.h,
              ) > runtime.maxModelCoordinate
                ? input2
                : {
                    ...input2,
                    live: input.crop,
                    local: input.frame,
                  },
          ),
        [],
      ),
      memo2 = reactp4.useMemo(
        (): false | CropHandlesOff =>
          value === null || ref2.current === null
            ? {}
            : cropImageTransformSupport(ref2.current, value.unit),
        [value?.unit],
      );
    return {
      session: value,
      slide: memo,
      reason: callback,
      begin: callback2,
      end: callback3,
      setLive: callback4,
      setFrame: callback5,
      handlesOff: memo2,
    };
  }
  bindRuntimeValue(
    runtime,
    "reactp4",
    () => reactp4,
    (value) => {
      reactp4 = value;
    },
  );
  bindRuntimeValue(runtime, "announceSlideStatus", () => announceSlideStatus);
  bindRuntimeValue(
    runtime,
    "CROP_IMAGE_UNAVAILABLE_REASON",
    () => CROP_IMAGE_UNAVAILABLE_REASON,
    (value) => {
      CROP_IMAGE_UNAVAILABLE_REASON = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CROP_IMAGE_EMPTY_REASON",
    () => CROP_IMAGE_EMPTY_REASON,
    (value) => {
      CROP_IMAGE_EMPTY_REASON = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CROP_SVG_REASON",
    () => CROP_SVG_REASON,
    (value) => {
      CROP_SVG_REASON = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CROP_VIDEO_NO_POSTER_REASON",
    () => CROP_VIDEO_NO_POSTER_REASON,
    (value) => {
      CROP_VIDEO_NO_POSTER_REASON = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CROP_TRANSFORM_REASON",
    () => CROP_TRANSFORM_REASON,
    (value) => {
      CROP_TRANSFORM_REASON = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CROP_GROUP_SIZE_REASON",
    () => CROP_GROUP_SIZE_REASON,
    (value) => {
      CROP_GROUP_SIZE_REASON = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CROP_LAYOUT_REASON",
    () => CROP_LAYOUT_REASON,
    (value) => {
      CROP_LAYOUT_REASON = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "cropImageSource",
    () => cropImageSource,
    (value) => {
      cropImageSource = value;
    },
  );
  bindRuntimeValue(runtime, "cropImageLocation", () => cropImageLocation);
  bindRuntimeValue(
    runtime,
    "matchesCropImageIdentity",
    () => matchesCropImageIdentity,
    (value) => {
      matchesCropImageIdentity = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "cropImageSizeOwnership",
    () => cropImageSizeOwnership,
  );
  bindRuntimeValue(
    runtime,
    "materializeCropImageSize",
    () => materializeCropImageSize,
  );
  bindRuntimeValue(
    runtime,
    "hasCropTransform",
    () => hasCropTransform,
    (value) => {
      hasCropTransform = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "cropImageTransformSupport",
    () => cropImageTransformSupport,
  );
  bindRuntimeValue(runtime, "applyCropFrameChange", () => applyCropFrameChange);
  bindRuntimeValue(runtime, "cropImageElements", () => cropImageElements);
  bindRuntimeValue(
    runtime,
    "computedCropFrameSize",
    () => computedCropFrameSize,
  );
  bindRuntimeValue(runtime, "useMediaCropSession", () => useMediaCropSession);
  return () => {
    (0, runtime.initializeUiInspectorIcons)();
    (0, runtime.initializeImageCrop)();
    reactp4 = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    (0, runtime.initializeModelGeometry)();
    (0, runtime.initializeSlideModel)();
    (0, runtime.initializeModelEditing)();
    (0, runtime.initializeModelSelection)();
    CROP_IMAGE_UNAVAILABLE_REASON =
      "This picture isn’t showing here, so it can’t be cropped.";
    CROP_IMAGE_EMPTY_REASON =
      "Add a picture first: there is nothing to crop yet.";
    CROP_SVG_REASON = "This is a vector graphic (SVG), which can’t be cropped.";
    CROP_VIDEO_NO_POSTER_REASON =
      "This video has no still picture, so it can’t be cropped.";
    CROP_TRANSFORM_REASON =
      "This picture is inside a rotated, scaled or skewed group, so it can’t be cropped there. Move it out of the group to crop it.";
    CROP_GROUP_SIZE_REASON =
      "This picture takes its size from the layered group it is in, so it can’t be cropped there. Move it out of the group to crop it.";
    CROP_LAYOUT_REASON =
      "The layout around this picture places it, so only its right and bottom sides crop.";
    cropImageSource = (
      input: ImageNode,
      options: ReadonlyMap<string, string>,
    ): string | undefined =>
      input.asset !== undefined ? options.get(input.asset) : input.src;
    matchesCropImageIdentity = (
      identity2: CropImageLocation | undefined,
      current: Pick<CropSession, "identity" | "file">,
    ): boolean =>
      identity2 !== undefined &&
      identity2.key === current.identity &&
      identity2.file === current.file;
    hasCropTransform = (transform: TransformValue | undefined): boolean =>
      transform !== undefined &&
      ((transform.rotate ?? 0) !== 0 ||
        (transform.scale ?? 1) !== 1 ||
        !!transform.skewX ||
        !!transform.skewY);
  };
}
