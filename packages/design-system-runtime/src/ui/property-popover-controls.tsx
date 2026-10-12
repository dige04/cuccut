/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
import type * as React from "react";
import type {
  ReactNamespace,
  JsxNamespace,
  PropertyPopoverPanelProps,
  ShadowPropertyEditorProps,
  PropertyPopoverProps,
  RemovePropertyButtonProps,
  PropertyPopoverTriggerProps,
  ShadowValue,
} from "../contracts/composition";
export function installUiPropertyPopoverControls(
  runtime: RuntimeBindings,
): () => void {
  var reactPropertyPopoverControls: ReactNamespace;
  var jsxPropertyPopoverControls: JsxNamespace;
  var jsxPropertyPopoverActions: JsxNamespace;
  var reactdC: ReactNamespace;
  var jsxcC: JsxNamespace;
  var PropertyPopoverTrigger: React.ForwardRefExoticComponent<
    PropertyPopoverTriggerProps & React.RefAttributes<HTMLButtonElement>
  >;
  function PropertyPopoverPanel({
    title: title,
    onClose: onClose,
    labelWidth = "3rem",
    children: children,
  }: PropertyPopoverPanelProps) {
    return (
      <div
        role={"dialog"}
        aria-label={typeof title === "string" ? title : undefined}
        className={"flex flex-col py-sm"}
        style={{
          ["--pp-label-w"]: labelWidth,
          ["--pp-gutter-l"]: "var(--cds-pad-md)",
        } as import("../contracts/controls").DesignStyle}
        data-kit={"effect-editor"}
      >
        {[
          <div className={"flex items-center pr-xs pb-xs pl-md"}>
            {[
              <h3
                className={
                  "min-w-0 flex-1 truncate text-body-semibold text-primary"
                }
              >
                {title}
              </h3>,
              <runtime.Button
                variant={"ghost"}
                size={"sm"}
                iconOnly={true}
                icon={"X"}
                aria-label={"Close"}
                tooltip={"Close"}
                onClick={onClose}
              />,
            ]}
          </div>,
          children,
        ]}
      </div>
    );
  }
  function ShadowPropertyEditor({
    title: title,
    value: value,
    onChange: onChange,
    onLive: onLive,
    onLiveEnd: onLiveEnd,
    onClose: onClose,
    spread = true,
    bounds = {},
    disabled: disabled,
    swatches: swatches,
    unifiedPopover: unifiedPopover,
    editsAreUndoSteps: editsAreUndoSteps,
  }: ShadowPropertyEditorProps) {
    let callback = (input: Partial<ShadowValue>) =>
        onChange({
          ...value,
          ...input,
        }),
      callback2 = (input: "x" | "y" | "blur" | "spread") =>
        onLive && onLiveEnd
          ? {
              onScrub: (input2: number) =>
                onLive({
                  ...value,
                  [input]: input2,
                }),
              onScrubEnd: onLiveEnd,
            }
          : {};
    return (
      <PropertyPopoverPanel title={title} onClose={onClose}>
        {[
          <runtime.PropertyRow
            label={"Offset"}
            disabled={disabled}
            onPress={(element: HTMLElement) =>
              element.querySelector("input")?.focus()
            }
          >
            <div className={"flex min-w-0 flex-1 items-center gap-2"}>
              {[
                <runtime.PropertyNumberInput
                  aria-label={"Horizontal offset"}
                  prefix={"X"}
                  steppers={false}
                  value={value.x}
                  onValue={(input: number | undefined) =>
                    input !== undefined &&
                    callback({
                      x: input,
                    })
                  }
                  disabled={disabled}
                  {...bounds.x}
                  {...callback2("x")}
                />,
                <runtime.PropertyNumberInput
                  aria-label={"Vertical offset"}
                  prefix={"Y"}
                  steppers={false}
                  value={value.y}
                  onValue={(input: number | undefined) =>
                    input !== undefined &&
                    callback({
                      y: input,
                    })
                  }
                  disabled={disabled}
                  {...bounds.y}
                  {...callback2("y")}
                />,
              ]}
            </div>
          </runtime.PropertyRow>,
          <runtime.NumberPropertyRow
            label={"Blur"}
            unit={"px"}
            value={value.blur}
            onValue={(input: number | undefined) =>
              input !== undefined &&
              callback({
                blur: input,
              })
            }
            disabled={disabled}
            min={0}
            {...bounds.blur}
            {...callback2("blur")}
          />,
          spread && (
            <runtime.NumberPropertyRow
              label={"Spread"}
              unit={"px"}
              value={value.spread ?? 0}
              onValue={(input: number | undefined) =>
                input !== undefined &&
                callback({
                  spread: input,
                })
              }
              disabled={disabled}
              {...bounds.spread}
              {...callback2("spread")}
            />
          ),
          <runtime.ColorTextPropertyRow
            label={"Color"}
            value={value.color}
            disabled={disabled}
            swatches={swatches}
            popoverTitle={unifiedPopover ? runtime.COLOR_LABEL : undefined}
            editsAreUndoSteps={editsAreUndoSteps}
            onChange={(input: string | undefined) =>
              input !== undefined &&
              callback({
                color: input,
              })
            }
            {...(onLive && onLiveEnd
              ? {
                  onLive: (input: string) =>
                    onLive({
                      ...value,
                      color: input,
                    }),
                  onLiveEnd: () => onLiveEnd!(),
                }
              : {})}
          />,
        ]}
      </PropertyPopoverPanel>
    );
  }
  function PropertyPopover({
    open: open,
    onOpenChange: onOpenChange,
    trigger: trigger,
    anchor: anchor,
    side = "left",
    focusOnOpen: focusOnOpen,
    className: className,
    editsAreUndoSteps: editsAreUndoSteps,
    children: children,
  }: PropertyPopoverProps) {
    return (
      <runtime.PropertyPopup
        open={open}
        onOpen={() => onOpenChange(true)}
        onClose={() => onOpenChange(false)}
        trigger={trigger}
        side={side}
        positionAnchor={anchor}
        focusOnOpen={focusOnOpen}
        padding={"none"}
        className={(0, runtime.joinClassNames)(
          "w-[14.5rem] pointer-coarse:w-[17rem]",
          className,
        )}
        editsAreUndoSteps={editsAreUndoSteps}
      >
        {children}
      </runtime.PropertyPopup>
    );
  }
  function RemovePropertyButton({
    label: label,
    onClick: onClick,
    disabled: disabled,
    disabledReason: disabledReason,
  }: RemovePropertyButtonProps) {
    let value = "Remove " + label.toLowerCase();
    return (
      <runtime.Button
        variant={"ghost"}
        iconOnly={true}
        icon={"Minus"}
        aria-label={value}
        tooltip={value}
        disabled={disabled}
        disabledReason={disabledReason}
        onClick={onClick}
        className={"shrink-0"}
      />
    );
  }
  bindRuntimeValue(
    runtime,
    "reactPropertyPopoverControls",
    () => reactPropertyPopoverControls,
    (value) => {
      reactPropertyPopoverControls = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxPropertyPopoverControls",
    () => jsxPropertyPopoverControls,
    (value) => {
      jsxPropertyPopoverControls = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxPropertyPopoverActions",
    () => jsxPropertyPopoverActions,
    (value) => {
      jsxPropertyPopoverActions = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactdC",
    () => reactdC,
    (value) => {
      reactdC = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxcC",
    () => jsxcC,
    (value) => {
      jsxcC = value;
    },
  );
  bindRuntimeValue(runtime, "PropertyPopoverPanel", () => PropertyPopoverPanel);
  bindRuntimeValue(runtime, "ShadowPropertyEditor", () => ShadowPropertyEditor);
  bindRuntimeValue(runtime, "PropertyPopover", () => PropertyPopover);
  bindRuntimeValue(
    runtime,
    "PropertyPopoverTrigger",
    () => PropertyPopoverTrigger,
    (value) => {
      PropertyPopoverTrigger = value;
    },
  );
  bindRuntimeValue(runtime, "RemovePropertyButton", () => RemovePropertyButton);
  return () => {
    reactPropertyPopoverControls = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    jsxPropertyPopoverControls = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
    jsxPropertyPopoverActions = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
    reactdC = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    jsxcC = (0, runtime.toModuleNamespace)((0, runtime.loadJsxNamespace)(), 1);
    PropertyPopoverTrigger = reactdC.forwardRef(function (
      {
        label: label,
        color: color,
        text: text,
        open: open,
        onClick: onClick,
        disabled: disabled,
        ...props
      }: PropertyPopoverTriggerProps,
      options: React.ForwardedRef<HTMLButtonElement>,
    ) {
      let memo = reactdC.useMemo(
        () =>
          typeof color === "string"
            ? (0, runtime.parseCssColorToHsva)(color)
            : undefined,
        [color],
      );
      return (
        <runtime.FieldButton
          {...(open !== undefined
            ? {
                "aria-haspopup": "dialog",
                "aria-expanded": open,
              }
            : undefined)}
          {...props}
          ref={options}
          aria-label={label + ": " + text}
          disabled={disabled}
          onClick={onClick}
          chip={
            color !== undefined ? (
              <runtime.ColorChip
                hex={memo ? (0, runtime.hsvaToHexColor)(memo) : null}
                alpha={(memo?.a ?? 1) * 100}
              />
            ) : undefined
          }
          caption={
            memo !== undefined ? Math.round(memo.a * 100) + "%" : undefined
          }
        >
          {text}
        </runtime.FieldButton>
      );
    });
  };
}
