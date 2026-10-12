/** Restored application module; prepare first, initialize in original order. */
import type * as React from "react";
import type * as C from "../contracts/controls";
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installUiSwitch(runtime: RuntimeBindings): () => void {
  var reactSwitch: typeof React;
  var jsxSwitch: typeof import("react/jsx-runtime");
  var SWITCH_TRACK_CLASS: string;
  var SWITCH_KNOB_CLASS: string;
  var SWITCH_TRACK_SIZE_CLASS: string;
  var SWITCH_KNOB_SIZE_CLASS: string;
  var Switch: C.ForwardComponent<HTMLElement, C.SwitchProps>;
  function preventRepeatedSwitchEnter(
    event: import("@base-ui/react/types").BaseUIEvent<
      React.KeyboardEvent<HTMLSpanElement>
    >,
  ) {
    if (event.repeat && event.key === "Enter") {
      event.preventDefault();
    }
  }
  bindRuntimeValue(
    runtime,
    "reactSwitch",
    () => reactSwitch,
    (value) => {
      reactSwitch = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxSwitch",
    () => jsxSwitch,
    (value) => {
      jsxSwitch = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SWITCH_TRACK_CLASS",
    () => SWITCH_TRACK_CLASS,
    (value) => {
      SWITCH_TRACK_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SWITCH_KNOB_CLASS",
    () => SWITCH_KNOB_CLASS,
    (value) => {
      SWITCH_KNOB_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SWITCH_TRACK_SIZE_CLASS",
    () => SWITCH_TRACK_SIZE_CLASS,
    (value) => {
      SWITCH_TRACK_SIZE_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SWITCH_KNOB_SIZE_CLASS",
    () => SWITCH_KNOB_SIZE_CLASS,
    (value) => {
      SWITCH_KNOB_SIZE_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "preventRepeatedSwitchEnter",
    () => preventRepeatedSwitchEnter,
  );
  bindRuntimeValue(
    runtime,
    "Switch",
    () => Switch,
    (value) => {
      Switch = value;
    },
  );
  return () => {
    (0, runtime.initializeClassNames)();
    (0, runtime.initializeCdsRoot)();
    (0, runtime.initializeTooltip)();
    reactSwitch = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    jsxSwitch = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
    SWITCH_TRACK_CLASS =
      "cds-reset relative inline-flex shrink-0 rounded-full border-0 outline-none focus-visible:outline-hidden bg-[var(--cds-switch-track)] hover:bg-[var(--cds-switch-track-hover)] data-[checked]:bg-fill-accent data-[checked]:hover:bg-fill-accent-hover data-[disabled]:opacity-disabled data-[disabled]:hover:bg-[var(--cds-switch-track)] data-[checked]:data-[disabled]:hover:bg-fill-accent focus-visible:shadow-focus";
    SWITCH_KNOB_CLASS =
      "block rounded-full bg-[var(--cds-switch-knob)] shadow-sm transition-transform duration-snap ease-overshoot motion-reduce:transition-none";
    SWITCH_TRACK_SIZE_CLASS =
      "h-[var(--cds-switch-h)] w-[calc(var(--cds-switch-h,1.25rem)*1.8)] p-[2px]";
    SWITCH_KNOB_SIZE_CLASS =
      "size-[calc(var(--cds-switch-h,1.25rem)-4px)] data-[checked]:translate-x-[calc(var(--cds-switch-h,1.25rem)*0.8)]";
    Switch = reactSwitch.forwardRef(
      (
        {
          className: className,
          size: size,
          disabledReason: disabledReason,
          disabledReasonSide: disabledReasonSide,
          onKeyDown: onKeyDown,
          onMouseDown: onMouseDown,
          ...props
        }: C.SwitchProps,
        options: React.ForwardedRef<HTMLElement>,
      ) => {
        let value = (
          <runtime.baseSwitch.Root
            ref={options}
            data-cds={"Switch"}
            {...props}
            {...(0, runtime.getControlSizeAttributes)(size)}
            onMouseDown={(0, runtime.withRepeatedClickSelectionPrevention)(
              onMouseDown,
            )}
            onKeyDown={(
              input: import("@base-ui/react/types").BaseUIEvent<
                React.KeyboardEvent<HTMLSpanElement>
              >,
            ) => {
              preventRepeatedSwitchEnter(input);
              onKeyDown?.(input);
            }}
            className={(0, runtime.cn)(
              SWITCH_TRACK_CLASS,
              SWITCH_TRACK_SIZE_CLASS,
              className,
            )}
          >
            <runtime.baseSwitch.Thumb
              className={`${SWITCH_KNOB_CLASS} ${SWITCH_KNOB_SIZE_CLASS}`}
            />
          </runtime.baseSwitch.Root>
        );
        if (disabledReason === undefined) {
          return value;
        }
        return (
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
  };
}
