/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";
export function installEditorPropertiesRow(
  runtime: RuntimeBindings,
): () => void {
  function PropertyRow({
    label: label,
    children: children,
    onReset: onReset,
    resetLabel: resetLabel,
    description: description,
    onPress: onPress,
    disabled: disabled2,
    title: title,
    labelProps: labelProps,
    actions: actions,
    actionsLabel = runtime.ColorContrastCopyLabel,
    defaultActionsOpen = false,
    trailing: trailing,
    className: className,
    ...props
  }: Dynamic): Dynamic {
    let value: Dynamic = typeof label == "string" ? label : undefined,
      value2: Dynamic = (0, runtime.reactInspectorContext_4.useRef)(null),
      value3: Dynamic = (0, runtime.reactInspectorContext_4.useId)(),
      value4: Dynamic = (0, runtime.reactInspectorContext_4.useRef)(false);
    (0, runtime.reactInspectorContext_4.useLayoutEffect)((): Dynamic => {
      if (!description && !value4.current) return;
      let current: Dynamic = value2.current;
      if (!current) return;
      let value9: Dynamic = current.querySelectorAll(
        'input:not([type="hidden"]), textarea, select, [role="combobox"], [role="radiogroup"], [role="switch"], button[aria-haspopup], button[aria-expanded]',
      );
      for (let value10 of value9 as Dynamic) {
        let value11: Dynamic = (value10.getAttribute("aria-describedby") ?? "")
          .split(/\s+/)
          .filter((input?: Dynamic): Dynamic => input && input !== value3);
        description && value11.push(value3);
        value11.length > 0
          ? value10.setAttribute("aria-describedby", value11.join(" "))
          : value10.removeAttribute("aria-describedby");
      }
      value4.current = !!description;
    });
    let [value5, value6]: Dynamic = (0,
      runtime.reactInspectorContext_4.useState)(defaultActionsOpen),
      value7: Dynamic =
        actions !== undefined && actions.length > 0 ? actions : undefined;
    value7 === undefined && value5 && value6(false);
    let value8: Dynamic = (0, runtime.reactInspectorContext_4.useRef)(false);
    return (
      <div
        data-property-row={""}
        {...props}
        title={title}
        onClick={
          onPress && !disabled2
            ? (event?: Dynamic): Dynamic => {
                (0, runtime.isNestedPropertyControl)(
                  event.currentTarget,
                  event.target,
                ) || onPress(event.currentTarget);
              }
            : undefined
        }
        className={(0, runtime.joinClassNames)(
          "group/row grid min-w-0 shrink-0 items-center gap-x-sm py-px",
          runtime.PropertiesPrimitivesClassNames_3,
          label !== undefined
            ? "grid-cols-[var(--pp-label-w,80px)_minmax(0,1fr)] pointer-coarse:grid-cols-[calc(var(--pp-label-w,80px)*13/12)_minmax(0,1fr)]"
            : "grid-cols-[minmax(0,1fr)]",
          "min-h-[var(--prop-row-h,32px)] pointer-coarse:min-h-[var(--prop-row-h,40px)]",
          disabled2 && "cursor-not-allowed",
          className,
        )}
      >
        {label !== undefined && (
          <div
            className={(0, runtime.joinClassNames)(
              "flex min-w-0 items-center",
              disabled2 && "opacity-50",
            )}
          >
            <span
              title={title === undefined ? value : undefined}
              {...labelProps}
              className={(0, runtime.joinClassNames)(
                "min-w-0 truncate text-footnote text-muted select-none",
                labelProps?.className,
              )}
            >
              {label}
            </span>
            {onReset && !disabled2 && (
              <span
                className={(0, runtime.joinClassNames)(
                  "flex w-0 shrink-0 overflow-hidden",
                  "focus-within:w-auto focus-within:overflow-visible",
                  "group-hover/row:w-auto group-hover/row:overflow-visible",
                  "pointer-coarse:w-auto pointer-coarse:overflow-visible",
                )}
              >
                <runtime.Button
                  variant={"ghost"}
                  size={"xs"}
                  iconOnly={true}
                  icon={"ArrowCounterClockwise"}
                  aria-label={
                    resetLabel ??
                    (value
                      ? runtime.ResetValue + " " + value
                      : runtime.ResetValue)
                  }
                  tooltipSide={"left"}
                  disabled={disabled2}
                  onPointerDown={(input?: Dynamic): Dynamic => {
                    value8.current = input.pointerType === "touch";
                  }}
                  onClick={(input?: Dynamic): Dynamic => {
                    let value9: Dynamic = input.currentTarget
                        .closest("[data-property-row]")
                        ?.querySelector(
                          'input, button:not([data-kit="row-reset"]), [tabindex="0"]',
                        ),
                      current: Dynamic = value8.current;
                    value8.current = false;
                    let value10: Dynamic =
                      value9?.matches("input, textarea, [contenteditable]") ??
                      false;
                    value9 && !(current && value10) && value9.focus();
                    onReset();
                  }}
                  data-kit={"row-reset"}
                  className={"ml-xs shrink-0"}
                />
              </span>
            )}
          </div>
        )}
        <div
          ref={value2}
          className={(0, runtime.joinClassNames)(
            "flex min-w-0 items-center gap-2",
            trailing === undefined &&
              "pr-[calc(var(--pp-iconcol,-4px)+4px)] pointer-coarse:pr-[calc(var(--pp-iconcol,-8px)+8px)]",
          )}
        >
          {children}
          {description ? (
            <span id={value3} hidden={true} data-kit={"row-description"}>
              {description}
            </span>
          ) : null}
          {value7 !== undefined ? (
            <runtime.MenuMenuAssignValue
              iconOnly={true}
              icon={"DotsHorizontal"}
              variant={"ghost"}
              aria-label={actionsLabel}
              tooltip={actionsLabel}
              align={"end"}
              disabled={disabled2}
              open={value5}
              onOpenChange={value6}
              items={value7.map(
                (input?: Dynamic): Dynamic => ({
                  label: input.label,
                  onSelect: input.onSelect,
                  variant: input.variant,
                  disabled: input.disabled,
                  separatorBefore: input.separatorBefore,
                }),
              )}
              className={"-ml-1 pointer-coarse:ml-0 shrink-0"}
            />
          ) : null}
          {trailing !== undefined ? (
            <span
              data-kit={"row-trailing"}
              className={(0, runtime.joinClassNames)(
                "-ml-1 pointer-coarse:ml-0 flex w-[var(--pp-iconcol,auto)] shrink-0 items-center justify-center",
                runtime.PropertiesPrimitivesClassNames_4,
              )}
            >
              {trailing}
            </span>
          ) : null}
        </div>
      </div>
    );
  }
  bindRuntimeValue(runtime, "PropertyRow", () => PropertyRow);
  return () => {};
}
