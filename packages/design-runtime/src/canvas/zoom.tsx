/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";
export function installCanvasZoom(runtime: RuntimeBindings): () => void {
  var react_F_: Dynamic;
  var jsx_Wl: Dynamic;
  var zoomScalePresets: Dynamic;
  var zoomLimitMessages: Dynamic;
  var zoomControlGlyph: Dynamic;
  var zoomScalePercent: Dynamic;
  function CanvasZoomControl({
    getScale: getScale,
    onPickScale: onPickScale,
    onFit: onFit,
    getLimits: getLimits,
    fitLabel = "Fit",
    tip = "Zoom",
    disabled: disabled2 = false,
    disabledTip: disabledTip,
    tipSide: tipSide,
    "data-testid": dataTestid = "mc-zoom",
    readout = false,
    subscribeScale: subscribeScale,
    onStepZoom: onStepZoom,
    undo: undo,
    zoomRowsDisabled = false,
    zoomRowsDisabledTip: zoomRowsDisabledTip,
    viewToggles = [],
  }: Dynamic): Dynamic {
    let [value, value2]: Dynamic = (0, react_F_.useState)(1),
      [value3, value4]: Dynamic = (0, react_F_.useState)(
        (): Dynamic => (readout ? getScale() : 1),
      ),
      value5: Dynamic = (0, react_F_.useRef)(false);
    (0, react_F_.useLayoutEffect)((): Dynamic => {
      if (!(!readout || subscribeScale === undefined))
        return subscribeScale((input?: Dynamic): Dynamic => {
          value4(input);
          value5.current && (value2(input), value7(getLimits?.() ?? {}));
        });
    }, [readout, subscribeScale]);
    let [value6, value7]: Dynamic = (0, react_F_.useState)({}),
      value8: Dynamic = zoomScalePercent(value),
      value9: Dynamic =
        value6.minScale == null ? -1 / 0 : Math.round(value6.minScale * 100),
      value10: Dynamic =
        value6.maxScale == null ? 1 / 0 : Math.round(value6.maxScale * 100),
      callback: Dynamic = (input?: Dynamic): Dynamic => {
        value5.current = input;
        input && (value2(getScale()), value7(getLimits?.() ?? {}));
      },
      value11: Dynamic =
        typeof navigator !== "undefined" &&
        /Mac|iPhone|iPad/.test(navigator.platform),
      callback2: Dynamic = (input?: Dynamic): Dynamic => (
        <span
          aria-hidden={"true"}
          className={"pointer-coarse:hidden text-footnote text-muted"}
        >
          {input}
        </span>
      ),
      value12: Dynamic =
        zoomRowsDisabledTip === undefined
          ? undefined
          : zoomRowsDisabled
            ? zoomRowsDisabledTip
            : null,
      value13: Dynamic = (
        <jsx_Wl.Fragment>
          {onStepZoom !== undefined ? (
            <jsx_Wl.Fragment>
              <runtime.MenuMenuAssignValue.Item
                disabled={zoomRowsDisabled || value8 >= value10}
                disabledReason={value12}
                trailing={callback2(value11 ? "\u2318+" : "Ctrl +")}
                aria-keyshortcuts={value11 ? "Meta+=" : "Control+="}
                onClick={(): Dynamic => onStepZoom(1)}
              >
                {"Zoom in"}
              </runtime.MenuMenuAssignValue.Item>
              <runtime.MenuMenuAssignValue.Item
                disabled={zoomRowsDisabled || value8 <= value9}
                disabledReason={value12}
                trailing={callback2(value11 ? "\u2318\u2212" : "Ctrl \u2212")}
                aria-keyshortcuts={value11 ? "Meta+-" : "Control+-"}
                onClick={(): Dynamic => onStepZoom(-1)}
              >
                {"Zoom out"}
              </runtime.MenuMenuAssignValue.Item>
            </jsx_Wl.Fragment>
          ) : null}
          <runtime.MenuMenuAssignValue.Item
            disabled={zoomRowsDisabled}
            disabledReason={value12}
            onClick={onFit}
          >
            {fitLabel}
          </runtime.MenuMenuAssignValue.Item>
          <runtime.MenuMenuAssignValue.Separator />
          <runtime.MenuMenuAssignValue.Group>
            {zoomScalePresets.every(
              (input?: Dynamic): Dynamic => Math.round(input * 100) !== value8,
            ) ? (
              <runtime.MenuMenuAssignValue.GroupLabel>
                <span className={"tabular-nums"}>
                  {"Now "}
                  {value8}
                  {"%"}
                </span>
              </runtime.MenuMenuAssignValue.GroupLabel>
            ) : null}
            {zoomScalePresets.map((input?: Dynamic): Dynamic => {
              let value14: Dynamic = Math.round(input * 100),
                value15: Dynamic =
                  value14 < value9
                    ? "below"
                    : value14 > value10
                      ? "above"
                      : null,
                value16: Dynamic = zoomRowsDisabled
                  ? (value12 ?? null)
                  : value15 === null
                    ? null
                    : value15 === "below"
                      ? (value6.minTip ?? zoomLimitMessages.below)
                      : (value6.maxTip ?? zoomLimitMessages.above);
              return (
                <runtime.MenuMenuAssignValue.Item
                  key={input}
                  checkedRole={"radio"}
                  checked={value14 === value8}
                  disabled={zoomRowsDisabled || value15 !== null}
                  disabledReason={value16}
                  onClick={(): Dynamic => onPickScale(input)}
                >
                  {value14}
                  {"%"}
                </runtime.MenuMenuAssignValue.Item>
              );
            })}
          </runtime.MenuMenuAssignValue.Group>
          {viewToggles.length > 0 ? (
            <jsx_Wl.Fragment>
              <runtime.MenuMenuAssignValue.Separator />
              {viewToggles.map(
                (input?: Dynamic): Dynamic =>
                  (() => {
                    const _Component = runtime.MenuMenuAssignValue.Item;
                    const _props = {
                      checkedRole: "checkbox",
                      checked: input.checked,
                      shortcut: input.shortcut,
                      "aria-describedby": input.describedBy,
                      onClick: input.onToggle,
                      children: input.label,
                    } as const;
                    const _key = input.label;
                    return <_Component key={_key} {..._props} />;
                  })(),
              )}
            </jsx_Wl.Fragment>
          ) : null}
          {undo !== undefined ? (
            <jsx_Wl.Fragment>
              <runtime.MenuMenuAssignValue.Separator />
              <runtime.MenuMenuAssignValue.Item
                disabled={!undo.canUndo()}
                disabledReason={"Nothing to undo yet"}
                shortcut={"cmd+z"}
                onClick={(): Dynamic => undo.undo()}
              >
                {"Undo"}
              </runtime.MenuMenuAssignValue.Item>
              <runtime.MenuMenuAssignValue.Item
                disabled={!undo.canRedo()}
                disabledReason={"Nothing to redo"}
                shortcut={"shift+cmd+z"}
                onClick={(): Dynamic => undo.redo()}
              >
                {"Redo"}
              </runtime.MenuMenuAssignValue.Item>
            </jsx_Wl.Fragment>
          ) : null}
        </jsx_Wl.Fragment>
      );
    return readout ? (
      <runtime.SessionStripPopover
        readout={String(zoomScalePercent(value3)) + "%"}
        readoutSizer={"100%"}
        label={"Zoom"}
        tip={tip}
        disabled={disabled2}
        disabledTip={disabledTip}
        side={tipSide}
        data-testid={dataTestid}
        onOpenChange={callback}
      >
        {value13}
      </runtime.SessionStripPopover>
    ) : (
      <runtime.SessionStripPopover
        glyph={zoomControlGlyph}
        iconOnly={true}
        label={"Zoom"}
        tip={tip}
        disabled={disabled2}
        disabledTip={disabledTip}
        side={tipSide}
        data-testid={dataTestid}
        onOpenChange={callback}
      >
        {value13}
      </runtime.SessionStripPopover>
    );
  }
  bindRuntimeValue(
    runtime,
    "react_F_",
    () => react_F_,
    (value) => {
      react_F_ = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsx_Wl",
    () => jsx_Wl,
    (value) => {
      jsx_Wl = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "zoomScalePresets",
    () => zoomScalePresets,
    (value) => {
      zoomScalePresets = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "zoomLimitMessages",
    () => zoomLimitMessages,
    (value) => {
      zoomLimitMessages = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "zoomControlGlyph",
    () => zoomControlGlyph,
    (value) => {
      zoomControlGlyph = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "zoomScalePercent",
    () => zoomScalePercent,
    (value) => {
      zoomScalePercent = value;
    },
  );
  bindRuntimeValue(runtime, "CanvasZoomControl", () => CanvasZoomControl);
  return () => {
    react_F_ = (0, runtime.toModuleNamespace)((0, runtime.load_react)(), 1);
    (0, runtime.initializeCdsIndex)();
    jsx_Wl = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_jsx_runtime)(),
      1,
    );
    zoomScalePresets = [0.25, 0.5, 0.75, 1, 1.5, 2];
    zoomLimitMessages = {
      below: "Below the zoom limit \u2014 that's as far out as it goes",
      above: "Past the zoom limit \u2014 that's as far in as it goes",
    };
    zoomControlGlyph = <runtime.ZoomToolIcon />;
    zoomScalePercent = (input?: Dynamic): Dynamic =>
      Number.isFinite(input) && input > 0
        ? Math.max(1, Math.round(input * 100))
        : 100;
  };
}
