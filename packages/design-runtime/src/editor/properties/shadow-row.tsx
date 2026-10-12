/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";
export function installEditorPropertiesShadowRow(
  runtime: RuntimeBindings,
): () => void {
  function PropertyShadowRow({
    label: label,
    prop = "box-shadow",
    value: value,
    disabled: disabled2,
    mixed: mixed,
    inherited: inherited,
    onCommitMany: onCommitMany,
  }: Dynamic): Dynamic {
    let value2: Dynamic = prop === "text-shadow",
      [value3, value4]: Dynamic = (0,
      runtime.reactPropertiesAssetPicker_3.useState)(false),
      { setOverlayHidden: value5 }: Dynamic = (0,
      runtime.useInspectorContext)();
    (0, runtime.reactPropertiesAssetPicker_3.useEffect)((): Dynamic => {
      if (value3) {
        value5(true);
        return (): Dynamic => value5(false);
      }
    }, [value3, value5]);
    let value6: Dynamic = (0, runtime.parseCssBoxShadow)(value),
      value7: Dynamic = mixed
        ? "Mixed"
        : value6
          ? `${value6.x} ${value6.y} ${value6.blur}`
          : value && (0, runtime.classifyStyleValue)(value).kind !== "literal"
            ? value
            : "None",
      callback: Dynamic = (input?: Dynamic): Dynamic =>
        onCommitMany([
          {
            prop: prop,
            value: input
              ? value2
                ? `${input.x}px ${input.y}px ${input.blur}px ${input.color}`
                : (0, runtime.serializeCssBoxShadow)(input)
              : null,
          },
        ]),
      value8: Dynamic = value6 ?? runtime.CssGradientsXYBlurConfig;
    return (
      <runtime.PropertyAssetPopup
        open={value3}
        onOpenChange={(input?: Dynamic): Dynamic => {
          input &&
            !value &&
            !mixed &&
            callback(runtime.CssGradientsXYBlurConfig);
          value4(input);
        }}
        title={label}
        removeLabel={"Remove shadow"}
        removeDisabled={disabled2 || (!value && !mixed) || !!inherited}
        onRemove={(): Dynamic => callback(null)}
        data-testid={"dc-shadow-popover"}
        trigger={
          <runtime.PropertySelectTrigger
            aria-label={`${label}: ${value7}`}
            disabled={disabled2}
            chip={
              <runtime.CssColorWell
                css={
                  value6
                    ? `radial-gradient(circle at 35% 35%, ${value6.color}, transparent)`
                    : undefined
                }
              />
            }
            muted={mixed}
          >
            {value7}
          </runtime.PropertySelectTrigger>
        }
      >
        {!value6 && (value || mixed) && (
          <runtime.PropertyRow>
            <runtime.Button
              variant={"secondary"}
              size={"sm"}
              disabled={disabled2}
              onClick={(): Dynamic =>
                callback(runtime.CssGradientsXYBlurConfig)
              }
            >
              {"Add shadow"}
            </runtime.Button>
          </runtime.PropertyRow>
        )}
        {value6 && (
          <runtime.jsxPropertiesAssetPicker_3.Fragment>
            <runtime.PropertyRow label={"Offset"}>
              <div className={"flex min-w-0 flex-1 items-center gap-2"}>
                <runtime.CssNumericPopupInput
                  name={"Horizontal offset"}
                  prefix={"X"}
                  unit={""}
                  value={value8.x}
                  steppers={false}
                  disabled={disabled2}
                  onChange={(input?: Dynamic): Dynamic =>
                    callback({
                      ...value8,
                      x: input,
                    })
                  }
                />
                <runtime.CssNumericPopupInput
                  name={"Vertical offset"}
                  prefix={"Y"}
                  unit={""}
                  value={value8.y}
                  steppers={false}
                  disabled={disabled2}
                  onChange={(input?: Dynamic): Dynamic =>
                    callback({
                      ...value8,
                      y: input,
                    })
                  }
                />
              </div>
            </runtime.PropertyRow>
            <runtime.CssNumericPopupRow
              label={"Blur"}
              value={value8.blur}
              disabled={disabled2}
              min={0}
              onChange={(input?: Dynamic): Dynamic =>
                callback({
                  ...value8,
                  blur: input,
                })
              }
            />
            {!value2 && (
              <runtime.CssNumericPopupRow
                label={"Spread"}
                value={value8.spread}
                disabled={disabled2}
                onChange={(input?: Dynamic): Dynamic =>
                  callback({
                    ...value8,
                    spread: input,
                  })
                }
              />
            )}
            <runtime.PropertyPopupField label={"Color"}>
              <runtime.AuthoredColorPicker
                value={value8.color}
                disabled={disabled2}
                plain={true}
                onChange={(input?: Dynamic): Dynamic =>
                  callback({
                    ...value8,
                    color: input,
                  })
                }
              />
            </runtime.PropertyPopupField>
          </runtime.jsxPropertiesAssetPicker_3.Fragment>
        )}
      </runtime.PropertyAssetPopup>
    );
  }
  bindRuntimeValue(runtime, "PropertyShadowRow", () => PropertyShadowRow);
  return () => {};
}
