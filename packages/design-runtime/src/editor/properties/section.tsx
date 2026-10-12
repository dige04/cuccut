/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";
export function installEditorPropertiesSection(
  runtime: RuntimeBindings,
): () => void {
  var sectionControlWarningShown: Dynamic;
  var sectionTitleWarningShown: Dynamic;
  var reactPropertiesSection: Dynamic;
  var jsxPropertiesSection: Dynamic;
  function PropertySectionHeader({
    title: title,
    actions: actions,
    collapsed: collapsed,
    onToggle: onToggle,
    subsection: subsection,
    className: className,
  }: Dynamic): Dynamic {
    let value: Dynamic = onToggle !== undefined,
      value2: Dynamic = (0, runtime.joinClassNames)(
        "flex min-w-0 shrink-0 items-center gap-xs select-none",
        runtime.PropertiesPrimitivesClassNames_3,
        subsection
          ? "pt-2 pb-1 text-footnote font-semibold text-secondary"
          : "min-h-10 border-t border-alpha-2 py-2 text-body-semibold text-primary first:border-t-0",
        className,
      ),
      value3: Dynamic = value ? (
        <span
          aria-hidden={"true"}
          className={
            "-my-1 flex size-control shrink-0 items-center justify-center"
          }
        >
          <runtime.EditorIcon
            name={"CaretRight"}
            size={16}
            className={(0, runtime.joinClassNames)(
              "text-secondary transition-transform duration-fast",
              !collapsed && "rotate-90",
            )}
          />
        </span>
      ) : null;
    return value && !actions ? (
      <h3 className={"contents"}>
        <button
          type={"button"}
          aria-expanded={!collapsed}
          onClick={onToggle}
          className={(0, runtime.joinClassNames)(
            value2,
            "w-full cursor-default text-left outline-none focus-visible:outline-hidden focus-visible:shadow-focus",
          )}
        >
          <span className={"min-w-0 flex-1 truncate"}>{title}</span>
          {value3}
        </button>
      </h3>
    ) : (
      <div
        onClick={
          value
            ? (event?: Dynamic): Dynamic => {
                (0, runtime.isNestedPropertyControl)(
                  event.currentTarget,
                  event.target,
                ) || onToggle();
              }
            : undefined
        }
        className={(0, runtime.joinClassNames)(
          value2,
          value && "cursor-default",
        )}
      >
        <h3 className={"contents"}>
          {value ? (
            <button
              type={"button"}
              aria-expanded={!collapsed}
              onClick={(input?: Dynamic): Dynamic => {
                input.stopPropagation();
                onToggle();
              }}
              className={
                "-my-1 min-w-0 flex-1 cursor-default truncate rounded-sm py-1 text-left text-inherit outline-none focus-visible:outline-hidden focus-visible:shadow-focus"
              }
            >
              {title}
            </button>
          ) : (
            <span className={"min-w-0 flex-1 truncate"}>{title}</span>
          )}
        </h3>
        {actions ? (
          <span
            className={(0, runtime.joinClassNames)(
              "-my-1 flex shrink-0 items-center gap-0.5",
              runtime.PropertiesPrimitivesClassNames_4,
            )}
            onClick={
              value
                ? (input?: Dynamic): Dynamic => input.stopPropagation()
                : undefined
            }
          >
            {actions}
          </span>
        ) : null}
        {value3}
      </div>
    );
  }
  function warnConflictingSectionControl(): Dynamic {
    sectionControlWarningShown ||
      ((sectionControlWarningShown = true),
      console.error(
        "PropertySection: pass either collapsed/onToggle (controlled) or collapsible/defaultOpen (uncontrolled), not both \u2014 collapsed wins.",
      ));
  }
  function warnMissingSectionTitle(): Dynamic {
    sectionTitleWarningShown ||
      ((sectionTitleWarningShown = true),
      console.error(
        "PropertySection: collapsible needs a title (the header is the toggle) \u2014 ignored on a title-less section.",
      ));
  }
  function PropertySection({
    title: title,
    addItems: addItems,
    addLabel: addLabel,
    defaultAddOpen: defaultAddOpen,
    actions: actions,
    action: action,
    collapsed: collapsed,
    onToggle: onToggle,
    collapsible = false,
    defaultOpen = false,
    subsection: subsection,
    iconColumn = false,
    children: children,
    className: className,
    "data-testid": dataTestid,
  }: Dynamic): Dynamic {
    let value: Dynamic =
        runtime.reactInspectorContext_4.Children.toArray(children).length > 0,
      [value2, value3]: Dynamic = (0, runtime.reactInspectorContext_4.useState)(
        defaultOpen,
      ),
      value4: Dynamic = collapsed !== undefined;
    value4 && collapsible && warnConflictingSectionControl();
    collapsible && title === undefined && warnMissingSectionTitle();
    let value5: Dynamic = !value4 && !!collapsible && title !== undefined,
      value6: Dynamic = value4 ? collapsed : value5 ? !value2 : undefined,
      value7: Dynamic = value5
        ? (): Dynamic => {
            value3((input?: Dynamic): Dynamic => !input);
            onToggle?.();
          }
        : onToggle,
      value8: Dynamic = value6 !== true,
      value9: Dynamic = typeof title == "string" ? title : undefined,
      value10: Dynamic = actions ?? action,
      value11: Dynamic = value10 != null && value10 !== false,
      value12: Dynamic =
        addItems !== undefined && addItems.length > 0 ? (
          <runtime.PropertyActions
            section={value9}
            aria-label={addLabel}
            items={addItems}
            defaultOpen={defaultAddOpen}
          />
        ) : null,
      value13: Dynamic =
        value12 !== null || value11 ? (
          <runtime.jsxPropertiesPrimitives_2.Fragment>
            {value12}
            {value11 ? value10 : null}
          </runtime.jsxPropertiesPrimitives_2.Fragment>
        ) : undefined,
      value14: Dynamic = (0, runtime.joinClassNames)(
        "flex min-w-0 shrink-0 flex-col",
        !subsection && "border-alpha-2 [&:not(:first-child)]:border-t",
        title === undefined && !subsection && "[&:not(:first-child)]:pt-2",
        iconColumn && "[--pp-iconcol:var(--cds-h-control)]",
        className,
      ),
      value15: Dynamic =
        title !== undefined ? (
          <PropertySectionHeader
            title={title}
            actions={value13}
            collapsed={value6}
            onToggle={value7}
            subsection={subsection}
          />
        ) : null,
      value16: Dynamic = (
        <div className={"flex min-w-0 flex-col pb-2"}>{children}</div>
      );
    return value6 !== undefined ? (
      <runtime.ComponentsCollapsibleRootTriggerPanelConfig.Root
        open={value8}
        data-testid={dataTestid}
        className={value14}
      >
        {value15}
        {value ? (
          <runtime.ComponentsCollapsibleRootTriggerPanelConfig.Panel>
            {value16}
          </runtime.ComponentsCollapsibleRootTriggerPanelConfig.Panel>
        ) : null}
      </runtime.ComponentsCollapsibleRootTriggerPanelConfig.Root>
    ) : (
      <div data-testid={dataTestid} className={value14}>
        {value15}
        {value ? value16 : null}
      </div>
    );
  }
  bindRuntimeValue(
    runtime,
    "PropertySectionHeader",
    () => PropertySectionHeader,
  );
  bindRuntimeValue(
    runtime,
    "sectionControlWarningShown",
    () => sectionControlWarningShown,
    (value) => {
      sectionControlWarningShown = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "warnConflictingSectionControl",
    () => warnConflictingSectionControl,
  );
  bindRuntimeValue(
    runtime,
    "sectionTitleWarningShown",
    () => sectionTitleWarningShown,
    (value) => {
      sectionTitleWarningShown = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "warnMissingSectionTitle",
    () => warnMissingSectionTitle,
  );
  bindRuntimeValue(runtime, "PropertySection", () => PropertySection);
  bindRuntimeValue(
    runtime,
    "reactPropertiesSection",
    () => reactPropertiesSection,
    (value) => {
      reactPropertiesSection = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxPropertiesSection",
    () => jsxPropertiesSection,
    (value) => {
      jsxPropertiesSection = value;
    },
  );
  return () => {
    sectionControlWarningShown = false;
    sectionTitleWarningShown = false;
    reactPropertiesSection = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react)(),
      1,
    );
    (0, runtime.initializeCdsIndex)();
    (0, runtime.initializeCdsIndex)();
    (0, runtime.initializeCdsIndex)();
    jsxPropertiesSection = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_jsx_runtime)(),
      1,
    );
  };
}
