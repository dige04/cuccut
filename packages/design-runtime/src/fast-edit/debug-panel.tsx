/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";
export function installFastEditDebugPanel(
  runtime: RuntimeBindings,
): () => void {
  var ReactFastEditDebug: Dynamic;
  var fastEditDebugPortal: Dynamic;
  var fastEditDebugJsxRuntime: Dynamic;
  var padTwoDigits: Dynamic;
  var formatFastEditDebugTime: Dynamic;
  var compactDebugText: Dynamic;
  var formatDebugCharacterCount: Dynamic;
  var formatDebugDuration: Dynamic;
  var FAST_EDIT_DEBUG_OUTCOME_LABELS: Dynamic;
  var FAST_EDIT_DEBUG_TIER_LABELS: Dynamic;
  var FAST_EDIT_DEBUG_POSITION: Dynamic;
  function FastEditDebugDisclosure({
    head: head,
    note: note,
    open0: openInitially,
    strong: strong,
    children: children,
  }: Dynamic): Dynamic {
    let [open, setOpen]: Dynamic = (0, ReactFastEditDebug.useState)(
      openInitially,
    );
    return (
      <div
        className={
          strong === true
            ? "mb-2 rounded-[6px] border border-[var(--t-border)]"
            : "border-t border-[var(--t-border)] first:border-t-0"
        }
      >
        <button
          type={"button"}
          aria-expanded={open}
          onClick={(): Dynamic => setOpen(!open)}
          className={
            "flex w-full cursor-pointer items-baseline gap-2 border-0 px-2 py-1 text-left text-[12px] text-[var(--t-fg)] " +
            (strong === true ? "bg-[var(--t-strip)]" : "bg-transparent")
          }
        >
          <span className={"w-[10px] shrink-0 text-[var(--t-fg-muted)]"}>
            <runtime.Icon
              name={open ? "CaretDown" : "CaretRight"}
              size={"xs"}
            />
          </span>
          <span className={"font-semibold [overflow-wrap:anywhere]"}>
            {head}
          </span>
          <span
            className={"ml-auto shrink-0 text-[11px] text-[var(--t-fg-muted)]"}
          >
            {note}
          </span>
        </button>
        {open && (
          <div className={strong === true ? "" : "px-2 pb-2 pl-[26px]"}>
            {children}
          </div>
        )}
      </div>
    );
  }
  function FastEditDebugMessage({
    n: number,
    role: role,
    what: what,
    text: text,
    open0: openInitially,
  }: Dynamic): Dynamic {
    let sections: Dynamic = (0, runtime.splitFastEditMessageSections)(text);
    return (
      <FastEditDebugDisclosure
        strong={true}
        head={[number, role, what]
          .filter((input?: Dynamic): Dynamic => input !== "")
          .join(" \xB7 ")}
        note={formatDebugCharacterCount(text.length)}
        open0={openInitially}
      >
        {sections.length < 2 ? (
          <pre className={FAST_EDIT_DEBUG_TIER_LABELS + " p-2"}>{text}</pre>
        ) : (
          sections.map(
            (input?: Dynamic, options?: Dynamic): Dynamic => (
              <FastEditDebugDisclosure
                key={options}
                head={
                  input.head === ""
                    ? "(before the first head)"
                    : input.head === "[artboard]"
                      ? compactDebugText(
                          input.text.split(`
`)[0],
                          80,
                        )
                      : input.head
                }
                note={formatDebugCharacterCount(input.text.length)}
                open0={input.head !== "[artboard]"}
              >
                <pre className={FAST_EDIT_DEBUG_TIER_LABELS}>{input.text}</pre>
              </FastEditDebugDisclosure>
            ),
          )
        )}
      </FastEditDebugDisclosure>
    );
  }
  function FastEditDebugCallDetail({ c: call }: Dynamic): Dynamic {
    let lastMessageIndex: Dynamic = call.messages.length - 1;
    return (
      <div data-testid={"fast-edit-debug-detail"}>
        {call.messages.map(
          (input?: Dynamic, options?: Dynamic): Dynamic => (
            <FastEditDebugMessage
              key={options}
              n={String(options + 1)}
              role={input.role}
              text={input.content}
              open0={options === lastMessageIndex}
              what={
                options === 0
                  ? "rules (the page sends no system field: these rules are message 1)"
                  : options === lastMessageIndex
                    ? "newest"
                    : (/^\[t\d+\]/.exec(input.content)?.[0] ?? "")
              }
            />
          ),
        )}
        <FastEditDebugMessage
          n={""}
          role={"reply"}
          what={
            call.error !== undefined
              ? "failed: " +
                call.error.code +
                (call.error.message !== "" ? ": " + call.error.message : "")
              : call.ms === null
                ? "still arriving"
                : ""
          }
          text={call.reply}
          open0={true}
        />
      </div>
    );
  }
  function FastEditDebugCallRow({ c: call, onOpen: onOpen }: Dynamic): Dynamic {
    if (call.ended !== undefined)
      return (
        <div
          data-testid={"fast-edit-debug-end"}
          className={
            "border-0 border-b border-solid border-[var(--t-border)] px-3 py-1.5 font-mono text-[11px] leading-[17px] text-[var(--t-fg-muted)]"
          }
        >
          {String(call.n) +
            " " +
            formatFastEditDebugTime(call.at) +
            " " +
            (0, runtime.describeFastEditDebugCompletion)(call)}
        </div>
      );
    let value: Dynamic = (0, runtime.classifyFastEditDebugCall)(call);
    return (
      <button
        type={"button"}
        data-testid={"fast-edit-debug-row"}
        onClick={onOpen}
        className={
          "block w-full cursor-pointer border-0 border-b border-solid border-[var(--t-border)] bg-transparent px-3 py-1.5 text-left text-[12px] leading-[17px] hover:bg-[var(--t-wash-1)] " +
          (call.error !== undefined
            ? "text-[var(--t-bad)]"
            : "text-[var(--t-fg)]")
        }
      >
        <div className={"flex gap-2"}>
          <span className={"font-semibold"}>{String(call.n)}</span>
          <span>{formatFastEditDebugTime(call.at)}</span>
          <span className={"font-semibold"}>{value.road}</span>
          {value.later && <span>{"call 2"}</span>}
          <span className={"ml-auto shrink-0 text-[var(--t-fg-muted)]"}>
            {formatDebugDuration(call.msFirst) +
              " / " +
              formatDebugDuration(call.ms) +
              " ms"}
          </span>
        </div>
        <div className={"[overflow-wrap:anywhere]"}>
          {compactDebugText(value.prompt)}
        </div>
        <div className={"flex gap-2 text-[var(--t-fg-muted)]"}>
          <span className={"font-mono text-[11px] [overflow-wrap:anywhere]"}>
            {call.error !== undefined
              ? call.error.code + " " + compactDebugText(call.reply, 50)
              : compactDebugText(call.reply)}
          </span>
          <span className={"ml-auto shrink-0"}>
            {String(call.messages.length) +
              " turns \xB7 " +
              formatDebugCharacterCount(value.chars)}
          </span>
        </div>
      </button>
    );
  }
  function FastEditDebugPanel(): Dynamic {
    let [, rerender]: Dynamic = (0, ReactFastEditDebug.useReducer)(
      (input?: Dynamic): Dynamic => input + 1,
      0,
    );
    (0, ReactFastEditDebug.useEffect)(
      (): Dynamic => runtime.fastEditDebugStore.subscribe(rerender),
      [],
    );
    let [open, setOpen]: Dynamic = (0, ReactFastEditDebug.useState)(false),
      [activeCall, setActiveCall]: Dynamic = (0, ReactFastEditDebug.useState)(
        null,
      );
    (0, ReactFastEditDebug.useEffect)((): Dynamic => {
      if (!open) return;
      let callback: Dynamic = (input?: Dynamic): Dynamic => {
        input.key === "Escape" && setOpen(false);
      };
      (window as Dynamic).addEventListener("keydown", callback, {
        capture: true,
      });
      return (): Dynamic =>
        (window as Dynamic).removeEventListener("keydown", callback, {
          capture: true,
        });
    }, [open]);
    let value: Dynamic = runtime.fastEditDebugStore.all(),
      value2: Dynamic =
        activeCall === null
          ? undefined
          : value.find((input?: Dynamic): Dynamic => input.n === activeCall),
      value3: Dynamic = (0, ReactFastEditDebug.useRef)(null);
    (0, ReactFastEditDebug.useEffect)((): Dynamic => {
      open &&
        value2 === undefined &&
        value3.current !== null &&
        (value3.current.scrollTop = value3.current.scrollHeight);
    }, [open, value2 === undefined, value.length]);
    let value4: Dynamic = (
      <div
        className={
          "pointer-events-auto fixed z-[61] " + FAST_EDIT_DEBUG_POSITION.icon
        }
      >
        <runtime.CdsIsland density={"compact"} className={"contents"}>
          <runtime.Button
            variant={"secondary"}
            size={"sm"}
            data-testid={"fast-edit-debug"}
            aria-label={"Fast Edit calls"}
            aria-expanded={open}
            onClick={(): Dynamic => setOpen(!open)}
          >
            <svg
              width={"16"}
              height={"16"}
              viewBox={"0 0 16 16"}
              fill={"none"}
              stroke={"currentColor"}
              strokeWidth={"1.3"}
              strokeLinecap={"round"}
              aria-hidden={"true"}
            >
              <ellipse cx={"8"} cy={"9.5"} rx={"3.2"} ry={"4"} />
              <path d={"M6 5.8a2 2 0 0 1 4 0"} />
              <path d={"M8 5.5v8"} />
              <path
                d={
                  "M4.8 8H2.5M4.8 10.5H2.2M5.3 12.6 3.4 14M11.2 8h2.3M11.2 10.5h2.6M10.7 12.6l1.9 1.4M6.2 4.2 5 2.6M9.8 4.2 11 2.6"
                }
              />
            </svg>
            <span
              data-testid={"fast-edit-debug-count"}
              className={"ml-1 text-[11px]"}
            >
              {String(value.length)}
            </span>
          </runtime.Button>
        </runtime.CdsIsland>
      </div>
    );
    return (
      <fastEditDebugJsxRuntime.Fragment>
        {value4}
        {open &&
          (0, fastEditDebugPortal.createPortal)(
            <div
              data-testid={"fast-edit-debug-panel"}
              role={"dialog"}
              aria-label={"Fast Edit calls"}
              className={
                "pointer-events-auto fixed z-[1000] flex max-h-[80vh] w-[560px] max-w-[calc(100vw_-_32px)] flex-col overflow-hidden rounded-[10px] border border-solid border-[var(--t-border)] bg-[var(--t-panel)] text-[var(--t-fg)] shadow-panel-sm " +
                FAST_EDIT_DEBUG_POSITION.panel
              }
            >
              <runtime.CdsIsland density={"compact"} className={"contents"}>
                <div
                  className={
                    "flex shrink-0 items-center gap-2 border-0 border-b border-solid border-[var(--t-border)] px-3 py-2 text-[12px]"
                  }
                >
                  {value2 !== undefined && (
                    <runtime.Button
                      variant={"secondary"}
                      size={"xs"}
                      aria-label={"Back to the list"}
                      data-testid={"fast-edit-debug-back"}
                      onClick={(): Dynamic => setActiveCall(null)}
                    >
                      <runtime.Icon name={"ArrowLeft"} size={"xs"} />
                    </runtime.Button>
                  )}
                  <span className={"font-semibold"}>
                    {value2 !== undefined
                      ? "Call " +
                        String(value2.n) +
                        " \xB7 " +
                        formatFastEditDebugTime(value2.at) +
                        " \xB7 " +
                        value2.tier +
                        " \xB7 " +
                        formatDebugDuration(value2.msFirst) +
                        " / " +
                        formatDebugDuration(value2.ms) +
                        " ms"
                      : "Fast Edit calls"}
                  </span>
                  <span className={"ml-auto flex gap-1"}>
                    {value2 !== undefined ? (
                      <runtime.Button
                        variant={"secondary"}
                        size={"xs"}
                        data-testid={"fast-edit-debug-copy"}
                        onClick={(): Dynamic =>
                          FAST_EDIT_DEBUG_OUTCOME_LABELS(value2)
                        }
                      >
                        {"Copy call"}
                      </runtime.Button>
                    ) : (
                      <fastEditDebugJsxRuntime.Fragment>
                        <runtime.Button
                          variant={"secondary"}
                          size={"xs"}
                          data-testid={"fast-edit-debug-copy-all"}
                          onClick={(): Dynamic =>
                            FAST_EDIT_DEBUG_OUTCOME_LABELS(value)
                          }
                        >
                          {"Copy all"}
                        </runtime.Button>
                        <runtime.Button
                          variant={"secondary"}
                          size={"xs"}
                          data-testid={"fast-edit-debug-clear"}
                          onClick={(): Dynamic =>
                            runtime.fastEditDebugStore.clear()
                          }
                        >
                          {"Clear"}
                        </runtime.Button>
                      </fastEditDebugJsxRuntime.Fragment>
                    )}
                  </span>
                </div>
              </runtime.CdsIsland>
              <div
                ref={value3}
                className={
                  "min-h-0 flex-1 overflow-y-auto overflow-x-hidden " +
                  (value2 !== undefined ? "p-2" : "")
                }
              >
                {value2 !== undefined ? (
                  (() => {
                    const _Component = FastEditDebugCallDetail;
                    const _props = {
                      c: value2,
                    } as const;
                    const _key = value2.n;
                    return <_Component key={_key} {..._props} />;
                  })()
                ) : value.length === 0 ? (
                  <div
                    className={"px-3 py-4 text-[12px] text-[var(--t-fg-muted)]"}
                  >
                    {"No calls yet."}
                  </div>
                ) : (
                  value.map(
                    (input?: Dynamic): Dynamic =>
                      (() => {
                        const _Component2 = FastEditDebugCallRow;
                        const _props2 = {
                          c: input,
                          onOpen: (): Dynamic => setActiveCall(input.n),
                        } as const;
                        const _key2 = input.n;
                        return <_Component2 key={_key2} {..._props2} />;
                      })(),
                  )
                )}
              </div>
              <div
                className={
                  "shrink-0 border-0 border-t border-solid border-[var(--t-border)] px-3 py-1 text-[11px] text-[var(--t-fg-muted)]"
                }
              >
                {"In memory: a reload clears."}
              </div>
            </div>,
            (document as Dynamic).body,
          )}
      </fastEditDebugJsxRuntime.Fragment>
    );
  }
  bindRuntimeValue(
    runtime,
    "ReactFastEditDebug",
    () => ReactFastEditDebug,
    (value) => {
      ReactFastEditDebug = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "fastEditDebugPortal",
    () => fastEditDebugPortal,
    (value) => {
      fastEditDebugPortal = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "fastEditDebugJsxRuntime",
    () => fastEditDebugJsxRuntime,
    (value) => {
      fastEditDebugJsxRuntime = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "padTwoDigits",
    () => padTwoDigits,
    (value) => {
      padTwoDigits = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "formatFastEditDebugTime",
    () => formatFastEditDebugTime,
    (value) => {
      formatFastEditDebugTime = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "compactDebugText",
    () => compactDebugText,
    (value) => {
      compactDebugText = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "formatDebugCharacterCount",
    () => formatDebugCharacterCount,
    (value) => {
      formatDebugCharacterCount = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "formatDebugDuration",
    () => formatDebugDuration,
    (value) => {
      formatDebugDuration = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FAST_EDIT_DEBUG_OUTCOME_LABELS",
    () => FAST_EDIT_DEBUG_OUTCOME_LABELS,
    (value) => {
      FAST_EDIT_DEBUG_OUTCOME_LABELS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FAST_EDIT_DEBUG_TIER_LABELS",
    () => FAST_EDIT_DEBUG_TIER_LABELS,
    (value) => {
      FAST_EDIT_DEBUG_TIER_LABELS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FastEditDebugDisclosure",
    () => FastEditDebugDisclosure,
  );
  bindRuntimeValue(runtime, "FastEditDebugMessage", () => FastEditDebugMessage);
  bindRuntimeValue(
    runtime,
    "FastEditDebugCallDetail",
    () => FastEditDebugCallDetail,
  );
  bindRuntimeValue(runtime, "FastEditDebugCallRow", () => FastEditDebugCallRow);
  bindRuntimeValue(
    runtime,
    "FAST_EDIT_DEBUG_POSITION",
    () => FAST_EDIT_DEBUG_POSITION,
    (value) => {
      FAST_EDIT_DEBUG_POSITION = value;
    },
  );
  bindRuntimeValue(runtime, "FastEditDebugPanel", () => FastEditDebugPanel);
  return () => {
    ReactFastEditDebug = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react)(),
      1,
    );
    fastEditDebugPortal = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_dom)(),
      1,
    );
    (0, runtime.initializeCdsIndex)();
    (0, runtime.initializePlatformCdsIsland)();
    fastEditDebugJsxRuntime = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_jsx_runtime)(),
      1,
    );
    padTwoDigits = (input?: Dynamic): Dynamic => String(input).padStart(2, "0");
    formatFastEditDebugTime = (input?: Dynamic): Dynamic => {
      let date: Dynamic = new Date(input);
      return (
        padTwoDigits(date.getHours()) +
        ":" +
        padTwoDigits(date.getMinutes()) +
        ":" +
        padTwoDigits(date.getSeconds())
      );
    };
    compactDebugText = (input?: Dynamic, options: Dynamic = 60): Dynamic => {
      let value: Dynamic = input.replace(/\s+/g, " ").trim();
      return value.length > options
        ? value.slice(0, options - 1) + "\u2026"
        : value;
    };
    formatDebugCharacterCount = (input?: Dynamic): Dynamic =>
      input.toLocaleString("en-US") + " chars";
    formatDebugDuration = (input?: Dynamic): Dynamic =>
      input === null ? "\u2013" : String(input);
    FAST_EDIT_DEBUG_OUTCOME_LABELS = (input?: Dynamic): Dynamic => {
      navigator.clipboard
        ?.writeText(JSON.stringify(input, null, 2))
        .catch((): Dynamic => {});
    };
    FAST_EDIT_DEBUG_TIER_LABELS =
      "m-0 whitespace-pre-wrap break-words font-mono text-[11px] leading-[16px] [overflow-wrap:anywhere]";
    FAST_EDIT_DEBUG_POSITION = {
      icon: "bottom-[88px] right-[16px]",
      panel: "bottom-[116px] right-[16px]",
    };
  };
}
