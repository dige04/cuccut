/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";
export function installCanvasChrome(runtime: RuntimeBindings): () => void {
  var canvasHandleLabelSize: Dynamic;
  var maxCanvasOverlayZIndex: Dynamic;
  var PositionedSelectionQuickActions: Dynamic;
  var artboardHeaderTextClass: Dynamic;
  var artboardHeaderButtonClass: Dynamic;
  var artboardPlayButtonClass: Dynamic;
  var hideProblemAtNarrowHeaderClass: Dynamic;
  var hideTweaksAtNarrowHeaderClass: Dynamic;
  var hideDownloadAtNarrowHeaderClass: Dynamic;
  var ArtboardHeaderActions: Dynamic;
  function ConditionalPortal({
    on: on,
    to: to,
    children: children,
  }: Dynamic): Dynamic {
    return on
      ? to && (0, runtime.reactDomVectorToolState.createPortal)(children, to)
      : children;
  }
  function RunWhenSeen({ seen: seen, then: then }: Dynamic): Dynamic {
    (0, runtime.reactVectorToolState_2.useEffect)((): Dynamic => {
      seen && then();
    });
    return null;
  }
  function CanvasRectVisibility({
    rect: rect,
    surfaceRef: surfaceRef,
    children: children,
  }: Dynamic): Dynamic {
    let value: Dynamic = (0, runtime.useViewportStore)(),
      callback: Dynamic = (): Dynamic => {
        let entry: Dynamic = value.get(),
          current: Dynamic = surfaceRef.current;
        return (
          (0, runtime.distanceBetweenRects)(rect, {
            x: entry.x,
            y: entry.y,
            w: (current?.clientWidth || 1200) / entry.scale,
            h: (current?.clientHeight || 800) / entry.scale,
          }) === 0
        );
      };
    return children(
      (0, runtime.reactVectorToolState_2.useSyncExternalStore)(
        value.subscribe,
        callback,
        callback,
      ),
    );
  }
  function CanvasSnapGuides({ guides: guides }: Dynamic): Dynamic {
    let value: Dynamic = (0, runtime.useViewport)();
    return (
      <div
        data-testid={"mega-snap-guides"}
        aria-hidden={"true"}
        className={"pointer-events-none absolute inset-0 z-30"}
      >
        <runtime.AlignmentGuides
          scale={1}
          guides={guides.map(
            (input?: Dynamic): Dynamic => ({
              axis: input.axis,
              pos:
                (input.pos - (input.axis === "x" ? value.x : value.y)) *
                value.scale,
            }),
          )}
        />
      </div>
    );
  }
  function CanvasGapGuides({ gaps: gaps }: Dynamic): Dynamic {
    let value: Dynamic = (0, runtime.useViewport)(),
      callback: Dynamic = (input?: Dynamic): Dynamic =>
        (input - value.x) * value.scale,
      callback2: Dynamic = (input?: Dynamic): Dynamic =>
        (input - value.y) * value.scale,
      state: Dynamic = {
        lines: [],
        labels: [],
      };
    for (let value2 of gaps as Dynamic)
      value2.axis === "x"
        ? (state.lines.push({
            x1: callback(value2.from),
            y1: callback2(value2.at),
            x2: callback(value2.to),
            y2: callback2(value2.at),
          }),
          state.labels.push({
            x: callback((value2.from + value2.to) / 2),
            y: callback2(value2.at),
            text: value2.label,
            axis: "x",
          }))
        : (state.lines.push({
            x1: callback(value2.at),
            y1: callback2(value2.from),
            x2: callback(value2.at),
            y2: callback2(value2.to),
          }),
          state.labels.push({
            x: callback(value2.at),
            y: callback2((value2.from + value2.to) / 2),
            text: value2.label,
            axis: "y",
          }));
    return (
      <div
        data-testid={"mega-spacing-guides"}
        aria-hidden={"true"}
        className={"pointer-events-none absolute inset-0 z-30"}
      >
        <runtime.MeasurementOverlay m={state} scale={1} />
      </div>
    );
  }
  function CanvasAnchoredPopover({
    x: x,
    y: y,
    dy: dy2 = 0,
    belowSheet: belowSheet,
    children: children,
  }: Dynamic): Dynamic {
    let value: Dynamic = (0, runtime.useViewport)(),
      value2: Dynamic = (x - value.x) * value.scale,
      value3: Dynamic = Math.max(40, (y - value.y) * value.scale + dy2),
      value4: Dynamic = (0, runtime.reactVectorToolState_2.useRef)(null),
      [value5, value6]: Dynamic = (0, runtime.reactVectorToolState_2.useState)(
        null,
      );
    (0, runtime.reactVectorToolState_2.useLayoutEffect)((): Dynamic => {
      let current: Dynamic = value4.current;
      if (!current) return;
      let callback: Dynamic = (): Dynamic => {
        let bounds: Dynamic = current.getBoundingClientRect(),
          value7: Dynamic =
            current.offsetParent?.clientWidth ?? (window as Dynamic).innerWidth,
          value8: Dynamic = (0, runtime.toolbarOverlayHeight)(current);
        value6(
          (input?: Dynamic): Dynamic =>
            input &&
            Math.abs(input.w - bounds.width) < 0.5 &&
            Math.abs(input.h - bounds.height) < 0.5 &&
            input.pw === value7 &&
            input.inset === value8
              ? input
              : {
                  w: bounds.width,
                  h: bounds.height,
                  pw: value7,
                  inset: value8,
                },
        );
      };
      callback();
      let observer: Dynamic = new ResizeObserver(callback);
      observer.observe(current);
      current.offsetParent && observer.observe(current.offsetParent);
      return (): Dynamic => observer.disconnect();
    }, []);
    return (
      <div
        ref={value4}
        data-mega-chrome={"selection-menu"}
        data-testid={"mega-selection-menu"}
        className={(0, runtime.joinClassNames)(
          "absolute",
          belowSheet ? "z-[39]" : "z-[45]",
        )}
        style={
          value5
            ? {
                left: Math.max(
                  8,
                  Math.min(value2 - value5.w / 2, value5.pw - value5.w - 8),
                ),
                top: Math.max(value5.inset + 4, value3 - value5.h - 8),
              }
            : {
                left: value2,
                top: value3,
                visibility: "hidden",
              }
        }
      >
        {children([value.x, value.y, value.scale].join(","))}
      </div>
    );
  }
  function artboardContentBox(
    artboard?: Dynamic,
    fullscreenBox?: Dynamic,
    rowHeight?: Dynamic,
  ): Dynamic {
    return fullscreenBox
      ? {
          top: rowHeight,
          w: fullscreenBox.w,
          h: fullscreenBox.h - rowHeight,
        }
      : {
          top: rowHeight,
          w: artboard.w,
          h: artboard.h,
        };
  }
  function focusedArtboardContentRect(
    artboards?: Dynamic,
    focusedFile?: Dynamic,
    fullscreenBox?: Dynamic,
    showTweaks?: Dynamic,
    propsByFile?: Dynamic,
  ): Dynamic {
    let value: Dynamic =
      focusedFile == null
        ? undefined
        : artboards.find(
            (input?: Dynamic): Dynamic => input.file === focusedFile,
          );
    if (!value || !fullscreenBox) return null;
    let value2: Dynamic = artboardContentBox(
      value,
      fullscreenBox,
      showTweaks && propsByFile?.[value.file]
        ? runtime.artboardTweaksRowHeight
        : 0,
    );
    return {
      file: value.file,
      x: value.x,
      y: value.y + value2.top,
      w: value2.w,
      h: value2.h,
    };
  }
  function commentPointWithinVisibleContent(
    point?: Dynamic,
    board?: Dynamic,
    visibleContent?: Dynamic,
  ): Dynamic {
    let callback: Dynamic = (
        input?: Dynamic,
        options?: Dynamic,
        context?: Dynamic,
      ): Dynamic => Math.max(options, Math.min(context, input)),
      value: Dynamic = Math.min(8, visibleContent.w / 2),
      value2: Dynamic = Math.min(8, visibleContent.h / 2);
    return {
      px: callback(
        callback(
          point.x - board.x,
          visibleContent.x + value,
          visibleContent.x + visibleContent.w - value,
        ),
        value,
        board.w - value,
      ),
      py: callback(
        callback(
          point.y - board.y,
          visibleContent.y + value2,
          visibleContent.y + visibleContent.h - value2,
        ),
        value2,
        board.h - value2,
      ),
    };
  }
  function ArtboardNoticeAnchor(input?: Dynamic): Dynamic {
    return (
      <div
        className={"pointer-events-none absolute h-0 w-0"}
        style={{
          left: input.x,
          top: input.y,
        }}
      >
        <ArtboardNoticePlane
          w={input.w}
          full={false}
          inert={input.inert}
          stamp={input.stamp}
        >
          {input.children}
        </ArtboardNoticePlane>
      </div>
    );
  }
  function ArtboardNoticePlane(input?: Dynamic): Dynamic {
    return (
      <div
        data-mega-notice-plane={""}
        inert={input.inert ? true : undefined}
        className={(0, runtime.joinClassNames)(
          "@container/foot pointer-events-none absolute left-0 z-30 flex",
          input.full ? "bottom-0 p-3" : "top-full",
        )}
        ref={input.stamp}
        style={{
          width: `calc(${input.w}px * var(--mega-scale))`,
          transform: "scale(var(--mega-inv-scale))",
          transformOrigin: input.full ? "left bottom" : "left top",
          marginTop: input.full
            ? undefined
            : "calc(6px * var(--mega-inv-scale))",
        }}
      >
        {input.children}
      </div>
    );
  }
  function ArtboardOverlayPlane(input?: Dynamic): Dynamic {
    if (input.fullscreenFile == null)
      return (
        <div className={"pointer-events-none absolute inset-0 z-[28]"}>
          {input.overlay(input.a.file, null)}
        </div>
      );
    if (input.fullscreenFile !== input.a.file) return null;
    let value: Dynamic = artboardContentBox(
      input.a,
      input.fullscreenBox,
      input.rowH,
    );
    return (
      <div
        data-testid={"mega-page-overlay"}
        className={"pointer-events-none absolute left-0 z-[28]"}
        style={{
          top: value.top,
          width: value.w,
          height: value.h,
        }}
      >
        {input.overlay(input.a.file, {
          w: value.w,
          h: value.h,
        })}
      </div>
    );
  }
  function shouldShowArtboardFaceOverlay(state?: Dynamic): Dynamic {
    return (
      state.live &&
      !state.blocked &&
      !state.frameless &&
      !state.focused &&
      !state.selected &&
      !state.playing &&
      !state.fullWindow
    );
  }
  bindRuntimeValue(
    runtime,
    "canvasHandleLabelSize",
    () => canvasHandleLabelSize,
    (value) => {
      canvasHandleLabelSize = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "maxCanvasOverlayZIndex",
    () => maxCanvasOverlayZIndex,
    (value) => {
      maxCanvasOverlayZIndex = value;
    },
  );
  bindRuntimeValue(runtime, "ConditionalPortal", () => ConditionalPortal);
  bindRuntimeValue(runtime, "RunWhenSeen", () => RunWhenSeen);
  bindRuntimeValue(runtime, "CanvasRectVisibility", () => CanvasRectVisibility);
  bindRuntimeValue(
    runtime,
    "PositionedSelectionQuickActions",
    () => PositionedSelectionQuickActions,
    (value) => {
      PositionedSelectionQuickActions = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "artboardHeaderTextClass",
    () => artboardHeaderTextClass,
    (value) => {
      artboardHeaderTextClass = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "artboardHeaderButtonClass",
    () => artboardHeaderButtonClass,
    (value) => {
      artboardHeaderButtonClass = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "artboardPlayButtonClass",
    () => artboardPlayButtonClass,
    (value) => {
      artboardPlayButtonClass = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "hideProblemAtNarrowHeaderClass",
    () => hideProblemAtNarrowHeaderClass,
    (value) => {
      hideProblemAtNarrowHeaderClass = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "hideTweaksAtNarrowHeaderClass",
    () => hideTweaksAtNarrowHeaderClass,
    (value) => {
      hideTweaksAtNarrowHeaderClass = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "hideDownloadAtNarrowHeaderClass",
    () => hideDownloadAtNarrowHeaderClass,
    (value) => {
      hideDownloadAtNarrowHeaderClass = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ArtboardHeaderActions",
    () => ArtboardHeaderActions,
    (value) => {
      ArtboardHeaderActions = value;
    },
  );
  bindRuntimeValue(runtime, "CanvasSnapGuides", () => CanvasSnapGuides);
  bindRuntimeValue(runtime, "CanvasGapGuides", () => CanvasGapGuides);
  bindRuntimeValue(
    runtime,
    "CanvasAnchoredPopover",
    () => CanvasAnchoredPopover,
  );
  bindRuntimeValue(runtime, "artboardContentBox", () => artboardContentBox);
  bindRuntimeValue(
    runtime,
    "focusedArtboardContentRect",
    () => focusedArtboardContentRect,
  );
  bindRuntimeValue(
    runtime,
    "commentPointWithinVisibleContent",
    () => commentPointWithinVisibleContent,
  );
  bindRuntimeValue(runtime, "ArtboardNoticeAnchor", () => ArtboardNoticeAnchor);
  bindRuntimeValue(runtime, "ArtboardNoticePlane", () => ArtboardNoticePlane);
  bindRuntimeValue(runtime, "ArtboardOverlayPlane", () => ArtboardOverlayPlane);
  bindRuntimeValue(
    runtime,
    "shouldShowArtboardFaceOverlay",
    () => shouldShowArtboardFaceOverlay,
  );
  return () => {
    canvasHandleLabelSize = {
      w: 92,
      h: 28,
    };
    maxCanvasOverlayZIndex = 1e5;
    PositionedSelectionQuickActions = (0, runtime.reactVectorToolState_2.memo)(
      function ({ at: at, ...props }: Dynamic): Dynamic {
        return <runtime.SelectionQuickActions {...props} />;
      },
    );
    artboardHeaderTextClass = "text-inherit";
    artboardHeaderButtonClass = "shrink-0 " + artboardHeaderTextClass;
    artboardPlayButtonClass = (0, runtime.joinClassNames)(
      artboardHeaderTextClass,
      "h-4 shrink border border-current px-1 py-0 text-[9px] leading-none font-medium uppercase tracking-[0.05em]",
    );
    hideProblemAtNarrowHeaderClass = "@max-[12.125rem]/hdr:hidden";
    hideTweaksAtNarrowHeaderClass = "@max-[10.5rem]/hdr:hidden";
    hideDownloadAtNarrowHeaderClass = "@max-[8.75rem]/hdr:hidden";
    ArtboardHeaderActions = (0, runtime.reactVectorToolState_2.memo)(function (
      input?: Dynamic,
    ): Dynamic {
      let { file: value, title: value2 }: Dynamic = input,
        value3: Dynamic = (0, runtime.reactVectorToolState_2.useRef)(null),
        value4: Dynamic = (0, runtime.reactVectorToolState_2.useRef)(null);
      (0, runtime.reactVectorToolState_2.useLayoutEffect)((): Dynamic => {
        let current: Dynamic = value4.current;
        !current ||
          current.isConnected ||
          ((value4.current = null),
          (document as Dynamic).activeElement === (document as Dynamic).body &&
            value3.current?.querySelector('[data-mega-chrome="play"]')?.focus({
              preventScroll: true,
            }));
      }, [input.play]);
      return (
        <div
          ref={value3}
          className={"ml-auto flex shrink-0 items-center gap-1.5"}
          onFocusCapture={(event?: Dynamic): Dynamic => {
            value4.current =
              event.target.closest(
                '[data-mega-chrome="play"], [role="menu"]',
              ) != null
                ? event.target
                : null;
          }}
          onBlurCapture={(): Dynamic => {
            value4.current = null;
          }}
          aria-hidden={input.inert ? true : undefined}
          onPointerDown={(input2?: Dynamic): Dynamic =>
            input2.stopPropagation()
          }
          onClick={(input2?: Dynamic): Dynamic => input2.stopPropagation()}
          onDoubleClick={(input2?: Dynamic): Dynamic =>
            input2.stopPropagation()
          }
        >
          <runtime.CdsIsland
            density={"compact"}
            className={"contents text-inherit"}
          >
            {input.problem !== undefined && (
              <runtime.Button
                variant={"ghost"}
                size={"xxs"}
                iconOnly={true}
                data-mega-chrome={"problem"}
                data-testid={"mega-artboard-problem-" + value}
                tabIndex={input.inert ? -1 : undefined}
                aria-label={"Show error notice on artboard " + value2}
                tooltip={input.problem}
                icon={<runtime.Icon name={"Warning"} size={"sm"} />}
                className={(0, runtime.joinClassNames)(
                  "shrink-0 text-danger",
                  input.play != null && hideProblemAtNarrowHeaderClass,
                )}
                onClick={(): Dynamic => input.onShowProblems(value)}
              />
            )}
            {input.tweaks && (
              <runtime.DisabledReasonTooltip
                wrapperClassName={
                  input.play != null ? hideTweaksAtNarrowHeaderClass : undefined
                }
                reason={
                  input.editable || input.inert
                    ? undefined
                    : runtime.ViewOnlyYouCanInspectThisMessage
                }
              >
                <runtime.Button
                  variant={"ghost"}
                  size={"xxs"}
                  iconOnly={true}
                  data-mega-chrome={"tweaks-open"}
                  data-testid={"mega-artboard-tweaks-open-" + value}
                  tabIndex={input.inert ? -1 : undefined}
                  aria-label={"Tweaks for artboard " + value2}
                  tooltip={
                    input.tweaksOpen
                      ? "Hide this artboard\u2019s tweaks"
                      : "Show this artboard\u2019s tweaks"
                  }
                  pressed={input.tweaksOpen}
                  disabled={!input.editable}
                  icon={<runtime.Icon name={"Filter"} size={"sm"} />}
                  className={artboardHeaderButtonClass}
                  onClick={(): Dynamic => input.onToggleTweaks(value)}
                />
              </runtime.DisabledReasonTooltip>
            )}
            {input.expand && input.play == null && (
              <runtime.Button
                variant={"ghost"}
                size={"xxs"}
                iconOnly={true}
                data-mega-chrome={"expand"}
                data-testid={"mega-artboard-expand-" + value}
                tabIndex={input.inert ? -1 : undefined}
                aria-label={"Open artboard " + value2 + " full window"}
                tooltip={"Open full window"}
                icon={<runtime.Icon name={"Expand"} size={"sm"} />}
                className={artboardHeaderButtonClass}
                onClick={(): Dynamic => input.onExpand(value)}
              />
            )}
            {input.download && (
              <runtime.MenuMenuAssignValue.Root
                open={input.exportOpen}
                onOpenChange={(input2?: Dynamic): Dynamic =>
                  input.onExportOpenChange(value, input2)
                }
              >
                <runtime.DisabledReasonTooltip
                  wrapperClassName={
                    input.play != null
                      ? hideDownloadAtNarrowHeaderClass
                      : undefined
                  }
                  reason={input.inert ? undefined : input.exportDisabledReason}
                >
                  <runtime.Tooltip content={"Export this artboard"}>
                    <runtime.MenuMenuAssignValue.Trigger
                      disabled={input.exportDisabledReason !== undefined}
                      render={
                        <runtime.Button
                          variant={"ghost"}
                          size={"xxs"}
                          iconOnly={true}
                          data-mega-chrome={"download"}
                          data-testid={"mega-artboard-download-" + value}
                          tabIndex={input.inert ? -1 : undefined}
                          aria-label={"Export artboard " + value2}
                          tooltip={false}
                          disabled={input.exportDisabledReason !== undefined}
                          icon={<runtime.Icon name={"Download"} size={"sm"} />}
                          className={artboardHeaderButtonClass}
                        />
                      }
                    />
                  </runtime.Tooltip>
                </runtime.DisabledReasonTooltip>
                <runtime.MenuMenuAssignValue.Popup className={"min-w-[190px]"}>
                  {input.exportItems}
                </runtime.MenuMenuAssignValue.Popup>
              </runtime.MenuMenuAssignValue.Root>
            )}
            {input.play === "play" && (
              <runtime.MenuMenuAssignValue.Root>
                <runtime.MenuMenuAssignValue.Trigger
                  render={
                    <runtime.Button
                      variant={"ghost"}
                      size={"xxs"}
                      data-mega-chrome={"play"}
                      data-testid={"mega-artboard-play-" + value}
                      tabIndex={input.inert ? -1 : undefined}
                      aria-label={"Play prototype " + value2}
                      className={(0, runtime.joinClassNames)(
                        artboardPlayButtonClass,
                        "pl-[3px] [&>span]:gap-0",
                      )}
                    >
                      <runtime.Icon name={"Play"} size={"xs"} />
                      {"Play"}
                    </runtime.Button>
                  }
                />
                <runtime.MenuMenuAssignValue.Popup
                  align={"end"}
                  className={"min-w-[160px]"}
                >
                  {(0, runtime.renderMenuItems)([
                    {
                      label: "Play on canvas",
                      onSelect: (): Dynamic => input.onPlay(value),
                    },
                    {
                      label: "Play full screen",
                      onSelect: (): Dynamic => input.onExpand(value),
                    },
                  ])}
                </runtime.MenuMenuAssignValue.Popup>
              </runtime.MenuMenuAssignValue.Root>
            )}
            {(input.play === "edit" || input.play === "stop") && (
              <runtime.Button
                variant={"ghost"}
                size={"xxs"}
                data-mega-chrome={"play"}
                data-testid={"mega-artboard-play-" + value}
                tabIndex={input.inert ? -1 : undefined}
                aria-label={
                  (input.play === "edit" ? "Edit " : "Stop playing ") + value2
                }
                className={(0, runtime.joinClassNames)(
                  artboardPlayButtonClass,
                  "bg-current",
                )}
                onClick={(): Dynamic => input.onPlay(value)}
              >
                <span className={"text-(--cds-page-bg)"}>
                  {input.play === "edit" ? "Edit" : "Stop"}
                </span>
              </runtime.Button>
            )}
          </runtime.CdsIsland>
        </div>
      );
    });
  };
}
