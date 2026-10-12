/** Restored application module; prepare first, initialize in original order. */
import type { CSSProperties } from "react";
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";
export function installEditorPropertiesEffectPopup(
  runtime: RuntimeBindings,
): () => void {
  var ColorEffectButton: Dynamic;
  function PropertyPopupBody({
    title: title,
    onClose: onClose,
    labelWidth = "3rem",
    children: children,
  }: Dynamic): Dynamic {
    return (
      <div
        role={"dialog"}
        aria-label={typeof title == "string" ? title : undefined}
        className={"flex flex-col py-sm"}
        style={
          {
            "--pp-label-w": labelWidth,
            "--pp-gutter-l": "var(--cds-pad-md)",
          } as CSSProperties
        }
        data-kit={"effect-editor"}
      >
        <div className={"flex items-center pr-xs pb-xs pl-md"}>
          <h3
            className={
              "min-w-0 flex-1 truncate text-body-semibold text-primary"
            }
          >
            {title}
          </h3>
          <runtime.Button
            variant={"ghost"}
            size={"sm"}
            iconOnly={true}
            icon={"X"}
            aria-label={"Close"}
            tooltip={"Close"}
            onClick={onClose}
          />
        </div>
        {children}
      </div>
    );
  }
  function ShadowEditor({
    title: title,
    value: value,
    onChange: onChange,
    onLive: onLive,
    onLiveEnd: onLiveEnd,
    onClose: onClose,
    spread = true,
    bounds = {},
    disabled: disabled2,
    swatches: swatches,
    unifiedPopover: unifiedPopover,
    editsAreUndoSteps: editsAreUndoSteps,
  }: Dynamic): Dynamic {
    let callback: Dynamic = (input?: Dynamic): Dynamic =>
        onChange({
          ...value,
          ...input,
        }),
      callback2: Dynamic = (input?: Dynamic): Dynamic =>
        onLive && onLiveEnd
          ? {
              onScrub: (input2?: Dynamic): Dynamic =>
                onLive({
                  ...value,
                  [input]: input2,
                }),
              onScrubEnd: onLiveEnd,
            }
          : {};
    return (
      <PropertyPopupBody title={title} onClose={onClose}>
        <runtime.PropertyRow
          label={"Offset"}
          disabled={disabled2}
          onPress={(element?: Dynamic): Dynamic =>
            element.querySelector("input")?.focus()
          }
        >
          <div className={"flex min-w-0 flex-1 items-center gap-2"}>
            <runtime.NumericInput
              aria-label={"Horizontal offset"}
              prefix={"X"}
              steppers={false}
              value={value.x}
              onValue={(input?: Dynamic): Dynamic =>
                input !== undefined &&
                callback({
                  x: input,
                })
              }
              disabled={disabled2}
              {...bounds.x}
              {...callback2("x")}
            />
            <runtime.NumericInput
              aria-label={"Vertical offset"}
              prefix={"Y"}
              steppers={false}
              value={value.y}
              onValue={(input?: Dynamic): Dynamic =>
                input !== undefined &&
                callback({
                  y: input,
                })
              }
              disabled={disabled2}
              {...bounds.y}
              {...callback2("y")}
            />
          </div>
        </runtime.PropertyRow>
        <runtime.PropertyNumberRow
          label={"Blur"}
          unit={"px"}
          value={value.blur}
          onValue={(input?: Dynamic): Dynamic =>
            input !== undefined &&
            callback({
              blur: input,
            })
          }
          disabled={disabled2}
          min={0}
          {...bounds.blur}
          {...callback2("blur")}
        />
        {spread && (
          <runtime.PropertyNumberRow
            label={"Spread"}
            unit={"px"}
            value={value.spread ?? 0}
            onValue={(input?: Dynamic): Dynamic =>
              input !== undefined &&
              callback({
                spread: input,
              })
            }
            disabled={disabled2}
            {...bounds.spread}
            {...callback2("spread")}
          />
        )}
        <runtime.PropertyHexRow
          label={"Color"}
          value={value.color}
          disabled={disabled2}
          swatches={swatches}
          popoverTitle={unifiedPopover ? runtime.ColorValue : undefined}
          editsAreUndoSteps={editsAreUndoSteps}
          onChange={(input?: Dynamic): Dynamic =>
            input !== undefined &&
            callback({
              color: input,
            })
          }
          {...(onLive && onLiveEnd
            ? {
                onLive: (input?: Dynamic): Dynamic =>
                  onLive({
                    ...value,
                    color: input,
                  }),
                onLiveEnd: (): Dynamic => onLiveEnd(),
              }
            : {})}
        />
      </PropertyPopupBody>
    );
  }
  function PropertyEditorPopover({
    open: open,
    onOpenChange: onOpenChange,
    trigger: trigger,
    anchor: anchor,
    side = "left",
    focusOnOpen: focusOnOpen,
    className: className,
    editsAreUndoSteps: editsAreUndoSteps,
    children: children,
  }: Dynamic): Dynamic {
    return (
      <runtime.EditorPopover
        open={open}
        onOpen={(): Dynamic => onOpenChange(true)}
        onClose={(): Dynamic => onOpenChange(false)}
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
      </runtime.EditorPopover>
    );
  }
  function RemovePropertyButton({
    label: label,
    onClick: onClick,
    disabled: disabled2,
    disabledReason: disabledReason,
  }: Dynamic): Dynamic {
    let value: Dynamic = "Remove " + label.toLowerCase();
    return (
      <runtime.Button
        variant={"ghost"}
        iconOnly={true}
        icon={"Minus"}
        aria-label={value}
        tooltip={value}
        disabled={disabled2}
        disabledReason={disabledReason}
        onClick={onClick}
        className={"shrink-0"}
      />
    );
  }
  bindRuntimeValue(runtime, "PropertyPopupBody", () => PropertyPopupBody);
  bindRuntimeValue(runtime, "ShadowEditor", () => ShadowEditor);
  bindRuntimeValue(
    runtime,
    "PropertyEditorPopover",
    () => PropertyEditorPopover,
  );
  bindRuntimeValue(
    runtime,
    "ColorEffectButton",
    () => ColorEffectButton,
    (value) => {
      ColorEffectButton = value;
    },
  );
  bindRuntimeValue(runtime, "RemovePropertyButton", () => RemovePropertyButton);
  return () => {
    ColorEffectButton = (0, runtime.reactSessionStripPopover.forwardRef)(
      function (
        {
          label: label,
          color: color,
          text: text,
          open: open,
          onClick: onClick,
          disabled: disabled2,
          ...props
        }: Dynamic,
        options?: Dynamic,
      ): Dynamic {
        let value: Dynamic = (0, runtime.reactSessionStripPopover.useMemo)(
          (): Dynamic =>
            typeof color == "string"
              ? (0, runtime.parseHsvaColor)(color)
              : undefined,
          [color],
        );
        return (
          <runtime.PropertyPickerButton
            {...(open !== undefined
              ? {
                  "aria-haspopup": "dialog",
                  "aria-expanded": open,
                }
              : undefined)}
            {...props}
            ref={options}
            aria-label={label + ": " + text}
            disabled={disabled2}
            onClick={onClick}
            chip={
              color !== undefined ? (
                <runtime.ColorWellFace
                  hex={value ? (0, runtime.hsvaToRgbHex)(value) : null}
                  alpha={(value?.a ?? 1) * 100}
                />
              ) : undefined
            }
            caption={
              value !== undefined ? Math.round(value.a * 100) + "%" : undefined
            }
          >
            {text}
          </runtime.PropertyPickerButton>
        );
      },
    );
  };
}
