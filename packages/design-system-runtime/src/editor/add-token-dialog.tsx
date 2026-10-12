/** Restored application module; prepare first, initialize in original order. */
import type * as React from "react";
import type * as JsxRuntime from "react/jsx-runtime";
import type {
  AddTokenDialogRuntime,
  AddTokenDialogProps,
  AddTokenRequest,
  AddDialogFieldProps,
  ScalarTokenKind,
  NewTypeStyle,
} from "../contracts/application";
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installEditorAddTokenDialog(
  runtime: RuntimeBindings & AddTokenDialogRuntime,
): () => void {
  var jsxAddTokenDialog: typeof JsxRuntime;
  var NEW_TOKEN_GROUP_SENTINEL: string;
  var TOKEN_LENGTH_VALIDATION_MESSAGES: Record<ScalarTokenKind, string>;
  var PASSWORD_MANAGER_IGNORE_PROPS: Record<string, string>;
  var formatNumberWithUnit: (value: number, unit: string) => string;
  var NUMBER_INPUT_SELECTOR: string;
  var stripAddDialogNamespace: (name: string, namespace: string) => string;
  var ADD_DIALOG_ROW_CLASS_NAME: string;
  var ADD_DIALOG_HELP_CLASS_NAME: string;
  function addTokenDialogTitle(request: AddTokenRequest): string {
    switch (request.kind) {
      case "color":
        return "New color";
      case "type":
        return "New type style";
      case "shadow":
        return "New shadow";
      default:
        return "New " + request.label;
    }
  }
  function normalizeNewTokenName(value: string): string {
    return (0, runtime.normalizeTokenName)(value).replace(/\s+/g, "-");
  }
  function validateNewColorValue(
    value: string,
    allowEmpty: boolean,
    names: string,
    tokenName: ReadonlySet<string>,
  ) {
    let value2 = normalizeNewColorValue(value);
    if (value2 === "") {
      if (allowEmpty) {
        return null;
      } else {
        return "A color is needed.";
      }
    }
    if (!(0, runtime.isColorOrAlias)(value2)) {
      return "Not a color — try #rrggbb, rgb(), oklch() or {token}.";
    }
    let value3 = (0, runtime.colorAliasTarget)(value2);
    if (value3 === undefined) {
      return null;
    }
    if (value3 === names) {
      return "A token cannot alias itself.";
    }
    if (!tokenName.has(value3)) {
      return "Names no color token.";
    }
    return null;
  }
  function normalizeNewColorValue(value: string): string {
    return (0, runtime.normalizeColorEditorInput)(value);
  }
  function appendDefaultLengthUnit(value: string): string {
    let value2 = value.trim();
    if (/^-?\d{1,4}(?:\.\d{1,6})?$/.test(value2) && value2 !== "0") {
      return value2 + "px";
    } else {
      return value2;
    }
  }
  function validateNewTokenValue(
    kind: ScalarTokenKind,
    value: string,
  ): string | undefined {
    return (0, runtime.normalizeScalarTokenValue)(
      kind,
      kind === "spacing" || kind === "radius"
        ? appendDefaultLengthUnit(value)
        : value.trim(),
    );
  }
  function validateNewTypeField(
    field: "fontSize" | "lineHeight" | "letterSpacing",
    value: string,
  ): string | null {
    let value2 = value.trim();
    switch (field) {
      case "fontSize":
        if (
          (0, runtime.normalizeCssLength)(
            appendDefaultLengthUnit(value2),
            false,
          ) === undefined
        ) {
          return "Not a size — try 16 or 1rem.";
        } else {
          return null;
        }
      case "lineHeight":
        if ((0, runtime.normalizeLineHeight)(value2) === undefined) {
          return "Not a line height — try 1.5 or 24px.";
        } else {
          return null;
        }
      case "letterSpacing":
        if (
          value2 === "" ||
          (0, runtime.normalizeCssLength)(
            appendDefaultLengthUnit(value2),
            false,
          ) !== undefined
        ) {
          return null;
        } else {
          return "Not a length — try 0.2px or -0.01em.";
        }
    }
  }
  function ignorePasswordManagerForInput(
    element: HTMLInputElement | null,
  ): void {
    if (element === null) {
      return;
    }
    for (let [value, value2] of Object.entries(PASSWORD_MANAGER_IGNORE_PROPS)) {
      element.setAttribute(
        value === "autoComplete" ? "autocomplete" : value,
        value2,
      );
    }
  }
  function AddDialogField({
    label: label,
    hint = null,
    testid: testid,
    knob: knob,
    top = false,
    children: children,
  }: AddDialogFieldProps) {
    return (
      <runtime.FieldComponents.Root
        invalid={hint !== null || undefined}
        className={ADD_DIALOG_ROW_CLASS_NAME}
        style={
          top
            ? {
                alignItems: "start",
              }
            : undefined
        }
        data-testid={testid}
        data-knob={knob}
      >
        {[
          <runtime.FieldComponents.Label
            className={ADD_DIALOG_HELP_CLASS_NAME + (top ? " pt-[5px]" : "")}
            title={label}
          >
            {label}
          </runtime.FieldComponents.Label>,
          <div className={"flex min-w-0 items-center gap-1"}>{children}</div>,
          hint !== null ? (
            <runtime.FieldComponents.Error
              match={true}
              className={"col-start-2"}
            >
              {hint}
            </runtime.FieldComponents.Error>
          ) : null,
        ]}
      </runtime.FieldComponents.Root>
    );
  }
  function AddDialogFieldGroup({
    label: label,
    testid: testid,
    children: children,
  }: AddDialogFieldProps) {
    return (
      <div className={ADD_DIALOG_ROW_CLASS_NAME} data-testid={testid}>
        {[
          <span className={ADD_DIALOG_HELP_CLASS_NAME} title={label}>
            {label}
          </span>,
          <div className={"flex min-w-0 items-center gap-1"}>{children}</div>,
        ]}
      </div>
    );
  }
  function AddTokenDialog({
    req: req,
    onSubmit: onSubmit,
    onClose: onClose,
    "data-testid": dataTestid = "ds-add-dialog",
  }: AddTokenDialogProps) {
    let ref = runtime.reactDesignSystemEditors.useRef<HTMLFormElement | null>(
        null,
      ),
      ref2 = runtime.reactDesignSystemEditors.useRef<HTMLInputElement | null>(
        null,
      ),
      [value, value2] = runtime.reactDesignSystemEditors.useState(0);
    runtime.reactDesignSystemEditors.useEffect(() => {
      if (value === 0) {
        return;
      }
      let value49 = setTimeout(() => {
        let current = ref2.current;
        current?.focus();
        current?.setSelectionRange(current.value.length, current.value.length);
      }, 50);
      return () => clearTimeout(value49);
    }, [value]);
    let value3 =
        req.kind === "color"
          ? req.groups
          : req.kind !== "type" && req.kind !== "shadow"
            ? (req.groups ?? [])
            : [],
      value4 = req.kind === "type" && req.sets.length === 0,
      value5 =
        req.kind === "color"
          ? req.namespace
          : req.kind !== "type" && req.kind !== "shadow"
            ? (req.namespace ?? "")
            : "",
      [value6, value7] = runtime.reactDesignSystemEditors.useState(
        req.kind === "color"
          ? req.group
          : req.kind === "type"
            ? value4
              ? NEW_TOKEN_GROUP_SENTINEL
              : req.set
            : req.kind !== "shadow"
              ? (req.group ?? "")
              : "",
      ),
      [value8, value9] = runtime.reactDesignSystemEditors.useState(
        value4 ? "Styles" : "",
      ),
      [value10, value11] = runtime.reactDesignSystemEditors.useState<
        string | null
      >(null),
      ref3 = runtime.reactDesignSystemEditors.useRef<string | null>(null),
      callback = (input: string | null) => {
        ref3.current = input;
        value11(input);
      },
      value12 =
        value10 === null || req.kind !== "type"
          ? null
          : (0, runtime.validateNewFontFamily)(value10, req.families),
      [value13, value14] = runtime.reactDesignSystemEditors.useState(false),
      [value15, value16] = runtime.reactDesignSystemEditors.useState(req.name),
      [value17, value18] = runtime.reactDesignSystemEditors.useState(false),
      ref4 = runtime.reactDesignSystemEditors.useRef(req.name),
      callback2 = (input: string, options: string) => {
        let value49 = stripAddDialogNamespace(
          (0, runtime.normalizeThemeId)(options),
          value5,
        );
        if (req.kind === "color" && input === NEW_TOKEN_GROUP_SENTINEL) {
          if (value49 === "") {
            return "";
          } else {
            return req.seedFor(value49);
          }
        }
        return value3.find((input2) => input2.key === input)?.seed ?? "";
      },
      callback3 = (input: string, options: string) => {
        if (req.kind === "type" || value15 !== ref4.current) {
          return;
        }
        let value49 = callback2(input, options);
        ref4.current = value49;
        value16(value49);
      },
      callback4 = (input: string) => {
        value7(input);
        callback3(input, value8);
        requestAnimationFrame(() => {
          let value49 =
            input === NEW_TOKEN_GROUP_SENTINEL
              ? ref.current?.querySelector<HTMLInputElement>(
                  '[data-field="fresh"]',
                )
              : ref2.current;
          value49?.focus();
          if (
            value49 !== null &&
            value49 !== undefined &&
            value49 === ref2.current
          ) {
            value49.setSelectionRange(
              value49.value.length,
              value49.value.length,
            );
          }
        });
      },
      [value19, value20] = runtime.reactDesignSystemEditors.useState(""),
      [value21, value22] = runtime.reactDesignSystemEditors.useState<
        Record<string, string>
      >(() => {
        if (req.kind === "color" || req.kind === "shadow") {
          let value49 = req.themes[0]?.id;
          if (value49 !== undefined) {
            return {
              [value49]: req.value,
            };
          } else {
            return {};
          }
        }
        return {};
      }),
      [value23, value24] = runtime.reactDesignSystemEditors.useState(
        req.kind === "type" || req.kind === "color" || req.kind === "shadow"
          ? ""
          : req.value,
      ),
      [value25, value26] =
        runtime.reactDesignSystemEditors.useState<NewTypeStyle>(
          req.kind === "type"
            ? {
                ...req.style,
                letterSpacing:
                  req.style.letterSpacing === "0"
                    ? ""
                    : req.style.letterSpacing,
              }
            : {
                family: "",
                fontSize: "16px",
                lineHeight: "1.5",
                fontWeight: "400",
                fontStyle: "normal",
                letterSpacing: "",
              },
        ),
      ref5 = runtime.reactDesignSystemEditors.useRef({
        style: value25,
        value: value23,
      }),
      callback5 = (input: (style: NewTypeStyle) => NewTypeStyle) => {
        ref5.current = {
          ...ref5.current,
          style: input(ref5.current.style),
        };
        value26(ref5.current.style);
      },
      callback6 = (input: React.SetStateAction<string>) => {
        ref5.current = {
          ...ref5.current,
          value:
            typeof input === "function" ? input(ref5.current.value) : input,
        };
        value24(ref5.current.value);
      };
    runtime.reactDesignSystemEditors.useEffect(() => {
      let value49 = requestAnimationFrame(() => {
        let value50 =
          value6 === NEW_TOKEN_GROUP_SENTINEL && !value4
            ? (ref.current?.querySelector<HTMLInputElement>(
                '[data-field="fresh"]',
              ) ?? ref2.current)
            : ref2.current;
        if (value50 === null) {
          return;
        }
        value50.focus();
        value50.setSelectionRange(value50.value.length, value50.value.length);
      });
      return () => cancelAnimationFrame(value49);
    }, []);
    let value27 = value6 === NEW_TOKEN_GROUP_SENTINEL,
      value28 =
        req.kind === "type"
          ? value8.replace(/\s+/g, " ").trim()
          : stripAddDialogNamespace(
              (0, runtime.normalizeThemeId)(value8),
              value5,
            ),
      value29 = value28.toLowerCase(),
      value30 =
        req.kind === "color"
          ? value3.some(
              (input) =>
                input.key.toLowerCase() === value29 ||
                input.label.toLowerCase() === value29,
            )
          : req.kind === "type"
            ? req.sets.some((input) => input.toLowerCase() === value29)
            : false,
      value31 = req.kind === "type" ? "set" : "group",
      value32 = value27 && value28 === "",
      value33 = !value27
        ? null
        : value32
          ? value13
            ? "A " + value31 + " needs a name."
            : null
          : value30
            ? "There is already a " + value31 + " called " + value28 + "."
            : null,
      value34 = normalizeNewTokenName(value15),
      value35 = value34 === "" || /[-.]$/.test(value34),
      value36 = value35 && !value17,
      value37: React.ReactNode = value36
        ? null
        : ((0, runtime.validateTokenRename)(value34, "", req.taken) ??
          (value35 ? "Finish the name — e.g. " + value34 + "500." : null)),
      value38 = value36 || value37 !== null ? null : value39();
    if (value38 !== null) {
      let callback15 = () => {
        value38.run();
        value2((input) => input + 1);
      };
      value37 =
        value38.verb === "" ? (
          value38.say
        ) : (
          <jsxAddTokenDialog.Fragment>
            {[
              value38.say,
              " ",
              <runtime.TextLink
                onClick={callback15}
                data-testid={dataTestid + "-regroup"}
              >
                {value38.verb}
              </runtime.TextLink>,
            ]}
          </jsxAddTokenDialog.Fragment>
        );
    }
    function value39(): {
      say: string;
      verb: string;
      run(): void;
    } | null {
      let value49 = value5,
        value50 = "“" + value34 + "”";
      if (value49 !== "" && !value34.startsWith(value49)) {
        let value56 = value34.toLowerCase().startsWith(value49.toLowerCase())
          ? value34.slice(value49.length)
          : value34;
        return {
          say:
            "Every name here starts with " +
            value49 +
            "; without it this one would regroup the card.",
          verb: "Start it with " + value49,
          run: () => value16(value49 + value56),
        };
      }
      if (
        req.kind === "type" ||
        req.kind === "shadow" ||
        value3.length === 0 ||
        value33 !== null ||
        value32
      ) {
        return null;
      }
      let value51 = value27 ? value28 : value6,
        value52 =
          req.kind === "color"
            ? req.groupOf(value34)
            : (req.groupOf?.(value34) ?? value6);
      if (value52 === value51) {
        return null;
      }
      if (
        value49 !== "" &&
        value34.toLowerCase().startsWith((value49 + value49).toLowerCase())
      ) {
        return {
          say: value50 + " has " + value49 + " twice.",
          verb: "Use " + value49 + value34.slice(2 * value49.length),
          run: () => value16(value49 + value34.slice(2 * value49.length)),
        };
      }
      let value53 = value27
          ? value28
          : (value3.find((input) => input.key === value6)?.label ?? value6),
        value54 = value3.find((input) => input.key === value52);
      if (value54 !== undefined) {
        return {
          say:
            value50 +
            " would file under " +
            value54.label +
            ", not " +
            value53 +
            ".",
          verb: "Put it in " + value54.label,
          run: () => value7(value54.key),
        };
      }
      if (req.kind !== "color") {
        return null;
      }
      if (
        value52 !== "" &&
        (0, runtime.normalizeThemeId)(value52) === value52 &&
        stripAddDialogNamespace(value52, value49) === value52 &&
        !value3.some((input) => input.label.toLowerCase() === value52)
      ) {
        return {
          say: value50 + " would start a new group, " + value52 + ".",
          verb: "Make " + value52 + " a new group",
          run: () => {
            value9(value52);
            value7(NEW_TOKEN_GROUP_SENTINEL);
          },
        };
      }
      let value55 =
        value51 === ""
          ? value49 !== ""
            ? value49 + " and one plain word"
            : "one plain word"
          : value49 + value51 + "-";
      return {
        say:
          value50 +
          " would not file under " +
          value53 +
          " — names there start with " +
          value55 +
          (value52 !== "" && (0, runtime.normalizeThemeId)(value52) !== value52
            ? " (group prefixes are lowercase letters, digits and single hyphens)"
            : "") +
          ".",
        verb: "",
        run: () => {},
      };
    }
    let value40 =
        req.kind === "color" || req.kind === "shadow" ? req.themes : [],
      value41 = value40[0]?.id,
      state: Record<string, string | null> = {};
    if (req.kind === "color") {
      for (let value49 of value40) {
        state[value49.id] = validateNewColorValue(
          value21[value49.id] ?? "",
          value49.id !== value41,
          value34,
          req.names,
        );
      }
    }
    if (req.kind === "shadow") {
      for (let value49 of value40) {
        let value50 = (value21[value49.id] ?? "").trim();
        state[value49.id] =
          value50 === ""
            ? value49.id === value41
              ? "A box-shadow is needed."
              : null
            : (0, runtime.normalizeBoxShadow)(value50) === undefined
              ? "Not a box-shadow — try 0 1px 2px rgba(0,0,0,.2)."
              : null;
      }
    }
    let value42 =
        req.kind === "spacing" || req.kind === "radius" || req.kind === "extra"
          ? validateNewTokenValue(req.kind, value23) === undefined
            ? TOKEN_LENGTH_VALIDATION_MESSAGES[req.kind]
            : null
          : null,
      value43 =
        req.kind === "type"
          ? {
              fontSize: validateNewTypeField("fontSize", value25.fontSize),
              lineHeight: validateNewTypeField(
                "lineHeight",
                value25.lineHeight,
              ),
              letterSpacing: validateNewTypeField(
                "letterSpacing",
                value25.letterSpacing,
              ),
            }
          : null,
      value44 =
        value33 === null &&
        !value32 &&
        !value35 &&
        value37 === null &&
        value42 === null &&
        Object.values(state).every((input) => input === null) &&
        value12 === null &&
        (value43 === null ||
          Object.values(value43).every((input) => input === null)),
      callback7 = (input: HTMLInputElement) => {
        let value49 = input.closest("[data-knob]")?.getAttribute("data-knob"),
          style = ref5.current.style;
        if (value49 === "size") {
          return style.fontSize;
        } else {
          if (value49 === "lh") {
            return style.lineHeight;
          } else {
            if (value49 === "ls") {
              if (style.letterSpacing.trim() === "") {
                return "0";
              } else {
                return style.letterSpacing;
              }
            } else {
              return ref5.current.value;
            }
          }
        }
      },
      callback8 = (input: HTMLInputElement, options: string) => {
        let value49 = callback7(input).trim();
        if (options === "") {
          return false;
        }
        let value50 = Number(options.replace(/,/g, "")),
          value51 = (0, runtime.parseEditableCssLength)(value49)?.n;
        return (
          value51 !== undefined && Math.abs(value50 - value51) < 0.000000001
        );
      },
      callback9 = () => {
        let value49 =
          ref.current?.querySelector<HTMLInputElement>(
            NUMBER_INPUT_SELECTOR + ":focus",
          ) ?? null;
        if (value49 === null) {
          return true;
        }
        let value50 = value49.value.trim();
        value49.blur();
        value49.focus();
        return callback8(value49, value50);
      },
      callback10 = (input?: React.FormEvent<HTMLFormElement>) => {
        input?.preventDefault();
        let value49 =
          ref.current?.querySelector<HTMLInputElement>(
            '[data-testid$="-family-custom"]:focus',
          ) ?? null;
        if (value49 !== null) {
          value49.blur();
          if (
            ref3.current !== null &&
            (0, runtime.validateNewFontFamily)(
              ref3.current,
              req.kind === "type" ? req.families : {},
            ) !== null
          ) {
            return;
          }
        }
        if (!callback9() || !value44) {
          return;
        }
        let { style: current, value: current2 } = ref5.current,
          value50 = value19
            .replace(
              /[ \t]+\n/g,
              `
`,
            )
            .trim();
        switch (req.kind) {
          case "color": {
            let state3: Record<string, string> = {};
            for (let value51 of value40) {
              let value52 = normalizeNewColorValue(
                ref6.current[value51.id] ?? "",
              );
              if (value52 !== "") {
                state3[value51.id] = value52;
              }
            }
            onSubmit({
              kind: "color",
              name: value34,
              group: value27 ? value28 : value6,
              newGroup: value27,
              values: state3,
              usage: value50,
            });
            return;
          }
          case "shadow": {
            let state3: Record<string, string> = {};
            for (let value51 of value40) {
              let value52 = (ref6.current[value51.id] ?? "").trim();
              if (
                value52 !== "" &&
                (0, runtime.normalizeBoxShadow)(value52) !== undefined
              ) {
                state3[value51.id] = value52;
              }
            }
            onSubmit({
              kind: "shadow",
              name: value34,
              values: state3,
              usage: value50,
            });
            return;
          }
          case "type":
            onSubmit({
              kind: "type",
              name: value34,
              set: value27 ? value28 : value6,
              newSet: value27,
              style: {
                ...current,
                fontSize: appendDefaultLengthUnit(current.fontSize),
                letterSpacing:
                  current.letterSpacing.trim() === ""
                    ? "0"
                    : appendDefaultLengthUnit(current.letterSpacing),
                lineHeight: current.lineHeight.trim(),
              },
              ...(ref3.current !== null
                ? {
                    font: ref3.current,
                  }
                : {}),
              usage: value50,
            });
            return;
          default:
            onSubmit({
              kind: req.kind,
              name: value34,
              value: validateNewTokenValue(req.kind, current2),
              usage: value50,
              ...(value3.length > 0
                ? {
                    group: value6,
                  }
                : {}),
            });
        }
      },
      callback11 = (event: React.KeyboardEvent) => {
        if (
          event.key === "Enter" &&
          (event.metaKey || event.ctrlKey) &&
          !(0, runtime.isComposingEvent)(event)
        ) {
          event.preventDefault();
          callback10();
        }
      },
      ref6 = runtime.reactDesignSystemEditors.useRef(value21),
      callback12 = (input: string, options: string) => {
        ref6.current = {
          ...ref6.current,
          [input]: options,
        };
        value22(ref6.current);
      },
      callback13 = (event: React.KeyboardEvent) => {
        if (
          event.key !== "Enter" ||
          !event.isDefaultPrevented() ||
          event.metaKey ||
          event.ctrlKey ||
          (0, runtime.isComposingEvent)(event)
        ) {
          return;
        }
        if (
          !(event.target instanceof HTMLInputElement) ||
          !event.target.matches(NUMBER_INPUT_SELECTOR)
        ) {
          return;
        }
        if (callback8(event.target, event.target.value.trim())) {
          callback10();
        }
      },
      state2: Record<string, string> = {
        color: value6 === "" ? "e.g. white" : "e.g. brand-500",
        type: "e.g. heading-lg",
        spacing: "e.g. space-md",
        radius: "e.g. radius-md",
        shadow: "e.g. shadow-sm",
        extra: "e.g. token-1",
      },
      value45 = (
        <AddDialogField
          label={
            (
              {
                type: "Style name",
                color: "Color name",
              } as Record<string, string>
            )[req.kind] ?? "Name"
          }
          hint={value37}
        >
          <runtime.TextInput
            {...PASSWORD_MANAGER_IGNORE_PROPS}
            ref={ref2}
            className={"font-mono"}
            value={value15}
            placeholder={state2[req.kind]}
            spellCheck={false}
            aria-label={"Name"}
            data-testid={dataTestid + "-name"}
            onChange={(
              input: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
            ) => {
              value18(true);
              value16(input.currentTarget.value);
            }}
          />
        </AddDialogField>
      ),
      callback14 = (
        input: string,
        items: {
          value: string;
          label: string;
        }[],
        context: string,
        value49 = true,
      ) => (
        <jsxAddTokenDialog.Fragment>
          {[
            <AddDialogFieldGroup
              label={input}
              testid={dataTestid + "-" + input.toLowerCase() + "-row"}
            >
              <runtime.Select
                popupAttrs={runtime.UNCOMMENTABLE_PROPS}
                items={
                  value49
                    ? [
                        ...items,
                        {
                          value: NEW_TOKEN_GROUP_SENTINEL,
                          label: "New " + input.toLowerCase() + "…",
                          separatorBefore: items.length > 0,
                        },
                      ]
                    : items
                }
                value={value6}
                aria-label={input}
                data-testid={dataTestid + "-" + input.toLowerCase()}
                onChange={callback4}
              />
            </AddDialogFieldGroup>,
            value27 ? (
              <AddDialogField label={input + " name"} hint={value33}>
                <runtime.TextInput
                  {...PASSWORD_MANAGER_IGNORE_PROPS}
                  data-field={"fresh"}
                  value={value8}
                  placeholder={context}
                  maxLength={runtime.MAX_TOKEN_LABEL_LENGTH}
                  spellCheck={false}
                  aria-label={input + " name"}
                  data-testid={
                    dataTestid +
                    "-" +
                    (input === "Set" ? "set" : "group") +
                    "-name"
                  }
                  onChange={(input2: React.ChangeEvent<HTMLInputElement>) => {
                    let value50 = input2.currentTarget.value;
                    value14(true);
                    value9(value50);
                    callback3(NEW_TOKEN_GROUP_SENTINEL, value50);
                  }}
                />
              </AddDialogField>
            ) : null,
          ]}
        </jsxAddTokenDialog.Fragment>
      ),
      value46 = (
        <AddDialogField label={"Usage note"} top={true}>
          <runtime.TextArea
            {...PASSWORD_MANAGER_IGNORE_PROPS}
            rows={2}
            autosize={true}
            resize={"none"}
            value={value19}
            placeholder={
              // CucCut: user-facing copy calls the agent "the agent", not Claude.
              "Optional — when should the agent use " +
              (value35 ? "it" : value34) +
              "?"
            }
            aria-label={"Usage note"}
            data-testid={dataTestid + "-usage"}
            onChange={(
              input: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
            ) => value20(input.currentTarget.value)}
            onKeyDown={callback11}
          />
        </AddDialogField>
      ),
      value47: React.ReactNode,
      value48: React.ReactNode = null;
    switch (req.kind) {
      case "color": {
        value48 = (
          <div
            className={"ds-well ds-addd-well"}
            aria-hidden={"true"}
            data-testid={dataTestid + "-preview"}
          >
            {value40.map((input, options) => {
              let value49 = (0, runtime.normalizeColorEditorInput)(
                  value21[input.id] ?? "",
                ),
                value50 = (0, runtime.normalizeColorEditorInput)(
                  value21[value41 ?? ""] ?? "",
                ),
                value51 = (0, runtime.isColorLiteral)(value49)
                  ? value49
                  : options > 0 && (0, runtime.isColorLiteral)(value50)
                    ? value50
                    : undefined;
              return (() => {
                const _Element = "span";
                const _elementProps = {
                  className: "ds-addd-swatch",
                  style:
                    value51 !== undefined
                      ? {
                          background: value51,
                        }
                      : undefined,
                  title: input.name,
                };
                const _elementKey = input.id;
                return <_Element key={_elementKey} {..._elementProps} />;
              })();
            })}
          </div>
        );
        value47 = (
          <jsxAddTokenDialog.Fragment>
            {[
              callback14(
                "Group",
                req.groups.map((input) => ({
                  value: input.key,
                  label: input.label,
                })),
                "e.g. brand",
              ),
              value45,
              value40.map((input, options) => {
                let value49 = (0, runtime.normalizeColorEditorInput)(
                    value21[input.id] ?? "",
                  ),
                  value50 = (0, runtime.normalizeColorEditorInput)(
                    value21[value41 ?? ""] ?? "",
                  );
                return (() => {
                  const _Element2 = "div";
                  const _elementProps2 = {
                    className:
                      "ds-addd-crow [--pp-gutter-l:0px] [--pp-gutter-r:0px] [--prop-row-h:24px]",
                    "data-testid": dataTestid + "-value-" + input.id,
                    children: (
                      <runtime.ColorTextPropertyRow
                        label={value40.length > 1 ? input.name : "Value"}
                        popupAttrs={(0, runtime.commentTargetProps)(
                          "picker",
                          "add-dialog:" + input.id,
                        )}
                        value={
                          value49 !== "" && (0, runtime.isColorLiteral)(value49)
                            ? value49
                            : undefined
                        }
                        {...(options > 0
                          ? {
                              clearLabel:
                                "Inherits " + (value40[0]?.name ?? ""),
                              ...((0, runtime.isColorLiteral)(value50)
                                ? {
                                    placeholder: value50,
                                  }
                                : {}),
                            }
                          : {})}
                        onChange={(input2: string | undefined) =>
                          callback12(input.id, input2 ?? "")
                        }
                      />
                    ),
                  };
                  const _elementKey2 = input.id;
                  return <_Element2 key={_elementKey2} {..._elementProps2} />;
                })();
              }),
              value46,
            ]}
          </jsxAddTokenDialog.Fragment>
        );
        break;
      }
      case "shadow": {
        value47 = (
          <jsxAddTokenDialog.Fragment>
            {[
              value45,
              value40.map((input, options) =>
                (() => {
                  const _Element3 = AddDialogField;
                  const _elementProps3 = {
                    label: value40.length > 1 ? input.name : "Value",
                    hint: state[input.id] ?? null,
                    testid: dataTestid + "-value-" + input.id,
                    children: (
                      <runtime.ShadowValueEditor
                        label={input.name + " value"}
                        anchorKey={"add-dialog:" + input.id}
                        value={value21[input.id] ?? ""}
                        onChange={(input2: string | undefined) =>
                          callback12(input.id, input2 as string)
                        }
                        testid={dataTestid + "-chip-" + input.id}
                        {...(options > 0
                          ? {
                              clear: {
                                label: "Inherit " + (value40[0]?.name ?? ""),
                                run: () => callback12(input.id, ""),
                              },
                            }
                          : {})}
                      />
                    ),
                  };
                  const _elementKey3 = input.id;
                  return <_Element3 key={_elementKey3} {..._elementProps3} />;
                })(),
              ),
              value46,
            ]}
          </jsxAddTokenDialog.Fragment>
        );
        let value49 = (value21[value41 ?? ""] ?? "").trim();
        value48 = (
          <div
            className={"ds-well ds-addd-well"}
            aria-hidden={"true"}
            data-testid={dataTestid + "-preview"}
          >
            <span
              className={"ds-shadow-surface"}
              style={
                (0, runtime.isSafeBoxShadow)(value49)
                  ? {
                      boxShadow: value49,
                    }
                  : undefined
              }
            />
          </div>
        );
        break;
      }
      case "type": {
        let value49 =
            value10 !== null
              ? "'" + value10 + "', sans-serif"
              : (req.families[value25.family] ??
                Object.values(req.families)[0] ??
                "system-ui, sans-serif"),
          value50 = (0, runtime.typeStylePreviewStyle)(
            {
              name: value34,
              fontSize: appendDefaultLengthUnit(value25.fontSize),
              lineHeight: value25.lineHeight,
              fontWeight: value25.fontWeight,
              letterSpacing:
                value25.letterSpacing.trim() === ""
                  ? "0"
                  : appendDefaultLengthUnit(value25.letterSpacing),
              fontStyle: value25.fontStyle,
            },
            value49,
          ),
          value51 = Math.min(
            56,
            Math.max(
              14,
              (0, runtime.parseEditableCssLength)(
                appendDefaultLengthUnit(value25.fontSize),
              )?.unit === "px"
                ? ((0, runtime.parseEditableCssLength)(
                    appendDefaultLengthUnit(value25.fontSize),
                  )?.n ?? 16)
                : 16 *
                    ((0, runtime.parseEditableCssLength)(
                      appendDefaultLengthUnit(value25.fontSize),
                    )?.n ?? 1),
            ),
          );
        value48 = (
          <div
            className={"ds-well ds-twell ds-addd-well"}
            data-testid={dataTestid + "-specimen"}
          >
            <span
              className={"ds-spec ds-taa text-primary"}
              style={{
                ...value50,
                fontSize: String(value51) + "px",
                lineHeight: 1,
              }}
            >
              {"Aa"}
            </span>
          </div>
        );
        let callback15 = (input: keyof NewTypeStyle, options: string) => {
          if (input === "family") {
            callback(null);
          }
          callback5((input2) =>
            input === "family"
              ? {
                  ...input2,
                  family: options,
                }
              : input === "fontSize"
                ? {
                    ...input2,
                    fontSize: options,
                  }
                : input === "fontWeight"
                  ? {
                      ...input2,
                      fontWeight: options,
                    }
                  : input === "lineHeight"
                    ? {
                        ...input2,
                        lineHeight: options,
                      }
                    : input === "letterSpacing"
                      ? {
                          ...input2,
                          letterSpacing: options,
                        }
                      : input2,
          );
        };
        value47 = (
          <jsxAddTokenDialog.Fragment>
            {[
              callback14(
                "Set",
                req.sets.map((input) => ({
                  value: input,
                  label: input,
                })),
                "e.g. Display",
              ),
              value45,
              <runtime.TypeStyleFields
                v={{
                  family: value10 !== null ? "" : value25.family,
                  fontSize: appendDefaultLengthUnit(value25.fontSize),
                  fontWeight: value25.fontWeight,
                  lineHeight: value25.lineHeight,
                  letterSpacing: value25.letterSpacing,
                }}
                fontLabel={value10 ?? undefined}
                families={req.families}
                familyNames={req.familyNames}
                fontNames={req.fontNames}
                onField={callback15}
                onFont={(input: string) => {
                  callback(input);
                  callback5((input2) => ({
                    ...input2,
                    family: "",
                  }));
                }}
                testid={dataTestid}
                inputRef={ignorePasswordManagerForInput}
                row={(input: string, options: React.ReactNode) =>
                  input === "Font" ? (
                    <AddDialogField label={input} hint={value12}>
                      {options}
                    </AddDialogField>
                  ) : (
                    <AddDialogFieldGroup label={input}>
                      {options}
                    </AddDialogFieldGroup>
                  )
                }
              />,
              value46,
            ]}
          </jsxAddTokenDialog.Fragment>
        );
        break;
      }
      default: {
        let value49 = validateNewTokenValue(req.kind, value23),
          value50 =
            value49 !== undefined
              ? (0, runtime.cssLengthPreviewPixels)(value49)
              : null;
        if (req.kind === "spacing") {
          value48 = (
            <div
              className={"ds-well ds-addd-well"}
              aria-hidden={"true"}
              data-testid={dataTestid + "-preview"}
            >
              <span
                className={"ds-addd-gap"}
                style={{
                  gap:
                    String(value50 === null ? 0 : Math.min(120, value50)) +
                    "px",
                }}
              >
                {[
                  <span className={"ds-addd-card"} />,
                  <span className={"ds-addd-card"} />,
                ]}
              </span>
            </div>
          );
        } else if (req.kind === "radius") {
          value48 = (
            <div
              className={"ds-well ds-addd-well"}
              aria-hidden={"true"}
              data-testid={dataTestid + "-preview"}
            >
              <span
                className={"ds-addd-card ds-addd-corner"}
                style={{
                  borderTopLeftRadius:
                    value50 === null ? 0 : Math.min(60, value50),
                }}
              />
            </div>
          );
        }
        let value51: React.ReactNode;
        if (req.kind === "spacing" || req.kind === "radius") {
          let value52 = (0, runtime.parseEditableCssLength)(
            appendDefaultLengthUnit(value23),
          ) ?? {
            n: 0,
            unit: "px",
          };
          value51 = (
            <AddDialogField
              label={"Value"}
              hint={value42}
              testid={dataTestid + "-value"}
              knob={"value"}
            >
              <runtime.PropertyNumberInput
                aria-label={"Value"}
                inputRef={ignorePasswordManagerForInput}
                refuseLetters={true}
                unit={value52.unit}
                value={value52.n}
                min={0}
                max={runtime.MAX_EDITABLE_CSS_LENGTH}
                step={(0, runtime.cssLengthInputStep)(value52.unit)}
                onValue={(input: number | undefined) => {
                  if (input !== undefined) {
                    callback6(formatNumberWithUnit(input, value52.unit));
                  }
                }}
              />
            </AddDialogField>
          );
        } else {
          value51 = (
            <AddDialogField label={"Value"} hint={value42}>
              <runtime.TextInput
                {...PASSWORD_MANAGER_IGNORE_PROPS}
                className={"font-mono"}
                value={value23}
                spellCheck={false}
                aria-label={"Value"}
                data-testid={dataTestid + "-value"}
                onChange={(
                  input: React.ChangeEvent<
                    HTMLInputElement | HTMLTextAreaElement
                  >,
                ) => callback6(input.currentTarget.value)}
              />
            </AddDialogField>
          );
        }
        value47 = (
          <jsxAddTokenDialog.Fragment>
            {[
              value3.length > 1
                ? callback14(
                    "Group",
                    value3.map((input) => ({
                      value: input.key,
                      label: input.label,
                    })),
                    "",
                    false,
                  )
                : null,
              value45,
              value51,
              value46,
            ]}
          </jsxAddTokenDialog.Fragment>
        );
      }
    }
    return (
      <div className={"contents"} {...runtime.BLOCK_FILE_DROP_HANDLERS}>
        <runtime.CdsRoot density={"compact"} className={"contents"}>
          <runtime.Dialog.Root
            open={true}
            onOpenChange={(input: boolean) => {
              if (!input) {
                onClose();
              }
            }}
          >
            <runtime.Dialog.Popup
              size={"sm"}
              className={"max-w-[22.5rem]"}
              aria-label={addTokenDialogTitle(req)}
              data-testid={dataTestid}
              {...(0, runtime.commentTargetProps)("dialog", "add")}
            >
              {[
                <runtime.Dialog.Header showClose={true}>
                  {addTokenDialogTitle(req)}
                </runtime.Dialog.Header>,
                <form
                  ref={ref}
                  className={
                    "ds-addd-form flex flex-col gap-2 [--pp-label-w:6rem]"
                  }
                  autoComplete={"off"}
                  noValidate={true}
                  onSubmit={callback10}
                  onKeyDown={callback13}
                >
                  {[
                    value48,
                    value47,
                    <runtime.Dialog.Footer align={"end"}>
                      {[
                        <runtime.Button
                          variant={"ghost"}
                          onClick={onClose}
                          data-testid={dataTestid + "-cancel"}
                        >
                          {"Cancel"}
                        </runtime.Button>,
                        <runtime.Button
                          variant={"primary"}
                          type={"submit"}
                          disabled={!value44}
                          data-testid={dataTestid + "-submit"}
                        >
                          {"Add"}
                        </runtime.Button>,
                      ]}
                    </runtime.Dialog.Footer>,
                  ]}
                </form>,
              ]}
            </runtime.Dialog.Popup>
          </runtime.Dialog.Root>
        </runtime.CdsRoot>
      </div>
    );
  }
  bindRuntimeValue(
    runtime,
    "jsxAddTokenDialog",
    () => jsxAddTokenDialog,
    (value) => {
      jsxAddTokenDialog = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "NEW_TOKEN_GROUP_SENTINEL",
    () => NEW_TOKEN_GROUP_SENTINEL,
    (value) => {
      NEW_TOKEN_GROUP_SENTINEL = value;
    },
  );
  bindRuntimeValue(runtime, "addTokenDialogTitle", () => addTokenDialogTitle);
  bindRuntimeValue(
    runtime,
    "normalizeNewTokenName",
    () => normalizeNewTokenName,
  );
  bindRuntimeValue(
    runtime,
    "validateNewColorValue",
    () => validateNewColorValue,
  );
  bindRuntimeValue(
    runtime,
    "normalizeNewColorValue",
    () => normalizeNewColorValue,
  );
  bindRuntimeValue(
    runtime,
    "appendDefaultLengthUnit",
    () => appendDefaultLengthUnit,
  );
  bindRuntimeValue(
    runtime,
    "TOKEN_LENGTH_VALIDATION_MESSAGES",
    () => TOKEN_LENGTH_VALIDATION_MESSAGES,
    (value) => {
      TOKEN_LENGTH_VALIDATION_MESSAGES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "validateNewTokenValue",
    () => validateNewTokenValue,
  );
  bindRuntimeValue(runtime, "validateNewTypeField", () => validateNewTypeField);
  bindRuntimeValue(
    runtime,
    "PASSWORD_MANAGER_IGNORE_PROPS",
    () => PASSWORD_MANAGER_IGNORE_PROPS,
    (value) => {
      PASSWORD_MANAGER_IGNORE_PROPS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ignorePasswordManagerForInput",
    () => ignorePasswordManagerForInput,
  );
  bindRuntimeValue(
    runtime,
    "formatNumberWithUnit",
    () => formatNumberWithUnit,
    (value) => {
      formatNumberWithUnit = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "NUMBER_INPUT_SELECTOR",
    () => NUMBER_INPUT_SELECTOR,
    (value) => {
      NUMBER_INPUT_SELECTOR = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "stripAddDialogNamespace",
    () => stripAddDialogNamespace,
    (value) => {
      stripAddDialogNamespace = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ADD_DIALOG_ROW_CLASS_NAME",
    () => ADD_DIALOG_ROW_CLASS_NAME,
    (value) => {
      ADD_DIALOG_ROW_CLASS_NAME = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ADD_DIALOG_HELP_CLASS_NAME",
    () => ADD_DIALOG_HELP_CLASS_NAME,
    (value) => {
      ADD_DIALOG_HELP_CLASS_NAME = value;
    },
  );
  bindRuntimeValue(runtime, "AddDialogField", () => AddDialogField);
  bindRuntimeValue(runtime, "AddDialogFieldGroup", () => AddDialogFieldGroup);
  bindRuntimeValue(runtime, "AddTokenDialog", () => AddTokenDialog);
  return () => {
    jsxAddTokenDialog = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
    NEW_TOKEN_GROUP_SENTINEL = "\x00new";
    TOKEN_LENGTH_VALIDATION_MESSAGES = {
      spacing: "Not a length — try 8px or 0.5rem.",
      radius: "Not a length — try 8px or 0.5rem.",
      extra: "Not a plain CSS value.",
    };
    PASSWORD_MANAGER_IGNORE_PROPS = {
      autoComplete: "off",
      "data-1p-ignore": "true",
      "data-lpignore": "true",
      "data-bwignore": "true",
      "data-form-type": "other",
    };
    formatNumberWithUnit = (value: number, unit: string) =>
      String(Math.round(value * 1e6) / 1e6) + unit;
    NUMBER_INPUT_SELECTOR = '[data-cds="NumberInput"] input';
    stripAddDialogNamespace = (name: string, namespace: string) =>
      namespace !== "" &&
      name.startsWith(namespace) &&
      name.length > namespace.length
        ? name.slice(namespace.length)
        : name;
    ADD_DIALOG_ROW_CLASS_NAME =
      "ds-addd-row grid grid-cols-[var(--pp-label-w)_minmax(0,1fr)] items-center gap-x-sm gap-y-1";
    ADD_DIALOG_HELP_CLASS_NAME =
      "truncate text-footnote font-normal leading-normal text-muted select-none";
  };
}
