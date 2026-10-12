import type {
  CollapsiblePanelProps,
  CollapsibleRootProps,
  CollapsibleTriggerProps,
  ForwardComponent,
} from "../../contracts/ui";
import type * as React from "react";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../../runtime-types";
export function installCdsComponentsCollapsible(
  runtime: RuntimeBindings,
): () => void {
  var reactComponentsCollapsible: typeof React;
  var jsxComponentsCollapsible: typeof import("react/jsx-runtime");
  var CollapsibleRoot: ForwardComponent<HTMLDivElement, CollapsibleRootProps>;
  var collapsibleTriggerClasses: string;
  var ComponentsCollapsibleLabel: string;
  var CollapsibleTrigger: ForwardComponent<
    HTMLButtonElement,
    CollapsibleTriggerProps
  >;
  var collapsiblePanelClasses: string;
  var CollapsiblePanel: ForwardComponent<HTMLDivElement, CollapsiblePanelProps>;
  var ComponentsCollapsibleRootTriggerPanelConfig: {
    Root: typeof CollapsibleRoot;
    Trigger: typeof CollapsibleTrigger;
    Panel: typeof CollapsiblePanel;
  };
  var initializeComponentsCollapsible: () => void;
  bindRuntimeValue(
    runtime,
    "reactComponentsCollapsible",
    () => reactComponentsCollapsible,
    (value) => {
      reactComponentsCollapsible = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxComponentsCollapsible",
    () => jsxComponentsCollapsible,
    (value) => {
      jsxComponentsCollapsible = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CollapsibleRoot",
    () => CollapsibleRoot,
    (value) => {
      CollapsibleRoot = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "collapsibleTriggerClasses",
    () => collapsibleTriggerClasses,
    (value) => {
      collapsibleTriggerClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsCollapsibleLabel",
    () => ComponentsCollapsibleLabel,
    (value) => {
      ComponentsCollapsibleLabel = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CollapsibleTrigger",
    () => CollapsibleTrigger,
    (value) => {
      CollapsibleTrigger = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "collapsiblePanelClasses",
    () => collapsiblePanelClasses,
    (value) => {
      collapsiblePanelClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CollapsiblePanel",
    () => CollapsiblePanel,
    (value) => {
      CollapsiblePanel = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsCollapsibleRootTriggerPanelConfig",
    () => ComponentsCollapsibleRootTriggerPanelConfig,
    (value) => {
      ComponentsCollapsibleRootTriggerPanelConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeComponentsCollapsible",
    () => initializeComponentsCollapsible,
    (value) => {
      initializeComponentsCollapsible = value;
    },
  );
  return () => {
    initializeComponentsCollapsible = (0, runtime.initializeOnce)(() => {
      "use client";

      (0, runtime.initializeClassNames)();
      (0, runtime.initializeDomSelectionPrevention)();
      (0, runtime.initializeComponentsIcon_2)();
      reactComponentsCollapsible = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react)(),
      );
      (0, runtime.initializeNpm_clsx_xh)();
      jsxComponentsCollapsible = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react_jsx_runtime)(),
      );
      (0, runtime.initializeNpm__base_ui_react_iqe)();
      CollapsibleRoot = (0, reactComponentsCollapsible.forwardRef)<
        HTMLDivElement,
        CollapsibleRootProps
      >(
        (
          input: CollapsibleRootProps,
          options: React.ForwardedRef<HTMLDivElement>,
        ): React.ReactElement => (
          <runtime.npm_Collapsible_a1.Root
            ref={options}
            data-cds={"Collapsible"}
            {...input}
          />
        ),
      );
      CollapsibleRoot.displayName = "Collapsible.Root";
      collapsibleTriggerClasses =
        "cds-reset group/clp inline-flex w-fit items-center gap-1.5 border-0 select-none outline-none focus-visible:outline-hidden font-sans text-body font-normal text-secondary hover:text-primary transition-shadow duration-fast focus-visible:shadow-focus rounded data-[disabled]:opacity-disabled data-[disabled]:pointer-events-none";
      ComponentsCollapsibleLabel =
        "shrink-0 transition-transform group-data-[panel-open]/clp:rotate-90";
      CollapsibleTrigger = (0, reactComponentsCollapsible.forwardRef)<
        HTMLButtonElement,
        CollapsibleTriggerProps
      >(
        (
          {
            className: className,
            children: children,
            caretPosition: caretPosition,
            hideCaret: hideCaret,
            render: render,
            ...props
          }: CollapsibleTriggerProps,
          options: React.ForwardedRef<HTMLButtonElement>,
        ): React.ReactElement => {
          let value = (0, runtime.withSelectionPrevention)(props.onMouseDown),
            value2 = hideCaret ? null : (
              <runtime.Icon
                name={"CaretRight"}
                size={"sm"}
                className={(0, runtime.npm_clsx_Ea)(
                  ComponentsCollapsibleLabel,
                  caretPosition === "end" && "ms-auto",
                )}
              />
            );
          return render ? (
            <runtime.npm_Collapsible_a1.Trigger
              ref={options}
              render={render}
              className={className}
              {...props}
              onMouseDown={value}
            />
          ) : (
            <runtime.npm_Collapsible_a1.Trigger
              ref={options}
              {...props}
              className={(0, runtime.cn)(collapsibleTriggerClasses, className)}
              onMouseDown={value}
            >
              {caretPosition !== "end" && value2}
              {children}
              {caretPosition === "end" && value2}
            </runtime.npm_Collapsible_a1.Trigger>
          );
        },
      );
      CollapsibleTrigger.displayName = "Collapsible.Trigger";
      collapsiblePanelClasses =
        "overflow-hidden h-[var(--collapsible-panel-height)] transition-[height] duration-base ease-out motion-reduce:transition-none data-[starting-style]:h-0 data-[ending-style]:h-0";
      CollapsiblePanel = (0, reactComponentsCollapsible.forwardRef)<
        HTMLDivElement,
        CollapsiblePanelProps
      >(
        (
          { className: className, ...props }: CollapsiblePanelProps,
          options: React.ForwardedRef<HTMLDivElement>,
        ): React.ReactElement => (
          <runtime.npm_Collapsible_a1.Panel
            ref={options}
            {...props}
            className={(0, runtime.cn)(collapsiblePanelClasses, className)}
          />
        ),
      );
      CollapsiblePanel.displayName = "Collapsible.Panel";
      ComponentsCollapsibleRootTriggerPanelConfig = {
        Root: CollapsibleRoot,
        Trigger: CollapsibleTrigger,
        Panel: CollapsiblePanel,
      };
    });
  };
}
