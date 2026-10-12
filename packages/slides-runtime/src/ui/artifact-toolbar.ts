/** Restored application module; prepare first, initialize in original order. */
import type {
  MouseEvent as ReactMouseEvent,
  ReactElement,
  ReactNode,
} from "react";
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type JsxNamespace,
  type ReactNamespace,
} from "../bindings";
import type { ArtifactSaveStatus } from "../documents/artifact-document";
import type { CommandHistory } from "../editor/command-history";
import type { TooltipSide } from "./avatars";
import type { SurfaceProps } from "./disclosure";
import type { CdsDensity } from "./overlays";

/** Options of the check that decides whether a toolbar element shows anything. */
export interface ToolbarContentOptions {
  /** Elements that never count as content. */
  skip?: (element: Element) => boolean;
  /** Ignore elements pinned in the scrolling area. */
  pinFixed?: boolean;
}
/** What `useToolbarInsets` returns: top inset, ref callback of the measured element, side inset. */
export type ToolbarInsets = [number, (element: HTMLElement | null) => void, number];
/** Save states the toolbar renders; "cached" is a locally cached copy waiting for the server. */
export type ToolbarSaveStatus = ArtifactSaveStatus | "cached";
/** Where the document stands with saving, as far as the toolbar shows it. */
export interface ToolbarSaveState {
  status: ToolbarSaveStatus;
  message?: string;
}
/** The slice of the command history that the toolbar's undo and redo buttons drive. */
export type ToolbarUndo = Pick<CommandHistory, "canUndo" | "canRedo" | "undo" | "redo"> & {
  subscribe: (listener: () => void) => () => void;
};
export interface SaveStatusDotProps {
  state: ToolbarSaveState;
}
export interface SaveStatusControlProps {
  state: ToolbarSaveState;
  onRetry: () => void;
  tipSide?: TooltipSide;
}
export interface ToolbarScrollPaddleProps {
  dir: 1 | -1;
  /** Pages the toolbar; `keyboard` is true when the click came from the keyboard. */
  onPress: (keyboard: boolean) => void;
  onLetGo: () => void;
}
export interface ToolbarScrollAreaProps {
  leading?: ReactNode;
  /** When this changes, scroll back to the start so `leading` is visible. */
  revealLeading?: ToolbarSaveStatus;
  children?: ReactNode;
}
export interface ToolbarSaveControlsProps {
  saveState: ToolbarSaveState;
  saveMode?: "manual" | "auto";
  onSave: () => void;
  /** Show the sync dot instead of the save button. */
  syncDot?: boolean;
  editing?: boolean;
  onToggleEdit?: () => void;
}
export interface ToolbarSurfaceProps extends Omit<SurfaceProps, "elevation"> {
  /** Draw as a floating card instead of a plain row. */
  floating?: boolean;
}
/** Props of `ArtifactToolbar`. */
export interface ArtifactToolbarProps {
  title?: string;
  saveState: ToolbarSaveState;
  saveMode?: "manual" | "auto";
  syncDot?: boolean;
  onSave: () => void;
  undo?: ToolbarUndo | null;
  publishControls?: boolean;
  pinned?: ReactNode;
  trailing?: ReactNode;
  leading?: ReactNode;
  afterUndo?: ReactNode;
  undoButtons?: boolean;
  density?: CdsDensity;
  touchTargets?: string;
  readOnly?: boolean;
  /** A read-only reason that should not be announced as a toolbar warning. */
  quietReadOnlyReason?: string;
  variant?: "docked" | "floating";
  children?: ReactNode;
  extrasEnd?: ReactNode;
}

declare module "../bindings" {
  interface RuntimeBindings {
    reactA6: ReactNamespace;
    jsx_5: JsxNamespace;
    TOOLBAR_WIDE_BREAKPOINT: number;
    TOOLBAR_COMPACT_BREAKPOINT: number;
    TOOLBAR_FULL_BREAKPOINT: number;
    TOOLBAR_QUIET_SELECTOR: string;
    TOOLBAR_CONTENT_SELECTOR: string;
    TOOLBAR_LAYOUT_ROLES: Set<string>;
    hasVisibleToolbarContent: (element: Element, options?: ToolbarContentOptions) => boolean;
    toolbarContentCount: (element: Element, options?: ToolbarContentOptions) => number;
    isToolbarSaveIndicator: (element: Element) => boolean;
    toggleAttributeIfChanged: (element: Element, attribute: string, enabled: boolean) => void;
    updateToolbarEmptyState: (toolbar: Element) => void;
    TOOLBAR_WORD_LOCK_MARGIN: number;
    updateToolbarWordLock: (toolbar: Element) => void;
    effectiveToolbarDensity: (density?: CdsDensity) => CdsDensity;
    useToolbarInsets: () => ToolbarInsets;
    ArtifactToolbarDivider: () => ReactElement;
    SaveStatusDot: (props: SaveStatusDotProps) => ReactElement;
    SaveStatusControl: (props: SaveStatusControlProps) => ReactElement | null;
    SaveProblemStatus: (props: SaveStatusDotProps) => ReactElement | null;
    toolbarScrollPageTarget: (
      direction: 1 | -1,
      scrollLeft: number,
      viewportWidth: number,
      scrollWidth: number,
      margin: number,
    ) => number;
    TOOLBAR_PADDLE_CLASS: string;
    isFocusVisible: (element: Element) => boolean;
    ToolbarScrollPaddle: (props: ToolbarScrollPaddleProps) => ReactElement;
    ToolbarScrollArea: (props: ToolbarScrollAreaProps) => ReactElement;
    ToolbarSaveControls: (props: ToolbarSaveControlsProps) => ReactElement;
    ToolbarSurface: (props: ToolbarSurfaceProps) => ReactElement;
    ArtifactToolbar: (props: ArtifactToolbarProps) => ReactElement;
  }
}

export function installUiArtifactToolbar(runtime: RuntimeBindings): () => void {
  var reactA6: ReactNamespace;
  var jsx_5: JsxNamespace;
  var TOOLBAR_WIDE_BREAKPOINT: RuntimeBindings["TOOLBAR_WIDE_BREAKPOINT"];
  var TOOLBAR_COMPACT_BREAKPOINT: RuntimeBindings["TOOLBAR_COMPACT_BREAKPOINT"];
  var TOOLBAR_FULL_BREAKPOINT: RuntimeBindings["TOOLBAR_FULL_BREAKPOINT"];
  var TOOLBAR_QUIET_SELECTOR: RuntimeBindings["TOOLBAR_QUIET_SELECTOR"];
  var TOOLBAR_CONTENT_SELECTOR: RuntimeBindings["TOOLBAR_CONTENT_SELECTOR"];
  var TOOLBAR_LAYOUT_ROLES: RuntimeBindings["TOOLBAR_LAYOUT_ROLES"];
  var isToolbarSaveIndicator: RuntimeBindings["isToolbarSaveIndicator"];
  var toggleAttributeIfChanged: RuntimeBindings["toggleAttributeIfChanged"];
  var TOOLBAR_WORD_LOCK_MARGIN: RuntimeBindings["TOOLBAR_WORD_LOCK_MARGIN"];
  var TOOLBAR_PADDLE_CLASS: RuntimeBindings["TOOLBAR_PADDLE_CLASS"];
  function hasVisibleToolbarContent(
    element: Element,
    options: ToolbarContentOptions = {},
  ): boolean {
    let attribute = element.getAttribute("role");
    if (
      options.skip?.(element) ||
      (options.pinFixed && element.classList.contains("tb-pin-scroll"))
    ) {
      return false;
    }
    if (element.hasAttribute("data-tb-shows") && !element.closest("[hidden]")) {
      return true;
    }
    if (element.matches(TOOLBAR_QUIET_SELECTOR) || attribute === "separator") {
      return false;
    }
    if (
      element.matches(TOOLBAR_CONTENT_SELECTOR) ||
      (attribute !== null && !TOOLBAR_LAYOUT_ROLES.has(attribute))
    ) {
      return true;
    }
    for (let value of element.childNodes) {
      if (value.nodeType === 3 && value.textContent?.trim()) {
        return true;
      }
      if (
        value.nodeType === 1 &&
        hasVisibleToolbarContent(value as Element, options)
      ) {
        return true;
      }
    }
    return false;
  }
  function toolbarContentCount(
    element: Element,
    options?: ToolbarContentOptions,
  ): number {
    let index = 0;
    for (let value of element.children)
      index += value.matches("[data-tb-seat], .contents")
        ? toolbarContentCount(value, options)
        : hasVisibleToolbarContent(value, options)
          ? 1
          : 0;
    return index;
  }
  function updateToolbarEmptyState(toolbar: Element): void {
    let state = {
      pinFixed: toolbar.hasAttribute("data-pin-fixed"),
    };
    for (let value of toolbar.querySelectorAll(
      ".tb-slot, .tb-tail, .tb-publish",
    ))
      toggleAttributeIfChanged(
        value,
        "data-tb-empty",
        !hasVisibleToolbarContent(value, state),
      );
    for (let value of toolbar.querySelectorAll(".tb-tail"))
      toggleAttributeIfChanged(
        value,
        "data-tb-only-dot",
        !hasVisibleToolbarContent(value, {
          ...state,
          skip: isToolbarSaveIndicator,
        }),
      );
    for (let value of toolbar.querySelectorAll(".tb-publish"))
      toggleAttributeIfChanged(
        value,
        "data-tb-has-save",
        [...value.querySelectorAll("[data-tb-save]")].some(
          (input) => hasVisibleToolbarContent(input, state),
        ),
      );
    for (let value of toolbar.querySelectorAll(".tb-card"))
      toggleAttributeIfChanged(
        value,
        "data-tb-empty",
        !hasVisibleToolbarContent(value, state),
      );
    let element = toolbar.querySelector(".tb-card-start");
    if (element) {
      let index = 0;
      for (let value of element.querySelectorAll(
        ".tb-scroll > .tb-slot",
      ))
        index += toolbarContentCount(value, state);
      toggleAttributeIfChanged(element, "data-tb-floor", index >= 3);
    }
  }
  function updateToolbarWordLock(toolbar: Element): void {
    let element = toolbar.querySelector<HTMLElement>(".tb-scroll");
    if (!element) {
      return;
    }
    if (!element.querySelector(".tb-lock-words")) {
      return element.removeAttribute("data-tb-lock-words");
    }
    if (element.scrollLeft > 1 && !element.hasAttribute("data-tb-lock-words")) {
      return;
    }
    let element2 = element.querySelector<HTMLElement>(".tb-yields"),
      value = element2 ? "yield" : "";
    if (element.getAttribute("data-tb-lock-words") !== value) {
      element.setAttribute("data-tb-lock-words", value);
    }
    let value2 =
      element2 != null &&
      element2.clientWidth < TOOLBAR_WORD_LOCK_MARGIN &&
      element2.scrollWidth > element2.clientWidth;
    if (element.scrollWidth > element.clientWidth + 1 || value2) {
      element.removeAttribute("data-tb-lock-words");
    }
  }
  function effectiveToolbarDensity(density: CdsDensity = "compact"): CdsDensity {
    if ((0, runtime.useCoarsePointer)()) {
      return "comfortable";
    } else {
      return density;
    }
  }
  function useToolbarInsets(): ToolbarInsets {
    let [value, value2] = reactA6.useState(0),
      [value3, value4] = reactA6.useState(0),
      [value5, value6] = reactA6.useState<HTMLElement | null>(null);
    reactA6.useLayoutEffect((): (() => void) | undefined => {
      let value7: HTMLElement | null = null;
      for (
        let value11: HTMLElement | null | undefined = value5?.parentElement;
        value11 && !value7;
        value11 = value11.parentElement
      )
        value7 = value11.querySelector<HTMLElement>(":scope > .tb-root");
      if (!value5 || !value7) {
        value2(0);
        value4(0);
        return;
      }
      let value8 = value7,
        callback = (): void => {
          if (!value8.hasAttribute("data-tb-overlay")) {
            value2(0);
            value4(0);
            return;
          }
          let bounds = value8.getBoundingClientRect();
          value2(
            Math.max(
              0,
              Math.round(bounds.bottom - value5.getBoundingClientRect().top),
            ),
          );
          let value11 = [...value8.querySelectorAll(".tb-card")]
            .map((input): DOMRect => input.getBoundingClientRect())
            .filter((input): boolean => input.width > 0)
            .flatMap(
              (input): number[] => [
                input.left - bounds.left,
                bounds.right - input.right,
              ],
            );
          value4(
            value11.length > 0
              ? Math.max(0, Math.round(Math.min(...value11)))
              : 0,
          );
        };
      callback();
      let value9: MutationObserver | null =
        typeof MutationObserver === "undefined"
          ? null
          : new MutationObserver(callback);
      value9?.observe(value8, {
        attributes: true,
        attributeFilter: ["data-tb-overlay"],
      });
      let value10: ResizeObserver | null =
        typeof ResizeObserver === "undefined"
          ? null
          : new ResizeObserver(callback);
      value10?.observe(value8);
      value10?.observe(value5);
      return (): void => {
        value9?.disconnect();
        value10?.disconnect();
      };
    }, [value5]);
    return [value, value6, value3];
  }
  function ArtifactToolbarDivider(): ReactElement {
    return jsx_5.jsx("span", {
      "aria-hidden": "true",
      className:
        "tb-divider mx-0.5 h-[18px] w-px shrink-0 self-center bg-border-line",
    });
  }
  function SaveStatusDot({ state: state }: SaveStatusDotProps): ReactElement {
    if (state.status === "error" || state.status === "readonly") {
      return jsx_5.jsx(SaveProblemStatus, {
        state: state,
      });
    }
    let value = state.status === "saving",
      value2 = state.status === "dirty";
    return jsx_5.jsxs("span", {
      role: "status",
      title: value
        ? "Saving…"
        : value2
          ? "Edits are held in the editor — they save when applied"
          : "Every change saves automatically",
      className:
        "inline-flex shrink-0 items-center gap-1.5 text-xs whitespace-nowrap text-fg-muted",
      children: [
        jsx_5.jsx("span", {
          className:
            "h-1.5 w-1.5 shrink-0 rounded-full " +
            (value || value2 ? "bg-fill-warning" : "bg-fill-success"),
        }),
        jsx_5.jsx("span", {
          className: "tb-status-text truncate",
          children: value
            ? "Saving…"
            : value2
              ? "Unsaved edits"
              : "Saved automatically",
        }),
      ],
    });
  }
  function SaveStatusControl({
    state: state,
    onRetry: onRetry,
    tipSide = "bottom",
  }: SaveStatusControlProps): ReactElement | null {
    let value = reactA6.useSyncExternalStore(
        runtime.subscribeHostSaveChrome,
        runtime.hostDrawsSave,
        () => false,
      ),
      value2 = reactA6.useSyncExternalStore(
        runtime.subscribeHostSaveChrome,
        runtime.hostTakesRetry,
        () => false,
      ),
      [value3, value4] = reactA6.useState(false),
      [value5, value6] = reactA6.useState(false),
      [value7, value8] = reactA6.useState(false),
      status = state.status,
      value9 =
        status === "saving" || status === "dirty" || status === "loading";
    if (value7 && !value9 && status !== "error") {
      value8(false);
    }
    let value10 = value3 || value5 || (value7 && value9);
    if (value && (status !== "error" || value2) && !value10) {
      return null;
    }
    let value11 =
        status === "loading" || status === "cached"
          ? "loading"
          : status === "error"
            ? "error"
            : status === "dirty" || status === "saving"
              ? "pending"
              : "synced",
      value12 = value11 === "synced" && !value10,
      value13 =
        state.message ??
        (value11 === "pending"
          ? "Syncing…"
          : value11 === "error"
            ? "Couldn’t sync — click to retry"
            : "All changes synced"),
      value14 = status === "error" || status === "dirty";
    return jsx_5.jsx(runtime.Tooltip, {
      content: value13,
      side: tipSide,
      align: "end",
      multiline: true,
      hoverable: false,
      closeOnClick: false,
      children: jsx_5.jsx("button", {
        type: "button",
        "aria-disabled": value14 ? undefined : true,
        onClick: () => {
          if (!value14) {
            return;
          }
          if (status === "error") {
            value8(true);
          }
          onRetry();
        },
        onFocus: () => value4(true),
        onBlur: () => value4(false),
        onPointerEnter: () => value6(true),
        onPointerLeave: () => value6(false),
        "aria-label": value13,
        "data-sync": value11,
        "data-quiet": value12 ? "" : undefined,
        "data-testid": "sync-dot",
        className: "tb-sync-dot",
        children: jsx_5.jsx("span", {
          "aria-hidden": "true",
          className: "tb-sync-dot-mark",
        }),
      }),
    });
  }
  function SaveProblemStatus({
    state: state,
  }: SaveStatusDotProps): ReactElement | null {
    let value = reactA6.useSyncExternalStore(
      runtime.subscribeHostSaveChrome,
      runtime.hostDrawsReadOnly,
      () => false,
    );
    if (state.status === "error") {
      let value2 = state.message ?? "Couldn’t save";
      return jsx_5.jsxs("span", {
        role: "status",
        title: value2,
        className:
          "inline-flex max-w-80 shrink-0 items-center gap-1.5 truncate rounded-full bg-bad/10 px-2 py-0.5 text-xs font-medium whitespace-nowrap text-bad",
        children: [
          jsx_5.jsx("span", {
            className: "h-1.5 w-1.5 shrink-0 rounded-full bg-fill-danger",
          }),
          jsx_5.jsx("span", {
            className: "tb-status-text truncate",
            children: value2,
          }),
        ],
      });
    }
    if (state.status === "readonly") {
      if (value) {
        return null;
      }
      return jsx_5.jsxs("span", {
        role: "status",
        title: state.message ?? "Read-only",
        className:
          "tb-lock inline-flex shrink-0 items-center gap-1.5 px-1 text-body whitespace-nowrap text-fg-muted",
        children: [
          jsx_5.jsx(runtime.Icon, {
            name: "Lock",
            size: "auto",
            className: "shrink-0",
          }),
          jsx_5.jsx("span", {
            className: "tb-lock-words truncate",
            children: "Read-only",
          }),
        ],
      });
    }
    return null;
  }
  function toolbarScrollPageTarget(
    direction: 1 | -1,
    scrollLeft: number,
    viewportWidth: number,
    scrollWidth: number,
    margin: number,
  ): number {
    let value = Math.max(0, scrollWidth - viewportWidth),
      value2 = Math.max(viewportWidth - 2 * margin, 48),
      value3 = scrollLeft + direction * value2;
    if (direction === 1 && value - value3 <= margin) {
      value3 = value;
    }
    if (direction === -1 && value3 <= margin) {
      value3 = 0;
    }
    return Math.min(value, Math.max(0, value3));
  }
  function isFocusVisible(element: Element): boolean {
    try {
      return element.matches(":focus-visible");
    } catch {
      return false;
    }
  }
  function ToolbarScrollPaddle({
    dir: dir,
    onPress: onPress,
    onLetGo: onLetGo,
  }: ToolbarScrollPaddleProps): ReactElement {
    let value =
      dir === -1 ? "Scroll toolbar left" : "Scroll toolbar right";
    return jsx_5.jsx("div", {
      "data-tb-paddle": "",
      onClick: (input: ReactMouseEvent<HTMLDivElement>): void =>
        onPress(input.detail === 0),
      className: (0, runtime.joinClassNames)(
        TOOLBAR_PADDLE_CLASS,
        dir === -1 ? "left-0" : "right-0",
      ),
      children: jsx_5.jsx(runtime.Button, {
        iconOnly: true,
        size: "xs",
        variant: "ghost",
        icon: dir === -1 ? "CaretLeft" : "CaretRight",
        "aria-label": value,
        tooltip: false,
        onBlur: onLetGo,
        onPointerDown: onLetGo,
      }),
    });
  }
  function ToolbarScrollArea({
    leading: leading,
    revealLeading: revealLeading,
    children: children,
  }: ToolbarScrollAreaProps): ReactElement {
    let ref = reactA6.useRef<HTMLDivElement>(null),
      ref2 = reactA6.useRef<HTMLDivElement>(null),
      [value, value2] = reactA6.useState(false),
      [value3, value4] = reactA6.useState(false),
      value5 = (0, runtime.useCoarsePointer)(),
      ref3 = reactA6.useRef<ToolbarSaveStatus | undefined>(undefined),
      ref4 = reactA6.useRef(false),
      ref5 = reactA6.useRef(false);
    reactA6.useEffect(() => {
      if (revealLeading != null && revealLeading !== ref3.current) {
        ref.current?.scrollTo({
          left: 0,
          behavior: "smooth",
        });
      }
      ref3.current = revealLeading;
    }, [revealLeading]);
    let callback = reactA6.useCallback(() => {
      let current = ref.current;
      if (!current) {
        return;
      }
      let value6 =
          (ref2.current?.clientWidth ?? current.clientWidth) >=
          (value5 ? 80 : 48),
        value7 = value6 && current.scrollLeft > 1,
        value8 =
          value6 &&
          current.scrollLeft + current.clientWidth < current.scrollWidth - 1,
        current2 = ref2.current,
        activeElement = current.ownerDocument.activeElement,
        value9 = activeElement?.closest("[data-tb-paddle]");
      if (
        current2 &&
        activeElement &&
        value9?.parentElement === current2 &&
        (ref4.current || isFocusVisible(activeElement))
      ) {
        let value10 = value9 === current2.lastElementChild;
        if (!(value10 ? value8 : value7)) {
          let value11 = (0, runtime.collectFocusableDescendants)(
            current,
          );
          ref5.current = true;
          try {
            for (let value12 of (value10
              ? value11.reverse()
              : value11)) {
              if (value12.hasAttribute("data-base-ui-focus-guard")) {
                continue;
              }
              value12.focus({
                preventScroll: true,
              });
              if (value9.contains(current.ownerDocument.activeElement)) {
                continue;
              }
              (0, runtime.suppressEnterClicksUntilRelease)();
              break;
            }
          } finally {
            ref5.current = false;
          }
        }
      }
      value2(value7);
      value4(value8);
    }, [value5]);
    reactA6.useEffect(() => {
      let current = ref.current;
      if (!current) {
        return;
      }
      callback();
      let ancestor = current.closest(".tb-root"),
        index = 0,
        observer = new ResizeObserver(() => {
          callback();
          cancelAnimationFrame(index);
          if (ancestor) {
            index = requestAnimationFrame(
              () => updateToolbarWordLock(ancestor),
            );
          }
        });
      observer.observe(current);
      for (let value7 of current.children) observer.observe(value7);
      let value6 = ancestor?.querySelector(".tb-card-end");
      if (ancestor) {
        observer.observe(ancestor);
      }
      if (value6) {
        observer.observe(value6);
      }
      let callback4 = (event: WheelEvent): void => {
        if (
          (event.ctrlKey && current.closest("[data-tb-overlay]")) ||
          current.scrollWidth <= current.clientWidth
        ) {
          return;
        }
        let value7 =
          Math.abs(event.deltaX) > Math.abs(event.deltaY)
            ? event.deltaX
            : event.deltaY;
        if (value7 === 0) {
          return;
        }
        current.scrollLeft += value7;
        event.preventDefault();
      };
      current.addEventListener("wheel", callback4, {
        passive: false,
      });
      let callback5 = (event: FocusEvent): void => {
        let target = event.target,
          current2 = ref2.current;
        if (
          !current2 ||
          ref5.current ||
          !(target instanceof Element) ||
          target.hasAttribute("data-base-ui-focus-guard") ||
          !isFocusVisible(target)
        ) {
          return;
        }
        let bounds = target.getBoundingClientRect();
        if (bounds.width <= 1) {
          return;
        }
        let bounds2 = current2.getBoundingClientRect(),
          callback6 = (input: string): number =>
            current2.querySelector(":scope > " + input)?.getBoundingClientRect()
              .width ?? 0,
          value7 = callback6("[data-tb-paddle]"),
          value8 =
            bounds2.width - 2 * (value7 + callback6("[data-tb-fade]")) >=
            bounds.width
              ? value7 + callback6("[data-tb-fade]")
              : value7,
          value9 = bounds2.left + value8,
          value10 = bounds2.right - value8,
          value11 =
            bounds.left < value9 || bounds.width > value10 - value9
              ? bounds.left - value9
              : bounds.right > value10
                ? bounds.right - value10
                : 0;
        if (Math.round(value11) === 0) {
          return;
        }
        let value12 = current.scrollWidth - current.clientWidth,
          value13 = current.scrollLeft + value11;
        if (value13 <= value8 && bounds.right - value11 + value13 <= value10) {
          value13 = 0;
        } else if (
          value12 - value13 <= value8 &&
          bounds.left - value11 - (value12 - value13) >= value9
        ) {
          value13 = value12;
        }
        current.scrollLeft = Math.round(value13);
      };
      current.addEventListener("focusin", callback5);
      return () => {
        cancelAnimationFrame(index);
        observer.disconnect();
        current.removeEventListener("wheel", callback4);
        current.removeEventListener("focusin", callback5);
      };
    }, [callback]);
    let callback2 = () => {
        ref4.current = false;
      },
      callback3 = (input: 1 | -1, options: boolean): void => {
        let current = ref.current;
        if (!current) {
          return;
        }
        let value6 = ref2.current?.querySelector<HTMLElement>(
            ":scope > [data-tb-paddle]",
          ),
          value7 = ref2.current?.querySelector<HTMLElement>(
            ":scope > span[aria-hidden]",
          ),
          value8 =
            (value6?.offsetWidth ?? 24) + (value7?.offsetWidth ?? 24),
          value9 = ref2.current?.clientWidth ?? current.clientWidth,
          value10 = current.clientWidth - value9;
        ref4.current = options;
        current.scrollTo({
          left: toolbarScrollPageTarget(
            input,
            current.scrollLeft,
            value9,
            current.scrollWidth - value10,
            value8,
          ),
          behavior: "smooth",
        });
      };
    return jsx_5.jsxs("div", {
      ref: ref2,
      className: "relative flex min-w-0 flex-1 items-center self-stretch",
      children: [
        jsx_5.jsxs("div", {
          ref: ref,
          onScroll: callback,
          className:
            "tb-scroll flex min-w-0 flex-1 items-center gap-1 self-stretch overflow-x-auto pointer-coarse:gap-1.5",
          children: [
            leading != null
              ? jsx_5.jsx("span", {
                  "data-tb-cluster": "",
                  className:
                    "tb-slot flex shrink-0 items-center gap-1 pointer-coarse:gap-1.5",
                  children: leading,
                })
              : null,
            jsx_5.jsx("div", {
              className:
                "tb-slot flex min-w-max items-center gap-1 pointer-coarse:gap-1.5",
              children: children,
            }),
          ],
        }),
        value
          ? jsx_5.jsxs(jsx_5.Fragment, {
              children: [
                jsx_5.jsx(ToolbarScrollPaddle, {
                  dir: -1,
                  onPress: (input: boolean): void => callback3(-1, input),
                  onLetGo: callback2,
                }),
                jsx_5.jsx("span", {
                  "aria-hidden": "true",
                  "data-tb-fade": "start",
                  className:
                    "pointer-events-none absolute inset-y-0 left-6 z-10 w-6 pointer-coarse:left-10",
                }),
              ],
            })
          : null,
        value3
          ? jsx_5.jsxs(jsx_5.Fragment, {
              children: [
                jsx_5.jsx("span", {
                  "aria-hidden": "true",
                  "data-tb-fade": "end",
                  className:
                    "pointer-events-none absolute inset-y-0 right-6 z-10 w-6 pointer-coarse:right-10",
                }),
                jsx_5.jsx(ToolbarScrollPaddle, {
                  dir: 1,
                  onPress: (input: boolean): void => callback3(1, input),
                  onLetGo: callback2,
                }),
              ],
            })
          : null,
      ],
    });
  }
  function ToolbarSaveControls({
    saveState: saveState,
    saveMode = "manual",
    onSave: onSave,
    syncDot = false,
    editing: editing,
    onToggleEdit: onToggleEdit,
  }: ToolbarSaveControlsProps): ReactElement {
    let value = saveState.status === "readonly",
      value2 =
        saveState.status === "dirty" || saveState.status === "error",
      value3 = !value2 || saveState.status === "saving",
      value4 = saveState.status === "saving",
      value5 = value4 ? "Saving…" : "Save",
      value6 = value4
        ? value5
        : value2
          ? "Publish your changes — every open view updates"
          : "Everything is published",
      value7 = (0, runtime.useDisabledButtonDescription)({
        disabled: value3,
        name: value5,
        reason: value6,
      }),
      ref = reactA6.useRef<HTMLSpanElement>(null);
    (0, runtime.useDeferredTooltipFocus)(ref, value3);
    return jsx_5.jsxs(jsx_5.Fragment, {
      children: [
        !value && onToggleEdit
          ? jsx_5.jsx(runtime.ToolbarButton, {
              icon: "Edit",
              label: "Edit",
              tip: editing ? "Done editing — back to the live view" : "Edit",
              pressed: editing === true,
              onClick: onToggleEdit,
              "data-testid": "dc-mode-edit",
            })
          : null,
        !value && syncDot
          ? jsx_5.jsx(SaveStatusControl, {
              state: saveState,
              onRetry: onSave,
            })
          : null,
        !value && saveMode === "manual" && !syncDot
          ? jsx_5.jsx(runtime.Tooltip, {
              content: value6,
              shortcut: value2 ? "cmd+s" : undefined,
              side: "bottom",
              align: "end",
              hoverable: false,
              children: jsx_5.jsxs("span", {
                ref: ref,
                tabIndex: value3 ? 0 : -1,
                ...value7.props,
                "data-tb-save": "",
                className:
                  "inline-flex shrink-0 rounded outline-none focus-visible:outline-hidden focus-visible:shadow-focus",
                children: [
                  jsx_5.jsx(runtime.Button, {
                    variant: value2 ? "primary" : "secondary",
                    disabled: value3,
                    onClick: onSave,
                    "aria-label": value5,
                    ...value7.inner,
                    children: value5,
                  }),
                  value7.mirror,
                ],
              }),
            })
          : null,
      ],
    });
  }
  function ToolbarSurface({
    floating: floating,
    ...remainingProps
  }: ToolbarSurfaceProps): ReactElement {
    if (floating) {
      return jsx_5.jsx(runtime.Surface, {
        elevation: runtime.PANEL_ELEVATION,
        ...remainingProps,
      });
    } else {
      return jsx_5.jsx("div", {
        ...remainingProps,
      });
    }
  }
  function ArtifactToolbar({
    title: title,
    saveState: saveState,
    saveMode = "manual",
    syncDot = false,
    onSave: onSave,
    undo: undo,
    publishControls = true,
    pinned: pinned,
    trailing: trailing,
    leading: leading,
    afterUndo: afterUndo,
    undoButtons = true,
    density = "compact",
    touchTargets: touchTargets,
    readOnly: readOnly,
    quietReadOnlyReason: quietReadOnlyReason,
    variant = "docked",
    children: children,
    extrasEnd: extrasEnd,
  }: ArtifactToolbarProps): ReactElement {
    let [, value] = reactA6.useState(0);
    reactA6.useEffect(
      () =>
        undo?.subscribe(
          () => value((input) => input + 1),
        ),
      [undo],
    );
    let value2 = readOnly === true || saveState.status === "readonly",
      value3 = reactA6.useSyncExternalStore(
        runtime.subscribeHostSaveChrome,
        runtime.hostDrawsReadOnly,
        () => false,
      ),
      value4 = effectiveToolbarDensity(density),
      value5 = touchTargets === "square" ? value4 : density,
      ref = reactA6.useRef<HTMLElement>(null),
      [value6, value7] = reactA6.useState(false),
      [value8, value9] = reactA6.useState(false),
      value10 = (0, runtime.useCoarsePointer)(),
      value11 = variant === "floating";
    reactA6.useLayoutEffect(() => {
      let current = ref.current;
      if (!current) {
        return;
      }
      let callback = () => {
          let value13 = getComputedStyle(current),
            value14 =
              current.clientWidth -
              parseFloat(value13.paddingLeft || "0") -
              parseFloat(value13.paddingRight || "0");
          value7(current.clientWidth > 0 && value14 <= TOOLBAR_WIDE_BREAKPOINT);
          value9(
            current.clientWidth > 0 &&
              value14 <=
                (value10
                  ? TOOLBAR_FULL_BREAKPOINT
                  : TOOLBAR_COMPACT_BREAKPOINT),
          );
          if (!value11) {
            return;
          }
          current.parentElement?.style.setProperty(
            "--tb-overlay-h",
            String(current.offsetHeight) + "px",
          );
          ancestor?.style.setProperty(
            "--tb-row-h",
            String(current.offsetHeight) + "px",
          );
        },
        ancestor = current.closest<HTMLElement>("[data-mc-paned]"),
        value12 =
          typeof ResizeObserver !== "undefined"
            ? new ResizeObserver(callback)
            : null;
      value12?.observe(current);
      callback();
      return () => {
        value12?.disconnect();
        ancestor?.style.removeProperty("--tb-row-h");
        current.parentElement?.style.removeProperty("--tb-overlay-h");
      };
    }, [value10, value11]);
    reactA6.useLayoutEffect(() => {
      if (!ref.current) {
        return;
      }
      updateToolbarEmptyState(ref.current);
      updateToolbarWordLock(ref.current);
    });
    reactA6.useLayoutEffect(() => {
      let current = ref.current;
      if (!current || typeof MutationObserver === "undefined") {
        return;
      }
      let index = 0,
        observer = new MutationObserver(() => {
          cancelAnimationFrame(index);
          index = requestAnimationFrame(() => {
            updateToolbarEmptyState(current);
            updateToolbarWordLock(current);
          });
        });
      observer.observe(current, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
        attributeFilter: [
          "hidden",
          "aria-hidden",
          "data-quiet",
          "data-pin-fixed",
        ],
      });
      return () => {
        observer.disconnect();
        cancelAnimationFrame(index);
      };
    }, []);
    return jsx_5.jsx(runtime.CdsRoot, {
      density: value5,
      render: jsx_5.jsx("header", {
        ref: ref,
        "data-collapsed": value6 ? "" : undefined,
        "data-pin-fixed": value8 ? "" : undefined,
        "data-touch-targets": touchTargets,
        "data-tb-overlay": value11 ? "" : undefined,
        className: (0, runtime.joinClassNames)(
          "tb-root flex shrink-0 items-center",
          value11
            ? "absolute inset-x-0 top-0 z-toolbar"
            : "h-10 gap-1 px-1 shadow-[inset_0_-1px_0_0_var(--t-border)] pointer-coarse:h-12 pointer-coarse:gap-1.5 pointer-coarse:px-2",
        ),
      }),
      children: jsx_5.jsx(runtime.TooltipProvider, {
        children: jsx_5.jsx(runtime.ToolbarFloatingContext.Provider, {
          value: value6,
          children: jsx_5.jsxs(runtime.ToolbarQuietContext.Provider, {
            value: value2,
            children: [
              jsx_5.jsx(ToolbarSurface, {
                floating: value11,
                className: "tb-card tb-card-start flex min-w-0 items-center",
                children: jsx_5.jsx(ToolbarScrollArea, {
                  revealLeading:
                    (saveState.status === "readonly" && !value3) ||
                    (saveState.status === "error" && !syncDot)
                      ? saveState.status
                      : undefined,
                  leading: jsx_5.jsxs(jsx_5.Fragment, {
                    children: [
                      leading,
                      undo && !value2 && undoButtons
                        ? jsx_5.jsxs(jsx_5.Fragment, {
                            children: [
                              jsx_5.jsx(runtime.ToolbarButton, {
                                iconOnly: true,
                                icon: "ArrowCounterClockwise",
                                label: "Undo",
                                disabledTip: "Nothing to undo yet",
                                shortcut: "cmd+z",
                                disabled: !undo.canUndo(),
                                onClick: () => undo.undo(),
                              }),
                              jsx_5.jsx(runtime.ToolbarButton, {
                                iconOnly: true,
                                icon: "ArrowClockwise",
                                label: "Redo",
                                disabledTip: "Nothing to redo",
                                shortcut: "shift+cmd+z",
                                disabled: !undo.canRedo(),
                                onClick: () => undo.redo(),
                              }),
                            ],
                          })
                        : null,
                      afterUndo,
                      saveState.status === "readonly" &&
                      quietReadOnlyReason !== undefined &&
                      saveState.message === quietReadOnlyReason
                        ? null
                        : syncDot
                          ? saveState.status === "readonly"
                            ? jsx_5.jsx(SaveProblemStatus, {
                                state: saveState,
                              })
                            : null
                          : saveMode === "auto"
                            ? jsx_5.jsx(SaveStatusDot, {
                                state: saveState,
                              })
                            : jsx_5.jsx(SaveProblemStatus, {
                                state: saveState,
                              }),
                    ],
                  }),
                  children: children,
                }),
              }),
              jsx_5.jsxs(ToolbarSurface, {
                floating: value11,
                className:
                  "tb-card tb-card-end ml-auto flex items-center gap-1 pointer-coarse:gap-1.5",
                children: [
                  extrasEnd != null
                    ? jsx_5.jsx("span", {
                        "data-tb-cluster": "",
                        className:
                          "tb-slot flex shrink-0 items-center gap-1 pointer-coarse:gap-1.5",
                        children: extrasEnd,
                      })
                    : null,
                  (pinned != null && value8) || trailing != null
                    ? jsx_5.jsxs("span", {
                        className:
                          "tb-tail flex items-center gap-1 pointer-coarse:gap-1.5",
                        children: [
                          pinned != null && value8
                            ? jsx_5.jsx("span", {
                                "data-tb-cluster": "",
                                className:
                                  "tb-pin-fixed flex shrink-0 items-center gap-1 empty:hidden pointer-coarse:gap-1.5",
                                children: pinned,
                              })
                            : null,
                          trailing != null
                            ? jsx_5.jsx("span", {
                                "data-tb-cluster": "",
                                className:
                                  "tb-slot flex items-center gap-1 pointer-coarse:gap-1.5",
                                children: trailing,
                              })
                            : null,
                        ],
                      })
                    : null,
                  publishControls
                    ? jsx_5.jsx("span", {
                        className:
                          "tb-publish flex shrink-0 items-center gap-1 pointer-coarse:gap-1.5",
                        children: jsx_5.jsx(ToolbarSaveControls, {
                          saveState: saveState,
                          saveMode: saveMode,
                          syncDot: syncDot,
                          onSave: onSave,
                        }),
                      })
                    : null,
                ],
              }),
            ],
          }),
        }),
      }),
    });
  }
  bindRuntimeValue(
    runtime,
    "reactA6",
    () => reactA6,
    (value) => {
      reactA6 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsx_5",
    () => jsx_5,
    (value) => {
      jsx_5 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TOOLBAR_WIDE_BREAKPOINT",
    () => TOOLBAR_WIDE_BREAKPOINT,
    (value) => {
      TOOLBAR_WIDE_BREAKPOINT = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TOOLBAR_COMPACT_BREAKPOINT",
    () => TOOLBAR_COMPACT_BREAKPOINT,
    (value) => {
      TOOLBAR_COMPACT_BREAKPOINT = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TOOLBAR_FULL_BREAKPOINT",
    () => TOOLBAR_FULL_BREAKPOINT,
    (value) => {
      TOOLBAR_FULL_BREAKPOINT = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TOOLBAR_QUIET_SELECTOR",
    () => TOOLBAR_QUIET_SELECTOR,
    (value) => {
      TOOLBAR_QUIET_SELECTOR = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TOOLBAR_CONTENT_SELECTOR",
    () => TOOLBAR_CONTENT_SELECTOR,
    (value) => {
      TOOLBAR_CONTENT_SELECTOR = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TOOLBAR_LAYOUT_ROLES",
    () => TOOLBAR_LAYOUT_ROLES,
    (value) => {
      TOOLBAR_LAYOUT_ROLES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "hasVisibleToolbarContent",
    () => hasVisibleToolbarContent,
  );
  bindRuntimeValue(runtime, "toolbarContentCount", () => toolbarContentCount);
  bindRuntimeValue(
    runtime,
    "isToolbarSaveIndicator",
    () => isToolbarSaveIndicator,
    (value) => {
      isToolbarSaveIndicator = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "toggleAttributeIfChanged",
    () => toggleAttributeIfChanged,
    (value) => {
      toggleAttributeIfChanged = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "updateToolbarEmptyState",
    () => updateToolbarEmptyState,
  );
  bindRuntimeValue(
    runtime,
    "TOOLBAR_WORD_LOCK_MARGIN",
    () => TOOLBAR_WORD_LOCK_MARGIN,
    (value) => {
      TOOLBAR_WORD_LOCK_MARGIN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "updateToolbarWordLock",
    () => updateToolbarWordLock,
  );
  bindRuntimeValue(
    runtime,
    "effectiveToolbarDensity",
    () => effectiveToolbarDensity,
  );
  bindRuntimeValue(runtime, "useToolbarInsets", () => useToolbarInsets);
  bindRuntimeValue(
    runtime,
    "ArtifactToolbarDivider",
    () => ArtifactToolbarDivider,
  );
  bindRuntimeValue(runtime, "SaveStatusDot", () => SaveStatusDot);
  bindRuntimeValue(runtime, "SaveStatusControl", () => SaveStatusControl);
  bindRuntimeValue(runtime, "SaveProblemStatus", () => SaveProblemStatus);
  bindRuntimeValue(
    runtime,
    "toolbarScrollPageTarget",
    () => toolbarScrollPageTarget,
  );
  bindRuntimeValue(
    runtime,
    "TOOLBAR_PADDLE_CLASS",
    () => TOOLBAR_PADDLE_CLASS,
    (value) => {
      TOOLBAR_PADDLE_CLASS = value;
    },
  );
  bindRuntimeValue(runtime, "isFocusVisible", () => isFocusVisible);
  bindRuntimeValue(runtime, "ToolbarScrollPaddle", () => ToolbarScrollPaddle);
  bindRuntimeValue(runtime, "ToolbarScrollArea", () => ToolbarScrollArea);
  bindRuntimeValue(runtime, "ToolbarSaveControls", () => ToolbarSaveControls);
  bindRuntimeValue(runtime, "ToolbarSurface", () => ToolbarSurface);
  bindRuntimeValue(runtime, "ArtifactToolbar", () => ArtifactToolbar);
  return () => {
    (0, runtime.initializeUiPropertyRow3)();
    (0, runtime.initializeUiInputs210)();
    reactA6 = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    (0, runtime.initializeUiPropertyPopover2)();
    (0, runtime.initializeUiPointerMedia)();
    jsx_5 = (0, runtime.toModuleNamespace)((0, runtime.loadJsxNamespace)(), 1);
    TOOLBAR_WIDE_BREAKPOINT = 1000;
    TOOLBAR_COMPACT_BREAKPOINT = 896;
    TOOLBAR_FULL_BREAKPOINT = 1072;
    TOOLBAR_QUIET_SELECTOR =
      "[hidden], [aria-hidden='true'], [data-quiet], [data-tb-paddle], [data-tb-fade], .tb-divider";
    TOOLBAR_CONTENT_SELECTOR =
      "button, input, select, textarea, a[href], img, svg, video, canvas, [data-cds]:not([data-cds='Surface']), [data-tb-status], [data-tb-shows]";
    TOOLBAR_LAYOUT_ROLES = new Set([
      "presentation",
      "none",
      "group",
      "toolbar",
      "separator",
      "region",
    ]);
    isToolbarSaveIndicator = (element: Element): boolean =>
      element.matches(".tb-sync-dot, [data-tb-save]");
    toggleAttributeIfChanged = (
      element: Element,
      attribute: string,
      enabled: boolean,
    ): void => {
      if (enabled !== element.hasAttribute(attribute)) {
        element.toggleAttribute(attribute, enabled);
      }
    };
    TOOLBAR_WORD_LOCK_MARGIN = 48;
    TOOLBAR_PADDLE_CLASS =
      "absolute inset-y-0 z-10 flex w-6 items-center justify-center pointer-coarse:w-10";
  };
}
