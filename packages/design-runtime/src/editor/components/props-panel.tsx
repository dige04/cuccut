/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";
export function installEditorComponentsPropsPanel(
  runtime: RuntimeBindings,
): () => void {
  var reactComponentsPropsPanel: Dynamic;
  var ComponentsPropsPanelCategorical1Categorical2Categorical3Values: Dynamic;
  var ComponentsPropsPanelMutedValues: Dynamic;
  function groupComponentProps(input?: Dynamic): Dynamic {
    let items: Dynamic = [],
      entries: Dynamic = new Map(),
      items2: Dynamic = [];
    for (let value of input as Dynamic) {
      let section: Dynamic = value[1].section;
      if (typeof section == "string" && section !== "") {
        let entry: Dynamic = entries.get(section);
        entry ||
          ((entry = []),
          entries.set(section, entry),
          items.push({
            section: section,
            rows: entry,
          }));
        entry.push(value);
      } else items2.push(value);
    }
    return items2.length > 0
      ? [
          {
            section: null,
            rows: items2,
          },
          ...items,
        ]
      : items;
  }
  function ComponentPropsPanel({ dcProps: dcProps }: Dynamic): Dynamic {
    let value: Dynamic = Object.entries(dcProps.propsMeta).filter(
      ([, input]: Dynamic): Dynamic =>
        (0, runtime.isEditablePropMetadata)(input),
    );
    if (value.length === 0)
      return (
        <div className={"px-lg py-4 text-center text-caption text-muted"}>
          {"This component has no tweakable props."}
        </div>
      );
    let value2: Dynamic = groupComponentProps(value);
    return (
      <runtime.jsxPropertiesRows.Fragment>
        <div
          data-testid={"dc-props-panel"}
          data-tweaks-surface={""}
          className={
            "flex min-h-0 flex-col overflow-y-auto pt-1 " +
            runtime.ChromeScrollbarLabel
          }
        >
          {value2.map(
            (input?: Dynamic): Dynamic =>
              (() => {
                const _Component = runtime.PropertySection;
                const _props = {
                  title: input.section ?? undefined,
                  "data-testid":
                    input.section != null ? "dc-props-section" : undefined,
                  children: input.rows.map(
                    ([input2, input3]: Dynamic): Dynamic => (
                      <runtime.ComponentPropInput
                        key={input2}
                        name={input2}
                        meta={input3}
                        value={dcProps.values[input2]}
                        onChange={(input4?: Dynamic): Dynamic =>
                          dcProps.setProp(input2, input4)
                        }
                        tweak={true}
                        onReset={
                          !dcProps.saving &&
                          dcProps.values[input2] !== undefined &&
                          !(0, runtime.equalPropValues)(
                            dcProps.values[input2],
                            input3.default,
                          )
                            ? (): Dynamic => dcProps.setProp(input2, undefined)
                            : undefined
                        }
                      />
                    ),
                  ),
                } as const;
                const _key = input.section ?? "__loose";
                return <_Component key={_key} {..._props} />;
              })(),
          )}
          <runtime.FloatingScrollbar />
        </div>
        {dcProps.dirty && !dcProps.autoSavesDefaults && (
          <div
            data-tweaks-surface={""}
            className={
              "flex shrink-0 justify-end gap-1.5 border-t border-alpha-2 px-md py-3"
            }
          >
            <runtime.Button
              variant={"ghost"}
              onClick={dcProps.reset}
              disabled={dcProps.saving}
            >
              {"Reset"}
            </runtime.Button>
            <runtime.Button
              variant={"primary"}
              busy={dcProps.saving}
              busyLabel={"Saving\u2026"}
              onClick={(): Dynamic => {
                dcProps.saveAsDefaults();
              }}
            >
              {"Save as defaults"}
            </runtime.Button>
          </div>
        )}
      </runtime.jsxPropertiesRows.Fragment>
    );
  }
  bindRuntimeValue(runtime, "groupComponentProps", () => groupComponentProps);
  bindRuntimeValue(runtime, "ComponentPropsPanel", () => ComponentPropsPanel);
  bindRuntimeValue(
    runtime,
    "reactComponentsPropsPanel",
    () => reactComponentsPropsPanel,
    (value) => {
      reactComponentsPropsPanel = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsPropsPanelCategorical1Categorical2Categorical3Values",
    () => ComponentsPropsPanelCategorical1Categorical2Categorical3Values,
    (value) => {
      ComponentsPropsPanelCategorical1Categorical2Categorical3Values = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsPropsPanelMutedValues",
    () => ComponentsPropsPanelMutedValues,
    (value) => {
      ComponentsPropsPanelMutedValues = value;
    },
  );
  return () => {
    reactComponentsPropsPanel = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react)(),
      1,
    );
    ComponentsPropsPanelCategorical1Categorical2Categorical3Values = [
      "categorical-1",
      "categorical-2",
      "categorical-3",
      "categorical-4",
      "categorical-5",
      "categorical-6",
      "categorical-7",
      "categorical-8",
    ];
    ComponentsPropsPanelMutedValues = [
      ...ComponentsPropsPanelCategorical1Categorical2Categorical3Values,
      "muted",
    ];
  };
}
