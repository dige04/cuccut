/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";
export function installEditorToolbarToolbar(
  runtime: RuntimeBindings,
): () => void {
  function EditorToolbar({
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
  }: Dynamic): Dynamic {
    let [, value]: Dynamic = (0, runtime.reactCanvasMeasurements.useState)(0);
    (0, runtime.reactCanvasMeasurements.useEffect)(
      (): Dynamic =>
        undo?.subscribe(
          (): Dynamic => value((input?: Dynamic): Dynamic => input + 1),
        ),
      [undo],
    );
    let value2: Dynamic = readOnly === true || saveState.status === "readonly",
      value3: Dynamic = (0,
      runtime.reactCanvasMeasurements.useSyncExternalStore)(
        runtime.subscribeHostChrome,
        runtime.hostDrawsReadOnly,
        (): Dynamic => false,
      ),
      value4: Dynamic = (0, runtime.toolbarDensity)(density),
      value5: Dynamic = touchTargets === "square" ? value4 : density,
      value6: Dynamic = (0, runtime.reactCanvasMeasurements.useRef)(null),
      [value7, value8]: Dynamic = (0, runtime.reactCanvasMeasurements.useState)(
        false,
      ),
      [value9, value10]: Dynamic = (0,
      runtime.reactCanvasMeasurements.useState)(false),
      value11: Dynamic = (0, runtime.useTouchToolbar)(),
      value12: Dynamic = variant === "floating";
    (0, runtime.reactCanvasMeasurements.useLayoutEffect)((): Dynamic => {
      let current: Dynamic = value6.current;
      if (!current) return;
      let callback: Dynamic = (): Dynamic => {
          let value14: Dynamic = getComputedStyle(current),
            value15: Dynamic =
              current.clientWidth -
              parseFloat(value14.paddingLeft || "0") -
              parseFloat(value14.paddingRight || "0");
          value8(
            current.clientWidth > 0 && value15 <= runtime.ToolbarLayoutLimit,
          );
          value10(
            current.clientWidth > 0 &&
              value15 <=
                (value11
                  ? runtime.ToolbarLayoutConstant_2
                  : runtime.ToolbarLayoutConstant),
          );
          value12 &&
            (current.parentElement?.style.setProperty(
              "--tb-overlay-h",
              String(current.offsetHeight) + "px",
            ),
            ancestor?.style.setProperty(
              "--tb-row-h",
              String(current.offsetHeight) + "px",
            ));
        },
        ancestor: Dynamic = current.closest("[data-mc-paned]"),
        value13: Dynamic =
          typeof ResizeObserver !== "undefined"
            ? new ResizeObserver(callback)
            : null;
      value13?.observe(current);
      callback();
      return (): Dynamic => {
        value13?.disconnect();
        ancestor?.style.removeProperty("--tb-row-h");
        current.parentElement?.style.removeProperty("--tb-overlay-h");
      };
    }, [value11, value12]);
    (0, runtime.reactCanvasMeasurements.useLayoutEffect)((): Dynamic => {
      value6.current &&
        ((0, runtime.updateToolbarEmptySlots)(value6.current),
        (0, runtime.updateToolbarPinnedWords)(value6.current));
    });
    (0, runtime.reactCanvasMeasurements.useLayoutEffect)((): Dynamic => {
      let current: Dynamic = value6.current;
      if (!current || typeof MutationObserver === "undefined") return;
      let index: Dynamic = 0,
        observer: Dynamic = new MutationObserver((): Dynamic => {
          cancelAnimationFrame(index);
          index = requestAnimationFrame((): Dynamic => {
            (0, runtime.updateToolbarEmptySlots)(current);
            (0, runtime.updateToolbarPinnedWords)(current);
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
      return (): Dynamic => {
        observer.disconnect();
        cancelAnimationFrame(index);
      };
    }, []);
    return (
      <runtime.CdsRoot
        density={value5}
        render={
          <header
            ref={value6}
            data-collapsed={value7 ? "" : undefined}
            data-pin-fixed={value9 ? "" : undefined}
            data-touch-targets={touchTargets}
            data-tb-overlay={value12 ? "" : undefined}
            className={(0, runtime.joinClassNames)(
              "tb-root flex shrink-0 items-center",
              value12
                ? "absolute inset-x-0 top-0 z-toolbar"
                : "h-10 gap-1 px-1 shadow-[inset_0_-1px_0_0_var(--t-border)] pointer-coarse:h-12 pointer-coarse:gap-1.5 pointer-coarse:px-2",
            )}
          />
        }
      >
        <runtime.TooltipGroup>
          <runtime.ToolbarPrimitivesContext.Provider value={value7}>
            <runtime.ToolbarPrimitivesContext_2.Provider value={value2}>
              <runtime.ToolbarSurface
                floating={value12}
                className={"tb-card tb-card-start flex min-w-0 items-center"}
              >
                <runtime.ToolbarScroller
                  revealLeading={
                    (saveState.status === "readonly" && !value3) ||
                    (saveState.status === "error" && !syncDot)
                      ? saveState.status
                      : undefined
                  }
                  leading={
                    <runtime.jsxToolbarLayout.Fragment>
                      {leading}
                      {undo && !value2 && undoButtons ? (
                        <runtime.jsxToolbarLayout.Fragment>
                          <runtime.ToolbarPrimitivesComponent
                            iconOnly={true}
                            icon={"ArrowCounterClockwise"}
                            label={"Undo"}
                            disabledTip={"Nothing to undo yet"}
                            shortcut={"cmd+z"}
                            disabled={!undo.canUndo()}
                            onClick={(): Dynamic => undo.undo()}
                          />
                          <runtime.ToolbarPrimitivesComponent
                            iconOnly={true}
                            icon={"ArrowClockwise"}
                            label={"Redo"}
                            disabledTip={"Nothing to redo"}
                            shortcut={"shift+cmd+z"}
                            disabled={!undo.canRedo()}
                            onClick={(): Dynamic => undo.redo()}
                          />
                        </runtime.jsxToolbarLayout.Fragment>
                      ) : null}
                      {afterUndo}
                      {saveState.status === "readonly" &&
                      quietReadOnlyReason !== undefined &&
                      saveState.message ===
                        quietReadOnlyReason ? null : syncDot ? (
                        saveState.status === "readonly" ? (
                          <runtime.ToolbarSaveFailure state={saveState} />
                        ) : null
                      ) : saveMode === "auto" ? (
                        <runtime.ToolbarSaveStatus state={saveState} />
                      ) : (
                        <runtime.ToolbarSaveFailure state={saveState} />
                      )}
                    </runtime.jsxToolbarLayout.Fragment>
                  }
                >
                  {children}
                </runtime.ToolbarScroller>
              </runtime.ToolbarSurface>
              <runtime.ToolbarSurface
                floating={value12}
                className={
                  "tb-card tb-card-end ml-auto flex items-center gap-1 pointer-coarse:gap-1.5"
                }
              >
                {extrasEnd != null ? (
                  <span
                    data-tb-cluster={""}
                    className={
                      "tb-slot flex shrink-0 items-center gap-1 pointer-coarse:gap-1.5"
                    }
                  >
                    {extrasEnd}
                  </span>
                ) : null}
                {(pinned != null && value9) || trailing != null ? (
                  <span
                    className={
                      "tb-tail flex items-center gap-1 pointer-coarse:gap-1.5"
                    }
                  >
                    {pinned != null && value9 ? (
                      <span
                        data-tb-cluster={""}
                        className={
                          "tb-pin-fixed flex shrink-0 items-center gap-1 empty:hidden pointer-coarse:gap-1.5"
                        }
                      >
                        {pinned}
                      </span>
                    ) : null}
                    {trailing != null ? (
                      <span
                        data-tb-cluster={""}
                        className={
                          "tb-slot flex items-center gap-1 pointer-coarse:gap-1.5"
                        }
                      >
                        {trailing}
                      </span>
                    ) : null}
                  </span>
                ) : null}
                {publishControls ? (
                  <span
                    className={
                      "tb-publish flex shrink-0 items-center gap-1 pointer-coarse:gap-1.5"
                    }
                  >
                    <runtime.ToolbarPublishControls
                      saveState={saveState}
                      saveMode={saveMode}
                      syncDot={syncDot}
                      onSave={onSave}
                    />
                  </span>
                ) : null}
              </runtime.ToolbarSurface>
            </runtime.ToolbarPrimitivesContext_2.Provider>
          </runtime.ToolbarPrimitivesContext.Provider>
        </runtime.TooltipGroup>
      </runtime.CdsRoot>
    );
  }
  bindRuntimeValue(runtime, "EditorToolbar", () => EditorToolbar);
  return () => {};
}
