import type * as React from "react";
import type * as Token from "../contracts/token-editors";
import type * as Model from "../contracts";
import type * as Color from "../contracts/color-controls";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installEditorShadows(runtime: RuntimeBindings): () => void {
  var stopFileDropEvent: (event: React.DragEvent<HTMLElement>) => void;
  var BLOCK_FILE_DROP_HANDLERS: Pick<
    React.HTMLAttributes<HTMLElement>,
    "onDragEnter" | "onDragOver" | "onDragLeave" | "onDrop"
  >;
  var reactShadowEditors: typeof import("react");
  var reactDomShadowEditors: typeof import("react-dom");
  var jsxShadowEditors: typeof import("react/jsx-runtime");
  var safeShadowPreviewStyle: (shadow: string) => React.CSSProperties;
  var joinBoxShadowLayers: (layers: string[]) => string;
  var DEFAULT_BOX_SHADOW: string;
  var DEFAULT_BOX_SHADOW_VALUES: Token.SingleBoxShadow;
  function parseSingleBoxShadow(shadow: string): Token.SingleBoxShadow | null {
    let value = shadow.trim();
    if (
      value === "" ||
      splitBoxShadowLayers(value).length !== 1 ||
      /\binset\b|var\(|color-mix\(|\bcolor\(/i.test(value)
    ) {
      return null;
    }
    let value2: RegExp =
        /((?:rgba?|hsla?|oklch|oklab|lab|lch|color)\([^)]*\)|#[0-9a-f]{3,8}|\b[a-z]+\b)/i,
      value3 =
        value.match(
          /(?:(?:rgba?|hsla?|oklch|oklab|lab|lch|color)\([^)]*\))|\S+/gi,
        ) ?? [],
      items: number[] = [],
      value4: string | null = null;
    for (let value5 of value3) {
      let value6 = /^(-?(?:\d+|\d*\.\d+))(px)?$/.exec(value5);
      if (value6 !== null && (value6[2] === "px" || value6[1] === "0")) {
        items.push(Number(value6[1]));
      } else if (value4 === null && value2.test(value5)) {
        value4 = value5;
      } else {
        return null;
      }
    }
    if (items.length < 2 || items.length > 4 || value4 === null) {
      return null;
    }
    return {
      x: items[0] ?? 0,
      y: items[1] ?? 0,
      blur: items[2] ?? 0,
      spread: items[3] ?? 0,
      color: value4,
    };
  }
  function serializeSingleBoxShadow(shadow: Token.SingleBoxShadow): string {
    let callback = (input: number): string =>
      input === 0 ? "0" : String(input) + "px";
    return [
      callback(shadow.x),
      callback(shadow.y),
      callback(shadow.blur),
      ...(shadow.spread !== undefined && shadow.spread !== 0
        ? [callback(shadow.spread)]
        : []),
      shadow.color,
    ].join(" ");
  }
  function boxShadowSummary(shadow: string): Token.ShadowSummary {
    let value = shadow.trim();
    if (value === "" || value === "none") {
      return {
        text: "None",
        color: null,
      };
    }
    let value2 = parseSingleBoxShadow(value);
    if (value2 !== null) {
      return {
        text:
          String(value2.x) +
          ", " +
          String(value2.y) +
          " · " +
          String(value2.blur) +
          "px" +
          (value2.spread !== undefined && value2.spread !== 0
            ? " · " + String(value2.spread) + "px"
            : ""),
        color: value2.color,
      };
    }
    let value3 = splitBoxShadowLayers(value),
      value4 = parseSingleBoxShadow(value3[0] ?? "");
    return {
      text: value3.length > 1 ? String(value3.length) + " layers" : value,
      color: value4?.color ?? null,
    };
  }
  function splitBoxShadowLayers(shadow: string): string[] {
    let value = shadow.trim();
    if (value === "" || value.toLowerCase() === "none") {
      return [];
    }
    let items = [],
      index: number = 0,
      index2 = 0;
    for (let index3: number = 0; index3 < value.length; index3++) {
      let value2 = value[index3];
      if (value2 === "(") {
        index++;
      } else if (value2 === ")") {
        index = Math.max(0, index - 1);
      } else if (value2 === "," && index === 0) {
        items.push(value.slice(index2, index3).trim());
        index2 = index3 + 1;
      }
    }
    items.push(value.slice(index2).trim());
    return items.filter(
      (input) => input !== "" && input.toLowerCase() !== "none",
    );
  }
  function ShadowValueEditor({
    label: label,
    value: value,
    onChange: onChange,
    onLive: onLive,
    onLiveEnd: onLiveEnd,
    testid: testid,
    clear: clear,
    anchorKey: anchorKey,
    editsAreUndoSteps: editsAreUndoSteps,
  }: Token.ShadowValueEditorProps): React.ReactElement {
    let value2 = splitBoxShadowLayers(value),
      value3 = value2.length === 0 ? [""] : value2,
      value4: boolean = value3.length <= 1,
      ref = reactShadowEditors.useRef(value);
    ref.current = value;
    let callback = () => {
        let value13 = splitBoxShadowLayers(ref.current);
        if (value13.length === 0) {
          return [""];
        } else {
          return value13;
        }
      },
      callback2 = (input: number, options: string) => {
        let value13 = callback();
        if (input < value13.length) {
          return joinBoxShadowLayers(
            value13.map((input2, options2) =>
              options2 === input ? options : input2,
            ),
          );
        } else {
          return null;
        }
      },
      callback3 = (input: number, options: string): void => {
        let value13 = callback2(input, options);
        if (value13 !== null) {
          ref.current = value13;
          onChange(value13);
        }
      },
      [value5, value6] = reactShadowEditors.useState(false),
      [value7, value8] = reactShadowEditors.useState<number | null>(null);
    reactShadowEditors.useEffect((): void => {
      if (!value5) {
        value8(null);
      }
    }, [value5]);
    let ref2 = reactShadowEditors.useRef(false),
      ref3 = reactShadowEditors.useRef(false),
      ref4 = reactShadowEditors.useRef<HTMLSpanElement | null>(null),
      ref5 = reactShadowEditors.useRef<HTMLDivElement | null>(null),
      callback4 = (): void => {
        let activeElement = document.activeElement;
        if (
          activeElement instanceof HTMLElement &&
          activeElement.tagName === "INPUT"
        ) {
          reactDomShadowEditors.flushSync(() => activeElement.blur());
        }
      },
      callback5 = (input: number): void => {
        callback4();
        let value13 = joinBoxShadowLayers(
          callback().filter((input2, options): boolean => options !== input),
        );
        ref.current = value13;
        onChange(value13);
        value8(null);
      },
      callback6 = (input: React.MouseEvent<HTMLButtonElement>): void => {
        callback4();
        ref3.current = input.detail === 0;
        let value13 = callback().filter(
            (input2): boolean => input2.trim() !== "",
          ),
          value14 = joinBoxShadowLayers([...value13, DEFAULT_BOX_SHADOW]);
        ref.current = value14;
        onChange(value14);
        value8(value13.length);
      },
      callback7 = () =>
        ref5.current?.closest('[data-kit="effect-editor"]') ?? ref5.current,
      callback8 = (): "bottom" | "right" =>
        typeof window !== "undefined" && window.innerWidth < 720
          ? "bottom"
          : "right",
      value9 =
        value.trim() === ""
          ? {
              text: "none",
              color: null,
            }
          : boxShadowSummary(value),
      callback9 = (input: string) =>
        /^#|^rgba?\(/i.test(input)
          ? input
          : ((0, runtime.colorCssForPicker)(input) ?? input),
      value10 = (
        <runtime.Button
          variant={"ghost"}
          size={"sm"}
          iconOnly={true}
          icon={"Add"}
          aria-label={"Add a layer"}
          tooltip={"Add layer"}
          className={"ml-auto"}
          onClick={callback6}
          data-testid={testid + "-add-layer"}
        />
      ),
      callback10 = (input: React.ReactNode, options: boolean) => (
        <span className={"flex w-full items-center gap-1"}>
          {[
            <span className={"min-w-0 truncate"}>{input}</span>,
            options ? value10 : null,
          ]}
        </span>
      ),
      value11 =
        clear !== undefined && value.trim() !== "" ? (
          <div className={"px-md pb-sm"}>
            <runtime.TextLink
              className={"text-footnote"}
              icon={"ArrowCounterClockwise"}
              iconPosition={"start"}
              onClick={(): void => {
                clear.run();
                value6(false);
              }}
              data-testid={testid + "-clear"}
            >
              {clear.label}
            </runtime.TextLink>
          </div>
        ) : null,
      callback11 = (
        input: number,
        options: React.ReactNode,
        context: boolean,
        value13: () => void,
      ) => {
        let value14 = value3[input] ?? "",
          value15 =
            value14.trim() === ""
              ? DEFAULT_BOX_SHADOW_VALUES
              : parseSingleBoxShadow(value14),
          value16 = value15 !== null ? callback9(value15.color) : "",
          value17 =
            value15 !== null
              ? {
                  ...value15,
                  color: value16,
                }
              : null,
          callback12 = (input2: Token.SingleBoxShadow) =>
            value15 !== null && input2.color === value16
              ? {
                  ...input2,
                  color: value15.color,
                }
              : input2;
        if (value17 !== null) {
          return (
            <runtime.ShadowPropertyEditor
              title={callback10(options, context)}
              value={value17}
              spread={true}
              editsAreUndoSteps={editsAreUndoSteps}
              onChange={(input2: Token.SingleBoxShadow) =>
                callback3(input, serializeSingleBoxShadow(callback12(input2)))
              }
              {...(onLive !== undefined && onLiveEnd !== undefined
                ? {
                    onLive: (input2: Token.SingleBoxShadow): void => {
                      let value18 = callback2(
                        input,
                        serializeSingleBoxShadow(callback12(input2)),
                      );
                      if (value18 !== null) {
                        onLive(value18);
                      }
                    },
                    onLiveEnd: onLiveEnd,
                  }
                : {})}
              onClose={value13}
            />
          );
        } else {
          return (
            <runtime.PropertyPopoverPanel
              title={callback10(options, context)}
              onClose={value13}
              labelWidth={"0px"}
            >
              <p
                className={"px-md pb-sm text-footnote text-muted"}
                data-testid={testid + "-cssnote"}
              >
                {[
                  "Written as CSS",
                  <span
                    className={"block truncate font-mono text-caption"}
                    title={value14}
                  >
                    {value14}
                  </span>,
                  // CucCut: user-facing copy calls the agent "the agent", not Claude.
                  "Ask the agent to change it.",
                ]}
              </p>
            </runtime.PropertyPopoverPanel>
          );
        }
      },
      value12 = value7 !== null && value7 < value3.length ? value7 : null;
    return (
      <span
        className={"relative flex min-w-0 flex-1"}
        ref={ref4}
        data-testid={testid}
      >
        <runtime.PropertyPopover
          open={value5}
          editsAreUndoSteps={editsAreUndoSteps}
          onOpenChange={(input: boolean): void => {
            if (!input) {
              callback4();
            }
            value6(input);
          }}
          trigger={
            <runtime.PropertyPopoverTrigger
              label={label}
              color={value9.color !== null ? callback9(value9.color) : null}
              text={value9.text}
              onClick={(input: React.MouseEvent<HTMLButtonElement>): void => {
                ref2.current = input.detail === 0;
              }}
            />
          }
          anchor={() => ref4.current}
          side={"bottom"}
          focusOnOpen={ref2.current}
          className={value4 ? undefined : "w-[17rem]"}
        >
          <runtime.CdsRoot density={"compact"} className={"contents"}>
            <div
              {...(anchorKey !== undefined
                ? {
                    role: "group",
                    "aria-label": "Shadow " + label,
                    ...(0, runtime.commentTargetProps)(
                      "editor",
                      "shadow/" + anchorKey,
                    ),
                  }
                : {
                    className: "contents",
                  })}
            >
              {!value5 ? null : value4 ? (
                <jsxShadowEditors.Fragment>
                  {[
                    callback11(0, "Shadow", true, (): void => {
                      callback4();
                      value6(false);
                    }),
                    value11,
                  ]}
                </jsxShadowEditors.Fragment>
              ) : (
                <runtime.PropertyPopoverPanel
                  title={callback10("Shadow", true)}
                  onClose={(): void => {
                    callback4();
                    value6(false);
                  }}
                  labelWidth={"0px"}
                >
                  {[
                    <div
                      ref={ref5}
                      className={"flex flex-col gap-1 px-md pb-sm"}
                      data-step={"2"}
                      data-testid={testid + "-layers"}
                    >
                      {value3.map((input, options) => {
                        let value13 = boxShadowSummary(input);
                        return (() => {
                          const _Element = "span";
                          const _elementProps = {
                            className: "flex min-w-0 items-center gap-1",
                            children: [
                              <span
                                className={"relative flex min-w-0 flex-1"}
                                data-testid={
                                  testid + "-layer-" + String(options)
                                }
                              >
                                <runtime.PropertyPopover
                                  open={value12 === options}
                                  editsAreUndoSteps={editsAreUndoSteps}
                                  onOpenChange={(input2: boolean): void => {
                                    callback4();
                                    value8(input2 ? options : null);
                                  }}
                                  trigger={
                                    <runtime.PropertyPopoverTrigger
                                      label={
                                        label +
                                        " · layer " +
                                        String(options + 1)
                                      }
                                      color={
                                        value13.color !== null
                                          ? callback9(value13.color)
                                          : null
                                      }
                                      text={value13.text}
                                      onClick={(
                                        input2: React.MouseEvent<HTMLButtonElement>,
                                      ): void => {
                                        ref3.current = input2.detail === 0;
                                      }}
                                    />
                                  }
                                  anchor={callback7}
                                  side={callback8()}
                                  focusOnOpen={ref3.current}
                                >
                                  <runtime.CdsRoot
                                    density={"compact"}
                                    className={"contents"}
                                  >
                                    <div
                                      {...(anchorKey !== undefined &&
                                      value12 === options
                                        ? {
                                            role: "group",
                                            "aria-label":
                                              label +
                                              " layer " +
                                              String(options + 1),
                                            ...(0, runtime.commentTargetProps)(
                                              "editor",
                                              "shadow/" +
                                                anchorKey +
                                                "/layer-" +
                                                String(options + 1),
                                            ),
                                          }
                                        : {
                                            className: "contents",
                                          })}
                                    >
                                      {value12 === options
                                        ? callback11(
                                            options,
                                            "Layer " + String(options + 1),
                                            false,
                                            (): void => {
                                              callback4();
                                              value8(null);
                                            },
                                          )
                                        : null}
                                    </div>
                                  </runtime.CdsRoot>
                                </runtime.PropertyPopover>
                              </span>,
                              <runtime.RemovePropertyButton
                                label={"layer " + String(options + 1)}
                                disabled={value3.length === 1}
                                onClick={() => callback5(options)}
                              />,
                            ],
                          };
                          const _elementKey = options;
                          return (
                            <_Element key={_elementKey} {..._elementProps} />
                          );
                        })();
                      })}
                    </div>,
                    value11,
                  ]}
                </runtime.PropertyPopoverPanel>
              )}
            </div>
          </runtime.CdsRoot>
        </runtime.PropertyPopover>
      </span>
    );
  }
  function ShadowValueCell({
    t: t,
    theme: theme,
    edit: edit,
    testid: testid,
  }: Token.ShadowValueCellProps): React.ReactElement {
    let value = t.value[theme.id] ?? "";
    if (edit === undefined) {
      let value2 = boxShadowSummary(value);
      return (
        <runtime.TooltipWrapper tip={"Copy " + value}>
          <runtime.Button
            variant={"ghost"}
            size={"sm"}
            className={
              "ds-shbrief min-w-0 justify-start font-mono text-footnote text-muted"
            }
            icon={
              <span
                className={
                  "ds-shf-swatch block h-3 w-4 shrink-0 rounded-sm bg-surface-1"
                }
                style={safeShadowPreviewStyle(value)}
                aria-hidden={"true"}
              />
            }
            aria-label={t.name + " · " + theme.name + ": " + value + " — copy"}
            data-testid={testid}
            onClick={() =>
              void (0, runtime.copyTextToClipboard)(value).then(
                (input: boolean) =>
                  (0, runtime.showEditorNotification)(
                    input
                      ? "Copied " + t.name + " (" + theme.name + ")"
                      : "Couldn’t copy",
                  ),
              )
            }
          >
            <span className={"min-w-0 truncate"}>{value2.text}</span>
          </runtime.Button>
        </runtime.TooltipWrapper>
      );
    }
    return (
      <ShadowValueEditor
        label={t.name + " · " + theme.name}
        anchorKey={t.name + ":" + theme.id}
        value={value}
        editsAreUndoSteps={true}
        onChange={(input: string) => edit.value(t.name, theme.id, input)}
        {...(edit.live !== undefined && edit.done !== undefined
          ? {
              onLive: (input: string) => edit.live?.(t.name, theme.id, input),
              onLiveEnd: () => edit.done?.(),
            }
          : {})}
        testid={testid}
      />
    );
  }
  function ShadowTokenRow({
    t: t,
    themes: themes,
    grounds: grounds,
    preview: preview,
    taken: taken,
    edit: edit,
  }: Token.ShadowTokenRowProps): React.ReactElement {
    let value = (0, runtime.useRowContextMenu)(
        edit !== undefined || (t.value[preview.id] ?? "") !== "",
      ),
      value2 =
        edit === undefined
          ? undefined
          : (input: string) => edit.rename(t.name, input),
      callback = () =>
        document
          .querySelector<HTMLElement>(
            '[data-testid="ds-shadow-name-' + t.name + '"]',
          )
          ?.click();
    return (
      <div
        className={"ds-srow ds-tokrow ds-crow group/row"}
        role={"row"}
        style={{
          ["--ds-themes"]: String(themes.length),
        } as import("../contracts/controls").DesignStyle}
        data-testid={"ds-shadow-" + t.name}
        {...(0, runtime.commentTargetProps)("token", t.name)}
        {...value.rowProps}
      >
        {[
          <span
            className={"ds-cname ds-shname flex min-w-0 items-start font-mono"}
            role={"rowheader"}
            data-testid={"ds-shadow-line-" + t.name}
          >
            <runtime.EditableName
              name={t.name}
              taken={taken}
              commit={value2}
              data-testid={"ds-shadow-name-" + t.name}
            />
          </span>,
          <span className={"ds-ccells contents"}>
            {themes.map((input) =>
              (() => {
                const _Element2 = "span";
                const _elementProps2 = {
                  className:
                    "ds-ccell ds-shcell flex min-w-0 flex-col items-stretch gap-sm",
                  role: "cell",
                  "data-theme": themes.length > 1 ? input.name : undefined,
                  children: [
                    <span
                      className={"ds-shadow-well"}
                      style={
                        grounds?.[input.id] !== undefined
                          ? {
                              background: grounds[input.id].well,
                            }
                          : undefined
                      }
                      data-testid={"ds-shadow-stage-" + t.name + "-" + input.id}
                    >
                      <span
                        className={"ds-shadow-surface"}
                        style={{
                          ...safeShadowPreviewStyle(t.value[input.id] ?? ""),
                          ...(grounds?.[input.id] !== undefined
                            ? {
                                background: grounds[input.id].card,
                              }
                            : {}),
                        }}
                        data-testid={
                          "ds-shadow-surface-" +
                          t.name +
                          (input.id === preview.id ? "" : "-" + input.id)
                        }
                      />
                    </span>,
                    <ShadowValueCell
                      t={t}
                      theme={input}
                      edit={edit}
                      testid={"ds-shadow-summary-" + t.name + "-" + input.id}
                    />,
                  ],
                };
                const _elementKey2 = input.id;
                return <_Element2 key={_elementKey2} {..._elementProps2} />;
              })(),
            )}
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
                value={t.usage ?? ""}
                label={t.name}
                anchorKey={"shadow/" + t.name}
                onChange={
                  edit === undefined
                    ? undefined
                    : (input: string) => edit.usage(t.name, input)
                }
                onDone={edit?.done}
                data-testid={"ds-shadow-usage-" + t.name}
              />,
              edit !== undefined ? (
                <runtime.RemoveRowButton
                  label={"Remove " + t.name}
                  onRemove={() => edit.remove(t.name)}
                  data-testid={"ds-shadow-remove-" + t.name}
                />
              ) : null,
            ]}
          </span>,
          <runtime.RowContextMenu
            title={t.name}
            at={value.at}
            anchor={value.anchor}
            onClose={value.close}
            testid={"ds-shadow-menu-" + t.name}
            actions={{
              ...(edit !== undefined
                ? {
                    rename: callback,
                    remove: () => edit.remove(t.name),
                    removeLabel: "Remove " + t.name,
                  }
                : {}),
              copy: t.value[preview.id] ?? "",
            }}
          />,
        ]}
      </div>
    );
  }
  function ShadowsSection({
    shadows: shadows,
    themes: themes,
    grounds: grounds,
    previewThemeId: previewThemeId,
    edit: edit,
    head: head,
  }: Token.ShadowsSectionProps): React.ReactElement | null {
    if (shadows.tokens.length === 0) {
      return null;
    }
    let values = new Set(shadows.tokens.map((input) => input.name)),
      value = themes.find((input): boolean => input.id === previewThemeId) ??
        themes[0] ?? {
          id: "",
          name: "",
        };
    return (
      <runtime.TokenTableSection
        className={"ds-scale ds-scale-shadow"}
        name={null}
        data-testid={"ds-shadows"}
        aria-label={head?.title ?? "Shadows"}
      >
        <div className={"ds-cscroll overflow-x-auto"}>
          <div
            className={"ds-ctable ds-shtable"}
            role={"table"}
            aria-label={"Shadows"}
            style={{
              ["--ds-themes"]: String(themes.length),
            } as import("../contracts/controls").DesignStyle}
            data-edit={edit !== undefined ? "" : undefined}
          >
            {[
              <div
                className={"ds-crow ds-chead text-caption text-muted"}
                role={"row"}
                {...runtime.UNCOMMENTABLE_PROPS}
              >
                {[
                  <span role={"columnheader"}>{"Name"}</span>,
                  themes.map((input) =>
                    (() => {
                      const _Element3 = "span";
                      const _elementProps3 = {
                        role: "columnheader",
                        className: "truncate",
                        title: input.name,
                        children: input.name,
                      };
                      const _elementKey3 = input.id;
                      return (
                        <_Element3 key={_elementKey3} {..._elementProps3} />
                      );
                    })(),
                  ),
                  <span
                    role={"columnheader"}
                    className={"ds-cgutter"}
                    aria-hidden={"true"}
                  />,
                ]}
              </div>,
              shadows.tokens.map((input) =>
                (() => {
                  const _Element4 = ShadowTokenRow;
                  const _elementProps4 = {
                    t: input,
                    themes: themes,
                    grounds: grounds,
                    preview: value,
                    taken: values,
                    edit: edit,
                  };
                  const _elementKey4 = input.name;
                  return <_Element4 key={_elementKey4} {..._elementProps4} />;
                })(),
              ),
            ]}
          </div>
        </div>
      </runtime.TokenTableSection>
    );
  }
  bindRuntimeValue(
    runtime,
    "stopFileDropEvent",
    () => stopFileDropEvent,
    (value) => {
      stopFileDropEvent = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "BLOCK_FILE_DROP_HANDLERS",
    () => BLOCK_FILE_DROP_HANDLERS,
    (value) => {
      BLOCK_FILE_DROP_HANDLERS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactShadowEditors",
    () => reactShadowEditors,
    (value) => {
      reactShadowEditors = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactDomShadowEditors",
    () => reactDomShadowEditors,
    (value) => {
      reactDomShadowEditors = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxShadowEditors",
    () => jsxShadowEditors,
    (value) => {
      jsxShadowEditors = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "safeShadowPreviewStyle",
    () => safeShadowPreviewStyle,
    (value) => {
      safeShadowPreviewStyle = value;
    },
  );
  bindRuntimeValue(runtime, "parseSingleBoxShadow", () => parseSingleBoxShadow);
  bindRuntimeValue(
    runtime,
    "serializeSingleBoxShadow",
    () => serializeSingleBoxShadow,
  );
  bindRuntimeValue(runtime, "boxShadowSummary", () => boxShadowSummary);
  bindRuntimeValue(runtime, "splitBoxShadowLayers", () => splitBoxShadowLayers);
  bindRuntimeValue(
    runtime,
    "joinBoxShadowLayers",
    () => joinBoxShadowLayers,
    (value) => {
      joinBoxShadowLayers = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DEFAULT_BOX_SHADOW",
    () => DEFAULT_BOX_SHADOW,
    (value) => {
      DEFAULT_BOX_SHADOW = value;
    },
  );
  bindRuntimeValue(runtime, "ShadowValueEditor", () => ShadowValueEditor);
  bindRuntimeValue(
    runtime,
    "DEFAULT_BOX_SHADOW_VALUES",
    () => DEFAULT_BOX_SHADOW_VALUES,
    (value) => {
      DEFAULT_BOX_SHADOW_VALUES = value;
    },
  );
  bindRuntimeValue(runtime, "ShadowValueCell", () => ShadowValueCell);
  bindRuntimeValue(runtime, "ShadowTokenRow", () => ShadowTokenRow);
  bindRuntimeValue(runtime, "ShadowsSection", () => ShadowsSection);
  return () => {
    stopFileDropEvent = (event: React.DragEvent<HTMLElement>): void => {
      if (!event.dataTransfer.types.includes("Files")) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
    };
    BLOCK_FILE_DROP_HANDLERS = {
      onDragEnter: stopFileDropEvent,
      onDragOver: (event): void => {
        if (!event.dataTransfer.types.includes("Files")) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = "none";
      },
      onDragLeave: stopFileDropEvent,
      onDrop: stopFileDropEvent,
    };
    reactShadowEditors = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    reactDomShadowEditors = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactDomNamespace)(),
      1,
    );
    jsxShadowEditors = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
    safeShadowPreviewStyle = (shadow: string) =>
      (0, runtime.isSafeBoxShadow)(shadow)
        ? {
            boxShadow: shadow,
          }
        : {};
    joinBoxShadowLayers = (layers: string[]) =>
      layers
        .map((input) => input.trim())
        .filter((input): boolean => input !== "")
        .join(", ");
    DEFAULT_BOX_SHADOW = "0 1px 3px rgba(0, 0, 0, 0.16)";
    DEFAULT_BOX_SHADOW_VALUES = {
      x: 0,
      y: 1,
      blur: 3,
      spread: 0,
      color: "rgba(0, 0, 0, 0.16)",
    };
  };
}
