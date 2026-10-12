/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";
export function installEditorPropertiesTokenColorPicker(
  runtime: RuntimeBindings,
): () => void {
  var reactPropertiesTokenColorPicker: Dynamic;
  var reactPropertiesTokenColorPicker_2: Dynamic;
  var AssetPickerContext: Dynamic;
  function matchArtboardColorToken(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    let value: Dynamic = (input ?? "").trim();
    if (value === "" || value.length > 128) return;
    let value2: Dynamic = (0, runtime.cssVariableName)(value);
    if (value2 !== null) return value2.replace(/^--/, "");
    if (context === undefined) return;
    let callback: Dynamic = (input2?: Dynamic): Dynamic => {
        let value4: Dynamic =
          (0, runtime.normalizeCssColor)(input2) ??
          (/^[a-z]+$/i.test(input2.trim()) &&
          (0, runtime.PropertiesDropShadowEditorTest)(input2)
            ? input2
            : undefined);
        return value4 === undefined
          ? undefined
          : (0, runtime.hsvaToRgbaCss)((0, runtime.parseHsvaColor)(value4));
      },
      value3: Dynamic = callback(value);
    return value3 === undefined
      ? undefined
      : options
          .find(
            (input2?: Dynamic): Dynamic =>
              input2.name.startsWith("--") &&
              !context.has(input2.name) &&
              callback(
                (0, runtime.resolveColorTokenValue)(input2.value, options) ??
                  input2.value,
              ) === value3,
          )
          ?.name.replace(/^--/, "");
  }
  function editorColorSwatches(input?: Dynamic): Dynamic {
    return input.map((input2?: Dynamic): Dynamic => {
      let value: Dynamic = input2.name.replace(/^--/, "");
      return {
        name: input2.name,
        color:
          (0, runtime.resolveColorTokenValue)(input2.value, input) ??
          input2.value,
        label: value.startsWith("#") ? value.toUpperCase() : value,
        ...(input2.group !== undefined
          ? {
              group: input2.group,
            }
          : {}),
        ...(input2.subgroup !== undefined
          ? {
              subgroup: input2.subgroup,
            }
          : {}),
      };
    });
  }
  function artboardColorSwatchGroup(items?: Dynamic): Dynamic {
    return items.length > 0
      ? {
          label: runtime.InThisArtboardMessage,
          colors: items,
        }
      : undefined;
  }
  function matchAuthoredColorToken(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    if (input === undefined) return null;
    let value: Dynamic = (0, runtime.cssVariableName)(input);
    if (value !== null)
      return options.some((input2?: Dynamic): Dynamic => input2.name === value)
        ? value
        : null;
    if (!(0, runtime.PropertiesDropShadowEditorTest)(input)) return null;
    let value2: Dynamic = (0, runtime.hsvaToRgbaCss)(
        (0, runtime.parseHsvaColor)(input),
      ),
      value3: Dynamic = options.find(
        (input2?: Dynamic): Dynamic =>
          context?.has(input2.picks ?? input2.name) !== true &&
          (0, runtime.hsvaToRgbaCss)(
            (0, runtime.parseHsvaColor)(input2.color),
          ) === value2,
      );
    return value3 === undefined ? null : (value3.picks ?? value3.name);
  }
  function resolveColorSwatchValue(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    let value: Dynamic = options.find(
      (input2?: Dynamic): Dynamic => input2.name === input,
    );
    if (value)
      return context?.has(input) === true
        ? (0, runtime.cssVariableValue)(input)
        : value.color;
  }
  function TokenColorPicker({
    value: value,
    authoredValue: authoredValue,
    onChange: onChange,
    onPickEnd: onPickEnd,
    tokens: tokens2,
    context: context,
    iframeDefinedVars: iframeDefinedVars,
    unset: unset,
    title: title,
    contrast: contrast,
    ...props
  }: Dynamic): Dynamic {
    let value2: Dynamic = (0,
      runtime.reactPropertiesDropShadowEditor_3.useMemo)(
        (): Dynamic =>
          (0, runtime.resolveColorTokenValue)(value, tokens2) ?? value,
        [value, tokens2],
      ),
      value3: Dynamic = (0, runtime.reactPropertiesDropShadowEditor_3.useMemo)(
        (): Dynamic =>
          (0, runtime.mergeDesignSystemSwatches)(
            context,
            editorColorSwatches(tokens2),
          ),
        [tokens2, context],
      ),
      value4: Dynamic = authoredValue ?? (unset ? undefined : value),
      value5: Dynamic = (0, runtime.reactPropertiesDropShadowEditor_3.useMemo)(
        (): Dynamic =>
          matchAuthoredColorToken(value4, value3, iframeDefinedVars),
        [value4, value3, iframeDefinedVars],
      );
    return (
      <div data-testid={"dc-color-picker-body"}>
        <runtime.ColorSwatchPicker
          {...props}
          title={title}
          swatches={value3}
          current={value5}
          repick={unset === true && value5 !== null}
          fold={true}
          onSwatch={(input?: Dynamic): Dynamic => {
            let value6: Dynamic = resolveColorSwatchValue(
              input,
              value3,
              iframeDefinedVars,
            );
            value6 !== undefined && (onChange(value6), onPickEnd?.(value6));
          }}
          color={{
            value: value2 || "#ffffff",
            unset: unset,
            onChange: onChange,
            onPickEnd: onPickEnd,
            contrast: contrast,
          }}
        />
      </div>
    );
  }
  bindRuntimeValue(
    runtime,
    "matchArtboardColorToken",
    () => matchArtboardColorToken,
  );
  bindRuntimeValue(runtime, "editorColorSwatches", () => editorColorSwatches);
  bindRuntimeValue(
    runtime,
    "artboardColorSwatchGroup",
    () => artboardColorSwatchGroup,
  );
  bindRuntimeValue(
    runtime,
    "matchAuthoredColorToken",
    () => matchAuthoredColorToken,
  );
  bindRuntimeValue(
    runtime,
    "resolveColorSwatchValue",
    () => resolveColorSwatchValue,
  );
  bindRuntimeValue(runtime, "TokenColorPicker", () => TokenColorPicker);
  bindRuntimeValue(
    runtime,
    "reactPropertiesTokenColorPicker",
    () => reactPropertiesTokenColorPicker,
    (value) => {
      reactPropertiesTokenColorPicker = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactPropertiesTokenColorPicker_2",
    () => reactPropertiesTokenColorPicker_2,
    (value) => {
      reactPropertiesTokenColorPicker_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "AssetPickerContext",
    () => AssetPickerContext,
    (value) => {
      AssetPickerContext = value;
    },
  );
  return () => {
    reactPropertiesTokenColorPicker = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react)(),
      1,
    );
    (0, runtime.initializeCdsIndex)();
    reactPropertiesTokenColorPicker_2 = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react)(),
      1,
    );
    AssetPickerContext = (0, reactPropertiesTokenColorPicker_2.createContext)({
      projectPath: "appifact",
      canEdit: true,
    });
  };
}
