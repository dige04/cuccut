/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
import type * as React from "react";
import type {
  ReactNamespace,
  JsxNamespace,
  PropertyColorPreviewProps,
  PropertyRowProps,
  PropertySectionHeaderProps,
  FieldButtonProps,
  PropertyAction,
} from "../contracts/composition";
export function installUiPropertyRow(runtime: RuntimeBindings): () => void {
  var reactForUiPropertyRow2: ReactNamespace;
  var PROPERTY_ROW_INTERACTIVE_SELECTOR: string;
  var reactPropertyRowHelpers: ReactNamespace;
  var jsxPropertyRowHelpers: JsxNamespace;
  var jsxForUiPropertyRow2: JsxNamespace;
  var FIELD_SURFACE_CLASS: string;
  var TEXT_FIELD_BUTTON_CLASS: string;
  var CHIP_FIELD_BUTTON_CLASS: string;
  var COLOR_SWATCH_CLASS: string;
  var FieldButton: React.ForwardRefExoticComponent<
    FieldButtonProps & React.RefAttributes<HTMLButtonElement>
  >;
  var PROPERTY_SECTION_GUTTER_CLASS: string;
  var PROPERTY_ACTIONS_CLASS: string;
  function propertyRowPressShouldIgnore(row: HTMLElement, target: Element) {
    if (target.closest(PROPERTY_ROW_INTERACTIVE_SELECTOR)) {
      return true;
    }
    if (target.closest('[data-kit="row-trailing"]')) {
      return true;
    }
    if (target.closest("[data-mc-scrim], [data-base-ui-inert]")) {
      return true;
    }
    let ancestor = target.closest(runtime.OPEN_OVERLAY_SELECTOR);
    return ancestor !== null && !ancestor.contains(row);
  }
  function PropertyColorPreview({
    background: background,
    className: className,
    children: children,
    ...remainingProps
  }: PropertyColorPreviewProps) {
    return (
      <span
        aria-hidden={"true"}
        {...remainingProps}
        className={(0, runtime.joinClassNames)(COLOR_SWATCH_CLASS, className)}
      >
        {[
          background !== undefined ? (
            <span
              className={"absolute inset-0"}
              style={{
                background: background,
              }}
            />
          ) : null,
          children,
        ]}
      </span>
    );
  }
  function PropertyRow({
    label: label,
    children: children,
    onReset: onReset,
    resetLabel: resetLabel,
    description: description,
    onPress: onPress,
    disabled: disabled,
    title: title,
    labelProps: labelProps,
    actions: actions,
    actionsLabel = runtime.MORE_ACTIONS_LABEL,
    defaultActionsOpen = false,
    trailing: trailing,
    className: className,
    ...remainingProps
  }: PropertyRowProps) {
    let value = typeof label === "string" ? label : undefined,
      ref = reactForUiPropertyRow2.useRef<HTMLDivElement | null>(null),
      value2 = reactForUiPropertyRow2.useId(),
      ref2 = reactForUiPropertyRow2.useRef(false);
    reactForUiPropertyRow2.useLayoutEffect(() => {
      if (!description && !ref2.current) {
        return;
      }
      let current = ref.current;
      if (!current) {
        return;
      }
      let value6 = current.querySelectorAll(
        'input:not([type="hidden"]), textarea, select, [role="combobox"], [role="radiogroup"], [role="switch"], button[aria-haspopup], button[aria-expanded]',
      );
      for (let value7 of value6) {
        let value8 = (value7.getAttribute("aria-describedby") ?? "")
          .split(/\s+/)
          .filter((input: string) => input && input !== value2);
        if (description) {
          value8.push(value2);
        }
        if (value8.length > 0) {
          value7.setAttribute("aria-describedby", value8.join(" "));
        } else {
          value7.removeAttribute("aria-describedby");
        }
      }
      ref2.current = !!description;
    });
    let [value3, value4] = reactForUiPropertyRow2.useState(defaultActionsOpen),
      value5 =
        actions !== undefined && actions.length > 0 ? actions : undefined;
    if (value5 === undefined && value3) {
      value4(false);
    }
    let ref3 = reactForUiPropertyRow2.useRef(false);
    return (
      <div
        data-property-row={""}
        {...remainingProps}
        title={title}
        onClick={
          onPress && !disabled
            ? (event: React.MouseEvent<HTMLDivElement>) => {
                if (
                  propertyRowPressShouldIgnore(
                    event.currentTarget,
                    event.target as Element,
                  )
                ) {
                  return;
                }
                onPress(event.currentTarget);
              }
            : undefined
        }
        className={(0, runtime.joinClassNames)(
          "group/row grid min-w-0 shrink-0 items-center gap-x-sm py-px",
          PROPERTY_SECTION_GUTTER_CLASS,
          label !== undefined
            ? "grid-cols-[var(--pp-label-w,80px)_minmax(0,1fr)] pointer-coarse:grid-cols-[calc(var(--pp-label-w,80px)*13/12)_minmax(0,1fr)]"
            : "grid-cols-[minmax(0,1fr)]",
          "min-h-[var(--prop-row-h,32px)] pointer-coarse:min-h-[var(--prop-row-h,40px)]",
          disabled && "cursor-not-allowed",
          className,
        )}
      >
        {[
          label !== undefined && (
            <div
              className={(0, runtime.joinClassNames)(
                "flex min-w-0 items-center",
                disabled && "opacity-50",
              )}
            >
              {[
                <span
                  title={title === undefined ? value : undefined}
                  {...labelProps}
                  className={(0, runtime.joinClassNames)(
                    "min-w-0 truncate text-footnote text-muted select-none",
                    labelProps?.className,
                  )}
                >
                  {label}
                </span>,
                onReset && !disabled && (
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
                          ? runtime.RESET_LABEL + " " + value
                          : runtime.RESET_LABEL)
                      }
                      tooltipSide={"left"}
                      disabled={disabled}
                      onPointerDown={(
                        input: React.PointerEvent<HTMLButtonElement>,
                      ) => {
                        ref3.current = input.pointerType === "touch";
                      }}
                      onClick={(input: React.MouseEvent<HTMLButtonElement>) => {
                        let value6 = input.currentTarget
                            .closest("[data-property-row]")
                            ?.querySelector<HTMLElement>(
                              'input, button:not([data-kit="row-reset"]), [tabindex="0"]',
                            ),
                          current = ref3.current;
                        ref3.current = false;
                        let value7 =
                          value6?.matches(
                            "input, textarea, [contenteditable]",
                          ) ?? false;
                        if (value6 && !(current && value7)) {
                          value6.focus();
                        }
                        onReset();
                      }}
                      data-kit={"row-reset"}
                      className={"ml-xs shrink-0"}
                    />
                  </span>
                ),
              ]}
            </div>
          ),
          <div
            ref={ref}
            className={(0, runtime.joinClassNames)(
              "flex min-w-0 items-center gap-2",
              trailing === undefined &&
                "pr-[calc(var(--pp-iconcol,-4px)+4px)] pointer-coarse:pr-[calc(var(--pp-iconcol,-8px)+8px)]",
            )}
          >
            {[
              children,
              description ? (
                <span id={value2} hidden={true} data-kit={"row-description"}>
                  {description}
                </span>
              ) : null,
              value5 !== undefined ? (
                <runtime.Menu
                  iconOnly={true}
                  icon={"DotsHorizontal"}
                  variant={"ghost"}
                  aria-label={actionsLabel}
                  tooltip={actionsLabel}
                  align={"end"}
                  disabled={disabled}
                  open={value3}
                  onOpenChange={value4}
                  items={value5.map((input: PropertyAction) => ({
                    label: input.label,
                    onSelect: input.onSelect,
                    variant: input.variant,
                    disabled: input.disabled,
                    separatorBefore: input.separatorBefore,
                  }))}
                  className={"-ml-1 pointer-coarse:ml-0 shrink-0"}
                />
              ) : null,
              trailing !== undefined ? (
                <span
                  data-kit={"row-trailing"}
                  className={(0, runtime.joinClassNames)(
                    "-ml-1 pointer-coarse:ml-0 flex w-[var(--pp-iconcol,auto)] shrink-0 items-center justify-center",
                    PROPERTY_ACTIONS_CLASS,
                  )}
                >
                  {trailing}
                </span>
              ) : null,
            ]}
          </div>,
        ]}
      </div>
    );
  }
  function PropertySectionHeader({
    title: title,
    actions: actions,
    collapsed: collapsed,
    onToggle: onToggle,
    subsection: subsection,
    className: className,
  }: PropertySectionHeaderProps) {
    let value = onToggle !== undefined,
      value2 = (0, runtime.joinClassNames)(
        "flex min-w-0 shrink-0 items-center gap-xs select-none",
        PROPERTY_SECTION_GUTTER_CLASS,
        subsection
          ? "pt-2 pb-1 text-footnote font-semibold text-secondary"
          : "min-h-10 border-t border-alpha-2 py-2 text-body-semibold text-primary first:border-t-0",
        className,
      ),
      value3 = value ? (
        <span
          aria-hidden={"true"}
          className={
            "-my-1 flex size-control shrink-0 items-center justify-center"
          }
        >
          <runtime.KitIcon
            name={"CaretRight"}
            size={16}
            className={(0, runtime.joinClassNames)(
              "text-secondary transition-transform duration-fast",
              !collapsed && "rotate-90",
            )}
          />
        </span>
      ) : null;
    if (value && !actions) {
      return (
        <h3 className={"contents"}>
          <button
            type={"button"}
            aria-expanded={!collapsed}
            onClick={onToggle}
            className={(0, runtime.joinClassNames)(
              value2,
              "w-full cursor-default text-left outline-none focus-visible:outline-hidden focus-visible:shadow-focus",
            )}
          >
            {[
              <span className={"min-w-0 flex-1 truncate"}>{title}</span>,
              value3,
            ]}
          </button>
        </h3>
      );
    }
    return (
      <div
        onClick={
          value
            ? (event: React.MouseEvent<HTMLDivElement>) => {
                if (
                  propertyRowPressShouldIgnore(
                    event.currentTarget,
                    event.target as Element,
                  )
                ) {
                  return;
                }
                onToggle!();
              }
            : undefined
        }
        className={(0, runtime.joinClassNames)(
          value2,
          value && "cursor-default",
        )}
      >
        {[
          <h3 className={"contents"}>
            {value ? (
              <button
                type={"button"}
                aria-expanded={!collapsed}
                onClick={(input: React.MouseEvent<HTMLElement>) => {
                  input.stopPropagation();
                  onToggle!();
                }}
                className={
                  "-my-1 min-w-0 flex-1 cursor-default truncate rounded-sm py-1 text-left text-inherit outline-none focus-visible:outline-hidden focus-visible:shadow-focus"
                }
              >
                {title}
              </button>
            ) : (
              <span className={"min-w-0 flex-1 truncate"}>{title}</span>
            )}
          </h3>,
          actions ? (
            <span
              className={(0, runtime.joinClassNames)(
                "-my-1 flex shrink-0 items-center gap-0.5",
                PROPERTY_ACTIONS_CLASS,
              )}
              onClick={
                value
                  ? (input: React.MouseEvent<HTMLElement>) =>
                      input.stopPropagation()
                  : undefined
              }
            >
              {actions}
            </span>
          ) : null,
          value3,
        ]}
      </div>
    );
  }
  bindRuntimeValue(
    runtime,
    "reactForUiPropertyRow2",
    () => reactForUiPropertyRow2,
    (value) => {
      reactForUiPropertyRow2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PROPERTY_ROW_INTERACTIVE_SELECTOR",
    () => PROPERTY_ROW_INTERACTIVE_SELECTOR,
    (value) => {
      PROPERTY_ROW_INTERACTIVE_SELECTOR = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "propertyRowPressShouldIgnore",
    () => propertyRowPressShouldIgnore,
  );
  bindRuntimeValue(
    runtime,
    "reactPropertyRowHelpers",
    () => reactPropertyRowHelpers,
    (value) => {
      reactPropertyRowHelpers = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxPropertyRowHelpers",
    () => jsxPropertyRowHelpers,
    (value) => {
      jsxPropertyRowHelpers = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxForUiPropertyRow2",
    () => jsxForUiPropertyRow2,
    (value) => {
      jsxForUiPropertyRow2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FIELD_SURFACE_CLASS",
    () => FIELD_SURFACE_CLASS,
    (value) => {
      FIELD_SURFACE_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TEXT_FIELD_BUTTON_CLASS",
    () => TEXT_FIELD_BUTTON_CLASS,
    (value) => {
      TEXT_FIELD_BUTTON_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CHIP_FIELD_BUTTON_CLASS",
    () => CHIP_FIELD_BUTTON_CLASS,
    (value) => {
      CHIP_FIELD_BUTTON_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COLOR_SWATCH_CLASS",
    () => COLOR_SWATCH_CLASS,
    (value) => {
      COLOR_SWATCH_CLASS = value;
    },
  );
  bindRuntimeValue(runtime, "PropertyColorPreview", () => PropertyColorPreview);
  bindRuntimeValue(
    runtime,
    "FieldButton",
    () => FieldButton,
    (value) => {
      FieldButton = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PROPERTY_SECTION_GUTTER_CLASS",
    () => PROPERTY_SECTION_GUTTER_CLASS,
    (value) => {
      PROPERTY_SECTION_GUTTER_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PROPERTY_ACTIONS_CLASS",
    () => PROPERTY_ACTIONS_CLASS,
    (value) => {
      PROPERTY_ACTIONS_CLASS = value;
    },
  );
  bindRuntimeValue(runtime, "PropertyRow", () => PropertyRow);
  bindRuntimeValue(
    runtime,
    "PropertySectionHeader",
    () => PropertySectionHeader,
  );
  return () => {
    reactForUiPropertyRow2 = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    PROPERTY_ROW_INTERACTIVE_SELECTOR =
      'button,input,select,textarea,label,[role="slider"],[role="switch"],[role="radio"],[role="checkbox"],[role="menuitem"]';
    reactPropertyRowHelpers = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    jsxPropertyRowHelpers = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
    jsxForUiPropertyRow2 = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
    FIELD_SURFACE_CLASS =
      "rounded bg-fill-field text-primary shadow-field-ring outline-none transition duration-fast placeholder:text-muted enabled:hover:shadow-field-hover focus-visible:outline-hidden focus-visible:shadow-focus aria-expanded:shadow-field-hover disabled:opacity-50";
    TEXT_FIELD_BUTTON_CLASS = (0, runtime.joinClassNames)(
      "h-control min-w-0 px-md text-body pointer-coarse:h-10",
      FIELD_SURFACE_CLASS,
    );
    CHIP_FIELD_BUTTON_CLASS = (0, runtime.joinClassNames)(
      "flex h-control min-w-0 items-center gap-sm pr-md pl-1 text-left text-body pointer-coarse:h-10",
      FIELD_SURFACE_CLASS,
    );
    COLOR_SWATCH_CLASS =
      "relative inline-block h-4 w-4 shrink-0 overflow-hidden rounded-[4px] shadow-card-ring bg-[repeating-conic-gradient(var(--cds-alpha-2)_0_25%,transparent_0_50%)] bg-[length:8px_8px]";
    FieldButton = reactForUiPropertyRow2.forwardRef(function (
      {
        chip: chip,
        children: children,
        caption: caption,
        muted: muted,
        trailing: trailing,
        className: className,
        type = "button",
        ...props
      }: FieldButtonProps,
      options: React.ForwardedRef<HTMLButtonElement>,
    ) {
      return (
        <button
          {...props}
          ref={options}
          type={type}
          className={(0, runtime.joinClassNames)(
            chip != null
              ? CHIP_FIELD_BUTTON_CLASS
              : (0, runtime.joinClassNames)(
                  TEXT_FIELD_BUTTON_CLASS,
                  "flex items-center gap-sm text-left",
                ),
            "flex-1",
            className,
          )}
        >
          {[
            chip,
            <span
              className={(0, runtime.joinClassNames)(
                "min-w-0 flex-1 truncate",
                muted && "text-muted",
              )}
            >
              {children}
            </span>,
            caption !== undefined && caption !== null ? (
              <span className={"text-caption text-muted"}>{caption}</span>
            ) : null,
            trailing,
          ]}
        </button>
      );
    });
    PROPERTY_SECTION_GUTTER_CLASS =
      "pl-[var(--pp-gutter-l,var(--cds-pad-lg))] pr-[var(--pp-gutter-r,var(--cds-pad-md))]";
    PROPERTY_ACTIONS_CLASS =
      "[&_[data-cds=Button][aria-label]:not([aria-pressed=true])]:text-secondary";
  };
}
