/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";
export function installFindBar(runtime: RuntimeBindings): () => void {
  var react_Kw: Dynamic;
  var findInPageLabel: Dynamic;
  var previousFindMatchLabel: Dynamic;
  var nextFindMatchLabel: Dynamic;
  var closeFindBarLabel: Dynamic;
  var findFieldPlaceholder: Dynamic;
  var noFindMatchesLabel: Dynamic;
  var jsx_tv: Dynamic;
  var findBarStyle: Dynamic;
  var findFieldStyle: Dynamic;
  var findCountStyle: Dynamic;
  var findLiveAnnouncementStyle: Dynamic;
  function findMatchAriaStatus(
    current?: Dynamic,
    total?: Dynamic,
    capped?: Dynamic,
    description?: Dynamic,
  ): Dynamic {
    return total === 0
      ? noFindMatchesLabel
      : String(current) +
          " of " +
          String(total) +
          (capped ? " or more" : "") +
          (description === undefined ? "" : ", " + description);
  }
  function findMatchCountText(status?: Dynamic): Dynamic {
    return status.query === "" || status.searching
      ? ""
      : String(status.current) +
          "/" +
          String(status.total) +
          (status.capped ? "+" : "");
  }
  function FindBar(props?: Dynamic): Dynamic {
    let { onMounted: value }: Dynamic = props;
    (0, react_Kw.useEffect)(
      (): Dynamic => (value(true), (): Dynamic => value(false)),
      [value],
    );
    return props.open ? <FindBarContents {...props} /> : null;
  }
  function createStableFindStatusReader(getStatus?: Dynamic): Dynamic {
    let value: Dynamic = null;
    return (): Dynamic => {
      let value2: Dynamic = getStatus();
      value2.query === ""
        ? (value = null)
        : value2.searching || (value = value2);
      return value2.searching && value !== null ? value : value2;
    };
  }
  function FindBarContents({
    subscribe: subscribe,
    getStatus: getStatus,
    fieldRef: fieldRef,
    onQuery: onQuery,
    onStep: onStep,
    onClose: onClose,
  }: Dynamic): Dynamic {
    let value: Dynamic = (0, react_Kw.useMemo)(
        (): Dynamic => createStableFindStatusReader(getStatus),
        [getStatus],
      ),
      value2: Dynamic = (0, react_Kw.useSyncExternalStore)(subscribe, value),
      [value3, value4]: Dynamic = (0, react_Kw.useState)(""),
      value5: Dynamic = (0, react_Kw.useRef)(null),
      value6: Dynamic = (0, react_Kw.useRef)((): Dynamic => false);
    value6.current = (event?: Dynamic): Dynamic => {
      if (event.isComposing || event.keyCode === 229) return false;
      let current: Dynamic = fieldRef.current,
        value9: Dynamic =
          event.key === "Enter" && event.target === current
            ? event.shiftKey
              ? -1
              : 1
            : (0, runtime.findDirectionShortcut)(event);
      if (event.key === "Escape") onClose();
      else if (value9 !== undefined) onStep(value9);
      else if ((0, runtime.isFindShortcut)(event)) {
        current?.focus();
        current?.select();
      } else return false;
      event.preventDefault();
      return true;
    };
    (0, react_Kw.useEffect)(
      (): Dynamic =>
        value5.current === null
          ? undefined
          : (0, runtime.registerFindOwner)(
              value5.current,
              (input?: Dynamic): Dynamic => value6.current(input),
            ),
      [],
    );
    let callback: Dynamic = (event?: Dynamic): Dynamic => {
        event.target.closest(runtime.editableElementSelector) === null &&
          event.preventDefault();
      },
      value7: Dynamic = value2.total === 0,
      value8: Dynamic =
        value2.query === ""
          ? findFieldPlaceholder
          : value2.searching
            ? undefined
            : noFindMatchesLabel;
    return (
      <runtime.CdsRoot
        density={"compact"}
        render={
          <runtime.Surface
            elevation={runtime.PanelValue}
            role={"search"}
            aria-label={findInPageLabel}
            data-mc-chrome={""}
            {...{
              [runtime.McFindAttribute]: "",
            }}
            style={findBarStyle}
            ref={value5}
            onMouseDown={callback}
          />
        }
      >
        <runtime.TooltipGroup>
          <runtime.TextInput
            ref={fieldRef}
            value={value3}
            onChange={(event?: Dynamic): Dynamic => {
              value4(event.target.value);
              event.nativeEvent.isComposing || onQuery(event.target.value);
            }}
            onCompositionEnd={(input?: Dynamic): Dynamic =>
              onQuery(input.currentTarget.value)
            }
            placeholder={findInPageLabel}
            aria-label={findInPageLabel}
            autoComplete={"off"}
            spellCheck={false}
            maxLength={200}
            className={"pointer-coarse:h-10"}
            style={findFieldStyle}
          />
          <span
            role={"status"}
            aria-atomic={"true"}
            className={"text-muted text-caption"}
            style={findCountStyle}
          >
            <span aria-hidden={"true"}>{findMatchCountText(value2)}</span>
            <span style={findLiveAnnouncementStyle}>
              {findMatchCountText(value2) === ""
                ? ""
                : findMatchAriaStatus(
                    value2.current,
                    value2.total,
                    value2.capped,
                    value2.place,
                  )}
            </span>
          </span>
          <runtime.ToolbarPrimitivesComponent
            iconOnly={true}
            icon={"ArrowUp"}
            label={previousFindMatchLabel}
            disabled={value7}
            disabledTip={value8}
            onClick={(): Dynamic => onStep(-1)}
          />
          <runtime.ToolbarPrimitivesComponent
            iconOnly={true}
            icon={"ArrowDown"}
            label={nextFindMatchLabel}
            disabled={value7}
            disabledTip={value8}
            onClick={(): Dynamic => onStep(1)}
          />
          <runtime.ToolbarPrimitivesComponent
            iconOnly={true}
            icon={"X"}
            label={closeFindBarLabel}
            onClick={onClose}
          />
        </runtime.TooltipGroup>
      </runtime.CdsRoot>
    );
  }
  bindRuntimeValue(
    runtime,
    "react_Kw",
    () => react_Kw,
    (value) => {
      react_Kw = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "findInPageLabel",
    () => findInPageLabel,
    (value) => {
      findInPageLabel = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "previousFindMatchLabel",
    () => previousFindMatchLabel,
    (value) => {
      previousFindMatchLabel = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "nextFindMatchLabel",
    () => nextFindMatchLabel,
    (value) => {
      nextFindMatchLabel = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "closeFindBarLabel",
    () => closeFindBarLabel,
    (value) => {
      closeFindBarLabel = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "findFieldPlaceholder",
    () => findFieldPlaceholder,
    (value) => {
      findFieldPlaceholder = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "noFindMatchesLabel",
    () => noFindMatchesLabel,
    (value) => {
      noFindMatchesLabel = value;
    },
  );
  bindRuntimeValue(runtime, "findMatchAriaStatus", () => findMatchAriaStatus);
  bindRuntimeValue(
    runtime,
    "jsx_tv",
    () => jsx_tv,
    (value) => {
      jsx_tv = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "findBarStyle",
    () => findBarStyle,
    (value) => {
      findBarStyle = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "findFieldStyle",
    () => findFieldStyle,
    (value) => {
      findFieldStyle = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "findCountStyle",
    () => findCountStyle,
    (value) => {
      findCountStyle = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "findLiveAnnouncementStyle",
    () => findLiveAnnouncementStyle,
    (value) => {
      findLiveAnnouncementStyle = value;
    },
  );
  bindRuntimeValue(runtime, "findMatchCountText", () => findMatchCountText);
  bindRuntimeValue(runtime, "FindBar", () => FindBar);
  bindRuntimeValue(
    runtime,
    "createStableFindStatusReader",
    () => createStableFindStatusReader,
  );
  bindRuntimeValue(runtime, "FindBarContents", () => FindBarContents);
  return () => {
    react_Kw = (0, runtime.toModuleNamespace)((0, runtime.load_react)(), 1);
    (0, runtime.initializeCdsIndex)();
    findInPageLabel = "Find in page";
    previousFindMatchLabel = "Previous match";
    nextFindMatchLabel = "Next match";
    closeFindBarLabel = "Close find bar";
    findFieldPlaceholder = "Type to search";
    noFindMatchesLabel = "No matches";
    jsx_tv = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_jsx_runtime)(),
      1,
    );
    findBarStyle = {
      position: "absolute",
      top: "max(var(--tb-overlay-h, 0px), 8px)",
      insetInlineEnd: 12,
      zIndex: 49,
      display: "flex",
      alignItems: "center",
      gap: 4,
      padding: 5,
      width: 320,
      maxWidth: "calc(100% - 24px)",
    };
    findFieldStyle = {
      flex: "1 1 0",
      minWidth: 0,
    };
    findCountStyle = {
      minWidth: "3.5em",
      textAlign: "end",
      fontVariantNumeric: "tabular-nums",
      whiteSpace: "nowrap",
    };
    findLiveAnnouncementStyle = {
      position: "absolute",
      width: 1,
      height: 1,
      overflow: "hidden",
      clipPath: "inset(50%)",
      whiteSpace: "nowrap",
    };
  };
}
