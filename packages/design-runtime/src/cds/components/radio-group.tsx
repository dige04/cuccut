import type {
  ForwardComponent,
  RadioCardProps,
  RadioGlyphProps,
  RadioGroupProps,
  RadioItemProps,
  RadioRootProps,
} from "../../contracts/ui";
import type * as React from "react";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../../runtime-types";
export function installCdsComponentsRadioGroup(
  runtime: RuntimeBindings,
): () => void {
  var reactComponentsRadioGroup: typeof React;
  var jsxComponentsRadioGroup: typeof import("react/jsx-runtime");
  var radioGlyphClasses: string;
  var RadioGroupItem: ForwardComponent<HTMLButtonElement, RadioItemProps>;
  var radioItemClasses: string;
  var RadioGroupCard: ForwardComponent<HTMLButtonElement, RadioCardProps>;
  var RadioGroupRoot: ForwardComponent<HTMLDivElement, RadioRootProps>;
  var ComponentsRadioGroupAssignValue: typeof RadioGroup & {
    Root: typeof RadioGroupRoot;
    Item: typeof RadioGroupItem;
    Card: typeof RadioGroupCard;
  };
  var initializeComponentsRadioGroup: () => void;
  function RadioGlyph({
    topAlign = false,
    focusRing = false,
  }: RadioGlyphProps): React.ReactElement {
    return (
      <span
        className={(0, runtime.npm_clsx_Ea)(
          radioGlyphClasses,
          focusRing && "group-focus-visible/rd:shadow-focus",
          topAlign && "mt-[calc((1lh_-_var(--cds-checkbox,1rem))_/_2)]",
        )}
      >
        <runtime.npm_Radio_iP.Indicator
          className={
            "size-[calc(var(--cds-checkbox,1rem)-calc(0.625rem*var(--cds-rem-scale,1)))] rounded-full bg-[var(--cds-on-accent)] data-[unchecked]:hidden"
          }
          keepMounted={true}
        />
      </span>
    );
  }
  var RadioGroup: React.FC<RadioGroupProps> = function (
    input: RadioGroupProps,
  ): React.ReactElement {
    let {
      value: value,
      defaultValue: value2,
      onChange: value3,
      options: value4,
      disabled: value5,
      size: value6,
      name: value7,
      className: value8,
    } = input;
    return (
      <runtime.npm_RadioGroup_uF
        data-cds={"RadioGroup"}
        value={value}
        defaultValue={value2}
        onValueChange={value3 ? (input2: string) => value3(input2) : undefined}
        disabled={value5}
        name={value7}
        {...(0, runtime.getSizeAttribute)(value6)}
        className={(0, runtime.cn)("flex flex-col gap-2 font-sans", value8)}
      >
        {value4.map((input2) =>
          (() => {
            const _Component = RadioGroupItem;
            const _props = {
              value: input2.value,
              label: input2.label,
              description: input2.description,
              disabled: input2.disabled,
            } as const;
            const _key = input2.value;
            return <_Component key={_key} {..._props} />;
          })(),
        )}
      </runtime.npm_RadioGroup_uF>
    );
  };
  bindRuntimeValue(runtime, "RadioGlyph", () => RadioGlyph);
  bindRuntimeValue(runtime, "RadioGroup", () => RadioGroup);
  bindRuntimeValue(
    runtime,
    "reactComponentsRadioGroup",
    () => reactComponentsRadioGroup,
    (value) => {
      reactComponentsRadioGroup = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxComponentsRadioGroup",
    () => jsxComponentsRadioGroup,
    (value) => {
      jsxComponentsRadioGroup = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "radioGlyphClasses",
    () => radioGlyphClasses,
    (value) => {
      radioGlyphClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "RadioGroupItem",
    () => RadioGroupItem,
    (value) => {
      RadioGroupItem = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "radioItemClasses",
    () => radioItemClasses,
    (value) => {
      radioItemClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "RadioGroupCard",
    () => RadioGroupCard,
    (value) => {
      RadioGroupCard = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "RadioGroupRoot",
    () => RadioGroupRoot,
    (value) => {
      RadioGroupRoot = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsRadioGroupAssignValue",
    () => ComponentsRadioGroupAssignValue,
    (value) => {
      ComponentsRadioGroupAssignValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeComponentsRadioGroup",
    () => initializeComponentsRadioGroup,
    (value) => {
      initializeComponentsRadioGroup = value;
    },
  );
  return () => {
    initializeComponentsRadioGroup = (0, runtime.initializeOnce)(() => {
      "use client";

      (0, runtime.initializeClassNames)();
      (0, runtime.initializeCdsRoot)();
      (0, runtime.initializeDomSelectionPrevention)();
      (0, runtime.initializeFieldContext)();
      reactComponentsRadioGroup = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react)(),
      );
      (0, runtime.initializeNpm_clsx_xh)();
      jsxComponentsRadioGroup = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react_jsx_runtime)(),
      );
      (0, runtime.initializeNpm__base_ui_react_H5)();
      (0, runtime.initializeNpm__base_ui_react_zve)();
      (0, runtime.initializeNpm__base_ui_react_jve)();
      radioGlyphClasses =
        "flex shrink-0 size-[var(--cds-checkbox)] items-center justify-center rounded-full border border-strong bg-transparent group-hover/rd:border-stronger group-data-[checked]/rd:bg-fill-accent group-data-[checked]/rd:border-0 group-data-[checked]/rd:group-hover/rd:bg-fill-accent-hover group-data-[disabled]/rd:group-hover/rd:border-strong";
      RadioGroupItem = (0, reactComponentsRadioGroup.forwardRef)<
        HTMLButtonElement,
        RadioItemProps
      >(
        (
          {
            value: value,
            label: label,
            description: description,
            disabled: disabled2,
            className: className,
          }: RadioItemProps,
          options: React.ForwardedRef<HTMLButtonElement>,
        ): React.ReactElement => {
          let value2 = (0, runtime.isInsideField)(),
            value3 = (0, reactComponentsRadioGroup.useId)(),
            value4 = (0, reactComponentsRadioGroup.useId)(),
            value5 = (
              <runtime.npm_Radio_iP.Root
                ref={options}
                value={value}
                disabled={disabled2}
                aria-labelledby={value3}
                aria-describedby={description ? value4 : undefined}
                onMouseDown={(0, runtime.withSelectionPrevention)(undefined)}
                className={(0, runtime.cn)(
                  "cds-reset group/rd inline-flex",
                  description ? "items-start" : "items-center",
                  "gap-2 border-0 outline-none focus-visible:outline-hidden text-start text-body font-normal text-primary data-[disabled]:opacity-disabled",
                  className,
                )}
              >
                <RadioGlyph focusRing={true} topAlign={!!description} />
                <span className={"flex min-w-0 flex-col"}>
                  <span id={value3}>{label}</span>
                  {description && (
                    <span
                      id={value4}
                      className={"text-footnote leading-snug text-muted"}
                    >
                      {description}
                    </span>
                  )}
                </span>
              </runtime.npm_Radio_iP.Root>
            );
          return value2 ? (
            <runtime.npm_LabelableProvider_NR>
              {value5}
            </runtime.npm_LabelableProvider_NR>
          ) : (
            value5
          );
        },
      );
      RadioGroupItem.displayName = "RadioGroup.Item";
      radioItemClasses =
        "cds-reset group/rd flex w-full items-start gap-md rounded-card border bg-surface-1 p-md text-start text-body font-normal text-primary outline-none focus-visible:outline-hidden hover:border-strong focus-visible:shadow-focus data-[checked]:border-accent data-[checked]:bg-[var(--cds-radio-group-card-selected)] data-[checked]:hover:border-accent data-[disabled]:pointer-events-none data-[disabled]:opacity-disabled";
      RadioGroupCard = (0, reactComponentsRadioGroup.forwardRef)<
        HTMLButtonElement,
        RadioCardProps
      >(
        (
          {
            value: value,
            label: label,
            description: description,
            leading: leading,
            trailing: trailing,
            children: children,
            disabled: disabled2,
            className: className,
          }: RadioCardProps,
          options: React.ForwardedRef<HTMLButtonElement>,
        ): React.ReactElement => {
          let value2 = (0, runtime.isInsideField)(),
            value3 = (0, reactComponentsRadioGroup.useId)(),
            value4 = (0, reactComponentsRadioGroup.useId)(),
            value5 = (
              <runtime.npm_Radio_iP.Root
                ref={options}
                value={value}
                disabled={disabled2}
                aria-labelledby={value3}
                aria-describedby={description ? value4 : undefined}
                onMouseDown={(0, runtime.withSelectionPrevention)(undefined)}
                className={(0, runtime.cn)(radioItemClasses, className)}
              >
                <RadioGlyph topAlign={true} />
                {leading ? <span className={"shrink-0"}>{leading}</span> : null}
                <span className={"flex min-w-0 flex-1 flex-col gap-xs"}>
                  <span className={"flex min-w-0 flex-col"}>
                    <span className={"flex items-start justify-between gap-sm"}>
                      <span id={value3} className={"min-w-0 font-medium"}>
                        {label}
                      </span>
                      {trailing ? (
                        <span className={"shrink-0"}>{trailing}</span>
                      ) : null}
                    </span>
                    {description && (
                      <span
                        id={value4}
                        className={"text-footnote leading-snug text-muted"}
                      >
                        {description}
                      </span>
                    )}
                  </span>
                  {children}
                </span>
              </runtime.npm_Radio_iP.Root>
            );
          return value2 ? (
            <runtime.npm_LabelableProvider_NR>
              {value5}
            </runtime.npm_LabelableProvider_NR>
          ) : (
            value5
          );
        },
      );
      RadioGroupCard.displayName = "RadioGroup.Card";
      RadioGroup.displayName = "RadioGroup";
      RadioGroupRoot = (0, reactComponentsRadioGroup.forwardRef)<
        HTMLDivElement,
        RadioRootProps
      >(
        (
          { className: className, size: size, ...props }: RadioRootProps,
          options: React.ForwardedRef<HTMLDivElement>,
        ): React.ReactElement => (
          <runtime.npm_RadioGroup_uF
            data-cds={"RadioGroup"}
            ref={options}
            {...props}
            {...(0, runtime.getSizeAttribute)(size)}
            className={(0, runtime.cn)(
              "flex flex-col gap-2 font-sans",
              className,
            )}
          />
        ),
      );
      RadioGroupRoot.displayName = "RadioGroup.Root";
      ComponentsRadioGroupAssignValue = Object.assign(RadioGroup, {
        Root: RadioGroupRoot,
        Item: RadioGroupItem,
        Card: RadioGroupCard,
      });
    });
  };
}
