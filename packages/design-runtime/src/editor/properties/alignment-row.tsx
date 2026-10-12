/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";
export function installEditorPropertiesAlignmentRow(
  runtime: RuntimeBindings,
): () => void {
  var PropertiesAlignmentRowSansSerifMonoConfig: Dynamic;
  var PropertiesAlignmentRowCache: Dynamic;
  function alignmentOptionIcon(input?: Dynamic, options?: Dynamic): Dynamic {
    if (input === "text-align")
      return (
        {
          left: runtime.TextAlignLeftValue,
          center: runtime.TextAlignCenterValue,
          right: runtime.TextAlignRightValue,
          justify: runtime.TextAlignJustifyValue,
        } as Dynamic
      )[options];
    if (
      input === "justify-content" ||
      input === "justify-items" ||
      input === "justify-self"
    )
      return (
        runtime.PropertiesSizingRowFlexStartStartCenterConfig[options] ??
        runtime.PropertiesSizingRowFlexStartStartCenterConfig_2[options]
      );
    if (input === "align-items" || input === "align-self")
      return runtime.PropertiesSizingRowFlexStartStartCenterConfig_2[options];
  }
  function PropertyAlignmentRow({
    state: state,
    onCommit: onCommit,
    shell: shell,
  }: Dynamic): Dynamic {
    if (
      (0, runtime.classifyStyleValue)(state.value).kind !== "literal" &&
      (state.value ?? "").trim()
    )
      return (
        <runtime.PropertyCssTextRow
          state={state}
          onCommit={onCommit}
          shell={shell}
        />
      );
    let value: Dynamic = state.companionMixed ?? false,
      value2: Dynamic = (state.companionValue ?? "").trim(),
      value3: Dynamic =
        value2 && (0, runtime.classifyStyleValue)(value2).kind === "literal"
          ? value2
          : "",
      value4: Dynamic = value
        ? ""
        : value3 || (state.companionFallback ?? "").trim(),
      values: Dynamic = new Set(
        value4
          .split(/\s+/)
          .filter((input?: Dynamic): Dynamic => input && input !== "none"),
      ),
      callback: Dynamic = (input?: Dynamic): Dynamic => {
        let values2: Dynamic = new Set(values);
        values2.has(input) ? values2.delete(input) : values2.add(input);
        onCommit(
          "text-decoration-line",
          values2.size ? [...values2].join(" ") : "none",
        );
      },
      value5: Dynamic = value3 !== "",
      callback2: Dynamic = (
        input?: Dynamic,
        options?: Dynamic,
        context?: Dynamic,
        value6?: Dynamic,
        extra?: Dynamic,
        detail: Dynamic = true,
      ): Dynamic => (
        <runtime.Button
          iconOnly={true}
          icon={value6}
          aria-label={context}
          pressed={input && !options}
          tooltip={
            options
              ? `${context} \u2014 mixed`
              : input && !detail
                ? `${context} (inherited)`
                : context
          }
          disabled={state.disabled}
          data-testid={`dc-typestyle-${context.toLowerCase()}`}
          data-inherited={input && !options && !detail ? "" : undefined}
          className={(0, runtime.cn)(options && "opacity-45")}
          onClick={extra}
        />
      );
    return (
      <runtime.PropertyRow {...shell}>
        <runtime.ButtonGroup
          aria-label={state.label}
          variant={"joined"}
          buttonVariant={"secondary"}
        >
          {callback2(
            values.has("underline"),
            value,
            "Underline",
            "TextUnderline",
            (): Dynamic => callback("underline"),
            value5,
          )}
          {callback2(
            values.has("line-through"),
            value,
            "Strikethrough",
            <span
              aria-hidden={true}
              style={{
                fontSize: 13,
                lineHeight: 1,
                textDecoration: "line-through",
              }}
            >
              {"S"}
            </span>,
            (): Dynamic => callback("line-through"),
            value5,
          )}
        </runtime.ButtonGroup>
      </runtime.PropertyRow>
    );
  }
  function PropertyCssSegmentsRow({
    state: state,
    onCommit: onCommit,
    shell: shell,
  }: Dynamic): Dynamic {
    let { text: value, isLiteral: value2 }: Dynamic = (0,
    runtime.inspectorFieldDisplay)(state);
    if (!value2 && value)
      return (
        <runtime.PropertyCssTextRow
          state={state}
          onCommit={onCommit}
          shell={shell}
        />
      );
    let value3: Dynamic = state.spec?.options ?? [],
      value4: Dynamic = value || "",
      value5: Dynamic = state.fallback ?? "",
      value6: Dynamic =
        value4 ||
        (state.mixed
          ? ""
          : value5 === "normal" || value5 === "legacy"
            ? (state.spec?.defaultValue ?? "")
            : state.prop === "text-align" &&
                (value5 === "start" || value5 === "end")
              ? value5 === "start"
                ? "left"
                : "right"
              : value5),
      value7: Dynamic = (
        {
          "justify-content": ["flex-start", "center", "flex-end"],
          "justify-items": ["start", "center", "end"],
          "align-items": ["flex-start", "center", "flex-end"],
          "flex-direction": ["row", "column"],
        } as Dynamic
      )[state.prop],
      value8: Dynamic = value7
        ? [
            ...value7,
            ...(state.prop === "align-items" &&
            (value4 === "baseline" || (!value4 && value6 === "baseline"))
              ? ["baseline"]
              : []),
          ]
        : value3,
      value9: Dynamic = value8.every(
        (input?: Dynamic): Dynamic =>
          alignmentOptionIcon(state.prop, input) != null ||
          input === "auto" ||
          runtime.PropertiesTransformRowRowColumnRowReverseConfig[input] !=
            null,
      );
    if (!value9 && value3.length > 4)
      return (
        <runtime.PropertyCssEnumRow
          state={{
            ...state,
            fallback: value4 ? state.fallback : value6,
          }}
          onCommit={onCommit}
          shell={shell}
        />
      );
    let value10: Dynamic =
        (state.flexDirection ?? "row").startsWith("column") &&
        (state.prop === "justify-content" ||
          state.prop === "align-items" ||
          state.prop === "justify-items"),
      value11: Dynamic = (state.fallback ?? "").trim().toLowerCase(),
      callback: Dynamic = (input?: Dynamic): Dynamic =>
        value7
          ? input === "" ||
            input === "normal" ||
            input === "stretch" ||
            input === "start" ||
            input === "self-start" ||
            input === "left"
            ? value8[0]
            : input === "end" || input === "self-end" || input === "right"
              ? value8[
                  value8.length - 1 - (value8.includes("baseline") ? 1 : 0)
                ]
              : undefined
          : undefined,
      value12: Dynamic =
        value7 && !value8.includes(value6) && !value4 && !state.inheritedFrom
          ? (callback(value11) ?? value6)
          : value6,
      value13: Dynamic = !value4 && !state.mixed && value8.includes(value12),
      value14: Dynamic = value9 && value8.length > 4,
      value15: Dynamic = (
        <runtime.PropertySegments
          label={state.label}
          options={value8.map(
            (input?: Dynamic): Dynamic => ({
              value: input,
              label: (0, runtime.propertyOptionLabel)(state.spec, input),
              tooltip: `${state.label}: ${(0, runtime.propertyOptionLabel)(state.spec, input)}`,
              icon: runtime.PropertiesTransformRowRowColumnRowReverseConfig[
                input
              ],
              glyph: alignmentOptionIcon(state.prop, input),
            }),
          )}
          value={value4 || undefined}
          inherited={value13 ? value12 : undefined}
          inheritedHint={
            state.disabled ? "inherited" : "inherited \u2014 click to set"
          }
          mixed={state.mixed}
          disabled={state.disabled}
          vertical={value10}
          onChange={(input?: Dynamic): Dynamic => onCommit(state.prop, input)}
          data-testid={value13 ? `dc-seg-inherited-${state.prop}` : undefined}
        />
      );
    return value14 ? (
      <div className={"contents"} data-testid={shell["data-testid"]}>
        <runtime.PropertyRow
          {...shell}
          description={undefined}
          data-testid={undefined}
          className={"min-h-0 pt-1"}
        />
        <runtime.PropertyRow
          title={shell.title}
          description={shell.description}
        >
          {value15}
        </runtime.PropertyRow>
      </div>
    ) : (
      <runtime.PropertyRow {...shell}>{value15}</runtime.PropertyRow>
    );
  }
  bindRuntimeValue(runtime, "alignmentOptionIcon", () => alignmentOptionIcon);
  bindRuntimeValue(runtime, "PropertyAlignmentRow", () => PropertyAlignmentRow);
  bindRuntimeValue(
    runtime,
    "PropertyCssSegmentsRow",
    () => PropertyCssSegmentsRow,
  );
  bindRuntimeValue(
    runtime,
    "PropertiesAlignmentRowSansSerifMonoConfig",
    () => PropertiesAlignmentRowSansSerifMonoConfig,
    (value) => {
      PropertiesAlignmentRowSansSerifMonoConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PropertiesAlignmentRowCache",
    () => PropertiesAlignmentRowCache,
    (value) => {
      PropertiesAlignmentRowCache = value;
    },
  );
  return () => {
    PropertiesAlignmentRowSansSerifMonoConfig = {
      sans: "sans-serif",
      serif: "serif",
      mono: "monospace",
    };
    PropertiesAlignmentRowCache = new Map(
      [
        ...runtime.TypographyFontCatalogItems,
        ...runtime.TypographyFontCatalogItems_2,
      ].map(
        (input?: Dynamic): Dynamic => [
          input.family.toLowerCase(),
          {
            family: input.family,
            generic: PropertiesAlignmentRowSansSerifMonoConfig[input.generic],
          },
        ],
      ),
    );
  };
}
