/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";
export function installCanvasErrorNotices(
  runtime: RuntimeBindings,
): () => void {
  var jsx_sp: Dynamic;
  var artboardErrorsUiLabels: Dynamic;
  var claudeSendSessionRefreshIntervalMs: Dynamic;
  var react_Xd: Dynamic;
  var jsx_Ww: Dynamic;
  var artboardErrorNoticeLabels: Dynamic;
  var stopErrorNoticePropagation: Dynamic;
  var ArtboardErrorNotice: Dynamic;
  var artboardErrorChipElement: Dynamic;
  var artboardErrorNoticeElement: Dynamic;
  var elementContainsKeyboardFocus: Dynamic;
  function ArtboardErrorsPopover({
    problems: problems,
    canvasTitle: canvasTitle,
    canEdit: canEdit,
    hosted: hosted,
    open: open,
    onOpenChange: onOpenChange,
  }: Dynamic): Dynamic {
    let value: Dynamic = canEdit && !hosted,
      value2: Dynamic = (0, runtime.react_sm.useId)(),
      value3: Dynamic = (0, runtime.react_sm.useRef)(null),
      value4: Dynamic = (0, runtime.react_sm.useRef)(0),
      value5: Dynamic = (0, runtime.react_sm.useCallback)((): Dynamic => {
        let value13: Dynamic = ++value4.current;
        (0, runtime.getAvailableClaudeSendSession)().then(
          (input?: Dynamic): Dynamic => {
            value13 === value4.current && (value3.current = input);
          },
        );
      }, []);
    (0, runtime.react_sm.useEffect)((): Dynamic => {
      value && value5();
    }, [value, value5]);
    (0, runtime.react_sm.useEffect)((): Dynamic => {
      if (!value || !open) return;
      value5();
      let value13: Dynamic = setInterval(
        value5,
        claudeSendSessionRefreshIntervalMs,
      );
      return (): Dynamic => clearInterval(value13);
    }, [value, open, value5]);
    let value6: Dynamic = (0, runtime.react_sm.useRef)(true);
    (0, runtime.react_sm.useEffect)(
      (): Dynamic => (
        (value6.current = true),
        (): Dynamic => {
          value6.current = false;
          value4.current++;
        }
      ),
      [],
    );
    let value7: Dynamic = (0, runtime.react_sm.useMemo)(
        (): Dynamic =>
          problems.map(
            (input?: Dynamic): Dynamic => ({
              file: input.path,
              messages: input.messages,
            }),
          ),
        [problems],
      ),
      value8: Dynamic = (0, runtime.react_sm.useMemo)(
        (): Dynamic => JSON.stringify(value7),
        [value7],
      ),
      [value9, value10]: Dynamic = (0, runtime.react_sm.useState)(null),
      value11: Dynamic = value9?.key === value8 ? value9.prompt : null,
      callback: Dynamic = (): Dynamic => {
        (0, runtime.sendArtboardErrorsToClaude)(
          value7,
          value3.current,
          canvasTitle,
        ).then((input?: Dynamic): Dynamic => {
          (0, runtime.showEditorToast)(
            (0, runtime.claudeSendStatusMessage)(input),
          );
          value6.current &&
            (value10(
              input === "failed"
                ? {
                    key: value8,
                    prompt: (0, runtime.artboardErrorsFallbackPrompt)(
                      value7,
                      canvasTitle,
                    ),
                  }
                : null,
            ),
            input === "failed" && onOpenChange(true));
        });
      },
      value12: Dynamic = problems.reduce(
        (input?: Dynamic, options?: Dynamic): Dynamic =>
          input + options.messages.length,
        0,
      );
    return (
      <runtime.SessionStripPopover
        icon={"Warning"}
        label={artboardErrorsUiLabels.pill(value12)}
        tip={artboardErrorsUiLabels.pillTip(problems.length)}
        align={"end"}
        open={open}
        onOpenChange={onOpenChange}
        data-testid={"design-problems-pill"}
      >
        <runtime.MenuMenuAssignValue.Header
          className={"w-80 pb-2 pt-1.5 font-normal"}
        >
          <div
            className={"text-body font-medium text-primary"}
            data-testid={"design-problems-title"}
          >
            {artboardErrorsUiLabels.title}
          </div>
          <ul
            id={value2}
            className={
              "m-0 mt-1 flex max-h-64 list-none flex-col gap-1.5 overflow-y-auto p-0 whitespace-normal"
            }
            data-testid={"design-problems-list"}
          >
            {problems.map(
              (input?: Dynamic): Dynamic =>
                (() => {
                  const _Component = "li";
                  const _props = {
                    children: [
                      <div className={"break-words text-body text-primary"}>
                        {input.title}
                      </div>,
                      input.messages.map(
                        (input2?: Dynamic, options?: Dynamic): Dynamic => (
                          <div
                            key={options}
                            className={
                              "select-text break-words font-mono text-[11px] leading-snug text-secondary"
                            }
                          >
                            {input2}
                          </div>
                        ),
                      ),
                    ],
                  } as const;
                  const _key = input.file;
                  return <_Component key={_key} {..._props} />;
                })(),
            )}
          </ul>
          {canEdit || hosted ? null : (
            <p className={"mt-2 whitespace-normal text-body text-secondary"}>
              {artboardErrorsUiLabels.viewOnly}
            </p>
          )}
          {value11 !== null ? (
            <div
              className={"mt-2 flex flex-col gap-1"}
              data-testid={"design-problems-prompt"}
            >
              <p className={"text-xs text-secondary"}>
                {artboardErrorsUiLabels.paste}
              </p>
              <pre
                className={
                  "max-h-32 select-text overflow-auto whitespace-pre-wrap break-words rounded-md bg-wash-1 p-2 text-[11px] leading-snug text-secondary"
                }
              >
                {value11}
              </pre>
            </div>
          ) : null}
        </runtime.MenuMenuAssignValue.Header>
        {value ? (
          <jsx_sp.Fragment>
            <runtime.MenuMenuAssignValue.Separator />
            <runtime.MenuMenuAssignValue.Item
              icon={"Chat"}
              aria-describedby={value2}
              data-testid={"design-problems-ask"}
              onClick={callback}
            >
              {artboardErrorsUiLabels.ask}
            </runtime.MenuMenuAssignValue.Item>
          </jsx_sp.Fragment>
        ) : null}
      </runtime.SessionStripPopover>
    );
  }
  function useArtboardErrorNotices(
    problems?: Dynamic,
    onShowProblems?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    let [value, value2]: Dynamic = (0, react_Xd.useState)(
        (): Dynamic => new Map(),
      ),
      value3: Dynamic = (0, react_Xd.useRef)(null),
      value4: Dynamic = (0, react_Xd.useCallback)(
        (input?: Dynamic, options2?: Dynamic): Dynamic => {
          value3.current = elementContainsKeyboardFocus(
            artboardErrorNoticeElement(input),
          )
            ? {
                file: input,
                to: "chip",
              }
            : null;
          value2(
            (input2?: Dynamic): Dynamic =>
              (0, runtime.setDismissedArtboardErrors)(input2, input, options2),
          );
        },
        [],
      ),
      value5: Dynamic = (0, react_Xd.useCallback)(
        (input?: Dynamic): Dynamic => {
          value3.current = elementContainsKeyboardFocus(
            artboardErrorChipElement(input),
          )
            ? {
                file: input,
                to: "notice",
              }
            : null;
          value2(
            (input2?: Dynamic): Dynamic =>
              (0, runtime.clearDismissedArtboardErrors)(input2, input),
          );
        },
        [],
      );
    (0, react_Xd.useLayoutEffect)((): Dynamic => {
      let current: Dynamic = value3.current;
      value3.current = null;
      if (
        !current ||
        (document as Dynamic).activeElement !== (document as Dynamic).body
      )
        return;
      let value11: Dynamic =
        current.to === "chip"
          ? artboardErrorChipElement(current.file)
          : artboardErrorNoticeElement(current.file)?.querySelector("button");
      value11 instanceof HTMLElement &&
        value11.focus({
          preventScroll: true,
        });
    }, [value]);
    let value6: Dynamic = (0, react_Xd.useMemo)(
        (): Dynamic =>
          (0, runtime.retainMatchingDismissedErrors)(problems, value),
        [problems, value],
      ),
      {
        canvasTitle: value7,
        canAsk: value8,
        large: value9,
        onShowAll: value10,
      }: Dynamic = options;
    return {
      chipProblems: value6,
      notice: (input?: Dynamic): Dynamic => {
        let value11: Dynamic = onShowProblems.find(
          (input2?: Dynamic): Dynamic => input2.file === input,
        );
        return value11 === undefined ||
          (0, runtime.errorMessagesMatch)(
            value,
            input,
            value11.messages,
          ) ? null : (
          <ArtboardErrorNotice
            file={value11.file}
            path={value11.path}
            title={value11.title}
            messages={value11.messages}
            canvasTitle={value7}
            canAsk={value8}
            large={value9}
            onDismiss={value4}
            onShowAll={value10}
          />
        );
      },
      restore: value5,
    };
  }
  bindRuntimeValue(
    runtime,
    "jsx_sp",
    () => jsx_sp,
    (value) => {
      jsx_sp = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "artboardErrorsUiLabels",
    () => artboardErrorsUiLabels,
    (value) => {
      artboardErrorsUiLabels = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "claudeSendSessionRefreshIntervalMs",
    () => claudeSendSessionRefreshIntervalMs,
    (value) => {
      claudeSendSessionRefreshIntervalMs = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ArtboardErrorsPopover",
    () => ArtboardErrorsPopover,
  );
  bindRuntimeValue(
    runtime,
    "react_Xd",
    () => react_Xd,
    (value) => {
      react_Xd = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsx_Ww",
    () => jsx_Ww,
    (value) => {
      jsx_Ww = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "artboardErrorNoticeLabels",
    () => artboardErrorNoticeLabels,
    (value) => {
      artboardErrorNoticeLabels = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "stopErrorNoticePropagation",
    () => stopErrorNoticePropagation,
    (value) => {
      stopErrorNoticePropagation = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ArtboardErrorNotice",
    () => ArtboardErrorNotice,
    (value) => {
      ArtboardErrorNotice = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "artboardErrorChipElement",
    () => artboardErrorChipElement,
    (value) => {
      artboardErrorChipElement = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "artboardErrorNoticeElement",
    () => artboardErrorNoticeElement,
    (value) => {
      artboardErrorNoticeElement = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "elementContainsKeyboardFocus",
    () => elementContainsKeyboardFocus,
    (value) => {
      elementContainsKeyboardFocus = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "useArtboardErrorNotices",
    () => useArtboardErrorNotices,
  );
  return () => {
    jsx_sp = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_jsx_runtime)(),
      1,
    );
    artboardErrorsUiLabels = {
      pill: (input?: Dynamic): Dynamic =>
        input === 1 ? "1 error" : String(input) + " errors",
      pillTip: (input?: Dynamic): Dynamic =>
        input === 1
          ? "Show errors on 1 artboard"
          : "Show errors on " + String(input) + " artboards",
      title: "Artboards with errors",
      // CucCut: user-facing copy calls the agent "the agent", not Claude.
      ask: "Ask the agent to fix",
      viewOnly: "Someone who can edit this canvas can ask the agent to fix them.",
      paste: "Copy this and paste it to the agent:",
    };
    claudeSendSessionRefreshIntervalMs = 1e4;
    react_Xd = (0, runtime.toModuleNamespace)((0, runtime.load_react)(), 1);
    (0, runtime.initializeCdsIndex)();
    (0, runtime.initializePlatformCdsIsland)();
    jsx_Ww = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_jsx_runtime)(),
      1,
    );
    artboardErrorNoticeLabels = {
      group: (input?: Dynamic): Dynamic => "Errors on artboard " + input,
      list: "Show all artboards with errors",
      dismiss: (input?: Dynamic): Dynamic =>
        "Dismiss error notice on artboard " + input,
      dismissTip: "Dismiss",
      refused: `Couldn\u2019t copy the prompt. Select \u201C${artboardErrorsUiLabels.ask}\u201D in the \u201C${artboardErrorsUiLabels.title}\u201D menu to see the prompt and copy it yourself.`,
    };
    stopErrorNoticePropagation = (input?: Dynamic): Dynamic =>
      input.stopPropagation();
    ArtboardErrorNotice = (0, react_Xd.memo)(function ({
      file: file,
      path: path,
      title: title,
      messages: messages,
      canvasTitle: canvasTitle,
      canAsk: canAsk,
      large: large,
      onDismiss: onDismiss,
      onShowAll: onShowAll,
    }: Dynamic): Dynamic {
      let value: Dynamic = (0, react_Xd.useRef)(null),
        value2: Dynamic = (0, react_Xd.useRef)(0),
        value3: Dynamic = (0, react_Xd.useRef)(true),
        value4: Dynamic = (0, react_Xd.useRef)(false),
        value5: Dynamic = (0, react_Xd.useCallback)((): Dynamic => {
          let value6: Dynamic = ++value2.current;
          (0, runtime.getAvailableClaudeSendSession)().then(
            (input?: Dynamic): Dynamic => {
              value6 === value2.current && (value.current = input);
            },
          );
        }, []);
      (0, react_Xd.useEffect)(
        (): Dynamic => (
          (value3.current = true),
          canAsk && value5(),
          (): Dynamic => {
            value3.current = false;
            value2.current++;
          }
        ),
        [canAsk, value5],
      );
      let callback: Dynamic = (): Dynamic => {
        if (value4.current) return;
        let value6: Dynamic = (0, runtime.sendArtboardErrorsToClaude)(
          [
            {
              file: path,
              messages: messages,
            },
          ],
          value.current,
          canvasTitle,
        );
        value4.current = true;
        value6
          .then((input?: Dynamic): Dynamic => {
            (0, runtime.showEditorToast)(
              input === "failed"
                ? artboardErrorNoticeLabels.refused
                : (0, runtime.claudeSendStatusMessage)(input),
            );
            value3.current &&
              (input === "failed"
                ? onShowAll()
                : input !== "staged" && value5());
          })
          .finally((): Dynamic => {
            value4.current = false;
          });
      };
      return (
        <div
          data-mega-chrome={"problem-notice"}
          data-mega-notice={file}
          data-testid={"mega-artboard-notice-" + file}
          role={"group"}
          aria-label={artboardErrorNoticeLabels.group(title)}
          className={(0, runtime.joinClassNames)(
            "pointer-events-auto inline-flex max-w-full items-center rounded-card bg-surface-2 text-body text-primary shadow-panel-sm select-none",
            large ? "h-12 gap-0.5 px-1" : "h-[34px] gap-1 px-[5px]",
          )}
          onPointerDown={stopErrorNoticePropagation}
          onClick={stopErrorNoticePropagation}
          onDoubleClick={stopErrorNoticePropagation}
        >
          <runtime.CdsIsland density={"compact"} className={"contents"}>
            <runtime.TooltipGroup>
              <runtime.Button
                variant={"ghost"}
                size={"xxs"}
                iconOnly={true}
                data-testid={"mega-artboard-notice-sign-" + file}
                aria-label={artboardErrorNoticeLabels.list}
                tooltip={messages[0]}
                icon={<runtime.Icon name={"Warning"} size={"sm"} />}
                className={"shrink-0 text-danger"}
                onClick={onShowAll}
              />
              <span
                className={(0, runtime.joinClassNames)(
                  "whitespace-nowrap pr-1",
                  large
                    ? "@max-[19rem]/foot:hidden"
                    : "@max-[14rem]/foot:hidden",
                )}
              >
                {artboardErrorsUiLabels.pill(messages.length)}
              </span>
              {canAsk && (
                <runtime.Button
                  variant={"secondary"}
                  size={"xs"}
                  data-testid={"mega-artboard-notice-ask-" + file}
                  className={(0, runtime.joinClassNames)(
                    "shrink-0",
                    large
                      ? "px-3 @max-[15rem]/foot:hidden"
                      : "@max-[10.5rem]/foot:hidden",
                  )}
                  onPointerEnter={value5}
                  onFocus={value5}
                  onClick={callback}
                >
                  {artboardErrorsUiLabels.ask}
                </runtime.Button>
              )}
              <runtime.Button
                variant={"ghost"}
                size={"xxs"}
                iconOnly={true}
                data-testid={"mega-artboard-notice-dismiss-" + file}
                aria-label={artboardErrorNoticeLabels.dismiss(title)}
                tooltip={artboardErrorNoticeLabels.dismissTip}
                icon={<runtime.Icon name={"X"} size={"sm"} />}
                className={(0, runtime.joinClassNames)(
                  "shrink-0 text-secondary",
                  large
                    ? "@max-[5.75rem]/foot:hidden"
                    : "@max-[4rem]/foot:hidden",
                )}
                onClick={(): Dynamic => onDismiss(file, messages)}
              />
            </runtime.TooltipGroup>
          </runtime.CdsIsland>
        </div>
      );
    });
    artboardErrorChipElement = (input?: Dynamic): Dynamic =>
      [...(document as Dynamic).querySelectorAll("[data-mega-artboard]")]
        .find(
          (element?: Dynamic): Dynamic =>
            element.getAttribute("data-mega-artboard") === input,
        )
        ?.querySelector('[data-mega-chrome="problem"]');
    artboardErrorNoticeElement = (input?: Dynamic): Dynamic =>
      [...(document as Dynamic).querySelectorAll("[data-mega-notice]")].find(
        (element?: Dynamic): Dynamic =>
          element.getAttribute("data-mega-notice") === input,
      );
    elementContainsKeyboardFocus = (input?: Dynamic): Dynamic =>
      input?.contains((document as Dynamic).activeElement) === true;
  };
}
