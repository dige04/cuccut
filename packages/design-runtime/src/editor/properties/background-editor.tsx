/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";
export function installEditorPropertiesBackgroundEditor(
  runtime: RuntimeBindings,
): () => void {
  var PropertiesBackgroundEditorItems: Dynamic;
  function PropertySelectTrigger({
    className: className,
    ...props
  }: Dynamic): Dynamic {
    return (
      <runtime.PropertyPickerButton
        className={(0, runtime.cn)("w-full", className)}
        {...props}
      />
    );
  }
  function CssColorWell({ css: css }: Dynamic): Dynamic {
    return (
      <runtime.PropertyColorWell
        background={css ? (0, runtime.sanitizeCssBackground)(css) : undefined}
      />
    );
  }
  function AuthoredColorPicker({
    value: value,
    authoredValue: authoredValue,
    seed: seed,
    onChange: onChange,
    disabled: disabled2,
    plain = false,
    ...props
  }: Dynamic): Dynamic {
    let {
        dsColorTokens: value2,
        artboardColors: value3,
        iframeDefinedVars: value4,
      }: Dynamic = (0, runtime.useInspectorContext)(),
      [value5]: Dynamic = (0, runtime.reactPropertiesAssetPicker_3.useState)(
        (): Dynamic =>
          plain ? undefined : (0, runtime.artboardColorSwatchGroup)(value3),
      );
    return disabled2 ? null : (
      <runtime.TokenColorPicker
        {...props}
        value={value || seed || "#ffffff"}
        authoredValue={authoredValue}
        unset={!value}
        onChange={onChange}
        tokens={plain ? PropertiesBackgroundEditorItems : value2}
        context={value5}
        iframeDefinedVars={plain ? undefined : value4}
        title={runtime.ColorValue}
      />
    );
  }
  function CssNumericPopupInput({
    name: name,
    prefix: prefix,
    unit = "px",
    ownUnit = "px",
    value: value,
    shown: shown,
    min: min2,
    max: max,
    steppers = true,
    disabled: disabled2,
    onChange: onChange,
  }: Dynamic): Dynamic {
    let [value2, value3]: Dynamic = (0,
      runtime.reactPropertiesAssetPicker_3.useState)(null),
      value4: Dynamic = (0, runtime.useStyleCommitScrub)(
        (input?: Dynamic): Dynamic => {
          value3(input);
          onChange(input);
        },
      ),
      value5: Dynamic = Number.isFinite(value) ? value : 0;
    return (
      <runtime.NumericInput
        value={value2 ?? shown ?? value5}
        prefix={prefix}
        unit={unit}
        refuseLetters={true}
        ownUnit={ownUnit}
        min={min2}
        max={max}
        steppers={steppers}
        disabled={disabled2}
        aria-label={name}
        onValue={(input?: Dynamic): Dynamic => {
          input === undefined || input === value5 || onChange(input);
        }}
        onScrub={value4.onScrub}
        onScrubEnd={(): Dynamic => {
          value4.onScrubEnd();
          value3(null);
        }}
      />
    );
  }
  function CssNumericPopupRow({
    label: label,
    value: value,
    unit: unit,
    ownUnit: ownUnit,
    min: min2,
    max: max,
    steppers: steppers,
    disabled: disabled2,
    onChange: onChange,
  }: Dynamic): Dynamic {
    let { start: value2, live: value3 }: Dynamic = (0,
    runtime.useLiveStyleScrub)({
      value: Number.isFinite(value) ? value : 0,
      min: min2,
      max: max,
      disabled: disabled2,
      onScrub: (input?: Dynamic): Dynamic => onChange(Math.round(input)),
    });
    return (
      <runtime.PropertyRow
        label={label}
        labelProps={
          disabled2
            ? undefined
            : {
                onPointerDown: value2,
                className: "cursor-ew-resize touch-none",
              }
        }
      >
        <CssNumericPopupInput
          name={label}
          unit={unit}
          ownUnit={ownUnit}
          value={value}
          shown={value3 != null ? Math.round(value3) : null}
          min={min2}
          max={max}
          steppers={steppers}
          disabled={disabled2}
          onChange={onChange}
        />
      </runtime.PropertyRow>
    );
  }
  function useBackgroundEditor({
    value: value,
    companionValue: companionValue,
    companionAuthored: companionAuthored,
    valueAuthored: valueAuthored,
    varPartial: varPartial,
    companionVarPartial: companionVarPartial,
    fallback: fallback,
    disabled: disabled2,
    mixed: mixed,
    inherited: inherited,
    noImageReason: noImageReason,
    textFill: textFill,
    varSource: varSource,
    writer: writer,
    open: open,
    tokens: tokens2,
    definedVars: definedVars,
  }: Dynamic): Dynamic {
    let commit: Dynamic = writer.commit,
      [value2, value3]: Dynamic = (0,
      runtime.reactPropertiesAssetPicker_3.useState)(0),
      [value4, value5]: Dynamic = (0,
      runtime.reactPropertiesAssetPicker_3.useState)(null),
      value6: Dynamic = textFill !== undefined,
      value7: Dynamic = value6
        ? textFill.clipped
          ? (textFill.layer ?? textFill.computedLayer ?? "")
          : ""
        : (value ?? ""),
      value8: Dynamic = value6 ? (value ?? "") : (companionValue ?? ""),
      value9: Dynamic = (0, runtime.parseCssGradient)(value7),
      value10: Dynamic =
        /url\("((?:[^"\\]|\\.)*)"\)/
          .exec(value7)?.[1]
          ?.replace(/\\(.)/g, "$1") ??
        /url\((['"]?)([^'")]+)\1\)/.exec(value7)?.[2] ??
        null,
      value11: Dynamic = value7;
    for (
      let index: Dynamic = 0;
      index < 8 && /\([^()]*\)/.test(value11);
      index++
    )
      value11 = value11.replace(/[\w-]*\([^()]*\)/g, "");
    let value12: Dynamic =
        /\/\s*([^;,]+?)(?:\s+(?:no-repeat|repeat|repeat-[xy]|space|round)\b)?\s*(?:,|$)/i
          .exec(value11)?.[1]
          ?.trim(),
      value13: Dynamic =
        (value6 ? textFill.size?.trim().toLowerCase() : undefined) ??
        value12?.toLowerCase() ??
        (value6 ? "cover" : "auto"),
      value14: Dynamic = /^(cover|contain|auto)$/i.test(value13)
        ? value13
        : null,
      value15: Dynamic = value10
        ? "image"
        : value9
          ? "gradient"
          : value7 || value8
            ? "color"
            : "none",
      [value16, value17]: Dynamic = (0,
      runtime.reactPropertiesAssetPicker_3.useState)(value15);
    value16 !== value15 &&
      (value17(value15), value4 !== null && value4 !== "image" && value5(null));
    let value18: Dynamic = value4 ?? value15,
      value19: Dynamic = value6
        ? value8
        : value8 || (value9 ? "" : value7) || "",
      value20: Dynamic = (0, runtime.reactPropertiesAssetPicker_3.useRef)(null);
    open && value9 && (value20.current = value9);
    let value21: Dynamic = (0, runtime.reactPropertiesAssetPicker_3.useRef)({}),
      value22: Dynamic = (0, runtime.useStyleCommitScrub)(
        (input?: Dynamic): Dynamic => {
          value9 &&
            callback4({
              ...value9,
              angle: input,
            });
        },
      ),
      value23: Dynamic =
        fallback &&
        fallback !== "rgba(0, 0, 0, 0)" &&
        fallback !== "transparent" &&
        (0, runtime.classifyStyleValue)(fallback).kind === "literal"
          ? fallback
          : undefined,
      kind: Dynamic = (0, runtime.classifyStyleValue)(value19).kind,
      value24: Dynamic =
        kind === "literal"
          ? value19
          : (0, runtime.resolveColorTokenValue)(value19, tokens2),
      value25: Dynamic = mixed
        ? undefined
        : value9
          ? (0, runtime.serializeCssGradient)(value9)
          : value10
            ? undefined
            : (value24 ??
              (value18 === "none" || (value18 === "color" && kind !== "literal")
                ? value23
                : undefined)),
      value26: Dynamic = mixed
        ? "Mixed"
        : value18 === "none"
          ? value23
            ? (0, runtime.describeColorValue)(value23)
            : "None"
          : value18 === "gradient"
            ? value9?.radial
              ? "Radial"
              : "Linear"
            : value18 === "image"
              ? "Image"
              : (0, runtime.describeColorValue)(value19),
      value27: Dynamic = value6
        ? (varSource ?? valueAuthored)
        : value8
          ? companionAuthored
          : valueAuthored,
      value28: Dynamic = mixed
        ? undefined
        : value18 === "color"
          ? (((value6 || !value8 ? varPartial : companionVarPartial) === true
              ? undefined
              : value27) ?? value19)
          : value18 === "none"
            ? ((varPartial === true ? undefined : varSource) ?? value23)
            : undefined,
      value29: Dynamic = (0, runtime.reactPropertiesAssetPicker_3.useMemo)(
        (): Dynamic =>
          (0, runtime.matchArtboardColorToken)(value28, tokens2, definedVars),
        [value28, tokens2, definedVars],
      ),
      { main: value30, alphaPct: value31 }: Dynamic = (0,
      runtime.splitColorAlpha)(value29 ?? value26),
      value32: Dynamic =
        value6 && textFill.transparentInk !== undefined
          ? [
              {
                prop: "color",
                value: textFill.transparentInk === "inline" ? null : "inherit",
              },
            ]
          : [],
      value33: Dynamic =
        !value6 || !textFill.clipped
          ? []
          : [
              {
                prop: "background",
                value:
                  textFill.inlineClip && textFill.layer !== null
                    ? null
                    : "none",
              },
              ...runtime.InspectorPropertySchemaItems.map(
                (input?: Dynamic): Dynamic => ({
                  prop: input,
                  value:
                    input === "-webkit-text-fill-color" && !textFill.inlineClip
                      ? "currentcolor"
                      : null,
                }),
              ),
              ...value32,
            ],
      callback: Dynamic = (input?: Dynamic): Dynamic =>
        value6
          ? [
              ...value33.filter(
                (input2?: Dynamic): Dynamic => input2.prop !== "color",
              ),
              {
                prop: "color",
                value: input || null,
              },
            ]
          : [
              {
                prop: "background-color",
                value: input || null,
              },
              {
                prop: "background",
                value: null,
              },
            ],
      callback2: Dynamic = (input?: Dynamic): Dynamic =>
        commit(callback(input)),
      callback3: Dynamic = (input?: Dynamic): Dynamic =>
        value6
          ? [
              {
                prop: "background-image",
                value: (0, runtime.serializeCssGradient)(input),
              },
              {
                prop: "background-size",
                value: null,
              },
              {
                prop: "background-position",
                value: null,
              },
              {
                prop: "background-repeat",
                value: null,
              },
              ...runtime.CssGradientsItems,
            ]
          : [
              {
                prop: "background",
                value: (0, runtime.serializeCssGradient)(input),
              },
              {
                prop: "background-color",
                value: null,
              },
            ],
      callback4: Dynamic = (input?: Dynamic): Dynamic =>
        commit(callback3(input)),
      callback5: Dynamic = (input?: Dynamic): Dynamic =>
        /^https?:/i.test(input)
          ? `url("${(0, runtime.escapeCssUrl)(input)}")`
          : `url("${input.replace(/["\\]/g, "\\$&")}")`,
      callback6: Dynamic = (input?: Dynamic, options?: Dynamic): Dynamic =>
        commit(
          value6
            ? input
              ? [
                  {
                    prop: "background-image",
                    value: callback5(input),
                  },
                  {
                    prop: "background-size",
                    value: options,
                  },
                  {
                    prop: "background-position",
                    value: "center",
                  },
                  {
                    prop: "background-repeat",
                    value: "no-repeat",
                  },
                  ...runtime.CssGradientsItems,
                ]
              : value33
            : [
                {
                  prop: "background",
                  value: input
                    ? `${callback5(input)} center / ${options} no-repeat`
                    : null,
                },
                {
                  prop: "background-color",
                  value: null,
                },
              ],
        ),
      callback7: Dynamic = (input?: Dynamic): Dynamic => {
        if (input === value18) return;
        value5(input);
        let callback9: Dynamic = (input2?: Dynamic): Dynamic =>
          !!input2 &&
          (0, runtime.classifyStyleValue)(input2).kind === "literal" &&
          !/url\(/i.test(input2);
        if (input === "color" && value6) {
          textFill.clipped && commit(value33);
          return;
        }
        if (input === "color") {
          if (value8 || (value7 && !value9 && !value10)) {
            (value9 || value10) &&
              commit([
                {
                  prop: "background",
                  value: null,
                },
              ]);
            return;
          }
          let value37: Dynamic = value9?.stops[0]
              ?.replace(/(\s+-?[\d.]+[a-z%]*)+$/i, "")
              .trim(),
            value38: Dynamic =
              value37 &&
              (!/\s/.test(value37) || /^[a-z-]+\([^)]*\)$/i.test(value37))
                ? value37
                : undefined;
          callback2(callback9(value38) ? value38 : "#cccccc");
        } else if (input === "image") value3(0);
        else {
          let current: Dynamic = value20.current,
            callback10: Dynamic = (input2?: Dynamic): Dynamic =>
              callback9(input2) && (0, runtime.parseHsvaColor)(input2).a > 0,
            value37: Dynamic = callback10(value24)
              ? value24
              : value6 && callback10(value23)
                ? (0, runtime.describeColorValue)(value23).toLowerCase()
                : "#c1672a",
            value38: Dynamic = value6
              ? (0, runtime.contrastingGradientSeed)(value37)
              : "#28211a",
            value39: Dynamic = current ?? {
              angle: 180,
              stops: [value37, value38],
            };
          value3(0);
          if (
            (value6 || !value8) &&
            value9 &&
            (0, runtime.serializeCssGradient)(value9) ===
              (0, runtime.serializeCssGradient)(value39)
          )
            return;
          callback4(value39);
        }
      },
      value34: Dynamic = value9 ? Math.min(value2, value9.stops.length - 1) : 0,
      value35: Dynamic = value18 === "none" ? "color" : value18,
      callback8: Dynamic = (): Dynamic => {
        value5(null);
        value20.current = null;
        value21.current = {};
      },
      value36: Dynamic =
        value35 === "image" ? (
          <runtime.jsxPropertiesAssetPicker_3.Fragment>
            <runtime.ImageAssetPicker
              value={value10}
              disabled={disabled2}
              previewSize={value14 ?? "cover"}
              onChange={(input?: Dynamic): Dynamic =>
                callback6(input, value10 ? value13 : "cover")
              }
            />
            <runtime.PropertyRow
              label={"Size"}
              title={value10 ? undefined : "Pick an image first"}
            >
              <runtime.PropertySelect
                aria-label={"Image size"}
                data-testid={"dc-fill-image-size"}
                items={[
                  {
                    value: "cover",
                    label: "Cover",
                  },
                  {
                    value: "contain",
                    label: "Contain",
                  },
                  {
                    value: "auto",
                    label: "Original",
                  },
                ]}
                value={value10 ? value14 : null}
                placeholder={value10 ? value13 : "Cover"}
                disabled={disabled2 || !value10}
                onChange={(input?: Dynamic): Dynamic => {
                  !value10 || input === value14 || callback6(value10, input);
                }}
              />
            </runtime.PropertyRow>
          </runtime.jsxPropertiesAssetPicker_3.Fragment>
        ) : value35 === "gradient" && value9 ? (
          ((): Dynamic => {
            let callback9: Dynamic = (input?: Dynamic): Dynamic =>
                input && /^var\(/i.test(input)
                  ? (0, runtime.resolveColorTokenValue)(input, tokens2)
                  : input,
              value37: Dynamic = value9.stops
                .map(runtime.parseCssGradientStop)
                .map((input?: Dynamic): Dynamic => {
                  let value38: Dynamic = callback9(input.swatch ?? input.color),
                    value39: Dynamic =
                      value38 !== undefined && value38 !== input.color
                        ? {
                            ...input,
                            swatch: value38,
                          }
                        : input;
                  return input.opaque
                    ? {
                        ...value39,
                        locked: true,
                        ...(runtime.PropertiesAssetPickerPattern.test(
                          input.raw ?? "",
                        )
                          ? {
                              hint: true,
                            }
                          : {}),
                      }
                    : value39;
                }),
              callback10: Dynamic = (input?: Dynamic): Dynamic => ({
                ...value9,
                stops: input.map(runtime.serializeCssGradientStop),
              }),
              callback11: Dynamic = (input?: Dynamic): Dynamic =>
                callback4(callback10(input)),
              live: Dynamic = writer.live,
              callback12: Dynamic = (
                input?: Dynamic,
                options?: Dynamic,
              ): Dynamic =>
                value37.map(
                  (input2?: Dynamic, options2?: Dynamic): Dynamic =>
                    options2 !== input
                      ? input2
                      : input2.opaque
                        ? {
                            color: options,
                            pos:
                              input2.pos ??
                              (0, runtime.normalizedGradientStops)(value37)[
                                input
                              ],
                          }
                        : {
                            ...input2,
                            color: options,
                            swatch: undefined,
                          },
                );
            return (
              <runtime.GradientEditor
                testid={"dc-fill-gradient"}
                radial={value9.radial === true}
                onRadial={(input?: Dynamic): Dynamic => {
                  let current: Dynamic = value21.current;
                  if (input) {
                    current.angle = value9.angle;
                    callback4({
                      ...value9,
                      radial: true,
                      ...(current.shape !== undefined
                        ? {
                            shape: current.shape,
                          }
                        : {}),
                    });
                  } else {
                    value9.shape !== undefined &&
                      (current.shape = value9.shape);
                    let { shape: value38, ...value39 }: Dynamic = value9;
                    callback4({
                      ...value39,
                      radial: false,
                      angle: current.angle ?? value9.angle,
                    });
                  }
                }}
                angle={value9.angle}
                onAngle={(input?: Dynamic): Dynamic =>
                  callback4({
                    ...value9,
                    angle: input ?? 180,
                  })
                }
                onAngleScrub={
                  live
                    ? (input?: Dynamic): Dynamic =>
                        live(
                          callback3({
                            ...value9,
                            angle: input,
                          }),
                        )
                    : value22.onScrub
                }
                onAngleScrubEnd={
                  live ? (): Dynamic => writer.settle?.() : value22.onScrubEnd
                }
                stops={value37}
                selected={value34}
                onSelect={value3}
                onStops={(input?: Dynamic): Dynamic => callback11(input)}
                {...(live
                  ? {
                      onStopsLive: (input?: Dynamic): Dynamic =>
                        live(callback3(callback10(input))),
                      onLiveEnd: (): Dynamic => writer.settle?.(),
                    }
                  : {})}
                maxStops={8}
                disabled={disabled2}
                renderStopPicker={(input?: Dynamic): Dynamic => (
                  <AuthoredColorPicker
                    value={
                      value37[input]?.swatch ?? value37[input]?.color ?? ""
                    }
                    disabled={disabled2}
                    plain={true}
                    onChange={(input2?: Dynamic): Dynamic =>
                      live
                        ? live(callback3(callback10(callback12(input, input2))))
                        : callback11(callback12(input, input2))
                    }
                    {...(live
                      ? {
                          onPickEnd: (input2?: Dynamic): Dynamic => {
                            writer.settle?.();
                            callback11(callback12(input, input2));
                          },
                        }
                      : {})}
                  />
                )}
              />
            );
          })()
        ) : null;
    return {
      mode: value18,
      tab: value35,
      kind: {
        value: value35,
        options: [
          {
            value: "color",
            label: "Color",
          },
          {
            value: "gradient",
            label: "Gradient",
          },
          {
            value: "image",
            label: "Image",
            ...(noImageReason !== undefined
              ? {
                  disabledReason: noImageReason,
                }
              : {}),
          },
        ],
        onChange: (input?: Dynamic): Dynamic => callback7(input),
        disabled: disabled2,
      },
      face: value36,
      solid: value19,
      solidCss: value24,
      solidAuthored:
        value27 ?? (value18 === "none" || kind === "var" ? value28 : undefined),
      fallbackColor: value23,
      setSolid: (input?: Dynamic, options: Dynamic = false): Dynamic => {
        options && value5(null);
        callback2(input);
      },
      solidEdits: callback,
      imageUrl: value10,
      previewCss: value25,
      summary: value29 ?? value26,
      summaryMain: value30,
      summaryAlpha: value31,
      endSession: callback8,
    };
  }
  function PropertyBackgroundRow({
    label: label,
    onCommitMany: onCommitMany,
    testId: testId,
    contrast: contrast,
    ...props
  }: Dynamic): Dynamic {
    let [value, value2]: Dynamic = (0,
      runtime.reactPropertiesAssetPicker_3.useState)(false),
      {
        dsColorTokens: value3,
        iframeDefinedVars: value4,
        editsAreUndoSteps: value5,
      }: Dynamic = (0, runtime.useInspectorContext)(),
      value6: Dynamic = useBackgroundEditor({
        ...props,
        writer: {
          commit: onCommitMany,
        },
        open: value,
        tokens: value3,
        definedVars: value4,
      }),
      { disabled: value7, mixed: value8 }: Dynamic = props,
      value9: Dynamic = value3.length > 0,
      [value10, value11]: Dynamic = (0,
      runtime.reactPropertiesAssetPicker_3.useState)("system"),
      value12: Dynamic = value9 && value10 === "system";
    return (
      <runtime.PropertyAssetPopup
        open={value}
        onOpenChange={(input?: Dynamic): Dynamic => {
          value2(input);
          input
            ? value11(
                value9 && (value6.mode === "color" || value6.mode === "none")
                  ? "system"
                  : "custom",
              )
            : value6.endSession();
        }}
        title={label}
        header={
          value9 ? (
            <runtime.ColorHexInput
              value={value10}
              onChange={value11}
              className={""}
            />
          ) : undefined
        }
        planHeight={runtime.ColorPickerConstant}
        editsAreUndoSteps={value5}
        data-testid={"dc-fill-popover"}
        trigger={
          <PropertySelectTrigger
            aria-label={`${label}: ${value8 ? "Mixed" : value6.summary}`}
            disabled={value7}
            data-testid={testId}
            chip={
              value6.imageUrl && !value8 ? (
                <runtime.AssetColorWell src={value6.imageUrl} />
              ) : (
                <CssColorWell css={value6.previewCss} />
              )
            }
            muted={value8}
            caption={value6.summaryAlpha}
          >
            {value6.summaryMain}
          </PropertySelectTrigger>
        }
      >
        <div
          className={(0, runtime.cn)(
            value9 ? "px-4" : "px-lg",
            "[--pp-edge:0px]",
          )}
        >
          <AuthoredColorPicker
            value={
              value12 && value6.mode !== "color" ? "" : (value6.solidCss ?? "")
            }
            authoredValue={
              value6.mode === "gradient" || value6.mode === "image"
                ? undefined
                : value6.solidAuthored
            }
            seed={value6.fallbackColor}
            onChange={(input?: Dynamic): Dynamic =>
              value6.setSolid(input, value12)
            }
            disabled={value7}
            tab={value9 ? value10 : undefined}
            headless={true}
            kind={value6.kind}
            face={value6.face}
            contrast={
              value6.mode === "color" || value6.mode === "none"
                ? contrast
                : undefined
            }
          />
        </div>
      </runtime.PropertyAssetPopup>
    );
  }
  bindRuntimeValue(
    runtime,
    "PropertySelectTrigger",
    () => PropertySelectTrigger,
  );
  bindRuntimeValue(runtime, "CssColorWell", () => CssColorWell);
  bindRuntimeValue(
    runtime,
    "PropertiesBackgroundEditorItems",
    () => PropertiesBackgroundEditorItems,
    (value) => {
      PropertiesBackgroundEditorItems = value;
    },
  );
  bindRuntimeValue(runtime, "AuthoredColorPicker", () => AuthoredColorPicker);
  bindRuntimeValue(runtime, "CssNumericPopupInput", () => CssNumericPopupInput);
  bindRuntimeValue(runtime, "CssNumericPopupRow", () => CssNumericPopupRow);
  bindRuntimeValue(runtime, "useBackgroundEditor", () => useBackgroundEditor);
  bindRuntimeValue(
    runtime,
    "PropertyBackgroundRow",
    () => PropertyBackgroundRow,
  );
  return () => {
    PropertiesBackgroundEditorItems = [];
  };
}
