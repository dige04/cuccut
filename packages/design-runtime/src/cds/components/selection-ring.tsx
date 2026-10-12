/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";
export function installCdsComponentsSelectionRing(
  runtime: RuntimeBindings,
): () => void {
  var reactComponentsSelectionRing: Dynamic;
  var jsxComponentsSelectionRing: Dynamic;
  var selectionRingClasses: Dynamic;
  var ComponentsSelectionRingClassNames: Dynamic;
  var AspectSquareValue: Dynamic;
  var HFullValue: Dynamic;
  var ComponentsSelectionRingLabel: Dynamic;
  var ComponentsSelectionRingClassNames_2: Dynamic;
  var ComponentsSelectionRingClassNames_3: Dynamic;
  var ComponentsSelectionRingClassNames_4: Dynamic;
  var ComponentsSelectionRingClassNames_5: Dynamic;
  var ComponentsSelectionRingLabel_2: Dynamic;
  var ComponentsSelectionRingClassNames_6: Dynamic;
  var ComponentsSelectionRingConstant: Dynamic;
  var ComponentsSelectionRingConstant_2: Dynamic;
  var ComponentsSelectionRingLimit: Dynamic;
  var initializeComponentsSelectionRing: Dynamic;
  var ComponentsSelectionRingPointPointStrokeGripHitConfig: Dynamic;
  var initializeComponentsSelectionRing_2: Dynamic;
  var reactComponentsSelectionRing_2: Dynamic;
  var jsxComponentsSelectionRing_2: Dynamic;
  var SelectionPoints: Dynamic;
  var initializeComponentsSelectionRing_3: Dynamic;
  var ComponentsSelectionRingNwNeSeValues: Dynamic;
  var ComponentsSelectionRingEwResizeNwseResizeNsResizeValues: Dynamic;
  var ComponentsSelectionRingNeSeSwConfig: Dynamic;
  var ImageSvgXmlValue: Dynamic;
  var ComponentsSelectionRingLabel_3: Dynamic;
  var rotationCursorBodySvg: Dynamic;
  var ComponentsSelectionRingResolvedValue: Dynamic;
  var initializeComponentsSelectionRing_4: Dynamic;
  var reactComponentsSelectionRing_3: Dynamic;
  var jsxComponentsSelectionRing_3: Dynamic;
  var SelectionRing: Dynamic;
  var initializeComponentsSelectionRing_5: Dynamic;
  var ComponentsSelectionRingSGDAUDNZDSet: Dynamic;
  var ComponentsSelectionRingIntegerGroupDecimalSet: Dynamic;
  var initializeComponentsSelectionRing_6: Dynamic;
  var reactComponentsSelectionRing_4: Dynamic;
  var jsxComponentsSelectionRing_4: Dynamic;
  var ComponentsSelectionRingHandler: Dynamic;
  var ComponentsSelectionRingHandler_2: Dynamic;
  var NumberInput: Dynamic;
  var initializeComponentsSelectionRing_7: Dynamic;
  function selectionGripHitSize(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    if (context)
      return ComponentsSelectionRingPointPointStrokeGripHitConfig.gripHitTouch;
    let value: Dynamic = Math.min(input.w, input.h) * options;
    return Math.max(
      ComponentsSelectionRingPointPointStrokeGripHitConfig.grip,
      Math.min(
        ComponentsSelectionRingPointPointStrokeGripHitConfig.gripHit,
        value / 2,
      ),
    );
  }
  function SelectionPointGlyph(): Dynamic {
    let point: Dynamic =
        ComponentsSelectionRingPointPointStrokeGripHitConfig.point,
      pointStroke: Dynamic =
        ComponentsSelectionRingPointPointStrokeGripHitConfig.pointStroke;
    return (
      <span
        data-selection-grip={""}
        className={(0, runtime.cn)(
          "absolute top-1/2 left-1/2 box-border block -translate-x-1/2 -translate-y-1/2 rounded-full",
          runtime.OutlineFillAccentValue,
        )}
        style={{
          width: point,
          height: point,
          backgroundColor: runtime.tokens.on.accent.cssVar,
          outlineStyle: "solid",
          outlineWidth: pointStroke,
          outlineOffset: -pointStroke,
          pointerEvents: "none",
        }}
      />
    );
  }
  function selectionResizeCursor(
    input?: Dynamic,
    options: Dynamic = 0,
  ): Dynamic {
    let value: Dynamic = input.x === "left" ? -1 : input.x === "right" ? 1 : 0,
      value2: Dynamic = input.y === "top" ? -1 : input.y === "bottom" ? 1 : 0;
    return (
      ComponentsSelectionRingEwResizeNwseResizeNsResizeValues[
        ((Math.round((Math.atan2(value2, value) + options) / (Math.PI / 4)) %
          4) +
          4) %
          4
      ] ?? "ew-resize"
    );
  }
  function selectionRotationCursor(
    input?: Dynamic,
    options: Dynamic = 0,
  ): Dynamic {
    let value: Dynamic = Math.round(
      ComponentsSelectionRingNeSeSwConfig[input] + (options * 180) / Math.PI,
    );
    return `url("data:${ImageSvgXmlValue},${ComponentsSelectionRingLabel_3}${String(value)}${ComponentsSelectionRingResolvedValue}") 12 12, grab`;
  }
  function preventSelectionHandleEvent(event?: Dynamic): Dynamic {
    event.preventDefault();
    event.stopPropagation();
  }
  function selectionHandleTooltip(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    return (0, runtime.hasDisabledReason)(options.content) ? (
      <runtime.Tooltip
        key={input}
        lazy={true}
        content={options.content}
        multiline={options.reason}
        hoverable={false}
        closeOnClick={options.reason ? false : undefined}
        trackCursorAxis={options.followPointer ? "both" : undefined}
      >
        {context}
      </runtime.Tooltip>
    ) : (
      (0, reactComponentsSelectionRing_3.cloneElement)(context, {
        key: input,
      })
    );
  }
  function isOutsideSelectionGrip(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
  ): Dynamic {
    let value2: Dynamic =
      input.currentTarget.parentElement?.getBoundingClientRect();
    if (value2 === undefined) return false;
    let value3: Dynamic = input.clientX - (value2.left + value2.width / 2),
      value4: Dynamic = input.clientY - (value2.top + value2.height / 2),
      value5: Dynamic = value3 * Math.cos(value) + value4 * Math.sin(value),
      value6: Dynamic = value4 * Math.cos(value) - value3 * Math.sin(value);
    return Math.abs(value5) <= options && Math.abs(value6) <= context;
  }
  function selectionPointKey(input?: Dynamic): Dynamic {
    return `${input.x ?? "mid"}-${input.y ?? "mid"}`;
  }
  function currencySymbol(input?: Dynamic, options?: Dynamic): Dynamic {
    let value: Dynamic = input.toUpperCase();
    try {
      let value2: Dynamic = new Intl.NumberFormat(options, {
          style: "currency",
          currency: value,
          currencyDisplay: ComponentsSelectionRingSGDAUDNZDSet.has(value)
            ? "code"
            : "symbol",
        }).formatToParts(1),
        value3: Dynamic = value2.findIndex(
          (input2?: Dynamic): Dynamic => input2.type === "currency",
        ),
        value4: Dynamic = value2[value3];
      if (value4 === undefined)
        return {
          symbol: value,
          side: "start",
        };
      let value5: Dynamic = value2
        .slice(0, value3)
        .some(
          (input2?: Dynamic): Dynamic =>
            ComponentsSelectionRingIntegerGroupDecimalSet.has(input2.type),
        )
        ? "end"
        : "start";
      return {
        symbol: value4.value,
        side: value5,
      };
    } catch {
      return {
        symbol: value,
        side: "start",
      };
    }
  }
  function useHydratedNumberInput(): Dynamic {
    return (0, reactComponentsSelectionRing_4.useSyncExternalStore)(
      ComponentsSelectionRingHandler_2,
      (): Dynamic => true,
      (): Dynamic => false,
    );
  }
  bindRuntimeValue(
    runtime,
    "reactComponentsSelectionRing",
    () => reactComponentsSelectionRing,
    (value) => {
      reactComponentsSelectionRing = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxComponentsSelectionRing",
    () => jsxComponentsSelectionRing,
    (value) => {
      jsxComponentsSelectionRing = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "selectionRingClasses",
    () => selectionRingClasses,
    (value) => {
      selectionRingClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsSelectionRingClassNames",
    () => ComponentsSelectionRingClassNames,
    (value) => {
      ComponentsSelectionRingClassNames = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "AspectSquareValue",
    () => AspectSquareValue,
    (value) => {
      AspectSquareValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "HFullValue",
    () => HFullValue,
    (value) => {
      HFullValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsSelectionRingLabel",
    () => ComponentsSelectionRingLabel,
    (value) => {
      ComponentsSelectionRingLabel = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsSelectionRingClassNames_2",
    () => ComponentsSelectionRingClassNames_2,
    (value) => {
      ComponentsSelectionRingClassNames_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsSelectionRingClassNames_3",
    () => ComponentsSelectionRingClassNames_3,
    (value) => {
      ComponentsSelectionRingClassNames_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsSelectionRingClassNames_4",
    () => ComponentsSelectionRingClassNames_4,
    (value) => {
      ComponentsSelectionRingClassNames_4 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsSelectionRingClassNames_5",
    () => ComponentsSelectionRingClassNames_5,
    (value) => {
      ComponentsSelectionRingClassNames_5 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsSelectionRingLabel_2",
    () => ComponentsSelectionRingLabel_2,
    (value) => {
      ComponentsSelectionRingLabel_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsSelectionRingClassNames_6",
    () => ComponentsSelectionRingClassNames_6,
    (value) => {
      ComponentsSelectionRingClassNames_6 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsSelectionRingConstant",
    () => ComponentsSelectionRingConstant,
    (value) => {
      ComponentsSelectionRingConstant = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsSelectionRingConstant_2",
    () => ComponentsSelectionRingConstant_2,
    (value) => {
      ComponentsSelectionRingConstant_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsSelectionRingLimit",
    () => ComponentsSelectionRingLimit,
    (value) => {
      ComponentsSelectionRingLimit = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeComponentsSelectionRing",
    () => initializeComponentsSelectionRing,
    (value) => {
      initializeComponentsSelectionRing = value;
    },
  );
  bindRuntimeValue(runtime, "selectionGripHitSize", () => selectionGripHitSize);
  bindRuntimeValue(
    runtime,
    "ComponentsSelectionRingPointPointStrokeGripHitConfig",
    () => ComponentsSelectionRingPointPointStrokeGripHitConfig,
    (value) => {
      ComponentsSelectionRingPointPointStrokeGripHitConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeComponentsSelectionRing_2",
    () => initializeComponentsSelectionRing_2,
    (value) => {
      initializeComponentsSelectionRing_2 = value;
    },
  );
  bindRuntimeValue(runtime, "SelectionPointGlyph", () => SelectionPointGlyph);
  bindRuntimeValue(
    runtime,
    "reactComponentsSelectionRing_2",
    () => reactComponentsSelectionRing_2,
    (value) => {
      reactComponentsSelectionRing_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxComponentsSelectionRing_2",
    () => jsxComponentsSelectionRing_2,
    (value) => {
      jsxComponentsSelectionRing_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SelectionPoints",
    () => SelectionPoints,
    (value) => {
      SelectionPoints = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeComponentsSelectionRing_3",
    () => initializeComponentsSelectionRing_3,
    (value) => {
      initializeComponentsSelectionRing_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "selectionResizeCursor",
    () => selectionResizeCursor,
  );
  bindRuntimeValue(
    runtime,
    "selectionRotationCursor",
    () => selectionRotationCursor,
  );
  bindRuntimeValue(
    runtime,
    "ComponentsSelectionRingNwNeSeValues",
    () => ComponentsSelectionRingNwNeSeValues,
    (value) => {
      ComponentsSelectionRingNwNeSeValues = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsSelectionRingEwResizeNwseResizeNsResizeValues",
    () => ComponentsSelectionRingEwResizeNwseResizeNsResizeValues,
    (value) => {
      ComponentsSelectionRingEwResizeNwseResizeNsResizeValues = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsSelectionRingNeSeSwConfig",
    () => ComponentsSelectionRingNeSeSwConfig,
    (value) => {
      ComponentsSelectionRingNeSeSwConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ImageSvgXmlValue",
    () => ImageSvgXmlValue,
    (value) => {
      ImageSvgXmlValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsSelectionRingLabel_3",
    () => ComponentsSelectionRingLabel_3,
    (value) => {
      ComponentsSelectionRingLabel_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "rotationCursorBodySvg",
    () => rotationCursorBodySvg,
    (value) => {
      rotationCursorBodySvg = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsSelectionRingResolvedValue",
    () => ComponentsSelectionRingResolvedValue,
    (value) => {
      ComponentsSelectionRingResolvedValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeComponentsSelectionRing_4",
    () => initializeComponentsSelectionRing_4,
    (value) => {
      initializeComponentsSelectionRing_4 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "preventSelectionHandleEvent",
    () => preventSelectionHandleEvent,
  );
  bindRuntimeValue(
    runtime,
    "selectionHandleTooltip",
    () => selectionHandleTooltip,
  );
  bindRuntimeValue(
    runtime,
    "isOutsideSelectionGrip",
    () => isOutsideSelectionGrip,
  );
  bindRuntimeValue(runtime, "selectionPointKey", () => selectionPointKey);
  bindRuntimeValue(
    runtime,
    "reactComponentsSelectionRing_3",
    () => reactComponentsSelectionRing_3,
    (value) => {
      reactComponentsSelectionRing_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxComponentsSelectionRing_3",
    () => jsxComponentsSelectionRing_3,
    (value) => {
      jsxComponentsSelectionRing_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SelectionRing",
    () => SelectionRing,
    (value) => {
      SelectionRing = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeComponentsSelectionRing_5",
    () => initializeComponentsSelectionRing_5,
    (value) => {
      initializeComponentsSelectionRing_5 = value;
    },
  );
  bindRuntimeValue(runtime, "currencySymbol", () => currencySymbol);
  bindRuntimeValue(
    runtime,
    "ComponentsSelectionRingSGDAUDNZDSet",
    () => ComponentsSelectionRingSGDAUDNZDSet,
    (value) => {
      ComponentsSelectionRingSGDAUDNZDSet = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsSelectionRingIntegerGroupDecimalSet",
    () => ComponentsSelectionRingIntegerGroupDecimalSet,
    (value) => {
      ComponentsSelectionRingIntegerGroupDecimalSet = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeComponentsSelectionRing_6",
    () => initializeComponentsSelectionRing_6,
    (value) => {
      initializeComponentsSelectionRing_6 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "useHydratedNumberInput",
    () => useHydratedNumberInput,
  );
  bindRuntimeValue(
    runtime,
    "reactComponentsSelectionRing_4",
    () => reactComponentsSelectionRing_4,
    (value) => {
      reactComponentsSelectionRing_4 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxComponentsSelectionRing_4",
    () => jsxComponentsSelectionRing_4,
    (value) => {
      jsxComponentsSelectionRing_4 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsSelectionRingHandler",
    () => ComponentsSelectionRingHandler,
    (value) => {
      ComponentsSelectionRingHandler = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsSelectionRingHandler_2",
    () => ComponentsSelectionRingHandler_2,
    (value) => {
      ComponentsSelectionRingHandler_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "NumberInput",
    () => NumberInput,
    (value) => {
      NumberInput = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeComponentsSelectionRing_7",
    () => initializeComponentsSelectionRing_7,
    (value) => {
      initializeComponentsSelectionRing_7 = value;
    },
  );
  return () => {
    initializeComponentsSelectionRing = (0, runtime.initializeOnce)(
      (): Dynamic => {
        "use client";

        (0, runtime.initializeClassNames)();
        (0, runtime.initializeDomOwnerWindow)();
        (0, runtime.initializeCdsRoot)();
        (0, runtime.initializeDomSelectionPrevention)();
        (0, runtime.initializeComponentsIcon_2)();
        (0, runtime.initializeTooltipTrigger_2)();
        (0, runtime.initializeTooltipTooltip)();
        (0, runtime.initializeButtonContext_2)();
        (0, runtime.initializeFieldContext)();
        (0, runtime.initializeSwitchContext)();
        reactComponentsSelectionRing = (0, runtime.toModuleNamespace)(
          (0, runtime.load_react)(),
        );
        jsxComponentsSelectionRing = (0, runtime.toModuleNamespace)(
          (0, runtime.load_react_jsx_runtime)(),
        );
        (0, runtime.initializeNpm__base_ui_react_H5)();
        (0, runtime.initializeNpm__base_ui_react_zve)();
        (0, runtime.initializeNpm__base_ui_react_jve)();
        selectionRingClasses =
          "cds-reset relative z-[1] inline-flex h-full items-center justify-center gap-1.5 select-none border-0 bg-transparent outline-none focus-visible:outline-hidden rounded-[calc(var(--cds-radius)-2px)] text-body font-normal [&:not([data-disabled])]:hover:text-primary data-[checked]:text-primary data-[disabled]:opacity-disabled transition-shadow duration-fast focus-visible:shadow-focus";
        ComponentsSelectionRingClassNames = "px-md";
        AspectSquareValue = "aspect-square";
        HFullValue = "h-full";
        ComponentsSelectionRingLabel = "grow basis-[calc(var(--cds-pad-md)*2)]";
        ComponentsSelectionRingClassNames_2 = "flex-1";
        ComponentsSelectionRingClassNames_3 = "text-muted";
        ComponentsSelectionRingClassNames_4 =
          "text-secondary [&:not([data-checked]):not([data-disabled])]:hover:bg-fill-ghost-hover";
        ComponentsSelectionRingClassNames_5 =
          "invisible absolute left-0 origin-left rounded-[calc(var(--cds-radius)-1px)] bg-[var(--cds-segmented-control-thumb)]";
        ComponentsSelectionRingLabel_2 =
          "top-px bottom-px [box-shadow:inset_0_0_0_1px_var(--cds-border),0_1px_2px_0_rgb(0_0_0/0.05)]";
        ComponentsSelectionRingClassNames_6 =
          "inset-y-0 [box-shadow:inset_0_0_0_1px_var(--cds-border)]";
        ComponentsSelectionRingConstant = 30;
        ComponentsSelectionRingConstant_2 = 2;
        ComponentsSelectionRingLimit = 600;
      },
    );
    initializeComponentsSelectionRing_2 = (0, runtime.initializeOnce)(
      (): Dynamic => {
        (0, runtime.initializeEditorSelectionGeometry)();
        ComponentsSelectionRingPointPointStrokeGripHitConfig = {
          ...runtime.selectionMetrics,
          point: 10,
          pointStroke: 1.5,
          gripHit: 24,
          gripHitTouch: 40,
          edgeHit: 8,
          rotateReach: 16,
        };
      },
    );
    initializeComponentsSelectionRing_3 = (0, runtime.initializeOnce)(
      (): Dynamic => {
        "use client";

        (0, runtime.initializeClassNames)();
        (0, runtime.initializeTokens)();
        (0, runtime.initializeSheetsMenuPopup_2)();
        (0, runtime.initializeEditorSelectionGeometry)();
        initializeComponentsSelectionRing_2();
        reactComponentsSelectionRing_2 = (0, runtime.toModuleNamespace)(
          (0, runtime.load_react)(),
        );
        jsxComponentsSelectionRing_2 = (0, runtime.toModuleNamespace)(
          (0, runtime.load_react_jsx_runtime)(),
        );
        SelectionPoints = (0, reactComponentsSelectionRing_2.forwardRef)(
          function (
            {
              points: points,
              scale = 1,
              shaft: shaft,
              shape = "round",
              onPointDragStart: onPointDragStart,
              cursor = "move",
              className: className,
              ...props
            }: Dynamic,
            options?: Dynamic,
          ): Dynamic {
            let value: Dynamic = (0,
              reactComponentsSelectionRing_2.useSyncExternalStore)(
                runtime.subscribeSheetMedia,
                runtime.usesCoarsePointer,
                (): Dynamic => false,
              ),
              value2: Dynamic = (0, runtime.normalizeSelectionScale)(scale),
              index: Dynamic = 0;
            for (let value5 of points as Dynamic)
              for (let value6 of points as Dynamic)
                index = Math.max(
                  index,
                  Math.abs(value5.x - value6.x),
                  Math.abs(value5.y - value6.y),
                );
            let value3: Dynamic = value
                ? ComponentsSelectionRingPointPointStrokeGripHitConfig.gripHitTouch
                : Math.max(
                    ComponentsSelectionRingPointPointStrokeGripHitConfig.grip,
                    Math.min(
                      ComponentsSelectionRingPointPointStrokeGripHitConfig.gripHit,
                      (index * value2) / 2,
                    ),
                  ),
              value4: Dynamic = onPointDragStart !== undefined;
            return (
              <div
                {...props}
                ref={options}
                data-cds={"SelectionPoints"}
                aria-hidden={"true"}
                className={(0, runtime.cn)(
                  "pointer-events-none absolute top-0 left-0",
                  className,
                )}
              >
                {shaft !== undefined && shaft.length > 1 ? (
                  <svg
                    data-selection-shaft={""}
                    className={
                      "pointer-events-none absolute top-0 left-0 overflow-visible"
                    }
                    width={1}
                    height={1}
                  >
                    <polyline
                      points={shaft
                        .map(
                          (input?: Dynamic): Dynamic => `${input.x},${input.y}`,
                        )
                        .join(" ")}
                      fill={"none"}
                      stroke={runtime.tokens.fill.accent.cssVar}
                      strokeWidth={1 / value2}
                    />
                  </svg>
                ) : null}
                {points.map(
                  (input?: Dynamic, options2?: Dynamic): Dynamic => (
                    <div
                      key={options2}
                      className={"absolute top-0 left-0 size-0"}
                      style={{
                        transform: `translate(${input.x}px, ${input.y}px) scale(${1 / value2})`,
                      }}
                    >
                      <div
                        data-resize-handle={value4 ? "" : undefined}
                        data-point-handle={options2}
                        className={"absolute touch-none"}
                        style={{
                          left: -value3 / 2,
                          top: -value3 / 2,
                          width: value3,
                          height: value3,
                          cursor: value4 ? cursor : undefined,
                          pointerEvents: value4 ? "auto" : "none",
                        }}
                        onPointerDown={
                          value4
                            ? (input2?: Dynamic): Dynamic =>
                                onPointDragStart(options2, input2)
                            : undefined
                        }
                      >
                        {shape === "square" ? (
                          <runtime.SelectionGrip />
                        ) : (
                          <SelectionPointGlyph />
                        )}
                      </div>
                    </div>
                  ),
                )}
              </div>
            );
          },
        );
        SelectionPoints.displayName = "SelectionPoints";
      },
    );
    initializeComponentsSelectionRing_4 = (0, runtime.initializeOnce)(
      (): Dynamic => {
        ComponentsSelectionRingNwNeSeValues = ["nw", "ne", "se", "sw"];
        ComponentsSelectionRingEwResizeNwseResizeNsResizeValues = [
          "ew-resize",
          "nwse-resize",
          "ns-resize",
          "nesw-resize",
        ];
        ComponentsSelectionRingNeSeSwConfig = {
          ne: 0,
          se: 90,
          sw: 180,
          nw: 270,
        };
        ImageSvgXmlValue = "image/svg+xml";
        ComponentsSelectionRingLabel_3 =
          "%3Csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20width=%2724%27%20height=%2724%27%20viewBox=%270%200%2024%2024%27%3E%3Cg%20transform=%27rotate%28";
        rotationCursorBodySvg =
          "%20d=%27M%204.5%2010.7%20L%205.4%2010.4%20A%206.5%206.5%200%200%201%2013.6%2018.6%20L%2013.3%2019.5%20M%206.3%207.8%20L%204.5%2010.7%20L%207.7%2012.0%20M%2012.0%2016.3%20L%2013.3%2019.5%20L%2016.2%2017.7%27";
        ComponentsSelectionRingResolvedValue =
          "%2012%2012%29%27%20fill=%27none%27%20stroke-linecap=%27round%27%20stroke-linejoin=%27round%27%3E" +
          ("%3Cpath" +
            rotationCursorBodySvg +
            "%20stroke=%27white%27%20stroke-width=%273.5%27/%3E") +
          ("%3Cpath" +
            rotationCursorBodySvg +
            "%20stroke=%27black%27%20stroke-width=%271.5%27/%3E") +
          "%3C/g%3E%3C/svg%3E";
      },
    );
    initializeComponentsSelectionRing_5 = (0, runtime.initializeOnce)(
      (): Dynamic => {
        "use client";

        (0, runtime.initializeClassNames)();
        (0, runtime.initializeSheetsMenuPopup_2)();
        (0, runtime.initializeEditorSelectionGeometry)();
        (0, runtime.initializeTooltipDisabledReason)();
        (0, runtime.initializeTooltipTooltip)();
        initializeComponentsSelectionRing_2();
        initializeComponentsSelectionRing_4();
        reactComponentsSelectionRing_3 = (0, runtime.toModuleNamespace)(
          (0, runtime.load_react)(),
        );
        jsxComponentsSelectionRing_3 = (0, runtime.toModuleNamespace)(
          (0, runtime.load_react_jsx_runtime)(),
        );
        SelectionRing = (0, reactComponentsSelectionRing_3.forwardRef)(
          function (
            {
              frame: frame,
              scale = 1,
              rotation: rotation,
              state = "selected",
              variant = "object",
              grips: grips,
              angleLabel: angleLabel,
              collaborator: collaborator,
              onResizeStart: onResizeStart,
              edgeStrips = true,
              onGripDoubleClick: onGripDoubleClick,
              onRotateStart: onRotateStart,
              resizeDisabledReason: resizeDisabledReason,
              rotateDisabledReason: rotateDisabledReason,
              gripLabel: gripLabel,
              className: className,
              style: style,
              ...props
            }: Dynamic,
            options?: Dynamic,
          ): Dynamic {
            let value: Dynamic = (0,
              reactComponentsSelectionRing_3.useSyncExternalStore)(
                runtime.subscribeSheetMedia,
                runtime.usesCoarsePointer,
                (): Dynamic => false,
              ),
              value2: Dynamic = (0, runtime.normalizeSelectionScale)(scale),
              value3: Dynamic = (0, runtime.normalizeCollaboratorIndex)(
                collaborator,
              );
            if (collaborator !== undefined && value3 === undefined) return null;
            let value4: Dynamic = (0, runtime.selectionRingStroke)(
                state,
                value3,
              ),
              value5: Dynamic = (0, runtime.resolveSelectionPoints)(
                grips,
                state,
                value3,
              ),
              value6: Dynamic = (0, runtime.normalizeSelectionRotation)(
                rotation,
              ),
              value7: Dynamic = (0, runtime.hasDisabledReason)(
                resizeDisabledReason,
              ),
              value8: Dynamic = (0, runtime.hasDisabledReason)(
                rotateDisabledReason,
              ),
              value9: Dynamic = value3 === undefined && state === "selected",
              value10: Dynamic =
                value9 && (value7 ? !value : onResizeStart !== undefined),
              value11: Dynamic = frame.w * value2,
              value12: Dynamic = frame.h * value2,
              value13: Dynamic = selectionGripHitSize(frame, value2, value),
              edgeHit: Dynamic =
                ComponentsSelectionRingPointPointStrokeGripHitConfig.edgeHit,
              value14: Dynamic =
                typeof grips == "object"
                  ? runtime.EditorSelectionGeometryFilterValue.filter(
                      (input?: Dynamic): Dynamic =>
                        grips.some(
                          (input2?: Dynamic): Dynamic =>
                            (0, runtime.sameSelectionPoint)(input2, input),
                        ),
                    )
                  : [],
              value15: Dynamic =
                !value10 ||
                value ||
                value7 ||
                !edgeStrips ||
                value5.length === 0
                  ? []
                  : value14.length > 0
                    ? value14
                    : runtime.EditorSelectionGeometryFilterValue,
              callback: Dynamic = (input?: Dynamic): Dynamic =>
                input >=
                3 *
                  ComponentsSelectionRingPointPointStrokeGripHitConfig.edgeHit,
              value16: Dynamic = value15.filter(
                (input?: Dynamic): Dynamic =>
                  input.x === null
                    ? input.y !== null && callback(value12)
                    : input.y === null && callback(value11),
              ),
              value17: Dynamic =
                !value9 || value || (onRotateStart === undefined && !value8)
                  ? []
                  : ComponentsSelectionRingNwNeSeValues,
              value18: Dynamic =
                value13 / 2 +
                ComponentsSelectionRingPointPointStrokeGripHitConfig.rotateReach,
              value19: Dynamic = value7
                ? {
                    content: resizeDisabledReason,
                    reason: true,
                  }
                : {
                    content: gripLabel,
                    reason: false,
                  };
            return (
              <div
                {...props}
                ref={options}
                data-cds={"SelectionRing"}
                data-state={value3 === undefined ? state : undefined}
                data-variant={value3 === undefined ? variant : undefined}
                data-collaborator={value3}
                aria-hidden={"true"}
                className={(0, runtime.cn)(
                  runtime.OutlineFillAccentValue,
                  className,
                )}
                style={{
                  ...style,
                  ...(0, runtime.SelectionRingSvg)({
                    frame: frame,
                    scale: value2,
                    rotation: rotation,
                    stroke: value4,
                    collaborator: value3,
                    variant: variant,
                  }),
                }}
              >
                <runtime.TooltipGroup>
                  {value17.map((input?: Dynamic): Dynamic => {
                    let state2: Dynamic = {
                      position: "absolute",
                      left:
                        input === "nw" || input === "sw" ? -value18 : value11,
                      top:
                        input === "nw" || input === "ne" ? -value18 : value12,
                      width: value18,
                      height: value18,
                      pointerEvents: "auto",
                      cursor: value8
                        ? "default"
                        : selectionRotationCursor(input, value6),
                    };
                    return selectionHandleTooltip(
                      `rotate-${input}`,
                      {
                        content: rotateDisabledReason,
                        reason: true,
                      },
                      <div
                        data-resize-handle={""}
                        data-rotate-handle={input}
                        className={"touch-none"}
                        data-disabled={value8 ? "" : undefined}
                        style={state2}
                        onPointerDown={
                          value8
                            ? preventSelectionHandleEvent
                            : (input2?: Dynamic): Dynamic =>
                                onRotateStart?.(input, input2)
                        }
                      />,
                    );
                  })}
                  {value16.map((input?: Dynamic): Dynamic => {
                    let value20: Dynamic = input.x === null,
                      callback2: Dynamic = (
                        input2?: Dynamic,
                        options2?: Dynamic,
                      ): Dynamic =>
                        value5.some(
                          (input3?: Dynamic): Dynamic =>
                            input3.x === input2 && input3.y === options2,
                        )
                          ? value13 / 2
                          : 0,
                      value21: Dynamic = value20
                        ? callback2("left", input.y)
                        : callback2(input.x, "top"),
                      value22: Dynamic = value20
                        ? callback2("right", input.y)
                        : callback2(input.x, "bottom"),
                      state2: Dynamic = {
                        position: "absolute",
                        pointerEvents: "auto",
                        cursor: selectionResizeCursor(input, value6),
                        ...(value20
                          ? {
                              left: value21,
                              width: Math.max(0, value11 - value21 - value22),
                              top:
                                (input.y === "top" ? 0 : value12) - edgeHit / 2,
                              height: edgeHit,
                            }
                          : {
                              top: value21,
                              height: Math.max(0, value12 - value21 - value22),
                              left:
                                (input.x === "left" ? 0 : value11) -
                                edgeHit / 2,
                              width: edgeHit,
                            }),
                      };
                    return selectionHandleTooltip(
                      `strip-${selectionPointKey(input)}`,
                      {
                        content: gripLabel,
                        reason: false,
                        followPointer: true,
                      },
                      <div
                        data-resize-handle={""}
                        data-resize-strip={""}
                        className={"touch-none"}
                        style={state2}
                        onPointerDown={(input2?: Dynamic): Dynamic =>
                          onResizeStart?.(input, input2)
                        }
                        onDoubleClick={
                          onGripDoubleClick === undefined
                            ? undefined
                            : (input2?: Dynamic): Dynamic => {
                                input2.stopPropagation();
                                onGripDoubleClick(input);
                              }
                        }
                      />,
                    );
                  })}
                  {value5.map((input?: Dynamic): Dynamic => {
                    let value20: Dynamic = (0, runtime.selectionPointPosition)(
                      input,
                    );
                    if (!value10)
                      return (() => {
                        const _Component = "span";
                        const _props = {
                          className: "absolute block size-0",
                          style: value20,
                          children: (
                            <runtime.SelectionGrip
                              stroke={value4}
                              disabled={value9 && value7}
                              variant={variant}
                            />
                          ),
                        } as const;
                        const _key = selectionPointKey(input);
                        return <_Component key={_key} {..._props} />;
                      })();
                    let state2: Dynamic = {
                      position: "absolute",
                      left: `calc(${value20.left} - ${value13 / 2}px)`,
                      top: `calc(${value20.top} - ${value13 / 2}px)`,
                      width: value13,
                      height: value13,
                      pointerEvents: "auto",
                      cursor: value7
                        ? "default"
                        : selectionResizeCursor(input, value6),
                    };
                    return selectionHandleTooltip(
                      selectionPointKey(input),
                      value19,
                      <div
                        data-resize-handle={""}
                        data-disabled={value7 ? "" : undefined}
                        className={"touch-none"}
                        style={state2}
                        onPointerDown={
                          value7
                            ? preventSelectionHandleEvent
                            : (input2?: Dynamic): Dynamic =>
                                onResizeStart?.(input, input2)
                        }
                        onDoubleClick={
                          onGripDoubleClick === undefined || value7
                            ? undefined
                            : (input2?: Dynamic): Dynamic => {
                                (value &&
                                  isOutsideSelectionGrip(
                                    input2,
                                    value11 / 2,
                                    value12 / 2,
                                    value6,
                                  )) ||
                                  (input2.stopPropagation(),
                                  onGripDoubleClick(input));
                              }
                        }
                      >
                        <runtime.SelectionGrip
                          stroke={value4}
                          disabled={value7}
                          variant={variant}
                        />
                      </div>,
                    );
                  })}
                </runtime.TooltipGroup>
                {angleLabel !== undefined && value3 === undefined ? (
                  <runtime.SelectionPoint
                    data-selection-angle={""}
                    scale={1}
                    rotation={rotation}
                    anchor={"center"}
                    at={runtime.EditorSelectionGeometryLeftTopConfig}
                    variant={variant}
                  >
                    {angleLabel}
                  </runtime.SelectionPoint>
                ) : null}
              </div>
            );
          },
        );
        SelectionRing.displayName = "SelectionRing";
      },
    );
    initializeComponentsSelectionRing_6 = (0, runtime.initializeOnce)(
      (): Dynamic => {
        ComponentsSelectionRingSGDAUDNZDSet = new Set(["SGD", "AUD", "NZD"]);
        ComponentsSelectionRingIntegerGroupDecimalSet = new Set([
          "integer",
          "group",
          "decimal",
          "fraction",
          "minusSign",
          "plusSign",
          "nan",
          "infinity",
        ]);
      },
    );
    initializeComponentsSelectionRing_7 = (0, runtime.initializeOnce)(
      (): Dynamic => {
        "use client";

        (0, runtime.initializeClassNames)();
        (0, runtime.initializeCdsRoot)();
        (0, runtime.initializeMenuPopup_2)();
        (0, runtime.initializeDomRefComposition)();
        (0, runtime.initializeButtonButton_2)();
        (0, runtime.initializeFieldContext)();
        initializeComponentsSelectionRing_6();
        reactComponentsSelectionRing_4 = (0, runtime.toModuleNamespace)(
          (0, runtime.load_react)(),
        );
        jsxComponentsSelectionRing_4 = (0, runtime.toModuleNamespace)(
          (0, runtime.load_react_jsx_runtime)(),
        );
        (0, runtime.initializeNpm__base_ui_react_VJe)();
        ComponentsSelectionRingHandler = (): Dynamic => {};
        ComponentsSelectionRingHandler_2 = (): Dynamic =>
          ComponentsSelectionRingHandler;
        NumberInput = (0, reactComponentsSelectionRing_4.forwardRef)(
          (
            {
              className: className,
              size: size,
              fullWidth = true,
              currency: currency,
              slotStart: slotStart,
              slotEnd: slotEnd,
              value: value,
              defaultValue: defaultValue,
              onValueChange: onValueChange,
              onValueCommitted: onValueCommitted,
              format: format,
              locale: locale,
              min: min2,
              max: max,
              step: step,
              smallStep: smallStep,
              largeStep: largeStep,
              snapOnStep: snapOnStep,
              allowOutOfRange: allowOutOfRange,
              required: required,
              disabled: disabled2,
              readOnly: readOnly,
              name: name,
              form: form,
              ...props
            }: Dynamic,
            options?: Dynamic,
          ): Dynamic => {
            "use no memo";

            let { id: value2, ...value3 }: Dynamic = props,
              value4: Dynamic = (0, runtime.useExperimentalSettings)(),
              value5: Dynamic = locale ?? value4,
              value6: Dynamic = useHydratedNumberInput(),
              value7: Dynamic = value5 ?? (value6 ? undefined : "en-US"),
              value8: Dynamic = (0, reactComponentsSelectionRing_4.useMemo)(
                (): Dynamic =>
                  currency !== undefined &&
                  slotStart === undefined &&
                  slotEnd === undefined
                    ? currencySymbol(currency, value7)
                    : null,
                [currency, value7, slotStart, slotEnd],
              ),
              value9: Dynamic =
                slotStart ?? (value8?.side === "start" ? value8.symbol : null),
              value10: Dynamic =
                slotEnd ?? (value8?.side === "end" ? value8.symbol : null),
              value11: Dynamic = value8 !== null || undefined,
              value12: Dynamic = (0, runtime.useFieldInvalid)(),
              value13: Dynamic = (0, runtime.useFieldDisabled)(),
              value14: Dynamic = fullWidth ? "w-full" : "",
              value15: Dynamic = (0, reactComponentsSelectionRing_4.useRef)(
                null,
              ),
              { clickToFocusProps: value16 }: Dynamic = (0,
              runtime.useClickToFocus)(
                (): Dynamic => value15.current?.focus(),
                {
                  disabled: disabled2 || value13,
                  readOnly: readOnly,
                },
              ),
              [, value17]: Dynamic = (0,
              reactComponentsSelectionRing_4.useReducer)(
                (input?: Dynamic): Dynamic => input + 1,
                0,
              ),
              callback: Dynamic = (input?: Dynamic): Dynamic => {
                value3.onBlur?.(input);
                value17();
              },
              value18: Dynamic = (0, runtime.useMergedRefs)(value15, options);
            return (
              <runtime.npm_NumberField_mU.Root
                data-cds={"NumberInput"}
                {...(0, runtime.getSizeAttribute)(size)}
                data-invalid={value12 || undefined}
                id={value2}
                value={value}
                defaultValue={defaultValue}
                onValueChange={onValueChange}
                onValueCommitted={onValueCommitted}
                format={format}
                locale={value5}
                min={min2}
                max={max}
                step={step}
                smallStep={smallStep}
                largeStep={largeStep}
                snapOnStep={snapOnStep}
                allowOutOfRange={allowOutOfRange}
                required={required}
                disabled={disabled2}
                readOnly={readOnly}
                name={name}
                form={form}
                onMouseDown={value16.onMouseDown}
                className={(0, runtime.cn)(
                  runtime.ButtonButtonCss,
                  "pr-md",
                  "inline-flex",
                  value14,
                  "cursor-text items-center gap-[var(--cds-pad-sm,6px)] has-[:focus-visible]:shadow-focus",
                  "data-[disabled]:opacity-disabled",
                  !disabled2 &&
                    "[&:hover:not(:focus-visible):not(:has(:focus-visible)):not([data-invalid]):not([data-disabled])]:shadow-field-hover",
                  className,
                )}
              >
                {value9 ? (
                  <span
                    aria-hidden={value11}
                    className={"flex shrink-0 items-center text-muted"}
                  >
                    {value9}
                  </span>
                ) : null}
                <runtime.npm_NumberField_mU.Input
                  ref={value18}
                  aria-invalid={
                    value3["aria-invalid"] ?? (value12 || undefined)
                  }
                  {...value3}
                  onBlur={callback}
                  className={(0, runtime.cn)(
                    runtime.ButtonButtonClassNames_4,
                    "disabled:opacity-100",
                  )}
                />
                {value10 ? (
                  <span
                    aria-hidden={value11}
                    className={"flex shrink-0 items-center text-muted"}
                  >
                    {value10}
                  </span>
                ) : null}
              </runtime.npm_NumberField_mU.Root>
            );
          },
        );
        NumberInput.displayName = "NumberInput";
      },
    );
  };
}
