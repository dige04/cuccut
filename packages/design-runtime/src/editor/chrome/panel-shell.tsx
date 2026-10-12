/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";
export function installEditorChromePanelShell(
  runtime: RuntimeBindings,
): () => void {
  var reactChromePanelShell: Dynamic;
  var reactDomChromePanelShell: Dynamic;
  var reactChromePanelShell_2: Dynamic;
  var jsxChromePanelShell: Dynamic;
  var ChromePanelShellClassNames: Dynamic;
  var jsxChromePanelShell_2: Dynamic;
  var ChromePanelShellComponent: Dynamic;
  var ChromePanelShellContext: Dynamic;
  var ChromePanelShellContext_2: Dynamic;
  function PanelHeader({
    tabs: tabs,
    activateOnFocus: activateOnFocus,
    tabsLabel: tabsLabel,
    title: title,
    onClose: onClose,
    closeLabel = runtime.CloseValue,
    trailing: trailing,
  }: Dynamic): Dynamic {
    let value: Dynamic = tabs !== undefined && tabs.length > 0;
    return (
      <jsxChromePanelShell.Fragment>
        {value ? (
          <runtime.TabsTabsRootListTabConfig.List
            aria-label={tabsLabel}
            activateOnFocus={activateOnFocus}
            className={"min-w-0 flex-1"}
          >
            {tabs.map(
              (input?: Dynamic): Dynamic =>
                (() => {
                  const _Component = runtime.TabsTabsRootListTabConfig.Tab;
                  const _props = {
                    value: input.value,
                    onClick: input.onClick,
                    "data-testid": input["data-testid"],
                    children: input.label,
                  } as const;
                  const _key = input.value;
                  return <_Component key={_key} {..._props} />;
                })(),
            )}
          </runtime.TabsTabsRootListTabConfig.List>
        ) : title != null && title !== false ? (
          <span
            className={
              "min-w-0 flex-1 truncate pl-[calc(var(--pp-gutter-l,var(--cds-pad-lg))-var(--cds-pad-sm))] text-body-semibold text-primary"
            }
          >
            {title}
          </span>
        ) : (
          <span aria-hidden={"true"} className={"flex-1"} />
        )}
        {trailing}
        {onClose !== undefined ? (
          <runtime.Button
            variant={"ghost"}
            iconOnly={true}
            icon={
              <runtime.Icon
                name={"X"}
                size={"sm"}
                className={"text-secondary"}
              />
            }
            aria-label={closeLabel}
            onClick={onClose}
            className={"relative shrink-0"}
          />
        ) : null}
      </jsxChromePanelShell.Fragment>
    );
  }
  function usePanelTab(input?: Dynamic): Dynamic {
    let [value, value2]: Dynamic = (0, reactChromePanelShell_2.useState)(
      input.tabs?.[0]?.value ?? "",
    );
    return [
      input.tab ?? value,
      (input2?: Dynamic): Dynamic => {
        value2(input2);
        input.onTabChange?.(input2);
      },
    ];
  }
  function PanelShell(input?: Dynamic): Dynamic {
    let {
        tabs: value,
        className: value2,
        "data-testid": value3,
      }: Dynamic = input,
      [value4, value5]: Dynamic = usePanelTab(input);
    return value !== undefined && value.length > 0 ? (
      <runtime.TabsTabsRootListTabConfig.Root
        value={value4}
        onValueChange={(input2?: Dynamic): Dynamic => value5(input2)}
        data-kit={"panel-header"}
        data-testid={value3}
        className={(0, runtime.joinClassNames)(
          ChromePanelShellClassNames,
          value2,
        )}
      >
        <PanelHeader {...input} />
      </runtime.TabsTabsRootListTabConfig.Root>
    ) : (
      <div
        data-kit={"panel-header"}
        data-testid={value3}
        className={(0, runtime.joinClassNames)(
          ChromePanelShellClassNames,
          value2,
        )}
      >
        <PanelHeader {...input} />
      </div>
    );
  }
  bindRuntimeValue(
    runtime,
    "reactChromePanelShell",
    () => reactChromePanelShell,
    (value) => {
      reactChromePanelShell = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactDomChromePanelShell",
    () => reactDomChromePanelShell,
    (value) => {
      reactDomChromePanelShell = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactChromePanelShell_2",
    () => reactChromePanelShell_2,
    (value) => {
      reactChromePanelShell_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxChromePanelShell",
    () => jsxChromePanelShell,
    (value) => {
      jsxChromePanelShell = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ChromePanelShellClassNames",
    () => ChromePanelShellClassNames,
    (value) => {
      ChromePanelShellClassNames = value;
    },
  );
  bindRuntimeValue(runtime, "PanelHeader", () => PanelHeader);
  bindRuntimeValue(runtime, "usePanelTab", () => usePanelTab);
  bindRuntimeValue(runtime, "PanelShell", () => PanelShell);
  bindRuntimeValue(
    runtime,
    "jsxChromePanelShell_2",
    () => jsxChromePanelShell_2,
    (value) => {
      jsxChromePanelShell_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ChromePanelShellComponent",
    () => ChromePanelShellComponent,
    (value) => {
      ChromePanelShellComponent = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ChromePanelShellContext",
    () => ChromePanelShellContext,
    (value) => {
      ChromePanelShellContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ChromePanelShellContext_2",
    () => ChromePanelShellContext_2,
    (value) => {
      ChromePanelShellContext_2 = value;
    },
  );
  return () => {
    (0, runtime.initializeCdsIndex)();
    reactChromePanelShell = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react)(),
      1,
    );
    reactDomChromePanelShell = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_dom)(),
      1,
    );
    reactChromePanelShell_2 = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react)(),
      1,
    );
    (0, runtime.initializeCdsIndex)();
    jsxChromePanelShell = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_jsx_runtime)(),
      1,
    );
    ChromePanelShellClassNames =
      "flex min-w-0 shrink-0 items-center gap-xs py-md pr-sm pl-sm";
    jsxChromePanelShell_2 = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_jsx_runtime)(),
      1,
    );
    ChromePanelShellComponent = (0, reactChromePanelShell.forwardRef)(function (
      input?: Dynamic,
      options?: Dynamic,
    ): Dynamic {
      return (
        <runtime.Button
          ref={options}
          iconOnly={true}
          size={"xs"}
          variant={"ghost"}
          {...input}
        />
      );
    });
    ChromePanelShellContext = (0, reactChromePanelShell.createContext)(null);
    ChromePanelShellContext_2 = (0, reactChromePanelShell.createContext)(null);
  };
}
