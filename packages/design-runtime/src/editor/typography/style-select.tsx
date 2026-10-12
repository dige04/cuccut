/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";
export function installEditorTypographyStyleSelect(
  runtime: RuntimeBindings,
): () => void {
  function TypographyStyleSelect({
    model: model,
    attached: attached,
    disabled: disabled2,
    onApply: onApply,
    onDetach: onDetach,
  }: Dynamic): Dynamic {
    let value: Dynamic = model.options.map(
      (input?: Dynamic): Dynamic => ({
        value: input.value,
        label: input.text,
        hint: input.hint,
        labelStyle: input.labelStyle,
        ...(input.group !== undefined
          ? {
              group: input.group,
            }
          : {}),
        ...(input.subgroup !== undefined
          ? {
              subgroup: input.subgroup,
            }
          : {}),
        ...(input.title !== undefined
          ? {
              title: input.title,
            }
          : {}),
      }),
    );
    return (
      <runtime.PropertySelectRow
        label={"Text style"}
        icon={attached ? "TextAa" : undefined}
        options={value}
        value={attached ? (model.value ?? "") : ""}
        placeholder={model.mixed ? "Mixed" : attached ? "" : "Custom"}
        title={
          value.length === 0
            ? "No type styles in this design system"
            : !attached && !model.mixed && model.matchedName !== null
              ? "Custom \u2014 matches " + model.matchedName
              : undefined
        }
        searchable={true}
        searchLabel={"Search styles"}
        disabled={disabled2 || value.length === 0}
        trailing={
          attached ? (
            <runtime.Button
              variant={"ghost"}
              iconOnly={true}
              icon={"Minus"}
              aria-label={"Detach from the text style"}
              tooltip={
                "Detach \u2014 edit font, weight, size, line height and letter spacing on this text"
              }
              data-testid={"dc-text-detach"}
              disabled={disabled2}
              onClick={onDetach}
            />
          ) : undefined
        }
        onChange={(input?: Dynamic): Dynamic => onApply(model.editsFor(input))}
      />
    );
  }
  function TypographyVariantSelect({
    value: value,
    mixed: mixed,
    disabled: disabled2,
    disabledReason: disabledReason,
    onChange: onChange,
    onReset: onReset,
  }: Dynamic): Dynamic {
    return (
      <div
        className={"contents"}
        onMouseDown={(event?: Dynamic): Dynamic => event.preventDefault()}
      >
        <runtime.PropertySegmentsRow
          label={"List"}
          data-testid={"dc-text-list"}
          options={runtime.SessionStripTextItems}
          value={value}
          mixed={mixed}
          disabled={disabled2 || disabledReason != null}
          title={disabledReason ?? undefined}
          onReset={onReset}
          onChange={onChange}
        />
      </div>
    );
  }
  bindRuntimeValue(
    runtime,
    "TypographyStyleSelect",
    () => TypographyStyleSelect,
  );
  bindRuntimeValue(
    runtime,
    "TypographyVariantSelect",
    () => TypographyVariantSelect,
  );
  return () => {};
}
