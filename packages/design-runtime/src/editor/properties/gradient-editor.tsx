/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";
export function installEditorPropertiesGradientEditor(
  runtime: RuntimeBindings,
): () => void {
  var PropertiesGradientEditorHandler: Dynamic;
  var PropertiesGradientEditorTest: Dynamic;
  var PropertiesGradientEditorAttrCalcPattern: Dynamic;
  var PropertiesGradientEditorPattern: Dynamic;
  var WrittenByHandInAFormMessage: Dynamic;
  var PropertiesGradientEditorHandler_2: Dynamic;
  var jsxPropertiesGradientEditor: Dynamic;
  var PropertiesGradientEditorColorMixPattern: Dynamic;
  var PropertiesGradientEditorImageCrossFadePattern: Dynamic;
  var PropertiesGradientEditorLabel: Dynamic;
  function normalizedGradientStops(input?: Dynamic): Dynamic {
    let value: Dynamic = input.map(
      (input2?: Dynamic): Dynamic =>
        input2.pos === undefined
          ? undefined
          : (0, runtime.PropertiesSelectMin)(input2.pos, 0, 100),
    );
    if (value.length === 0) return [];
    value[0] === undefined && (value[0] = 0);
    value[value.length - 1] === undefined && (value[value.length - 1] = 100);
    let value2: Dynamic = -1 / 0;
    for (let index: Dynamic = 0; index < value.length; index++)
      value[index] !== undefined &&
        (value[index] < value2 && (value[index] = value2),
        (value2 = value[index]));
    for (let count: Dynamic = 1; count < value.length - 1; count++) {
      if (value[count] !== undefined) continue;
      let value3: Dynamic = count;
      for (; value[value3] === undefined; ) value3++;
      let value4: Dynamic = value[count - 1],
        value5: Dynamic = value[value3];
      for (let value6: Dynamic = count; value6 < value3; value6++)
        value[value6] =
          value4 +
          ((value5 - value4) * (value6 - count + 1)) / (value3 - count + 1);
      count = value3;
    }
    return value;
  }
  function GradientEditor({
    radial: radial,
    onRadial: onRadial,
    angle: angle,
    onAngle: onAngle,
    onAngleScrub: onAngleScrub,
    onAngleScrubEnd: onAngleScrubEnd,
    stops: stops,
    selected: selected,
    onSelect: onSelect,
    onStops: onStops,
    onStopsLive: onStopsLive,
    onLiveEnd: onLiveEnd,
    minStops = 2,
    maxStops = 8,
    disabled: disabled2 = false,
    renderStopPicker: renderStopPicker,
    testid: testid,
  }: Dynamic): Dynamic {
    let [value, value2]: Dynamic = (0,
      runtime.reactPropertiesTooltip_2.useState)(null),
      value3: Dynamic = value ?? stops,
      value4: Dynamic = (0, runtime.reactPropertiesTooltip_2.useRef)(false),
      value5: Dynamic = normalizedGradientStops(value3),
      value6: Dynamic =
        value4.current || value !== null
          ? value3.map(
              (input?: Dynamic, options?: Dynamic): Dynamic =>
                input.pos === undefined
                  ? value5[options]
                  : (0, runtime.PropertiesSelectMin)(input.pos, 0, 100),
            )
          : value5,
      callback: Dynamic = (input?: Dynamic): Dynamic =>
        input.swatch ?? input.color,
      value7: Dynamic = value3.map(callback).join("\0"),
      value8: Dynamic = (0,
      runtime.reactPropertiesTooltip_2.useMemo)((): Dynamic => {
        let entries: Dynamic = new Map();
        for (let value28 of value7.split("\0") as Dynamic)
          entries.has(value28) ||
            entries.set(
              value28,
              PropertiesGradientEditorAttrCalcPattern.test(value28) ||
                PropertiesGradientEditorPattern.test(value28)
                ? "transparent"
                : PropertiesGradientEditorHandler(value28),
            );
        return (input?: Dynamic): Dynamic =>
          entries.get(input) ?? "transparent";
      }, [value7]),
      value9: Dynamic = (0, runtime.PropertiesSelectMin)(
        selected,
        0,
        Math.max(0, value3.length - 1),
      ),
      value10: Dynamic = (0, runtime.reactPropertiesTooltip_2.useRef)(null),
      value11: Dynamic = (0, runtime.reactPropertiesTooltip_2.useRef)(null),
      value12: Dynamic = (0, runtime.reactPropertiesTooltip_2.useRef)([]),
      value13: Dynamic = (0, runtime.reactPropertiesTooltip_2.useRef)(0);
    value12.current.length !== value3.length &&
      (value12.current = value3.map((): Dynamic => value13.current++));
    let current: Dynamic = value12.current,
      callback2: Dynamic = (): Dynamic =>
        value11.current?.closest('[data-mc-popover], [role="dialog"]') ??
        value11.current,
      [value14, value15]: Dynamic = (0,
      runtime.reactPropertiesTooltip_2.useState)(null),
      [value16, value17]: Dynamic = (0,
      runtime.reactPropertiesTooltip_2.useState)(false),
      value18: Dynamic =
        value14 !== null && current.includes(value14)
          ? current.indexOf(value14)
          : null,
      value19: Dynamic = (0, runtime.reactPropertiesTooltip_2.useRef)(null),
      value20: Dynamic = (0, runtime.reactPropertiesTooltip_2.useRef)({
        stops: stops,
        onStopsLive: onStopsLive,
        onLiveEnd: onLiveEnd,
      });
    value20.current = {
      stops: stops,
      onStopsLive: onStopsLive,
      onLiveEnd: onLiveEnd,
    };
    let callback3: Dynamic = (input?: Dynamic): Dynamic => {
      let {
          stops: current2,
          onStopsLive: current3,
          onLiveEnd: current4,
        }: Dynamic = value20.current,
        value28: Dynamic = value12.current.indexOf(input.id);
      current3 &&
        value28 >= 0 &&
        value28 < current2.length &&
        current3(
          current2.map(
            (input2?: Dynamic, options?: Dynamic): Dynamic =>
              options === value28
                ? {
                    ...input2,
                    pos: input.posBefore,
                  }
                : input2,
          ),
        );
      current4?.();
    };
    (0, runtime.reactPropertiesTooltip_2.useEffect)(
      (): Dynamic => (): Dynamic => {
        let current2: Dynamic = value19.current;
        current2?.moved && callback3(current2);
      },
      [],
    );
    let value21: Dynamic = (0, runtime.reactPropertiesTooltip_2.useRef)(false),
      callback4: Dynamic = (input?: Dynamic): Dynamic =>
        input.map(
          (input2?: Dynamic, options?: Dynamic): Dynamic =>
            input2.locked === true
              ? input2
              : {
                  ...input2,
                  pos:
                    Math.round(
                      (input === value3
                        ? value6[options]
                        : normalizedGradientStops(input)[options]) * 100,
                    ) / 100,
                },
        ),
      value22: Dynamic = value3.some(
        (input?: Dynamic): Dynamic => input.locked === true,
      ),
      callback5: Dynamic = (
        items?: Dynamic,
        options?: Dynamic,
        context?: Dynamic,
      ): Dynamic => {
        let value28: Dynamic = value22 && options > 0 ? value6[options - 1] : 0,
          value29: Dynamic =
            value22 && options < items.length - 1 ? value6[options + 1] : 100;
        return callback4(items).map(
          (input?: Dynamic, options2?: Dynamic): Dynamic =>
            options2 === options
              ? {
                  ...input,
                  pos: Math.round(
                    (0, runtime.PropertiesSelectMin)(context, value28, value29),
                  ),
                }
              : input,
        );
      },
      callback6: Dynamic = (input?: Dynamic): Dynamic => {
        value4.current = true;
        onStopsLive ? onStopsLive(input) : value2(input);
      },
      callback7: Dynamic = (input?: Dynamic): Dynamic => {
        let activeElement: Dynamic = (document as Dynamic).activeElement,
          current2: Dynamic = value11.current;
        if (
          !current2 ||
          !(activeElement instanceof HTMLElement) ||
          !current2.contains(activeElement)
        )
          return;
        let value28: Dynamic = activeElement.matches('button[role="slider"]')
          ? 'button[role="slider"]'
          : activeElement.matches("input") &&
              activeElement.closest('[role="listitem"]') !== null
            ? '[role="listitem"] input'
            : null;
        value28 !== null &&
          requestAnimationFrame(
            (): Dynamic => current2.querySelectorAll(value28)[input]?.focus(),
          );
      },
      value23: Dynamic = (0, runtime.reactPropertiesTooltip_2.useRef)(0),
      callback8: Dynamic = (input?: Dynamic, options?: Dynamic): Dynamic => {
        let value28: Dynamic = input.some(
            (input2?: Dynamic): Dynamic => input2.locked === true,
          ),
          value29: Dynamic = input.map(
            (input2?: Dynamic, options2?: Dynamic): Dynamic => options2,
          );
        value28 ||
          value29.sort(
            (input2?: Dynamic, options2?: Dynamic): Dynamic =>
              input[input2].pos - input[options2].pos || input2 - options2,
          );
        let value30: Dynamic = Math.max(0, value29.indexOf(options)),
          value31: Dynamic = value29.map(
            (input2?: Dynamic): Dynamic => input[input2],
          );
        value12.current = value29.map(
          (input2?: Dynamic): Dynamic => value12.current[input2],
        );
        value4.current = false;
        value30 !== options &&
          ((value23.current += 1), onStopsLive?.(value31), callback7(value30));
        value2(null);
        onLiveEnd?.();
        onStops(value31);
        onSelect(value30);
        return value30;
      },
      length: Dynamic = value3.filter(
        (input?: Dynamic): Dynamic => input.hint !== true,
      ).length,
      value24: Dynamic = length > minStops || length < value3.length,
      callback9: Dynamic = (input?: Dynamic): Dynamic =>
        !disabled2 &&
        value3.length > 0 &&
        (value3[input]?.hint === true ? true : length > minStops),
      callback10: Dynamic = (input?: Dynamic): Dynamic => {
        if (!callback9(input)) return value3.length;
        let value28: Dynamic = value3.map(
          (input2?: Dynamic, options?: Dynamic): Dynamic => options !== input,
        );
        for (let flag: Dynamic = true; flag; ) {
          flag = false;
          let value30: Dynamic = value3
            .map((input2?: Dynamic, options?: Dynamic): Dynamic => options)
            .filter((input2?: Dynamic): Dynamic => value28[input2]);
          value30.forEach((input2?: Dynamic, options?: Dynamic): Dynamic => {
            if (value3[input2].hint !== true || !value28[input2]) return;
            let value31: Dynamic = options === 0,
              value32: Dynamic = options === value30.length - 1,
              value33: Dynamic =
                options > 0 && value3[value30[options - 1]].hint === true;
            (value31 || value32 || value33) &&
              ((value28[input2] = false), (flag = true));
          });
        }
        let value29: Dynamic = callback4(value3).filter(
          (input2?: Dynamic, options?: Dynamic): Dynamic => value28[options],
        );
        value12.current = value12.current.filter(
          (input2?: Dynamic, options?: Dynamic): Dynamic => value28[options],
        );
        value15(null);
        onStops(value29);
        let length2: Dynamic = value28
          .slice(0, value9 + 1)
          .filter((input2?: Dynamic): Dynamic => !input2).length;
        onSelect(
          (0, runtime.PropertiesSelectMin)(
            value28[value9]
              ? value9 - length2
              : value9 -
                  length2 +
                  (value9 - length2 + 1 < value29.length ? 1 : 0),
            0,
            Math.max(0, value29.length - 1),
          ),
        );
        return value29.length;
      },
      callback11: Dynamic = (): Dynamic => {
        if (disabled2 || value3.length >= maxStops || value3.length === 0)
          return;
        let value28: Dynamic = value9,
          value29: Dynamic = value28 < value3.length - 1,
          value30: Dynamic = value6[value28],
          value31: Dynamic = value29
            ? value6[value28 + 1]
            : (value6[value28 - 1] ?? 0),
          state: Dynamic = {
            color:
              (value3[value28].locked === true
                ? value3.find(
                    (input?: Dynamic): Dynamic => input.locked !== true,
                  )
                : value3[value28]
              )?.color ?? "#808080",
            pos: Math.round((value30 + value31) / 2),
          },
          value32: Dynamic = value29 ? value28 + 1 : value28,
          value33: Dynamic = callback4(value3);
        value12.current = [
          ...value12.current.slice(0, value32),
          value13.current++,
          ...value12.current.slice(value32),
        ];
        onStops([
          ...value33.slice(0, value32),
          state,
          ...value33.slice(value32),
        ]);
        onSelect(value32);
      },
      value25: Dynamic = (0, runtime.reactPropertiesTooltip_2.useRef)(null),
      callback12: Dynamic = (input?: Dynamic): Dynamic => {
        let bounds: Dynamic = (
          value25.current ?? value10.current
        ).getBoundingClientRect();
        return (
          ((input.clientX - bounds.left) / Math.max(1, bounds.width)) * 100
        );
      },
      callback13: Dynamic =
        (input?: Dynamic): Dynamic =>
        (event?: Dynamic): Dynamic => {
          if (
            disabled2 ||
            event.button !== 0 ||
            value19.current !== null ||
            value3[input]?.locked === true
          )
            return;
          event.preventDefault();
          let current2: Dynamic = value23.current,
            activeElement: Dynamic = (document as Dynamic).activeElement;
          activeElement instanceof HTMLElement &&
            activeElement !== event.currentTarget &&
            value11.current?.contains(activeElement) &&
            activeElement.blur();
          value23.current === current2 &&
            (event.currentTarget.setPointerCapture(event.pointerId),
            event.currentTarget.focus(),
            (value19.current = {
              index: input,
              id: current[input],
              pointer: event.pointerId,
              x0: event.clientX,
              moved: false,
              last: value6[input],
              posBefore: value6[input],
            }),
            (value21.current = false),
            onSelect(input));
        },
      callback14: Dynamic = (input?: Dynamic): Dynamic => {
        let current2: Dynamic = value19.current;
        !current2 ||
          current2.pointer !== input.pointerId ||
          !input.currentTarget.hasPointerCapture(input.pointerId) ||
          (!current2.moved && Math.abs(input.clientX - current2.x0) < 3) ||
          ((current2.moved = true),
          (current2.last = callback12(input)),
          callback6(callback5(value3, current2.index, current2.last)));
      },
      callback15: Dynamic = (input?: Dynamic, options?: Dynamic): Dynamic => {
        let current2: Dynamic = value19.current;
        !current2 ||
          current2.pointer !== input.pointerId ||
          ((value19.current = null),
          input.currentTarget.hasPointerCapture(input.pointerId) &&
            input.currentTarget.releasePointerCapture(input.pointerId),
          current2.moved &&
            (options
              ? ((value21.current = true),
                callback8(
                  callback5(value3, current2.index, current2.last),
                  current2.index,
                ))
              : ((value4.current = false),
                value2(null),
                onStopsLive ? callback3(current2) : onLiveEnd?.())));
      },
      callback16: Dynamic =
        (input?: Dynamic): Dynamic =>
        (event?: Dynamic): Dynamic => {
          if (
            disabled2 ||
            (value3[input]?.locked === true &&
              event.key !== "Delete" &&
              event.key !== "Backspace")
          )
            return;
          let value28: Dynamic = event.shiftKey ? 10 : 1,
            value29: Dynamic = value6[input],
            value30: Dynamic = null;
          if (event.key === "ArrowLeft" || event.key === "ArrowDown")
            value30 = value29 - value28;
          else if (event.key === "ArrowRight" || event.key === "ArrowUp")
            value30 = value29 + value28;
          else if (event.key === "Home") value30 = 0;
          else if (event.key === "End") value30 = 100;
          else if (event.key === "Delete" || event.key === "Backspace") {
            event.preventDefault();
            if (callback9(input)) {
              let value31: Dynamic = callback10(input),
                value32: Dynamic = Math.min(input, value31 - 1);
              requestAnimationFrame(
                (): Dynamic =>
                  value25.current
                    ?.querySelectorAll('button[role="slider"]')
                    [value32]?.focus(),
              );
            }
            return;
          }
          value30 !== null &&
            (event.preventDefault(),
            event.stopPropagation(),
            callback8(callback5(value3, input, value30), input));
        },
      callback17: Dynamic = (input?: Dynamic): Dynamic =>
        "calc(0.75rem + (100% - 1.5rem) * " + String(input / 100) + ")",
      value26: Dynamic = value3.flatMap(
        (input?: Dynamic, options?: Dynamic): Dynamic =>
          input.hint === true
            ? []
            : [value8(callback(input)) + " " + callback17(value6[options])],
      ),
      value27: Dynamic =
        "linear-gradient(90deg, " +
        (value26.length >= 2
          ? value26
          : ["transparent 0%", "transparent 100%"]
        ).join(", ") +
        ")";
    return (
      <div
        ref={value11}
        data-testid={testid}
        data-kit={"gradient-editor"}
        className={"flex flex-col"}
      >
        <runtime.PropertyRow label={"Style"}>
          <div className={"flex min-w-0 flex-1 items-center gap-2"}>
            <div className={"min-w-0 flex-1"}>
              <runtime.PropertySelect
                aria-label={"Gradient style"}
                items={PropertiesGradientEditorHandler_2(
                  onRadial !== undefined,
                )}
                value={radial ? "radial" : "linear"}
                disabled={disabled2}
                onChange={(input?: Dynamic): Dynamic => {
                  (input === "radial") !== radial &&
                    onRadial?.(input === "radial");
                }}
              />
            </div>
            <div
              className={"w-[4.75rem] shrink-0"}
              title={radial ? "A radial gradient has no angle." : undefined}
            >
              <runtime.NumericInput
                aria-label={"Angle"}
                prefix={
                  <runtime.PropertyOptionIcon
                    icon={runtime.PropertiesTooltipNameViewBoxPathsConfig_13}
                  />
                }
                value={radial ? undefined : angle}
                placeholder={radial ? "\u2013" : "180"}
                ownUnit={"deg"}
                min={0}
                max={360}
                step={1}
                steppers={false}
                disabled={disabled2 || radial}
                onValue={(input?: Dynamic): Dynamic =>
                  onAngle(
                    input === undefined
                      ? undefined
                      : (0, runtime.PropertiesSelectMin)(input, 0, 360),
                  )
                }
                {...(onAngleScrub
                  ? {
                      onScrub: (input?: Dynamic): Dynamic =>
                        onAngleScrub(
                          (0, runtime.PropertiesSelectMin)(input, 0, 360),
                        ),
                      onScrubEnd: onAngleScrubEnd,
                    }
                  : {})}
              />
            </div>
          </div>
        </runtime.PropertyRow>
        <div
          className={(0, runtime.joinClassNames)(
            runtime.PropertiesPrimitivesClassNames_3,
            "pt-3 pb-4",
          )}
        >
          <div
            ref={value10}
            data-kit={"gradient-bar"}
            className={
              "relative h-8 rounded shadow-card-ring bg-[repeating-conic-gradient(var(--cds-alpha-2)_0_25%,transparent_0_50%)] bg-[length:8px_8px]"
            }
          >
            <div
              className={"absolute inset-0 rounded"}
              style={{
                background: value27,
              }}
            />
            <div ref={value25} className={"absolute inset-y-0 left-3 right-3"}>
              {value3.map(
                (input?: Dynamic, options?: Dynamic): Dynamic =>
                  (() => {
                    const _Component = "button";
                    const _props = {
                      type: "button",
                      role: "slider",
                      "aria-label": "Stop " + String(options + 1) + " position",
                      "aria-valuemin": 0,
                      "aria-valuemax": 100,
                      "aria-valuenow": Math.round(value6[options]),
                      "aria-valuetext":
                        String(Math.round(value6[options])) + "%",
                      "data-selected": options === value9 ? "" : undefined,
                      disabled: disabled2,
                      "aria-disabled": input.locked === true ? true : undefined,
                      title:
                        input.locked === true
                          ? WrittenByHandInAFormMessage
                          : undefined,
                      className: (0, runtime.joinClassNames)(
                        "absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 cursor-default touch-none rounded-full border-2 border-white p-0 shadow-card-ring",
                        "focus-visible:shadow-focus pointer-coarse:h-6 pointer-coarse:w-6",
                        options === value9
                          ? "z-[1] outline outline-2 outline-offset-1 outline-border-strong"
                          : "outline-none focus-visible:outline-hidden",
                      ),
                      style: {
                        left: String(value6[options]) + "%",
                        background: value8(callback(input)),
                      },
                      onPointerDown: callback13(options),
                      onPointerMove: callback14,
                      onPointerUp: (input2?: Dynamic): Dynamic =>
                        callback15(input2, true),
                      onPointerCancel: (input2?: Dynamic): Dynamic =>
                        callback15(input2, false),
                      onLostPointerCapture: (input2?: Dynamic): Dynamic =>
                        callback15(input2, false),
                      onKeyDown: callback16(options),
                      onClick: (): Dynamic => {
                        value21.current
                          ? (value21.current = false)
                          : onSelect(options);
                      },
                    } as const;
                    const _key = current[options];
                    return <_Component key={_key} {..._props} />;
                  })(),
              )}
            </div>
          </div>
        </div>
        <runtime.PropertyRow label={"Stops"}>
          <div className={"flex min-w-0 flex-1 justify-end"}>
            <runtime.Button
              variant={"ghost"}
              size={"sm"}
              iconOnly={true}
              icon={"Add"}
              aria-label={"Add stop"}
              disabled={disabled2 || value3.length >= maxStops}
              disabledReason={String(maxStops) + " stops at most."}
              onClick={callback11}
            />
          </div>
        </runtime.PropertyRow>
        <div
          role={"list"}
          aria-label={"Stops"}
          className={(0, runtime.joinClassNames)(
            runtime.PropertiesPrimitivesClassNames_3,
            "mt-1 flex flex-col gap-2",
          )}
        >
          {value3.map((input?: Dynamic, options?: Dynamic): Dynamic => {
            let value28: Dynamic =
              !PropertiesGradientEditorAttrCalcPattern.test(callback(input)) &&
              !PropertiesGradientEditorPattern.test(callback(input));
            return (() => {
              const _Component2 = "div";
              const _props2 = {
                role: "listitem",
                className: "flex min-w-0 items-center gap-2",
                children: [
                  <div className={"w-[3.75rem] shrink-0"}>
                    <runtime.NumericInput
                      aria-label={"Stop " + String(options + 1) + " position"}
                      value={Math.round(value6[options])}
                      unit={"%"}
                      min={0}
                      max={100}
                      step={1}
                      smallStep={1}
                      steppers={false}
                      disabled={disabled2 || input.locked === true}
                      title={
                        input.locked === true
                          ? WrittenByHandInAFormMessage
                          : undefined
                      }
                      onValue={(input2?: Dynamic): Dynamic =>
                        callback8(
                          callback5(value3, options, input2 ?? value6[options]),
                          options,
                        )
                      }
                      onScrub={(input2?: Dynamic): Dynamic =>
                        callback6(callback5(value3, options, input2))
                      }
                      onScrubEnd={(): Dynamic =>
                        callback8(
                          callback5(value3, options, value6[options]),
                          options,
                        )
                      }
                    />
                  </div>,
                  <span className={"relative flex min-w-0 flex-1"}>
                    <runtime.EditorPopover
                      open={value18 === options}
                      onOpen={(): Dynamic => value15(current[options])}
                      onClose={(): Dynamic => value15(null)}
                      trigger={
                        <runtime.PropertyPickerButton
                          aria-label={
                            "Stop " +
                            String(options + 1) +
                            " color: " +
                            PropertiesGradientEditorTest(input.color)
                          }
                          data-selected={options === value9 ? "" : undefined}
                          disabled={disabled2}
                          onClick={(input2?: Dynamic): Dynamic => {
                            onSelect(options);
                            value17(input2.detail === 0);
                          }}
                          className={(0, runtime.joinClassNames)(
                            "min-w-0 cursor-default",
                            options === value9 && "bg-fill-ghost-hover",
                          )}
                          chip={
                            <runtime.PropertyColorWell
                              background={
                                value28 ? value8(callback(input)) : undefined
                              }
                            />
                          }
                        >
                          {PropertiesGradientEditorTest(input.color)}
                        </runtime.PropertyPickerButton>
                      }
                      side={"left"}
                      positionAnchor={callback2}
                      padding={"none"}
                      className={runtime.ColorPickerLabel}
                      focusOnOpen={value16}
                      popupAttrs={{
                        "data-kit-stop-picker": String(options),
                      }}
                    >
                      {value18 === options ? renderStopPicker(options) : null}
                    </runtime.EditorPopover>
                  </span>,
                  value24 ? (
                    <runtime.Button
                      variant={"ghost"}
                      size={"sm"}
                      iconOnly={true}
                      icon={"Minus"}
                      aria-label={"Remove stop " + String(options + 1)}
                      disabled={!callback9(options)}
                      disabledReason={
                        "A gradient needs " + String(minStops) + " color stops."
                      }
                      onClick={(): Dynamic => callback10(options)}
                    />
                  ) : null,
                ],
              } as const;
              const _key2 = current[options];
              return <_Component2 key={_key2} {..._props2} />;
            })();
          })}
        </div>
      </div>
    );
  }
  bindRuntimeValue(
    runtime,
    "normalizedGradientStops",
    () => normalizedGradientStops,
  );
  bindRuntimeValue(
    runtime,
    "PropertiesGradientEditorHandler",
    () => PropertiesGradientEditorHandler,
    (value) => {
      PropertiesGradientEditorHandler = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PropertiesGradientEditorTest",
    () => PropertiesGradientEditorTest,
    (value) => {
      PropertiesGradientEditorTest = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PropertiesGradientEditorAttrCalcPattern",
    () => PropertiesGradientEditorAttrCalcPattern,
    (value) => {
      PropertiesGradientEditorAttrCalcPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PropertiesGradientEditorPattern",
    () => PropertiesGradientEditorPattern,
    (value) => {
      PropertiesGradientEditorPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "WrittenByHandInAFormMessage",
    () => WrittenByHandInAFormMessage,
    (value) => {
      WrittenByHandInAFormMessage = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PropertiesGradientEditorHandler_2",
    () => PropertiesGradientEditorHandler_2,
    (value) => {
      PropertiesGradientEditorHandler_2 = value;
    },
  );
  bindRuntimeValue(runtime, "GradientEditor", () => GradientEditor);
  bindRuntimeValue(
    runtime,
    "jsxPropertiesGradientEditor",
    () => jsxPropertiesGradientEditor,
    (value) => {
      jsxPropertiesGradientEditor = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PropertiesGradientEditorColorMixPattern",
    () => PropertiesGradientEditorColorMixPattern,
    (value) => {
      PropertiesGradientEditorColorMixPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PropertiesGradientEditorImageCrossFadePattern",
    () => PropertiesGradientEditorImageCrossFadePattern,
    (value) => {
      PropertiesGradientEditorImageCrossFadePattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PropertiesGradientEditorLabel",
    () => PropertiesGradientEditorLabel,
    (value) => {
      PropertiesGradientEditorLabel = value;
    },
  );
  return () => {
    PropertiesGradientEditorHandler = (input?: Dynamic): Dynamic =>
      (0, runtime.hsvaToRgbaCss)((0, runtime.parseHsvaColor)(input));
    PropertiesGradientEditorTest = (input?: Dynamic): Dynamic =>
      /^#[0-9a-f]{3,8}$/i.test(input.trim())
        ? input.trim().toUpperCase()
        : input.trim();
    PropertiesGradientEditorAttrCalcPattern =
      /\b(var|env|attr|calc|color-mix)\(|^\s*(currentcolor|inherit|initial|unset)\s*$/i;
    PropertiesGradientEditorPattern = /^\s*-?[\d.]+[a-z%]*\s*$/i;
    WrittenByHandInAFormMessage =
      "Written by hand in a form this editor keeps as is.";
    PropertiesGradientEditorHandler_2 = (input?: Dynamic): Dynamic => [
      {
        value: "linear",
        label: "Linear",
      },
      {
        value: "radial",
        label: "Radial",
        disabled: !input,
        title: input ? undefined : "Linear gradients only here.",
      },
    ];
    jsxPropertiesGradientEditor = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_jsx_runtime)(),
      1,
    );
    PropertiesGradientEditorColorMixPattern = /^\s*(var|color-mix)\(/i;
    PropertiesGradientEditorImageCrossFadePattern =
      /url\s*\(|image(-set)?\s*\(|src\s*\(|cross-fade\s*\(|element\s*\(|\\/i;
    PropertiesGradientEditorLabel = (input?: Dynamic): Dynamic =>
      input.label ?? input.name[0].toUpperCase() + input.name.slice(1);
  };
}
