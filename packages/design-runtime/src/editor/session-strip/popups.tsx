/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";
export function installEditorSessionStripPopups(
  runtime: RuntimeBindings,
): () => void {
  var jsxSessionStripPopups: Dynamic;
  var SessionStripPopupsClassNames: Dynamic;
  var SessionStripPopupsConstant: Dynamic;
  var SessionStripPopupsClosest: Dynamic;
  var SessionStripPopupsDataSessionStripConfig: Dynamic;
  var SessionStripPopupsItems: Dynamic;
  var SessionStripPopupsJoinValue: Dynamic;
  var SessionStripPopupsJoinValue_2: Dynamic;
  var SessionStripPopupsHandler: Dynamic;
  var SessionStripPopupsTarget: Dynamic;
  var SessionStripPopupsLabel: Dynamic;
  function useSessionPopupFocus(input?: Dynamic, options?: Dynamic): Dynamic {
    let [value, value2]: Dynamic = (0,
      runtime.reactInspectorArtboardRadius_2.useState)(false),
      value3: Dynamic = (0, runtime.reactInspectorArtboardRadius_2.useRef)(
        null,
      ),
      callback: Dynamic = (): Dynamic =>
        SessionStripPopupsHandler(value3.current);
    return {
      byKey: value,
      body: value3,
      initialFocus: callback,
      keyed: {
        onKeyDown: (event?: Dynamic): Dynamic => {
          if (event.key === "Enter" || event.key === " ") value2(true);
          else if (
            event.key === "ArrowDown" &&
            !event.defaultPrevented &&
            !event.altKey &&
            !event.metaKey &&
            !event.ctrlKey &&
            !event.shiftKey
          ) {
            let currentTarget: Dynamic = event.currentTarget;
            for (let value4 of (document as Dynamic).querySelectorAll(
              runtime.blockingOverlaySelector,
            ) as Dynamic)
              if (
                !(
                  value4.matches("[data-mc-scrim]") ||
                  (0, runtime.isClosedOverlay)(value4)
                ) &&
                !(
                  currentTarget instanceof Node &&
                  value4.contains(currentTarget)
                ) &&
                !(
                  input &&
                  value3.current !== null &&
                  value4.contains(value3.current)
                )
              )
                return;
            if (input) {
              let value4: Dynamic =
                  value3.current?.closest("[data-mc-popover]") ?? null,
                value5: Dynamic =
                  callback() ??
                  (value4 !== null
                    ? ((0, runtime.getFocusableElements)(value4)[0] ?? null)
                    : null);
              if (value5 === null) return;
              event.preventDefault();
              value2(true);
              value5.focus();
              return;
            }
            event.preventDefault();
            value2(true);
            options();
          }
        },
        onPointerDown: (): Dynamic => value2(false),
      },
    };
  }
  function SessionPopup({
    testid: testid,
    title: title,
    icon: icon,
    readout: readout,
    disabled: disabled2,
    align = "left",
    popoverClassName: popoverClassName,
    editsAreUndoSteps: editsAreUndoSteps,
    children: children,
  }: Dynamic): Dynamic {
    let [value, value2]: Dynamic = (0,
      runtime.reactInspectorArtboardRadius_2.useState)(false),
      {
        byKey: value3,
        body: value4,
        initialFocus: value5,
        keyed: value6,
      }: Dynamic = useSessionPopupFocus(value, (): Dynamic => value2(true)),
      value7: Dynamic =
        typeof icon == "string" ? (
          icon
        ) : (
          <runtime.Icon
            customIcon={icon}
            size={"auto"}
            className={"shrink-0"}
          />
        ),
      value8: Dynamic =
        readout === undefined ? (
          <runtime.SessionStripButton
            data-testid={testid}
            icon={value7}
            title={title}
            aria-label={title}
            className={value ? SessionStripPopupsClassNames : undefined}
            disabled={disabled2}
            {...value6}
          />
        ) : (
          <runtime.SessionStripButton
            data-testid={testid}
            icon={value7}
            title={title}
            aria-label={title}
            className={value ? SessionStripPopupsClassNames : undefined}
            disabled={disabled2}
            chevron={true}
            {...value6}
          >
            <span className={"tabular-nums"}>{readout}</span>
          </runtime.SessionStripButton>
        );
    return (
      <span className={"relative inline-flex"}>
        <runtime.EditorPopover
          open={value}
          onOpen={(): Dynamic => value2(true)}
          onClose={(): Dynamic => value2(false)}
          trigger={value8}
          align={align}
          focusOnOpen={value3}
          initialFocus={value5}
          keepFocus={true}
          padding={"none"}
          className={(0, runtime.joinClassNames)("p-2", popoverClassName)}
          editsAreUndoSteps={editsAreUndoSteps}
        >
          <div
            ref={value4}
            data-session-strip={""}
            onKeyDownCapture={runtime.preventInputEnterSubmit}
          >
            {typeof children == "function"
              ? children((): Dynamic => value2(false))
              : children}
          </div>
        </runtime.EditorPopover>
      </span>
    );
  }
  function SessionChoicePopup({
    testid: testid,
    title: title,
    face: face,
    value: value,
    options: options,
    onChange: onChange,
    disabled: disabled2,
  }: Dynamic): Dynamic {
    return (
      <SessionPopup
        testid={testid}
        title={title}
        icon={face}
        popoverClassName={"min-w-0!"}
        disabled={disabled2}
      >
        {(input?: Dynamic): Dynamic => (
          <div
            role={"group"}
            aria-label={title}
            data-icon-row={""}
            className={"flex items-center gap-1"}
            onKeyDown={(0, runtime.pickerSearchKeyHandler)("button", {
              across: true,
            })}
          >
            {options.map(
              (input2?: Dynamic): Dynamic =>
                (() => {
                  const _Component = runtime.SessionStripButton;
                  const _props = {
                    "data-testid": testid
                      ? testid + "-" + input2.value
                      : undefined,
                    icon:
                      typeof input2.icon == "string" ? (
                        input2.icon
                      ) : (
                        <runtime.Icon
                          customIcon={input2.icon}
                          size={"auto"}
                          className={"shrink-0"}
                        />
                      ),
                    title: input2.disabledReason ?? input2.label,
                    "aria-label": input2.label,
                    "aria-pressed":
                      input2.disabledReason !== undefined
                        ? undefined
                        : input2.value === value,
                    disabled: input2.disabledReason !== undefined,
                    onClick: (): Dynamic => {
                      input();
                      input2.value !== value && onChange(input2.value);
                    },
                  } as const;
                  const _key = input2.value;
                  return <_Component key={_key} {..._props} />;
                })(),
            )}
          </div>
        )}
      </SessionPopup>
    );
  }
  function SessionTypographyPopup({
    testid: testid,
    value: value,
    chipText: chipText,
    options: options,
    onChange: onChange,
    custom: custom,
    systemHeader: systemHeader,
  }: Dynamic): Dynamic {
    let [value2, value3]: Dynamic = (0,
      runtime.reactInspectorArtboardRadius_2.useState)(false),
      {
        byKey: value4,
        body: value5,
        initialFocus: value6,
        keyed: value7,
      }: Dynamic = useSessionPopupFocus(value2, (): Dynamic => value3(true)),
      value8: Dynamic = options.length > 0 || systemHeader != null,
      [value9, value10]: Dynamic = (0,
      runtime.reactInspectorArtboardRadius_2.useState)("system"),
      value11: Dynamic = value8 ? value9 : "custom",
      value12: Dynamic =
        options.some((input?: Dynamic): Dynamic => input.group !== undefined) ||
        options.length > runtime.PropertiesNumericInputLimit,
      [value13, value14]: Dynamic = (0,
      runtime.reactInspectorArtboardRadius_2.useState)("");
    !value2 && value13 !== "" && value14("");
    let value15: Dynamic = value12 ? value13.trim().toLowerCase() : "",
      value16: Dynamic = options.filter(
        (input?: Dynamic): Dynamic =>
          (0, runtime.pickerSearchMatches)(
            value15,
            input.text,
            input.hint,
            input.subgroup,
            input.group,
          ),
      ),
      value17: Dynamic = options.reduce(
        (input?: Dynamic, options2?: Dynamic, context?: Dynamic): Dynamic => {
          let value20: Dynamic =
            options2.group !== undefined &&
            options2.group !== options[context - 1]?.group;
          return (
            input +
            1 +
            (value20 ? 1 : 0) +
            (options2.subgroup !== undefined &&
            (value20 || options2.subgroup !== options[context - 1]?.subgroup)
              ? 1
              : 0)
          );
        },
        0,
      ),
      value18: Dynamic = value8
        ? Math.max(
            SessionStripPopupsConstant,
            52 +
              (systemHeader != null ? 40 : 0) +
              (value12 ? 36 : 0) +
              Math.min(384, 32 * value17),
          )
        : undefined,
      value19: Dynamic = (
        <runtime.SessionStripButton
          data-testid={testid}
          data-mc-bordered={""}
          title={"Text style"}
          chevron={true}
          className={(0, runtime.joinClassNames)(
            "rounded-lg border border-border-line px-2",
            value2 && SessionStripPopupsClassNames,
          )}
          {...value7}
        >
          <span className={"inline-flex items-center gap-1.5"}>
            <runtime.EditorIcon
              name={"TextAa"}
              size={13}
              className={"text-muted"}
            />
            <span className={"min-w-14 max-w-40 truncate text-left"}>
              {chipText}
            </span>
          </span>
        </runtime.SessionStripButton>
      );
    return (
      <span className={"relative inline-flex"}>
        <runtime.EditorPopover
          open={value2}
          onOpen={(): Dynamic => value3(true)}
          onClose={(): Dynamic => value3(false)}
          trigger={value19}
          align={"left"}
          focusOnOpen={value4}
          initialFocus={value6}
          keepFocus={true}
          padding={"none"}
          planHeight={value18}
          className={"w-60 p-2 pointer-coarse:w-auto pointer-coarse:min-w-60"}
        >
          <div
            ref={value5}
            data-session-strip={""}
            onKeyDownCapture={runtime.preventInputEnterSubmit}
          >
            {value8 ? (
              <runtime.ColorHexInput value={value11} onChange={value10} />
            ) : null}
            {value11 === "system" ? (
              <div role={"group"} aria-label={"Text style"}>
                {systemHeader}
                <div
                  data-search-scope={""}
                  onKeyDown={(0, runtime.pickerSearchKeyHandler)(
                    '[data-kit="MenuItem"]',
                  )}
                >
                  {value12 ? (
                    <runtime.PickerSearchInput
                      value={value13}
                      onChange={value14}
                      label={runtime.ColorContrastCopyLabel_5}
                      rowSelector={'[data-kit="MenuItem"]'}
                      onEnterIndex={(): Dynamic =>
                        (0, runtime.pickerSearchInitialIndex)(
                          value15,
                          value16.map((input?: Dynamic): Dynamic => input.text),
                        )
                      }
                      data-testid={testid ? testid + "-search" : undefined}
                    />
                  ) : null}
                  {value16.length === 0 ? (
                    <p
                      role={"status"}
                      className={"px-2 py-1 text-footnote text-muted"}
                    >
                      {runtime.ColorContrastCopyLabel_3}
                    </p>
                  ) : null}
                  <div
                    className={
                      "kit-scrollbar max-h-[min(24rem,max(6rem,calc(var(--available-height,100vh)_-_8rem)))] overflow-y-auto"
                    }
                  >
                    {value16.map(
                      (input?: Dynamic, options2?: Dynamic): Dynamic => {
                        let value20: Dynamic =
                            input.group !== undefined &&
                            input.group !== value16[options2 - 1]?.group,
                          value21: Dynamic =
                            input.subgroup !== undefined &&
                            (value20 ||
                              input.subgroup !==
                                value16[options2 - 1]?.subgroup);
                        return (() => {
                          const _Component2 =
                            runtime.reactInspectorArtboardRadius_2.Fragment;
                          const _props2 = {
                            children: [
                              value20 ? (
                                <runtime.PickerListHeader
                                  text={input.group}
                                  title={true}
                                />
                              ) : null,
                              value21 ? (
                                <runtime.PickerListHeader
                                  text={input.subgroup}
                                />
                              ) : null,
                              <runtime.EditorMenuItem
                                checked={input.value === value}
                                title={input.title}
                                data-testid={
                                  testid
                                    ? testid + "-" + input.value
                                    : undefined
                                }
                                onClick={(): Dynamic => {
                                  value3(false);
                                  input.value !== value &&
                                    onChange(input.value);
                                }}
                              >
                                <span
                                  className={
                                    "flex min-w-0 flex-1 items-center gap-0.5"
                                  }
                                  style={{
                                    lineHeight: "27px",
                                  }}
                                >
                                  <span
                                    className={
                                      "flex min-w-0 overflow-x-clip pe-1 [font-variation-settings:normal]"
                                    }
                                  >
                                    {input.label}
                                  </span>
                                  {input.hint !== undefined ? (
                                    <span
                                      className={
                                        "shrink-0 text-footnote text-muted"
                                      }
                                    >
                                      {input.hint}
                                    </span>
                                  ) : null}
                                </span>
                              </runtime.EditorMenuItem>,
                            ],
                          } as const;
                          const _key2 = input.value;
                          return <_Component2 key={_key2} {..._props2} />;
                        })();
                      },
                    )}
                  </div>
                </div>
              </div>
            ) : "body" in custom ? (
              <div
                className={"flex flex-col gap-2"}
                aria-label={"Custom text style"}
              >
                {custom.body}
              </div>
            ) : (
              <CustomTypographyEditor c={custom} />
            )}
          </div>
        </runtime.EditorPopover>
      </span>
    );
  }
  function CustomTypographyEditor({ c: c }: Dynamic): Dynamic {
    return (
      <div className={"flex flex-col gap-2"} aria-label={"Custom text style"}>
        <div className={"flex"}>
          <runtime.PropertySelect
            aria-label={"Font"}
            items={c.family.options}
            value={c.family.value}
            onChange={c.family.onChange}
            searchable={c.family.searchable}
            searchLabel={"Search fonts"}
            onOpenChange={c.family.onOpenChange}
            popupAttrs={SessionStripPopupsDataSessionStripConfig}
          />
        </div>
        <div className={"grid grid-cols-2 gap-2"}>
          <runtime.PropertySelect
            aria-label={"Weight"}
            items={(0, runtime.includeCurrentFontVariant)(c.face.faces, c.face)}
            value={(0, runtime.fontVariantKey)(c.face.weight, c.face.italic)}
            onOpenChange={c.face.onOpenChange}
            onChange={(input?: Dynamic): Dynamic => {
              let value: Dynamic = (0, runtime.parseFontVariantKey)(input);
              value !== undefined &&
                c.face.onChange(value.weight, value.italic);
            }}
            popupAttrs={SessionStripPopupsDataSessionStripConfig}
          />
          <runtime.NumericInput
            aria-label={"Font size"}
            unit={"px"}
            title={"Font size (px); clear it for the style's own"}
            clearable={true}
            {...c.size}
          />
          <runtime.NumericInput
            prefix={
              <runtime.PropertyOptionIcon icon={runtime.LineHeightValue} />
            }
            aria-label={"Line height"}
            title={"Line height (\xD7 the font size)"}
            clearable={true}
            {...c.lineHeight}
            step={c.lineHeight.step ?? 0.05}
          />
          <runtime.NumericInput
            prefix={<runtime.PropertyOptionIcon icon={"LetterSpacing"} />}
            aria-label={"Letter spacing"}
            unit={"px"}
            title={"Letter spacing (px)"}
            clearable={true}
            {...c.letterSpacing}
            step={c.letterSpacing.step ?? 0.5}
          />
        </div>
      </div>
    );
  }
  function SessionActionsPopover(source?: Dynamic): Dynamic {
    let [value, value2]: Dynamic = (0,
      runtime.reactInspectorArtboardRadius_2.useState)(false),
      value3: Dynamic = (0, runtime.reactInspectorArtboardRadius_2.useRef)(
        source.onOpenChange,
      );
    value3.current = source.onOpenChange;
    (0, runtime.reactInspectorArtboardRadius_2.useEffect)(
      (): Dynamic => value3.current?.(value),
      [value],
    );
    let {
        byKey: value4,
        body: value5,
        initialFocus: value6,
        keyed: value7,
      }: Dynamic = useSessionPopupFocus(value, (): Dynamic => value2(true)),
      value8: Dynamic =
        source.custom !== undefined &&
        source.swatches.some(
          (input?: Dynamic): Dynamic =>
            input.empty !== true && input.name !== "default",
        ),
      value9: Dynamic = (
        <runtime.SessionStripButton
          data-testid={source.testid}
          title={source.title}
          aria-label={source.title}
          icon={<SessionColorSwatch css={source.paint} />}
          className={value ? SessionStripPopupsClassNames : undefined}
          {...value7}
        />
      );
    return (
      <span className={"relative inline-flex"}>
        <runtime.EditorPopover
          open={value}
          onOpen={(): Dynamic => value2(true)}
          onClose={(): Dynamic => value2(false)}
          trigger={value9}
          align={"left"}
          focusOnOpen={value4}
          initialFocus={value6}
          keepFocus={true}
          padding={"none"}
          planHeight={
            value8 || source.kind !== undefined
              ? runtime.ColorPickerConstant
              : undefined
          }
          className={runtime.ColorPickerLabel}
          editsAreUndoSteps={source.editsAreUndoSteps}
        >
          <div
            ref={value5}
            data-session-strip={""}
            onKeyDownCapture={runtime.preventInputEnterSubmit}
            onMouseDown={SessionStripPopupsTarget}
          >
            <runtime.ColorSwatchPicker
              testid={source.testid}
              title={source.title}
              swatches={source.swatches}
              current={source.value}
              onSwatch={(input?: Dynamic): Dynamic => {
                source.onSwatch(input);
                let value10: Dynamic = source.custom?.contrast;
                if (
                  value10 === undefined ||
                  source.custom?.quietSwatch === true
                )
                  return;
                let value11: Dynamic = source.swatches.find(
                  (input2?: Dynamic): Dynamic => input2.name === input,
                )?.color;
                value11 !== undefined &&
                  (0, runtime.announce)((): Dynamic => {
                    let value12: Dynamic = (0, runtime.evaluateColorContrast)(
                      value11,
                      value10,
                    );
                    return value12 === undefined
                      ? null
                      : (0, runtime.summarizeContrastResults)(value12).spoken;
                  });
              }}
              onPicked={(): Dynamic => value2(false)}
              fold={true}
              color={
                source.custom !== undefined
                  ? {
                      value: source.custom.seed,
                      unset: source.custom.unset,
                      opaque: source.custom.opaque,
                      onChange: source.custom.onChange,
                      onPickEnd: source.custom.onPickEnd,
                      contrast: source.custom.contrast,
                    }
                  : undefined
              }
              kind={source.kind}
              face={source.face}
            />
          </div>
        </runtime.EditorPopover>
      </span>
    );
  }
  function SessionColorSwatch({ css: css }: Dynamic): Dynamic {
    return (
      <span
        aria-hidden={"true"}
        data-swatch-dot={""}
        className={(0, runtime.joinClassNames)(
          "inline-block h-4 w-4 shrink-0 rounded-[4px] border border-border-strong pointer-coarse:h-5 pointer-coarse:w-5",
          css === undefined && "border-dashed",
        )}
        style={(0, runtime.colorWellStyle)(css)}
      />
    );
  }
  function isScrollbarPointer(event?: Dynamic): Dynamic {
    let target: Dynamic = event.target;
    return (
      target.scrollHeight > target.clientHeight &&
      event.nativeEvent.offsetX >= target.clientWidth
    );
  }
  function SessionImageReplaceButton({
    src: src,
    title: title,
    onClick: onClick,
    disabled: disabled2,
  }: Dynamic): Dynamic {
    return (
      <runtime.SessionStripButton
        data-testid={"frame-image-replace"}
        title={title}
        aria-label={title}
        disabled={disabled2}
        onClick={onClick}
        className={"px-1"}
      >
        {src !== undefined ? (
          <img
            alt={""}
            aria-hidden={"true"}
            src={src}
            draggable={false}
            style={{
              background: SessionStripPopupsLabel,
            }}
            className={
              "h-5 w-5 shrink-0 rounded-[4px] border border-border-strong object-cover pointer-coarse:h-7 pointer-coarse:w-7"
            }
          />
        ) : (
          <span
            aria-hidden={"true"}
            className={
              "inline-block h-5 w-5 rounded-[4px] border border-dashed border-border-strong pointer-coarse:h-7 pointer-coarse:w-7"
            }
          />
        )}
      </runtime.SessionStripButton>
    );
  }
  bindRuntimeValue(
    runtime,
    "jsxSessionStripPopups",
    () => jsxSessionStripPopups,
    (value) => {
      jsxSessionStripPopups = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SessionStripPopupsClassNames",
    () => SessionStripPopupsClassNames,
    (value) => {
      SessionStripPopupsClassNames = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SessionStripPopupsConstant",
    () => SessionStripPopupsConstant,
    (value) => {
      SessionStripPopupsConstant = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SessionStripPopupsClosest",
    () => SessionStripPopupsClosest,
    (value) => {
      SessionStripPopupsClosest = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SessionStripPopupsDataSessionStripConfig",
    () => SessionStripPopupsDataSessionStripConfig,
    (value) => {
      SessionStripPopupsDataSessionStripConfig = value;
    },
  );
  bindRuntimeValue(runtime, "useSessionPopupFocus", () => useSessionPopupFocus);
  bindRuntimeValue(
    runtime,
    "SessionStripPopupsItems",
    () => SessionStripPopupsItems,
    (value) => {
      SessionStripPopupsItems = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SessionStripPopupsJoinValue",
    () => SessionStripPopupsJoinValue,
    (value) => {
      SessionStripPopupsJoinValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SessionStripPopupsJoinValue_2",
    () => SessionStripPopupsJoinValue_2,
    (value) => {
      SessionStripPopupsJoinValue_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SessionStripPopupsHandler",
    () => SessionStripPopupsHandler,
    (value) => {
      SessionStripPopupsHandler = value;
    },
  );
  bindRuntimeValue(runtime, "SessionPopup", () => SessionPopup);
  bindRuntimeValue(runtime, "SessionChoicePopup", () => SessionChoicePopup);
  bindRuntimeValue(
    runtime,
    "SessionTypographyPopup",
    () => SessionTypographyPopup,
  );
  bindRuntimeValue(
    runtime,
    "CustomTypographyEditor",
    () => CustomTypographyEditor,
  );
  bindRuntimeValue(
    runtime,
    "SessionActionsPopover",
    () => SessionActionsPopover,
  );
  bindRuntimeValue(
    runtime,
    "SessionStripPopupsTarget",
    () => SessionStripPopupsTarget,
    (value) => {
      SessionStripPopupsTarget = value;
    },
  );
  bindRuntimeValue(runtime, "SessionColorSwatch", () => SessionColorSwatch);
  bindRuntimeValue(runtime, "isScrollbarPointer", () => isScrollbarPointer);
  bindRuntimeValue(
    runtime,
    "SessionStripPopupsLabel",
    () => SessionStripPopupsLabel,
    (value) => {
      SessionStripPopupsLabel = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SessionImageReplaceButton",
    () => SessionImageReplaceButton,
  );
  return () => {
    jsxSessionStripPopups = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_jsx_runtime)(),
      1,
    );
    SessionStripPopupsClassNames = "bg-fill-ghost-hover";
    SessionStripPopupsConstant = 180;
    SessionStripPopupsClosest = (input?: Dynamic): Dynamic =>
      input instanceof Element &&
      input.closest(runtime.editableElementSelector) !== null;
    SessionStripPopupsDataSessionStripConfig = {
      "data-session-strip": "popup",
    };
    SessionStripPopupsItems = [
      '[data-kit="MenuItem"]',
      "[data-swatch]",
      "[data-icon-row] button",
    ];
    SessionStripPopupsJoinValue = SessionStripPopupsItems.map(
      (input?: Dynamic): Dynamic =>
        input + '[aria-pressed="true"]:not(:disabled)',
    ).join(", ");
    SessionStripPopupsJoinValue_2 = SessionStripPopupsItems.map(
      (input?: Dynamic): Dynamic => input + ":not(:disabled)",
    ).join(", ");
    SessionStripPopupsHandler = (input?: Dynamic): Dynamic =>
      input?.querySelector(SessionStripPopupsJoinValue) ??
      input?.querySelector(SessionStripPopupsJoinValue_2) ??
      null;
    SessionStripPopupsTarget = (event?: Dynamic): Dynamic => {
      !SessionStripPopupsClosest(event.target) &&
        !isScrollbarPointer(event) &&
        event.preventDefault();
    };
    SessionStripPopupsLabel =
      "repeating-conic-gradient(#a8a6a0 0% 25%, #d2d0ca 0% 50%) 0 / 8px 8px padding-box";
  };
}
