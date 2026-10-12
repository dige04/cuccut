import type { DelayedSpinnerProps, SpinnerProps } from "../../contracts/ui";
import type * as React from "react";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../../runtime-types";
export function installCdsComponentsSpinner(
  runtime: RuntimeBindings,
): () => void {
  var reactComponentsSpinner: typeof React;
  var jsxComponentsSpinner: typeof import("react/jsx-runtime");
  var ComponentsSpinnerSMLConfig: Partial<
    Record<NonNullable<SpinnerProps["size"]>, "sm" | "md" | "lg">
  >;
  var ComponentsSpinnerSmMdLgConfig: Record<
    "sm" | "md" | "lg",
    {
      box: number;
      stroke: number;
    }
  >;
  var initializeComponentsSpinner: () => void;
  function Spinner({
    size = "sm",
    delay = 0,
    inheritColor = false,
    label: label,
    className: className,
  }: SpinnerProps): React.ReactElement | null {
    let [value, value2] = (0, reactComponentsSpinner.useState)(delay <= 0),
      [value3, value4] = (0, reactComponentsSpinner.useState)(delay);
    delay !== value3 && (value4(delay), delay > 0 && value && value2(false));
    let value5 = delay <= 0 || value;
    (0, reactComponentsSpinner.useEffect)(() => {
      if (delay <= 0) return;
      let value14 = window.setTimeout(() => value2(true), delay);
      return () => window.clearTimeout(value14);
    }, [delay]);
    let value6 =
        ComponentsSpinnerSmMdLgConfig[
          (ComponentsSpinnerSMLConfig[size] ?? size) as "sm" | "md" | "lg"
        ],
      value7 = inheritColor ? "currentColor" : "var(--cds-text-muted)",
      value8 = inheritColor
        ? "color-mix(in srgb, currentColor 25%, transparent)"
        : "var(--cds-border)",
      value9 = (0, runtime.scaleCssPixels)(value6.box),
      value10 = (0, runtime.scaleCssPixels)(value6.stroke),
      value11 = `calc(100% - ${value10})`,
      value12 = `radial-gradient(farthest-side, transparent ${value11}, #000 calc(${value11} + 0.5px))`,
      value13 = value5 ? (
        <span
          data-cds={"Spinner"}
          className={(0, runtime.cn)(
            "relative inline-block shrink-0 align-middle",
            className,
          )}
          style={{
            width: value9,
            height: value9,
          }}
          aria-hidden={true}
        >
          <span
            className={"absolute inset-0 rounded-full"}
            style={{
              border: `${value10} solid ${value8}`,
            }}
          />
          <span
            className={
              "absolute inset-0 rounded-full animate-[spin_1s_linear_infinite] motion-reduce:animate-none"
            }
            style={{
              background: `conic-gradient(transparent 40%, ${value7})`,
              WebkitMask: value12,
              mask: value12,
            }}
          />
        </span>
      ) : null;
    return label ? (
      <span role={"status"} className={"leading-[0]"}>
        {value13}
        <DelayedSpinner show={value5}>{label}</DelayedSpinner>
      </span>
    ) : (
      value13
    );
  }
  function DelayedSpinner({
    show: show,
    children: children,
  }: DelayedSpinnerProps): React.ReactElement | null {
    let [value, value2] = (0, reactComponentsSpinner.useState)(false);
    (0, reactComponentsSpinner.useEffect)(() => {
      let value3 = window.setTimeout(() => value2(true), 100);
      return () => window.clearTimeout(value3);
    }, []);
    return show && value ? <span className={"sr-only"}>{children}</span> : null;
  }
  bindRuntimeValue(runtime, "Spinner", () => Spinner);
  bindRuntimeValue(runtime, "DelayedSpinner", () => DelayedSpinner);
  bindRuntimeValue(
    runtime,
    "reactComponentsSpinner",
    () => reactComponentsSpinner,
    (value) => {
      reactComponentsSpinner = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxComponentsSpinner",
    () => jsxComponentsSpinner,
    (value) => {
      jsxComponentsSpinner = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsSpinnerSMLConfig",
    () => ComponentsSpinnerSMLConfig,
    (value) => {
      ComponentsSpinnerSMLConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsSpinnerSmMdLgConfig",
    () => ComponentsSpinnerSmMdLgConfig,
    (value) => {
      ComponentsSpinnerSmMdLgConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeComponentsSpinner",
    () => initializeComponentsSpinner,
    (value) => {
      initializeComponentsSpinner = value;
    },
  );
  return () => {
    initializeComponentsSpinner = (0, runtime.initializeOnce)(() => {
      "use client";

      (0, runtime.initializeClassNames)();
      (0, runtime.initializePlatformRootFontSize_3)();
      reactComponentsSpinner = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react)(),
      );
      jsxComponentsSpinner = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react_jsx_runtime)(),
      );
      ComponentsSpinnerSMLConfig = {
        s: "sm",
        m: "md",
        l: "lg",
      };
      ComponentsSpinnerSmMdLgConfig = {
        sm: {
          box: 12,
          stroke: 1.5,
        },
        md: {
          box: 16,
          stroke: 1.75,
        },
        lg: {
          box: 20,
          stroke: 2,
        },
      };
    });
  };
}
