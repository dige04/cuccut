/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";
export function installEditorSessionStripPopover(
  runtime: RuntimeBindings,
): () => void {
  var jsxSessionStripPopover: Dynamic;
  var reactSessionStripPopover: Dynamic;
  var jsxSessionStripPopover_2: Dynamic;
  function SessionStripPopover(input?: Dynamic): Dynamic {
    let {
        label: value,
        tip: value2,
        descriptionSuffix: value3,
        children: value4,
        align: value11 = "start",
        side: value12 = "bottom",
        open: value5,
        onOpenChange: value6,
        disabled: value13 = false,
        disabledTip: value7,
        finalFocus: value8,
        className: value9,
        "data-testid": value10,
      }: Dynamic = input,
      value14: Dynamic = (0, runtime.reactCollaborationPeerBadge_3.useContext)(
        runtime.ToolbarPrimitivesContext,
      ),
      value15: Dynamic = (0, runtime.reactCollaborationPeerBadge_3.useRef)(
        null,
      ),
      value16: Dynamic = (0, runtime.reactCollaborationPeerBadge_3.useRef)(
        null,
      ),
      [value17, value18]: Dynamic = (0,
      runtime.reactCollaborationPeerBadge_3.useState)(false),
      value19: Dynamic = value5 ?? value17,
      [value20, value21]: Dynamic = (0,
      runtime.reactCollaborationPeerBadge_3.useState)(false),
      value22: Dynamic = value8 === true ? undefined : value8,
      value23: Dynamic = (0, runtime.reactCollaborationPeerBadge_3.useRef)(
        false,
      ),
      value24: Dynamic = (0, runtime.reactCollaborationPeerBadge_3.useRef)({
        disabled: value13,
        popupFinalFocus: value22,
      });
    value24.current = {
      disabled: value13,
      popupFinalFocus: value22,
    };
    let value25: Dynamic = (0, runtime.reactCollaborationPeerBadge_3.useRef)(
        false,
      ),
      value26: Dynamic = (0, runtime.reactCollaborationPeerBadge_3.useCallback)(
        (input2?: Dynamic): Dynamic => {
          value16.current = input2;
          input2 === null &&
            setTimeout((): Dynamic => {
              value23.current = false;
              let current: Dynamic = value15.current;
              if (
                !value25.current ||
                !value24.current.disabled ||
                current === null ||
                value24.current.popupFinalFocus === false ||
                !current.ownerDocument.hasFocus()
              )
                return;
              let activeElement: Dynamic = current.ownerDocument.activeElement;
              (activeElement === null ||
                activeElement === current.ownerDocument.body ||
                !activeElement.isConnected) &&
                current.focus({
                  preventScroll: true,
                });
            }, 0);
        },
        [],
      ),
      value27: Dynamic = input.icon ?? input.glyph,
      value28: Dynamic =
        input.readout === undefined || input.readout === ""
          ? value
          : input.readout + ", " + value,
      value29: Dynamic =
        input.readout === undefined ? input.pressed : undefined,
      value30: Dynamic = input.readout === undefined && input.emphasis === true,
      value31: Dynamic = input.iconOnly === true || (value14 && !value30),
      value32: Dynamic = (0, runtime.useDisabledToolbarItem)({
        disabled: value13,
        name: value28,
        reason: value7 ?? value2,
        pressed: value29,
        expanded: false,
        hasPopup: "menu",
      });
    (0, runtime.useToolbarPress)(value15, value13);
    let content: Dynamic = (0, runtime.toolbarItemTooltip)({
        label: value,
        tip: value2,
        disabledTip: value7,
        disabled: value13,
      }).content,
      value33: Dynamic = (0, runtime.useToolbarItemAccessibility)({
        disabled: value13,
        name: value28,
        tip: content,
        descriptionSuffix: value3,
      }),
      value34: Dynamic =
        input.readout !== undefined ? (
          <runtime.MenuMenuAssignValue.Trigger
            render={
              <runtime.Button
                variant={"ghost"}
                disabled={value13}
                aria-label={value28}
                aria-describedby={value33.describedBy}
                {...value32.inner}
                data-testid={value10}
                className={"shrink-0 tabular-nums"}
              >
                {input.readoutSizer === undefined ? (
                  input.readout
                ) : (
                  <span
                    data-sizer={input.readoutSizer}
                    className={
                      "inline-flex flex-col items-center before:invisible before:h-0 before:content-[attr(data-sizer)]"
                    }
                  >
                    {input.readout}
                  </span>
                )}
                <runtime.ToolbarCaret />
              </runtime.Button>
            }
          />
        ) : (
          <runtime.MenuMenuAssignValue.Trigger
            render={
              value31 && input.caret !== true ? (
                <runtime.Button
                  iconOnly={true}
                  variant={"ghost"}
                  icon={value27}
                  pressed={value29}
                  disabled={value13}
                  aria-label={value}
                  aria-describedby={value33.describedBy}
                  {...value32.inner}
                  data-testid={value10}
                  className={"shrink-0"}
                />
              ) : (
                <runtime.Button
                  variant={
                    value30 ? (value13 ? "secondary" : "primary") : "ghost"
                  }
                  icon={value27}
                  pressed={value29}
                  disabled={value13}
                  aria-label={value}
                  aria-describedby={value33.describedBy}
                  {...value32.inner}
                  data-testid={value10}
                  className={"shrink-0"}
                >
                  {value31 ? null : value}
                  {input.caret === true ? (
                    <runtime.ToolbarCaret inherit={value30 && !value13} />
                  ) : null}
                </runtime.Button>
              )
            }
          />
        ),
      value35: Dynamic = (0, runtime.joinClassNames)(
        "relative inline-flex shrink-0 rounded align-top outline-none focus-visible:outline-hidden focus-visible:shadow-focus",
        value9,
      );
    (0, runtime.reactCollaborationPeerBadge_3.useLayoutEffect)((): Dynamic => {
      value13 &&
        value19 &&
        (value5 === undefined && value18(false), value6?.(false));
      value21(
        !value13 &&
          value15.current !== null &&
          value15.current.contains(value15.current.ownerDocument.activeElement),
      );
    }, [value13]);
    let value36: Dynamic = value19 && !value13,
      value37: Dynamic = (0, runtime.reactCollaborationPeerBadge_3.useRef)(
        false,
      );
    (0, runtime.reactCollaborationPeerBadge_3.useLayoutEffect)((): Dynamic => {
      value37.current &&
        !value36 &&
        (value25.current =
          value16.current?.querySelector(":focus-visible") != null);
      if (value37.current && !value36 && !value13 && value22 !== false) {
        let current: Dynamic = value15.current;
        current !== null &&
        current.contains(current.ownerDocument.activeElement)
          ? value21(true)
          : (value23.current = true);
      }
      value37.current = value36;
    }, [value36]);
    return (
      <runtime.MenuMenuAssignValue.Root
        open={value36}
        disabled={value13}
        onOpenChange={(input2?: Dynamic): Dynamic => {
          value5 === undefined && value18(input2);
          value6?.(input2);
        }}
      >
        <runtime.Tooltip
          content={content}
          side={value12}
          hoverable={false}
          open={!value13 && (value19 || value20) ? false : undefined}
        >
          <span
            ref={value15}
            tabIndex={value13 ? 0 : -1}
            {...value32.props}
            onPointerEnter={value20 ? (): Dynamic => value21(false) : undefined}
            onBlur={value20 ? (): Dynamic => value21(false) : undefined}
            onFocus={(input2?: Dynamic): Dynamic => {
              let relatedTarget: Dynamic = input2.relatedTarget,
                value38: Dynamic =
                  relatedTarget !== null &&
                  relatedTarget.isConnected &&
                  !value16.current?.contains(relatedTarget) &&
                  !value15.current?.contains(relatedTarget);
              value23.current
                ? ((value23.current = false),
                  !value38 && !value13 && value21(true))
                : value20 && value38 && value21(false);
            }}
            data-tb-icon={
              input.readout === undefined && input.caret !== true && value31
                ? ""
                : undefined
            }
            data-tb-readout={input.readout !== undefined ? "" : undefined}
            className={value35}
          >
            {value34}
            {value33.mirror}
            {value32.mirror}
          </span>
        </runtime.Tooltip>
        <runtime.MenuMenuAssignValue.Popup
          ref={value26}
          side={value12}
          align={value11}
          finalFocus={value22}
        >
          {value4}
        </runtime.MenuMenuAssignValue.Popup>
      </runtime.MenuMenuAssignValue.Root>
    );
  }
  bindRuntimeValue(runtime, "SessionStripPopover", () => SessionStripPopover);
  bindRuntimeValue(
    runtime,
    "jsxSessionStripPopover",
    () => jsxSessionStripPopover,
    (value) => {
      jsxSessionStripPopover = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactSessionStripPopover",
    () => reactSessionStripPopover,
    (value) => {
      reactSessionStripPopover = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxSessionStripPopover_2",
    () => jsxSessionStripPopover_2,
    (value) => {
      jsxSessionStripPopover_2 = value;
    },
  );
  return () => {
    jsxSessionStripPopover = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_jsx_runtime)(),
      1,
    );
    reactSessionStripPopover = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react)(),
      1,
    );
    (0, runtime.initializeCdsIndex)();
    jsxSessionStripPopover_2 = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_jsx_runtime)(),
      1,
    );
  };
}
