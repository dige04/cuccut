/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";
export function installEditorTypographySpacing(
  runtime: RuntimeBindings,
): () => void {
  var jsxTypographySpacing: Dynamic;
  var PropertiesInheritedFieldMixedAlias_3: Dynamic;
  function PropertyTextSpacing({
    lh: lh,
    ls: ls,
    renderRows: renderRows,
    onCommitMany: onCommitMany,
  }: Dynamic): Dynamic {
    let value: Dynamic = (0, runtime.useStyleCommitScrub)(
        (input?: Dynamic): Dynamic => onCommitMany(input),
      ),
      value2: Dynamic = (0, runtime.inheritedFieldsDisabledReason)(lh, ls),
      value3: Dynamic = (0, runtime.inheritedFieldsDescription)(lh, ls),
      value4: Dynamic = (0, runtime.inheritedFieldForEdit)(lh),
      value5: Dynamic = (0, runtime.inheritedFieldForEdit)(ls),
      callback: Dynamic = (input?: Dynamic): Dynamic => {
        let value9: Dynamic = (input.mixed ? "" : (input.value ?? "")).trim();
        return {
          v: value9,
          n: (0, runtime.parseCssNumber)(value9),
          fb: (0, runtime.parseCssNumber)(input.fallback ?? ""),
        };
      },
      value6: Dynamic = callback(value4),
      value7: Dynamic = callback(value5),
      callback2: Dynamic = (input?: Dynamic, options?: Dynamic): Dynamic =>
        options.mixed || !input.v || input.n != null;
    if (!callback2(value6, value4) || !callback2(value7, value5))
      return (
        <jsxTypographySpacing.Fragment>
          {renderRows([lh, ls])}
        </jsxTypographySpacing.Fragment>
      );
    let callback3: Dynamic = (input?: Dynamic, options?: Dynamic): Dynamic =>
        input.n
          ? input.n.unit || options
          : options === ""
            ? ""
            : input.fb?.unit || options,
      callback4: Dynamic = (
        input?: Dynamic,
        options?: Dynamic,
        context?: Dynamic,
      ): Dynamic =>
        input.fb
          ? (0, runtime.formatCssNumber)(
              (0, runtime.roundCssNumber)(input.fb.value, input.fb.unit),
              input.fb.unit === callback3(input, options) ? "" : input.fb.unit,
            )
          : context.fallback || "",
      callback5: Dynamic = (
        input?: Dynamic,
        options?: Dynamic,
        context?: Dynamic,
      ): Dynamic =>
        context.mixed
          ? null
          : input.fb && input.fb.unit === callback3(input, options)
            ? input.fb.value
            : (context.spec?.scrubFrom ?? (options === "" ? 1.2 : 0)),
      callback6: Dynamic = (
        input?: Dynamic,
        options?: Dynamic,
        context?: Dynamic,
      ): Dynamic => {
        let value9: Dynamic = callback3(options, context);
        return value9 === (input.spec?.unit ?? context)
          ? (input.spec?.step ?? 1)
          : /^(em|rem|ch|ex|lh|rlh)$/.test(value9)
            ? 0.1
            : 1;
      },
      callback7: Dynamic = (
        input?: Dynamic,
        options?: Dynamic,
        context?: Dynamic,
        value9?: Dynamic,
        extra?: Dynamic,
      ): Dynamic => (
        <runtime.NumericInput
          aria-label={value9}
          title={value9}
          prefix={context}
          value={options.n ? options.n.value : undefined}
          min={input.spec?.min}
          max={input.spec?.max}
          emptyStepFrom={callback5(options, extra, input)}
          placeholder={
            input.mixed ? undefined : callback4(options, extra, input)
          }
          mixed={input.mixed}
          step={callback6(input, options, extra)}
          smallStep={callback6(input, options, extra)}
          clearable={true}
          refuseLetters={true}
          ownUnit={callback3(options, extra)}
          unit={
            (options.n || options.fb) && callback3(options, extra)
              ? callback3(options, extra)
              : undefined
          }
          unitScrubs={false}
          steppers={false}
          disabled={input.disabled}
          onValue={(input2?: Dynamic): Dynamic =>
            onCommitMany([
              {
                prop: input.prop,
                value:
                  input2 === undefined
                    ? null
                    : (0, runtime.formatCssNumber)(
                        input2,
                        callback3(options, extra),
                      ),
              },
            ])
          }
          onScrub={(input2?: Dynamic): Dynamic =>
            value.onScrub([
              {
                prop: input.prop,
                value: (0, runtime.formatCssNumber)(
                  input2,
                  callback3(options, extra),
                ),
              },
            ])
          }
          onScrubEnd={value.onScrubEnd}
        />
      ),
      value8: Dynamic =
        PropertiesInheritedFieldMixedAlias_3(value4) ||
        PropertiesInheritedFieldMixedAlias_3(value5);
    return (
      <runtime.PropertyRow
        label={"Spacing"}
        data-testid={"dc-text-spacing"}
        disabled={value4.disabled || value5.disabled}
        title={
          "Line height \xB7 Letter spacing" +
          (value2 ? " \u2014 " + value2 : "")
        }
        description={value3}
        onReset={
          value8
            ? (): Dynamic =>
                onCommitMany([
                  {
                    prop: value4.prop,
                    value: null,
                  },
                  {
                    prop: value5.prop,
                    value: null,
                  },
                ])
            : undefined
        }
        onPress={(element?: Dynamic): Dynamic =>
          element.querySelector("input")?.focus()
        }
      >
        <div className={"grid min-w-0 flex-1 grid-cols-2 gap-2"}>
          {callback7(
            value4,
            value6,
            <runtime.PropertyOptionIcon icon={runtime.LineHeightValue} />,
            "Line height",
            "",
          )}
          {callback7(
            value5,
            value7,
            <runtime.PropertyOptionIcon icon={"LetterSpacing"} />,
            "Letter spacing",
            "px",
          )}
        </div>
      </runtime.PropertyRow>
    );
  }
  bindRuntimeValue(
    runtime,
    "jsxTypographySpacing",
    () => jsxTypographySpacing,
    (value) => {
      jsxTypographySpacing = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PropertiesInheritedFieldMixedAlias_3",
    () => PropertiesInheritedFieldMixedAlias_3,
    (value) => {
      PropertiesInheritedFieldMixedAlias_3 = value;
    },
  );
  bindRuntimeValue(runtime, "PropertyTextSpacing", () => PropertyTextSpacing);
  return () => {
    jsxTypographySpacing = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_jsx_runtime)(),
      1,
    );
    PropertiesInheritedFieldMixedAlias_3 =
      runtime.PropertiesInheritedFieldMixed;
  };
}
