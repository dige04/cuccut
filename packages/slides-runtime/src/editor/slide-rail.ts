/** Restored application module; prepare first, initialize in original order. */
import type {
  CSSProperties,
  DragEvent as ReactDragEvent,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  ReactElement,
  RefObject,
} from "react";
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type JsxNamespace,
} from "../bindings";
import type { Slide } from "../deck-contracts";
import type { SlideDocumentCodec } from "../documents/slide-codec";
import type { ContextMenuPoint } from "../ui/context-menu-popup";
import type { TemplatePickerOptions } from "./app";
import type { SlideRailLayoutOptions } from "./slide-rail-layout";

/** Where keyboard focus moves inside the Slide/Canvas switch. */
export type SlideViewNavigation = "prev" | "next" | "first" | "last";
/** Props that disable a control and say why. */
export interface DisabledActionProps {
  disabled: boolean;
  disabledReason: string | null;
}
/** One cell of the strip while slides are being created: a grey box or a slide that has arrived. */
export interface RailPendingCell {
  id: string;
  as: "box" | "slide";
}
/** How the strip looks while a generation is still creating slides. */
export interface RailPending {
  cells: readonly RailPendingCell[];
  /** The cell being written right now. */
  active: string | null;
  /** The cell the strip scrolls to. */
  follow: string | null;
  growing: boolean;
  growFirst: boolean;
  /** The slide that has just arrived. */
  fresh: string | null;
  leaving: boolean;
}
/** Receives the strip's root element. */
export type RailRootRef =
  | RefObject<HTMLElement | null>
  | ((element: HTMLElement | null) => void);
/** A React event whose target is known to be an element (keyboard events dispatched inside the strip). */
type TargetedEvent<E> = E & { target: HTMLElement };
/** The open slide actions menu: where it opens and how it was raised. */
export interface RailMenuState extends ContextMenuPoint {
  id: string;
  /** Raised from the keyboard, so the first item takes focus. */
  keyboard?: boolean;
  /** Raised from the actions button. */
  button?: boolean;
  /** Raised by a tap, so the menu is centred under the target. */
  tap?: boolean;
  /** The strip held focus when the menu opened. */
  inStrip?: boolean;
}
/** Actions that apply to several selected slides at once (the Canvas multi-selection). */
export interface SlideRailGroup {
  ids: readonly string[];
  allSkipped: boolean;
  /** Why moving through the menu is unavailable. */
  moveReason: string;
  onDuplicate(ids: readonly string[]): void;
  onCopy(ids: readonly string[]): void;
  onDelete(ids: readonly string[]): void;
  onSetSkipped(ids: readonly string[], skipped: boolean): void;
}
/** Props of the thumbnail strip. */
export interface SlideThumbnailRailProps {
  slides: readonly Slide[];
  assets: ReadonlyMap<string, string>;
  currentId: string | null;
  onSelect: (id: string) => void;
  onAdd: (options?: TemplatePickerOptions) => void;
  onDuplicate: (id: string) => void;
  onCopy: (id: string) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, index: number) => void;
  onDuplicateAt: (id: string, index: number) => void;
  onToggleSkip: (id: string) => void;
  onSetCover?: (id: string) => void;
  coverId?: string | null;
  heldSlide?: SlideDocumentCodec["slideHtmlHold"];
  onCollapse?: () => void;
  onEnterSlide?: () => void;
  gridOpen?: boolean;
  onSetGridOpen?: (open: boolean) => void;
  notesOpen?: boolean;
  onToggleNotes?: () => void;
  rootRef?: RailRootRef;
  readOnly?: boolean;
  /** Open comment count per slide id. */
  commentCounts?: ReadonlyMap<string, number>;
  /** Id of the deck whose collaborators are shown on the thumbnails. */
  peersDeck: string | null;
  resize?: SlideRailLayoutOptions;
  pending?: RailPending;
  /** Changes whenever a collaborator pages the deck, which also scrolls the strip. */
  personPaged?: number;
}
interface SlideCreationRailCellProps {
  id: string;
  active: boolean;
  delayMs?: number;
  leaving: boolean;
  arrived: boolean;
}
interface RailPageButtonProps {
  dir: -1 | 1;
  onPage: (dir: -1 | 1) => void;
}
interface SlideCommentCountBadgeProps {
  count: number;
  className?: string;
  style?: CSSProperties;
}
interface SkippedSlideBadgeProps {
  /** Why unskipping is unavailable; absent when it is available. */
  why?: string;
  onUnskip: () => void;
  style?: CSSProperties;
}
interface ThumbnailActionsButtonProps {
  label: string;
  current: boolean;
  expanded: boolean;
  skipped: boolean;
  /** Inverse of the zoom, which keeps the button the same size on screen. */
  inv?: number;
  className?: string;
  onOpen: (anchor: DOMRect, keyboard: boolean, target: HTMLElement) => void;
  onMouseDown?: (event: ReactMouseEvent<HTMLButtonElement>) => void;
}
interface SlideRailToolbarProps {
  readOnly?: boolean;
  onAdd: (options?: TemplatePickerOptions) => void;
  notesOpen?: boolean;
  onToggleNotes?: () => void;
  notesDisabledReason?: string;
  gridOpen?: boolean;
  slideShortcut?: string;
  canvasShortcut?: string;
  onSetGridOpen?: (open: boolean) => void;
  onCollapse?: () => void;
  collapseDisabledReason?: string;
}
interface SlidesViewSwitchProps {
  gridOpen: boolean;
  slideShortcut?: string;
  canvasShortcut?: string;
  onSetGridOpen: (open: boolean) => void;
}
interface SlideContextMenuProps {
  id: string;
  index: number;
  count: number;
  skipped: boolean;
  isCover: boolean;
  readOnly: boolean;
  heldSlide?: SlideDocumentCodec["slideHtmlHold"];
  /** Wraps a menu action so closing the menu restores focus first. */
  via: (action: () => void) => () => void;
  group?: SlideRailGroup;
  onNewSection?: () => void;
  newSectionDisabledReason?: string;
  onDuplicate: (id: string) => void;
  onCopy: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleSkip: (id: string) => void;
  onSetCover?: (id: string) => void;
  onAdd: (options?: TemplatePickerOptions) => void;
  onMove: (id: string, index: number) => void;
}

declare module "../bindings" {
  interface RuntimeBindings {
    SlideRailJsx: JsxNamespace;
    INHERIT_RAIL_THUMB_WIDTH_CLASS: string;
    RAIL_THUMB_DIMENSIONS_STYLE: CSSProperties;
    READ_ONLY_PRESENTATION_MESSAGE: string;
    SLIDE_ALREADY_AT_DESTINATION_MESSAGE: string;
    getRailScrollButtonPadding: () => number;
    preventRailMouseDownDefault: (event: { preventDefault(): void }) => void;
    getRailScrollBehavior: () => ScrollBehavior;
    RAIL_HOVER_ACTIONS_CLASS: string;
    RAIL_PAGE_BUTTON_CLASS: string;
    RAIL_THUMB_BORDER_CLASS: string;
    RAIL_PAGE_GRADIENT_CLASS: string;
    RAIL_SELECTION_RING_CLASS: string;
    THUMBNAIL_BADGE_CLASS: string;
    THUMBNAIL_BADGE_SURFACE_CLASS: string;
    THUMBNAIL_ICON_BADGE_CLASS: string;
    THUMBNAIL_ACTION_BUTTON_CLASS: string;
    SKIPPED_THUMBNAIL_ACTION_OFFSET_CLASS: string;
    SLIDE_VIEW_SWITCH_NAVIGATION_KEYS: Record<string, SlideViewNavigation>;
    disabledActionFromReason: (reason?: string) => DisabledActionProps;
    SlideCreationRailPlaceholder: () => ReactElement;
    SlideCreationRailCell: (props: SlideCreationRailCellProps) => ReactElement;
    adjustMoveIndexAfterRemoval: (fromIndex: number, toIndex: number) => number;
    calculateRailPageScroll: (
      direction: -1 | 1,
      currentScroll: number,
      viewportWidth: number,
      scrollWidth: number,
      thumbnailWidth: number,
      padding: number,
    ) => number;
    scrollRailThumbnailIntoView: (
      rail: Element,
      thumbnail: Element,
      expanded: boolean,
      behavior: ScrollBehavior,
    ) => void;
    formatSlideThumbnailLabel: (
      slide: Slide,
      index: number,
      thumbnail: boolean,
      openComments?: number,
    ) => string;
    SlideThumbnailRail: (props: SlideThumbnailRailProps) => ReactElement;
    RailPageButton: (props: RailPageButtonProps) => ReactElement;
    ThumbnailIndicator: () => ReactElement;
    SlideCommentCountBadge: (
      props: SlideCommentCountBadgeProps,
    ) => ReactElement | null;
    formatOpenCommentCount: (count: number) => string;
    SkippedSlideBadge: (props: SkippedSlideBadgeProps) => ReactElement;
    ThumbnailActionsButton: (props: ThumbnailActionsButtonProps) => ReactElement;
    SlideRailToolbar: (props: SlideRailToolbarProps) => ReactElement;
    SlidesViewSwitch: (props: SlidesViewSwitchProps) => ReactElement;
    SlideContextMenu: (props: SlideContextMenuProps) => ReactElement;
  }
}

export function installEditorSlideRail(runtime: RuntimeBindings): () => void {
  var SlideRailJsx: JsxNamespace;
  var INHERIT_RAIL_THUMB_WIDTH_CLASS: string;
  var RAIL_THUMB_DIMENSIONS_STYLE: CSSProperties;
  var READ_ONLY_PRESENTATION_MESSAGE: string;
  var SLIDE_ALREADY_AT_DESTINATION_MESSAGE: string;
  var getRailScrollButtonPadding: () => number;
  var preventRailMouseDownDefault: (event: { preventDefault(): void }) => void;
  var getRailScrollBehavior: () => ScrollBehavior;
  var RAIL_HOVER_ACTIONS_CLASS: string;
  var RAIL_PAGE_BUTTON_CLASS: string;
  var RAIL_THUMB_BORDER_CLASS: string;
  var RAIL_PAGE_GRADIENT_CLASS: string;
  var RAIL_SELECTION_RING_CLASS: string;
  var THUMBNAIL_BADGE_CLASS: string;
  var THUMBNAIL_BADGE_SURFACE_CLASS: string;
  var THUMBNAIL_ICON_BADGE_CLASS: string;
  var THUMBNAIL_ACTION_BUTTON_CLASS: string;
  var SKIPPED_THUMBNAIL_ACTION_OFFSET_CLASS: string;
  var SLIDE_VIEW_SWITCH_NAVIGATION_KEYS: Record<string, SlideViewNavigation>;
  var disabledActionFromReason: (reason?: string) => DisabledActionProps;
  function SlideCreationRailPlaceholder(): ReactElement {
    return SlideRailJsx.jsxs("div", {
      "aria-hidden": "true",
      className: (0, runtime.joinClassNames)(
        "sl-creation-under pointer-events-none absolute inset-0 flex",
        INHERIT_RAIL_THUMB_WIDTH_CLASS,
      ),
      children: [
        SlideRailJsx.jsx("div", {
          className: "w-1",
        }),
        SlideRailJsx.jsx("div", {
          className: (0, runtime.joinClassNames)(
            "rounded-md p-1",
            INHERIT_RAIL_THUMB_WIDTH_CLASS,
          ),
          children: SlideRailJsx.jsx("div", {
            className: (0, runtime.joinClassNames)(
              "sl-creation-box overflow-hidden rounded-sm bg-panel",
              INHERIT_RAIL_THUMB_WIDTH_CLASS,
            ),
            children: SlideRailJsx.jsx("div", {
              className: (0, runtime.joinClassNames)(
                "mc-claude-box",
                INHERIT_RAIL_THUMB_WIDTH_CLASS,
              ),
              style: RAIL_THUMB_DIMENSIONS_STYLE,
            }),
          }),
        }),
      ],
    });
  }
  function SlideCreationRailCell({
    id: id,
    active: active,
    delayMs: delayMs,
    leaving: leaving,
    arrived: arrived,
  }: SlideCreationRailCellProps): ReactElement {
    return SlideRailJsx.jsxs("div", {
      "aria-hidden": "true",
      "data-creation-cell": id,
      "data-arrived-box": arrived ? "" : undefined,
      className: (0, runtime.joinClassNames)(
        "flex shrink-0",
        INHERIT_RAIL_THUMB_WIDTH_CLASS,
      ),
      children: [
        SlideRailJsx.jsx("div", {
          className: "w-1",
        }),
        SlideRailJsx.jsx("div", {
          className: (0, runtime.joinClassNames)(
            "rounded-md p-1",
            INHERIT_RAIL_THUMB_WIDTH_CLASS,
          ),
          children: SlideRailJsx.jsx("div", {
            className: (0, runtime.joinClassNames)(
              "sl-creation-box overflow-hidden rounded-sm bg-panel",
              INHERIT_RAIL_THUMB_WIDTH_CLASS,
              delayMs !== undefined && "sl-creation-grow",
              leaving && "sl-creation-leave",
            ),
            style:
              delayMs !== undefined
                ? {
                    animationDelay: String(delayMs) + "ms",
                  }
                : undefined,
            children: SlideRailJsx.jsx("div", {
              className: (0, runtime.joinClassNames)(
                "mc-claude-box",
                active && "mc-claude-sheen",
                INHERIT_RAIL_THUMB_WIDTH_CLASS,
              ),
              style: RAIL_THUMB_DIMENSIONS_STYLE,
            }),
          }),
        }),
      ],
    });
  }
  function adjustMoveIndexAfterRemoval(
    fromIndex: number,
    toIndex: number,
  ): number {
    if (fromIndex < toIndex) {
      return toIndex - 1;
    } else {
      return toIndex;
    }
  }
  function calculateRailPageScroll(
    direction: -1 | 1,
    currentScroll: number,
    viewportWidth: number,
    scrollWidth: number,
    thumbnailWidth: number,
    padding: number,
  ): number {
    let value = Math.max(0, scrollWidth - viewportWidth),
      value2 = Math.max(
        thumbnailWidth,
        Math.min(3 * thumbnailWidth, viewportWidth - thumbnailWidth),
      ),
      value3 = currentScroll + direction * value2;
    if (direction === 1 && currentScroll <= 1) {
      value3 -= padding;
    }
    if (direction === -1 && currentScroll >= value - 1) {
      value3 += padding;
    }
    if (direction === 1 && value - value3 < thumbnailWidth) {
      value3 = value;
    }
    if (direction === -1 && value3 < thumbnailWidth) {
      value3 = 0;
    }
    return Math.min(value, Math.max(0, value3));
  }
  function scrollRailThumbnailIntoView(
    rail: Element,
    thumbnail: Element,
    expanded: boolean,
    behavior: ScrollBehavior,
  ): void {
    let railRect = rail.getBoundingClientRect(),
      thumbnailRect = thumbnail.getBoundingClientRect(),
      value =
        (expanded ? thumbnailRect.width : 0) + getRailScrollButtonPadding(),
      value2 = Math.max(
        0,
        Math.min(value, (railRect.width - thumbnailRect.width) / 2),
      ),
      value3 =
        thumbnailRect.left < railRect.left + value2
          ? thumbnailRect.left - railRect.left - value2
          : thumbnailRect.right > railRect.right - value2
            ? thumbnailRect.right - railRect.right + value2
            : 0;
    if (Math.abs(value3) >= 1) {
      rail.scrollTo({
        left: rail.scrollLeft + value3,
        behavior: behavior,
      });
    }
  }
  function formatSlideThumbnailLabel(
    slide: Slide,
    index: number,
    thumbnail: boolean,
    openComments: number = 0,
  ): string {
    let name = (0, runtime.slideDisplayLabel)(slide);
    return (
      "Slide " +
      String(index + 1) +
      (slide.skipped === true ? " (skipped)" : "") +
      (thumbnail ? " (thumbnail)" : "") +
      (name !== undefined ? ": " + name : "") +
      formatOpenCommentCount(openComments)
    );
  }
  function SlideThumbnailRail({
    slides: slides,
    assets: assets,
    currentId: currentId,
    onSelect: onSelect,
    onAdd: onAdd,
    onDuplicate: onDuplicate,
    onCopy: onCopy,
    onDelete: onDelete,
    onMove: onMove,
    onDuplicateAt: onDuplicateAt,
    onToggleSkip: onToggleSkip,
    onSetCover: onSetCover,
    coverId: coverId,
    heldSlide: heldSlide,
    onCollapse: onCollapse,
    onEnterSlide: onEnterSlide,
    gridOpen = false,
    onSetGridOpen: onSetGridOpen,
    notesOpen = false,
    onToggleNotes: onToggleNotes,
    rootRef: rootRef,
    readOnly = false,
    commentCounts: commentCounts,
    peersDeck: peersDeck,
    resize: resize,
    pending: pending,
    personPaged = 0,
  }: SlideThumbnailRailProps): ReactElement {
    let value = (0, runtime.useSlidePresence)(peersDeck, slides),
      value2 = runtime.ReactGrid.useId(),
      memo = runtime.ReactGrid.useMemo(
        () =>
          new Map(
            (pending?.cells ?? []).map(
              (input, options) => [
                input.id,
                options,
              ],
            ),
          ),
        [pending?.cells],
      ),
      callback = (input: string, options: number) =>
        memo.get(input) ?? options,
      callback2 = (input: string, options: number) =>
        SlideRailJsx.jsx(
          SlideCreationRailCell,
          {
            id: input,
            arrived: slides.some(
              (input2) => input2.id === input,
            ),
            active: pending?.active === input,
            delayMs:
              pending?.growing === true && (options > 0 || pending.growFirst)
                ? Math.min(
                    options * runtime.CREATION_CELL_STAGGER_MS,
                    runtime.CREATION_REVEAL_HOLD_MS,
                  )
                : undefined,
            leaving: pending?.leaving === true,
          },
          "box:" + input,
        ),
      callback3 = (input?: string) => {
        let value20 = pending?.cells ?? [],
          callback17 = (input2?: RailPendingCell) =>
            input2 !== undefined &&
            slides.some((input3) => input3.id === input2.id),
          value21 =
            input === undefined ? value20.length : (memo.get(input) ?? 0),
          value22 = value21;
        while (value22 > 0 && !callback17(value20[value22 - 1])) value22--;
        return value20
          .slice(value22, value21)
          .map(
            (input2, options) =>
              callback2(input2.id, value22 + options),
          );
      },
      callback4 = (input: string) =>
        pending?.cells.some(
          (input2: RailPendingCell) =>
            input2.id === input && input2.as === "box",
        ) === true,
      value3 =
        pending === undefined ||
        slides.some((input) => !callback4(input.id)),
      [value4, value5] = runtime.ReactGrid.useState<string | null>(null),
      [value6, value7] = runtime.ReactGrid.useState<number | null>(null),
      [value8, value9] = runtime.ReactGrid.useState<RailMenuState | null>(null),
      [value10, value11] = runtime.ReactGrid.useState(false),
      ref = runtime.ReactGrid.useRef(0),
      ref2 = runtime.ReactGrid.useRef<Element | null>(null),
      count = 1500,
      ref3 = runtime.ReactGrid.useRef<RailMenuState | null>(null);
    ref3.current = value8;
    let ref4 = runtime.ReactGrid.useRef<HTMLDivElement | null>(null),
      ref5 = runtime.ReactGrid.useRef<HTMLDivElement | null>(null);
    runtime.ReactGrid.useEffect(() => {
      let current = ref5.current;
      if (!current) {
        return;
      }
      let callback17 = (event: FocusEvent) => {
          let target = event.target;
          if (target instanceof HTMLElement) {
            value11(
              target.matches(":focus-visible") ||
                target.closest('[data-kit="thumb-actions"]') !== null,
            );
          }
        },
        callback18 = (input: FocusEvent) => {
          let relatedTarget = input.relatedTarget;
          if (
            !(relatedTarget instanceof Node) ||
            !current.contains(relatedTarget)
          ) {
            value11(false);
          }
        };
      current.addEventListener("focusin", callback17);
      current.addEventListener("focusout", callback18);
      return () => {
        current.removeEventListener("focusin", callback17);
        current.removeEventListener("focusout", callback18);
      };
    }, []);
    let ref6 = runtime.ReactGrid.useRef(0),
      ref7 = runtime.ReactGrid.useRef({
        x: 0,
        y: 0,
      }),
      ref8 = runtime.ReactGrid.useRef(false),
      ref9 = runtime.ReactGrid.useRef<ReturnType<typeof setTimeout> | 0>(0);
    runtime.ReactGrid.useEffect(() => {
      if (!readOnly) {
        return;
      }
      clearTimeout(ref9.current);
      ref8.current = false;
      value5(null);
      value7(null);
    }, [readOnly]);
    let ref10 = runtime.ReactGrid.useRef(false),
      ref11 = runtime.ReactGrid.useRef<HTMLElement | null>(null),
      callback5 = runtime.ReactGrid.useCallback(
        (input: HTMLElement | null) => {
          ref11.current = input;
          if (typeof rootRef === "function") {
            rootRef(input);
          } else if (rootRef) {
            rootRef.current = input;
          }
        },
        [rootRef],
      ),
      {
        thumbW: thumbW,
        maxW: maxW,
        gesture: gesture,
        setThumbW: setThumbW,
        takeAutoHold: takeAutoHold,
        forgetAutoHold: forgetAutoHold,
      } = (0, runtime.useSlideRailLayout)(
        ref11,
        resize,
        ref5,
        () => ref4.current,
      ),
      memo2 = runtime.ReactGrid.useMemo(
        () => ({
          transform:
            "scale(calc(var(" +
            runtime.RAIL_THUMB_WIDTH_CSS_VARIABLE +
            ") / " +
            String(thumbW) +
            "))",
          transformOrigin: "top left",
        }),
        [thumbW],
      ),
      [value12, value13] = runtime.ReactGrid.useState(false),
      [value14, value15] = runtime.ReactGrid.useState(false),
      callback6 = runtime.ReactGrid.useCallback(() => {
        let current = ref5.current;
        if (!current) {
          return;
        }
        value13(current.scrollLeft > 1);
        value15(
          current.scrollLeft + current.clientWidth < current.scrollWidth - 1,
        );
      }, []),
      ref12 = runtime.ReactGrid.useRef(false),
      ref13 = runtime.ReactGrid.useRef(false),
      callback7 = runtime.ReactGrid.useCallback(
        (input: boolean, options: boolean) => {
          forgetAutoHold();
          let current = ref5.current,
            current2 = ref4.current;
          if (!current || !current2) {
            return;
          }
          scrollRailThumbnailIntoView(
            current,
            current2,
            !input,
            options ? "auto" : getRailScrollBehavior(),
          );
        },
        [forgetAutoHold],
      ),
      value16 = currentId !== null && callback4(currentId);
    runtime.ReactGrid.useEffect(() => {
      let current = ref12.current;
      ref12.current = false;
      let value20 = !ref13.current;
      ref13.current = true;
      if (ref3.current !== null) {
        return;
      }
      callback7(current, value20);
      let current2 = ref5.current,
        activeElement = document.activeElement,
        value21 =
          ref2.current !== null &&
          activeElement !== null &&
          ref2.current.contains(activeElement),
        value22 =
          Date.now() - ref.current < 1500 &&
          (activeElement === null ||
            activeElement === document.body ||
            !activeElement.isConnected ||
            value21);
      ref.current = 0;
      ref2.current = null;
      if (
        current2 &&
        ref4.current &&
        (value22 ||
          (activeElement instanceof HTMLElement &&
            current2.contains(activeElement) &&
            activeElement !== ref4.current))
      ) {
        ref4.current.focus({
          preventScroll: true,
        });
      }
    }, [currentId, value16]);
    let ref14 = runtime.ReactGrid.useRef(Number.NaN);
    runtime.ReactGrid.useLayoutEffect(() => {
      let value20 = takeAutoHold(thumbW),
        current = ref5.current;
      if (!value20 || !current) {
        return;
      }
      if (ref3.current !== null) {
        ref14.current = current.scrollLeft;
        return;
      }
      if (value20.onMount && !value20.held) {
        callback7(false, true);
      } else {
        current.scrollLeft = (0, runtime.calculateAnchoredRailScroll)(
          value20,
          thumbW,
          !value20.onMount,
        );
        ref14.current = current.scrollLeft;
      }
    }, [thumbW, takeAutoHold, callback7]);
    let callback8 = runtime.ReactGrid.useCallback(() => {
      let current = ref5.current;
      if (current && !(Math.abs(current.scrollLeft - ref14.current) <= 1)) {
        forgetAutoHold();
      }
    }, [forgetAutoHold]);
    runtime.ReactGrid.useEffect(() => {
      let current = ref5.current;
      if (!current) {
        return;
      }
      current.addEventListener("scroll", callback8, {
        passive: true,
      });
      return () => current.removeEventListener("scroll", callback8);
    }, [callback8]);
    let callback9 = (input: string) => {
        ref15.current = true;
        onSelect(input);
      },
      value17 = pending?.follow ?? null,
      value18 = pending !== undefined,
      ref15 = runtime.ReactGrid.useRef(false),
      ref16 = runtime.ReactGrid.useRef(personPaged);
    runtime.ReactGrid.useEffect(() => {
      ref15.current = false;
      let current = ref5.current;
      if (!current || !value18) {
        return;
      }
      let callback17 = () => {
        ref15.current = true;
      };
      current.addEventListener("touchmove", callback17, {
        passive: true,
      });
      return () =>
        current.removeEventListener("touchmove", callback17);
    }, [value18]);
    runtime.ReactGrid.useEffect(() => {
      if (personPaged === ref16.current) {
        return;
      }
      ref16.current = personPaged;
      ref15.current = true;
    }, [personPaged]);
    runtime.ReactGrid.useEffect(() => {
      let current = ref5.current;
      if (value17 === null || ref15.current || !current) {
        return;
      }
      let element = current.querySelector(
        '[data-creation-cell="' +
          (typeof CSS !== "undefined" && typeof CSS.escape === "function"
            ? CSS.escape(value17)
            : value17) +
          '"]',
      );
      if (!element) {
        return;
      }
      forgetAutoHold();
      scrollRailThumbnailIntoView(
        current,
        element,
        true,
        getRailScrollBehavior(),
      );
    }, [value17, forgetAutoHold]);
    runtime.ReactGrid.useEffect(() => {
      let current = ref5.current,
        value20 = current?.parentElement;
      if (!current || !value20) {
        return;
      }
      let callback17 = (event: WheelEvent) => {
        if (event.ctrlKey || current.scrollWidth <= current.clientWidth) {
          return;
        }
        let value21 =
          Math.abs(event.deltaX) > Math.abs(event.deltaY)
            ? event.deltaX
            : event.deltaY;
        if (value21 === 0) {
          return;
        }
        current.scrollLeft += value21;
        callback8();
        ref15.current = true;
        event.preventDefault();
      };
      value20.addEventListener("wheel", callback17, {
        passive: false,
      });
      current.addEventListener("scroll", callback6, {
        passive: true,
      });
      let observer = new ResizeObserver(callback6);
      observer.observe(current);
      return () => {
        value20.removeEventListener("wheel", callback17);
        current.removeEventListener("scroll", callback6);
        observer.disconnect();
      };
    }, [callback6, callback8]);
    runtime.ReactGrid.useEffect(callback6, [
      callback6,
      slides.length,
      pending?.cells.length,
      thumbW,
    ]);
    let callback10 = (input: -1 | 1) => {
      let current = ref5.current;
      if (!current) {
        return;
      }
      ref15.current = true;
      forgetAutoHold();
      let firstElementChild = current.firstElementChild,
        value20 =
          firstElementChild instanceof HTMLElement
            ? firstElementChild.offsetWidth
            : runtime.MIN_RAIL_THUMB_WIDTH;
      current.scrollTo({
        left: calculateRailPageScroll(
          input,
          current.scrollLeft,
          current.clientWidth,
          current.scrollWidth,
          value20,
          getRailScrollButtonPadding(),
        ),
        behavior: getRailScrollBehavior(),
      });
    };
    runtime.ReactGrid.useEffect(() => {
      if (value4 === null) {
        return;
      }
      let current = ref5.current,
        current2 = ref11.current;
      if (!current || !current2) {
        return;
      }
      let count2 = 48,
        count3 = 32,
        count4 = 3,
        callback17 = (event: DragEvent) => {
          if (!ref8.current) {
            let current3 = ref7.current;
            if (
              Math.abs(event.clientX - current3.x) > count4 ||
              Math.abs(event.clientY - current3.y) > count4
            ) {
              ref8.current = true;
            }
          }
          event.preventDefault();
          if (event.dataTransfer !== null) {
            event.dataTransfer.dropEffect = ref10.current ? "copy" : "move";
          }
          ref6.current = event.clientX;
          if (!ref8.current) {
            return;
          }
          let bounds = current.getBoundingClientRect(),
            value20 = Math.max(0, bounds.right - event.clientX),
            value21 = Math.max(0, event.clientX - bounds.left);
          if (value20 < count2) {
            current.scrollLeft += Math.ceil(
              ((count2 - value20) / count2) * count3,
            );
            callback8();
          } else if (value21 < count2) {
            current.scrollLeft -= Math.ceil(
              ((count2 - value21) / count2) * count3,
            );
            callback8();
          }
        },
        callback18 = () => {
          if (!ref8.current) {
            return;
          }
          let current3 = ref6.current,
            value20 = current.querySelectorAll(
              '[draggable="true"], [data-arrived-box]',
            ),
            length = value20.length;
          for (let index = 0; index < value20.length; index++) {
            let value21 = value20.item(index);
            if (value21 === null) {
              continue;
            }
            let bounds = value21.getBoundingClientRect();
            if (current3 < bounds.left + bounds.width / 2) {
              length = index;
              break;
            }
          }
          value7(length);
        },
        callback19 = (event: DragEvent) => {
          event.preventDefault();
        },
        callback20 = (input: DragEvent) => {
          let relatedTarget = input.relatedTarget;
          if (
            relatedTarget instanceof Node &&
            current2.contains(relatedTarget)
          ) {
            return;
          }
          ref8.current = false;
          value7(null);
        };
      current2.addEventListener("dragover", callback17);
      current2.addEventListener("drop", callback19);
      current2.addEventListener("dragleave", callback20);
      current.addEventListener("scroll", callback18, {
        passive: true,
      });
      return () => {
        current2.removeEventListener("dragover", callback17);
        current2.removeEventListener("drop", callback19);
        current2.removeEventListener("dragleave", callback20);
        current.removeEventListener("scroll", callback18);
        value7(null);
      };
    }, [value4, callback8]);
    let callback11 = (input?: boolean) => {
        if (!input && !readOnly && value4 !== null && value6 !== null) {
          if (ref10.current) {
            onDuplicateAt(value4, value6);
          } else {
            let value20 = slides.findIndex(
                (input2) => input2.id === value4,
              ),
              value21 = adjustMoveIndexAfterRemoval(value20, value6);
            if (value20 >= 0 && value21 !== value20) {
              onMove(value4, value21);
            }
          }
        }
        value5(null);
        value7(null);
      },
      callback12 = (event: TargetedEvent<ReactKeyboardEvent<HTMLDivElement>>) => {
        if (
          event.defaultPrevented ||
          event.metaKey ||
          event.ctrlKey ||
          event.altKey ||
          (!value3 && event.target === event.currentTarget)
        ) {
          return;
        }
        if (
          event.key === "Enter" &&
          !event.shiftKey &&
          onEnterSlide !== undefined &&
          event.target.getAttribute("role") === "option"
        ) {
          event.preventDefault();
          onEnterSlide();
          return;
        }
        if ((0, runtime.isContextMenuKey)(event)) {
          event.preventDefault();
          let value23 = ref4.current?.getBoundingClientRect();
          if (currentId !== null && value23) {
            let value24 =
              event.target.closest('[data-kit="thumb-actions"]') !== null;
            value9({
              x: value23.left + Math.min(40, value23.width / 2),
              y: value23.top + Math.min(24, value23.height / 2),
              id: currentId,
              keyboard: true,
              button: value24,
            });
          }
          return;
        }
        if (event.key === "Delete" || event.key === "Backspace") {
          if (event.target.closest('[data-kit="thumb-actions"]') !== null) {
            return;
          }
          if (!readOnly && currentId !== null && slides.length > 1) {
            event.preventDefault();
            ref.current = Date.now();
            ref2.current = null;
            onDelete(currentId);
          }
          return;
        }
        let value20 = slides.findIndex(
            (input) => input.id === currentId,
          ),
          value21 =
            event.key === "ArrowLeft"
              ? value20 - 1
              : event.key === "ArrowRight"
                ? value20 + 1
                : event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? slides.length - 1
                    : null;
        if (value21 === null) {
          return;
        }
        event.preventDefault();
        let value22 =
          slides[Math.max(0, Math.min(slides.length - 1, value21))];
        if (value22 && value22.id !== currentId) {
          if (event.target.closest('[data-kit="thumb-actions"]') !== null) {
            ref.current = Date.now();
            ref2.current = null;
          }
          callback9(value22.id);
        }
      },
      value19 = value8
        ? slides.findIndex((input) => input.id === value8.id)
        : -1;
    runtime.ReactGrid.useEffect(() => {
      if (value8 !== null && value19 < 0) {
        value9(null);
      }
    }, [value8, value19]);
    let callback13 = (input: RailMenuState) =>
        input.keyboard === true || input.inStrip === true,
      callback14 = (input: RailMenuState) => {
        let current = ref4.current;
        if (current === null || !callback13(input)) {
          return;
        }
        (
          (input.keyboard === true &&
          input.button === true &&
          ref3.current === input
            ? current.querySelector<HTMLElement>('[data-kit="thumb-actions"] button')
            : null) ?? current
        ).focus({
          preventScroll: true,
          focusVisible: input.keyboard === true,
        });
      },
      callback15 = () => {
        if (ref3.current !== null) {
          callback14(ref3.current);
        }
        value9(null);
      },
      callback16 =
        (input: () => void) =>
        () => {
          let current = ref3.current,
            value20 = current !== null && callback13(current);
          if (value20) {
            queueMicrotask(() => callback14(current!));
          }
          value9(null);
          if (value20) {
            ref.current = Date.now();
            ref2.current =
              document.activeElement?.closest("[data-mc-menu]") ??
              null;
          }
          input();
        };
    return SlideRailJsx.jsxs("aside", {
      ref: callback5,
      className:
        "relative flex w-full shrink-0 flex-col border-t border-border-line bg-panel pb-[var(--sl-safe-b,0px)]",
      style: {
        [runtime.RAIL_THUMB_WIDTH_CSS_VARIABLE]: thumbW,
      },
      children: [
        resize
          ? SlideRailJsx.jsx(runtime.PanelResizeHandle, {
              name: "rail",
              label: "Resize slide thumbnails",
              now: thumbW,
              min: runtime.MIN_RAIL_THUMB_WIDTH,
              max: maxW,
              gesture: gesture,
              disabled: maxW <= runtime.MIN_RAIL_THUMB_WIDTH,
              unavailableTip: notesOpen
                ? "There is not enough height here for larger thumbnails. Closing the speaker notes may make room."
                : "There is not enough height here for larger thumbnails",
              onHome: () => setThumbW(runtime.MIN_RAIL_THUMB_WIDTH),
              onEnd: () => setThumbW(1 / 0),
              onReset: () => setThumbW(runtime.MIN_RAIL_THUMB_WIDTH),
              grabClassName:
                "justify-center pointer-coarse:flex pointer-coarse:left-24 pointer-coarse:right-[8.25rem]",
              grabTargetClassName: "max-w-full",
            })
          : null,
        SlideRailJsx.jsx(SlideRailToolbar, {
          readOnly: readOnly,
          onAdd: onAdd,
          notesOpen: notesOpen,
          onToggleNotes: onToggleNotes,
          gridOpen: gridOpen,
          onSetGridOpen: onSetGridOpen,
          onCollapse: onCollapse,
        }),
        SlideRailJsx.jsxs("div", {
          className: (0, runtime.joinClassNames)(
            "group/rail relative isolate",
            INHERIT_RAIL_THUMB_WIDTH_CLASS,
          ),
          children: [
            SlideRailJsx.jsxs("div", {
              ref: ref5,
              ...(value3
                ? {
                    role: "listbox",
                    "aria-label": "Slides",
                    "aria-orientation": "horizontal",
                  }
                : {
                    tabIndex: -1,
                  }),
              onKeyDown: callback12,
              className: (0, runtime.joinClassNames)(
                "flex min-w-0 overflow-x-auto px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
                INHERIT_RAIL_THUMB_WIDTH_CLASS,
              ),
              children: [
                slides.map(
                  (input, options) =>
                    SlideRailJsx.jsxs(
                      runtime.ReactGrid.Fragment,
                      {
                        children: [
                          pending !== undefined ? callback3(input.id) : null,
                          callback4(input.id)
                            ? callback2(input.id, memo.get(input.id) ?? options)
                            : SlideRailJsx.jsxs("div", {
                                "data-creation-cell":
                                  pending !== undefined ? input.id : undefined,
                                className: (0, runtime.joinClassNames)(
                                  "flex shrink-0",
                                  INHERIT_RAIL_THUMB_WIDTH_CLASS,
                                  pending?.fresh === input.id &&
                                    "sl-creation-fresh relative",
                                ),
                                children: [
                                  pending?.fresh === input.id
                                    ? SlideRailJsx.jsx(
                                        SlideCreationRailPlaceholder,
                                        {},
                                      )
                                    : null,
                                  SlideRailJsx.jsx("div", {
                                    "data-drop-gap": "",
                                    className: (0, runtime.joinClassNames)(
                                      "w-1 rounded-sm",
                                      value6 === options &&
                                        value4 !== null &&
                                        "bg-app-accent",
                                    ),
                                    onDragOver: (event: ReactDragEvent<HTMLDivElement>) => {
                                      event.preventDefault();
                                      if (value4 !== null && ref8.current) {
                                        value7(options);
                                      }
                                    },
                                  }),
                                  SlideRailJsx.jsx("div", {
                                    ref:
                                      input.id === currentId ? ref4 : undefined,
                                    draggable: !readOnly,
                                    onDragStart: (event: ReactDragEvent<HTMLDivElement>) => {
                                      if (readOnly) {
                                        event.preventDefault();
                                        return;
                                      }
                                      ref10.current = event.altKey;
                                      event.dataTransfer.effectAllowed =
                                        event.altKey ? "copy" : "move";
                                      ref6.current = event.clientX;
                                      ref7.current = {
                                        x: event.clientX,
                                        y: event.clientY,
                                      };
                                      ref8.current = false;
                                      let id = input.id;
                                      clearTimeout(ref9.current);
                                      ref9.current = setTimeout(() => {
                                        value5(id);
                                        value7(null);
                                      }, 0);
                                    },
                                    onDragEnd: (input2: ReactDragEvent<HTMLDivElement>) => {
                                      clearTimeout(ref9.current);
                                      ref8.current = false;
                                      callback11(
                                        input2.dataTransfer?.dropEffect ===
                                          "none",
                                      );
                                    },
                                    onDragOver: (event: ReactDragEvent<HTMLDivElement>) => {
                                      event.preventDefault();
                                      if (value4 === null || !ref8.current) {
                                        return;
                                      }
                                      let bounds =
                                        event.currentTarget.getBoundingClientRect();
                                      value7(
                                        event.clientX <
                                          bounds.left + bounds.width / 2
                                          ? options
                                          : options + 1,
                                      );
                                    },
                                    onClick: () => {
                                      ref12.current = input.id !== currentId;
                                      callback9(input.id);
                                    },
                                    onContextMenu: (
                                      event: ReactMouseEvent<HTMLDivElement>,
                                    ) => {
                                      event.preventDefault();
                                      callback9(input.id);
                                      let state = {
                                        x: event.clientX,
                                        y: event.clientY,
                                        id: input.id,
                                        inStrip:
                                          ref5.current?.contains(
                                            document.activeElement,
                                          ) === true,
                                      };
                                      value9(
                                        (input2) =>
                                          input2 !== null &&
                                          input2.keyboard === true &&
                                          input2.id === input.id
                                            ? input2
                                            : state,
                                      );
                                    },
                                    role: "option",
                                    "aria-selected": input.id === currentId,
                                    "aria-posinset":
                                      callback(input.id, options) + 1,
                                    "aria-setsize": pending
                                      ? pending.cells.length
                                      : slides.length,
                                    "aria-label": formatSlideThumbnailLabel(
                                      input,
                                      callback(input.id, options),
                                      input.id === coverId,
                                      commentCounts?.get(input.id),
                                    ),
                                    "aria-describedby": value.has(input.id)
                                      ? value2 + input.id
                                      : undefined,
                                    title:
                                      input.skipped === true
                                        ? RAIL_SELECTION_RING_CLASS
                                        : undefined,
                                    tabIndex: input.id === currentId ? 0 : -1,
                                    className: (0, runtime.joinClassNames)(
                                      "group relative cursor-default rounded-md p-1 transition-colors",
                                      INHERIT_RAIL_THUMB_WIDTH_CLASS,
                                      "outline-hidden focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-app-accent",
                                      input.id !== currentId &&
                                        "hover:bg-bg-warm/60",
                                      value4 === input.id &&
                                        !ref10.current &&
                                        "opacity-40",
                                    ),
                                    children: SlideRailJsx.jsxs("div", {
                                      className: (0, runtime.joinClassNames)(
                                        "relative origin-bottom overflow-hidden rounded-sm outline-3 outline-offset-2 transition-transform duration-150 ease-out motion-reduce:transition-none",
                                        INHERIT_RAIL_THUMB_WIDTH_CLASS,
                                        input.id === currentId
                                          ? "scale-[calc(1_+_6.2_/_var(--sl-thumb-w))] outline-fill-accent"
                                          : "outline-transparent",
                                      ),
                                      children: [
                                        SlideRailJsx.jsx("div", {
                                          className: (0,
                                          runtime.joinClassNames)(
                                            "overflow-clip",
                                            INHERIT_RAIL_THUMB_WIDTH_CLASS,
                                            input.skipped === true &&
                                              "opacity-40",
                                          ),
                                          style: RAIL_THUMB_DIMENSIONS_STYLE,
                                          "aria-hidden": "true",
                                          children: SlideRailJsx.jsx("div", {
                                            className:
                                              INHERIT_RAIL_THUMB_WIDTH_CLASS,
                                            style: memo2,
                                            children: SlideRailJsx.jsx(
                                              runtime.SlideCanvas,
                                              {
                                                slide: input,
                                                assets: assets,
                                                width: thumbW,
                                                animate: false,
                                                editorChrome: !readOnly,
                                                structure: false,
                                              },
                                            ),
                                          }),
                                        }),
                                        SlideRailJsx.jsxs("span", {
                                          "aria-hidden": "true",
                                          "data-mc-chrome": "",
                                          className:
                                            "absolute bottom-1 left-1 flex items-center gap-1",
                                          children: [
                                            SlideRailJsx.jsxs("span", {
                                              className: (0,
                                              runtime.joinClassNames)(
                                                THUMBNAIL_BADGE_CLASS,
                                                THUMBNAIL_BADGE_SURFACE_CLASS,
                                                input.id === currentId
                                                  ? "text-fg"
                                                  : "text-fg-muted",
                                              ),
                                              children: [
                                                callback(input.id, options) + 1,
                                                input.id === coverId
                                                  ? SlideRailJsx.jsx(
                                                      ThumbnailIndicator,
                                                      {},
                                                    )
                                                  : null,
                                              ],
                                            }),
                                            SlideRailJsx.jsx(
                                              SlideCommentCountBadge,
                                              {
                                                count:
                                                  commentCounts?.get(
                                                    input.id,
                                                  ) ?? 0,
                                              },
                                            ),
                                          ],
                                        }),
                                        SlideRailJsx.jsx(
                                          runtime.SlidePresenceBadge,
                                          {
                                            on: value.get(input.id),
                                            id: value2 + input.id,
                                            also:
                                              input.skipped === true
                                                ? RAIL_SELECTION_RING_CLASS
                                                : undefined,
                                          },
                                        ),
                                        input.skipped === true
                                          ? SlideRailJsx.jsx(
                                              SkippedSlideBadge,
                                              {
                                                why: readOnly
                                                  ? READ_ONLY_PRESENTATION_MESSAGE
                                                  : heldSlide?.(input.id) !==
                                                      undefined
                                                    ? "Can’t be edited until its saved content is fixed"
                                                    : undefined,
                                                onUnskip: () =>
                                                  onToggleSkip(input.id),
                                              },
                                            )
                                          : null,
                                        SlideRailJsx.jsx(
                                          ThumbnailActionsButton,
                                          {
                                            label:
                                              "Slide " +
                                              String(options + 1) +
                                              " actions",
                                            current: input.id === currentId,
                                            expanded: value8?.id === input.id,
                                            skipped: input.skipped === true,
                                            className: (0,
                                            runtime.joinClassNames)(
                                              value8?.id === input.id ||
                                                (value10 &&
                                                  input.id === currentId)
                                                ? "flex"
                                                : "hidden pointer-fine:group-hover:flex",
                                              input.id === currentId &&
                                                "pointer-coarse:flex",
                                            ),
                                            onOpen: (
                                              input2: DOMRect,
                                              options2: boolean,
                                              context: HTMLElement,
                                            ) => {
                                              callback9(input.id);
                                              value9({
                                                x:
                                                  input2.left +
                                                  input2.width / 2,
                                                y: (
                                                  context.closest(
                                                    '[role="option"]',
                                                  ) ?? context
                                                ).getBoundingClientRect().top,
                                                id: input.id,
                                                tap: true,
                                                keyboard: options2,
                                                button: true,
                                                inStrip:
                                                  ref5.current?.contains(
                                                    document
                                                      .activeElement,
                                                  ) === true,
                                              });
                                            },
                                          },
                                        ),
                                      ],
                                    }),
                                  }),
                                ],
                              }),
                        ],
                      },
                      input.id,
                    ),
                ),
                pending !== undefined ? callback3(undefined) : null,
                SlideRailJsx.jsx("div", {
                  className: "flex min-w-1 flex-1",
                  onDragOver: (event: ReactDragEvent<HTMLDivElement>) => {
                    event.preventDefault();
                    if (value4 !== null && ref8.current) {
                      value7(slides.length);
                    }
                  },
                  children: SlideRailJsx.jsx("div", {
                    "data-drop-gap": "",
                    className: (0, runtime.joinClassNames)(
                      "w-1 rounded-sm",
                      value6 === slides.length &&
                        value4 !== null &&
                        "bg-app-accent",
                    ),
                  }),
                }),
              ],
            }),
            value4 === null && value12
              ? SlideRailJsx.jsx(RailPageButton, {
                  dir: -1,
                  onPage: callback10,
                })
              : null,
            value4 === null && value14
              ? SlideRailJsx.jsx(RailPageButton, {
                  dir: 1,
                  onPage: callback10,
                })
              : null,
          ],
        }),
        SlideRailJsx.jsx(runtime.ContextMenuPopup, {
          at: value8 && value19 >= 0 ? value8 : null,
          anchor: value8?.tap ? "tap" : "point",
          "aria-label":
            value19 >= 0 && value8
              ? "Slide " + String(callback(value8.id, value19) + 1) + " actions"
              : undefined,
          focusFirstItem: value8?.keyboard === true,
          onClose: callback15,
          children:
            value8 && value19 >= 0
              ? SlideRailJsx.jsx(SlideContextMenu, {
                  id: value8.id,
                  index: value19,
                  count: slides.length,
                  skipped: slides[value19]?.skipped === true,
                  isCover: value8.id === coverId,
                  readOnly: readOnly,
                  heldSlide: heldSlide,
                  via: callback16,
                  onDuplicate: onDuplicate,
                  onCopy: onCopy,
                  onDelete: onDelete,
                  onToggleSkip: onToggleSkip,
                  onSetCover: onSetCover,
                  onAdd: callback13(value8)
                    ? () =>
                        onAdd({
                          returnFocus: () => ref4.current,
                        })
                    : () => onAdd(),
                  onMove: onMove,
                })
              : null,
        }),
      ],
    });
  }
  function RailPageButton({
    dir: dir,
    onPage: onPage,
  }: RailPageButtonProps): ReactElement {
    let value = SlideRailJsx.jsx("span", {
      "aria-hidden": "true",
      className: (0, runtime.joinClassNames)(
        RAIL_PAGE_GRADIENT_CLASS,
        dir === -1
          ? "left-0 bg-gradient-to-r pointer-coarse:w-14"
          : "right-0 bg-gradient-to-l pointer-coarse:w-14",
      ),
    });
    return SlideRailJsx.jsxs(SlideRailJsx.Fragment, {
      children: [
        dir === 1 ? value : null,
        SlideRailJsx.jsx("button", {
          type: "button",
          tabIndex: -1,
          "aria-label":
            dir === -1 ? "Scroll slides left" : "Scroll slides right",
          onMouseDown: preventRailMouseDownDefault,
          onClick: () => onPage(dir),
          className: (0, runtime.joinClassNames)(
            RAIL_PAGE_BUTTON_CLASS,
            dir === -1 ? "left-0" : "right-0",
          ),
          children: SlideRailJsx.jsx("span", {
            className: RAIL_THUMB_BORDER_CLASS,
            children: SlideRailJsx.jsx(runtime.KitIcon, {
              name: dir === -1 ? "CaretLeft" : "CaretRight",
              size: 14,
            }),
          }),
        }),
        dir === -1 ? value : null,
      ],
    });
  }
  function ThumbnailIndicator(): ReactElement {
    return SlideRailJsx.jsx("span", {
      title: "Thumbnail",
      className: "inline-flex",
      children: SlideRailJsx.jsx(runtime.KitIcon, {
        name: "Image",
        size: 10,
      }),
    });
  }
  function SlideCommentCountBadge({
    count: count,
    className: className,
    style: style,
  }: SlideCommentCountBadgeProps): ReactElement | null {
    let value = Number.isFinite(count) ? Math.floor(count) : 0;
    if (value <= 0) {
      return null;
    }
    return SlideRailJsx.jsx("span", {
      "aria-hidden": "true",
      "data-mc-chrome": "",
      "data-kit": "comment-count",
      className: (0, runtime.joinClassNames)(
        THUMBNAIL_BADGE_CLASS,
        "pointer-events-none rounded-full bg-fill-accent text-on-accent shadow-sm",
        className,
      ),
      style: style,
      children: value > 9 ? "9+" : value,
    });
  }
  function formatOpenCommentCount(count: number): string {
    if (count > 0) {
      return (
        ", " +
        String(count) +
        (count === 1 ? " open comment" : " open comments")
      );
    } else {
      return "";
    }
  }
  function SkippedSlideBadge({
    why: why,
    onUnskip: onUnskip,
    style: style,
  }: SkippedSlideBadgeProps): ReactElement {
    let value = why === undefined;
    return SlideRailJsx.jsx("span", {
      title: "",
      className: "absolute right-0 bottom-0 flex",
      style: style,
      children: SlideRailJsx.jsx(runtime.TooltipWrapper, {
        tip: why ?? "Unskip slide",
        children: SlideRailJsx.jsx("button", {
          type: "button",
          tabIndex: -1,
          "aria-disabled": value ? undefined : true,
          "aria-label": "Unskip slide",
          onMouseDown: value ? preventRailMouseDownDefault : undefined,
          onPointerDown: value
            ? (input: ReactPointerEvent<HTMLButtonElement>) => input.stopPropagation()
            : undefined,
          onClick: value
            ? (input: ReactMouseEvent<HTMLButtonElement>) => {
                input.stopPropagation();
                onUnskip();
              }
            : undefined,
          className: (0, runtime.joinClassNames)(
            "group/skip flex items-end justify-end p-1",
            THUMBNAIL_ACTION_BUTTON_CLASS,
            !value && "pointer-events-none",
          ),
          children: SlideRailJsx.jsx("span", {
            className: (0, runtime.joinClassNames)(
              THUMBNAIL_ICON_BADGE_CLASS,
              THUMBNAIL_BADGE_SURFACE_CLASS,
              "text-fg-muted",
              value && "group-hover/skip:bg-bg-warm group-hover/skip:text-fg",
            ),
            children: SlideRailJsx.jsx(runtime.KitIcon, {
              name: "EyeSlash",
              size: 12,
            }),
          }),
        }),
      }),
    });
  }
  function ThumbnailActionsButton({
    label: label,
    current: current,
    expanded: expanded,
    skipped: skipped,
    inv = 1,
    className: className,
    onOpen: onOpen,
    onMouseDown: onMouseDown,
  }: ThumbnailActionsButtonProps): ReactElement {
    return SlideRailJsx.jsx("div", {
      "data-kit": "thumb-actions",
      className: (0, runtime.joinClassNames)(
        "absolute bottom-0 z-10",
        skipped && SKIPPED_THUMBNAIL_ACTION_OFFSET_CLASS,
        className,
      ),
      style: {
        right: "calc(var(--more-shift, 0px) * " + String(inv) + ")",
        transform: inv === 1 ? undefined : "scale(" + String(inv) + ")",
        transformOrigin: "right bottom",
      },
      children: SlideRailJsx.jsx("button", {
        type: "button",
        tabIndex: current ? 0 : -1,
        "aria-haspopup": "menu",
        "aria-expanded": expanded,
        "aria-label": label,
        onPointerDown: (input: ReactPointerEvent<HTMLButtonElement>) => input.stopPropagation(),
        onMouseDown: onMouseDown,
        onDoubleClick: (input: ReactMouseEvent<HTMLButtonElement>) => input.stopPropagation(),
        onKeyDown: (event: ReactKeyboardEvent<HTMLButtonElement>) => {
          if (event.repeat && (event.key === "Enter" || event.key === " ")) {
            event.preventDefault();
          }
        },
        onClick: (input: ReactMouseEvent<HTMLButtonElement>) => {
          input.stopPropagation();
          onOpen(
            (
              input.currentTarget.firstElementChild ?? input.currentTarget
            ).getBoundingClientRect(),
            (0, runtime.isKeyboardOrPrimaryActivation)(input),
            input.currentTarget,
          );
        },
        className: (0, runtime.joinClassNames)(
          "group/more flex h-8 w-8 cursor-default items-end justify-end p-1 outline-hidden pointer-coarse:h-10 pointer-coarse:w-10",
          skipped && "pr-0",
        ),
        children: SlideRailJsx.jsx("span", {
          className: (0, runtime.joinClassNames)(
            THUMBNAIL_ICON_BADGE_CLASS,
            THUMBNAIL_BADGE_SURFACE_CLASS,
            "text-fg group-hover/more:bg-bg-warm group-aria-expanded/more:bg-bg-warm group-focus-visible/more:shadow-[0_0_0_2px_var(--t-app-accent)] group-focus-visible/more:ring-0",
          ),
          children: SlideRailJsx.jsx(runtime.KitIcon, {
            name: "DotsHorizontal",
            size: 12,
          }),
        }),
      }),
    });
  }
  function SlideRailToolbar({
    readOnly: readOnly,
    onAdd: onAdd,
    notesOpen = false,
    onToggleNotes: onToggleNotes,
    notesDisabledReason: notesDisabledReason,
    gridOpen = false,
    slideShortcut: slideShortcut,
    canvasShortcut = gridOpen ? undefined : "shift+cmd+0",
    onSetGridOpen: onSetGridOpen,
    onCollapse: onCollapse,
    collapseDisabledReason: collapseDisabledReason,
  }: SlideRailToolbarProps): ReactElement {
    return SlideRailJsx.jsxs(runtime.CdsRoot, {
      density: "compact",
      render: SlideRailJsx.jsx("div", {
        "data-rail-actions": "",
      }),
      className: "flex items-center justify-between px-2 pt-1.5 pb-1",
      children: [
        SlideRailJsx.jsxs("div", {
          className: "flex items-center gap-1",
          children: [
            readOnly
              ? null
              : SlideRailJsx.jsx(runtime.TooltipWrapper, {
                  tip: "Add slide",
                  children: SlideRailJsx.jsx(runtime.Button, {
                    iconOnly: true,
                    variant: "ghost",
                    icon: "Add",
                    "aria-label": "Add slide",
                    onClick: () => onAdd(),
                  }),
                }),
            onToggleNotes && notesDisabledReason !== undefined
              ? SlideRailJsx.jsx(runtime.TooltipWrapper, {
                  tip: notesDisabledReason,
                  children: SlideRailJsx.jsx(runtime.Button, {
                    iconOnly: true,
                    variant: "ghost",
                    icon: "BookText",
                    "aria-label": "Speaker notes",
                    pressed: notesOpen,
                    disabled: true,
                    onClick: onToggleNotes,
                  }),
                })
              : onToggleNotes
                ? SlideRailJsx.jsx(runtime.Button, {
                    iconOnly: true,
                    variant: "ghost",
                    icon: "BookText",
                    "aria-label": "Speaker notes",
                    tooltip: notesOpen
                      ? "Hide speaker notes"
                      : "Show speaker notes",
                    pressed: notesOpen,
                    onClick: onToggleNotes,
                  })
                : null,
          ],
        }),
        SlideRailJsx.jsxs("div", {
          className: "flex items-center gap-1.5",
          children: [
            onSetGridOpen
              ? SlideRailJsx.jsx(SlidesViewSwitch, {
                  gridOpen: gridOpen,
                  slideShortcut: slideShortcut,
                  canvasShortcut: canvasShortcut,
                  onSetGridOpen: onSetGridOpen,
                })
              : null,
            onCollapse && collapseDisabledReason !== undefined
              ? SlideRailJsx.jsx(runtime.TooltipWrapper, {
                  tip: collapseDisabledReason,
                  children: SlideRailJsx.jsx(runtime.Button, {
                    iconOnly: true,
                    variant: "ghost",
                    icon: "CaretDown",
                    "aria-label": "Hide slide thumbnails",
                    disabled: true,
                    onClick: onCollapse,
                  }),
                })
              : onCollapse
                ? SlideRailJsx.jsx(runtime.Button, {
                    iconOnly: true,
                    variant: "ghost",
                    icon: "CaretDown",
                    "aria-label": "Hide slide thumbnails",
                    "data-slides-rail-hide": "",
                    onClick: onCollapse,
                  })
                : null,
          ],
        }),
      ],
    });
  }
  function SlidesViewSwitch({
    gridOpen: gridOpen,
    slideShortcut: slideShortcut,
    canvasShortcut: canvasShortcut,
    onSetGridOpen: onSetGridOpen,
  }: SlidesViewSwitchProps): ReactElement {
    return SlideRailJsx.jsx("div", {
      "data-slides-view-switch": "",
      className: "flex",
      onKeyDownCapture: (event: ReactKeyboardEvent<HTMLDivElement>) => {
        let value =
          event.target instanceof HTMLElement &&
          event.target.getAttribute("role") === "radio"
            ? event.target
            : null;
        if (value === null) {
          return;
        }
        let value2 = SLIDE_VIEW_SWITCH_NAVIGATION_KEYS[event.key];
        if (event.altKey || event.ctrlKey || event.metaKey) {
          if (event.key.startsWith("Arrow")) {
            event.stopPropagation();
          }
          return;
        }
        if (value2 !== undefined) {
          event.preventDefault();
          event.stopPropagation();
          let value3 = Array.from(
              event.currentTarget.querySelectorAll<HTMLElement>(
                '[role="radio"]:not([data-disabled])',
              ),
            ),
            value4 = value3.indexOf(value);
          if (value4 < 0) {
            return;
          }
          let value5 =
            value2 === "first"
              ? 0
              : value2 === "last"
                ? value3.length - 1
                : (value4 + (value2 === "prev" ? -1 : 1) + value3.length) %
                  value3.length;
          value3[value5]?.focus();
        } else if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          event.stopPropagation();
          if (!event.repeat) {
            value.click();
          }
        }
      },
      children: SlideRailJsx.jsx(runtime.SegmentedControl, {
        "aria-label": "View",
        segments: [
          {
            value: "slide",
            icon: "Stop",
            tooltip: "Slide",
            ...(slideShortcut !== undefined
              ? {
                  shortcut: slideShortcut,
                }
              : {}),
          },
          {
            value: "grid",
            icon: "Grid",
            tooltip: "Canvas",
            ...(canvasShortcut !== undefined
              ? {
                  shortcut: canvasShortcut,
                }
              : {}),
          },
        ],
        value: gridOpen ? "grid" : "slide",
        onChange: (input: string) => onSetGridOpen(input === "grid"),
      }),
    });
  }
  function SlideContextMenu({
    id: id,
    index: index,
    count: count,
    skipped: skipped,
    isCover: isCover,
    readOnly: readOnly,
    heldSlide: heldSlide,
    via: via,
    group: group,
    onNewSection: onNewSection,
    newSectionDisabledReason: newSectionDisabledReason,
    onDuplicate: onDuplicate,
    onCopy: onCopy,
    onDelete: onDelete,
    onToggleSkip: onToggleSkip,
    onSetCover: onSetCover,
    onAdd: onAdd,
    onMove: onMove,
  }: SlideContextMenuProps): ReactElement {
    let value =
        group !== undefined && group.ids.length > 1 ? group.ids : undefined,
      value2 = value?.length ?? 1,
      value3 = value ? String(value2) + " slides" : "slide",
      value4 = value
        ? value.some(
            (input) => heldSlide?.(input) !== undefined,
          )
        : heldSlide?.(id) !== undefined,
      value5 = value
        ? "One of these can’t be edited until its saved content is fixed"
        : "Can’t be edited until its saved content is fixed",
      value6 = value ? group!.moveReason : undefined;
    return SlideRailJsx.jsxs(SlideRailJsx.Fragment, {
      children: [
        SlideRailJsx.jsx(runtime.Menu.Item, {
          shortcut: runtime.EDIT_COMMAND_DEFINITIONS.duplicate.shortcut,
          ...disabledActionFromReason(
            readOnly ? READ_ONLY_PRESENTATION_MESSAGE : undefined,
          ),
          onClick: via(
            () => (value ? group!.onDuplicate(value) : onDuplicate(id)),
          ),
          children: "Duplicate " + value3,
        }),
        SlideRailJsx.jsx(runtime.Menu.Item, {
          shortcut: runtime.EDIT_COMMAND_DEFINITIONS.copy.shortcut,
          onClick: via(
            () => (value ? group!.onCopy(value) : onCopy(id)),
          ),
          children: "Copy " + value3,
        }),
        SlideRailJsx.jsx(runtime.Menu.Item, {
          ...disabledActionFromReason(
            readOnly
              ? READ_ONLY_PRESENTATION_MESSAGE
              : value4
                ? value5
                : undefined,
          ),
          onClick: via(
            () =>
              value
                ? group!.onSetSkipped(value, !group!.allSkipped)
                : onToggleSkip(id),
          ),
          children:
            ((value ? group!.allSkipped : skipped) ? "Unskip " : "Skip ") +
            value3,
        }),
        onSetCover
          ? SlideRailJsx.jsx(runtime.Menu.Item, {
              ...disabledActionFromReason(
                readOnly
                  ? READ_ONLY_PRESENTATION_MESSAGE
                  : isCover
                    ? SLIDE_ALREADY_AT_DESTINATION_MESSAGE
                    : undefined,
              ),
              onClick: via(() => onSetCover(id)),
              children: "Set as thumbnail",
            })
          : null,
        onNewSection
          ? SlideRailJsx.jsx(runtime.Menu.Item, {
              ...disabledActionFromReason(
                readOnly
                  ? READ_ONLY_PRESENTATION_MESSAGE
                  : newSectionDisabledReason,
              ),
              onClick: via(onNewSection),
              children: value
                ? "Move " + value3 + " to a new section"
                : "Move to a new section",
            })
          : null,
        SlideRailJsx.jsx(runtime.Menu.Separator, {}),
        SlideRailJsx.jsx(runtime.Menu.Item, {
          ...disabledActionFromReason(
            readOnly ? READ_ONLY_PRESENTATION_MESSAGE : undefined,
          ),
          onClick: via(onAdd),
          children: "Add slide after",
        }),
        SlideRailJsx.jsx(runtime.Menu.Item, {
          ...disabledActionFromReason(
            readOnly
              ? READ_ONLY_PRESENTATION_MESSAGE
              : (value6 ?? (index === 0 ? "Already first" : undefined)),
          ),
          onClick: via(() => onMove(id, index - 1)),
          children: "Move left",
        }),
        SlideRailJsx.jsx(runtime.Menu.Item, {
          ...disabledActionFromReason(
            readOnly
              ? READ_ONLY_PRESENTATION_MESSAGE
              : (value6 ?? (index >= count - 1 ? "Already last" : undefined)),
          ),
          onClick: via(() => onMove(id, index + 1)),
          children: "Move right",
        }),
        SlideRailJsx.jsx(runtime.Menu.Separator, {}),
        SlideRailJsx.jsx(runtime.Menu.Item, {
          variant: "danger",
          shortcut: runtime.EDIT_COMMAND_DEFINITIONS.delete.shortcut,
          ...disabledActionFromReason(
            readOnly
              ? READ_ONLY_PRESENTATION_MESSAGE
              : count - value2 < 1
                ? "A presentation needs at least one slide"
                : value4
                  ? value5
                  : undefined,
          ),
          onClick: via(
            () => (value ? group!.onDelete(value) : onDelete(id)),
          ),
          children: "Delete " + value3,
        }),
      ],
    });
  }
  bindRuntimeValue(
    runtime,
    "SlideRailJsx",
    () => SlideRailJsx,
    (value) => {
      SlideRailJsx = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SlideCreationRailPlaceholder",
    () => SlideCreationRailPlaceholder,
  );
  bindRuntimeValue(
    runtime,
    "SlideCreationRailCell",
    () => SlideCreationRailCell,
  );
  bindRuntimeValue(
    runtime,
    "INHERIT_RAIL_THUMB_WIDTH_CLASS",
    () => INHERIT_RAIL_THUMB_WIDTH_CLASS,
    (value) => {
      INHERIT_RAIL_THUMB_WIDTH_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "RAIL_THUMB_DIMENSIONS_STYLE",
    () => RAIL_THUMB_DIMENSIONS_STYLE,
    (value) => {
      RAIL_THUMB_DIMENSIONS_STYLE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "READ_ONLY_PRESENTATION_MESSAGE",
    () => READ_ONLY_PRESENTATION_MESSAGE,
    (value) => {
      READ_ONLY_PRESENTATION_MESSAGE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SLIDE_ALREADY_AT_DESTINATION_MESSAGE",
    () => SLIDE_ALREADY_AT_DESTINATION_MESSAGE,
    (value) => {
      SLIDE_ALREADY_AT_DESTINATION_MESSAGE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "adjustMoveIndexAfterRemoval",
    () => adjustMoveIndexAfterRemoval,
  );
  bindRuntimeValue(
    runtime,
    "getRailScrollButtonPadding",
    () => getRailScrollButtonPadding,
    (value) => {
      getRailScrollButtonPadding = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "calculateRailPageScroll",
    () => calculateRailPageScroll,
  );
  bindRuntimeValue(
    runtime,
    "preventRailMouseDownDefault",
    () => preventRailMouseDownDefault,
    (value) => {
      preventRailMouseDownDefault = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "getRailScrollBehavior",
    () => getRailScrollBehavior,
    (value) => {
      getRailScrollBehavior = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "scrollRailThumbnailIntoView",
    () => scrollRailThumbnailIntoView,
  );
  bindRuntimeValue(
    runtime,
    "RAIL_HOVER_ACTIONS_CLASS",
    () => RAIL_HOVER_ACTIONS_CLASS,
    (value) => {
      RAIL_HOVER_ACTIONS_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "RAIL_PAGE_BUTTON_CLASS",
    () => RAIL_PAGE_BUTTON_CLASS,
    (value) => {
      RAIL_PAGE_BUTTON_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "RAIL_THUMB_BORDER_CLASS",
    () => RAIL_THUMB_BORDER_CLASS,
    (value) => {
      RAIL_THUMB_BORDER_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "RAIL_PAGE_GRADIENT_CLASS",
    () => RAIL_PAGE_GRADIENT_CLASS,
    (value) => {
      RAIL_PAGE_GRADIENT_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "RAIL_SELECTION_RING_CLASS",
    () => RAIL_SELECTION_RING_CLASS,
    (value) => {
      RAIL_SELECTION_RING_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "formatSlideThumbnailLabel",
    () => formatSlideThumbnailLabel,
  );
  bindRuntimeValue(runtime, "SlideThumbnailRail", () => SlideThumbnailRail);
  bindRuntimeValue(runtime, "RailPageButton", () => RailPageButton);
  bindRuntimeValue(runtime, "ThumbnailIndicator", () => ThumbnailIndicator);
  bindRuntimeValue(
    runtime,
    "THUMBNAIL_BADGE_CLASS",
    () => THUMBNAIL_BADGE_CLASS,
    (value) => {
      THUMBNAIL_BADGE_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "THUMBNAIL_BADGE_SURFACE_CLASS",
    () => THUMBNAIL_BADGE_SURFACE_CLASS,
    (value) => {
      THUMBNAIL_BADGE_SURFACE_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "THUMBNAIL_ICON_BADGE_CLASS",
    () => THUMBNAIL_ICON_BADGE_CLASS,
    (value) => {
      THUMBNAIL_ICON_BADGE_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SlideCommentCountBadge",
    () => SlideCommentCountBadge,
  );
  bindRuntimeValue(
    runtime,
    "formatOpenCommentCount",
    () => formatOpenCommentCount,
  );
  bindRuntimeValue(
    runtime,
    "THUMBNAIL_ACTION_BUTTON_CLASS",
    () => THUMBNAIL_ACTION_BUTTON_CLASS,
    (value) => {
      THUMBNAIL_ACTION_BUTTON_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SKIPPED_THUMBNAIL_ACTION_OFFSET_CLASS",
    () => SKIPPED_THUMBNAIL_ACTION_OFFSET_CLASS,
    (value) => {
      SKIPPED_THUMBNAIL_ACTION_OFFSET_CLASS = value;
    },
  );
  bindRuntimeValue(runtime, "SkippedSlideBadge", () => SkippedSlideBadge);
  bindRuntimeValue(
    runtime,
    "ThumbnailActionsButton",
    () => ThumbnailActionsButton,
  );
  bindRuntimeValue(runtime, "SlideRailToolbar", () => SlideRailToolbar);
  bindRuntimeValue(
    runtime,
    "SLIDE_VIEW_SWITCH_NAVIGATION_KEYS",
    () => SLIDE_VIEW_SWITCH_NAVIGATION_KEYS,
    (value) => {
      SLIDE_VIEW_SWITCH_NAVIGATION_KEYS = value;
    },
  );
  bindRuntimeValue(runtime, "SlidesViewSwitch", () => SlidesViewSwitch);
  bindRuntimeValue(
    runtime,
    "disabledActionFromReason",
    () => disabledActionFromReason,
    (value) => {
      disabledActionFromReason = value;
    },
  );
  bindRuntimeValue(runtime, "SlideContextMenu", () => SlideContextMenu);
  return () => {
    SlideRailJsx = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
    INHERIT_RAIL_THUMB_WIDTH_CLASS = "[--sl-thumb-w:inherit]";
    RAIL_THUMB_DIMENSIONS_STYLE = {
      width: "calc(var(" + runtime.RAIL_THUMB_WIDTH_CSS_VARIABLE + ") * 1px)",
      height:
        "calc(var(" +
        runtime.RAIL_THUMB_WIDTH_CSS_VARIABLE +
        ") * " +
        String(runtime.SLIDE_HEIGHT / runtime.SLIDE_WIDTH) +
        "px)",
    };
    READ_ONLY_PRESENTATION_MESSAGE =
      "Read-only — this presentation can’t be edited here";
    SLIDE_ALREADY_AT_DESTINATION_MESSAGE =
      "This slide is already the thumbnail";
    getRailScrollButtonPadding = () =>
      window.matchMedia("(pointer: coarse)").matches ? 56 : 40;
    preventRailMouseDownDefault = (event: { preventDefault(): void }) =>
      event.preventDefault();
    getRailScrollBehavior = () =>
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth";
    RAIL_HOVER_ACTIONS_CLASS =
      "opacity-0 transition-opacity duration-150 group-hover/rail:opacity-100 group-has-[:focus-visible]/rail:opacity-100 pointer-coarse:opacity-100";
    RAIL_PAGE_BUTTON_CLASS = (0, runtime.joinClassNames)(
      "group absolute inset-y-0 z-20 flex w-7 cursor-default items-center justify-center pointer-coarse:w-10",
      "pointer-events-none group-hover/rail:pointer-events-auto group-has-[:focus-visible]/rail:pointer-events-auto pointer-coarse:pointer-events-auto",
      RAIL_HOVER_ACTIONS_CLASS,
    );
    RAIL_THUMB_BORDER_CLASS =
      "inline-flex h-8 w-5 items-center justify-center rounded-md bg-panel/90 text-fg-muted shadow-sm ring-1 ring-border-line group-hover:bg-panel group-hover:text-fg";
    RAIL_PAGE_GRADIENT_CLASS = (0, runtime.joinClassNames)(
      "pointer-events-none absolute inset-y-0 z-10 w-10 from-panel/45 to-transparent",
      RAIL_HOVER_ACTIONS_CLASS,
    );
    RAIL_SELECTION_RING_CLASS =
      "Skipped — left out of Present, export, and print";
    THUMBNAIL_BADGE_CLASS =
      "flex min-w-4 items-center justify-center gap-0.5 px-1 text-[9px] leading-4";
    THUMBNAIL_BADGE_SURFACE_CLASS =
      "rounded-sm bg-panel/90 shadow-sm ring-1 ring-border-line";
    THUMBNAIL_ICON_BADGE_CLASS = "flex h-4 w-4 items-center justify-center";
    THUMBNAIL_ACTION_BUTTON_CLASS =
      "h-7 w-6 pointer-coarse:h-10 pointer-coarse:w-10";
    SKIPPED_THUMBNAIL_ACTION_OFFSET_CLASS =
      "[--more-shift:1.5rem] pointer-coarse:[--more-shift:2.5rem]";
    SLIDE_VIEW_SWITCH_NAVIGATION_KEYS = {
      ArrowLeft: "prev",
      ArrowUp: "prev",
      ArrowRight: "next",
      ArrowDown: "next",
      Home: "first",
      End: "last",
    };
    disabledActionFromReason = (input?: string) => ({
      disabled: input !== undefined,
      disabledReason: input ?? null,
    });
  };
}
