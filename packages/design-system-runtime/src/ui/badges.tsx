/** Restored application module; prepare first, initialize in original order. */
import type * as React from "react";
import type * as C from "../contracts/controls";
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installUiBadges(runtime: RuntimeBindings): () => void {
  var reactzV: typeof React;
  var jsxs_: typeof import("react/jsx-runtime");
  var badgeVariantClasses: Record<C.BadgeVariant, string>;
  var solidBadgeVariantClasses: Record<C.BadgeVariant, string>;
  var solidBadgeColorClasses: Record<C.AccentColor, string>;
  var tintedBadgeColorClasses: Record<C.AccentColor, string>;
  var badgeIconSpacingClasses: Record<"xs" | "sm" | "md", string>;
  var badgeLineHeightClasses: string;
  var badgeSizeByDensity: Record<
    C.Density,
    Record<C.ControlSize, "xs" | "sm" | "md">
  >;
  var Badge: C.ForwardComponent<HTMLSpanElement, C.BadgeProps>;
  var reactForUiBadges: typeof React;
  var jsxMu: typeof import("react/jsx-runtime");
  var counterVariantClasses: Record<Exclude<C.BadgeVariant, "pro">, string>;
  var counterFillClasses: Record<Exclude<C.BadgeVariant, "pro">, string>;
  var Counter: C.ForwardComponent<HTMLSpanElement, C.CounterProps>;
  function isBadgeVariant(
    input: C.BadgeVariant | C.AccentColor,
  ): input is C.BadgeVariant {
    return Object.hasOwn(badgeVariantClasses, input);
  }
  bindRuntimeValue(
    runtime,
    "reactzV",
    () => reactzV,
    (value) => {
      reactzV = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxs_",
    () => jsxs_,
    (value) => {
      jsxs_ = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "badgeVariantClasses",
    () => badgeVariantClasses,
    (value) => {
      badgeVariantClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "solidBadgeVariantClasses",
    () => solidBadgeVariantClasses,
    (value) => {
      solidBadgeVariantClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "solidBadgeColorClasses",
    () => solidBadgeColorClasses,
    (value) => {
      solidBadgeColorClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "tintedBadgeColorClasses",
    () => tintedBadgeColorClasses,
    (value) => {
      tintedBadgeColorClasses = value;
    },
  );
  bindRuntimeValue(runtime, "isBadgeVariant", () => isBadgeVariant);
  bindRuntimeValue(
    runtime,
    "badgeIconSpacingClasses",
    () => badgeIconSpacingClasses,
    (value) => {
      badgeIconSpacingClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "badgeLineHeightClasses",
    () => badgeLineHeightClasses,
    (value) => {
      badgeLineHeightClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "badgeSizeByDensity",
    () => badgeSizeByDensity,
    (value) => {
      badgeSizeByDensity = value;
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
    "reactForUiBadges",
    () => reactForUiBadges,
    (value) => {
      reactForUiBadges = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxMu",
    () => jsxMu,
    (value) => {
      jsxMu = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "counterVariantClasses",
    () => counterVariantClasses,
    (value) => {
      counterVariantClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "counterFillClasses",
    () => counterFillClasses,
    (value) => {
      counterFillClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "Counter",
    () => Counter,
    (value) => {
      Counter = value;
    },
  );
  return () => {
    (0, runtime.initializeCdsRoot)();
    (0, runtime.initializeIcons)();
    reactzV = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    jsxs_ = (0, runtime.toModuleNamespace)((0, runtime.loadJsxNamespace)(), 1);
    badgeVariantClasses = {
      neutral: "bg-neutral text-secondary",
      accent: "bg-tint-blue text-accent",
      success: "bg-tint-green text-tint-green",
      warning: "bg-tint-yellow text-warning",
      danger: "bg-tint-red text-danger",
      pro: "bg-tint-violet text-pro",
    };
    solidBadgeVariantClasses = {
      neutral: "bg-gray-700 dark:bg-gray-550 text-gray-0",
      accent: "bg-blue-500 text-gray-0",
      success: "bg-green-500 text-gray-0",
      warning: "bg-yellow-500 text-gray-0",
      danger: "bg-red-450 text-gray-0",
      pro: "bg-violet-450 text-gray-0",
    };
    solidBadgeColorClasses = {
      red: "bg-red-450 text-gray-0",
      orange: "bg-orange-450 text-gray-0",
      yellow: "bg-yellow-500 text-gray-0",
      green: "bg-green-500 text-gray-0",
      aqua: "bg-aqua-500 text-gray-0",
      blue: "bg-blue-500 text-gray-0",
      violet: "bg-violet-450 text-gray-0",
      magenta: "bg-magenta-450 text-gray-0",
    };
    tintedBadgeColorClasses = {
      red: "bg-tint-red text-tint-red",
      orange: "bg-tint-orange text-tint-orange",
      yellow: "bg-tint-yellow text-tint-yellow",
      green: "bg-tint-green text-tint-green",
      aqua: "bg-tint-aqua text-tint-aqua",
      blue: "bg-tint-blue text-tint-blue",
      violet: "bg-tint-violet text-tint-violet",
      magenta: "bg-tint-magenta text-tint-magenta",
    };
    badgeIconSpacingClasses = {
      xs: "ml-[calc((var(--cds-h-control-nested)-calc(0.75rem*var(--cds-rem-scale,1)))/2-var(--cds-pad-sm)+1px)] mr-[-0.8px] shrink-0",
      sm: "ml-[calc((var(--cds-h-control-nested)-calc(1rem*var(--cds-rem-scale,1)))/2-var(--cds-pad-sm)+1px)] mr-[-0.8px] shrink-0",
      md: "ml-[calc((var(--cds-h-control-nested)-calc(1.25rem*var(--cds-rem-scale,1)))/2-var(--cds-pad-sm)+1px)] mr-[-0.8px] shrink-0",
    };
    badgeLineHeightClasses =
      "leading-[calc(0.75rem*var(--cds-rem-scale,1))] py-[0.125em] -my-[0.125em]";
    badgeSizeByDensity = {
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
    Badge = reactzV.forwardRef(
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
        }: C.BadgeProps,
        options: React.ForwardedRef<HTMLSpanElement>,
      ) => {
        let value = variant ?? "accent",
          value2: string = (0, runtime.useTranslation)(
            "removeItem",
            "Remove {item}",
            {
              item: typeof children === "string" ? children : "item",
            },
          ),
          value3: C.Density = (0, runtime.useDensity)(),
          value4 = badgeSizeByDensity[value3][size ?? "base"],
          length = reactzV.Children.toArray(children).length,
          value5 =
            !iconOnly &&
            (length > 0 || onRemove !== undefined || removeRender !== undefined)
              ? badgeIconSpacingClasses[value4]
              : "shrink-0",
          value6 =
            (size === "xxs"
              ? 1
              : (0, runtime.getDensitySizeIndex)(value3, size)) === 1
              ? badgeLineHeightClasses
              : "pb-[0.05em]",
          value7 = removeLabel || value2,
          value8 = (0, runtime.clsx)(
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
            Object.entries<unknown>(removeRender?.props ?? {}).filter(
              ([, input]: [string, unknown]) => input !== undefined,
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
              ? reactzV.cloneElement(
                  removeRender,
                  (0, runtime.baseMergeProps)(
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
                    onClick={(input: React.MouseEvent<HTMLButtonElement>) => {
                      input.stopPropagation();
                      onRemove();
                    }}
                    onKeyDown={(
                      input: React.KeyboardEvent<HTMLButtonElement>,
                    ) => {
                      if (input.key === "Enter" || input.key === " ") {
                        input.stopPropagation();
                      }
                    }}
                    onKeyUp={(
                      input: React.KeyboardEvent<HTMLButtonElement>,
                    ) => {
                      if (input.key === "Enter" || input.key === " ") {
                        input.stopPropagation();
                      }
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
                ? solidBadgeVariantClasses[value as C.BadgeVariant]
                : solidBadgeColorClasses[value as C.AccentColor]
              : value13
                ? badgeVariantClasses[value as C.BadgeVariant]
                : tintedBadgeColorClasses[value as C.AccentColor];
        return (
          <span
            ref={options}
            data-cds={"Badge"}
            role={iconOnly ? "img" : undefined}
            {...(size === "xxs"
              ? {
                  "data-step": "1",
                }
              : (0, runtime.getControlSizeAttributes)(size))}
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
            {[
              typeof icon !== "number" &&
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
                )),
              truncate ? (
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
              ),
              value12,
            ]}
          </span>
        );
      },
    );
    Badge.displayName = "Badge";
    (0, runtime.initializeClassNames)();
    (0, runtime.initializeCdsRoot)();
    reactForUiBadges = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    jsxMu = (0, runtime.toModuleNamespace)((0, runtime.loadJsxNamespace)(), 1);
    counterVariantClasses = {
      neutral: "bg-neutral text-secondary",
      accent: "bg-fill-accent text-on-accent",
      success: "bg-green-500 text-gray-0",
      warning: "bg-fill-warning text-yellow-750",
      danger: "bg-fill-danger text-on-danger",
    };
    counterFillClasses = {
      neutral: "bg-fill-control",
      accent: "bg-fill-accent",
      success: "bg-fill-success",
      warning: "bg-fill-warning",
      danger: "bg-fill-danger",
    };
    Counter = reactForUiBadges.forwardRef(
      (
        {
          value: value,
          max = 99,
          showZero = false,
          dot = false,
          variant = "danger",
          size: size,
          className: className,
          ...props
        }: C.CounterProps,
        options: React.ForwardedRef<HTMLSpanElement>,
      ) => {
        if (dot) {
          return (
            <span
              ref={options}
              data-cds={"Counter"}
              aria-hidden={"true"}
              {...props}
              className={(0, runtime.cn)(
                "inline-block size-2 shrink-0 rounded-full align-middle",
                counterFillClasses[variant],
                className,
              )}
            />
          );
        }
        if (!Number.isFinite(value)) {
          return null;
        }
        let value2 = Math.max(0, Math.floor(value));
        if (value2 === 0 && !showZero) {
          return null;
        }
        let value3 = value2 > max ? `${max}+` : `${value2}`;
        return (
          <span
            ref={options}
            data-cds={"Counter"}
            {...(0, runtime.getControlSizeAttributes)(size)}
            {...props}
            className={(0, runtime.cn)(
              "inline-flex shrink-0 items-center justify-center align-middle",
              "h-control-nested min-w-[var(--cds-h-control-nested)] rounded-full",
              value3.length === 1
                ? "px-0"
                : "px-[calc(var(--cds-h-control-nested)*0.3)]",
              "font-sans text-caption font-medium proportional-nums",
              counterVariantClasses[variant],
              className,
            )}
          >
            {value3}
          </span>
        );
      },
    );
    Counter.displayName = "Counter";
  };
}
