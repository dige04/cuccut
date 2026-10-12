/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";
export function installPropertiesQuickPanelBindings(
  runtime: RuntimeBindings,
): () => void {
  var react_mEt: Dynamic;
  var jsx_il: Dynamic;
  var cssBoxSides: Dynamic;
  var parseQuickPanelColor: Dynamic;
  var inlineImageUrl: Dynamic;
  var radiusCssProperties: Dynamic;
  var parseOptionalPixelValue: Dynamic;
  var serializeOptionalPixelValue: Dynamic;
  var designSwatchCssVariable: Dynamic;
  var editListToStylePairs: Dynamic;
  var unsupportedQuickPanelValueMessage: Dynamic;
  var areStyleEditsSupported: Dynamic;
  var quickPanelStyleIo: Dynamic;
  var emptyQuickPanelStyleEdits: Dynamic;
  function readBorderSideWidths(styles?: Dynamic): Dynamic {
    let value: Dynamic = parseOptionalPixelValue(styles.get("border-width")),
      callback: Dynamic = (input?: Dynamic): Dynamic =>
        parseOptionalPixelValue(styles.get("border-" + input + "-width")) ??
        value;
    return {
      top: callback("top"),
      right: callback("right"),
      bottom: callback("bottom"),
      left: callback("left"),
    };
  }
  function uniformNonzeroBorderWidth(widths?: Dynamic): Dynamic {
    let value: Dynamic = cssBoxSides
      .map((input?: Dynamic): Dynamic => widths[input])
      .filter((input?: Dynamic): Dynamic => input !== undefined && input > 0);
    if (value.length !== 0)
      return value.every((input?: Dynamic): Dynamic => input === value[0])
        ? value[0]
        : undefined;
  }
  function activeBorderSides(widths?: Dynamic): Dynamic {
    let value: Dynamic = cssBoxSides.filter(
      (input?: Dynamic): Dynamic => (widths[input] ?? 0) > 0,
    );
    return value.length === 0 || value.length === 4 ? undefined : value;
  }
  function sideStyleChanges(prefix?: Dynamic, sides?: Dynamic): Dynamic {
    return cssBoxSides
      .filter((input?: Dynamic): Dynamic => input in sides)
      .map(
        (input?: Dynamic): Dynamic => [
          prefix + "-" + input,
          serializeOptionalPixelValue(sides[input]),
        ],
      );
  }
  function matchingDesignSwatchName(
    swatches?: Dynamic,
    value?: Dynamic,
    definedVariables?: Dynamic,
  ): Dynamic {
    if (value === undefined) return null;
    let value2: Dynamic = (0, runtime.cssVariableName)(value.trim());
    if (value2 !== null)
      return (
        swatches.find(
          (input?: Dynamic): Dynamic =>
            designSwatchCssVariable(input.name) === value2,
        )?.name ?? null
      );
    let value3: Dynamic = swatches.find(
      (input?: Dynamic): Dynamic =>
        !input.empty &&
        !(
          definedVariables?.has(
            designSwatchCssVariable(input.picks ?? input.name) ?? "",
          ) ?? false
        ) &&
        (0, runtime.samePaint)(input.color, value),
    );
    return value3 === undefined ? null : (value3.picks ?? value3.name);
  }
  function valueForDesignSwatch(
    swatches?: Dynamic,
    swatchName?: Dynamic,
    definedVariables?: Dynamic,
  ): Dynamic {
    let value: Dynamic = swatches.find(
      (input?: Dynamic): Dynamic => input.name === swatchName,
    );
    if (value === undefined) return;
    let value2: Dynamic = designSwatchCssVariable(value.name);
    return value2 === undefined ||
      definedVariables?.has(value2) !== true ||
      swatches.some(
        (input?: Dynamic): Dynamic =>
          input !== value &&
          designSwatchCssVariable(input.name) === value2 &&
          !(0, runtime.samePaint)(input.color, value.color),
      )
      ? value.color
      : "var(" + value2 + ")";
  }
  function BackgroundQuickPanel({
    io: io,
    swatches: swatches,
    defined: defined,
    faces = true,
    testid = "mega-qp-bg",
    editsAreUndoSteps: editsAreUndoSteps,
  }: Dynamic): Dynamic {
    let entry: Dynamic = io.get("background-color"),
      [value, value2]: Dynamic = (0, react_mEt.useState)(false),
      value3: Dynamic = (0, runtime.useBackgroundEditor)({
        value: io.get("background") ?? null,
        companionValue: entry ?? null,
        fallback: io.rendered?.background ?? undefined,
        writer: quickPanelStyleIo(io),
        open: value,
        tokens: emptyQuickPanelStyleEdits,
      }),
      value4: Dynamic =
        value3.mode === "gradient"
          ? value3.previewCss
          : (parseQuickPanelColor(entry) ??
            parseQuickPanelColor(io.rendered?.background));
    return (
      <runtime.SessionActionsPopover
        testid={testid}
        editsAreUndoSteps={editsAreUndoSteps}
        title={"Background color"}
        paint={value4}
        swatches={[
          {
            name: "none",
            label: "No fill",
            color: "transparent",
            empty: true,
          },
          ...swatches,
        ]}
        value={
          (value3.mode !== "color" && value3.mode !== "none") ||
          entry === undefined
            ? null
            : entry === "transparent"
              ? "none"
              : matchingDesignSwatchName(swatches, entry, defined)
        }
        onSwatch={(input?: Dynamic): Dynamic => {
          let value5: Dynamic =
            input === "none"
              ? "transparent"
              : valueForDesignSwatch(swatches, input, defined);
          value5 !== undefined &&
            io.set(editListToStylePairs(value3.solidEdits(value5)));
        }}
        custom={{
          seed:
            parseQuickPanelColor(value3.solid) ??
            parseQuickPanelColor(entry) ??
            parseQuickPanelColor(io.rendered?.background) ??
            "#FFFFFF",
          unset: !value3.solid,
          onChange: (input?: Dynamic): Dynamic =>
            io.set(editListToStylePairs(value3.solidEdits(input)), true),
          onPickEnd: (): Dynamic => io.settle(),
        }}
        {...(faces
          ? {
              kind: value3.kind,
              face: value3.face,
            }
          : {})}
        onOpenChange={(input?: Dynamic): Dynamic => {
          value2(input);
          input || value3.endSession();
        }}
      />
    );
  }
  function CornerRadiusQuickPanel({ io: io }: Dynamic): Dynamic {
    let state: Dynamic = {
        tl: parseOptionalPixelValue(io.get(radiusCssProperties.tl)),
        tr: parseOptionalPixelValue(io.get(radiusCssProperties.tr)),
        br: parseOptionalPixelValue(io.get(radiusCssProperties.br)),
        bl: parseOptionalPixelValue(io.get(radiusCssProperties.bl)),
      },
      callback: Dynamic = (input?: Dynamic, options?: Dynamic): Dynamic =>
        io.set(
          Object.keys(input).map(
            (input2?: Dynamic): Dynamic => [
              radiusCssProperties[input2],
              serializeOptionalPixelValue(input[input2]),
            ],
          ),
          options,
        );
    return (
      <runtime.SessionPopup
        testid={"mega-qp-corner"}
        title={"Corner radius"}
        icon={runtime.PropertiesTooltipNameViewBoxPathsConfig_3}
      >
        <runtime.RadiusQuickPanel
          radius={parseOptionalPixelValue(io.get("border-radius"))}
          max={400}
          onChange={(input?: Dynamic): Dynamic =>
            io.set([
              ["border-radius", serializeOptionalPixelValue(input)],
              ...Object.values(radiusCssProperties).map(
                (input2?: Dynamic): Dynamic => [input2, undefined],
              ),
            ])
          }
          onLive={(input?: Dynamic): Dynamic =>
            io.set(
              [
                ["border-radius", serializeOptionalPixelValue(input)],
                ...Object.values(radiusCssProperties).map(
                  (input2?: Dynamic): Dynamic => [input2, undefined],
                ),
              ],
              true,
            )
          }
          onLiveEnd={io.settle}
          corners={{
            value: state,
            onChange: (input?: Dynamic): Dynamic => callback(input),
            onLive: (input?: Dynamic): Dynamic => callback(input, true),
            onLiveEnd: io.settle,
          }}
        />
      </runtime.SessionPopup>
    );
  }
  function CssBorderQuickPanel({
    io: io,
    swatches: swatches,
    defined: defined,
    compact: compact,
    faces: faces,
    editsAreUndoSteps: editsAreUndoSteps,
  }: Dynamic): Dynamic {
    let entry: Dynamic = io.get("border-style"),
      value: Dynamic =
        entry === "double"
          ? "solid"
          : /^(none|solid|dashed|dotted)$/.test(entry ?? "")
            ? entry
            : undefined,
      value2: Dynamic = value !== undefined && value !== "none",
      value3: Dynamic = readBorderSideWidths(io),
      callback: Dynamic = (input?: Dynamic): Dynamic =>
        (value3[input] ?? 0) > 0,
      value4: Dynamic = activeBorderSides(value3) !== undefined,
      text: Dynamic = "#141413",
      value5: Dynamic = parseQuickPanelColor(io.get("border-color")),
      value6: Dynamic = matchingDesignSwatchName(
        swatches,
        io.get("border-color"),
        defined,
      ),
      value7: Dynamic =
        value5 ??
        (value6 !== null
          ? parseQuickPanelColor(
              swatches.find((input?: Dynamic): Dynamic => input.name === value6)
                ?.color,
            )
          : undefined),
      callback2: Dynamic = (input?: Dynamic): Dynamic =>
        input && value5 !== undefined ? [["border-color", value5]] : [],
      callback3: Dynamic = (input?: Dynamic): Dynamic => [
        ...cssBoxSides.map(
          (input2?: Dynamic): Dynamic => [
            "border-" + input2 + "-width",
            serializeOptionalPixelValue(
              input2 in input ? (input[input2] ?? 0) : (value3[input2] ?? 0),
            ),
          ],
        ),
        ...(value2 ? [["border-style", value]] : []),
        ...callback2(
          cssBoxSides.some(
            (input2?: Dynamic): Dynamic =>
              (input[input2] ?? 0) > 0 && !callback(input2),
          ),
        ),
      ],
      state: Dynamic = {
        top: parseOptionalPixelValue(io.get("padding-top")),
        right: parseOptionalPixelValue(io.get("padding-right")),
        bottom: parseOptionalPixelValue(io.get("padding-bottom")),
        left: parseOptionalPixelValue(io.get("padding-left")),
      },
      state2: Dynamic = {
        top: parseOptionalPixelValue(io.get("margin-top")),
        right: parseOptionalPixelValue(io.get("margin-right")),
        bottom: parseOptionalPixelValue(io.get("margin-bottom")),
        left: parseOptionalPixelValue(io.get("margin-left")),
      };
    return (
      <jsx_il.Fragment>
        <runtime.SessionStripGroup wrap={true}>
          <BackgroundQuickPanel
            io={io}
            swatches={swatches}
            defined={defined}
            faces={faces}
            editsAreUndoSteps={editsAreUndoSteps}
          />
          <runtime.SessionPopup
            testid={"mega-qp-border"}
            title={"Border"}
            icon={runtime.PropertiesTooltipNameViewBoxPathsConfig}
            editsAreUndoSteps={editsAreUndoSteps}
          >
            <runtime.BorderQuickPanel
              style={value}
              width={uniformNonzeroBorderWidth(value3)}
              sides={activeBorderSides(value3)}
              color={
                <runtime.PropertyColorRow
                  testid={"mega-qp-border-color"}
                  editsAreUndoSteps={editsAreUndoSteps}
                  label={"Border color"}
                  title={"Border color"}
                  value={value7}
                  swatches={swatches}
                  fold={true}
                  current={value6}
                  onSwatch={(input?: Dynamic): Dynamic => {
                    let value8: Dynamic = valueForDesignSwatch(
                      swatches,
                      input,
                      defined,
                    );
                    value8 !== undefined && io.set([["border-color", value8]]);
                  }}
                  disabled={!value2}
                  disabledReason={"Pick a border style first"}
                  onChange={(input?: Dynamic): Dynamic => {
                    input !== undefined && io.set([["border-color", input]]);
                  }}
                  onLive={(input?: Dynamic): Dynamic =>
                    io.set([["border-color", input]], true)
                  }
                  onLiveEnd={io.settle}
                  keepFocus={true}
                  popover={runtime.quickPanelPopoverOptions}
                />
              }
              onChange={(input?: Dynamic): Dynamic => {
                if ("style" in input) {
                  input.style === undefined || input.style === "none"
                    ? io.set([["border-style", "none"]])
                    : io.set([
                        ["border-style", input.style],
                        ...(cssBoxSides.every(
                          (input2?: Dynamic): Dynamic => !callback(input2),
                        )
                          ? [["border-width", "1px"]]
                          : value4
                            ? cssBoxSides
                                .filter(
                                  (input2?: Dynamic): Dynamic =>
                                    !callback(input2),
                                )
                                .map(
                                  (input2?: Dynamic): Dynamic => [
                                    "border-" + input2 + "-width",
                                    "0px",
                                  ],
                                )
                            : []),
                        ...(io.get("border-color") === undefined
                          ? [["border-color", text]]
                          : []),
                      ]);
                  return;
                }
                "width" in input &&
                  io.set([
                    [
                      "border-width",
                      serializeOptionalPixelValue(input.width ?? 0),
                    ],
                    ...cssBoxSides.map(
                      (input2?: Dynamic): Dynamic => [
                        "border-" + input2 + "-width",
                        undefined,
                      ],
                    ),
                    ...callback2(value4 && (input.width ?? 0) > 0),
                  ]);
                "sides" in input &&
                  input.sides === undefined &&
                  io.set([
                    [
                      "border-width",
                      serializeOptionalPixelValue(
                        Math.max(
                          1,
                          ...cssBoxSides.map(
                            (input2?: Dynamic): Dynamic => value3[input2] ?? 0,
                          ),
                        ),
                      ),
                    ],
                    ...(value2 ? [["border-style", value]] : []),
                    ...cssBoxSides.map(
                      (input2?: Dynamic): Dynamic => [
                        "border-" + input2 + "-width",
                        undefined,
                      ],
                    ),
                    ...callback2(value4),
                  ]);
              }}
              onLive={(input?: Dynamic): Dynamic =>
                input.width !== undefined &&
                io.set(
                  [
                    ["border-width", serializeOptionalPixelValue(input.width)],
                    ...cssBoxSides.map(
                      (input2?: Dynamic): Dynamic => [
                        "border-" + input2 + "-width",
                        undefined,
                      ],
                    ),
                    ...callback2(value4 && input.width > 0),
                  ],
                  true,
                )
              }
              onLiveEnd={io.settle}
              widths={{
                value: value3,
                onChange: (input?: Dynamic): Dynamic =>
                  io.set(callback3(input)),
                onLive: (input?: Dynamic): Dynamic =>
                  io.set(callback3(input), true),
                onLiveEnd: io.settle,
              }}
              supports={{
                styles: ["none", "solid", "dashed", "dotted"],
                sides: true,
                widthMax: 32,
              }}
            />
          </runtime.SessionPopup>
        </runtime.SessionStripGroup>
        {compact ? null : <runtime.SessionStripDivider />}
        <runtime.SessionStripGroup wrap={true}>
          <CornerRadiusQuickPanel io={io} />
          <runtime.SessionPopup
            testid={"mega-qp-spacing"}
            title={"Spacing"}
            icon={runtime.PropertiesTooltipNameViewBoxPathsConfig_5}
          >
            <runtime.SpacingQuickPanel
              padding={state}
              max={400}
              onChange={(input?: Dynamic): Dynamic =>
                io.set(sideStyleChanges("padding", input))
              }
              onLive={(input?: Dynamic): Dynamic =>
                io.set(sideStyleChanges("padding", input), true)
              }
              onLiveEnd={io.settle}
              margin={{
                value: state2,
                max: 400,
                onChange: (input?: Dynamic): Dynamic =>
                  io.set(sideStyleChanges("margin", input)),
                onLive: (input?: Dynamic): Dynamic =>
                  io.set(sideStyleChanges("margin", input), true),
                onLiveEnd: io.settle,
              }}
            />
          </runtime.SessionPopup>
        </runtime.SessionStripGroup>
        {compact ? null : <runtime.SessionStripDivider />}
      </jsx_il.Fragment>
    );
  }
  function SvgPaintQuickPanel({
    io: io,
    swatches: swatches,
    defined: defined,
  }: Dynamic): Dynamic {
    let value: Dynamic = io.get("fill") ?? io.get("background-color"),
      entry: Dynamic = io.get("stroke"),
      entry2: Dynamic = io.get("stroke-dasharray"),
      value2: Dynamic = parseOptionalPixelValue(io.get("stroke-width")),
      value3: Dynamic =
        entry === undefined || entry === "none"
          ? undefined
          : entry2 === undefined || entry2 === "none"
            ? "solid"
            : /^[0-2](px)?[ ,]/.test(entry2)
              ? "dotted"
              : "dashed";
    return (
      <runtime.SessionStripGroup wrap={true}>
        <runtime.SessionActionsPopover
          testid={"mega-qp-fill"}
          title={"Fill color"}
          paint={
            parseQuickPanelColor(value) ??
            parseQuickPanelColor(io.rendered?.background)
          }
          swatches={[
            {
              name: "none",
              label: "No fill",
              color: "transparent",
              empty: true,
            },
            ...swatches,
          ]}
          value={
            value === undefined
              ? null
              : value === "none"
                ? "none"
                : matchingDesignSwatchName(swatches, value, defined)
          }
          onSwatch={(input?: Dynamic): Dynamic => {
            let value4: Dynamic =
              input === "none"
                ? "none"
                : valueForDesignSwatch(swatches, input, defined);
            value4 !== undefined && io.set([["fill", value4]]);
          }}
          custom={{
            seed:
              parseQuickPanelColor(value) ??
              parseQuickPanelColor(io.rendered?.background) ??
              "#d97757",
            unset: value === undefined,
            onChange: (input?: Dynamic): Dynamic =>
              io.set([["fill", input]], true),
            onPickEnd: (): Dynamic => io.settle(),
          }}
        />
        <runtime.SessionPopup
          testid={"mega-qp-stroke"}
          title={"Stroke"}
          icon={runtime.PropertiesTooltipNameViewBoxPathsConfig}
        >
          <runtime.BorderQuickPanel
            style={value3}
            width={value2}
            sides={undefined}
            color={
              <runtime.PropertyColorRow
                testid={"mega-qp-stroke-color"}
                label={"Stroke color"}
                title={"Stroke color"}
                value={
                  entry === "none"
                    ? undefined
                    : (parseQuickPanelColor(entry) ??
                      parseQuickPanelColor(
                        swatches.find(
                          (input?: Dynamic): Dynamic =>
                            input.name ===
                            matchingDesignSwatchName(swatches, entry, defined),
                        )?.color,
                      ) ??
                      parseQuickPanelColor(io.rendered?.stroke))
                }
                swatches={swatches}
                fold={true}
                current={
                  entry === "none"
                    ? null
                    : matchingDesignSwatchName(
                        swatches,
                        entry ?? io.rendered?.stroke ?? undefined,
                        defined,
                      )
                }
                onSwatch={(input?: Dynamic): Dynamic => {
                  let value4: Dynamic = valueForDesignSwatch(
                    swatches,
                    input,
                    defined,
                  );
                  value4 !== undefined && io.set([["stroke", value4]]);
                }}
                disabled={value3 === undefined}
                disabledReason={"Pick a stroke style first"}
                onChange={(input?: Dynamic): Dynamic => {
                  input !== undefined && io.set([["stroke", input]]);
                }}
                onLive={(input?: Dynamic): Dynamic =>
                  io.set([["stroke", input]], true)
                }
                onLiveEnd={io.settle}
                keepFocus={true}
                popover={runtime.quickPanelPopoverOptions}
              />
            }
            onChange={(input?: Dynamic): Dynamic => {
              "style" in input &&
                (input.style === undefined || input.style === "none"
                  ? io.set([["stroke", "none"]])
                  : io.set([
                      [
                        "stroke",
                        entry === undefined || entry === "none"
                          ? "#141413"
                          : entry,
                      ],
                      [
                        "stroke-dasharray",
                        input.style === "solid"
                          ? undefined
                          : input.style === "dashed"
                            ? "6 4"
                            : "1 3",
                      ],
                      ...(value2 === undefined
                        ? [["stroke-width", "2px"]]
                        : []),
                    ]));
              "width" in input &&
                io.set([
                  ["stroke-width", serializeOptionalPixelValue(input.width)],
                ]);
            }}
            onLive={(input?: Dynamic): Dynamic =>
              input.width !== undefined &&
              io.set(
                [["stroke-width", serializeOptionalPixelValue(input.width)]],
                true,
              )
            }
            onLiveEnd={io.settle}
            supports={{
              styles: ["none", "solid", "dashed", "dotted"],
              sides: "An SVG stroke outlines the whole shape",
              widthMax: 32,
            }}
          />
        </runtime.SessionPopup>
      </runtime.SessionStripGroup>
    );
  }
  function ImageQuickPanel({
    io: io,
    src: src,
    onReplace: onReplace,
    replaceReason: replaceReason,
    replaceTitle = "Replace image",
    ownAsset = false,
    onCrop: onCrop,
    cropping: cropping,
    cropReason: cropReason,
    noun = "image",
  }: Dynamic): Dynamic {
    return (
      <runtime.SessionStripGroup wrap={true}>
        <runtime.SessionImageReplaceButton
          src={ownAsset ? src : inlineImageUrl(src)}
          title={replaceReason ?? replaceTitle}
          onClick={onReplace}
          disabled={replaceReason !== undefined}
        />
        {onCrop && (
          <runtime.SessionStripButton
            data-testid={"mega-qp-crop"}
            data-media-crop-keep={""}
            icon={<runtime.PropertyOptionIcon icon={runtime.CropValue} />}
            title={
              cropReason ??
              (cropping
                ? "Done cropping (or press Enter)"
                : "Crop (or double-click the " + noun + ")")
            }
            aria-label={"Crop"}
            aria-pressed={cropping === true}
            onClick={onCrop}
            disabled={cropReason !== undefined}
          />
        )}
        <CornerRadiusQuickPanel io={io} />
      </runtime.SessionStripGroup>
    );
  }
  function LineStrokeQuickPanel({
    io: io,
    swatches: swatches,
    defined: defined,
  }: Dynamic): Dynamic {
    let value: Dynamic = io.get("stroke") ?? io.get("border-color");
    return (
      <runtime.SessionStripGroup>
        <runtime.SessionActionsPopover
          testid={"mega-qp-stroke-line"}
          title={"Stroke color"}
          paint={
            parseQuickPanelColor(value) ??
            parseQuickPanelColor(io.rendered?.stroke) ??
            "#141413"
          }
          swatches={swatches}
          value={matchingDesignSwatchName(swatches, value, defined)}
          onSwatch={(input?: Dynamic): Dynamic => {
            let value2: Dynamic = valueForDesignSwatch(
              swatches,
              input,
              defined,
            );
            value2 !== undefined &&
              io.set([
                ["stroke", value2],
                ["border-color", value2],
              ]);
          }}
          custom={{
            seed:
              parseQuickPanelColor(value) ??
              parseQuickPanelColor(io.rendered?.stroke) ??
              "#141413",
            onChange: (input?: Dynamic): Dynamic =>
              io.set(
                [
                  ["stroke", input],
                  ["border-color", input],
                ],
                true,
              ),
            onPickEnd: (): Dynamic => io.settle(),
          }}
        />
      </runtime.SessionStripGroup>
    );
  }
  bindRuntimeValue(
    runtime,
    "react_mEt",
    () => react_mEt,
    (value) => {
      react_mEt = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsx_il",
    () => jsx_il,
    (value) => {
      jsx_il = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "cssBoxSides",
    () => cssBoxSides,
    (value) => {
      cssBoxSides = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "parseQuickPanelColor",
    () => parseQuickPanelColor,
    (value) => {
      parseQuickPanelColor = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "inlineImageUrl",
    () => inlineImageUrl,
    (value) => {
      inlineImageUrl = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "radiusCssProperties",
    () => radiusCssProperties,
    (value) => {
      radiusCssProperties = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "parseOptionalPixelValue",
    () => parseOptionalPixelValue,
    (value) => {
      parseOptionalPixelValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "serializeOptionalPixelValue",
    () => serializeOptionalPixelValue,
    (value) => {
      serializeOptionalPixelValue = value;
    },
  );
  bindRuntimeValue(runtime, "readBorderSideWidths", () => readBorderSideWidths);
  bindRuntimeValue(
    runtime,
    "uniformNonzeroBorderWidth",
    () => uniformNonzeroBorderWidth,
  );
  bindRuntimeValue(runtime, "activeBorderSides", () => activeBorderSides);
  bindRuntimeValue(runtime, "sideStyleChanges", () => sideStyleChanges);
  bindRuntimeValue(
    runtime,
    "designSwatchCssVariable",
    () => designSwatchCssVariable,
    (value) => {
      designSwatchCssVariable = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "matchingDesignSwatchName",
    () => matchingDesignSwatchName,
  );
  bindRuntimeValue(runtime, "valueForDesignSwatch", () => valueForDesignSwatch);
  bindRuntimeValue(
    runtime,
    "editListToStylePairs",
    () => editListToStylePairs,
    (value) => {
      editListToStylePairs = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "unsupportedQuickPanelValueMessage",
    () => unsupportedQuickPanelValueMessage,
    (value) => {
      unsupportedQuickPanelValueMessage = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "areStyleEditsSupported",
    () => areStyleEditsSupported,
    (value) => {
      areStyleEditsSupported = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "quickPanelStyleIo",
    () => quickPanelStyleIo,
    (value) => {
      quickPanelStyleIo = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "emptyQuickPanelStyleEdits",
    () => emptyQuickPanelStyleEdits,
    (value) => {
      emptyQuickPanelStyleEdits = value;
    },
  );
  bindRuntimeValue(runtime, "BackgroundQuickPanel", () => BackgroundQuickPanel);
  bindRuntimeValue(
    runtime,
    "CornerRadiusQuickPanel",
    () => CornerRadiusQuickPanel,
  );
  bindRuntimeValue(runtime, "CssBorderQuickPanel", () => CssBorderQuickPanel);
  bindRuntimeValue(runtime, "SvgPaintQuickPanel", () => SvgPaintQuickPanel);
  bindRuntimeValue(runtime, "ImageQuickPanel", () => ImageQuickPanel);
  bindRuntimeValue(runtime, "LineStrokeQuickPanel", () => LineStrokeQuickPanel);
  return () => {
    react_mEt = (0, runtime.toModuleNamespace)((0, runtime.load_react)(), 1);
    jsx_il = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_jsx_runtime)(),
      1,
    );
    cssBoxSides = ["top", "right", "bottom", "left"];
    parseQuickPanelColor = (input?: Dynamic): Dynamic =>
      input == null
        ? undefined
        : ((0, runtime.normalizeHexColor)(input) ?? undefined);
    inlineImageUrl = (input?: Dynamic): Dynamic =>
      input !== undefined && /^(data:image\/|blob:)/i.test(input)
        ? input
        : undefined;
    radiusCssProperties = {
      tl: "border-top-left-radius",
      tr: "border-top-right-radius",
      br: "border-bottom-right-radius",
      bl: "border-bottom-left-radius",
    };
    parseOptionalPixelValue = (input?: Dynamic): Dynamic => {
      if (input === undefined) return;
      let value: Dynamic = /^\s*(-?\d+(?:\.\d+)?)(?:px)?\s*$/.exec(input);
      return value ? parseFloat(value[1]) : undefined;
    };
    serializeOptionalPixelValue = (input?: Dynamic): Dynamic =>
      input === undefined
        ? undefined
        : String(Math.round(input * 10) / 10) + "px";
    designSwatchCssVariable = (input?: Dynamic): Dynamic => {
      let value: Dynamic = /^ds:\d+:(.+)$/.exec(input)?.[1];
      return value === undefined ? undefined : "--" + value;
    };
    editListToStylePairs = (input?: Dynamic): Dynamic =>
      input.map(
        (input2?: Dynamic): Dynamic => [input2.prop, input2.value ?? undefined],
      );
    unsupportedQuickPanelValueMessage =
      "That value can\u2019t be set from this menu. Set it in Properties.";
    areStyleEditsSupported = (items?: Dynamic): Dynamic =>
      (0, runtime.normalizeStyleEdits)(
        items.map((input?: Dynamic): Dynamic => [input.prop, input.value]),
      ).length === items.length;
    quickPanelStyleIo = (io?: Dynamic): Dynamic => ({
      commit: (input?: Dynamic): Dynamic => {
        areStyleEditsSupported(input)
          ? io.set(editListToStylePairs(input))
          : (0, runtime.showEditorToast)(unsupportedQuickPanelValueMessage);
      },
      live: (input?: Dynamic): Dynamic => {
        areStyleEditsSupported(input) &&
          io.set(editListToStylePairs(input), true);
      },
      settle: (): Dynamic => io.settle(),
    });
    emptyQuickPanelStyleEdits = [];
  };
}
