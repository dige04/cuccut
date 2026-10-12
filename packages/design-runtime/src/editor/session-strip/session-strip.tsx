/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";
export function installEditorSessionStripSessionStrip(
  runtime: RuntimeBindings,
): () => void {
  var SessionStripButton: Dynamic;
  function updateSessionStripScrollAttrs(
    input?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    input.toggleAttribute("data-mc-more-start", options.scrollLeft > 1);
    input.toggleAttribute(
      "data-mc-more-end",
      options.scrollLeft < options.scrollWidth - options.clientWidth - 1,
    );
  }
  function refreshSessionStripPointers(): Dynamic {
    runtime.SessionStripPointerStateCurrentState !== null &&
      clearTimeout(runtime.SessionStripPointerStateCurrentState);
    runtime.SessionStripPointerStateCurrentState = null;
    let value: Dynamic = (0, runtime.SessionStripPointerStateNow)(),
      index: Dynamic = 0;
    for (let value2 of runtime.SessionStripPointerStateSubscribers as Dynamic) {
      let value3: Dynamic =
        value === null
          ? 0
          : (0, runtime.sessionStripPointerDeadline)(value2, value);
      value !== null && value < value3
        ? (value2.setAttribute("data-mc-through", String(Math.ceil(value3))),
          (index = Math.max(index, value3)))
        : value2.removeAttribute("data-mc-through");
    }
    value !== null &&
      index > 0 &&
      (runtime.SessionStripPointerStateCurrentState = setTimeout(
        refreshSessionStripPointers,
        Math.min(
          runtime.SessionStripPointerStateLimit,
          Math.max(0, index - value),
        ) + 1,
      ));
  }
  function SessionStrip({
    className: className,
    onPointerDown: onPointerDown,
    onMouseDown: onMouseDown,
    onMouseDownCapture: onMouseDownCapture,
    onClickCapture: onClickCapture,
    onScroll: onScroll,
    children: children,
    surface = "panel",
    placed = "above",
    coversSelection: coversSelection,
    wrap = false,
    ...props
  }: Dynamic): Dynamic {
    (0, runtime.reactSessionStripPointerState.useEffect)(
      (): Dynamic => (0, runtime.observeSessionStripPointers)(document),
      [],
    );
    let value: Dynamic = (0, runtime.reactSessionStripPointerState.useRef)(
        null,
      ),
      value2: Dynamic = (0, runtime.reactSessionStripPointerState.useRef)(null),
      value3: Dynamic = (0, runtime.useTouchToolbar)();
    (0, runtime.reactSessionStripPointerState.useLayoutEffect)((): Dynamic => {
      let current: Dynamic = value.current;
      if (current !== null) {
        runtime.SessionStripPointerStateSubscribers.add(current);
        return (): Dynamic => {
          runtime.SessionStripPointerStateSubscribers.delete(current);
          runtime.SessionStripPointerStateSubscribers.size === 0 &&
            runtime.SessionStripPointerStateCurrentState !== null &&
            (clearTimeout(runtime.SessionStripPointerStateCurrentState),
            (runtime.SessionStripPointerStateCurrentState = null));
        };
      }
    }, []);
    (0, runtime.reactSessionStripPointerState.useLayoutEffect)((): Dynamic => {
      value.current !== null &&
        (0, runtime.recordSessionStripOcclusion)(
          value.current,
          coversSelection === true,
        );
      refreshSessionStripPointers();
      value.current !== null &&
        value2.current !== null &&
        updateSessionStripScrollAttrs(value.current, value2.current);
    });
    (0, runtime.reactSessionStripPointerState.useLayoutEffect)((): Dynamic => {
      let current: Dynamic = value.current,
        current2: Dynamic = value2.current;
      if (
        current === null ||
        current2 === null ||
        typeof ResizeObserver === "undefined"
      )
        return;
      let observer: Dynamic = new ResizeObserver(
        (): Dynamic => updateSessionStripScrollAttrs(current, current2),
      );
      observer.observe(current2);
      return (): Dynamic => observer.disconnect();
    }, []);
    (0, runtime.reactSessionStripPointerState.useLayoutEffect)((): Dynamic => {
      let current: Dynamic = value.current,
        current2: Dynamic = value2.current;
      if (
        surface !== "popover" ||
        current === null ||
        current2 === null ||
        typeof ResizeObserver === "undefined"
      )
        return;
      let callback: Dynamic = (): Dynamic => {
          let element: Dynamic = current2.querySelector('[data-cds="Button"]'),
            value4: Dynamic = getComputedStyle(current2),
            value5: Dynamic =
              (element?.offsetHeight ?? 0) +
              (parseFloat(value4.paddingTop) || 0) +
              (parseFloat(value4.paddingBottom) || 0);
          current.toggleAttribute(
            "data-mc-wrapped",
            element !== null && current2.clientHeight > value5 + 1,
          );
        },
        observer: Dynamic = new ResizeObserver(callback);
      observer.observe(current2);
      callback();
      return (): Dynamic => observer.disconnect();
    }, [surface]);
    return (
      <runtime.CdsRoot
        density={surface === "popover" && value3 ? "comfortable" : "compact"}
        render={
          <runtime.Surface
            elevation={runtime.PopoverValue}
            role={"toolbar"}
            data-mc-strip={""}
            data-mc-surface={surface}
            onPointerDown={(input?: Dynamic): Dynamic => {
              input.stopPropagation();
              onPointerDown?.(input);
            }}
            onMouseDownCapture={(event?: Dynamic): Dynamic => {
              event.currentTarget.contains(event.target) &&
                (0, runtime.suppressSessionStripClick)(event) &&
                (event.preventDefault(), event.stopPropagation());
              onMouseDownCapture?.(event);
            }}
            onClickCapture={(event?: Dynamic): Dynamic => {
              event.currentTarget.contains(event.target) &&
                (0, runtime.suppressSessionStripClick)(event) &&
                (event.preventDefault(), event.stopPropagation());
              onClickCapture?.(event);
            }}
            onMouseDown={(event?: Dynamic): Dynamic => {
              event.target.closest(runtime.editableElementSelector) ||
                event.preventDefault();
              onMouseDown?.(event);
            }}
            className={(0, runtime.joinClassNames)(
              "z-selection flex items-center",
              surface === "popover"
                ? "[--mc-group-gap:2px] [--mc-strip-gap:4px] [--mc-strip-pad:5px] pointer-coarse:rounded-xl pointer-coarse:[--mc-group-gap:8px] pointer-coarse:[--mc-strip-gap:8px] pointer-coarse:[--mc-strip-pad:6px] [&_[data-mc-divider]]:mx-0"
                : "[--mc-strip-gap:2px] [--mc-strip-pad:4px] [--mc-group-gap:4px]",
              "max-w-[calc(100vw-16px)] overflow-clip",
              className,
            )}
            {...props}
            ref={value}
          />
        }
      >
        <div className={"relative min-w-0 flex-auto rounded-[inherit]"}>
          <div
            ref={value2}
            data-mc-row={""}
            onScroll={(input?: Dynamic): Dynamic => {
              value.current !== null &&
                updateSessionStripScrollAttrs(
                  value.current,
                  input.currentTarget,
                );
              onScroll?.(input);
            }}
            className={(0, runtime.joinClassNames)(
              "flex min-w-0 items-center gap-[var(--mc-strip-gap)] rounded-[inherit] p-[var(--mc-strip-pad)]",
              wrap
                ? "flex-wrap"
                : "overflow-x-auto [clip-path:inset(0_1px)] [scrollbar-width:none] [&>*]:shrink-0",
            )}
          >
            <runtime.ChromeFocusContext.Provider
              value={placed === "below" ? "bottom" : "top"}
            >
              <runtime.SessionStripContext.Provider value={wrap}>
                <runtime.TooltipGroup>{children}</runtime.TooltipGroup>
              </runtime.SessionStripContext.Provider>
            </runtime.ChromeFocusContext.Provider>
          </div>
          <span
            aria-hidden={"true"}
            data-tb-fade={"start"}
            className={
              "pointer-events-none absolute inset-y-px left-px z-10 w-12"
            }
          >
            <span
              className={
                "pointer-events-auto absolute inset-y-0 left-0 w-[30%]"
              }
            />
          </span>
          <span
            aria-hidden={"true"}
            data-tb-fade={"end"}
            className={
              "pointer-events-none absolute inset-y-px right-px z-10 w-12"
            }
          >
            <span
              className={
                "pointer-events-auto absolute inset-y-0 right-0 w-[30%]"
              }
            />
          </span>
        </div>
      </runtime.CdsRoot>
    );
  }
  function SessionStripGroup({
    wrap = false,
    fields = false,
    className: className,
    ...props
  }: Dynamic): Dynamic {
    let value: Dynamic = (0, runtime.reactSessionStripPointerState.useContext)(
      runtime.SessionStripContext,
    );
    return (
      <span
        data-mc-group={""}
        className={(0, runtime.joinClassNames)(
          "flex items-center gap-y-1",
          fields ? "gap-x-1" : "gap-x-[var(--mc-group-gap,4px)]",
          wrap && value && "max-w-full shrink-0 flex-wrap",
          className,
        )}
        {...props}
      />
    );
  }
  function SessionStripDivider(): Dynamic {
    return (
      <span
        aria-hidden={"true"}
        data-mc-divider={""}
        className={"mx-0.5 h-[18px] w-px bg-border-line"}
      />
    );
  }
  bindRuntimeValue(
    runtime,
    "updateSessionStripScrollAttrs",
    () => updateSessionStripScrollAttrs,
  );
  bindRuntimeValue(
    runtime,
    "refreshSessionStripPointers",
    () => refreshSessionStripPointers,
  );
  bindRuntimeValue(runtime, "SessionStrip", () => SessionStrip);
  bindRuntimeValue(
    runtime,
    "SessionStripButton",
    () => SessionStripButton,
    (value) => {
      SessionStripButton = value;
    },
  );
  bindRuntimeValue(runtime, "SessionStripGroup", () => SessionStripGroup);
  bindRuntimeValue(runtime, "SessionStripDivider", () => SessionStripDivider);
  return () => {
    SessionStripButton = (0, runtime.reactSessionStripPointerState.forwardRef)(
      function (
        {
          className: className,
          type: type,
          onMouseDown: onMouseDown,
          chevron: chevron,
          icon: icon,
          children: children,
          title: title,
          disabled: disabled2,
          "aria-pressed": ariaPressed,
          "aria-label": ariaLabel,
          "aria-expanded": ariaExpanded,
          "aria-describedby": ariaDescribedby,
          ...props
        }: Dynamic,
        options?: Dynamic,
      ): Dynamic {
        let value: Dynamic =
            ariaPressed === undefined
              ? undefined
              : ariaPressed === true || ariaPressed === "true",
          callback: Dynamic = (event?: Dynamic): Dynamic => {
            event.preventDefault();
            onMouseDown?.(event);
          },
          value2: Dynamic = disabled2 === true,
          value3: Dynamic =
            (0, runtime.reactSessionStripPointerState.useContext)(
              runtime.ChromeFocusContext,
            ) ?? "top",
          value4: Dynamic =
            ariaLabel ?? (typeof children == "string" ? children : undefined),
          value5: Dynamic = (0, runtime.useDisabledToolbarItem)({
            disabled: value2 && title !== undefined,
            name: value4 ?? title ?? "",
            reason: title,
            pressed: ariaPressed,
            expanded: ariaExpanded,
            hasPopup: props["aria-haspopup"],
          }),
          value6: Dynamic = (0, runtime.reactSessionStripPointerState.useRef)(
            null,
          );
        (0, runtime.useToolbarPress)(value6, value2 && title !== undefined);
        let value7: Dynamic = (0,
          runtime.reactSessionStripPointerState.useId)(),
          value8: Dynamic =
            !value2 && !!title && value4?.startsWith(title) !== true,
          value9: Dynamic =
            [ariaDescribedby, value8 ? value7 : undefined]
              .filter(Boolean)
              .join(" ") || undefined,
          state: Dynamic = {
            ref: options,
            variant: "ghost",
            type: type ?? "button",
            pressed: value,
            disabled: disabled2,
            "aria-expanded": ariaExpanded,
            "aria-describedby": value9,
            onMouseDown: callback,
            className: (0, runtime.joinClassNames)("shrink-0", className),
            ...props,
            "data-mc-item": "",
            ...value5.inner,
          },
          value10: Dynamic =
            icon !== undefined && children == null ? (
              <runtime.Button
                {...state}
                iconOnly={true}
                icon={icon}
                aria-label={ariaLabel ?? ""}
                tooltip={false}
              />
            ) : (
              <runtime.Button {...state} icon={icon} aria-label={ariaLabel}>
                {children}
                {chevron === true ? (
                  <runtime.Icon
                    name={"CaretDown"}
                    size={"sm"}
                    className={"shrink-0 opacity-60"}
                  />
                ) : null}
              </runtime.Button>
            );
        return title === undefined ? (
          value10
        ) : (
          <runtime.Tooltip
            content={title}
            side={value3}
            hoverable={false}
            open={
              (ariaExpanded === true || ariaExpanded === "true") && !value2
                ? false
                : undefined
            }
          >
            <span
              ref={value6}
              tabIndex={value2 ? 0 : -1}
              {...value5.props}
              data-tip={title}
              className={
                "relative inline-flex shrink-0 rounded align-top outline-none focus-visible:outline-hidden focus-visible:shadow-focus"
              }
            >
              {value10}
              {value8 ? (
                <span hidden={true} id={value7}>
                  {title}
                </span>
              ) : null}
              {value5.mirror}
            </span>
          </runtime.Tooltip>
        );
      },
    );
  };
}
