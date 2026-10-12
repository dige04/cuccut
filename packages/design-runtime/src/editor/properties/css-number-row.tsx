/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";
export function installEditorPropertiesCssNumberRow(
  runtime: RuntimeBindings,
): () => void {
  function fieldUnitBounds(input?: Dynamic, options?: Dynamic): Dynamic {
    let value: Dynamic = input === (options?.unit ?? "");
    return {
      min: value
        ? options?.min
        : options?.min != null && options.min >= 0
          ? 0
          : undefined,
      max: value ? options?.max : options?.max === 0 ? 0 : undefined,
    };
  }
  function PropertyTextInput({
    display: display,
    placeholder: placeholder,
    hint: hint,
    title: title,
    disabled: disabled2,
    fullWidth: fullWidth,
    className: className,
    "aria-label": ariaLabel,
    onCommitText: onCommitText,
    onArrowStep: onArrowStep,
  }: Dynamic): Dynamic {
    let [value, value2]: Dynamic = (0,
      runtime.reactPropertiesDropShadowEditor_2.useState)(display),
      value3: Dynamic = (0, runtime.reactPropertiesDropShadowEditor_2.useRef)(
        false,
      ),
      value4: Dynamic = (0, runtime.reactPropertiesDropShadowEditor_2.useRef)(
        false,
      ),
      value5: Dynamic = (0, runtime.reactPropertiesDropShadowEditor_2.useRef)(
        null,
      ),
      value6: Dynamic = (0, runtime.reactPropertiesDropShadowEditor_2.useRef)(
        false,
      );
    (0, runtime.reactPropertiesDropShadowEditor_2.useEffect)((): Dynamic => {
      (!value3.current || !value6.current) && value2(display);
    }, [display]);
    let value7: Dynamic = placeholder === runtime.Value_6 || placeholder === "";
    return (
      <runtime.TextInput
        type={"text"}
        value={value}
        placeholder={value7 && hint !== undefined ? hint : placeholder}
        title={title}
        disabled={disabled2}
        aria-label={ariaLabel}
        fullWidth={fullWidth}
        className={(0, runtime.cn)(
          placeholder !== "Mixed" &&
            !value7 &&
            "placeholder:text-primary [&_input]:placeholder:text-primary",
          className,
        )}
        onFocus={(event?: Dynamic): Dynamic => {
          value3.current = true;
          value6.current = false;
          event.target.select();
        }}
        onChange={(event?: Dynamic): Dynamic => {
          value5.current = null;
          value6.current = true;
          value2(event.target.value);
        }}
        onBlur={(): Dynamic => {
          value3.current = false;
          let current: Dynamic = value4.current;
          value4.current = false;
          let current2: Dynamic = value6.current;
          value6.current = false;
          let value8: Dynamic = value5.current === value;
          value5.current = null;
          current2 &&
            !current &&
            !value8 &&
            value !== display &&
            onCommitText(value);
          value2(display);
        }}
        onKeyDown={(event?: Dynamic): Dynamic => {
          if (event.key === "Enter" || event.key === "Escape") {
            event.key === "Escape" &&
              ((value4.current = true), value2(display));
            event.target.blur();
            return;
          }
          if (
            onArrowStep &&
            (event.key === "ArrowUp" || event.key === "ArrowDown")
          ) {
            if (event.metaKey || event.ctrlKey || event.nativeEvent.isComposing)
              return;
            let value8: Dynamic = onArrowStep(
              value,
              event.key === "ArrowUp" ? 1 : -1,
              event,
            );
            if (value8 == null) return;
            event.preventDefault();
            value5.current = value8;
            value6.current = true;
            value2(value8);
            onCommitText(value8);
            let target: Dynamic = event.target;
            requestAnimationFrame((): Dynamic => target.select());
          }
        }}
      />
    );
  }
  function useFieldNumericArrowStep(input?: Dynamic): Dynamic {
    let { text: value, isLiteral: value2 }: Dynamic = (0,
      runtime.inspectorFieldDisplay)(input.state),
      value3: Dynamic =
        !value ||
        (value2 && (0, runtime.parseCssNumber)(value) != null) ||
        ((0, runtime.classifyStyleValue)(value).kind === "var" &&
          (0, runtime.parseCssNumber)(input.state.fallback) != null),
      value4: Dynamic = (0, runtime.reactPropertiesDropShadowEditor_2.useRef)(
        null,
      ),
      value5: Dynamic = (0, runtime.reactPropertiesDropShadowEditor_2.useRef)(
        false,
      ),
      value6: Dynamic = (0, runtime.reactPropertiesDropShadowEditor_2.useRef)(
        value3,
      );
    (0,
    runtime.reactPropertiesDropShadowEditor_2.useLayoutEffect)((): Dynamic => {
      if (
        value6.current === value3 ||
        ((value6.current = value3), !value5.current)
      )
        return;
      let value7: Dynamic = value4.current?.querySelector(
        'input:not([aria-hidden="true"])',
      );
      value7?.focus();
      value7?.select();
    }, [value3]);
    return (
      <div
        ref={value4}
        className={"contents"}
        onFocusCapture={(): Dynamic => (value5.current = true)}
        onBlurCapture={(input2?: Dynamic): Dynamic => {
          value4.current?.contains(input2.relatedTarget) ||
            (value5.current = false);
        }}
      >
        {value3 ? (
          <PropertyCssNumberRow {...input} />
        ) : (
          <runtime.PropertyCssTextRow {...input} />
        )}
      </div>
    );
  }
  function PropertyCssNumberRow({
    state: state,
    onCommit: onCommit,
    shell: shell,
  }: Dynamic): Dynamic {
    let { text: value, placeholder: value2 }: Dynamic = (0,
      runtime.inspectorFieldDisplay)(state),
      spec: Dynamic = state.spec,
      value3: Dynamic =
        !!value && (0, runtime.classifyStyleValue)(value).kind === "var",
      value4: Dynamic =
        value && !value3 ? (0, runtime.parseCssNumber)(value) : null,
      value5: Dynamic = (0, runtime.parseCssNumber)(
        value3 ? (state.fallback ?? "") : value2,
      );
    if (!value5 && value2 && !state.mixed) {
      let value19: Dynamic =
        spec?.scrubFrom ??
        (0, runtime.parseCssNumber)(spec?.defaultValue)?.value;
      value19 != null &&
        (value5 = {
          value: value19,
          unit: spec?.unit ?? "",
        });
    }
    let value6: Dynamic = (0, runtime.reactPropertiesDropShadowEditor_2.useRef)(
        false,
      ),
      value7: Dynamic =
        value4 != null
          ? value4.unit || spec?.unit || ""
          : spec?.unit === ""
            ? ""
            : value5?.unit || spec?.unit || "",
      value8: Dynamic = value5 != null && value5.unit === value7,
      value9: Dynamic = value7 === (spec?.unit ?? ""),
      value10: Dynamic =
        (0, runtime.getFineUnitStep)(value7, undefined) != null,
      value11: Dynamic = value9 ? (spec?.step ?? 1) : value10 ? 0.1 : 1,
      value12: Dynamic =
        value7 === "" && Number.isInteger(value11) && value11 >= 1
          ? value11
          : value10
            ? 0.01
            : undefined,
      value13: Dynamic = fieldUnitBounds(value7, spec),
      value14: Dynamic =
        state.mixed || value4 == null
          ? undefined
          : state.varSource
            ? (0, runtime.roundCssNumber)(value4.value, value7)
            : value4.value,
      callback: Dynamic = (input?: Dynamic): Dynamic =>
        onCommit(state.prop, (0, runtime.formatCssNumber)(input, value7)),
      callback2: Dynamic = (input?: Dynamic): Dynamic => {
        let value19: Dynamic = (0, runtime.formatCssNumber)(input, value7);
        value19 !== (state.varSource ?? state.value ?? "") &&
          onCommit(state.prop, value19);
      },
      value15: Dynamic = value8
        ? (0, runtime.roundCssNumber)(value5.value, value5.unit)
        : (spec?.scrubFrom ?? 0),
      { start: value16, live: value17 }: Dynamic = (0,
      runtime.useLiveStyleScrub)({
        value: value14 ?? value15 ?? 0,
        step: value9
          ? (0, runtime.getFineUnitStep)(value7, spec?.scrub)
          : value10
            ? 0.01
            : 1,
        min: value13.min,
        max: value13.max,
        disabled: state.disabled || state.mixed,
        onScrub: callback,
      }),
      value18: Dynamic =
        state.disabled || state.mixed
          ? undefined
          : {
              onPointerDown: (input?: Dynamic): Dynamic => {
                value6.current = true;
                try {
                  value16(input);
                } finally {
                  value6.current = false;
                }
              },
              className: "cursor-ew-resize touch-none",
            };
    return (
      <runtime.PropertyRow {...shell} labelProps={value18}>
        <runtime.NumericInput
          value={value17 ?? value14}
          mixed={state.mixed && value17 == null}
          placeholder={
            value5
              ? String((0, runtime.roundCssNumber)(value5.value, value5.unit)) +
                (value8 ? "" : value5.unit)
              : value2 === runtime.Value_6
                ? undefined
                : value2
          }
          hint={runtime.Value_6}
          unit={
            value7 && !state.mixed && (value4 != null || value5 != null)
              ? value7
              : undefined
          }
          unitScrubs={false}
          refuseLetters={true}
          ownUnit={value7}
          step={value11}
          smallStep={value12}
          min={value13.min}
          max={value13.max}
          emptyStepFrom={state.mixed ? null : (value14 ?? value15)}
          clearable={true}
          title={spec?.hint}
          aria-label={state.label}
          disabled={state.disabled}
          onValue={(input?: Dynamic): Dynamic => {
            if (input === undefined) {
              if (value6.current) return;
              onCommit(state.prop, null);
            } else callback2(input);
          }}
        />
      </runtime.PropertyRow>
    );
  }
  bindRuntimeValue(runtime, "fieldUnitBounds", () => fieldUnitBounds);
  bindRuntimeValue(runtime, "PropertyTextInput", () => PropertyTextInput);
  bindRuntimeValue(
    runtime,
    "useFieldNumericArrowStep",
    () => useFieldNumericArrowStep,
  );
  bindRuntimeValue(runtime, "PropertyCssNumberRow", () => PropertyCssNumberRow);
  return () => {};
}
