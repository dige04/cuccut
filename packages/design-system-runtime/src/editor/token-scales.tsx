import type * as React from "react";
import type * as Token from "../contracts/token-editors";
import type * as Model from "../contracts";
import type * as Color from "../contracts/color-controls";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installEditorTokenScales(runtime: RuntimeBindings): () => void {
  var jsxTokenScales: typeof import("react/jsx-runtime");
  var TOKEN_SCALE_CSS_LENGTH_PATTERN: RegExp;
  var TOKEN_SCALE_SECTION_IDS: Record<Token.ScaleKind, string>;
  var TOKEN_SCALE_VALIDATION_MESSAGES: Record<Token.ScaleKind, string>;
  var TOKEN_SCALE_LABELS: Record<Token.ScaleKind, string>;
  var GROUPABLE_TOKEN_SCALE_KINDS: Set<Token.ScaleKind>;
  function cssLengthPreviewPixels(value: string): number | null {
    if (value === "0") {
      return 0;
    }
    let match = TOKEN_SCALE_CSS_LENGTH_PATTERN.exec(value);
    if (match === null) {
      return null;
    }
    let number: number = Number(match[1] ?? "0");
    switch (match[2] ?? "px") {
      case "px":
        return number;
      case "rem":
      case "em":
        return number * 16;
      default:
        return (number / 100) * 320;
    }
  }
  function PlainTokenValueEditor({
    t: t,
    edit: edit,
    testid: testid,
  }: Token.PlainTokenValueEditorProps): React.ReactElement {
    let value = (0, runtime.useTextCommit)({
      value: t.value,
      validate: (input: string) =>
        (0, runtime.normalizeScalarTokenValue)("extra", input) === undefined
          ? TOKEN_SCALE_VALIDATION_MESSAGES.extra
          : null,
      commit: (input: string): void => {
        edit.value(t.name, input);
        edit.done();
      },
    });
    return (
      <runtime.FieldComponents.Root
        invalid={value.error !== null}
        className={"min-w-0 flex-1"}
        data-testid={"ds-strip-value"}
      >
        {[
          <runtime.TextInput
            {...value.props}
            className={"font-mono"}
            aria-label={t.name + " value"}
            data-testid={testid}
            spellCheck={false}
            autoComplete={"off"}
          />,
          value.error !== null ? (
            <runtime.FieldComponents.Error match={true}>
              {value.error}
            </runtime.FieldComponents.Error>
          ) : null,
        ]}
      </runtime.FieldComponents.Root>
    );
  }
  function LengthTokenValueEditor({
    t: t,
    kind: kind,
    edit: edit,
    testid: testid,
  }: Token.LengthTokenValueEditorProps): React.ReactElement {
    let value = (0, runtime.parseEditableCssLength)(t.value) ?? {
        n: 0,
        unit: "px",
      },
      callback = (input: number): string =>
        String(Math.round(input * 1000) / 1000) + value.unit,
      callback2 = (input: number | undefined): void => {
        if (input === undefined) {
          return;
        }
        let value2 = callback(input);
        if (
          (0, runtime.normalizeScalarTokenValue)(kind, value2) !== undefined
        ) {
          edit.value(t.name, value2);
          edit.done();
        }
      };
    return (
      <span
        className={"block w-full min-w-0 max-w-[9rem]"}
        data-testid={testid}
      >
        <runtime.PropertyNumberInput
          aria-label={t.name + " value"}
          refuseLetters={true}
          fullWidth={true}
          unit={value.unit}
          value={value.n}
          min={0}
          max={runtime.MAX_EDITABLE_CSS_LENGTH}
          step={(0, runtime.cssLengthInputStep)(value.unit)}
          steppers={false}
          onValue={callback2}
          onScrub={(input: number): void => {
            let value2 = callback(input);
            if (
              (0, runtime.normalizeScalarTokenValue)(kind, value2) !== undefined
            ) {
              edit.value(t.name, value2);
            }
          }}
          onScrubEnd={() => edit.done()}
        />
      </span>
    );
  }
  function TokenScaleRow({
    t: t,
    kind: kind,
    section: section,
    taken: taken,
    edit: edit,
  }: Token.TokenScaleRowProps): React.ReactElement {
    let value = TOKEN_SCALE_SECTION_IDS[kind],
      value2 = (0, runtime.useRowContextMenu)(
        edit !== undefined || t.value !== "",
      ),
      callback = () =>
        document
          .querySelector<HTMLElement>(
            '[data-testid="ds-' + value + "-name-" + t.name + '"]',
          )
          ?.click(),
      value3: string = "ds-" + value + "-value-" + t.name;
    return (
      <div
        className={"ds-brow ds-tokrow ds-crow group/row"}
        role={"row"}
        data-testid={"ds-" + value + "-" + t.name}
        {...(0, runtime.commentTargetProps)("token", t.name)}
        {...value2.rowProps}
      >
        {[
          <span
            className={"ds-cname ds-brow-name min-w-0 font-mono"}
            role={"rowheader"}
          >
            <runtime.EditableName
              name={t.name}
              taken={taken}
              commit={
                edit === undefined
                  ? undefined
                  : (input: string) => edit.rename(t.name, input)
              }
              data-testid={"ds-" + value + "-name-" + t.name}
            />
          </span>,
          <span className={"ds-bcell ds-brow-val min-w-0 gap-xs"} role={"cell"}>
            {edit === undefined ? (
              <span
                className={
                  "ds-brow-value min-w-0 truncate font-mono text-body text-muted"
                }
                data-testid={value3}
              >
                {t.value}
              </span>
            ) : kind === "extra" ? (
              <PlainTokenValueEditor t={t} edit={edit} testid={value3} />
            ) : (
              <LengthTokenValueEditor
                t={t}
                kind={kind}
                edit={edit}
                testid={value3}
              />
            )}
          </span>,
          <span
            className={
              "ds-cacts ds-cgutter ds-brow-trash relative flex items-center justify-center"
            }
            role={"cell"}
            {...runtime.UNCOMMENTABLE_PROPS}
          >
            {[
              <runtime.UsageNoteEditor
                value={t.usage ?? ""}
                label={t.name}
                anchorKey={section + "/" + t.name}
                onChange={
                  edit === undefined
                    ? undefined
                    : (input: string) => edit.usage(t.name, input)
                }
                onDone={edit?.done}
                data-testid={"ds-" + value + "-usage-" + t.name}
              />,
              edit !== undefined ? (
                <runtime.RemoveRowButton
                  label={"Remove " + t.name}
                  onRemove={() => edit.remove(t.name)}
                  data-testid={"ds-" + value + "-remove-" + t.name}
                />
              ) : null,
            ]}
          </span>,
          <runtime.RowContextMenu
            title={t.name}
            at={value2.at}
            anchor={value2.anchor}
            onClose={value2.close}
            testid={"ds-" + value + "-menu-" + t.name}
            actions={{
              ...(edit !== undefined
                ? {
                    rename: callback,
                    remove: () => edit.remove(t.name),
                    removeLabel: "Remove " + t.name,
                  }
                : {}),
              copy: t.value,
            }}
          />,
        ]}
      </div>
    );
  }
  function tokenScaleGroups(
    kind: Token.ScaleKind,
    scale: Token.EditorScale,
  ): Token.ScaleGroup[] {
    if (scale.tokens.length === 0) {
      return [];
    } else {
      return [
        {
          kind: kind,
          name: "",
          tokens: scale.tokens,
        },
      ];
    }
  }
  function extraTokenScaleGroups(
    families: Token.ExtraScaleFamily[],
  ): Token.ScaleGroup[] {
    return families.map((input) => ({
      kind: "extra",
      name: "",
      tokens: input.scale.tokens,
      family: {
        key: input.key,
        title: input.title,
      },
    }));
  }
  function tokenScaleGroupId(group: Token.ScaleGroup): string {
    if (group.family !== undefined) {
      return "family:" + group.family.key;
    }
    return group.kind + (group.name === "" ? "" : ":" + group.name);
  }
  function tokenScaleGroupLabel(group: Token.ScaleGroup): string {
    if (group.name !== "") {
      return group.name;
    } else {
      return group.family?.title ?? TOKEN_SCALE_LABELS[group.kind];
    }
  }
  function groupedTokenScale(
    kind: Token.ScaleKind,
    tokens: Token.EditorScalarToken[],
  ): Token.TokenNameGroup<Token.EditorScalarToken>[] | null {
    if (!GROUPABLE_TOKEN_SCALE_KINDS.has(kind)) {
      return null;
    }
    let groups = (0, runtime.groupTokensByName)(tokens);
    if (groups.length > 1) {
      return groups;
    } else {
      return null;
    }
  }
  function TokenScaleSections({
    groups: groups,
    editFor: editFor,
    headFor: headFor,
  }: Token.TokenScaleSectionsProps): React.ReactElement | null {
    if (groups.length === 0) {
      return null;
    }
    return (
      <div className={"ds-scales flex flex-col"}>
        {groups.map((source) => {
          let value = editFor?.(source),
            values = new Set(source.tokens.map((input) => input.name)),
            value2 = headFor?.(source) ?? {
              title: tokenScaleGroupLabel(source),
            },
            value3: string =
              source.family !== undefined
                ? "ds-family-" + source.family.key
                : "ds-" + TOKEN_SCALE_SECTION_IDS[source.kind];
          return (() => {
            const _Element2 = runtime.TokenTableSection;
            const _elementProps2 = {
              className: "ds-scale ds-scale-" + source.kind,
              name: null,
              "data-testid": value3,
              "aria-label": value2.title,
              children: (
                <div className={"ds-srows"}>
                  <div
                    className={"ds-bars ds-ctable"}
                    role={"table"}
                    aria-label={
                      source.family?.title ?? TOKEN_SCALE_LABELS[source.kind]
                    }
                    data-edit={value !== undefined ? "" : undefined}
                  >
                    {[
                      <div
                        className={
                          "ds-brow ds-crow ds-chead text-caption text-muted"
                        }
                        role={"row"}
                        {...runtime.UNCOMMENTABLE_PROPS}
                      >
                        {[
                          <span role={"columnheader"}>{"Name"}</span>,
                          <span role={"columnheader"}>{"Value"}</span>,
                          <span
                            className={"ds-cgutter"}
                            aria-hidden={"true"}
                          />,
                        ]}
                      </div>,
                      source.tokens.map((input) =>
                        (() => {
                          const _Element = TokenScaleRow;
                          const _elementProps = {
                            t: input,
                            kind: source.kind,
                            section:
                              source.family !== undefined
                                ? "family-" + source.family.key
                                : TOKEN_SCALE_SECTION_IDS[source.kind],
                            taken: values,
                            edit: value,
                          };
                          const _elementKey = input.name;
                          return (
                            <_Element key={_elementKey} {..._elementProps} />
                          );
                        })(),
                      ),
                    ]}
                  </div>
                </div>
              ),
            };
            const _elementKey2 = tokenScaleGroupId(source);
            return <_Element2 key={_elementKey2} {..._elementProps2} />;
          })();
        })}
      </div>
    );
  }
  bindRuntimeValue(
    runtime,
    "jsxTokenScales",
    () => jsxTokenScales,
    (value) => {
      jsxTokenScales = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TOKEN_SCALE_CSS_LENGTH_PATTERN",
    () => TOKEN_SCALE_CSS_LENGTH_PATTERN,
    (value) => {
      TOKEN_SCALE_CSS_LENGTH_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "cssLengthPreviewPixels",
    () => cssLengthPreviewPixels,
  );
  bindRuntimeValue(
    runtime,
    "TOKEN_SCALE_SECTION_IDS",
    () => TOKEN_SCALE_SECTION_IDS,
    (value) => {
      TOKEN_SCALE_SECTION_IDS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TOKEN_SCALE_VALIDATION_MESSAGES",
    () => TOKEN_SCALE_VALIDATION_MESSAGES,
    (value) => {
      TOKEN_SCALE_VALIDATION_MESSAGES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlainTokenValueEditor",
    () => PlainTokenValueEditor,
  );
  bindRuntimeValue(
    runtime,
    "LengthTokenValueEditor",
    () => LengthTokenValueEditor,
  );
  bindRuntimeValue(runtime, "TokenScaleRow", () => TokenScaleRow);
  bindRuntimeValue(runtime, "tokenScaleGroups", () => tokenScaleGroups);
  bindRuntimeValue(
    runtime,
    "extraTokenScaleGroups",
    () => extraTokenScaleGroups,
  );
  bindRuntimeValue(runtime, "tokenScaleGroupId", () => tokenScaleGroupId);
  bindRuntimeValue(
    runtime,
    "TOKEN_SCALE_LABELS",
    () => TOKEN_SCALE_LABELS,
    (value) => {
      TOKEN_SCALE_LABELS = value;
    },
  );
  bindRuntimeValue(runtime, "tokenScaleGroupLabel", () => tokenScaleGroupLabel);
  bindRuntimeValue(
    runtime,
    "GROUPABLE_TOKEN_SCALE_KINDS",
    () => GROUPABLE_TOKEN_SCALE_KINDS,
    (value) => {
      GROUPABLE_TOKEN_SCALE_KINDS = value;
    },
  );
  bindRuntimeValue(runtime, "groupedTokenScale", () => groupedTokenScale);
  bindRuntimeValue(runtime, "TokenScaleSections", () => TokenScaleSections);
  return () => {
    jsxTokenScales = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
    TOKEN_SCALE_CSS_LENGTH_PATTERN = /^(\d{1,4}(?:\.\d{1,6})?)(px|rem|em|%)$/;
    TOKEN_SCALE_SECTION_IDS = {
      spacing: "spacing",
      radius: "corners",
      extra: "family",
    };
    TOKEN_SCALE_VALIDATION_MESSAGES = {
      spacing: "Not a length",
      radius: "Not a length",
      extra: "Not a plain CSS value",
    };
    TOKEN_SCALE_LABELS = {
      spacing: "Spacing",
      radius: "Corner radius",
      extra: "Tokens",
    };
    GROUPABLE_TOKEN_SCALE_KINDS = new Set(["spacing"]);
  };
}
