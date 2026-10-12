/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";
export function installEditorPropertiesColorPicker(
  runtime: RuntimeBindings,
): () => void {
  var jsxPropertiesColorPicker: Dynamic;
  function ColorPickerWithSwatches({
    value: value,
    unset: unset,
    opaque: opaque,
    onChange: onChange,
    onPickEnd: onPickEnd,
    contrast: contrast,
    swatches: swatches,
    none: none2,
    current: current,
    onSwatch: onSwatch,
    ...props
  }: Dynamic): Dynamic {
    let value2: Dynamic = (0, runtime.reactPropertiesTooltip.useMemo)(
        (): Dynamic =>
          (0, runtime.normalizeColorSwatches)(
            swatches,
            none2 !== undefined,
            none2?.disabledReason,
          ),
        [swatches, none2 !== undefined, none2?.disabledReason],
      ),
      callback: Dynamic = (input?: Dynamic): Dynamic =>
        (0, runtime.hsvaToRgbaHex)({
          ...(0, runtime.parseHsvaColor)(input),
          ...(opaque
            ? {
                a: 1,
              }
            : {}),
        }),
      value3: Dynamic = JSON.stringify(
        value2.map((input?: Dynamic): Dynamic => [input.name, input.color]),
      ),
      value4: Dynamic = (0, runtime.reactPropertiesTooltip.useMemo)(
        (): Dynamic =>
          value2.map(
            (input?: Dynamic): Dynamic =>
              input.empty === true ? null : callback(input.color),
          ),
        [value3, opaque],
      ),
      value5: Dynamic = (0,
      runtime.reactPropertiesTooltip.useMemo)((): Dynamic => {
        if (none2?.current) return runtime.NoneValue;
        if (current !== undefined) return current;
        if (unset) return null;
        let value6: Dynamic = callback(value),
          value7: Dynamic = value4.indexOf(value6);
        return value7 < 0
          ? null
          : (value2[value7].picks ?? value2[value7].name);
      }, [value2, value4, value, unset, opaque, none2?.current, current]);
    return (
      <runtime.ColorSwatchPicker
        {...props}
        swatches={value2}
        current={value5}
        onSwatch={(input?: Dynamic): Dynamic => {
          if (input === runtime.NoneValue) return none2?.onPick();
          if (onSwatch !== undefined) return onSwatch(input);
          let value6: Dynamic = value2.find(
            (input2?: Dynamic): Dynamic => input2.name === input,
          );
          if (value6 === undefined) return;
          let value7: Dynamic = callback(value6.color);
          onChange(value7);
          onPickEnd?.(value7);
          contrast !== undefined &&
            (0, runtime.announce)((): Dynamic => {
              let value8: Dynamic = (0, runtime.evaluateColorContrast)(
                value7,
                contrast,
              );
              return value8 === undefined
                ? null
                : (0, runtime.summarizeContrastResults)(value8).spoken;
            });
        }}
        color={{
          value: value,
          unset: unset,
          opaque: opaque,
          onChange: onChange,
          onPickEnd: onPickEnd,
          contrast: contrast,
        }}
      />
    );
  }
  bindRuntimeValue(
    runtime,
    "ColorPickerWithSwatches",
    () => ColorPickerWithSwatches,
  );
  bindRuntimeValue(
    runtime,
    "jsxPropertiesColorPicker",
    () => jsxPropertiesColorPicker,
    (value) => {
      jsxPropertiesColorPicker = value;
    },
  );
  return () => {
    jsxPropertiesColorPicker = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_jsx_runtime)(),
      1,
    );
  };
}
