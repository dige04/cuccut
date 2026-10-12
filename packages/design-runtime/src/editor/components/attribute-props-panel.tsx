/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";
export function installEditorComponentsAttributePropsPanel(
  runtime: RuntimeBindings,
): () => void {
  function inferComponentAttributeMetadata(input?: Dynamic): Dynamic {
    let state: Dynamic = {};
    for (let [value, value2] of Object.entries(input) as Dynamic) {
      if (runtime.ComponentsImportsComponentFromGlobalScopePattern.test(value))
        continue;
      let value3: Dynamic = value2
          .match(runtime.PropertiesInspectorFieldPattern)?.[1]
          ?.trim(),
        value4: Dynamic =
          value3 === "true" || value3 === "false" || value3 === "yes"
            ? "boolean"
            : value3 != null &&
                runtime.PropertiesInspectorFieldPattern_2.test(value3)
              ? "float"
              : "text";
      state[value] = {
        editor: value4,
      };
    }
    return state;
  }
  function mergeComponentAttributeValues(input?: Dynamic): Dynamic {
    let value: Dynamic = Object.assign({}, ...[...input].reverse());
    for (let value2 of input as Dynamic)
      for (let [value3, value4] of Object.entries(value2) as Dynamic)
        parseComponentAttributeValue(
          value4,
          {
            editor: "text",
          },
          true,
        ).bound && (value[value3] = value4);
    return value;
  }
  function mixedComponentAttributeKeys(input?: Dynamic): Dynamic {
    let values: Dynamic = new Set();
    for (let value of new Set(
      input.flatMap((input2?: Dynamic): Dynamic => Object.keys(input2)),
    ) as Dynamic)
      input.some(
        (input2?: Dynamic): Dynamic => input2[value] !== input[0][value],
      ) && values.add(value);
    return values;
  }
  function useInferredComponentMetadata(
    input?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    let value: Dynamic = (0, runtime.reactPropertiesDropShadowEditor.useRef)({
      selKey: "",
      meta: {},
    });
    value.current.selKey !== input &&
      (value.current = {
        selKey: input,
        meta: {},
      });
    value.current.meta = {
      ...value.current.meta,
      ...inferComponentAttributeMetadata(options),
    };
    return value.current.meta;
  }
  function resolveComponentAttributeName(
    input?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    return Object.hasOwn(options, input)
      ? input
      : input.replace(
          /[A-Z]/g,
          (input2?: Dynamic): Dynamic => "-" + input2.toLowerCase(),
        );
  }
  function parseComponentAttributeValue(
    input?: Dynamic,
    options?: Dynamic,
    context: Dynamic = false,
  ): Dynamic {
    if (input == null)
      return {
        value: undefined,
        bound: false,
      };
    let value: Dynamic = input.match(runtime.PropertiesInspectorFieldPattern);
    if (value && !value[1].includes("{{")) {
      let value2: Dynamic = value[1].trim();
      if (value2 === "true")
        return {
          value: true,
          bound: false,
        };
      if (value2 === "false")
        return {
          value: false,
          bound: false,
        };
      if (context && value2 === "yes")
        return {
          value: true,
          bound: false,
        };
      if (runtime.PropertiesInspectorFieldPattern_2.test(value2))
        return {
          value: Number(value2),
          bound: false,
        };
      let value3: Dynamic = value2.match(/^(['"])([\s\S]*)\1$/);
      return value3
        ? {
            value: value3[2],
            bound: false,
          }
        : {
            value: undefined,
            bound: true,
          };
    }
    if (input.includes("{{"))
      return {
        value: undefined,
        bound: true,
      };
    if (options.editor === "boolean")
      return {
        value: input !== "false" && input !== "",
        bound: false,
      };
    if (
      options.editor === "int" ||
      options.editor === "float" ||
      options.editor === "range"
    ) {
      let value2: Dynamic = Number(input);
      return {
        value: Number.isFinite(value2) ? value2 : undefined,
        bound: false,
      };
    }
    return {
      value: input,
      bound: false,
    };
  }
  function serializeComponentAttributeValue(input?: Dynamic): Dynamic {
    return input == null || Array.isArray(input)
      ? null
      : typeof input == "boolean" || typeof input == "number"
        ? `{{ ${input} }}`
        : String(input);
  }
  function normalizeComponentColorOptions(input?: Dynamic): Dynamic {
    if (input.editor !== "color" || !Array.isArray(input.options)) return input;
    let value: Dynamic = input.options.filter(
      (input2?: Dynamic): Dynamic => !Array.isArray(input2),
    );
    return value.length === input.options.length
      ? input
      : {
          ...input,
          options: value,
        };
  }
  function ComponentImportPropsPanel({
    importName: importName,
    propsMeta: propsMeta,
    attrs: attrs,
    disabled: disabled2,
    onCommit: onCommit,
    onEditComponent: onEditComponent,
    refKeys = runtime.PropertiesInspectorFieldNameComponentFromSet,
    emptyNote: emptyNote,
    schemaless = false,
    declared: declared,
    onEditInCode: onEditInCode,
    mixed: mixed,
  }: Dynamic): Dynamic {
    let value: Dynamic = Object.entries(declared ?? {}).filter(
        ([input, input2]: Dynamic): Dynamic =>
          (0, runtime.isEditablePropMetadata)(input2) &&
          !runtime.ComponentsImportsComponentFromGlobalScopePattern.test(
            input,
          ) &&
          !runtime.ComponentsImportsComponentFromGlobalScopePattern.test(
            resolveComponentAttributeName(input, attrs),
          ),
      ),
      callback: Dynamic = (input?: Dynamic): Dynamic =>
        runtime.PropertiesInspectorFieldPattern_3.test(input) &&
        parseComponentAttributeValue(
          attrs[resolveComponentAttributeName(input, attrs)],
          {},
          true,
        ).bound,
      items: Dynamic = [
        ...value,
        ...Object.entries(propsMeta).filter(
          ([input, input2]: Dynamic): Dynamic =>
            (0, runtime.isEditablePropMetadata)(input2) &&
            !refKeys.has(input) &&
            !(
              declared &&
              (Object.hasOwn(declared, input) ||
                Object.hasOwn(
                  declared,
                  (0, runtime.PropertiesInspectorFieldReplace)(input),
                ))
            ) &&
            !callback(input),
        ),
      ];
    return !onEditComponent && items.length === 0 && !emptyNote ? null : (
      <runtime.PropertySection title={`${importName} props`}>
        {items.length === 0 && emptyNote && (
          <div
            className={"px-3.5 pt-3 pb-1 text-caption text-muted"}
            data-testid={"dc-import-props-empty"}
          >
            {emptyNote}
          </div>
        )}
        {onEditComponent && (
          <div className={"flex flex-col items-stretch gap-1 pt-3 px-3.5 pb-1"}>
            <runtime.Button
              variant={"secondary"}
              onClick={onEditComponent}
              data-testid={"dc-edit-imported-component"}
            >
              {disabled2 ? "Open" : "Edit"} {importName}
              {" \u2192"}
            </runtime.Button>
            <span className={"text-caption text-muted"}>
              {"Opens the "}
              {importName}
              {" artboard."}
            </span>
          </div>
        )}
        {items.length > 0 && (
          <div
            data-testid={"dc-import-props"}
            className={disabled2 ? "opacity-60" : "contents"}
            title={
              disabled2 ? runtime.ViewOnlyYouCanInspectThisMessage : undefined
            }
            aria-disabled={disabled2 || undefined}
          >
            <div className={"contents"} inert={disabled2}>
              {items.map(
                ([input, input2]: Dynamic, options?: Dynamic): Dynamic => {
                  let value2: Dynamic = options < value.length,
                    value3: Dynamic =
                      schemaless && !value2
                        ? input
                        : resolveComponentAttributeName(input, attrs),
                    { value: value4, bound: value5 }: Dynamic =
                      parseComponentAttributeValue(
                        attrs[value3],
                        input2,
                        schemaless,
                      ),
                    value6: Dynamic =
                      schemaless &&
                      (value2
                        ? runtime.PropertiesInspectorFieldPattern_3
                        : /^on/i
                      ).test(value3),
                    value7: Dynamic =
                      input2.default != null
                        ? String(input2.default)
                        : (input2.tsType ?? ""),
                    value8: Dynamic =
                      schemaless && !value2
                        ? (0, runtime.PropertiesInspectorFieldTest)(input)
                        : input;
                  if (value5 || value6) {
                    let value10: Dynamic = attrs[value3] ?? "",
                      value11: Dynamic = value10.match(
                        runtime.PropertiesInspectorFieldPattern,
                      )?.[1],
                      value12: Dynamic =
                        value11 !== undefined && !value11.includes("{{")
                          ? value11.trim()
                          : value10,
                      value13: Dynamic = /^on/i.test(value3),
                      value14: Dynamic = value13 && !value5,
                      value15: Dynamic = mixed?.has(value3) === true,
                      value16: Dynamic =
                        !value13 &&
                        !value15 &&
                        !disabled2 &&
                        onEditInCode !== undefined,
                      value17: Dynamic = value14
                        // CucCut: user-facing copy calls the agent "the agent", not Claude.
                        ? "This attribute can\u2019t be edited here. Ask the agent in chat to change it."
                        : value15 &&
                            !value13 &&
                            !disabled2 &&
                            onEditInCode !== undefined
                          ? "The selected instances set this differently. Select one to open it in Code."
                          : "Set by the page\u2019s script." +
                            (value16
                              ? " Click to open it in Code."
                              : value13
                                ? " Ask the agent in chat to change it."
                                : "");
                    return (
                      <runtime.PropertyTextRow
                        key={input}
                        label={value8}
                        title={value17}
                        disabled={value13 || value15}
                      >
                        <runtime.PropertyPickerButton
                          className={"w-full"}
                          data-testid={"dc-import-prop-bound"}
                          title={value17}
                          aria-label={`${value8}: ${value12 || "not set"}`}
                          muted={value12 === ""}
                          disabled={!value16}
                          onClick={
                            value16
                              ? (): Dynamic => onEditInCode(value3)
                              : undefined
                          }
                          chip={
                            value14 ? undefined : (
                              <runtime.Icon
                                name={"CodeBrackets"}
                                size={"sm"}
                                className={"ml-1 shrink-0 text-muted"}
                              />
                            )
                          }
                        >
                          {value12 || "\u2014"}
                        </runtime.PropertyPickerButton>
                      </runtime.PropertyTextRow>
                    );
                  }
                  let value9: Dynamic =
                    (!schemaless || value2) &&
                    !disabled2 &&
                    attrs[value3] !== undefined
                      ? (): Dynamic => onCommit(value3, null)
                      : undefined;
                  return schemaless && (input2.editor ?? "text") === "text" ? (
                    <runtime.PropertyTextRow
                      key={input}
                      label={value8}
                      onReset={value9}
                      onPress={(element?: Dynamic): Dynamic =>
                        element.querySelector("input")?.focus()
                      }
                    >
                      <runtime.PropertyTextInput
                        display={attrs[value3] ?? ""}
                        placeholder={""}
                        hint={value7}
                        aria-label={value8}
                        disabled={disabled2}
                        onCommitText={(input3?: Dynamic): Dynamic =>
                          onCommit(value3, input3 === "" ? null : input3)
                        }
                      />
                    </runtime.PropertyTextRow>
                  ) : (
                    <runtime.ComponentPropInput
                      key={input}
                      name={value8}
                      meta={normalizeComponentColorOptions(input2)}
                      value={value4}
                      unsetHint={value2 ? value7 || "\u2014" : undefined}
                      onChange={(input3?: Dynamic): Dynamic => {
                        disabled2 ||
                          onCommit(
                            value3,
                            serializeComponentAttributeValue(input3),
                          );
                      }}
                      onReset={value9}
                    />
                  );
                },
              )}
            </div>
          </div>
        )}
      </runtime.PropertySection>
    );
  }
  bindRuntimeValue(
    runtime,
    "inferComponentAttributeMetadata",
    () => inferComponentAttributeMetadata,
  );
  bindRuntimeValue(
    runtime,
    "mergeComponentAttributeValues",
    () => mergeComponentAttributeValues,
  );
  bindRuntimeValue(
    runtime,
    "mixedComponentAttributeKeys",
    () => mixedComponentAttributeKeys,
  );
  bindRuntimeValue(
    runtime,
    "useInferredComponentMetadata",
    () => useInferredComponentMetadata,
  );
  bindRuntimeValue(
    runtime,
    "resolveComponentAttributeName",
    () => resolveComponentAttributeName,
  );
  bindRuntimeValue(
    runtime,
    "parseComponentAttributeValue",
    () => parseComponentAttributeValue,
  );
  bindRuntimeValue(
    runtime,
    "serializeComponentAttributeValue",
    () => serializeComponentAttributeValue,
  );
  bindRuntimeValue(
    runtime,
    "normalizeComponentColorOptions",
    () => normalizeComponentColorOptions,
  );
  bindRuntimeValue(
    runtime,
    "ComponentImportPropsPanel",
    () => ComponentImportPropsPanel,
  );
  return () => {};
}
