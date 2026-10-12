import type * as React from "react";
import type * as Editor from "../contracts/editor-runtime";
import type * as Model from "../contracts";
import type * as Application from "../contracts/application";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installEditorConflictBanners(
  runtime: RuntimeBindings,
): () => void {
  var reactConflictBanners: typeof import("react");
  var jsxConflictBanners: typeof import("react/jsx-runtime");
  var CONFLICT_COPIED_DURATION_MS: number;
  var isConflictTextFile: (path: string, value: string | null) => boolean;
  var conflictFileSummary: (path: string, value: string | null) => string;
  var EMPTY_CONFLICT_FLAGS: ReadonlyMap<string, Editor.ConflictFlag>;
  function sectionForFilePath(path: string): string {
    if (
      path === runtime.DESIGN_SYSTEM_PATHS.readme ||
      (0, runtime.isAdditionalMarkdownPath)(path)
    ) {
      return "readme";
    }
    if (path === runtime.DESIGN_SYSTEM_PATHS.tokens) {
      return "colors";
    }
    if (path.startsWith(runtime.DESIGN_SYSTEM_PATHS.fontsDir)) {
      return "type";
    }
    if (path.startsWith(runtime.DESIGN_SYSTEM_PATHS.assetsDir)) {
      return "assets";
    }
    if (path.startsWith(runtime.DESIGN_SYSTEM_PATHS.componentsDir)) {
      return "components";
    }
    return "readme";
  }
  function sectionsForFilePaths(paths: Iterable<string>): Set<string> {
    let values = new Set<string>();
    for (let value of paths) {
      values.add(sectionForFilePath(value));
    }
    return values;
  }
  function conflictTextDiff(
    ours: string | null,
    theirs: string | null,
    context: number = 2,
  ): Editor.ConflictDiffLine[] | null {
    let value =
        theirs === null
          ? []
          : theirs.split(`
`),
      value2 =
        ours === null
          ? []
          : ours.split(`
`);
    if (
      value.length > CONFLICT_COPIED_DURATION_MS ||
      value2.length > CONFLICT_COPIED_DURATION_MS
    ) {
      return null;
    }
    let length = value.length,
      length2 = value2.length,
      items: Uint16Array[] = [];
    for (let index3: number = 0; index3 <= length; index3++) {
      items.push(new Uint16Array(length2 + 1));
    }
    for (let value4: number = length - 1; value4 >= 0; value4--) {
      for (let value5: number = length2 - 1; value5 >= 0; value5--) {
        items[value4][value5] =
          value[value4] === value2[value5]
            ? items[value4 + 1][value5 + 1] + 1
            : Math.max(items[value4 + 1][value5], items[value4][value5 + 1]);
      }
    }
    let items2: Editor.ConflictDiffLine[] = [],
      index: number = 0,
      index2: number = 0;
    while (index < length && index2 < length2) {
      if (value[index] === value2[index2]) {
        items2.push({
          kind: "same",
          text: value[index],
        });
        index++;
        index2++;
      } else if (items[index + 1][index2] >= items[index][index2 + 1]) {
        items2.push({
          kind: "theirs",
          text: value[index++],
        });
      } else {
        items2.push({
          kind: "mine",
          text: value2[index2++],
        });
      }
    }
    while (index < length) {
      items2.push({
        kind: "theirs",
        text: value[index++],
      });
    }
    while (index2 < length2) {
      items2.push({
        kind: "mine",
        text: value2[index2++],
      });
    }
    let value3 = items2.map((): boolean => false);
    items2.forEach((source, options): void => {
      if (source.kind !== "same") {
        for (let value4 = -context; value4 <= context; value4++) {
          if (options + value4 >= 0 && options + value4 < items2.length) {
            value3[options + value4] = true;
          }
        }
      }
    });
    let items3: Editor.ConflictDiffLine[] = [];
    for (let index3: number = 0; index3 < items2.length; index3++) {
      if (value3[index3] === true) {
        items3.push(items2[index3]);
        continue;
      }
      if (
        items3.length === 0 ||
        items3[items3.length - 1].text !== "…" ||
        items3[items3.length - 1].kind !== "same"
      ) {
        items3.push({
          kind: "same",
          text: "…",
        });
      }
    }
    return items3;
  }
  function conflictBannerDescription(flag: Editor.ConflictFlag): string {
    let value: boolean = flag.theirsSha === null,
      value2: string =
        flag.clash !== undefined ? " You both changed " + flag.clash + "." : "";
    if (flag.why === "undo") {
      if (value) {
        return "Someone else deleted it since the step you undid. Your version shows here and is not saved.";
      } else {
        return "Someone else saved a newer version since the step you undid. Your version shows here and is not saved over theirs.";
      }
    }
    if (flag.why === "restored") {
      return (
        "Your unsaved version came back after the page reloaded. It is still not saved over " +
        (value ? "their delete." : "theirs.")
      );
    }
    if (flag.why === "overwritten") {
      return (
        "Someone else saved it at the same moment as you, and their version replaced yours." +
        value2 +
        " Yours is back here and is not saved."
      );
    }
    if (value) {
      return "Someone else deleted it while you were editing. Your version shows here and is not saved.";
    } else {
      return (
        "Someone else saved a newer version while you were editing." +
        value2 +
        " Your version shows here and is not saved over theirs."
      );
    }
  }
  function FileConflictBanner({
    doc: doc,
    flag: flag,
  }: {
    doc: Editor.ConflictDocument;
    flag: Editor.ConflictFlag;
  }): React.ReactElement {
    let [value, value2] = reactConflictBanners.useState(false),
      [value3, value4] = reactConflictBanners.useState<
        Editor.ConflictSides | "loading" | null
      >(null);
    reactConflictBanners.useEffect(() => {
      if (!value) {
        return;
      }
      let flag2: boolean = true;
      value4("loading");
      doc.flaggedSides(flag.path).then((input): void => {
        if (flag2) {
          value4(input);
        }
      });
      return (): void => {
        flag2 = false;
      };
    }, [value, doc, flag.path, flag.theirsSha]);
    let value5 =
        value3 !== null &&
        value3 !== "loading" &&
        isConflictTextFile(flag.path, value3.mine) &&
        isConflictTextFile(flag.path, value3.theirs)
          ? conflictTextDiff(value3.mine, value3.theirs)
          : null,
      value6 = sectionForFilePath(flag.path),
      value7 =
        value3 === null || value3 === "loading" ? (
          <span className={"text-muted"}>{"Reading both versions…"}</span>
        ) : value5 === null ? (
          <span className={"text-muted"}>
            {[
              "Theirs: " + conflictFileSummary(flag.path, value3.theirs) + " ",
              "Mine: " + conflictFileSummary(flag.path, value3.mine),
              " Too large, or not text, to compare line by line here.",
            ]}
          </span>
        ) : value5.every((source): boolean => source.kind === "same") ? (
          <span className={"text-muted"}>
            {"Both versions hold the same text."}
          </span>
        ) : (
          <pre
            className={
              "ds-flagged-diff m-0 max-h-80 overflow-auto whitespace-pre-wrap font-mono text-caption"
            }
            data-testid={"ds-flagged-diff-body"}
          >
            {value5.map((source, options) =>
              (() => {
                const _Element = "div";
                const _elementProps = {
                  "data-kind": source.kind,
                  className:
                    source.kind === "mine"
                      ? "bg-accent-soft"
                      : source.kind === "theirs"
                        ? "bg-warning-soft"
                        : "text-muted",
                  children:
                    (source.kind === "mine"
                      ? "mine   + "
                      : source.kind === "theirs"
                        ? "theirs - "
                        : "         ") + source.text,
                };
                const _elementKey = options;
                return <_Element key={_elementKey} {..._elementProps} />;
              })(),
            )}
          </pre>
        );
    return (
      <div
        className={"ds-flagged-file flex flex-col gap-xs"}
        data-testid={"ds-flagged-" + flag.path}
      >
        {[
          <runtime.Callout
            variant={"warning"}
            role={"status"}
            action={
              <span className={"flex flex-wrap items-center gap-xs"}>
                {[
                  <runtime.Button
                    variant={"ghost"}
                    onClick={() => value2((input): boolean => !input)}
                    aria-expanded={value}
                    data-testid={"ds-flagged-diff"}
                  >
                    {value ? "Hide diff" : "Diff"}
                  </runtime.Button>,
                  <runtime.Button
                    variant={"secondary"}
                    onClick={() => doc.resolveFlagged(flag.path, "theirs")}
                    data-testid={"ds-flagged-theirs"}
                  >
                    {flag.theirsSha === null
                      ? "Use theirs (delete it)"
                      : "Use theirs"}
                  </runtime.Button>,
                  <runtime.Button
                    variant={"secondary"}
                    onClick={() => doc.resolveFlagged(flag.path, "mine")}
                    data-testid={"ds-flagged-mine"}
                  >
                    {"Keep mine"}
                  </runtime.Button>,
                  <runtime.Button
                    variant={"primary"}
                    onClick={() => doc.resolveFlagged(flag.path, "copy")}
                    data-testid={"ds-flagged-copy"}
                  >
                    {"Keep mine as a copy"}
                  </runtime.Button>,
                ]}
              </span>
            }
          >
            <span>
              {[
                <span className={"font-mono"}>{flag.path}</span>,
                <span className={"text-muted"}>{[" (in ", value6, ")"]}</span>,
                ": ",
                conflictBannerDescription(flag),
              ]}
            </span>
          </runtime.Callout>,
          value ? (
            <div
              className={
                "ds-flagged-diff-panel rounded-md border border-border-line bg-surface-1 p-sm"
              }
              data-testid={"ds-flagged-diff-panel"}
            >
              {value7}
            </div>
          ) : null,
        ]}
      </div>
    );
  }
  function StuckSaveBanner({
    doc: doc,
    stuck: stuck,
  }: {
    doc: Editor.ConflictDocument;
    stuck: Editor.StuckSave;
  }): React.ReactElement {
    return (
      <div className={"ds-stuck-save"} data-testid={"ds-stuck-save"}>
        <runtime.Callout
          variant={"warning"}
          role={"status"}
          action={
            stuck.retryable ? (
              <runtime.Button
                variant={"primary"}
                onClick={() => doc.retryStuck()}
                data-testid={"ds-stuck-retry"}
              >
                {"Retry now"}
              </runtime.Button>
            ) : undefined
          }
        >
          <span>{stuck.message}</span>
        </runtime.Callout>
      </div>
    );
  }
  function useFileConflictFlags(
    document2: Partial<Editor.ConflictDocument>,
  ): Editor.ConflictFlag[] {
    let [value, value2] = reactConflictBanners.useState(() => [
      ...(document2.flags?.() ?? EMPTY_CONFLICT_FLAGS).values(),
    ]);
    reactConflictBanners.useEffect(() => {
      if (
        document2.subscribeFlagged === undefined ||
        document2.flags === undefined
      ) {
        return;
      }
      let callback = () => value2([...document2.flags!().values()]);
      callback();
      return document2.subscribeFlagged(callback);
    }, [document2]);
    return value;
  }
  function useStuckSave(
    document2: Partial<Editor.ConflictDocument>,
  ): Editor.StuckSave | undefined {
    let [value, value2] = reactConflictBanners.useState(() =>
      document2.stuck?.(),
    );
    reactConflictBanners.useEffect(() => {
      if (
        document2.stuck === undefined ||
        document2.subscribeSave === undefined
      ) {
        return;
      }
      let callback = () => value2(document2.stuck?.());
      callback();
      return document2.subscribeSave(callback);
    }, [document2]);
    return value;
  }
  function SaveConflictBanners({
    doc: doc,
  }: {
    doc: Partial<Editor.ConflictDocument>;
  }): React.ReactElement | null {
    let value = doc,
      value2 = useFileConflictFlags(value),
      value3 = useStuckSave(value);
    if (
      (value2.length === 0 && value3 === undefined) ||
      typeof value.resolveFlagged !== "function"
    ) {
      return null;
    }
    return (
      <div
        className={"ds-flagged-files flex flex-col gap-xs"}
        data-testid={"ds-flagged-files"}
        {...runtime.UNCOMMENTABLE_PROPS}
      >
        {[
          value3 !== undefined ? (
            <StuckSaveBanner doc={value as Editor.ConflictDocument} stuck={value3} />
          ) : null,
          value2.map((input) =>
            (() => {
              const _Element2 = FileConflictBanner;
              const _elementProps2 = {
                doc: value as Editor.ConflictDocument,
                flag: input,
              };
              const _elementKey2 = input.path;
              return <_Element2 key={_elementKey2} {..._elementProps2} />;
            })(),
          ),
        ]}
      </div>
    );
  }
  function useConflictedSections(
    document2: Partial<Editor.ConflictDocument>,
  ): ReadonlySet<string> {
    let value = useFileConflictFlags(document2);
    return sectionsForFilePaths(value.map((input) => input.path));
  }
  bindRuntimeValue(
    runtime,
    "reactConflictBanners",
    () => reactConflictBanners,
    (value) => {
      reactConflictBanners = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxConflictBanners",
    () => jsxConflictBanners,
    (value) => {
      jsxConflictBanners = value;
    },
  );
  bindRuntimeValue(runtime, "sectionForFilePath", () => sectionForFilePath);
  bindRuntimeValue(runtime, "sectionsForFilePaths", () => sectionsForFilePaths);
  bindRuntimeValue(
    runtime,
    "CONFLICT_COPIED_DURATION_MS",
    () => CONFLICT_COPIED_DURATION_MS,
    (value) => {
      CONFLICT_COPIED_DURATION_MS = value;
    },
  );
  bindRuntimeValue(runtime, "conflictTextDiff", () => conflictTextDiff);
  bindRuntimeValue(
    runtime,
    "conflictBannerDescription",
    () => conflictBannerDescription,
  );
  bindRuntimeValue(
    runtime,
    "isConflictTextFile",
    () => isConflictTextFile,
    (value) => {
      isConflictTextFile = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "conflictFileSummary",
    () => conflictFileSummary,
    (value) => {
      conflictFileSummary = value;
    },
  );
  bindRuntimeValue(runtime, "FileConflictBanner", () => FileConflictBanner);
  bindRuntimeValue(runtime, "StuckSaveBanner", () => StuckSaveBanner);
  bindRuntimeValue(
    runtime,
    "EMPTY_CONFLICT_FLAGS",
    () => EMPTY_CONFLICT_FLAGS,
    (value) => {
      EMPTY_CONFLICT_FLAGS = value;
    },
  );
  bindRuntimeValue(runtime, "useFileConflictFlags", () => useFileConflictFlags);
  bindRuntimeValue(runtime, "useStuckSave", () => useStuckSave);
  bindRuntimeValue(runtime, "SaveConflictBanners", () => SaveConflictBanners);
  bindRuntimeValue(
    runtime,
    "useConflictedSections",
    () => useConflictedSections,
  );
  return () => {
    reactConflictBanners = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    jsxConflictBanners = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
    CONFLICT_COPIED_DURATION_MS = 1500;
    isConflictTextFile = (path: string, value: string | null) =>
      value === null ||
      !(
        value.startsWith("data:") || (0, runtime.isHeldFilePointer)(path, value)
      );
    conflictFileSummary = (path: string, value: string | null): string =>
      value === null
        ? "the file is deleted."
        : (0, runtime.isHeldFilePointer)(path, value)
          ? "the file is kept as published."
          : String(value.length) + " characters.";
    EMPTY_CONFLICT_FLAGS = new Map();
  };
}
