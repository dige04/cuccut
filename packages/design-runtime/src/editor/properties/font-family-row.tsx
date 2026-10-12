/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";
export function installEditorPropertiesFontFamilyRow(
  runtime: RuntimeBindings,
): () => void {
  var PropertiesFontFamilyRowTest: Dynamic;
  function normalizedFontFamilyOption(input?: Dynamic): Dynamic {
    let entry: Dynamic = runtime.PropertiesAlignmentRowCache.get(
      input.toLowerCase(),
    );
    return entry ? entry.family + ", " + entry.generic : input;
  }
  function fontFamilyPickerOptions(input?: Dynamic): Dynamic {
    let values: Dynamic = new Set(),
      value: Dynamic = [...runtime.PropertiesAlignmentRowCache.values()]
        .map((input2?: Dynamic): Dynamic => input2.family)
        .sort();
    return [
      ...input.map(
        (input2?: Dynamic): Dynamic =>
          runtime.PropertiesAlignmentRowCache.get(input2.toLowerCase())
            ?.family ?? input2,
      ),
      ...value,
    ].flatMap(
      (input2?: Dynamic): Dynamic =>
        values.has(input2.toLowerCase())
          ? []
          : (values.add(input2.toLowerCase()),
            [
              {
                value: input2,
                label: input2,
                labelStyle: PropertiesFontFamilyRowTest(input2),
              },
            ]),
    );
  }
  function PropertyFontFamilyRow({
    state: state,
    onCommit: onCommit,
    pageFonts = [],
    pageWebfonts = [],
    shell: shell,
  }: Dynamic): Dynamic {
    let value: Dynamic = (0, runtime.inspectorFieldDisplay)(state);
    if (!value.isLiteral && value.text)
      return (
        <runtime.PropertyCssTextRow
          state={state}
          onCommit={onCommit}
          shell={shell}
        />
      );
    let value2: Dynamic = (0, runtime.normalizeFontFamilyList)(value.text),
      value3: Dynamic = (0, runtime.displayFontFamily)(value.placeholder),
      value4: Dynamic = fontFamilyPickerOptions(pageFonts),
      value5: Dynamic = (0, runtime.displayFontFamily)(value2),
      value6: Dynamic =
        value2 === ""
          ? undefined
          : value4.find(
              (input?: Dynamic): Dynamic =>
                input.value.toLowerCase() === value5.toLowerCase(),
            ),
      value7: Dynamic =
        value2 !== "" && !value6
          ? [
              {
                value: value2,
                label: value5,
                labelStyle: {
                  fontFamily: value.text,
                },
              },
              ...value4,
            ]
          : value4,
      value8: Dynamic = value2 === "" ? null : (value6?.value ?? value2);
    return (
      <runtime.PropertyRow {...shell}>
        <runtime.PropertySelect
          aria-label={state.label}
          items={value7}
          value={state.mixed ? null : value8}
          placeholder={state.mixed ? "Mixed" : value3 || "\u2014"}
          title={
            value8 === null && !state.mixed && !state.inheritedFrom
              ? "Inherited \u2014 right-click to keep unset"
              : undefined
          }
          disabled={state.disabled}
          searchable={true}
          searchLabel={"Search fonts"}
          onOpenChange={(input?: Dynamic): Dynamic => {
            input &&
              (0, runtime.ensureWebFonts)([
                ...runtime.TypographyFontCatalogMapValue,
                ...pageWebfonts,
              ]);
          }}
          onChange={(input?: Dynamic): Dynamic => {
            input !== value8 &&
              onCommit(
                state.prop,
                input === value2 ? input : normalizedFontFamilyOption(input),
              );
          }}
        />
      </runtime.PropertyRow>
    );
  }
  bindRuntimeValue(
    runtime,
    "normalizedFontFamilyOption",
    () => normalizedFontFamilyOption,
  );
  bindRuntimeValue(
    runtime,
    "PropertiesFontFamilyRowTest",
    () => PropertiesFontFamilyRowTest,
    (value) => {
      PropertiesFontFamilyRowTest = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "fontFamilyPickerOptions",
    () => fontFamilyPickerOptions,
  );
  bindRuntimeValue(
    runtime,
    "PropertyFontFamilyRow",
    () => PropertyFontFamilyRow,
  );
  return () => {
    PropertiesFontFamilyRowTest = (input?: Dynamic): Dynamic =>
      runtime.TypographyFontCatalogSerifSansSerifPattern.test(input)
        ? {
            fontFamily: input,
          }
        : /^[\w .-]+$/.test(input)
          ? {
              fontFamily: `'${input}', sans-serif`,
            }
          : undefined;
  };
}
