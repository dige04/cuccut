import type * as React from "react";
import type * as Token from "../contracts/token-editors";
import type * as Model from "../contracts";
import type * as Color from "../contracts/color-controls";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installEditorColors(runtime: RuntimeBindings): () => void {
  var jsxColorEditors: typeof import("react/jsx-runtime");
  var COLORS_SECTION_LABEL: string;
  var COLOR_REQUEST_PENDING_MESSAGE: string;
  var colorCssConversionCache: Map<string, string | undefined>;
  function colorValueForTheme(
    token: Token.EditorColorToken,
    theme: string,
    firstThemeId?: string,
  ): Token.ThemeColorValue {
    let value = token.value[theme],
      value2 = (value === undefined || value === "") && theme !== firstThemeId,
      value3 = !value2
        ? (value ?? "")
        : firstThemeId !== undefined
          ? (token.value[firstThemeId] ?? "")
          : "",
      value4 = token.alias?.[theme];
    if (value4 !== undefined) {
      return {
        css: value4.css,
        to: value4.to,
        declared: value3,
        inherited: value2,
      };
    }
    return {
      css: value3 !== "" ? value3 : undefined,
      declared: value3,
      inherited: value2,
    };
  }
  function ColorSwatch({
    css: css,
    inherited: inherited,
    small: small,
  }: Token.ColorSwatchProps): React.ReactElement {
    let value = (0, runtime.isColorLiteral)(css as string) ? css! : null;
    return (
      <span
        className={(0, runtime.joinClassNames)(
          "ds-chip inline-flex",
          inherited && "ds-cchip-inh",
        )}
        data-color={value ?? undefined}
      >
        <runtime.ColorChip
          hex={value}
          className={(0, runtime.joinClassNames)(
            small ? "size-4!" : "size-5! rounded-[4px]!",
            inherited &&
              "outline-1 outline-offset-1 outline-dashed outline-border-strong",
          )}
        />
      </span>
    );
  }
  function colorCssForPicker(css: string | undefined): string | undefined {
    if (!(0, runtime.isColorLiteral)(css as string)) {
      return;
    }
    if (/^#[0-9a-f]{3,8}$/i.test(css!) || /^rgba?\(/i.test(css!)) {
      return css;
    }
    let entry = colorCssConversionCache.get(css!);
    if (entry !== undefined || colorCssConversionCache.has(css!)) {
      return entry;
    }
    let value = colorCssToRgba(css!);
    if (colorCssConversionCache.size > 2000) {
      colorCssConversionCache.clear();
    }
    colorCssConversionCache.set(css!, value);
    return value;
  }
  function colorCssToRgba(css: string): string {
    try {
      let value = document.createElement("canvas");
      value.width = value.height = 1;
      let value2 = value.getContext("2d", {
        willReadFrequently: true,
      });
      if (value2 === null) {
        return css;
      }
      value2.fillStyle = css;
      value2.fillRect(0, 0, 1, 1);
      let [data, data2, data3, data4] = value2.getImageData(0, 0, 1, 1).data,
        callback = (input: number | undefined) =>
          (input ?? 0).toString(16).padStart(2, "0");
      return (
        "#" +
        callback(data) +
        callback(data2) +
        callback(data3) +
        (data4 !== undefined && data4 < 255 ? callback(data4) : "")
      );
    } catch {
      return css;
    }
  }
  function useColorContrastReport(
    groups: Token.TokenNameGroup<Token.EditorColorToken>[],
    themes: Model.ColorTheme[],
    firstThemeId?: string,
  ): Token.ColorContrastFor {
    let memo = (runtime.reactColorEditors as typeof React).useMemo(
        () => groups.flatMap((input) => input.tokens),
        [groups],
      ),
      value = memo
        .map((input): string => input.name + "\x00" + (input.usage ?? ""))
        .join("\x01"),
      memo2 = (runtime.reactColorEditors as typeof React).useMemo<
        Map<
          string,
          {
            against: string[];
          }
        >
      >(() => (0, runtime.inferColorContrastPairs)(memo), [value]);
    return (runtime.reactColorEditors as typeof React).useMemo(() => {
      let entries = new Map<string, Token.EditorColorToken>(
          memo.map((input) => [input.name, input]),
        ),
        value2: boolean = themes.length > 1;
      return (input: Token.EditorColorToken, options: string) => {
        let entry = memo2.get(input.name);
        if (entry === undefined) {
          return;
        }
        let value3 =
            themes.find((input2): boolean => input2.id === options)?.name ??
            options,
          value4 = entry.against.flatMap((input2) => {
            let entry2 = entries.get(input2),
              value5 =
                entry2 === undefined
                  ? undefined
                  : colorCssForPicker(
                      colorValueForTheme(entry2, options, firstThemeId).css,
                    );
            if (
              value5 === undefined ||
              ((0, runtime.parseContrastColor)(value5)?.a ?? 0) < 1
            ) {
              return [];
            }
            return [
              {
                css: value5,
                label: value2 ? input2 + " (" + value3 + ")" : input2,
              },
            ];
          });
        if (value4.length === 0) {
          return undefined;
        } else {
          return {
            against: value4,
            role: "text",
          };
        }
      };
    }, [memo2, memo, themes, firstThemeId]);
  }
  function ColorValueCell({
    token: token,
    theme: theme,
    themes: themes,
    firstId: firstId,
    edit: edit,
    onGoto: onGoto,
    contrastFor: contrastFor,
    askClaude: askClaude,
    busy = false,
  }: Token.ColorValueCellProps): React.ReactElement {
    let value = colorValueForTheme(token, theme.id, firstId),
      [value2, value3] = (runtime.reactColorEditors as typeof React).useState(
        false,
      );
    if (value2 && !busy) {
      value3(false);
    }
    let value4 = contrastFor(token, theme.id),
      value5 = value4 === undefined ? undefined : JSON.stringify(value4),
      memo = (runtime.reactColorEditors as typeof React).useMemo(
        () => value4,
        [value5],
      ),
      ref = (
        runtime.reactColorEditors as typeof React
      ).useRef<HTMLSpanElement | null>(null),
      value6: string =
        token.name +
        " · " +
        theme.name +
        ": " +
        (value.to !== undefined
          ? "alias of " + value.to
          : (value.css ?? "no value")) +
        (value.inherited ? " (inherited)" : ""),
      callback = (): void => {
        let value12 = value.css ?? "";
        if (value12 !== "") {
          (0, runtime.copyTextToClipboard)(value12).then((input: boolean) =>
            (0, runtime.showEditorNotification)(
              input ? value12 + " copied" : value12,
            ),
          );
        }
      },
      value7 =
        themes[0] !== undefined && themes[0].id !== theme.id
          ? themes[0]
          : undefined,
      value8 = (
        <runtime.Button
          variant={"ghost"}
          size={"sm"}
          iconOnly={true}
          icon={<ColorSwatch css={value.css} inherited={value.inherited} />}
          className={(0, runtime.joinClassNames)(
            "ds-cchip",
            value.inherited && "ds-cchip-inh",
          )}
          aria-label={value6}
          tooltip={
            (themes.length > 1 ? theme.name + ": " : "") +
            "Copy " +
            (value.css ?? "")
          }
          data-testid={"ds-chip-" + token.name + "-" + theme.id}
          onClick={(event: React.MouseEvent<HTMLButtonElement>): void => {
            event.preventDefault();
            event.stopPropagation();
            callback();
          }}
        />
      ),
      memo2 = (runtime.reactColorEditors as typeof React).useMemo(
        () =>
          value.css !== undefined && (0, runtime.isColorLiteral)(value.css)
            ? /^#|^rgba?\(/i.test(value.css)
              ? value.css
              : (colorCssForPicker(value.css) ?? value.css)
            : undefined,
        [value.css],
      ),
      value9 = value.inherited ? undefined : memo2,
      memo3 = (runtime.reactColorEditors as typeof React).useMemo(
        () =>
          memo2 === undefined || memo === undefined
            ? undefined
            : (0, runtime.colorContrastResults)(memo2, memo),
        [memo2, memo],
      ),
      value10 =
        memo3 === undefined
          ? undefined
          : (0, runtime.worstContrastResult)(memo3),
      value11 = (
        <jsxColorEditors.Fragment>
          {[
            edit !== undefined ? (
              <span
                className={
                  "ds-crowfield min-w-0 flex-1 [--pp-label-w:0px] [--pp-gutter-l:0px] [--pp-gutter-r:0px]"
                }
                data-testid={"ds-hex-" + token.name + "-" + theme.id}
              >
                <runtime.ColorTextPropertyRow
                  label={token.name + " · " + theme.name}
                  value={value9}
                  editsAreUndoSteps={true}
                  popupAttrs={(0, runtime.commentTargetProps)(
                    "picker",
                    token.name + ":" + theme.id,
                  )}
                  {...(value.inherited && memo2 !== undefined
                    ? {
                        placeholder: memo2,
                      }
                    : {})}
                  {...(value.inherited && value7 !== undefined
                    ? {
                        clearLabel: "Inherits " + value7.name,
                      }
                    : {})}
                  {...(value.to !== undefined
                    ? {
                        title: "Alias of " + value.to,
                        description: "Alias of " + value.to,
                      }
                    : {})}
                  {...(memo !== undefined
                    ? {
                        contrast: memo,
                        contrastMark: true,
                      }
                    : {})}
                  onChange={(input: string): void => {
                    if (input === undefined) {
                      edit.clear?.(token.name, theme.id);
                      return;
                    }
                    edit.value(token.name, theme.id, input);
                    edit.done?.();
                  }}
                  onLive={(input: string) =>
                    edit.value(token.name, theme.id, input)
                  }
                  onLiveEnd={() => edit.done?.()}
                />
              </span>
            ) : (
              <span
                className={"ds-cchip-anchor relative inline-flex"}
                ref={ref}
              >
                {value8}
              </span>
            ),
            edit !== undefined ? null : value.to !== undefined ? (
              <runtime.TextLink
                className={(0, runtime.joinClassNames)(
                  "ds-calias min-w-0 truncate font-mono text-footnote",
                  value.inherited && "text-muted",
                )}
                icon={"ArrowRight"}
                iconPosition={"start"}
                onClick={() => onGoto(value.to!)}
                data-testid={"ds-alias-" + token.name + "-" + theme.id}
              >
                {value.to}
              </runtime.TextLink>
            ) : value.css !== undefined ? (
              <span
                className={(0, runtime.joinClassNames)(
                  "ds-chex min-w-0 truncate font-mono text-footnote",
                  value.inherited ? "text-muted" : "text-secondary",
                )}
                title={value.css}
                data-testid={"ds-hex-" + token.name + "-" + theme.id}
              >
                {value.css}
              </span>
            ) : null,
            edit === undefined && memo3 !== undefined ? (
              <runtime.ContrastMark results={memo3} />
            ) : null,
          ]}
        </jsxColorEditors.Fragment>
      );
    return (
      <span
        className={"ds-ccell flex min-w-0 items-center gap-sm"}
        role={"cell"}
        data-theme={themes.length > 1 ? theme.name : undefined}
        data-testid={"ds-cell-" + token.name + "-" + theme.id}
        data-id={(0, runtime.commentTargetId)(
          "cell",
          token.name + ":" + theme.id,
        )}
      >
        <span className={"flex min-w-0 flex-1 flex-col gap-0.5"}>
          {[
            <span className={"flex min-w-0 items-center gap-sm"}>
              {value11}
            </span>,
            memo3 !== undefined && value10 !== undefined && !value10.passes ? (
              <span
                className={
                  "flex min-w-0 flex-wrap items-center gap-x-sm gap-y-0.5"
                }
              >
                {[
                  <runtime.ContrastCaption
                    result={value10}
                    name={stripThemeSuffixFromColorLabel(
                      value10.ground.label,
                      theme,
                      themes,
                    )}
                  />,
                  edit !== undefined && askClaude !== undefined ? (
                    <runtime.DisabledReasonTooltip
                      reason={
                        busy && !value2
                          ? COLOR_REQUEST_PENDING_MESSAGE
                          : undefined
                      }
                    >
                      <runtime.Button
                        variant={"secondary"}
                        aria-label={
                          runtime.FIX_WITH_CLAUDE_LABEL +
                          ": " +
                          token.name +
                          (themes.length > 1
                            ? ", " + theme.name + " theme"
                            : "")
                        }
                        data-testid={"ds-fix-" + token.name + "-" + theme.id}
                        busy={busy && value2}
                        // CucCut: user-facing copy calls the agent "the agent", not Claude.
                        busyLabel={"Asking the agent"}
                        disabled={busy && !value2}
                        onClick={(
                          input: React.MouseEvent<HTMLButtonElement>,
                        ): void => {
                          value3(true);
                          askClaude(
                            colorContrastSummary(
                              token.name,
                              theme,
                              themes,
                              memo3,
                            ),
                            input.currentTarget,
                          );
                        }}
                      >
                        {runtime.FIX_WITH_CLAUDE_LABEL}
                      </runtime.Button>
                    </runtime.DisabledReasonTooltip>
                  ) : null,
                ]}
              </span>
            ) : null,
          ]}
        </span>
      </span>
    );
  }
  function stripThemeSuffixFromColorLabel(
    label: string,
    theme: Model.ColorTheme,
    themes: Model.ColorTheme[],
  ): string {
    let value: string = " (" + theme.name + ")";
    if (themes.length > 1 && label.endsWith(value)) {
      return label.slice(0, -value.length);
    } else {
      return label;
    }
  }
  function colorContrastSummary(
    token: string,
    theme: Model.ColorTheme,
    themes: Model.ColorTheme[],
    checks: Color.ContrastResult[],
  ): Token.ContrastRequest {
    let value = checks
        .filter((input): boolean => !input.passes)
        .sort((input, options) => input.ratio - options.ratio)
        .map((input) => ({
          ground: stripThemeSuffixFromColorLabel(
            input.ground.label,
            theme,
            themes,
          ),
          ratio: (0, runtime.contrastRatioReadout)(input.ratio),
        })),
      state = {
        token: token,
        theme: themes.length > 1 ? theme.id : undefined,
        failing: value,
        min: (0, runtime.contrastRatioReadout)(
          (0, runtime.worstContrastResult)(checks).min,
        ),
      },
      value2 = (0, runtime.artifactPageAddress)();
    return {
      label: runtime.FIX_WITH_CLAUDE_LABEL,
      request: (0, runtime.viewerColorContrastFixPrompt)(state, value2),
      prompt: (0, runtime.ownerColorContrastFixPrompt)(state, value2),
    };
  }
  function ColorTokenRow({
    token: token,
    themes: themes,
    firstId: firstId,
    edit: edit,
    names: names,
    onGoto: onGoto,
    flash: flash,
    rowRef: rowRef,
    gridStyle: gridStyle,
    contrastFor: contrastFor,
    askClaude: askClaude,
    busy: busy,
  }: Token.ColorTokenRowProps): React.ReactElement {
    let value = colorValueForTheme(token, firstId ?? "", firstId),
      value2 = (0, runtime.useRowContextMenu)(
        edit !== undefined || (value.css ?? "") !== "",
      ),
      callback = () =>
        document
          .querySelector<HTMLElement>(
            '[data-testid="ds-color-name-' + token.name + '"]',
          )
          ?.click();
    return (
      <div
        ref={rowRef}
        role={"row"}
        className={(0, runtime.joinClassNames)(
          "ds-crow ds-tokrow group/row",
          flash && "ds-flash",
        )}
        style={gridStyle}
        data-testid={"ds-color-" + token.name}
        {...(0, runtime.commentTargetProps)("token", token.name)}
        {...value2.rowProps}
      >
        {[
          <span className={"ds-cname min-w-0 font-mono"} role={"rowheader"}>
            <runtime.EditableName
              name={token.name}
              taken={names}
              commit={
                edit === undefined
                  ? undefined
                  : (input: string) => edit.rename(token.name, input)
              }
              data-testid={"ds-color-name-" + token.name}
            />
          </span>,
          <span className={"ds-ccells contents"} role={"none"}>
            {themes.map((input) =>
              (() => {
                const _Element = ColorValueCell;
                const _elementProps = {
                  token: token,
                  theme: input,
                  themes: themes,
                  firstId: firstId,
                  edit: edit,
                  onGoto: onGoto,
                  contrastFor: contrastFor,
                  ...(askClaude !== undefined
                    ? {
                        askClaude: askClaude,
                      }
                    : {}),
                  ...(busy !== undefined
                    ? {
                        busy: busy,
                      }
                    : {}),
                };
                const _elementKey = input.id;
                return <_Element key={_elementKey} {..._elementProps} />;
              })(),
            )}
          </span>,
          <span
            className={
              "ds-cacts ds-cgutter relative flex items-center justify-center"
            }
            role={"cell"}
            {...runtime.UNCOMMENTABLE_PROPS}
          >
            {[
              <runtime.UsageNoteEditor
                value={token.usage ?? ""}
                label={token.name}
                anchorKey={"color/" + token.name}
                onChange={
                  edit === undefined
                    ? undefined
                    : (input: string) => edit.usage(token.name, input)
                }
                onDone={edit?.done}
                data-testid={"ds-color-usage-" + token.name}
              />,
              edit !== undefined ? (
                <runtime.RemoveRowButton
                  label={"Remove " + token.name}
                  onRemove={() => edit.remove(token.name)}
                  data-testid={"ds-color-remove-" + token.name}
                />
              ) : null,
            ]}
          </span>,
          <runtime.RowContextMenu
            title={token.name}
            at={value2.at}
            anchor={value2.anchor}
            onClose={value2.close}
            testid={"ds-color-menu-" + token.name}
            actions={{
              ...(edit !== undefined
                ? {
                    rename: callback,
                    remove: () => edit.remove(token.name),
                    removeLabel: "Remove " + token.name,
                  }
                : {}),
              copy: value.css ?? "",
              ...(value.to !== undefined
                ? {
                    goto: () => onGoto(value.to!),
                    gotoLabel: "Go to " + value.to,
                  }
                : {}),
              ...(edit?.clear !== undefined && themes[0] !== undefined
                ? {
                    inherit: themes
                      .slice(1)
                      .filter(
                        (input): boolean =>
                          !colorValueForTheme(token, input.id, firstId)
                            .inherited,
                      )
                      .map((input) => ({
                        label: input.name + ": inherit " + themes[0].name,
                        run: () => edit.clear?.(token.name, input.id),
                      })),
                  }
                : {}),
            }}
          />,
        ]}
      </div>
    );
  }
  function colorThemeGridStyle(themeCount: number): {
    style: import("../contracts/controls").DesignStyle;
  } {
    return {
      style: {
        "--ds-themes": String(Math.max(1, themeCount)),
      },
    };
  }
  function normalizeThemeId(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }
  function ColorsSectionHeader({
    edit: edit,
    note: note,
  }: Token.EditorSectionHeaderProps<Token.ColorEdit>): React.ReactElement {
    let value = edit?.addGroup;
    return (
      <runtime.SectionHeader
        title={COLORS_SECTION_LABEL}
        note={note}
        pageId={"colors"}
        data-testid={"ds-colors-head"}
        actions={
          value === undefined ? undefined : (
            <jsxColorEditors.Fragment>
              <runtime.SectionAddButton
                label={"Add"}
                what={"Add color group"}
                onClick={() => value(true)}
                data-testid={"ds-add-color-group"}
              />
            </jsxColorEditors.Fragment>
          )
        }
      />
    );
  }
  function ColorsSection({
    themes: themes,
    groups: groups,
    edit: edit,
    names: names,
    askClaude: askClaude,
    busy: busy,
  }: Token.ColorsSectionProps): React.ReactElement | null {
    let value =
        themes.length > 0
          ? themes
          : [
              {
                id: "light",
                name: "Value",
              },
            ],
      value2 = themes[0]?.id,
      value3 = useColorContrastReport(groups, value, value2),
      [value4, value5] = (runtime.reactColorEditors as typeof React).useState<
        string | null
      >(null),
      [value6, value7] = (runtime.reactColorEditors as typeof React).useState<
        string | null
      >(null),
      ref = (runtime.reactColorEditors as typeof React).useRef(
        new Map<string, HTMLDivElement>(),
      ),
      memo = (runtime.reactColorEditors as typeof React).useMemo(
        () =>
          names ??
          new Set(
            groups.flatMap((input) =>
              input.tokens.map((input2) => input2.name),
            ),
          ),
        [names, groups],
      ),
      callback = (input: string): void => {
        if (
          !groups.some((input2) =>
            input2.tokens.some((input3): boolean => input3.name === input),
          )
        ) {
          (0, runtime.showEditorNotification)(input + " is not in this file");
          return;
        }
        value7(input);
      };
    (runtime.reactColorEditors as typeof React).useLayoutEffect((): void => {
      if (value6 === null) {
        return;
      }
      let entry = ref.current.get(value6);
      value7(null);
      if (entry === undefined) {
        return;
      }
      if (typeof entry.scrollIntoView === "function") {
        entry.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
      value5(value6);
    }, [value6]);
    (runtime.reactColorEditors as typeof React).useEffect(() => {
      if (value4 === null) {
        return;
      }
      let value10 = window.setTimeout(() => value5(null), 1200);
      return () => window.clearTimeout(value10);
    }, [value4]);
    if (
      groups.reduce((input, options) => input + options.tokens.length, 0) === 0
    ) {
      return null;
    }
    let value8 = colorThemeGridStyle(value.length),
      value9 = (
        <div
          className={"ds-crow ds-chead text-caption text-muted"}
          role={"row"}
          style={value8.style}
          {...runtime.UNCOMMENTABLE_PROPS}
        >
          {[
            <span role={"columnheader"}>{"Name"}</span>,
            value.map((input) =>
              (() => {
                const _Element2 = "span";
                const _elementProps2 = {
                  role: "columnheader",
                  className: "ds-chead-th truncate",
                  children: input.name,
                };
                const _elementKey2 = input.id;
                return <_Element2 key={_elementKey2} {..._elementProps2} />;
              })(),
            ),
            <span
              role={"columnheader"}
              className={"ds-cgutter"}
              aria-hidden={"true"}
            />,
          ]}
        </div>
      ),
      callback2 = (input: Token.EditorColorToken[], options: string) => (
        <div className={"ds-cscroll overflow-x-auto"}>
          <div
            className={"ds-ctable"}
            role={"table"}
            aria-label={options + " colors"}
            data-edit={edit !== undefined ? "" : undefined}
          >
            {[
              value9,
              input.map((input2) => {
                return (() => {
                  const _Element3 = ColorTokenRow;
                  const _elementProps3 = {
                    token: input2,
                    themes: value,
                    firstId: value2,
                    edit: edit,
                    names: memo,
                    onGoto: callback,
                    flash: value4 === input2.name,
                    rowRef: (input3: HTMLDivElement | null): void => {
                      if (input3 === null) {
                        ref.current.delete(input2.name);
                      } else {
                        ref.current.set(input2.name, input3);
                      }
                    },
                    gridStyle: value8.style,
                    contrastFor: value3,
                    ...(askClaude !== undefined
                      ? {
                          askClaude: askClaude,
                        }
                      : {}),
                    ...(busy !== undefined
                      ? {
                          busy: busy,
                        }
                      : {}),
                  };
                  const _elementKey3 = input2.name;
                  return <_Element3 key={_elementKey3} {..._elementProps3} />;
                })();
              }),
            ]}
          </div>
        </div>
      ),
      callback3 = (input: Token.TokenNameGroup<Token.EditorColorToken>) =>
        input.name === "" ? runtime.PALETTE_GROUP_NAME : input.name,
      callback4 = (input: Token.TokenNameGroup<Token.EditorColorToken>) =>
        input.name === ""
          ? runtime.PALETTE_GROUP_NAME.toLowerCase()
          : input.name,
      values = new Set(groups.map((input) => callback4(input))),
      callback5 = (input: Token.TokenNameGroup<Token.EditorColorToken>) => {
        let value10 = edit?.renameGroup;
        if (value10 === undefined) {
          return;
        }
        return (input2: string) => {
          let value11 = normalizeThemeId(input2);
          if (value11 === "") {
            (0, runtime.showEditorNotification)("A group needs a name.");
            return true;
          }
          if (
            value11 === input.name ||
            (input.name === "" &&
              value11 === runtime.PALETTE_GROUP_NAME.toLowerCase())
          ) {
            return true;
          }
          if (values.has(value11)) {
            (0, runtime.showEditorNotification)(
              "There is already a " + value11 + " group",
            );
            return true;
          }
          if (!value10(input, value11)) {
            (0, runtime.showEditorNotification)(
              "Could not rename " +
                callback3(input) +
                " — a token name is already taken.",
            );
            return true;
          }
          return value11;
        };
      };
    return (
      <div
        className={"ds-colors flex flex-col gap-[48px]"}
        data-testid={"ds-colors"}
      >
        {groups.map((input) => {
          let value10 = callback4(input),
            value11 = callback3(input);
          return (() => {
            const _Element4 = "section";
            const _elementProps4 = {
              className: (0, runtime.joinClassNames)(
                "ds-cgroup flex min-w-0 flex-col",
                input.name === "" && "ds-cgroup-loose",
              ),
              "aria-label": value11,
              "data-testid": "ds-color-group-" + value10,
              "data-id": (0, runtime.commentTargetId)("cgroup", input.name),
              children: [
                <div
                  className={
                    "ds-cgroup-head flex min-h-10 min-w-0 items-center gap-xs pb-xs"
                  }
                  data-testid={"ds-color-group-" + value10 + "-head"}
                  {...runtime.COMMENT_TARGET_PROPS}
                >
                  {[
                    <span className={"min-w-0 flex-1"}>
                      <runtime.EditableName
                        name={value11}
                        taken={values}
                        commit={callback5(input)}
                        className={"ds-gname"}
                        data-testid={"ds-color-group-" + value10 + "-name"}
                      />
                    </span>,
                    edit?.removeGroup !== undefined ? (
                      <runtime.RemoveSectionButton
                        label={value11}
                        icon={"Trash"}
                        verb={"Delete"}
                        onRemove={() => edit.removeGroup?.(input)}
                        data-testid={"ds-color-group-" + value10 + "-delete"}
                      />
                    ) : null,
                    edit?.addTo !== undefined ? (
                      <runtime.Button
                        variant={"ghost"}
                        size={"sm"}
                        iconOnly={true}
                        icon={"Add"}
                        aria-label={"Add color to " + value11}
                        tooltip={"Add color"}
                        onClick={() => edit.addTo?.(input)}
                        data-testid={"ds-add-color-" + value10}
                        {...runtime.UNCOMMENTABLE_PROPS}
                      />
                    ) : null,
                  ]}
                </div>,
                callback2(input.tokens, value11),
              ],
            };
            const _elementKey4 = value10;
            return <_Element4 key={_elementKey4} {..._elementProps4} />;
          })();
        })}
      </div>
    );
  }
  bindRuntimeValue(
    runtime,
    "jsxColorEditors",
    () => jsxColorEditors,
    (value) => {
      jsxColorEditors = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COLORS_SECTION_LABEL",
    () => COLORS_SECTION_LABEL,
    (value) => {
      COLORS_SECTION_LABEL = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COLOR_REQUEST_PENDING_MESSAGE",
    () => COLOR_REQUEST_PENDING_MESSAGE,
    (value) => {
      COLOR_REQUEST_PENDING_MESSAGE = value;
    },
  );
  bindRuntimeValue(runtime, "colorValueForTheme", () => colorValueForTheme);
  bindRuntimeValue(runtime, "ColorSwatch", () => ColorSwatch);
  bindRuntimeValue(
    runtime,
    "colorCssConversionCache",
    () => colorCssConversionCache,
    (value) => {
      colorCssConversionCache = value;
    },
  );
  bindRuntimeValue(runtime, "colorCssForPicker", () => colorCssForPicker);
  bindRuntimeValue(runtime, "colorCssToRgba", () => colorCssToRgba);
  bindRuntimeValue(
    runtime,
    "useColorContrastReport",
    () => useColorContrastReport,
  );
  bindRuntimeValue(runtime, "ColorValueCell", () => ColorValueCell);
  bindRuntimeValue(
    runtime,
    "stripThemeSuffixFromColorLabel",
    () => stripThemeSuffixFromColorLabel,
  );
  bindRuntimeValue(runtime, "colorContrastSummary", () => colorContrastSummary);
  bindRuntimeValue(runtime, "ColorTokenRow", () => ColorTokenRow);
  bindRuntimeValue(runtime, "colorThemeGridStyle", () => colorThemeGridStyle);
  bindRuntimeValue(runtime, "normalizeThemeId", () => normalizeThemeId);
  bindRuntimeValue(runtime, "ColorsSectionHeader", () => ColorsSectionHeader);
  bindRuntimeValue(runtime, "ColorsSection", () => ColorsSection);
  return () => {
    jsxColorEditors = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
    COLORS_SECTION_LABEL = "Colors";
    // CucCut: user-facing copy calls the agent "the agent", not Claude.
    COLOR_REQUEST_PENDING_MESSAGE = "A request to the agent is on its way";
    colorCssConversionCache = new Map();
  };
}
