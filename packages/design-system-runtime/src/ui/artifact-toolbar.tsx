/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
import type * as React from "react";
import type {
  ReactNamespace,
  JsxNamespace,
  ToolbarContentOptions,
  SaveStatusProps,
  SaveStatusControlProps,
  ToolbarScrollPaddleProps,
  ToolbarScrollAreaProps,
  ToolbarSaveControlsProps,
  ToolbarSurfaceProps,
  ArtifactToolbarProps,
} from "../contracts/composition";
export function installUiArtifactToolbar(runtime: RuntimeBindings): () => void {
  var reactForUiArtifactToolbar: ReactNamespace;
  var jsxForUiArtifactToolbar: JsxNamespace;
  var TOOLBAR_WIDE_BREAKPOINT: number;
  var TOOLBAR_COMPACT_BREAKPOINT: number;
  var TOOLBAR_FULL_BREAKPOINT: number;
  var TOOLBAR_QUIET_SELECTOR: string;
  var TOOLBAR_CONTENT_SELECTOR: string;
  var TOOLBAR_LAYOUT_ROLES: Set<string>;
  var isToolbarSaveIndicator: (element: Element) => boolean;
  var toggleAttributeIfChanged: (
    element: Element,
    attribute: string,
    enabled: boolean,
  ) => void;
  var TOOLBAR_SCROLL_FOCUS_MARGIN: number;
  var TOOLBAR_PADDLE_CLASS: string;
  function hasVisibleToolbarContent(
    element: Element,
    options: ToolbarContentOptions = {},
  ) {
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
  ) {
    let index = 0;
    for (let value of element.children) {
      index += value.matches("[data-tb-seat], .contents")
        ? toolbarContentCount(value, options)
        : hasVisibleToolbarContent(value as Element, options)
          ? 1
          : 0;
    }
    return index;
  }
  function updateToolbarEmptyState(toolbar: Element) {
    let state = {
      pinFixed: toolbar.hasAttribute("data-pin-fixed"),
    };
    for (let value of toolbar.querySelectorAll(
      ".tb-slot, .tb-tail, .tb-publish",
    )) {
      toggleAttributeIfChanged(
        value,
        "data-tb-empty",
        !hasVisibleToolbarContent(value, state),
      );
    }
    for (let value of toolbar.querySelectorAll(".tb-tail")) {
      toggleAttributeIfChanged(
        value,
        "data-tb-only-dot",
        !hasVisibleToolbarContent(value, {
          ...state,
          skip: isToolbarSaveIndicator,
        }),
      );
    }
    for (let value of toolbar.querySelectorAll(".tb-publish")) {
      toggleAttributeIfChanged(
        value,
        "data-tb-has-save",
        [...value.querySelectorAll("[data-tb-save]")].some((input: Element) =>
          hasVisibleToolbarContent(input, state),
        ),
      );
    }
    for (let value of toolbar.querySelectorAll(".tb-card")) {
      toggleAttributeIfChanged(
        value,
        "data-tb-empty",
        !hasVisibleToolbarContent(value, state),
      );
    }
    let element = toolbar.querySelector(".tb-card-start");
    if (element) {
      let index = 0;
      for (let value of element.querySelectorAll(".tb-scroll > .tb-slot")) {
        index += toolbarContentCount(value, state);
      }
      toggleAttributeIfChanged(element, "data-tb-floor", index >= 3);
    }
  }
  function updateToolbarWordLock(toolbar: Element) {
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
      element2.clientWidth < TOOLBAR_SCROLL_FOCUS_MARGIN &&
      element2.scrollWidth > element2.clientWidth;
    if (element.scrollWidth > element.clientWidth + 1 || value2) {
      element.removeAttribute("data-tb-lock-words");
    }
  }
  function effectiveToolbarDensity(
    density: import("../contracts/controls").Density = "compact",
  ) {
    if ((0, runtime.useCoarsePointer)()) {
      return "comfortable";
    } else {
      return density;
    }
  }
  function SaveStatusDot({ state: state }: SaveStatusProps) {
    if (state.status === "error" || state.status === "readonly") {
      return <SaveProblemStatus state={state} />;
    }
    let value = state.status === "saving",
      value2 = state.status === "dirty";
    return (
      <span
        role={"status"}
        title={
          value
            ? "Saving…"
            : value2
              ? "Edits are held in the editor — they save when applied"
              : "Every change saves automatically"
        }
        className={
          "inline-flex shrink-0 items-center gap-1.5 text-xs whitespace-nowrap text-fg-muted"
        }
      >
        {[
          <span
            className={
              "h-1.5 w-1.5 shrink-0 rounded-full " +
              (value || value2 ? "bg-fill-warning" : "bg-fill-success")
            }
          />,
          <span className={"tb-status-text truncate"}>
            {value
              ? "Saving…"
              : value2
                ? "Unsaved edits"
                : "Saved automatically"}
          </span>,
        ]}
      </span>
    );
  }
  function SaveStatusControl({
    state: state,
    onRetry: onRetry,
    tipSide = "bottom",
  }: SaveStatusControlProps) {
    let value = reactForUiArtifactToolbar.useSyncExternalStore(
        runtime.subscribeHostSaveChrome,
        runtime.hostDrawsSave,
        () => false,
      ),
      value2 = reactForUiArtifactToolbar.useSyncExternalStore(
        runtime.subscribeHostSaveChrome,
        runtime.hostTakesRetry,
        () => false,
      ),
      [value3, value4] = reactForUiArtifactToolbar.useState(false),
      [value5, value6] = reactForUiArtifactToolbar.useState(false),
      [value7, value8] = reactForUiArtifactToolbar.useState(false),
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
    return (
      <runtime.Tooltip
        content={value13}
        side={tipSide}
        align={"end"}
        multiline={true}
        hoverable={false}
        closeOnClick={false}
      >
        <button
          type={"button"}
          aria-disabled={value14 ? undefined : true}
          onClick={() => {
            if (!value14) {
              return;
            }
            if (status === "error") {
              value8(true);
            }
            onRetry();
          }}
          onFocus={() => value4(true)}
          onBlur={() => value4(false)}
          onPointerEnter={() => value6(true)}
          onPointerLeave={() => value6(false)}
          aria-label={value13}
          data-sync={value11}
          data-quiet={value12 ? "" : undefined}
          data-testid={"sync-dot"}
          className={"tb-sync-dot"}
        >
          <span aria-hidden={"true"} className={"tb-sync-dot-mark"} />
        </button>
      </runtime.Tooltip>
    );
  }
  function SaveProblemStatus({ state: state }: SaveStatusProps) {
    let value = reactForUiArtifactToolbar.useSyncExternalStore(
      runtime.subscribeHostSaveChrome,
      runtime.hostDrawsReadOnly,
      () => false,
    );
    if (state.status === "error") {
      let value2 = state.message ?? "Couldn’t save";
      return (
        <span
          role={"status"}
          title={value2}
          className={
            "inline-flex max-w-80 shrink-0 items-center gap-1.5 truncate rounded-full bg-bad/10 px-2 py-0.5 text-xs font-medium whitespace-nowrap text-bad"
          }
        >
          {[
            <span
              className={"h-1.5 w-1.5 shrink-0 rounded-full bg-fill-danger"}
            />,
            <span className={"tb-status-text truncate"}>{value2}</span>,
          ]}
        </span>
      );
    }
    if (state.status === "readonly") {
      if (value) {
        return null;
      }
      return (
        <span
          role={"status"}
          title={state.message ?? "Read-only"}
          className={
            "tb-lock inline-flex shrink-0 items-center gap-1.5 px-1 text-body whitespace-nowrap text-fg-muted"
          }
        >
          {[
            <runtime.Icon name={"Lock"} size={"auto"} className={"shrink-0"} />,
            <span className={"tb-lock-words truncate"}>{"Read-only"}</span>,
          ]}
        </span>
      );
    }
    return null;
  }
  function toolbarScrollPageTarget(
    direction: number,
    scrollLeft: number,
    viewportWidth: number,
    scrollWidth: number,
    margin: number,
  ) {
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
  function isFocusVisibleUiArtifactToolbar(element: Element) {
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
  }: ToolbarScrollPaddleProps) {
    let value = dir === -1 ? "Scroll toolbar left" : "Scroll toolbar right";
    return (
      <div
        data-tb-paddle={""}
        onClick={(input: React.MouseEvent<HTMLDivElement>) =>
          onPress(input.detail === 0)
        }
        className={(0, runtime.joinClassNames)(
          TOOLBAR_PADDLE_CLASS,
          dir === -1 ? "left-0" : "right-0",
        )}
      >
        <runtime.Button
          iconOnly={true}
          size={"xs"}
          variant={"ghost"}
          icon={dir === -1 ? "CaretLeft" : "CaretRight"}
          aria-label={value}
          tooltip={false}
          onBlur={onLetGo}
          onPointerDown={onLetGo}
        />
      </div>
    );
  }
  function ToolbarScrollArea({
    leading: leading,
    revealLeading: revealLeading,
    children: children,
  }: ToolbarScrollAreaProps) {
    let ref = reactForUiArtifactToolbar.useRef<HTMLDivElement | null>(null),
      ref2 = reactForUiArtifactToolbar.useRef<HTMLDivElement | null>(null),
      [value, value2] = reactForUiArtifactToolbar.useState(false),
      [value3, value4] = reactForUiArtifactToolbar.useState(false),
      value5 = (0, runtime.useCoarsePointer)(),
      ref3 = reactForUiArtifactToolbar.useRef<string | undefined>(undefined),
      ref4 = reactForUiArtifactToolbar.useRef(false),
      ref5 = reactForUiArtifactToolbar.useRef(false);
    reactForUiArtifactToolbar.useEffect(() => {
      if (revealLeading != null && revealLeading !== ref3.current) {
        ref.current?.scrollTo({
          left: 0,
          behavior: "smooth",
        });
      }
      ref3.current = revealLeading;
    }, [revealLeading]);
    let callback = reactForUiArtifactToolbar.useCallback(() => {
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
        (ref4.current || isFocusVisibleUiArtifactToolbar(activeElement))
      ) {
        let value10 = value9 === current2.lastElementChild;
        if (!(value10 ? value8 : value7)) {
          let value11 = (0, runtime.collectFocusableDescendants)(current);
          ref5.current = true;
          try {
            for (let value12 of value10 ? value11.reverse() : value11) {
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
    reactForUiArtifactToolbar.useEffect(() => {
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
            index = requestAnimationFrame(() =>
              updateToolbarWordLock(ancestor),
            );
          }
        });
      observer.observe(current);
      for (let value7 of current.children) {
        observer.observe(value7);
      }
      let value6 = ancestor?.querySelector(".tb-card-end");
      if (ancestor) {
        observer.observe(ancestor);
      }
      if (value6) {
        observer.observe(value6);
      }
      let callback4 = (event: WheelEvent) => {
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
      let callback5 = (event: FocusEvent) => {
        let target = event.target,
          current2 = ref2.current;
        if (
          !current2 ||
          ref5.current ||
          !(target instanceof Element) ||
          target.hasAttribute("data-base-ui-focus-guard") ||
          !isFocusVisibleUiArtifactToolbar(target)
        ) {
          return;
        }
        let bounds = target.getBoundingClientRect();
        if (bounds.width <= 1) {
          return;
        }
        let bounds2 = current2.getBoundingClientRect(),
          callback6 = (input: string) =>
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
      callback3 = (input: number, options: boolean) => {
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
          value8 = (value6?.offsetWidth ?? 24) + (value7?.offsetWidth ?? 24),
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
    return (
      <div
        ref={ref2}
        className={"relative flex min-w-0 flex-1 items-center self-stretch"}
      >
        {[
          <div
            ref={ref}
            onScroll={callback}
            className={
              "tb-scroll flex min-w-0 flex-1 items-center gap-1 self-stretch overflow-x-auto pointer-coarse:gap-1.5"
            }
          >
            {[
              leading != null ? (
                <span
                  data-tb-cluster={""}
                  className={
                    "tb-slot flex shrink-0 items-center gap-1 pointer-coarse:gap-1.5"
                  }
                >
                  {leading}
                </span>
              ) : null,
              <div
                className={
                  "tb-slot flex min-w-max items-center gap-1 pointer-coarse:gap-1.5"
                }
              >
                {children}
              </div>,
            ]}
          </div>,
          value ? (
            <jsxForUiArtifactToolbar.Fragment>
              {[
                <ToolbarScrollPaddle
                  dir={-1}
                  onPress={(input: boolean) => callback3(-1, input)}
                  onLetGo={callback2}
                />,
                <span
                  aria-hidden={"true"}
                  data-tb-fade={"start"}
                  className={
                    "pointer-events-none absolute inset-y-0 left-6 z-10 w-6 pointer-coarse:left-10"
                  }
                />,
              ]}
            </jsxForUiArtifactToolbar.Fragment>
          ) : null,
          value3 ? (
            <jsxForUiArtifactToolbar.Fragment>
              {[
                <span
                  aria-hidden={"true"}
                  data-tb-fade={"end"}
                  className={
                    "pointer-events-none absolute inset-y-0 right-6 z-10 w-6 pointer-coarse:right-10"
                  }
                />,
                <ToolbarScrollPaddle
                  dir={1}
                  onPress={(input: boolean) => callback3(1, input)}
                  onLetGo={callback2}
                />,
              ]}
            </jsxForUiArtifactToolbar.Fragment>
          ) : null,
        ]}
      </div>
    );
  }
  function ToolbarSaveControls({
    saveState: saveState,
    saveMode = "manual",
    onSave: onSave,
    syncDot = false,
    editing: editing,
    onToggleEdit: onToggleEdit,
  }: ToolbarSaveControlsProps) {
    let value = saveState.status === "readonly",
      value2 = saveState.status === "dirty" || saveState.status === "error",
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
      ref = reactForUiArtifactToolbar.useRef<HTMLSpanElement | null>(null);
    (0, runtime.useDeferredTooltipFocus)(ref, value3);
    return (
      <jsxForUiArtifactToolbar.Fragment>
        {[
          !value && onToggleEdit ? (
            <runtime.ToolbarButton
              icon={"Edit"}
              label={"Edit"}
              tip={editing ? "Done editing — back to the live view" : "Edit"}
              pressed={editing === true}
              onClick={onToggleEdit}
              data-testid={"dc-mode-edit"}
            />
          ) : null,
          !value && syncDot ? (
            <SaveStatusControl state={saveState} onRetry={onSave} />
          ) : null,
          !value && saveMode === "manual" && !syncDot ? (
            <runtime.Tooltip
              content={value6}
              shortcut={value2 ? "cmd+s" : undefined}
              side={"bottom"}
              align={"end"}
              hoverable={false}
            >
              <span
                ref={ref}
                tabIndex={value3 ? 0 : -1}
                {...value7.props}
                data-tb-save={""}
                className={
                  "inline-flex shrink-0 rounded outline-none focus-visible:outline-hidden focus-visible:shadow-focus"
                }
              >
                {[
                  <runtime.Button
                    variant={value2 ? "primary" : "secondary"}
                    disabled={value3}
                    onClick={onSave}
                    aria-label={value5}
                    {...value7.inner}
                  >
                    {value5}
                  </runtime.Button>,
                  value7.mirror,
                ]}
              </span>
            </runtime.Tooltip>
          ) : null,
        ]}
      </jsxForUiArtifactToolbar.Fragment>
    );
  }
  function ToolbarSurface({
    floating: floating,
    ...remainingProps
  }: ToolbarSurfaceProps) {
    if (floating) {
      return (
        <runtime.Surface
          elevation={runtime.PANEL_ELEVATION}
          {...remainingProps}
        />
      );
    } else {
      return <div {...remainingProps} />;
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
  }: ArtifactToolbarProps) {
    let [, value] = reactForUiArtifactToolbar.useState(0);
    reactForUiArtifactToolbar.useEffect(
      () => undo?.subscribe(() => value((input: number) => input + 1)),
      [undo],
    );
    let value2 = readOnly === true || saveState.status === "readonly",
      value3 = reactForUiArtifactToolbar.useSyncExternalStore(
        runtime.subscribeHostSaveChrome,
        runtime.hostDrawsReadOnly,
        () => false,
      ),
      value4 = effectiveToolbarDensity(density),
      value5 = touchTargets === "square" ? value4 : density,
      ref = reactForUiArtifactToolbar.useRef<HTMLDivElement | null>(null),
      [value6, value7] = reactForUiArtifactToolbar.useState(false),
      [value8, value9] = reactForUiArtifactToolbar.useState(false),
      value10 = (0, runtime.useCoarsePointer)(),
      value11 = variant === "floating";
    reactForUiArtifactToolbar.useLayoutEffect(() => {
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
    reactForUiArtifactToolbar.useLayoutEffect(() => {
      if (!ref.current) {
        return;
      }
      updateToolbarEmptyState(ref.current);
      updateToolbarWordLock(ref.current);
    });
    reactForUiArtifactToolbar.useLayoutEffect(() => {
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
    return (
      <runtime.CdsRoot
        density={value5}
        render={
          <header
            ref={ref}
            data-collapsed={value6 ? "" : undefined}
            data-pin-fixed={value8 ? "" : undefined}
            data-touch-targets={touchTargets}
            data-tb-overlay={value11 ? "" : undefined}
            className={(0, runtime.joinClassNames)(
              "tb-root flex shrink-0 items-center",
              value11
                ? "absolute inset-x-0 top-0 z-toolbar"
                : "h-10 gap-1 px-1 shadow-[inset_0_-1px_0_0_var(--t-border)] pointer-coarse:h-12 pointer-coarse:gap-1.5 pointer-coarse:px-2",
            )}
          />
        }
      >
        <runtime.TooltipProvider>
          <runtime.ToolbarFloatingContext.Provider value={value6}>
            <runtime.ToolbarQuietContext.Provider value={value2}>
              {[
                <ToolbarSurface
                  floating={value11}
                  className={"tb-card tb-card-start flex min-w-0 items-center"}
                >
                  <ToolbarScrollArea
                    revealLeading={
                      (saveState.status === "readonly" && !value3) ||
                      (saveState.status === "error" && !syncDot)
                        ? saveState.status
                        : undefined
                    }
                    leading={
                      <jsxForUiArtifactToolbar.Fragment>
                        {[
                          leading,
                          undo && !value2 && undoButtons ? (
                            <jsxForUiArtifactToolbar.Fragment>
                              {[
                                <runtime.ToolbarButton
                                  iconOnly={true}
                                  icon={"ArrowCounterClockwise"}
                                  label={"Undo"}
                                  disabledTip={"Nothing to undo yet"}
                                  shortcut={"cmd+z"}
                                  disabled={!undo.canUndo()}
                                  onClick={() => undo.undo()}
                                />,
                                <runtime.ToolbarButton
                                  iconOnly={true}
                                  icon={"ArrowClockwise"}
                                  label={"Redo"}
                                  disabledTip={"Nothing to redo"}
                                  shortcut={"shift+cmd+z"}
                                  disabled={!undo.canRedo()}
                                  onClick={() => undo.redo()}
                                />,
                              ]}
                            </jsxForUiArtifactToolbar.Fragment>
                          ) : null,
                          afterUndo,
                          saveState.status === "readonly" &&
                          quietReadOnlyReason !== undefined &&
                          saveState.message ===
                            quietReadOnlyReason ? null : syncDot ? (
                            saveState.status === "readonly" ? (
                              <SaveProblemStatus state={saveState} />
                            ) : null
                          ) : saveMode === "auto" ? (
                            <SaveStatusDot state={saveState} />
                          ) : (
                            <SaveProblemStatus state={saveState} />
                          ),
                        ]}
                      </jsxForUiArtifactToolbar.Fragment>
                    }
                  >
                    {children}
                  </ToolbarScrollArea>
                </ToolbarSurface>,
                <ToolbarSurface
                  floating={value11}
                  className={
                    "tb-card tb-card-end ml-auto flex items-center gap-1 pointer-coarse:gap-1.5"
                  }
                >
                  {[
                    extrasEnd != null ? (
                      <span
                        data-tb-cluster={""}
                        className={
                          "tb-slot flex shrink-0 items-center gap-1 pointer-coarse:gap-1.5"
                        }
                      >
                        {extrasEnd}
                      </span>
                    ) : null,
                    (pinned != null && value8) || trailing != null ? (
                      <span
                        className={
                          "tb-tail flex items-center gap-1 pointer-coarse:gap-1.5"
                        }
                      >
                        {[
                          pinned != null && value8 ? (
                            <span
                              data-tb-cluster={""}
                              className={
                                "tb-pin-fixed flex shrink-0 items-center gap-1 empty:hidden pointer-coarse:gap-1.5"
                              }
                            >
                              {pinned}
                            </span>
                          ) : null,
                          trailing != null ? (
                            <span
                              data-tb-cluster={""}
                              className={
                                "tb-slot flex items-center gap-1 pointer-coarse:gap-1.5"
                              }
                            >
                              {trailing}
                            </span>
                          ) : null,
                        ]}
                      </span>
                    ) : null,
                    publishControls ? (
                      <span
                        className={
                          "tb-publish flex shrink-0 items-center gap-1 pointer-coarse:gap-1.5"
                        }
                      >
                        <ToolbarSaveControls
                          saveState={saveState}
                          saveMode={saveMode}
                          syncDot={syncDot}
                          onSave={onSave}
                        />
                      </span>
                    ) : null,
                  ]}
                </ToolbarSurface>,
              ]}
            </runtime.ToolbarQuietContext.Provider>
          </runtime.ToolbarFloatingContext.Provider>
        </runtime.TooltipProvider>
      </runtime.CdsRoot>
    );
  }
  bindRuntimeValue(
    runtime,
    "reactForUiArtifactToolbar",
    () => reactForUiArtifactToolbar,
    (value) => {
      reactForUiArtifactToolbar = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxForUiArtifactToolbar",
    () => jsxForUiArtifactToolbar,
    (value) => {
      jsxForUiArtifactToolbar = value;
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
    "TOOLBAR_SCROLL_FOCUS_MARGIN",
    () => TOOLBAR_SCROLL_FOCUS_MARGIN,
    (value) => {
      TOOLBAR_SCROLL_FOCUS_MARGIN = value;
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
  bindRuntimeValue(
    runtime,
    "isFocusVisibleUiArtifactToolbar",
    () => isFocusVisibleUiArtifactToolbar,
  );
  bindRuntimeValue(runtime, "ToolbarScrollPaddle", () => ToolbarScrollPaddle);
  bindRuntimeValue(runtime, "ToolbarScrollArea", () => ToolbarScrollArea);
  bindRuntimeValue(runtime, "ToolbarSaveControls", () => ToolbarSaveControls);
  bindRuntimeValue(runtime, "ToolbarSurface", () => ToolbarSurface);
  bindRuntimeValue(runtime, "ArtifactToolbar", () => ArtifactToolbar);
  return () => {
    reactForUiArtifactToolbar = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    jsxForUiArtifactToolbar = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
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
    isToolbarSaveIndicator = (element: Element) =>
      element.matches(".tb-sync-dot, [data-tb-save]");
    toggleAttributeIfChanged = (
      element: Element,
      attribute: string,
      enabled: boolean,
    ) => {
      if (enabled !== element.hasAttribute(attribute)) {
        element.toggleAttribute(attribute, enabled);
      }
    };
    TOOLBAR_SCROLL_FOCUS_MARGIN = 48;
    TOOLBAR_PADDLE_CLASS =
      "absolute inset-y-0 z-10 flex w-6 items-center justify-center pointer-coarse:w-10";
  };
}
