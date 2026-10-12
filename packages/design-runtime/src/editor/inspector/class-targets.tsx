/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";
export function installEditorInspectorClassTargets(
  runtime: RuntimeBindings,
): () => void {
  var InspectorClassTargetsLimit: Dynamic;
  var InspectorClassTargetsLabel: Dynamic;
  var jsxInspectorClassTargets: Dynamic;
  var InspectorClassTargetsDataDcDataScPattern: Dynamic;
  function isTextStyleProperty(input?: Dynamic, options?: Dynamic): Dynamic {
    return (
      runtime.InspectorAnnotationFontFontSizeFontWeightSet.has(input) &&
      runtime.InspectorAnnotationLargerSmallerPattern.test(options)
    );
  }
  function sharedInheritedTextStyle(input?: Dynamic, items?: Dynamic): Dynamic {
    if (items.length === 0 || items.length > InspectorClassTargetsLimit)
      return [];
    let value: Dynamic = items.map(
        (input2?: Dynamic): Dynamic => input.inheritedTextStyle?.(input2) ?? [],
      ),
      value2: Dynamic = value[0];
    if (
      value.some(
        (input2?: Dynamic): Dynamic =>
          JSON.stringify(input2) !== JSON.stringify(value2),
      )
    )
      return [];
    let items2: Dynamic = [];
    for (let value3 of value2 as Dynamic) {
      let value4: Dynamic = items2.at(-1),
        value5: Dynamic = value3.value
          .replace(/\s+/g, " ")
          .replace(/\s*!\s*important\s*$/i, "");
      value4 && value4.from === value3.from && value4.fromTid === value3.fromTid
        ? value4.decls.push({
            prop: value3.prop,
            value: value5,
          })
        : items2.push({
            from: value3.from,
            fromTid: value3.fromTid,
            decls: [
              {
                prop: value3.prop,
                value: value5,
              },
            ],
          });
    }
    return items2;
  }
  function findInspectorOutlineNode(
    input?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    for (let value of (input ?? []) as Dynamic) {
      if (value.tid === options) return value;
      let value2: Dynamic = findInspectorOutlineNode(value.children, options);
      if (value2) return value2;
    }
    return null;
  }
  function ClassStyleTargets({
    groups: groups,
    outline: outline,
    many = false,
    lockFor: lockFor,
    onSet: onSet,
    onSelectTid: onSelectTid,
    onHoverTid: onHoverTid,
  }: Dynamic): Dynamic {
    let value: Dynamic = (0, runtime.reactInspectorAnnotation_2.useRef)(
      onHoverTid,
    );
    value.current = onHoverTid;
    (0, runtime.reactInspectorAnnotation_2.useEffect)(
      (): Dynamic => (): Dynamic => value.current?.(null),
      [],
    );
    if (groups.length === 0) return null;
    let value2: Dynamic = many ? "these elements" : "this element";
    return (
      <runtime.CdsIsland density={"compact"} className={"contents"}>
        <div
          data-testid={"dc-code-inherited"}
          className={
            "flex flex-col gap-2 border-t px-3.5 pt-2.5 pb-3 text-footnote"
          }
          onKeyDown={(input?: Dynamic): Dynamic => {
            !input.metaKey &&
              !input.ctrlKey &&
              !input.altKey &&
              input.key !== "Tab" &&
              input.key !== "Escape" &&
              input.stopPropagation();
          }}
        >
          {groups.map((input?: Dynamic): Dynamic => {
            let value3: Dynamic =
                input.fromTid != null
                  ? findInspectorOutlineNode(outline, input.fromTid)
                  : null,
              value4: Dynamic = value3?.glyph
                ? runtime.ChromeToolIconsColumnRowTextConfig[value3.glyph]
                : undefined,
              value5: Dynamic = value4 ? (
                value4.custom ? (
                  <runtime.Icon customIcon={value4.custom} size={"sm"} />
                ) : (
                  <runtime.Icon name={value4.name} size={"sm"} />
                )
              ) : undefined;
            return (() => {
              const _Component2 = "div";
              const _props2 = {
                role: "group",
                "aria-label": "From " + input.from,
                className: "flex min-w-0 flex-col",
                children: [
                  <div className={"flex min-w-0 items-center gap-1 text-muted"}>
                    <span className={"shrink-0"}>{"From"}</span>
                    {input.fromTid != null && onSelectTid ? (
                      <runtime.EditorTooltip
                        tip={"Select " + input.from}
                        className={"min-w-0"}
                      >
                        <runtime.Button
                          variant={"ghost"}
                          size={"xs"}
                          icon={value5}
                          aria-label={"Select " + input.from}
                          className={
                            "min-w-0 font-mono " + InspectorClassTargetsLabel
                          }
                          onClick={(): Dynamic => {
                            onHoverTid?.(null);
                            onSelectTid(input.fromTid);
                          }}
                          onMouseEnter={(): Dynamic =>
                            onHoverTid?.(input.fromTid)
                          }
                          onMouseLeave={(): Dynamic => onHoverTid?.(null)}
                          onFocus={(): Dynamic => onHoverTid?.(input.fromTid)}
                          onBlur={(): Dynamic => onHoverTid?.(null)}
                        >
                          {input.from}
                        </runtime.Button>
                      </runtime.EditorTooltip>
                    ) : (
                      <span
                        className={
                          "min-w-0 truncate px-1.5 font-mono text-secondary"
                        }
                      >
                        {input.from}
                      </span>
                    )}
                  </div>,
                  input.decls.map((input2?: Dynamic): Dynamic => {
                    let value6: Dynamic =
                        input2.prop === "color"
                          ? (0, runtime.normalizeCssColor)(input2.value)
                          : undefined,
                      value7: Dynamic = lockFor(input2.prop, input2.value);
                    return (() => {
                      const _Component = "div";
                      const _props = {
                        "data-testid": "dc-code-inherited-" + input2.prop,
                        className:
                          "flex h-control min-w-0 items-center gap-2 pl-2 font-mono text-[11.5px] pointer-coarse:h-10",
                        children: [
                          <span
                            className={
                              "w-[6.25rem] shrink-0 truncate text-muted"
                            }
                          >
                            {input2.prop}
                          </span>,
                          value6 !== undefined && (
                            <runtime.ColorWellFace
                              hex={value6.slice(0, 7)}
                              alpha={
                                value6.length === 9
                                  ? (parseInt(value6.slice(7), 16) / 255) * 100
                                  : 100
                              }
                            />
                          ),
                          <span
                            className={
                              "min-w-0 flex-1 truncate text-secondary select-text"
                            }
                            title={input2.value}
                          >
                            {input2.value}
                          </span>,
                          <runtime.Button
                            variant={"ghost"}
                            size={"xs"}
                            iconOnly={true}
                            icon={"Add"}
                            data-inherited-set={""}
                            aria-label={"Set " + input2.prop + " on " + value2}
                            tooltip={"Set on " + value2}
                            disabled={value7 !== undefined}
                            disabledReason={value7 ?? "Set on " + value2}
                            className={"shrink-0 " + InspectorClassTargetsLabel}
                            onClick={(): Dynamic =>
                              onSet(input2.prop, input2.value)
                            }
                          />,
                        ],
                      } as const;
                      const _key = input2.prop;
                      return <_Component key={_key} {..._props} />;
                    })();
                  }),
                ],
              } as const;
              const _key2 = input.from + ":" + String(input.fromTid);
              return <_Component2 key={_key2} {..._props2} />;
            })();
          })}
        </div>
      </runtime.CdsIsland>
    );
  }
  bindRuntimeValue(runtime, "isTextStyleProperty", () => isTextStyleProperty);
  bindRuntimeValue(
    runtime,
    "InspectorClassTargetsLimit",
    () => InspectorClassTargetsLimit,
    (value) => {
      InspectorClassTargetsLimit = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "sharedInheritedTextStyle",
    () => sharedInheritedTextStyle,
  );
  bindRuntimeValue(
    runtime,
    "findInspectorOutlineNode",
    () => findInspectorOutlineNode,
  );
  bindRuntimeValue(
    runtime,
    "InspectorClassTargetsLabel",
    () => InspectorClassTargetsLabel,
    (value) => {
      InspectorClassTargetsLabel = value;
    },
  );
  bindRuntimeValue(runtime, "ClassStyleTargets", () => ClassStyleTargets);
  bindRuntimeValue(
    runtime,
    "jsxInspectorClassTargets",
    () => jsxInspectorClassTargets,
    (value) => {
      jsxInspectorClassTargets = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "InspectorClassTargetsDataDcDataScPattern",
    () => InspectorClassTargetsDataDcDataScPattern,
    (value) => {
      InspectorClassTargetsDataDcDataScPattern = value;
    },
  );
  return () => {
    InspectorClassTargetsLimit = 20;
    InspectorClassTargetsLabel = "pointer-coarse:h-10 pointer-coarse:min-w-10";
    jsxInspectorClassTargets = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_jsx_runtime)(),
      1,
    );
    InspectorClassTargetsDataDcDataScPattern =
      /^(data-dc-|data-sc-|sc-camel-|style$)/;
  };
}
