/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";
export function installPropertiesSelectionQuickActions(
  runtime: RuntimeBindings,
): () => void {
  var react_Gw: Dynamic;
  var jsx_Ki: Dynamic;
  var emptySelectionPropertyItems: Dynamic;
  var defaultQuickActionInk: Dynamic;
  var literalQuickActionColorPattern: Dynamic;
  var textAlignmentValues: Dynamic;
  var parseQuickActionNumber: Dynamic;
  function propertySidebarActionState(
    sidebarVisible?: Dynamic,
    crossFile?: Dynamic,
  ): Dynamic {
    return sidebarVisible
      ? "hidden"
      : crossFile
        ? "disabled-with-reason"
        : "enabled";
  }
  function hasSelectionQuickActions(selection?: Dynamic): Dynamic {
    return selection.textEdit?.formats ||
      selection.crossFile ||
      selection.text > 0 ||
      selection.shape > 0 ||
      selection.line > 0 ||
      (selection.box ?? 0) > 0 ||
      (selection.image ?? 0) > 0 ||
      (selection.other ?? 0) > 0 ||
      selection.editDoor ||
      selection.commentDoor
      ? true
      : propertySidebarActionState(
          selection.sidebarVisible,
          selection.crossFile,
        ) !== "hidden";
  }
  function quickActionPaintAndSeed(
    explicitColor?: Dynamic,
    inheritedColor?: Dynamic,
    seed?: Dynamic,
  ): Dynamic {
    let value: Dynamic = explicitColor?.trim() ?? null,
      value2: Dynamic =
        value != null && literalQuickActionColorPattern.test(value)
          ? value
          : null,
      value3: Dynamic = value2 ?? inheritedColor;
    return value3 == null
      ? {
          paint: undefined,
          seed: seed,
        }
      : (0, runtime.parseHsvaColor)(value3).a === 0
        ? {
            paint: undefined,
            seed: value2 ?? seed,
          }
        : {
            paint: value3,
            seed: value3,
          };
  }
  function buildQuickActionSwatches(
    colors?: Dynamic,
    swatches?: Dynamic,
    tokens2?: Dynamic,
    themes?: Dynamic,
  ): Dynamic {
    if (!(0, runtime.hasDesignSystems)(themes))
      return (colors ?? []).map(
        (input?: Dynamic): Dynamic => ({
          name: input,
          color: input,
          label: input.startsWith("#") ? input.toUpperCase() : input,
        }),
      );
    let value: Dynamic = themes.flatMap(
        (input?: Dynamic, options?: Dynamic): Dynamic =>
          input.colors.map(
            (input2?: Dynamic): Dynamic => ({
              name: "ds:" + String(options) + ":" + input2.name,
              color: input2.value,
              label: input2.name,
              ...(0, runtime.colorTokenGroupLabels)(input, input2),
            }),
          ),
      ),
      value2: Dynamic = swatches ?? [];
    return (0, runtime.mergeDesignSystemSwatches)(
      value2.length > 0
        ? {
            label: tokens2
              ? runtime.ColorContrastCopyLabel_4
              : runtime.InThisArtboardMessage,
            colors: value2,
          }
        : undefined,
      value,
    );
  }
  function selectionHasVisiblePaint(style?: Dynamic): Dynamic {
    let value: Dynamic =
        style.textClip !== true &&
        style.bg !== undefined &&
        (0, runtime.normalizeHexColor)(style.bg) !== null,
      value2: Dynamic =
        style.borderWidth !== undefined &&
        style.borderWidth
          .trim()
          .split(/\s+/)
          .every(
            (input?: Dynamic): Dynamic => /^0+(?:\.0+)?[a-z%]*$/i.test(input),
          ),
      value3: Dynamic =
        style.borderStyle !== undefined &&
        style.borderStyle !== "none" &&
        !value2,
      value4: Dynamic =
        style.textClip !== true &&
        style.renderedBg != null &&
        (0, runtime.normalizeHexColor)(style.renderedBg) !== null;
    return value || value3 || value4;
  }
  function toggleUnderlineDecoration(decoration?: Dynamic): Dynamic {
    let value: Dynamic = decoration
        .split(/\s+/)
        .filter(
          (input?: Dynamic): Dynamic =>
            input === "line-through" || input === "overline",
        ),
      value2: Dynamic = decoration.includes("underline")
        ? value
        : ["underline", ...value];
    return value2.length > 0 ? value2.join(" ") : "none";
  }
  function SelectionQuickActions({
    text: text,
    shape: shape,
    box = 0,
    image = 0,
    other = 0,
    line: line,
    primaryTag = "",
    part: part,
    seed: seed,
    crossFile: crossFile,
    sidebarVisible: sidebarVisible,
    onOpenProps: onOpenProps,
    onEditText: onEditText,
    onApply: onApply,
    contrastRef: contrastRef,
    onGesture: onGesture,
    textEdit: textEdit,
    onFormat: onFormat,
    onComment: onComment,
    onReplaceImage: onReplaceImage,
    onCrop: onCrop,
    cropping: cropping,
    cropReason: cropReason,
    onReplaceVideo: onReplaceVideo,
    findVideo: findVideo,
    onElementLink: onElementLink,
    coarse = false,
    compact = false,
  }: Dynamic): Dynamic {
    let [value, value2]: Dynamic = (0, react_Gw.useState)({}),
      [value3, value4]: Dynamic = (0, react_Gw.useState)(seed?.epoch);
    value3 !== seed?.epoch &&
      (value4(seed?.epoch), Object.keys(value).length > 0 && value2({}));
    let value5: Dynamic = (0, react_Gw.useRef)(false),
      value6: Dynamic = (0, react_Gw.useRef)(false),
      [value7, value8]: Dynamic = (0, react_Gw.useState)(null),
      value9: Dynamic = textEdit?.formats != null;
    (0, react_Gw.useEffect)((): Dynamic => {
      if (value7 === null) return;
      if (value9) {
        onFormat(value7.verb);
        value8(null);
        return;
      }
      let value30: Dynamic = 1500 - (Date.now() - value7.at);
      if (value30 <= 0) return value8(null);
      let value31: Dynamic = (window as Dynamic).setTimeout(
        (): Dynamic => value8(null),
        value30,
      );
      return (): Dynamic => (window as Dynamic).clearTimeout(value31);
    }, [value7, value9, onFormat]);
    let callback: Dynamic = (input?: Dynamic): Dynamic => {
        onEditText &&
          (value8({
            verb: input,
            at: Date.now(),
          }),
          onEditText());
      },
      state: Dynamic = {
        get: (input?: Dynamic): Dynamic =>
          input in value
            ? value[input]
            : (seed?.more?.[input] ??
              (input === "background-color"
                ? seed?.background
                : input === "stroke"
                  ? seed?.stroke
                  : input === "color"
                    ? seed?.color
                    : undefined) ??
              (input === "fill" ? undefined : seed?.rendered?.box?.[input]) ??
              undefined),
        set: (input?: Dynamic, options?: Dynamic): Dynamic => {
          value2(
            (input2?: Dynamic): Dynamic => ({
              ...input2,
              ...Object.fromEntries(input),
            }),
          );
          options &&
            !value5.current &&
            ((value5.current = true), onGesture("start"));
          let value30: Dynamic = input.map(
            ([input2, input3]: Dynamic): Dynamic => [input2, input3 ?? null],
          );
          value30.length > 0 &&
            onApply(value30, {
              live: options,
            }).then((input2?: Dynamic): Dynamic => {
              !input2 &&
                !options &&
                value2((input3?: Dynamic): Dynamic => {
                  let state3: Dynamic = {
                    ...input3,
                  };
                  for (let [value31] of value30 as Dynamic)
                    delete state3[value31];
                  return state3;
                });
            });
        },
        settle: (): Dynamic => {
          value5.current && ((value5.current = false), onGesture("end"));
        },
        rendered: {
          background: seed?.rendered?.background ?? null,
          stroke: seed?.rendered?.stroke ?? null,
        },
      },
      value10: Dynamic = (0, runtime.useDesignSystems)();
    contrastRef && (contrastRef.current = undefined);
    let value11: Dynamic = (0, react_Gw.useMemo)(
        (): Dynamic =>
          buildQuickActionSwatches(
            seed?.colors,
            seed?.artboardColors,
            crossFile !== null,
            value10,
          ),
        [seed?.colors, seed?.artboardColors, crossFile !== null, value10],
      ),
      value12: Dynamic = crossFile ? undefined : seed?.definedVars,
      value13: Dynamic = (0, runtime.hasTextBackgroundClip)(
        (input?: Dynamic): Dynamic => state.get(input),
      ),
      value14: Dynamic = value13 || seed?.rendered?.textClip === true,
      value15: Dynamic = seed?.rendered?.color ?? null,
      [value16, value17]: Dynamic = (0, react_Gw.useState)(false),
      value18: Dynamic = (0, runtime.useBackgroundEditor)({
        value: state.get("color") ?? null,
        fallback: value15 ?? undefined,
        textFill: {
          clipped: value14,
          inlineClip: value13,
          layer:
            state.get("background-image") ?? state.get("background") ?? null,
          size: state.get("background-size") ?? null,
          ...((0, runtime.isTransparentColor)(
            (state.get("color") ?? "").trim().toLowerCase(),
          )
            ? {
                transparentInk: "inline",
              }
            : value15 !== null && (0, runtime.parseHsvaColor)(value15).a === 0
              ? {
                  transparentInk: "computed",
                }
              : {}),
        },
        writer: (0, runtime.quickPanelStyleIo)(state),
        open: value16,
        tokens: emptySelectionPropertyItems,
      }),
      value19: Dynamic =
        value14 &&
        !value13 &&
        state.get("background-image") === undefined &&
        state.get("background") === undefined,
      text2: Dynamic =
        "This text\u2019s fill comes from a stylesheet\u2014change it in Properties",
      state2: Dynamic = {
        kind: value19
          ? {
              ...value18.kind,
              options: value18.kind.options.map(
                (input?: Dynamic): Dynamic =>
                  input.value === "color"
                    ? input
                    : {
                        ...input,
                        disabledReason: text2,
                      },
              ),
            }
          : value18.kind,
        face: value18.face,
        onOpenChange: (input?: Dynamic): Dynamic => {
          value17(input);
          input || value18.endSession();
        },
      },
      value20: Dynamic = propertySidebarActionState(
        sidebarVisible,
        !!crossFile,
      ),
      value21: Dynamic = onComment
        ? (input?: Dynamic): Dynamic => onComment(input)
        : null,
      value22: Dynamic =
        value21 === null && value20 === "hidden" ? null : (
          <runtime.SessionStripGroup>
            {value21 !== null && (
              <runtime.SessionStripButton
                icon={"ChatAdd"}
                data-testid={"mega-sel-comment"}
                title={"Comment on this element"}
                aria-label={"Comment"}
                onClick={(input?: Dynamic): Dynamic =>
                  value21(input.currentTarget)
                }
              />
            )}
            {value20 !== "hidden" && (
              <runtime.SessionStripButton
                icon={"DotsVertical"}
                data-testid={"mega-sel-props"}
                title={
                  value20 === "disabled-with-reason"
                    ? "Properties edits one artboard at a time \u2014 narrow the selection"
                    : "Open the Properties panel"
                }
                aria-label={"Properties"}
                disabled={value20 === "disabled-with-reason"}
                onClick={(): Dynamic => {
                  crossFile || onOpenProps();
                }}
              />
            )}
          </runtime.SessionStripGroup>
        ),
      length: Dynamic = [
        text > 0,
        box > 0,
        shape > 0,
        image > 0,
        line > 0,
        other > 0,
      ].filter(Boolean).length,
      value23: Dynamic = text + box + shape + image + line + other > 1,
      value24: Dynamic = textEdit?.formats ?? null,
      value25: Dynamic = textEdit == null,
      value26: Dynamic = crossFile
        ? crossFile.elements +
          (crossFile.elements === 1 ? " element" : " elements") +
          (crossFile.artboards === 1
            ? ""
            : " on " + crossFile.artboards + " artboards") +
          (crossFile.objects > 0
            ? " and " +
              crossFile.objects +
              (crossFile.objects === 1 ? " canvas object" : " canvas objects")
            : "")
        : "",
      value27: Dynamic = crossFile ? (
        <runtime.SessionStripGroup>
          <runtime.SessionStripButton
            data-testid={"mega-sel-duplicate"}
            icon={"Copy"}
            title={
              "Duplicate " +
              value26 +
              " (" +
              (0, runtime.keyboardShortcutLabel)("D") +
              ")"
            }
            aria-label={"Duplicate"}
            onClick={crossFile.onDuplicate}
          />
          <runtime.SessionStripButton
            data-testid={"mega-sel-delete"}
            icon={"Trash"}
            title={"Delete " + value26}
            aria-label={"Delete"}
            onClick={crossFile.onDelete}
          />
        </runtime.SessionStripGroup>
      ) : null,
      value28: Dynamic =
        value27 !== null && value22 !== null && !compact ? (
          <runtime.SessionStripDivider />
        ) : null;
    if (other > 0 && !value23 && primaryTag === "video")
      return (
        <jsx_Ki.Fragment>
          {findVideo && (
            <runtime.SessionStripGroup>
              <runtime.VideoPlayControl find={findVideo} />
            </runtime.SessionStripGroup>
          )}
          <runtime.ImageQuickPanel
            io={state}
            src={undefined}
            onReplace={(): Dynamic => onReplaceVideo?.()}
            replaceTitle={"Replace video"}
            replaceReason={
              onReplaceVideo
                ? undefined
                : "This video can't be replaced from here."
            }
            onCrop={onCrop}
            cropping={cropping}
            cropReason={cropping ? undefined : cropReason}
            noun={"video"}
          />
          {compact || (value27 === null && value22 === null) ? null : (
            <runtime.SessionStripDivider />
          )}
          {value27}
          {value28}
          {value22}
        </jsx_Ki.Fragment>
      );
    if (!value24 && (length > 1 || (length === 1 && other > 0))) {
      let value30: Dynamic = quickActionPaintAndSeed(
        state.get("color") ?? null,
        seed?.rendered?.color ?? null,
        defaultQuickActionInk,
      );
      return (
        <jsx_Ki.Fragment>
          {text + box + shape + line > 0 &&
            ((): Dynamic => {
              let items: Dynamic = [
                  ...(text > 0 ? ["color"] : []),
                  ...(box > 0 || shape > 0 ? ["background-color", "fill"] : []),
                  ...(line > 0 ? ["stroke", "border-color"] : []),
                ],
                value31: Dynamic =
                  text > 0
                    ? value30
                    : quickActionPaintAndSeed(
                        state.get("background-color") ??
                          state.get("fill") ??
                          null,
                        seed?.rendered?.background ??
                          seed?.rendered?.stroke ??
                          null,
                        defaultQuickActionInk,
                      );
              return (
                <runtime.SessionStripGroup>
                  <runtime.SessionActionsPopover
                    testid={"mega-qp-color"}
                    title={"Color"}
                    paint={value31.paint}
                    swatches={value11}
                    value={null}
                    onSwatch={(input?: Dynamic): Dynamic => {
                      let value32: Dynamic = (0, runtime.valueForDesignSwatch)(
                        value11,
                        input,
                        value12,
                      );
                      value32 !== undefined &&
                        state.set(
                          items.map(
                            (input2?: Dynamic): Dynamic => [input2, value32],
                          ),
                        );
                    }}
                    custom={{
                      seed: value31.seed,
                      onChange: (input?: Dynamic): Dynamic =>
                        state.set(
                          items.map(
                            (input2?: Dynamic): Dynamic => [input2, input],
                          ),
                          true,
                        ),
                      onPickEnd: (): Dynamic => state.settle(),
                    }}
                  />
                </runtime.SessionStripGroup>
              );
            })()}
          {value27 !== null && !compact && text + box + shape + line > 0 ? (
            <runtime.SessionStripDivider />
          ) : null}
          {value27}
          {value28}
          {value22}
        </jsx_Ki.Fragment>
      );
    }
    if (value24 || text > 0) {
      let value30: Dynamic = value24 !== null,
        callback2: Dynamic = (input?: Dynamic): Dynamic => {
          let value62: Dynamic =
            input == null ? null : /^\s*(-?\d+(?:\.\d+)?)px\s*$/.exec(input);
          return value62 ? parseFloat(value62[1]) : undefined;
        },
        callback3: Dynamic = (input?: Dynamic): Dynamic => {
          let value62: Dynamic =
            input == null ? null : /^\s*(\d+(?:\.\d+)?)\s*$/.exec(input);
          return value62 ? parseFloat(value62[1]) : undefined;
        },
        value31: Dynamic =
          callback2(state.get("font-size")) ??
          callback2(seed?.fontSize) ??
          callback2(seed?.rendered?.fontSizePx),
        value32: Dynamic =
          state.get("font-weight") ?? seed?.rendered?.fontWeight ?? undefined,
        value33: Dynamic =
          value32 === "bold"
            ? 700
            : value32 === "normal"
              ? 400
              : parseQuickActionNumber(value32),
        value34: Dynamic = value33 ?? 400,
        value35: Dynamic =
          state.get("font-style") ?? seed?.rendered?.fontStyle ?? "normal",
        value36: Dynamic =
          state.get("text-decoration-line") ??
          seed?.rendered?.textDecoration ??
          "",
        value37: Dynamic =
          state.get("text-align") ?? seed?.rendered?.textAlign ?? "start",
        {
          sizes: value38,
          sizeNames: value39,
          sizeFamilies: value40,
        }: Dynamic = (0, runtime.typographyCensusOptions)({
          sizes: seed?.sizes ?? [],
          sizeRoles: seed?.sizeRoles,
          sizeFamilies: seed?.sizeFamilies,
        }),
        value41: Dynamic =
          state.get("font-family") ??
          seed?.fontFamily ??
          seed?.rendered?.fontFamily ??
          "",
        value42: Dynamic = runtime.InspectorComputedDataPattern.test(value41)
          ? value41
          : "",
        value43: Dynamic = value42 || (seed?.rendered?.fontFamily ?? ""),
        value44: Dynamic = /^(italic|oblique)/.test(value35),
        value45: Dynamic = (0, runtime.fontFamilyPickerOptions)(
          (seed?.fonts ?? []).filter(
            (input?: Dynamic): Dynamic =>
              runtime.InspectorComputedDataPattern.test(input),
          ),
        ),
        value46: Dynamic = value45.find(
          (input?: Dynamic): Dynamic =>
            input.value.toLowerCase() ===
            (0, runtime.displayFontFamily)(value42).toLowerCase(),
        ),
        value47: Dynamic =
          value46 || !value42
            ? value45
            : [
                {
                  value: value42,
                  label: (0, runtime.displayFontFamily)(value42),
                  labelStyle: {
                    fontFamily: value42,
                  },
                },
                ...value45,
              ],
        value48: Dynamic = quickActionPaintAndSeed(
          state.get("color") ?? null,
          seed?.rendered?.color ?? null,
          defaultQuickActionInk,
        ),
        value49: Dynamic = seed?.rendered?.ground,
        value50: Dynamic =
          value49 != null && !value23 && !value14
            ? (0, runtime.textContrastContext)(
                value49.behind,
                callback2(seed?.rendered?.fontSizePx) ?? value31 ?? null,
                parseQuickActionNumber(seed?.rendered?.fontWeight) ??
                  value33 ??
                  null,
              )
            : undefined;
      contrastRef &&
        value50 &&
        (contrastRef.current = {
          check: value50,
          resolve: (input?: Dynamic): Dynamic =>
            value11.find(
              (input2?: Dynamic): Dynamic =>
                input2.name ===
                (0, runtime.matchingDesignSwatchName)(value11, input, value12),
            )?.color ?? input,
        });
      let value51: Dynamic = textEdit != null && value24 === null,
        value52: Dynamic = seed?.list ?? "none",
        value53: Dynamic = value51
          ? "This text is bound to the script \u2014 formatting is off"
          : value23 && !value30
            ? "one text at a time"
            : !value30 && !onEditText
              ? "This text is not editable inline \u2014 select the text inside it"
              : null,
        value54: Dynamic =
          !value30 &&
          (seed?.fontSizes?.length ?? 0) > 1 &&
          new Set(seed.fontSizes).size > 1;
      selectionHasVisiblePaint({
        bg: state.get("background-color"),
        borderStyle: state.get("border-style"),
        borderWidth: state.get("border-width") ?? state.get("border-top-width"),
        renderedBg: seed?.rendered?.background ?? null,
        textClip: value14,
      }) && (value6.current = true);
      let current: Dynamic = value6.current,
        value55: Dynamic = value14
          ? (0, runtime.sanitizeCssBackground)(
              state.get("background-image") ?? state.get("background") ?? "",
            )
          : "transparent",
        value56: Dynamic = /gradient\(/.test(value55) ? value55 : undefined,
        value57: Dynamic = value14
          ? [
              [
                "background",
                value13 &&
                (state.get("background-image") !== undefined ||
                  state.get("background") !== undefined)
                  ? undefined
                  : "none",
              ],
              ...runtime.InspectorPropertySchemaItems.map(
                (input?: Dynamic): Dynamic => [
                  input,
                  input === "-webkit-text-fill-color" && !value13
                    ? "currentcolor"
                    : undefined,
                ],
              ),
            ]
          : [],
        callback4: Dynamic = (input?: Dynamic): Dynamic =>
          Math.round(input * 10) / 10,
        value58: Dynamic =
          state.get("font-family") ?? seed?.fontFamily ?? undefined,
        value59: Dynamic = (0, runtime.designSystemTypographyOptions)(value10),
        value60: Dynamic = (0, runtime.typographySessionModel)({
          metrics: (0, runtime.resolvedTypographyMetrics)(state, seed),
          sizeMixed: value54,
          ownFamily: value58,
          family: value42,
          sizes: value38,
          sizeNames: value39,
          sizeFamilies: value40,
          systemRows: value59,
          hasSystem: (0, runtime.hasDesignSystems)(value10),
          single: (seed?.fontSizes?.length ?? 1) <= 1,
        }),
        state3: Dynamic = {
          value: value60.value,
          chipText: value60.chipText,
          options: value60.options.map(
            (input?: Dynamic): Dynamic => ({
              value: input.value,
              text: input.text,
              label: (
                <span className={"min-w-0 truncate"} style={input.labelStyle}>
                  {input.text}
                </span>
              ),
              hint: input.hint,
              title: input.title,
              group: input.group,
              subgroup: input.subgroup,
            }),
          ),
          onChange: (input?: Dynamic): Dynamic =>
            state.set(value60.editsFor(input)),
          custom: {
            family: {
              value: value46?.value ?? value42,
              options: value47,
              searchable: true,
              onOpenChange: (input?: Dynamic): Dynamic =>
                input &&
                (0, runtime.ensureWebFonts)([
                  ...runtime.TypographyFontCatalogMapValue,
                  ...(seed?.webfonts ?? []),
                ]),
              onChange: (input?: Dynamic): Dynamic =>
                state.set([
                  [
                    "font-family",
                    input === value42
                      ? input
                      : (0, runtime.normalizedFontFamilyOption)(input),
                  ],
                ]),
            },
            face: {
              weight: value34,
              italic: value44,
              faces: (0, runtime.resolveFontVariants)(
                value43,
                (0, runtime.getAvailableFontVariants)(
                  seed?.faces ?? [],
                  value43,
                ),
              ),
              onOpenChange: (input?: Dynamic): Dynamic =>
                input && seed?.onFacesOpen?.(),
              onChange: (input?: Dynamic, options?: Dynamic): Dynamic =>
                state.set(
                  options === value44
                    ? [["font-weight", String(input)]]
                    : [
                        ["font-weight", String(input)],
                        ["font-style", options ? "italic" : "normal"],
                      ],
                ),
            },
            size: {
              value: value54 ? undefined : value31,
              mixed: value54,
              min: 1,
              max: 999,
              onValue: (input?: Dynamic): Dynamic =>
                state.set([
                  [
                    "font-size",
                    input === undefined
                      ? undefined
                      : String(callback4(input)) + "px",
                  ],
                ]),
              onScrub: (input?: Dynamic): Dynamic =>
                state.set(
                  [["font-size", String(Math.round(input)) + "px"]],
                  true,
                ),
              onScrubEnd: state.settle,
            },
            lineHeight: {
              value: callback3(state.get("line-height")),
              placeholder: seed?.rendered?.lineHeight ?? "Auto",
              clearable: true,
              min: 0.5,
              max: 4,
              step: 0.05,
              onValue: (input?: Dynamic): Dynamic =>
                state.set([
                  [
                    "line-height",
                    input === undefined
                      ? undefined
                      : String(Math.round(input * 100) / 100),
                  ],
                ]),
              onScrub: (input?: Dynamic): Dynamic =>
                state.set(
                  [["line-height", String(Math.round(input * 100) / 100)]],
                  true,
                ),
              onScrubEnd: state.settle,
            },
            letterSpacing: {
              value: callback2(state.get("letter-spacing")),
              placeholder: "0",
              clearable: true,
              min: -10,
              max: 40,
              step: 0.5,
              onValue: (input?: Dynamic): Dynamic =>
                state.set([
                  [
                    "letter-spacing",
                    input === undefined
                      ? undefined
                      : String(callback4(input)) + "px",
                  ],
                ]),
              onScrub: (input?: Dynamic): Dynamic =>
                state.set(
                  [["letter-spacing", String(callback4(input)) + "px"]],
                  true,
                ),
              onScrubEnd: state.settle,
            },
          },
        },
        state4: Dynamic = {
          title: "Text color",
          editsAreUndoSteps: value25,
          paint: value56 ?? value48.paint,
          swatches: value11,
          value: value14
            ? null
            : (0, runtime.matchingDesignSwatchName)(
                value11,
                state.get("color"),
                value12,
              ),
          onSwatch: (input?: Dynamic): Dynamic => {
            let value62: Dynamic = (0, runtime.valueForDesignSwatch)(
              value11,
              input,
              value12,
            );
            value62 !== undefined &&
              state.set([["color", value62], ...value57]);
          },
          custom: {
            seed: value48.seed,
            unset: value48.paint === undefined,
            onChange: (input?: Dynamic): Dynamic =>
              state.set([["color", input], ...value57], true),
            onPickEnd: (): Dynamic => state.settle(),
            contrast: value50,
            quietSwatch: true,
          },
          ...(value23 ? {} : state2),
        };
      if (current && !value23 && !value30 && part !== "text")
        return (
          <jsx_Ki.Fragment>
            <runtime.SessionStripGroup wrap={true}>
              <runtime.SessionTypographyPopup
                testid={"mega-text-style"}
                {...state3}
              />
              <runtime.SessionActionsPopover
                testid={"mega-text-color"}
                {...state4}
              />
            </runtime.SessionStripGroup>
            {compact ? null : <runtime.SessionStripDivider />}
            <runtime.CssBorderQuickPanel
              io={state}
              swatches={value11}
              defined={value12}
              compact={compact}
              editsAreUndoSteps={value25}
            />
            {value27}
            {value28}
            {coarse && onEditText ? (
              <runtime.SessionStripButton
                data-testid={"mega-text-edit"}
                icon={"Edit"}
                title={"Edit the text"}
                aria-label={"Edit text"}
                onClick={onEditText}
              />
            ) : null}
            {value22}
          </jsx_Ki.Fragment>
        );
      let value61: Dynamic = value30
        ? {
            pressed: value24.link,
            onClick: (): Dynamic => onFormat("link"),
          }
        : primaryTag === "a" && onElementLink !== undefined && !value23
          ? {
              href: seed?.href ?? undefined,
              editable: true,
              normalize: runtime.sanitizeEditableLink,
              invalidHint:
                "Enter a link: https://\u2026, a #section, a page path, mailto: or tel:",
              onChange: (input?: Dynamic): Dynamic =>
                onElementLink(input ?? null),
            }
          : {
              pressed: false,
              onClick: (): Dynamic => callback("link"),
              disabledReason: value53,
            };
      return (
        <jsx_Ki.Fragment>
          <runtime.TextSessionStrip
            selKey={"sel"}
            compact={compact}
            testidPrefix={"mega-text"}
            shortcuts={value30}
            tailTestids={{
              comment: "mega-sel-comment",
              more: "mega-sel-props",
            }}
            style={state3}
            color={state4}
            bold={{
              pressed: value30 ? value24.bold : value34 >= 600,
              onClick: (): Dynamic =>
                value30
                  ? onFormat("bold")
                  : state.set([
                      ["font-weight", value34 >= 600 ? "400" : "700"],
                    ]),
              disabledReason: value51 ? value53 : null,
            }}
            italic={{
              pressed: value30 ? value24.italic : value35 === "italic",
              onClick: (): Dynamic =>
                value30
                  ? onFormat("italic")
                  : state.set([
                      [
                        "font-style",
                        value35 === "italic" ? "normal" : "italic",
                      ],
                    ]),
              disabledReason: value51 ? value53 : null,
            }}
            underline={{
              pressed: value30
                ? value24.underline
                : value36.includes("underline"),
              onClick: (): Dynamic =>
                value30
                  ? onFormat("underline")
                  : state.set([
                      [
                        "text-decoration-line",
                        value23
                          ? value36.includes("underline")
                            ? "none"
                            : "underline"
                          : toggleUnderlineDecoration(value36),
                      ],
                    ]),
              disabledReason: value51 ? value53 : null,
            }}
            link={value61}
            list={{
              value: value30
                ? value24.ol
                  ? "number"
                  : value24.ul
                    ? "bullet"
                    : "none"
                : value23
                  ? null
                  : value52,
              disabledReason:
                value53 !== null
                  ? value23 && !value30
                    ? "Make lists one text at a time"
                    : value53
                  : null,
              onChange: (input?: Dynamic): Dynamic => {
                let value62: Dynamic = (0, runtime.listKindToTag)(
                  input,
                  value30
                    ? value24.ol
                      ? "number"
                      : value24.ul
                        ? "bullet"
                        : "none"
                    : value52,
                );
                value62 !== null &&
                  (value30 ? onFormat(value62) : callback(value62));
              },
            }}
            align={{
              value: value23 ? null : (textAlignmentValues[value37] ?? "start"),
              onChange: (input?: Dynamic): Dynamic =>
                state.set([["text-align", input]]),
            }}
            onEdit={coarse && !value30 && onEditText ? onEditText : undefined}
            trailing={value27}
            onComment={crossFile ? null : value21}
            onOpenInspector={
              value20 === "enabled" ? (): Dynamic => onOpenProps() : undefined
            }
            inspectorDisabledReason={
              value20 === "disabled-with-reason"
                ? "Properties edits one artboard at a time \u2014 narrow the selection"
                : undefined
            }
          />
        </jsx_Ki.Fragment>
      );
    }
    if (box > 0)
      return (
        <jsx_Ki.Fragment>
          <runtime.CssBorderQuickPanel
            io={state}
            swatches={value11}
            defined={value12}
            compact={compact}
            faces={!value23}
            editsAreUndoSteps={value25}
          />
          {value27}
          {value28}
          {value22}
        </jsx_Ki.Fragment>
      );
    let value29: Dynamic =
      compact || (value27 === null && value22 === null) ? null : (
        <runtime.SessionStripDivider />
      );
    return shape > 0 ? (
      <jsx_Ki.Fragment>
        <runtime.SvgPaintQuickPanel
          io={state}
          swatches={value11}
          defined={value12}
        />
        {value29}
        {value27}
        {value28}
        {value22}
      </jsx_Ki.Fragment>
    ) : image > 0 ? (
      <jsx_Ki.Fragment>
        <runtime.ImageQuickPanel
          io={state}
          src={seed?.imageSrc ?? undefined}
          onReplace={(): Dynamic => onReplaceImage?.()}
          replaceReason={
            value23
              ? "Replace one image at a time"
              : onReplaceImage
                ? undefined
                : "This view can't replace images"
          }
          onCrop={(): Dynamic => onCrop?.()}
          cropping={cropping}
          cropReason={
            value23
              ? "Crop one image at a time"
              : onCrop
                ? cropping
                  ? undefined
                  : cropReason
                : "This view can't crop images"
          }
        />
        {value29}
        {value27}
        {value28}
        {value22}
      </jsx_Ki.Fragment>
    ) : line > 0 ? (
      <jsx_Ki.Fragment>
        <runtime.LineStrokeQuickPanel
          io={state}
          swatches={value11}
          defined={value12}
        />
        {value29}
        {value27}
        {value28}
        {value22}
      </jsx_Ki.Fragment>
    ) : (
      <jsx_Ki.Fragment>
        {value27}
        {value28}
        {value22}
      </jsx_Ki.Fragment>
    );
  }
  bindRuntimeValue(
    runtime,
    "react_Gw",
    () => react_Gw,
    (value) => {
      react_Gw = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsx_Ki",
    () => jsx_Ki,
    (value) => {
      jsx_Ki = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "emptySelectionPropertyItems",
    () => emptySelectionPropertyItems,
    (value) => {
      emptySelectionPropertyItems = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "propertySidebarActionState",
    () => propertySidebarActionState,
  );
  bindRuntimeValue(
    runtime,
    "hasSelectionQuickActions",
    () => hasSelectionQuickActions,
  );
  bindRuntimeValue(
    runtime,
    "defaultQuickActionInk",
    () => defaultQuickActionInk,
    (value) => {
      defaultQuickActionInk = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "literalQuickActionColorPattern",
    () => literalQuickActionColorPattern,
    (value) => {
      literalQuickActionColorPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "quickActionPaintAndSeed",
    () => quickActionPaintAndSeed,
  );
  bindRuntimeValue(
    runtime,
    "buildQuickActionSwatches",
    () => buildQuickActionSwatches,
  );
  bindRuntimeValue(
    runtime,
    "selectionHasVisiblePaint",
    () => selectionHasVisiblePaint,
  );
  bindRuntimeValue(
    runtime,
    "toggleUnderlineDecoration",
    () => toggleUnderlineDecoration,
  );
  bindRuntimeValue(
    runtime,
    "textAlignmentValues",
    () => textAlignmentValues,
    (value) => {
      textAlignmentValues = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "parseQuickActionNumber",
    () => parseQuickActionNumber,
    (value) => {
      parseQuickActionNumber = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SelectionQuickActions",
    () => SelectionQuickActions,
  );
  return () => {
    react_Gw = (0, runtime.toModuleNamespace)((0, runtime.load_react)(), 1);
    (0, runtime.initializeEditorAttributeValidation)();
    jsx_Ki = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_jsx_runtime)(),
      1,
    );
    emptySelectionPropertyItems = [];
    defaultQuickActionInk = "#141413";
    literalQuickActionColorPattern =
      /^(?:#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})|rgba?\(\s*[\d.]+[\s,]+[\d.]+[\s,]+[\d.]+(?:[\s,/]+[\d.]+)?\s*\))$/;
    textAlignmentValues = {
      left: "start",
      start: "start",
      center: "center",
      right: "end",
      end: "end",
      justify: "justify",
    };
    parseQuickActionNumber = (input?: Dynamic): Dynamic => {
      if (input == null) return;
      let value: Dynamic = parseFloat(input);
      return Number.isFinite(value) ? value : undefined;
    };
  };
}
