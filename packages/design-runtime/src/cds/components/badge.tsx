import type {
  AccentColor,
  BadgeProps,
  BadgeVariant,
  ControlSize,
  Density,
  ForwardComponent,
} from "../../contracts/ui";
import type * as React from "react";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../../runtime-types";
export function installCdsComponentsBadge(
  runtime: RuntimeBindings,
): () => void {
  var reactComponentsBadge: typeof React;
  var jsxComponentsBadge: typeof import("react/jsx-runtime");
  var ComponentsBadgeNeutralAccentSuccessConfig: Record<BadgeVariant, string>;
  var ComponentsBadgeNeutralAccentSuccessConfig_2: Record<BadgeVariant, string>;
  var ComponentsBadgeRedOrangeYellowConfig: Record<AccentColor, string>;
  var ComponentsBadgeRedOrangeYellowConfig_2: Record<AccentColor, string>;
  var ComponentsBadgeXsSmMdConfig: Record<"xs" | "sm" | "md", string>;
  var ComponentsBadgeClassNames: string;
  var ComponentsBadgeComfortableCompactConfig: Record<
    Density,
    Record<ControlSize, "xs" | "sm" | "md">
  >;
  var Badge: ForwardComponent<HTMLSpanElement, BadgeProps>;
  var initializeComponentsBadge: () => void;
  function isBadgeVariant(
    input: BadgeVariant | AccentColor,
  ): input is BadgeVariant {
    return Object.hasOwn(ComponentsBadgeNeutralAccentSuccessConfig, input);
  }
  bindRuntimeValue(runtime, "isBadgeVariant", () => isBadgeVariant);
  bindRuntimeValue(
    runtime,
    "reactComponentsBadge",
    () => reactComponentsBadge,
    (value) => {
      reactComponentsBadge = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxComponentsBadge",
    () => jsxComponentsBadge,
    (value) => {
      jsxComponentsBadge = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsBadgeNeutralAccentSuccessConfig",
    () => ComponentsBadgeNeutralAccentSuccessConfig,
    (value) => {
      ComponentsBadgeNeutralAccentSuccessConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsBadgeNeutralAccentSuccessConfig_2",
    () => ComponentsBadgeNeutralAccentSuccessConfig_2,
    (value) => {
      ComponentsBadgeNeutralAccentSuccessConfig_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsBadgeRedOrangeYellowConfig",
    () => ComponentsBadgeRedOrangeYellowConfig,
    (value) => {
      ComponentsBadgeRedOrangeYellowConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsBadgeRedOrangeYellowConfig_2",
    () => ComponentsBadgeRedOrangeYellowConfig_2,
    (value) => {
      ComponentsBadgeRedOrangeYellowConfig_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsBadgeXsSmMdConfig",
    () => ComponentsBadgeXsSmMdConfig,
    (value) => {
      ComponentsBadgeXsSmMdConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsBadgeClassNames",
    () => ComponentsBadgeClassNames,
    (value) => {
      ComponentsBadgeClassNames = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsBadgeComfortableCompactConfig",
    () => ComponentsBadgeComfortableCompactConfig,
    (value) => {
      ComponentsBadgeComfortableCompactConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "Badge",
    () => Badge,
    (value) => {
      Badge = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeComponentsBadge",
    () => initializeComponentsBadge,
    (value) => {
      initializeComponentsBadge = value;
    },
  );
  return () => {
    initializeComponentsBadge = (0, runtime.initializeOnce)(() => {
      "use client";

      (0, runtime.initializeClassNames)();
      (0, runtime.initializeSheetsStyles_2)();
      (0, runtime.initializeCdsRoot)();
      (0, runtime.initializeComponentsIcon_2)();
      reactComponentsBadge = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react)(),
      );
      (0, runtime.initializeNpm_clsx_xh)();
      jsxComponentsBadge = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react_jsx_runtime)(),
      );
      (0, runtime.initializeNpm__base_ui_react_gx)();
      ComponentsBadgeNeutralAccentSuccessConfig = {
        neutral: "bg-neutral text-secondary",
        accent: "bg-tint-blue text-accent",
        success: "bg-tint-green text-tint-green",
        warning: "bg-tint-yellow text-warning",
        danger: "bg-tint-red text-danger",
        pro: "bg-tint-violet text-pro",
      };
      ComponentsBadgeNeutralAccentSuccessConfig_2 = {
        neutral: "bg-gray-700 dark:bg-gray-550 text-gray-0",
        accent: "bg-blue-500 text-gray-0",
        success: "bg-green-500 text-gray-0",
        warning: "bg-yellow-500 text-gray-0",
        danger: "bg-red-450 text-gray-0",
        pro: "bg-violet-450 text-gray-0",
      };
      ComponentsBadgeRedOrangeYellowConfig = {
        red: "bg-red-450 text-gray-0",
        orange: "bg-orange-450 text-gray-0",
        yellow: "bg-yellow-500 text-gray-0",
        green: "bg-green-500 text-gray-0",
        aqua: "bg-aqua-500 text-gray-0",
        blue: "bg-blue-500 text-gray-0",
        violet: "bg-violet-450 text-gray-0",
        magenta: "bg-magenta-450 text-gray-0",
      };
      ComponentsBadgeRedOrangeYellowConfig_2 = {
        red: "bg-tint-red text-tint-red",
        orange: "bg-tint-orange text-tint-orange",
        yellow: "bg-tint-yellow text-tint-yellow",
        green: "bg-tint-green text-tint-green",
        aqua: "bg-tint-aqua text-tint-aqua",
        blue: "bg-tint-blue text-tint-blue",
        violet: "bg-tint-violet text-tint-violet",
        magenta: "bg-tint-magenta text-tint-magenta",
      };
      ComponentsBadgeXsSmMdConfig = {
        xs: "ml-[calc((var(--cds-h-control-nested)-calc(0.75rem*var(--cds-rem-scale,1)))/2-var(--cds-pad-sm)+1px)] mr-[-0.8px] shrink-0",
        sm: "ml-[calc((var(--cds-h-control-nested)-calc(1rem*var(--cds-rem-scale,1)))/2-var(--cds-pad-sm)+1px)] mr-[-0.8px] shrink-0",
        md: "ml-[calc((var(--cds-h-control-nested)-calc(1.25rem*var(--cds-rem-scale,1)))/2-var(--cds-pad-sm)+1px)] mr-[-0.8px] shrink-0",
      };
      ComponentsBadgeClassNames =
        "leading-[calc(0.75rem*var(--cds-rem-scale,1))] py-[0.125em] -my-[0.125em]";
      ComponentsBadgeComfortableCompactConfig = {
        comfortable: {
          lg: "md",
          base: "sm",
          sm: "sm",
          xs: "xs",
          xxs: "xs",
        },
        compact: {
          lg: "sm",
          base: "xs",
          sm: "xs",
          xs: "xs",
          xxs: "xs",
        },
      };
      Badge = (0, reactComponentsBadge.forwardRef)<HTMLSpanElement, BadgeProps>(
        (
          {
            variant: variant,
            icon: icon,
            iconOnly = false,
            onRemove: onRemove,
            removeLabel: removeLabel,
            removeRender: removeRender,
            bold: bold,
            size: size,
            truncate: truncate,
            className: className,
            children: children,
            ...props
          }: BadgeProps,
          options: React.ForwardedRef<HTMLSpanElement>,
        ): React.ReactElement => {
          let value = variant ?? "accent",
            value2 = (0, runtime.useLabel)("removeItem", "Remove {item}", {
              item: typeof children == "string" ? children : "item",
            }),
            value3 = (0, runtime.useDensity)(),
            value4 =
              ComponentsBadgeComfortableCompactConfig[value3][size ?? "base"],
            length = reactComponentsBadge.Children.toArray(children).length,
            value5 =
              !iconOnly &&
              (length > 0 ||
                onRemove !== undefined ||
                removeRender !== undefined)
                ? ComponentsBadgeXsSmMdConfig[value4]
                : "shrink-0",
            value6 =
              (size === "xxs"
                ? 1
                : (0, runtime.getControlSizeRank)(value3, size)) === 1
                ? ComponentsBadgeClassNames
                : "pb-[0.05em]",
            value7 = removeLabel || value2,
            value8 = (0, runtime.npm_clsx_Ea)(
              "cds-reset relative inline-flex shrink-0 items-center justify-center",
              "before:absolute before:left-[-2px] before:top-1/2 before:-translate-y-1/2 before:content-['']",
              "before:h-[max(24px,100%)] before:w-[max(24px,calc(100%+2px))]",
              "size-[max(calc(var(--cds-h-control-nested)-calc(0.375rem*var(--cds-rem-scale,1))),calc(0.75rem*var(--cds-rem-scale,1)))]",
              "rounded-[calc(var(--cds-h-control-nested)/4-min(calc(0.1875rem*var(--cds-rem-scale,1)),(var(--cds-h-control-nested)-calc(0.75rem*var(--cds-rem-scale,1)))/2))]",
              "-ml-0.5 mr-[calc(min(calc(0.1875rem*var(--cds-rem-scale,1)),(var(--cds-h-control-nested)-calc(0.75rem*var(--cds-rem-scale,1)))/2)-var(--cds-pad-sm))]",
              "text-current outline-none focus-visible:outline-hidden",
              "[--cds-badge-x-wght:577.8] hover:[--cds-badge-x-wght:700]",
              "transition-[color,background-color,box-shadow,--cds-badge-x-wght]",
              bold === true
                ? "hover:bg-[color-mix(in_srgb,currentColor_20%,transparent)]"
                : "hover:bg-[color-mix(in_srgb,currentColor_10%,transparent)]",
              "focus-visible:shadow-focus",
            ),
            {
              className: value9,
              ...value10
            }: React.ComponentPropsWithoutRef<"button"> = Object.fromEntries(
              Object.entries(removeRender?.props ?? {}).filter(
                ([, input]) => input !== undefined,
              ),
            ),
            value11 = (
              <runtime.Icon
                name={"X"}
                size={"xs"}
                style={{
                  fontVariationSettings:
                    "'opsz' 12, 'wght' var(--cds-badge-x-wght, 577.8)",
                }}
              />
            ),
            value12 =
              removeRender !== undefined
                ? (0, reactComponentsBadge.cloneElement)(
                    removeRender,
                    (0, runtime.npm_mergeProps_Ac)(
                      {
                        className: (0, runtime.cn)(value8, value9),
                        "aria-label": value7,
                        children: value11,
                      },
                      value10,
                    ),
                  )
                : onRemove !== undefined && (
                    <button
                      type={"button"}
                      aria-label={value7}
                      onClick={(input: React.MouseEvent<HTMLElement>) => {
                        input.stopPropagation();
                        onRemove();
                      }}
                      onKeyDown={(input: React.KeyboardEvent<HTMLElement>) => {
                        (input.key === "Enter" || input.key === " ") &&
                          input.stopPropagation();
                      }}
                      onKeyUp={(input: React.KeyboardEvent<HTMLElement>) => {
                        (input.key === "Enter" || input.key === " ") &&
                          input.stopPropagation();
                      }}
                      className={value8}
                    >
                      {value11}
                    </button>
                  ),
            value13 = isBadgeVariant(value),
            value14 =
              bold === true
                ? value13
                  ? ComponentsBadgeNeutralAccentSuccessConfig_2[
                      value as BadgeVariant
                    ]
                  : ComponentsBadgeRedOrangeYellowConfig[value as AccentColor]
                : value13
                  ? ComponentsBadgeNeutralAccentSuccessConfig[
                      value as BadgeVariant
                    ]
                  : ComponentsBadgeRedOrangeYellowConfig_2[
                      value as AccentColor
                    ];
          return (
            <span
              ref={options}
              data-cds={"Badge"}
              role={iconOnly ? "img" : undefined}
              {...(size === "xxs"
                ? {
                    "data-step": "1",
                  }
                : (0, runtime.getSizeAttribute)(size))}
              {...props}
              className={(0, runtime.cn)(
                "inline-flex items-center gap-1 align-middle h-control-nested whitespace-nowrap rounded-chip",
                iconOnly
                  ? "aspect-square w-control-nested justify-center px-0"
                  : "px-sm",
                "font-sans text-caption font-medium leading-[round(1.25em,1px)]",
                truncate ? "min-w-0" : "shrink-0",
                value14,
                className,
              )}
            >
              {typeof icon != "number" &&
                icon &&
                ((0, runtime.isIconName)(icon) ? (
                  <runtime.Icon name={icon} size={value4} className={value5} />
                ) : (
                  <span
                    aria-hidden={true}
                    className={(0, runtime.cn)("inline-flex", value5)}
                  >
                    {icon}
                  </span>
                ))}
              {truncate ? (
                <span
                  className={(0, runtime.cn)(
                    value6,
                    "min-w-0 overflow-x-clip text-ellipsis whitespace-nowrap",
                  )}
                >
                  {children}
                </span>
              ) : length === 1 ? (
                <span className={value6}>{children}</span>
              ) : (
                children
              )}
              {value12}
            </span>
          );
        },
      );
      Badge.displayName = "Badge";
    });
  };
}
