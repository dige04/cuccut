import type * as React from "react";
import type * as Token from "../contracts/token-editors";
import type * as Model from "../contracts";
import type * as Color from "../contracts/color-controls";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installEditorTypography(runtime: RuntimeBindings): () => void {
  var jsxTypographyEditors: typeof import("react/jsx-runtime");
  var FONT_WEIGHT_LABELS: [number, string][];
  var clampTypographyNumber: (
    value: number,
    minimum: number,
    maximum: number,
  ) => number;
  var DEFAULT_TYPE_SAMPLE: string;
  var fontFileDisplayPath: (path: string) => string;
  var fontFileSlantLabel: (style: string) => string;
  var LineHeightIcon: () => React.ReactElement;
  var LetterSpacingIcon: () => React.ReactElement;
  var CUSTOM_FONT_FAMILY_SENTINEL: string;
  var MAX_TYPE_SAMPLE_LENGTH: number;
  var TYPE_CARD_KEY_PREFIX: string;
  var TYPOGRAPHY_SECTION_LABEL: string;
  function parseTypographyLength(value: string, fallback: number): number {
    let value2 = /^(\d{1,4}(?:\.\d{1,6})?)(px|rem|em|%)?$/.exec(value.trim());
    if (value2 === null) {
      return fallback;
    }
    let value3: number = Number(value2[1] ?? String(fallback));
    if (value2[2] === "rem" || value2[2] === "em") {
      return value3 * 16;
    } else {
      return value3;
    }
  }
  function typeStylePreviewStyle(
    style: Token.TypographyPreviewStyle,
    fontFamily: string,
  ): React.CSSProperties {
    let value = clampTypographyNumber(
        parseTypographyLength(style.fontSize, 14),
        6,
        160,
      ),
      value2 = style.lineHeight.trim(),
      value3 = /[a-z%]/.test(value2)
        ? clampTypographyNumber(
            parseTypographyLength(value2, value * 1.3),
            6,
            400,
          ) + "px"
        : clampTypographyNumber(Number(value2), 0.5, 4),
      value4 =
        typeof style.fontWeight === "number"
          ? clampTypographyNumber(Math.round(style.fontWeight), 1, 1000)
          : clampTypographyNumber(
              parseInt(String(style.fontWeight), 10),
              1,
              1000,
            ),
      state: React.CSSProperties = {
        fontFamily: fontFamily,
        fontSize: value,
        lineHeight: value3,
        fontWeight: value4,
        letterSpacing: style.letterSpacing,
        fontStyle: style.fontStyle === "italic" ? "italic" : "normal",
      };
    if (style.opticalSize !== undefined && Number.isFinite(style.opticalSize)) {
      state.fontVariationSettings =
        '"opsz" ' +
        String(clampTypographyNumber(style.opticalSize as number, 1, 144));
    } else {
      state.fontVariationSettings = "normal";
    }
    return state;
  }
  function fontWeightLabel(weight: string | number): string {
    let value =
      typeof weight === "number" ? weight : parseInt(String(weight), 10);
    return (
      FONT_WEIGHT_LABELS.find(([input]): boolean => input === value)?.[1] ??
      String(weight)
    );
  }
  function groupFontsByFamily(
    fonts: Token.EditorFont[],
  ): [string, Token.EditorFont[]][] {
    let entries = new Map<string, Token.EditorFont[]>();
    for (let value of fonts) {
      let entry = entries.get(value.family);
      if (entry === undefined) {
        entries.set(value.family, [value]);
      } else {
        entry.push(value);
      }
    }
    return [...entries.entries()];
  }
  function MissingFontNotice({
    missing: missing,
    edit: edit,
  }: Token.MissingFontNoticeProps): React.ReactElement {
    let value: boolean = missing.length === 1;
    return (
      <div className={"contents"} {...runtime.UNCOMMENTABLE_PROPS}>
        <runtime.Callout
          variant={"warning"}
          className={"mx-[var(--pp-gutter-l)] my-sm"}
          data-testid={"ds-fonts-missing"}
          action={
            edit !== undefined ? (
              <runtime.Button
                onClick={edit.dropMissingFonts}
                data-testid={"ds-fonts-drop-missing"}
              >
                {value ? "Drop the reference" : "Drop the references"}
              </runtime.Button>
            ) : undefined
          }
        >
          {[
            value
              ? "A font file is"
              : String(missing.length) + " font files are",
            " referenced but not uploaded: ",
            <span className={"font-mono"}>
              {missing
                .map((input) => fontFileDisplayPath(input.path))
                .join(", ")}
            </span>,
            edit !== undefined
              ? " — add " + (value ? "it" : "them") + " with Upload font."
              : " — an editor can upload " + (value ? "it" : "them") + ".",
          ]}
        </runtime.Callout>
      </div>
    );
  }
  function FontFilesList({
    fams: fams,
    onRemoveFont: onRemoveFont,
  }: Token.FontFilesListProps): React.ReactElement {
    return (
      <div
        className={"ds-fontrows flex flex-col"}
        data-testid={"ds-fonts-card"}
      >
        {fams.flatMap(([input, input2]) => {
          let entries = new Map<string, number>();
          return input2.map((input3, options) => {
            let value: string =
                input +
                "/" +
                input3.path +
                ":" +
                input3.weight +
                ":" +
                input3.style,
              value2 = (entries.get(value) ?? 0) + 1;
            entries.set(value, value2);
            return (() => {
              const _Element = "div";
              const _elementProps = {
                className:
                  "ds-frow ds-tokrow group/row flex items-center gap-x-md",
                "data-testid": "ds-font-" + input3.path + "#" + String(options),
                ...(0, runtime.commentTargetProps)(
                  "font",
                  value + (value2 > 1 ? "#" + String(value2) : ""),
                ),
                children: [
                  <runtime.TooltipWrapper
                    tip={
                      input3.path +
                      (input3.asset === true
                        ? " — a font file under assets/, not a face of the type system"
                        : input3.stray === true
                          ? " — not referenced by any tokens.json font face"
                          : "")
                    }
                    className={"min-w-0 flex-[1_1_10rem]"}
                  >
                    <span className={"min-w-0 truncate text-body text-primary"}>
                      {[
                        fontFileDisplayPath(input3.path),
                        input3.asset === true ? (
                          <span className={"text-muted"}>{" · asset"}</span>
                        ) : input3.stray === true ? (
                          <span className={"text-muted"}>
                            {" · unreferenced"}
                          </span>
                        ) : null,
                      ]}
                    </span>
                  </runtime.TooltipWrapper>,
                  <span
                    className={
                      "ds-fontrow-preview min-w-0 flex-[2_10_6rem] truncate text-body text-muted"
                    }
                    style={{
                      fontFamily: (0, runtime.fontFamilyStack)(input, [
                        input3.path,
                      ]),
                      fontWeight: input3.weight.split(" ")[0],
                      fontStyle:
                        input3.style === "italic" ? "italic" : "normal",
                    }}
                    aria-hidden={"true"}
                  >
                    {[
                      input,
                      " ",
                      fontFileSlantLabel(input3.weight),
                      input3.style === "italic" ? " italic" : "",
                    ]}
                  </span>,
                  <runtime.RemoveSectionButton
                    label={fontFileDisplayPath(input3.path)}
                    verb={"Remove"}
                    onRemove={
                      onRemoveFont === undefined
                        ? undefined
                        : () => onRemoveFont(input3)
                    }
                  />,
                ],
              };
              const _elementKey =
                input + ":" + String(options) + ":" + input3.path;
              return <_Element key={_elementKey} {..._elementProps} />;
            })();
          });
        })}
      </div>
    );
  }
  function FontFamilyPicker({
    value: value,
    familyKey: familyKey,
    families: families,
    familyNames: familyNames,
    fontNames = [],
    onFamily: onFamily,
    onFont: onFont,
    testid: testid,
    disabled: disabled,
  }: Token.FontFamilyPickerProps): React.ReactElement {
    let callback = (input: string) => {
        let value6 = input.trim().toLowerCase();
        return Object.keys(families).find(
          (input2) =>
            input2 === value6 ||
            (familyNames?.[input2] ?? "").toLowerCase() === value6,
        );
      },
      values = new Set(
        Object.keys(families).map((input) =>
          (familyNames?.[input] ?? input).toLowerCase(),
        ),
      ),
      callback2 = (input: string): boolean => {
        let value6 = input.toLowerCase();
        if (values.has(value6)) {
          return false;
        }
        values.add(value6);
        return true;
      },
      items: import("../contracts/controls").SelectOption<string>[] = [
        ...Object.keys(families).map((input) => ({
          value: "fam:" + input,
          label: familyNames?.[input] ?? input,
          labelStyle: {
            fontFamily: families[input],
          },
          group: "This system",
        })),
        ...fontNames.filter(callback2).map((input) => ({
          value: "font:" + input,
          label: input,
          labelStyle: {
            fontFamily: "'" + input + "'",
          },
          group: "Font files",
        })),
        ...runtime.WEB_SAFE_FONT_CATALOG.map(
          (input: { family: string }) => input.family,
        )
          .filter(callback2)
          .map((input: string) => ({
            value: "font:" + input,
            label: input,
            labelStyle: {
              fontFamily: input,
            },
            group: "Web safe",
          })),
        ...runtime.GOOGLE_FONT_FAMILY_NAMES.filter(callback2).map(
          (input: string) => ({
            value: "font:" + input,
            label: input,
            labelStyle: {
              fontFamily: "'" + input + "'",
            },
            group: "Google Fonts",
          }),
        ),
        {
          value: CUSTOM_FONT_FAMILY_SENTINEL,
          label: "Custom…",
          separatorBefore: true,
        },
      ],
      value2 =
        familyKey !== undefined && familyKey !== ""
          ? familyKey
          : callback(value),
      value3: string | string | null =
        value2 !== undefined
          ? "fam:" + value2
          : items.some((input): boolean => input.value === "font:" + value)
            ? "font:" + value
            : null,
      [value4, value5] = (
        runtime.reactGoogleFontCatalog as typeof React
      ).useState(false),
      ref = (runtime.reactGoogleFontCatalog as typeof React).useRef(""),
      ref2 = (runtime.reactGoogleFontCatalog as typeof React).useRef<ReturnType<
        typeof setTimeout
      > | null>(null),
      callback3 = (): void => {
        if (ref2.current !== null) {
          clearTimeout(ref2.current);
          ref2.current = null;
        }
      };
    (runtime.reactGoogleFontCatalog as typeof React).useEffect(
      () => callback3,
      [],
    );
    let callback4 = (input: string): void => {
        if (input === CUSTOM_FONT_FAMILY_SENTINEL) {
          value5(true);
          return;
        }
        let value6 = input.startsWith("fam:") ? null : input.slice(5);
        if (value6 === null) {
          let value8 = input.slice(4);
          if (value8 !== value2) {
            onFamily(value8);
          }
          return;
        }
        let value7 = callback(value6);
        if (value7 !== undefined) {
          if (value7 !== value2) {
            onFamily(value7);
          }
        } else {
          onFont(value6);
        }
      },
      callback5 = (input: string): void => {
        ref.current = "";
        let value6 = input.replace(/\s+/g, " ").trim();
        if (value6 === "" || value6.toLowerCase() === value.toLowerCase()) {
          return;
        }
        let value7 = callback(value6);
        if (value7 !== undefined) {
          onFamily(value7);
        } else {
          onFont(value6);
        }
      },
      ref3 = (runtime.reactGoogleFontCatalog as typeof React).useRef(callback5);
    ref3.current = callback5;
    (runtime.reactGoogleFontCatalog as typeof React).useEffect(
      () => (): void => {
        if (ref.current.trim() !== "") {
          ref3.current(ref.current);
        }
      },
      [],
    );
    let ref4 = (
        runtime.reactGoogleFontCatalog as typeof React
      ).useRef<HTMLSpanElement | null>(null),
      callback6 = (): void => {
        callback3();
        value5(false);
        requestAnimationFrame(() =>
          ref4.current?.querySelector<HTMLElement>("button")?.focus({
            preventScroll: true,
          }),
        );
      };
    return (
      <span
        ref={ref4}
        className={"ds-fontfield block min-w-0 flex-1"}
        data-testid={testid}
      >
        {[
          <runtime.Select
            aria-label={"Font"}
            popupAttrs={runtime.UNCOMMENTABLE_PROPS}
            items={items}
            value={value3}
            placeholder={value === "" ? undefined : value}
            hint={value === "" ? "Font" : undefined}
            disabled={disabled}
            searchable={true}
            searchLabel={"Search fonts…"}
            onOpenChange={(input: boolean): void => {
              if (input) {
                (0, runtime.ensureGoogleFonts)(
                  runtime.GOOGLE_FONT_FAMILY_NAMES,
                );
              }
            }}
            onChange={callback4}
            data-testid={testid + "-menu"}
          />,
          value4 ? (
            <span className={"mt-1 block"}>
              <runtime.TextInput
                autoFocus={true}
                placeholder={"Font name, e.g. Söhne"}
                aria-label={"Custom font name"}
                spellCheck={false}
                autoComplete={"off"}
                data-1p-ignore={"true"}
                data-lpignore={"true"}
                data-bwignore={"true"}
                data-form-type={"other"}
                data-testid={testid + "-custom"}
                onChange={(
                  input: React.ChangeEvent<HTMLInputElement>,
                ): void => {
                  ref.current = input.currentTarget.value;
                }}
                onFocus={callback3}
                onBlur={(input: React.FocusEvent<HTMLInputElement>): void => {
                  callback5(input.currentTarget.value);
                  callback3();
                  ref2.current = setTimeout((): void => {
                    ref2.current = null;
                    ref.current = "";
                    value5(false);
                  }, 250);
                }}
                onKeyDown={(
                  event: React.KeyboardEvent<HTMLInputElement>,
                ): void => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    event.stopPropagation();
                    callback5(event.currentTarget.value);
                    callback6();
                  }
                  if (event.key === "Escape") {
                    event.stopPropagation();
                    ref.current = "";
                    callback6();
                  }
                }}
              />
            </span>
          ) : null,
        ]}
      </span>
    );
  }
  function TypeStyleFields({
    v: v,
    families: families,
    familyNames: familyNames,
    fontNames: fontNames,
    fontLabel: fontLabel,
    onField: onField,
    onLive: onLive,
    onLiveEnd: onLiveEnd,
    onFont: onFont,
    testid: testid,
    inputRef: inputRef,
    row: row,
    anchorKey: anchorKey,
  }: Token.TypeStyleFieldsProps): React.ReactElement {
    let value = FONT_WEIGHT_LABELS.map(([input, input2]) => ({
        value: String(input),
        label: input2,
      })),
      value2 = (0, runtime.parseEditableCssLength)(v.fontSize) ?? {
        n: parseTypographyLength(v.fontSize, 16),
        unit: "px",
      },
      value3 = (0, runtime.parseEditableCssLength)(v.lineHeight) ?? {
        n: parseTypographyLength(v.lineHeight, 1.4),
        unit: "",
      },
      value4 =
        v.letterSpacing === undefined ||
        v.letterSpacing === "normal" ||
        v.letterSpacing.trim() === ""
          ? "0"
          : v.letterSpacing,
      value5 =
        value4 === "0"
          ? {
              n: 0,
              unit: "em",
            }
          : ((0, runtime.parseEditableCssLength)(value4) ?? {
              n: 0,
              unit: "em",
            }),
      value6 = value5.unit === "" ? "em" : value5.unit,
      callback = (
        input: Token.TypographyField,
        options: string,
        context: number,
      ) => {
        let value13: string = String(Math.round(context * 1e6) / 1e6) + options,
          value14 =
            input === "letterSpacing"
              ? (normalizeLetterSpacing(value13) ?? value13)
              : value13;
        if (
          (0, runtime.normalizeTypographyProperty)(input, value14, {}) !==
          undefined
        ) {
          return value14;
        } else {
          return undefined;
        }
      },
      callback2 =
        (input: Token.TypographyField, options: string) =>
        (input2: number | undefined): void => {
          let value13 =
            input2 === undefined ? undefined : callback(input, options, input2);
          if (value13 !== undefined) {
            onField(input, value13);
          }
        },
      callback3 = (input: Token.TypographyField, options: string) =>
        onLive === undefined
          ? {}
          : {
              onScrub: (input2: number): void => {
                let value13 = callback(input, options, input2);
                if (value13 !== undefined) {
                  onLive(input, value13);
                }
              },
              onScrubEnd: () => onLiveEnd?.(),
            },
      value7 =
        v.family === ""
          ? (fontLabel ?? "")
          : (familyNames?.[v.family] ?? v.family),
      callback4 = (input: string, options: string) =>
        anchorKey !== undefined
          ? {
              role: "group",
              "aria-label": options,
              ...(0, runtime.commentTargetProps)(
                "knob",
                anchorKey + "/" + input,
              ),
            }
          : {},
      value8 = (
        <span
          className={"block min-w-0 flex-1"}
          {...callback4("family", "Font")}
        >
          <FontFamilyPicker
            value={value7}
            familyKey={v.family}
            families={families}
            familyNames={familyNames}
            fontNames={fontNames}
            onFamily={(input: string): void => {
              if (input !== v.family) {
                onField("family", input);
              }
            }}
            onFont={onFont}
            testid={testid + "-family"}
          />
        </span>
      ),
      value9 = (
        <span className={"min-w-0"} {...callback4("weight", "Weight")}>
          <runtime.Select
            aria-label={"Weight"}
            popupAttrs={runtime.UNCOMMENTABLE_PROPS}
            items={value}
            value={String(v.fontWeight)}
            onChange={(input: string): void => {
              if (input !== String(v.fontWeight)) {
                onField("fontWeight", input);
              }
            }}
            data-testid={testid + "-weight"}
          />
        </span>
      ),
      value10 = (
        <span
          data-testid={testid + "-size"}
          data-knob={"size"}
          className={"min-w-0"}
          {...callback4("size", "Size")}
        >
          <runtime.PropertyNumberInput
            aria-label={"Size"}
            inputRef={inputRef}
            unit={value2.unit || "px"}
            value={value2.n}
            min={
              (0, runtime.cssLengthInputBounds)(value2.unit || "px", 1, 400)[0]
            }
            max={runtime.MAX_EDITABLE_CSS_LENGTH}
            step={(0, runtime.cssLengthInputStep)(value2.unit || "px")}
            steppers={false}
            refuseLetters={true}
            fullWidth={true}
            onValue={callback2("fontSize", value2.unit || "px")}
            {...callback3("fontSize", value2.unit || "px")}
          />
        </span>
      ),
      value11 = (
        <span
          data-testid={testid + "-lh"}
          data-knob={"lh"}
          className={"min-w-0"}
          {...callback4("line-height", "Line height")}
        >
          <runtime.PropertyNumberInput
            aria-label={"Line height"}
            inputRef={inputRef}
            prefix={<LineHeightIcon />}
            unit={value3.unit !== "" ? value3.unit : undefined}
            value={value3.n}
            min={
              value3.unit === ""
                ? 0.5
                : (0, runtime.cssLengthInputBounds)(value3.unit, 0, 400)[0]
            }
            max={value3.unit === "" ? 10 : runtime.MAX_EDITABLE_CSS_LENGTH}
            step={
              value3.unit === ""
                ? 0.05
                : (0, runtime.cssLengthInputStep)(value3.unit)
            }
            steppers={false}
            refuseLetters={true}
            fullWidth={true}
            onValue={callback2("lineHeight", value3.unit)}
            {...callback3("lineHeight", value3.unit)}
          />
        </span>
      ),
      value12 = (
        <span
          data-testid={testid + "-ls"}
          data-knob={"ls"}
          className={"min-w-0"}
          {...callback4("letter-spacing", "Letter spacing")}
        >
          <runtime.PropertyNumberInput
            aria-label={"Tracking"}
            inputRef={inputRef}
            prefix={<LetterSpacingIcon />}
            unit={value6}
            value={value5.n}
            min={value6 === "px" ? -20 : -1}
            max={value6 === "px" ? 40 : 2}
            step={value6 === "px" ? 0.5 : 0.01}
            steppers={false}
            refuseLetters={true}
            fullWidth={true}
            onValue={callback2("letterSpacing", value6)}
            {...callback3("letterSpacing", value6)}
          />
        </span>
      ),
      callback5 = (input: React.ReactNode, options: React.ReactNode) => (
        <span className={"grid min-w-0 grid-cols-2 gap-sm"}>
          {[input, options]}
        </span>
      );
    if (row !== undefined) {
      return (
        <jsxTypographyEditors.Fragment>
          {[
            row("Font", value8),
            row("Weight", callback5(value9, value10)),
            row("Line height", callback5(value11, value12)),
          ]}
        </jsxTypographyEditors.Fragment>
      );
    }
    return (
      <div className={"ds-tedit grid grid-cols-2 gap-sm"} data-testid={testid}>
        {[
          <span className={"col-span-2 min-w-0"}>{value8}</span>,
          value9,
          value10,
          value11,
          value12,
        ]}
      </div>
    );
  }
  function TypeStyleMetricEditors({
    s: s,
    famKey: famKey,
    families: families,
    familyNames: familyNames,
    fontNames: fontNames,
    edit: edit,
  }: Token.TypeStyleMetricEditorsProps): React.ReactElement {
    return (
      <div
        className={"px-md pb-sm"}
        data-testid={"ds-style-controls-" + s.name}
      >
        <TypeStyleFields
          v={{
            family: famKey,
            fontSize: s.fontSize,
            fontWeight: s.fontWeight,
            lineHeight: s.lineHeight,
            letterSpacing: s.letterSpacing,
          }}
          families={families}
          familyNames={familyNames}
          fontNames={fontNames}
          testid={"ds-strip"}
          anchorKey={s.name}
          onField={(input: Token.TypographyField, options: string): void => {
            edit.setField(s.name, input, options);
            edit.done();
          }}
          onLive={(input: Token.TypographyField, options: string) =>
            edit.setField(s.name, input, options)
          }
          onLiveEnd={() => edit.done()}
          onFont={(input: string) => edit.setFont?.(s.name, input)}
        />
      </div>
    );
  }
  function TypeStyleSpecimen({
    s: s,
    famKey: famKey,
    families: families,
    familyNames: familyNames,
    fontNames: fontNames,
    edit: edit,
  }: Token.TypeStyleSpecimenProps): React.ReactElement {
    let [value, value2] = (
        runtime.reactGoogleFontCatalog as typeof React
      ).useState(false),
      ref = (runtime.reactGoogleFontCatalog as typeof React).useRef(false),
      ref2 = (
        runtime.reactGoogleFontCatalog as typeof React
      ).useRef<HTMLSpanElement | null>(null),
      value3: string =
        (familyNames?.[famKey] ?? famKey) +
        " · " +
        s.fontSize.replace(/px$/, "");
    if (edit === undefined) {
      let value4: string =
        (familyNames?.[famKey] ?? famKey) +
        " · " +
        s.fontSize.replace(/px$/, "") +
        "/" +
        s.lineHeight +
        " · " +
        fontWeightLabel(s.fontWeight) +
        (s.letterSpacing !== undefined &&
        s.letterSpacing !== "0" &&
        s.letterSpacing !== "normal"
          ? " · " + s.letterSpacing
          : "");
      return (
        <span
          className={"ds-tchip-read min-w-0 text-footnote text-muted"}
          data-testid={"ds-style-chip-" + s.name}
        >
          {value4}
        </span>
      );
    }
    return (
      <span
        className={"ds-tchip-anchor relative flex min-w-0"}
        ref={ref2}
        data-testid={"ds-style-chip-" + s.name}
      >
        <runtime.PropertyPopover
          open={value}
          editsAreUndoSteps={true}
          onOpenChange={value2}
          trigger={
            <runtime.PropertyPopoverTrigger
              label={"Edit " + s.name}
              text={value3}
              onClick={(input: React.MouseEvent<HTMLButtonElement>): void => {
                ref.current = input.detail === 0;
              }}
            />
          }
          anchor={() => ref2.current}
          side={"bottom"}
          focusOnOpen={ref.current}
          className={"w-[17rem]"}
        >
          {value ? (
            <runtime.CdsRoot density={"compact"} className={"contents"}>
              <div
                role={"group"}
                aria-label={"Text style " + s.name}
                {...(0, runtime.commentTargetProps)(
                  "editor",
                  "style/" + s.name,
                )}
              >
                <runtime.PropertyPopoverPanel
                  title={"Text"}
                  onClose={() => value2(false)}
                >
                  <TypeStyleMetricEditors
                    s={s}
                    famKey={famKey}
                    families={families}
                    familyNames={familyNames}
                    fontNames={fontNames}
                    edit={edit}
                  />
                </runtime.PropertyPopoverPanel>
              </div>
            </runtime.CdsRoot>
          ) : null}
        </runtime.PropertyPopover>
      </span>
    );
  }
  function normalizeLetterSpacing(value: string): string | null {
    let value2 = value.trim().toLowerCase();
    if (value2 === "" || value2 === "0") {
      return "0";
    }
    if (/^-?(?:\d+|\d*\.\d+)(?:px|rem|em)$/.test(value2)) {
      return value2;
    }
    if (/^-?(?:\d+|\d*\.\d+)$/.test(value2)) {
      return value2 + "em";
    }
    return null;
  }
  function TypeStyleRow({
    s: s,
    g: g,
    families: families,
    familyNames: familyNames,
    fontNames: fontNames,
    taken: taken,
    edit: edit,
  }: Token.TypeStyleRowProps): React.ReactElement {
    let familyKey = s.familyKey ?? g.family,
      z = families[familyKey] ?? "system-ui, sans-serif",
      value = typeStylePreviewStyle(s, z),
      value2 = clampTypographyNumber(
        parseTypographyLength(s.fontSize, 14),
        6,
        160,
      ),
      value3: number = Math.min(MAX_TYPE_SAMPLE_LENGTH, value2),
      state = {
        ...value,
        fontSize: String(value3) + "px",
        ...(value3 < value2 && typeof value.lineHeight === "string"
          ? {
              lineHeight:
                String(
                  Math.round(
                    (parseTypographyLength(value.lineHeight, value2 * 1.3) *
                      value3) /
                      value2,
                  ),
                ) + "px",
            }
          : {}),
      },
      value4 = (0, runtime.useRowContextMenu)(),
      callback = () =>
        document
          .querySelector<HTMLElement>(
            '[data-testid="ds-style-name-' + s.name + '"]',
          )
          ?.click();
    return (
      <div
        role={"row"}
        className={"ds-wrow ds-trow ds-tokrow ds-crow group/row"}
        data-testid={"ds-style-" + s.name}
        {...(0, runtime.commentTargetProps)("style", s.name)}
        {...value4.rowProps}
      >
        {[
          <span
            className={
              "ds-cname ds-shname ds-tname flex min-w-0 items-start font-mono"
            }
            role={"rowheader"}
            data-testid={"ds-style-title-" + s.name}
          >
            <runtime.EditableName
              name={s.name}
              taken={taken}
              className={"ds-lname"}
              commit={
                edit === undefined
                  ? undefined
                  : (input: string) => edit.rename(s.name, input)
              }
              data-testid={"ds-style-name-" + s.name}
            />
          </span>,
          <span
            className={
              "ds-bcell ds-wcell flex min-w-0 flex-col items-start gap-xs"
            }
            role={"cell"}
          >
            {[
              <span
                className={"ds-tspec truncate text-primary"}
                style={state}
                data-testid={"ds-style-sample-" + s.name}
              >
                {DEFAULT_TYPE_SAMPLE}
              </span>,
              <TypeStyleSpecimen
                s={s}
                famKey={familyKey}
                families={families}
                familyNames={familyNames}
                fontNames={fontNames}
                edit={edit}
              />,
            ]}
          </span>,
          <span
            className={
              "ds-cacts ds-cgutter relative flex items-start justify-center"
            }
            role={"cell"}
            {...runtime.UNCOMMENTABLE_PROPS}
          >
            {[
              <runtime.UsageNoteEditor
                value={s.usage ?? ""}
                label={s.name}
                anchorKey={"style/" + s.name}
                onChange={
                  edit === undefined
                    ? undefined
                    : (input: string) => edit.setUsage(s.name, input)
                }
                onDone={edit?.done}
                data-testid={"ds-style-usage-" + s.name}
              />,
              edit !== undefined ? (
                <runtime.RemoveRowButton
                  label={"Remove " + s.name}
                  onRemove={() => edit.remove(s.name)}
                  data-testid={"ds-style-remove-" + s.name}
                />
              ) : null,
            ]}
          </span>,
          <runtime.RowContextMenu
            title={s.name}
            at={value4.at}
            anchor={value4.anchor}
            onClose={value4.close}
            testid={"ds-style-menu-" + s.name}
            actions={{
              ...(edit !== undefined
                ? {
                    rename: callback,
                    remove: () => edit.remove(s.name),
                    removeLabel: "Remove " + s.name,
                  }
                : {}),
              copy: s.fontSize + " / " + s.lineHeight,
            }}
          />,
        ]}
      </div>
    );
  }
  function TypographySectionHeader({
    edit: edit,
    note: note,
  }: Token.EditorSectionHeaderProps<Token.TypographyEdit>): React.ReactElement {
    return (
      <runtime.SectionHeader
        title={TYPOGRAPHY_SECTION_LABEL}
        note={note}
        pageId={"type"}
        data-testid={"ds-type-head"}
        actions={
          edit === undefined ? undefined : (
            <jsxTypographyEditors.Fragment>
              {[
                edit.addSet !== undefined ? (
                  <runtime.SectionAddButton
                    label={"Add"}
                    what={"Add type set"}
                    onClick={() => edit.addSet?.()}
                    data-testid={"ds-add-type-set"}
                  />
                ) : null,
                edit.uploadFont !== undefined ? (
                  <runtime.SectionAddButton
                    label={"Upload font"}
                    icon={"Upload"}
                    onClick={() => edit.uploadFont?.()}
                    data-testid={"ds-fonts-upload-menu"}
                  />
                ) : null,
              ]}
            </jsxTypographyEditors.Fragment>
          )
        }
      />
    );
  }
  function TypographySection({
    groups: groups,
    families: families,
    familyNames: familyNames,
    fonts: fonts,
    onRemoveFont: onRemoveFont,
    edit: edit,
    headFor: headFor,
  }: Token.TypographySectionProps): React.ReactElement | null {
    let value = fonts.filter((input): boolean => input.missing === true),
      value2 = groupFontsByFamily(
        fonts.filter((input): boolean => input.missing !== true),
      );
    if (
      groups.reduce((input, options) => input + options.styles.length, 0) ===
        0 &&
      fonts.length === 0 &&
      groups.length === 0 &&
      edit === undefined
    ) {
      return null;
    }
    let values = new Set(
        groups.flatMap((input) => input.styles.map((input2) => input2.name)),
      ),
      values2 = new Set(groups.map((input) => input.name)),
      items = [
        ...new Set(
          fonts
            .filter((input): boolean => input.asset !== true)
            .map((input) => input.family),
        ),
      ],
      value3 =
        edit?.uploadFont !== undefined ? (
          <runtime.EditorActionButton
            onClick={edit.uploadFont}
            label={"Upload font"}
            icon={"Upload"}
            data-testid={"ds-fonts-upload"}
          />
        ) : undefined,
      value4 = (
        <div
          className={"ds-wrow ds-trow ds-crow ds-chead text-caption text-muted"}
          role={"row"}
          {...runtime.UNCOMMENTABLE_PROPS}
        >
          {[
            <span role={"columnheader"}>{"Name"}</span>,
            <span role={"columnheader"}>{"Preview"}</span>,
            <span
              role={"columnheader"}
              className={"ds-cgutter"}
              aria-hidden={"true"}
            />,
          ]}
        </div>
      );
    return (
      <div
        className={"ds-type flex flex-col gap-[48px]"}
        data-testid={"ds-type"}
      >
        {[
          groups.length === 0 && edit !== undefined ? (
            <runtime.EmptyEditorList text={"No type sets yet"} />
          ) : null,
          groups.map((input) => {
            let state: Token.SectionHead = {
                title: input.name,
                defaultTitle: input.name,
                "data-testid": TYPE_CARD_KEY_PREFIX + input.name,
                ...headFor?.(input),
              },
              value5 =
                state["data-testid"] ?? TYPE_CARD_KEY_PREFIX + input.name;
            return (() => {
              const _Element3 = "section";
              const _elementProps3 = {
                className: "ds-tgroup flex min-w-0 flex-col",
                "aria-label": state.title,
                "data-testid": "ds-type-" + input.name,
                "data-card-key": "type:" + input.name,
                "data-id": (0, runtime.commentTargetId)("tset", input.name),
                children: [
                  <div
                    className={
                      "ds-cgroup-head flex min-h-10 min-w-0 items-center gap-xs pb-xs"
                    }
                    data-testid={"ds-type-" + input.name + "-head"}
                    {...runtime.COMMENT_TARGET_PROPS}
                  >
                    {[
                      <span className={"min-w-0 flex-1"}>
                        <runtime.EditableName
                          kind={"title"}
                          name={state.title}
                          defaultTitle={state.defaultTitle}
                          taken={values2}
                          className={"ds-gname"}
                          commit={
                            state.onRename === undefined
                              ? undefined
                              : (input2: string) =>
                                  state.onRename?.(input2) ?? true
                          }
                          data-testid={value5 + "-title"}
                          inputTestId={value5 + "-field"}
                        />
                      </span>,
                      state.onRemove !== undefined ? (
                        <runtime.RemoveSectionButton
                          label={state.title}
                          icon={"Trash"}
                          why={state.removeWhy}
                          onRemove={state.onRemove}
                          data-testid={value5 + "-delete"}
                        />
                      ) : null,
                      edit?.add !== undefined ? (
                        <runtime.Button
                          variant={"ghost"}
                          size={"sm"}
                          iconOnly={true}
                          icon={"Add"}
                          aria-label={"Add a type style to " + state.title}
                          tooltip={"Add style"}
                          onClick={() => edit.add?.(input.name)}
                          data-testid={"ds-style-add-" + input.name}
                          {...runtime.UNCOMMENTABLE_PROPS}
                        />
                      ) : null,
                    ]}
                  </div>,
                  input.styles.length === 0 ? (
                    <runtime.EmptyEditorList text={"No type styles yet"} />
                  ) : null,
                  <div className={"ds-cscroll overflow-x-auto"}>
                    <div
                      className={"ds-ttable ds-ctable ds-wtable"}
                      role={"table"}
                      aria-label={state.title + " styles"}
                      hidden={input.styles.length === 0}
                      data-edit={edit !== undefined ? "" : undefined}
                    >
                      {[
                        value4,
                        input.styles.map((input2) =>
                          (() => {
                            const _Element2 = TypeStyleRow;
                            const _elementProps2 = {
                              s: input2,
                              g: input,
                              families: families,
                              familyNames: familyNames,
                              fontNames: items,
                              taken: values,
                              edit: edit,
                            };
                            const _elementKey2 = input2.name;
                            return (
                              <_Element2
                                key={_elementKey2}
                                {..._elementProps2}
                              />
                            );
                          })(),
                        ),
                      ]}
                    </div>
                  </div>,
                ],
              };
              const _elementKey3 = input.name;
              return <_Element3 key={_elementKey3} {..._elementProps3} />;
            })();
          }),
          fonts.length > 0 || edit !== undefined ? (
            <section
              className={"ds-tgroup flex min-w-0 flex-col"}
              aria-label={"Font files"}
              data-testid={"ds-fonts"}
              data-id={(0, runtime.commentTargetId)("ds", "font-files")}
            >
              {[
                <div
                  className={
                    "ds-cgroup-head flex min-h-10 min-w-0 items-center gap-xs pb-xs"
                  }
                  {...runtime.COMMENT_TARGET_PROPS}
                >
                  {[
                    <span
                      className={"ds-gname min-w-0 flex-1"}
                      data-testid={"ds-card-fonts-title"}
                    >
                      {"Font files"}
                    </span>,
                    value3,
                  ]}
                </div>,
                <div className={"ds-ttable ds-tfonts"}>
                  {[
                    value.length > 0 ? (
                      <MissingFontNotice missing={value} edit={edit} />
                    ) : null,
                    value2.length > 0 ? (
                      <FontFilesList
                        fams={value2}
                        onRemoveFont={onRemoveFont}
                      />
                    ) : (
                      <runtime.EmptyEditorList text={"No font files yet"} />
                    ),
                  ]}
                </div>,
              ]}
            </section>
          ) : null,
        ]}
      </div>
    );
  }
  bindRuntimeValue(
    runtime,
    "jsxTypographyEditors",
    () => jsxTypographyEditors,
    (value) => {
      jsxTypographyEditors = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FONT_WEIGHT_LABELS",
    () => FONT_WEIGHT_LABELS,
    (value) => {
      FONT_WEIGHT_LABELS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "clampTypographyNumber",
    () => clampTypographyNumber,
    (value) => {
      clampTypographyNumber = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "parseTypographyLength",
    () => parseTypographyLength,
  );
  bindRuntimeValue(
    runtime,
    "typeStylePreviewStyle",
    () => typeStylePreviewStyle,
  );
  bindRuntimeValue(
    runtime,
    "DEFAULT_TYPE_SAMPLE",
    () => DEFAULT_TYPE_SAMPLE,
    (value) => {
      DEFAULT_TYPE_SAMPLE = value;
    },
  );
  bindRuntimeValue(runtime, "fontWeightLabel", () => fontWeightLabel);
  bindRuntimeValue(runtime, "groupFontsByFamily", () => groupFontsByFamily);
  bindRuntimeValue(
    runtime,
    "fontFileDisplayPath",
    () => fontFileDisplayPath,
    (value) => {
      fontFileDisplayPath = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "fontFileSlantLabel",
    () => fontFileSlantLabel,
    (value) => {
      fontFileSlantLabel = value;
    },
  );
  bindRuntimeValue(runtime, "MissingFontNotice", () => MissingFontNotice);
  bindRuntimeValue(runtime, "FontFilesList", () => FontFilesList);
  bindRuntimeValue(
    runtime,
    "LineHeightIcon",
    () => LineHeightIcon,
    (value) => {
      LineHeightIcon = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "LetterSpacingIcon",
    () => LetterSpacingIcon,
    (value) => {
      LetterSpacingIcon = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CUSTOM_FONT_FAMILY_SENTINEL",
    () => CUSTOM_FONT_FAMILY_SENTINEL,
    (value) => {
      CUSTOM_FONT_FAMILY_SENTINEL = value;
    },
  );
  bindRuntimeValue(runtime, "FontFamilyPicker", () => FontFamilyPicker);
  bindRuntimeValue(runtime, "TypeStyleFields", () => TypeStyleFields);
  bindRuntimeValue(
    runtime,
    "TypeStyleMetricEditors",
    () => TypeStyleMetricEditors,
  );
  bindRuntimeValue(runtime, "TypeStyleSpecimen", () => TypeStyleSpecimen);
  bindRuntimeValue(
    runtime,
    "MAX_TYPE_SAMPLE_LENGTH",
    () => MAX_TYPE_SAMPLE_LENGTH,
    (value) => {
      MAX_TYPE_SAMPLE_LENGTH = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "normalizeLetterSpacing",
    () => normalizeLetterSpacing,
  );
  bindRuntimeValue(runtime, "TypeStyleRow", () => TypeStyleRow);
  bindRuntimeValue(
    runtime,
    "TYPE_CARD_KEY_PREFIX",
    () => TYPE_CARD_KEY_PREFIX,
    (value) => {
      TYPE_CARD_KEY_PREFIX = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TYPOGRAPHY_SECTION_LABEL",
    () => TYPOGRAPHY_SECTION_LABEL,
    (value) => {
      TYPOGRAPHY_SECTION_LABEL = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TypographySectionHeader",
    () => TypographySectionHeader,
  );
  bindRuntimeValue(runtime, "TypographySection", () => TypographySection);
  return () => {
    jsxTypographyEditors = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
    FONT_WEIGHT_LABELS = [
      [300, "Light"],
      [330, "Book"],
      [400, "Regular"],
      [430, "Text"],
      [500, "Medium"],
      [600, "Semibold"],
      [700, "Bold"],
      [800, "Heavy"],
    ];
    clampTypographyNumber = (
      value: number,
      minimum: number,
      maximum: number,
    ) =>
      Number.isFinite(value)
        ? Math.min(maximum, Math.max(minimum, value))
        : minimum;
    DEFAULT_TYPE_SAMPLE = "The quick brown fox jumps over the lazy dog";
    fontFileDisplayPath = (path: string) =>
      path.replace(/^(?:fonts|assets)\//, "");
    fontFileSlantLabel = (style: string) => style.replace(" ", " – ");
    LineHeightIcon = () => <runtime.Icon name={"LineHeight"} size={"xs"} />;
    LetterSpacingIcon = () => (
      <runtime.Icon name={"LetterSpacing"} size={"xs"} />
    );
    CUSTOM_FONT_FAMILY_SENTINEL = "\x00custom";
    MAX_TYPE_SAMPLE_LENGTH = 64;
    TYPE_CARD_KEY_PREFIX = "ds-card-type-";
    TYPOGRAPHY_SECTION_LABEL = "Typography";
  };
}
