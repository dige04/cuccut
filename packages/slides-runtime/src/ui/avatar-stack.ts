/** Restored application module; prepare first, initialize in original order. */
import type {
  CSSProperties,
  ForwardRefExoticComponent,
  ForwardedRef,
  ReactElement,
  ReactNode,
  RefAttributes,
} from "react";
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type JsxNamespace,
  type ReactNamespace,
} from "../bindings";

/** Avatar sizes the stack lays out; the same names as the avatar sizes. */
export type AvatarStackSize = "xs" | "sm" | "md" | "lg";
export interface AvatarStackProps {
  /** The avatars, in stacking order. */
  children?: ReactNode;
  /** How many avatars show before the "+N" surplus chip. */
  max?: number;
  /** Real number of members when it is larger than the avatars passed. */
  total?: number;
  size?: AvatarStackSize;
  /** Whether hovering the surplus chip names the hidden members. */
  surplusTooltip?: boolean;
  /** Plural noun used in the group label, such as "people". */
  noun?: string;
  "aria-label"?: string;
  className?: string;
}
/** Props of an avatar element the stack reads a name from. */
interface AvatarElementProps {
  name?: unknown;
  children?: ReactNode;
}

declare module "../bindings" {
  interface RuntimeBindings {
    avatarStackStyle: (index: number, isFirst: boolean) => CSSProperties;
    avatarAccessibleName: (element: ReactNode) => string | undefined;
    reactForUiAvatarStack: ReactNamespace;
    jsxForUiAvatarStack: JsxNamespace;
    AVATAR_STACK_SIZE_CLASSES: Record<AvatarStackSize, string>;
    AVATAR_STACK_SURPLUS_SIZE_CLASSES: Record<AvatarStackSize, string>;
    AVATAR_STACK_DEFAULT_MAX: number;
    AVATAR_STACK_ITEM_CLASS: string;
    AvatarStack: ForwardRefExoticComponent<
      AvatarStackProps & RefAttributes<HTMLDivElement>
    >;
    initializeUiAvatarStack: () => void;
  }
}

export function installUiAvatarStack(runtime: RuntimeBindings): () => void {
  var reactForUiAvatarStack: ReactNamespace;
  var jsxForUiAvatarStack: JsxNamespace;
  var AVATAR_STACK_SIZE_CLASSES: RuntimeBindings["AVATAR_STACK_SIZE_CLASSES"];
  var AVATAR_STACK_SURPLUS_SIZE_CLASSES: RuntimeBindings["AVATAR_STACK_SURPLUS_SIZE_CLASSES"];
  var AVATAR_STACK_DEFAULT_MAX: number;
  var AVATAR_STACK_ITEM_CLASS: string;
  var AvatarStack: RuntimeBindings["AvatarStack"];
  var initializeUiAvatarStack: () => void;
  function avatarStackStyle(index: number, isFirst: boolean): CSSProperties {
    return {
      marginInlineStart: isFirst
        ? undefined
        : "calc(-1 * var(--cds-stack-overlap))",
      zIndex: index,
    };
  }
  function avatarAccessibleName(element: ReactNode): string | undefined {
    if (!reactForUiAvatarStack.isValidElement<AvatarElementProps>(element)) {
      return;
    }
    let value = element;
    if (typeof value.props.name === "string") {
      return value.props.name;
    }
    let children = value.props.children;
    if (reactForUiAvatarStack.isValidElement<{ name?: unknown }>(children)) {
      let name = children.props.name;
      if (typeof name === "string") {
        return name;
      }
    }
  }
  bindRuntimeValue(runtime, "avatarStackStyle", () => avatarStackStyle);
  bindRuntimeValue(runtime, "avatarAccessibleName", () => avatarAccessibleName);
  bindRuntimeValue(
    runtime,
    "reactForUiAvatarStack",
    () => reactForUiAvatarStack,
    (value) => {
      reactForUiAvatarStack = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxForUiAvatarStack",
    () => jsxForUiAvatarStack,
    (value) => {
      jsxForUiAvatarStack = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "AVATAR_STACK_SIZE_CLASSES",
    () => AVATAR_STACK_SIZE_CLASSES,
    (value) => {
      AVATAR_STACK_SIZE_CLASSES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "AVATAR_STACK_SURPLUS_SIZE_CLASSES",
    () => AVATAR_STACK_SURPLUS_SIZE_CLASSES,
    (value) => {
      AVATAR_STACK_SURPLUS_SIZE_CLASSES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "AVATAR_STACK_DEFAULT_MAX",
    () => AVATAR_STACK_DEFAULT_MAX,
    (value) => {
      AVATAR_STACK_DEFAULT_MAX = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "AVATAR_STACK_ITEM_CLASS",
    () => AVATAR_STACK_ITEM_CLASS,
    (value) => {
      AVATAR_STACK_ITEM_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "AvatarStack",
    () => AvatarStack,
    (value) => {
      AvatarStack = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeUiAvatarStack",
    () => initializeUiAvatarStack,
    (value) => {
      initializeUiAvatarStack = value;
    },
  );
  return () => {
    AVATAR_STACK_DEFAULT_MAX = 4;
    AVATAR_STACK_ITEM_CLASS =
      "relative inline-flex rounded-full bg-[var(--cds-page-bg)] [box-shadow:0_0_0_2px_var(--cds-page-bg)]";
    initializeUiAvatarStack = (0, runtime.initializeOnce)((): void => {
      (0, runtime.initializeClassNames)();
      (0, runtime.initializeTranslations)();
      (0, runtime.initializeUiAvatars2)();
      (0, runtime.initializeTooltip)();
      reactForUiAvatarStack = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
      jsxForUiAvatarStack = (0, runtime.toModuleNamespace)(
        (0, runtime.loadJsxNamespace)(),
        1,
      );
      AVATAR_STACK_SIZE_CLASSES = {
        xs: "[--cds-stack-overlap:calc(var(--cds-avatar-xs)*0.25)]",
        sm: "[--cds-stack-overlap:calc(var(--cds-avatar-sm)*0.25)]",
        md: "[--cds-stack-overlap:calc(var(--cds-avatar-md)*0.25)]",
        lg: "[--cds-stack-overlap:calc(var(--cds-avatar-lg)*0.25)]",
      };
      AVATAR_STACK_SURPLUS_SIZE_CLASSES = {
        xs: "h-[var(--cds-avatar-xs)] min-w-[var(--cds-avatar-xs)] px-1 text-[length:var(--cds-avatar-text-xs)]",
        sm: "h-[var(--cds-avatar-sm)] min-w-[var(--cds-avatar-sm)] px-1.5 text-[calc(0.5625rem*var(--cds-rem-scale,1))]",
        md: "h-[var(--cds-avatar-md)] min-w-[var(--cds-avatar-md)] px-2 text-footnote",
        lg: "h-[var(--cds-avatar-lg)] min-w-[var(--cds-avatar-lg)] px-3 text-body",
      };
      AvatarStack = reactForUiAvatarStack.forwardRef<
        HTMLDivElement,
        AvatarStackProps
      >(
        (
          {
            children: children,
            max = 5,
            total: total,
            size = "md",
            surplusTooltip = true,
            noun: noun,
            "aria-label": ariaLabel,
            className: className,
          }: AvatarStackProps,
          options: ForwardedRef<HTMLDivElement>,
        ): ReactElement => {
          let value = reactForUiAvatarStack.Children.toArray(children),
            value2 = total ?? value.length,
            value3 = (0, runtime.useTranslation)(
              "avatarGroup",
              "{count} {noun}",
              {
                count: value2,
                noun: noun ?? "",
              },
            ),
            value4 = ariaLabel ?? value3,
            value5 = Math.max(0, Math.min(max, value.length)),
            value6 = value.slice(0, value5),
            value7 = value.slice(value5),
            value8 = Math.max(0, value2 - value5),
            value9 = value7
              .map(avatarAccessibleName)
              .filter((items: string | undefined): boolean => !!items && items.length > 0)
              .slice(0, AVATAR_STACK_DEFAULT_MAX),
            value10 = value8 - value9.length,
            value11 =
              value9.length > 0
                ? value9.join(", ") +
                  (value10 > 0
                    ? `, and ${value10} other${value10 === 1 ? "" : "s"}`
                    : "")
                : undefined,
            value12 = surplusTooltip ? value11 : undefined,
            value13 =
              (0, runtime.useTranslation)("overflowCount", "and {count} more", {
                count: value8,
              }) + (value11 ? `: ${value11}` : ""),
            memo = reactForUiAvatarStack.useMemo(
              (): { size: AvatarStackSize } => ({
                size: size,
              }),
              [size],
            ),
            value14 = value6.length + (value8 > 0 ? 1 : 0);
          return jsxForUiAvatarStack.jsx("div", {
            ref: options,
            "data-cds": "AvatarStack",
            role: "group",
            "aria-label": value4,
            className: (0, runtime.cn)(
              "isolate inline-flex shrink-0 items-center",
              AVATAR_STACK_SIZE_CLASSES[size],
              className,
            ),
            children: jsxForUiAvatarStack.jsx(
              runtime.AvatarStackContext.Provider,
              {
                value: memo,
                children: jsxForUiAvatarStack.jsxs(runtime.TooltipProvider, {
                  children: [
                    value6.map(
                      (input: ReactNode, options2: number): ReactElement =>
                        jsxForUiAvatarStack.jsx(
                          "span",
                          {
                            "data-stack-item": true,
                            className: AVATAR_STACK_ITEM_CLASS,
                            style: avatarStackStyle(
                              value14 - 1 - options2,
                              options2 === 0,
                            ),
                            children: input,
                          },
                          reactForUiAvatarStack.isValidElement(input)
                            ? (input.key ?? options2)
                            : options2,
                        ),
                    ),
                    value8 > 0 &&
                      jsxForUiAvatarStack.jsx(runtime.Tooltip, {
                        content: value12,
                        children: jsxForUiAvatarStack.jsx("span", {
                          "data-stack-item": true,
                          "data-surplus": true,
                          className: AVATAR_STACK_ITEM_CLASS,
                          style: avatarStackStyle(0, value6.length === 0),
                          children: jsxForUiAvatarStack.jsx("span", {
                            role: "img",
                            "aria-label": value13,
                            className: `inline-flex shrink-0 select-none items-center justify-center rounded-full bg-fill-control font-sans font-medium leading-none text-secondary ${AVATAR_STACK_SURPLUS_SIZE_CLASSES[size]}`,
                            children: `+${value8}`,
                          }),
                        }),
                      }),
                  ],
                }),
              },
            ),
          });
        },
      );
      AvatarStack.displayName = "AvatarStack";
    });
  };
}
