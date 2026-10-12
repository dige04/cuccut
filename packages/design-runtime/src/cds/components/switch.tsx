import type { ForwardComponent, SwitchProps } from "../../contracts/ui";
import type * as React from "react";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../../runtime-types";
export function installCdsComponentsSwitch(
  runtime: RuntimeBindings,
): () => void {
  var reactComponentsSwitch: typeof React;
  var jsxComponentsSwitch: typeof import("react/jsx-runtime");
  var switchRootClasses: string;
  var ComponentsSwitchClassNames: string;
  var ComponentsSwitchLabel: string;
  var ComponentsSwitchLabel_2: string;
  var Switch: ForwardComponent<HTMLInputElement, SwitchProps>;
  var initializeComponentsSwitch: () => void;
  bindRuntimeValue(
    runtime,
    "reactComponentsSwitch",
    () => reactComponentsSwitch,
    (value) => {
      reactComponentsSwitch = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxComponentsSwitch",
    () => jsxComponentsSwitch,
    (value) => {
      jsxComponentsSwitch = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "switchRootClasses",
    () => switchRootClasses,
    (value) => {
      switchRootClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsSwitchClassNames",
    () => ComponentsSwitchClassNames,
    (value) => {
      ComponentsSwitchClassNames = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsSwitchLabel",
    () => ComponentsSwitchLabel,
    (value) => {
      ComponentsSwitchLabel = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsSwitchLabel_2",
    () => ComponentsSwitchLabel_2,
    (value) => {
      ComponentsSwitchLabel_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "Switch",
    () => Switch,
    (value) => {
      Switch = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeComponentsSwitch",
    () => initializeComponentsSwitch,
    (value) => {
      initializeComponentsSwitch = value;
    },
  );
  return () => {
    initializeComponentsSwitch = (0, runtime.initializeOnce)(() => {
      "use client";

      (0, runtime.initializeClassNames)();
      (0, runtime.initializeCdsRoot)();
      (0, runtime.initializeDomSelectionPrevention)();
      (0, runtime.initializeTooltipTooltip)();
      reactComponentsSwitch = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react)(),
      );
      jsxComponentsSwitch = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react_jsx_runtime)(),
      );
      (0, runtime.initializeNpm__base_ui_react_CZe)();
      switchRootClasses =
        "cds-reset relative inline-flex shrink-0 rounded-full border-0 outline-none focus-visible:outline-hidden bg-[var(--cds-switch-track)] hover:bg-[var(--cds-switch-track-hover)] data-[checked]:bg-fill-accent data-[checked]:hover:bg-fill-accent-hover data-[disabled]:opacity-disabled data-[disabled]:hover:bg-[var(--cds-switch-track)] data-[checked]:data-[disabled]:hover:bg-fill-accent focus-visible:shadow-focus";
      ComponentsSwitchClassNames =
        "block rounded-full bg-[var(--cds-switch-knob)] shadow-sm transition-transform duration-snap ease-overshoot motion-reduce:transition-none";
      ComponentsSwitchLabel =
        "h-[var(--cds-switch-h)] w-[calc(var(--cds-switch-h,1.25rem)*1.8)] p-[2px]";
      ComponentsSwitchLabel_2 =
        "size-[calc(var(--cds-switch-h,1.25rem)-4px)] data-[checked]:translate-x-[calc(var(--cds-switch-h,1.25rem)*0.8)]";
      Switch = (0, reactComponentsSwitch.forwardRef)<
        HTMLInputElement,
        SwitchProps
      >(
        (
          {
            className: className,
            size: size,
            disabledReason: disabledReason,
            disabledReasonSide: disabledReasonSide,
            ...props
          }: SwitchProps,
          options: React.ForwardedRef<HTMLInputElement>,
        ): React.ReactElement => {
          let value = (
            <runtime.npm_Switch_sU.Root
              ref={options}
              data-cds={"Switch"}
              {...props}
              {...(0, runtime.getSizeAttribute)(size)}
              onMouseDown={(0, runtime.withSelectionPrevention)(undefined)}
              onKeyDown={runtime.preventRepeatedEnter}
              className={(0, runtime.cn)(
                switchRootClasses,
                ComponentsSwitchLabel,
                className,
              )}
            >
              <runtime.npm_Switch_sU.Thumb
                className={`${ComponentsSwitchClassNames} ${ComponentsSwitchLabel_2}`}
              />
            </runtime.npm_Switch_sU.Root>
          );
          return disabledReason === undefined ? (
            value
          ) : (
            <runtime.DisabledReasonTooltip
              side={disabledReasonSide}
              reason={props.disabled ? disabledReason : undefined}
            >
              {value}
            </runtime.DisabledReasonTooltip>
          );
        },
      );
      Switch.displayName = "Switch";
    });
  };
}
