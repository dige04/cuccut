import type * as React from "react";
import type * as Editor from "../contracts/editor-runtime";
import type * as Model from "../contracts";
import type * as Application from "../contracts/application";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installEditorComponents(runtime: RuntimeBindings): () => void {
  var reactComponentsSection: typeof import("react");
  var DEFAULT_EDITOR_FEATURE_FLAGS: Partial<Record<string, boolean>>;
  var isEditorFeatureEnabled: (flag: string, queryKey: string) => boolean;
  var editorFeatureFlags: {
    componentProps: boolean;
  };
  var jsxComponentsSection: typeof import("react/jsx-runtime");
  var normalizedComponentTitle: (title: string) => string;
  var DEFAULT_COMPONENT_STAGE_HEIGHT: number;
  var MAX_COMPONENT_STAGE_HEIGHT: number;
  var clampComponentStageHeight: (height: number | undefined) => number;
  var componentStageStyle: (
    component: Application.EditorComponent,
  ) => React.CSSProperties;
  var EMPTY_COMPONENT_PROPS: Model.InferredPropControl[];
  function hasEditorFlagInLocation(
    location2: Pick<Location, "search" | "hash"> | undefined,
    key: string,
  ): boolean {
    try {
      if (location2 === undefined) {
        return false;
      }
      if (new URLSearchParams(location2.search).get(key) === "1") {
        return true;
      }
      return location2.hash.replace(/^#/, "").split(/[&;]/).includes(key);
    } catch {
      return false;
    }
  }
  function hasEditorFlagInParentLocation(key: string): boolean {
    let value: Location | undefined, value2: Location | undefined;
    try {
      value = globalThis.location;
    } catch {
      value = undefined;
    }
    try {
      value2 =
        globalThis.parent !== undefined && globalThis.parent !== globalThis.self
          ? globalThis.parent.location
          : undefined;
    } catch {
      value2 = undefined;
    }
    return (
      hasEditorFlagInLocation(value, key) ||
      hasEditorFlagInLocation(value2, key)
    );
  }
  function hasEditorFlagInStorage(key: string): boolean {
    try {
      return globalThis.localStorage?.getItem("ds.flags." + key) === "1";
    } catch {
      return false;
    }
  }
  function stripMatchingComponentHeading(
    markdown: string,
    name: string,
  ): string {
    let value = /^\s*#[ \t]+([^\n]*)\n?/.exec(markdown);
    if (value === null) {
      return markdown;
    }
    let value2 = normalizedComponentTitle(value[1] ?? ""),
      value3 = normalizedComponentTitle(name);
    if (
      value3 === "" ||
      (value2 !== value3 && value2 !== value3 + "s" && value2 !== value3 + "es")
    ) {
      return markdown;
    }
    return markdown.slice(value[0].length);
  }
  function ensureComponentGuidelinesHeading(
    markdown: string,
    name: string,
    heading: string,
  ): string {
    let value = heading.trim() !== "" ? heading.trim() : "# " + name;
    if (markdown.trim() === "") {
      return (
        value +
        `
`
      );
    }
    if (stripMatchingComponentHeading(markdown, name) !== markdown) {
      return markdown;
    }
    return (
      value +
      `

` +
      markdown
    );
  }
  function EmptyComponentPreview({
    name: name,
  }: {
    name: string;
  }): React.ReactElement {
    return (
      <p className={"ds-stage-doc ds-pad py-md text-body text-secondary"}>
        {[
          // CucCut: user-facing copy calls the agent "the agent", not Claude.
          "No preview yet — ask the agent for components/",
          name,
          "/preview.html.",
        ]}
      </p>
    );
  }
  function ComponentStage({
    c: c,
    mode: mode,
    tweaks: tweaks,
    renderPreview: renderPreview,
  }: Editor.ComponentStageProps): React.ReactElement {
    if (c.previewHtml === undefined) {
      return <EmptyComponentPreview name={c.name} />;
    }
    let value = clampComponentStageHeight(c.previewHeight);
    return (
      <div
        className={"ds-comp-preview-box"}
        style={
          c.previewWidth === undefined
            ? {
                minHeight: value,
              }
            : undefined
        }
        data-mode={mode}
        data-tweaked={tweaks !== undefined ? "" : undefined}
      >
        {renderPreview(
          c,
          {
            height: value,
          },
          mode,
          tweaks,
        )}
      </div>
    );
  }
  function ComponentGuidelines({
    c: c,
    edit: edit,
  }: Editor.ComponentGuidelinesProps): React.ReactElement {
    let guidelines = c.guidelines ?? "",
      value = stripMatchingComponentHeading(guidelines, c.name),
      value2 = guidelines.slice(0, guidelines.length - value.length),
      ref = reactComponentsSection.useRef<string | null>(null);
    return (
      <runtime.UsageNoteEditor
        value={value}
        label={c.name}
        anchorKey={"comp/" + c.name}
        size={"doc"}
        placeholder={"Usage guidelines: when to use it, do/don't…"}
        data-testid={"ds-comp-guide-" + c.name}
        {...(edit !== undefined
          ? {
              onChange: (input: string): void => {
                ref.current = input.trim();
                edit.setGuidelines(
                  c.name,
                  ensureComponentGuidelinesHeading(input, c.name, value2),
                );
              },
              onDone: (): void => {
                if (ref.current === "") {
                  edit.setGuidelines(c.name, "");
                }
                ref.current = null;
                edit.done();
              },
            }
          : {})}
      />
    );
  }
  function ComponentPropField({
    spec: spec,
    value: value,
    placeholder: placeholder,
    onChange: onChange,
  }: Editor.ComponentPropFieldProps): React.ReactElement {
    let value2: string = "ds-prop-" + spec.name;
    if (spec.kind === "boolean") {
      return (
        <runtime.Switch
          checked={value === true}
          onCheckedChange={(input: boolean) => onChange(input)}
          aria-label={spec.name}
        />
      );
    }
    if (spec.kind === "enum") {
      return (
        <runtime.Select
          aria-label={spec.name}
          popupAttrs={runtime.UNCOMMENTABLE_PROPS}
          items={[
            {
              value: "",
              label: "—",
            },
            ...(spec.options ?? []).map((input) => ({
              value: input,
              label: input,
            })),
          ]}
          value={value === undefined ? "" : String(value)}
          onChange={(input: string) =>
            onChange(
              input === ""
                ? undefined
                : (0, runtime.coerceControlOption)(spec, input),
            )
          }
          data-testid={value2}
        />
      );
    }
    if (spec.kind === "number") {
      return (
        <span data-testid={value2} className={"contents"}>
          <runtime.PropertyNumberInput
            aria-label={spec.name}
            value={typeof value === "number" ? value : undefined}
            clearable={true}
            steppers={false}
            onValue={(input: number | undefined) => onChange(input)}
          />
        </span>
      );
    }
    return (
      <runtime.TextInput
        aria-label={spec.name}
        value={typeof value === "string" ? value : ""}
        placeholder={placeholder ?? spec.typeName ?? ""}
        onChange={(input: React.ChangeEvent<HTMLInputElement>) =>
          onChange(
            input.currentTarget.value === ""
              ? undefined
              : input.currentTarget.value,
          )
        }
        data-testid={value2}
      />
    );
  }
  function ComponentPropsEditor({
    c: c,
    specs: specs,
    values: values,
    onChange: onChange,
    onReset: onReset,
  }: Editor.ComponentPropsEditorProps): React.ReactElement {
    return (
      <div
        className={
          "ds-props-pop flex w-[min(18rem,calc(100vw-2rem))] flex-col py-xs [--pp-label-w:6rem]"
        }
        role={"group"}
        aria-label={c.name + " props"}
        data-testid={"ds-comp-props-" + c.name}
        {...(0, runtime.commentTargetProps)("props", c.name)}
      >
        {[
          <runtime.PropertySectionHeader
            title={<span className={"ds-pop-name"}>{"Props"}</span>}
            actions={
              values !== undefined ? (
                <runtime.Button
                  variant={"ghost"}
                  size={"xs"}
                  onClick={onReset}
                  data-testid={"ds-comp-props-reset-" + c.name}
                >
                  {"Reset"}
                </runtime.Button>
              ) : undefined
            }
          />,
          specs.length === 0 ? (
            <p className={"px-lg py-sm text-footnote text-muted"}>
              {"This component declares no props."}
            </p>
          ) : (
            <div className={"ds-props-list flex flex-col"}>
              {specs.map((source) =>
                (() => {
                  const _Element = runtime.PropertyRow;
                  const _elementProps = {
                    label: source.name,
                    title: source.typeName ?? source.kind,
                    labelProps: {
                      className: "font-mono",
                    },
                    className: "ds-prow",
                    ...(0, runtime.commentTargetProps)(
                      "prop",
                      c.name + "/" + source.name,
                    ),
                    children: (
                      <ComponentPropField
                        spec={source}
                        value={values?.[source.name] ?? source.default}
                        {...(source.name === "children"
                          ? {
                              placeholder: c.name,
                            }
                          : {})}
                        onChange={(
                          input: Editor.ComponentPropValue | undefined,
                        ) => onChange(source.name, input)}
                      />
                    ),
                  };
                  const _elementKey = source.name;
                  return <_Element key={_elementKey} {..._elementProps} />;
                })(),
              )}
            </div>
          ),
        ]}
      </div>
    );
  }
  function ComponentsSection({
    components: components,
    mode: mode,
    renderPreview: renderPreview,
    propsOf: propsOf,
    edit: edit,
    head: head,
    staticNote: staticNote,
    staticFiles: staticFiles,
  }: Editor.ComponentsSectionProps): React.ReactElement | null {
    let [value, value2] = reactComponentsSection.useState<string | null>(null),
      [value3, value4] = reactComponentsSection.useState<
        Record<string, Editor.ComponentPropValues>
      >({});
    if (components.length === 0) {
      return null;
    }
    let callback = (
        input: string,
        options: string,
        context: Editor.ComponentPropValue | undefined,
      ) =>
        value4((input2) => {
          let state = {
            ...(input2[input] ?? {}),
          };
          if (context === undefined) {
            delete state[options];
          } else {
            state[options] = context;
          }
          let state2 = {
            ...input2,
          };
          if (Object.keys(state).length === 0) {
            delete state2[input];
          } else {
            state2[input] = state;
          }
          return state2;
        }),
      callback2 = (input: string) =>
        value4((input2) => {
          if (!(input in input2)) {
            return input2;
          }
          let state = {
            ...input2,
          };
          delete state[input];
          return state;
        });
    return (
      <section
        className={"ds-components-sec"}
        aria-label={head?.title ?? "Components"}
        data-testid={"ds-components-pane"}
      >
        {[
          staticNote !== undefined &&
          staticNote !== "" &&
          components.some(
            (input): boolean => input.previewHtml !== undefined,
          ) ? (
            <div
              className={"ds-pad py-sm text-footnote text-muted"}
              role={"note"}
              data-testid={"ds-components-static-note"}
              {...runtime.UNCOMMENTABLE_PROPS}
            >
              {staticFiles !== undefined && staticFiles.length > 0 ? (
                <details>
                  {[
                    <summary className={"cursor-pointer"}>
                      {staticNote}
                    </summary>,
                    <ul
                      role={"list"}
                      className={"mt-xs font-mono break-all"}
                      data-testid={"ds-components-static-files"}
                    >
                      {staticFiles.map((input, options) =>
                        (() => {
                          const _Element2 = "li";
                          const _elementProps2 = {
                            children: input,
                          };
                          const _elementKey2 = options;
                          return (
                            <_Element2 key={_elementKey2} {..._elementProps2} />
                          );
                        })(),
                      )}
                    </ul>,
                  ]}
                </details>
              ) : (
                staticNote
              )}
            </div>
          ) : null,
          <div
            className={"ds-comptable"}
            role={"table"}
            aria-label={"Components"}
            data-testid={"ds-components"}
          >
            {[
              <div
                className={"ds-cmrow ds-chead text-caption text-muted"}
                role={"row"}
                {...runtime.UNCOMMENTABLE_PROPS}
              >
                {[
                  <span role={"columnheader"}>{"Name"}</span>,
                  <span role={"columnheader"}>{"Preview"}</span>,
                  <span className={"ds-cgutter"} aria-hidden={"true"} />,
                ]}
              </div>,
              components.map((input) => {
                let componentProps = editorFeatureFlags.componentProps,
                  value5 = componentProps
                    ? (propsOf?.(input) ?? EMPTY_COMPONENT_PROPS)
                    : EMPTY_COMPONENT_PROPS,
                  value6 = componentProps ? value3[input.name] : undefined,
                  value7: Editor.ComponentPropValues | undefined =
                    value6 === undefined
                      ? undefined
                      : Object.fromEntries([
                          ...value5.flatMap((input2) =>
                            input2.default !== undefined
                              ? [[input2.name, input2.default]]
                              : [],
                          ),
                          ...(value5.some(
                            (input2): boolean => input2.name === "children",
                          )
                            ? [["children", input.name]]
                            : []),
                          ...Object.entries(value6),
                        ]);
                return (() => {
                  const _Element3 = "div";
                  const _elementProps3 = {
                    className: "ds-cmrow ds-tokrow ds-comprow group/row",
                    role: "row",
                    "data-testid": "ds-comp-" + input.name,
                    ...(0, runtime.commentTargetProps)("comp", input.name),
                    children: [
                      <span
                        className={"ds-cmname flex min-w-0 flex-col gap-0.5"}
                        role={"rowheader"}
                      >
                        {[
                          <span className={"flex min-w-0 items-center gap-xs"}>
                            {[
                              <span
                                className={"ds-comprow-name min-w-0 truncate"}
                                data-testid={"ds-comp-name-" + input.name}
                              >
                                {input.name}
                              </span>,
                              componentProps ? (
                                <span
                                  className={
                                    "ds-cact-anchor relative inline-flex"
                                  }
                                  {...runtime.UNCOMMENTABLE_PROPS}
                                >
                                  {[
                                    <runtime.Button
                                      variant={"ghost"}
                                      size={"sm"}
                                      iconOnly={true}
                                      icon={"Filter"}
                                      className={(0, runtime.joinClassNames)(
                                        "ds-cact",
                                        value6 !== undefined &&
                                          "ds-cact-on text-accent",
                                      )}
                                      pressed={value === input.name}
                                      aria-label={"Props: " + input.name}
                                      tooltip={"Props"}
                                      aria-expanded={value === input.name}
                                      onClick={(
                                        input2: React.MouseEvent<HTMLButtonElement>,
                                      ): void => {
                                        input2.stopPropagation();
                                        value2(
                                          value !== input.name
                                            ? input.name
                                            : null,
                                        );
                                      }}
                                      data-testid={
                                        "ds-comp-props-btn-" + input.name
                                      }
                                    />,
                                    <runtime.PropertyPopup
                                      open={value === input.name}
                                      onClose={() => value2(null)}
                                      align={"left"}
                                      padding={"none"}
                                      aria-label={"Props: " + input.name}
                                    >
                                      {value === input.name ? (
                                        <ComponentPropsEditor
                                          c={input}
                                          specs={value5}
                                          values={value6}
                                          onChange={(
                                            input2: string,
                                            options:
                                              | Editor.ComponentPropValue
                                              | undefined,
                                          ) =>
                                            callback(
                                              input.name,
                                              input2,
                                              options,
                                            )
                                          }
                                          onReset={() => callback2(input.name)}
                                        />
                                      ) : null}
                                    </runtime.PropertyPopup>,
                                  ]}
                                </span>
                              ) : null,
                            ]}
                          </span>,
                          input.floor === true ? (
                            <span
                              className={
                                "ds-comp-floor w-fit text-caption text-muted"
                              }
                              data-floor={""}
                              title={
                                "A generated floor card: the repository has no story or docs example for this component"
                              }
                            >
                              {"no example"}
                            </span>
                          ) : null,
                        ]}
                      </span>,
                      <span className={"ds-cmprev min-w-0"} role={"cell"}>
                        <StickyComponentNote
                          reserve={
                            input.previewHtml !== undefined
                              ? componentStageStyle(input)
                              : undefined
                          }
                        >
                          <ComponentStage
                            c={input}
                            mode={mode}
                            tweaks={value7}
                            renderPreview={renderPreview}
                          />
                        </StickyComponentNote>
                      </span>,
                      <span
                        className={
                          "ds-cacts ds-cgutter relative flex items-start justify-center"
                        }
                        role={"cell"}
                        {...runtime.UNCOMMENTABLE_PROPS}
                      >
                        <ComponentGuidelines
                          c={input}
                          {...(edit !== undefined
                            ? {
                                edit: edit,
                              }
                            : {})}
                        />
                      </span>,
                    ],
                  };
                  const _elementKey3 = input.name;
                  return <_Element3 key={_elementKey3} {..._elementProps3} />;
                })();
              }),
            ]}
          </div>,
        ]}
      </section>
    );
  }
  function StickyComponentNote({
    children: children,
    reserve: reserve,
  }: {
    children: React.ReactNode;
    reserve?: React.CSSProperties;
  }): React.ReactElement {
    let ref = reactComponentsSection.useRef<HTMLSpanElement | null>(null),
      [value, value2] = reactComponentsSection.useState(false);
    reactComponentsSection.useLayoutEffect(() => {
      if (value) {
        return;
      }
      let current = ref.current;
      if (current === null) {
        return;
      }
      if (
        typeof IntersectionObserver === "undefined" ||
        current.getBoundingClientRect().top < (window.innerHeight || 800) + 400
      ) {
        value2(true);
        return;
      }
      let value3 = new IntersectionObserver(
        (input: IntersectionObserverEntry[]): void => {
          if (input.some((input2) => input2.isIntersecting)) {
            value2(true);
            value3.disconnect();
          }
        },
        {
          root: current.closest(".ds-main"),
          rootMargin: "400px 0px",
        },
      );
      value3.observe(current);
      return () => value3.disconnect();
    }, [value]);
    return (
      <span ref={ref} className={"ds-cmstage block"}>
        {value ? (
          children
        ) : (
          <span
            className={"ds-cmstage-ph block"}
            style={reserve}
            aria-hidden={"true"}
          />
        )}
      </span>
    );
  }
  bindRuntimeValue(
    runtime,
    "reactComponentsSection",
    () => reactComponentsSection,
    (value) => {
      reactComponentsSection = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DEFAULT_EDITOR_FEATURE_FLAGS",
    () => DEFAULT_EDITOR_FEATURE_FLAGS,
    (value) => {
      DEFAULT_EDITOR_FEATURE_FLAGS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "hasEditorFlagInLocation",
    () => hasEditorFlagInLocation,
  );
  bindRuntimeValue(
    runtime,
    "hasEditorFlagInParentLocation",
    () => hasEditorFlagInParentLocation,
  );
  bindRuntimeValue(
    runtime,
    "hasEditorFlagInStorage",
    () => hasEditorFlagInStorage,
  );
  bindRuntimeValue(
    runtime,
    "isEditorFeatureEnabled",
    () => isEditorFeatureEnabled,
    (value) => {
      isEditorFeatureEnabled = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "editorFeatureFlags",
    () => editorFeatureFlags,
    (value) => {
      editorFeatureFlags = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxComponentsSection",
    () => jsxComponentsSection,
    (value) => {
      jsxComponentsSection = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "normalizedComponentTitle",
    () => normalizedComponentTitle,
    (value) => {
      normalizedComponentTitle = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "stripMatchingComponentHeading",
    () => stripMatchingComponentHeading,
  );
  bindRuntimeValue(
    runtime,
    "ensureComponentGuidelinesHeading",
    () => ensureComponentGuidelinesHeading,
  );
  bindRuntimeValue(
    runtime,
    "DEFAULT_COMPONENT_STAGE_HEIGHT",
    () => DEFAULT_COMPONENT_STAGE_HEIGHT,
    (value) => {
      DEFAULT_COMPONENT_STAGE_HEIGHT = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_COMPONENT_STAGE_HEIGHT",
    () => MAX_COMPONENT_STAGE_HEIGHT,
    (value) => {
      MAX_COMPONENT_STAGE_HEIGHT = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "clampComponentStageHeight",
    () => clampComponentStageHeight,
    (value) => {
      clampComponentStageHeight = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "componentStageStyle",
    () => componentStageStyle,
    (value) => {
      componentStageStyle = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "EmptyComponentPreview",
    () => EmptyComponentPreview,
  );
  bindRuntimeValue(runtime, "ComponentStage", () => ComponentStage);
  bindRuntimeValue(runtime, "ComponentGuidelines", () => ComponentGuidelines);
  bindRuntimeValue(runtime, "ComponentPropField", () => ComponentPropField);
  bindRuntimeValue(runtime, "ComponentPropsEditor", () => ComponentPropsEditor);
  bindRuntimeValue(
    runtime,
    "EMPTY_COMPONENT_PROPS",
    () => EMPTY_COMPONENT_PROPS,
    (value) => {
      EMPTY_COMPONENT_PROPS = value;
    },
  );
  bindRuntimeValue(runtime, "ComponentsSection", () => ComponentsSection);
  bindRuntimeValue(runtime, "StickyComponentNote", () => StickyComponentNote);
  return () => {
    reactComponentsSection = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    DEFAULT_EDITOR_FEATURE_FLAGS = {
      componentProps: false,
    };
    isEditorFeatureEnabled = (flag: string, queryKey: string) =>
      DEFAULT_EDITOR_FEATURE_FLAGS[flag] ||
      hasEditorFlagInParentLocation(queryKey) ||
      hasEditorFlagInStorage(flag);
    editorFeatureFlags = {
      componentProps: isEditorFeatureEnabled("componentProps", "ds_props"),
    };
    jsxComponentsSection = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
    normalizedComponentTitle = (title: string) =>
      title.toLowerCase().replace(/[^a-z0-9]+/g, "");
    DEFAULT_COMPONENT_STAGE_HEIGHT = 120;
    MAX_COMPONENT_STAGE_HEIGHT = 4000;
    clampComponentStageHeight = (height: number | undefined): number =>
      height !== undefined && Number.isFinite(height)
        ? Math.min(MAX_COMPONENT_STAGE_HEIGHT, Math.max(40, Math.round(height)))
        : DEFAULT_COMPONENT_STAGE_HEIGHT;
    componentStageStyle = (component: Application.EditorComponent) => {
      let value = clampComponentStageHeight(component.previewHeight);
      if (component.previewWidth === undefined) {
        return {
          height: value,
        };
      } else {
        return {
          aspectRatio: String(component.previewWidth) + " / " + String(value),
          maxHeight: value,
        };
      }
    };
    EMPTY_COMPONENT_PROPS = [];
  };
}
