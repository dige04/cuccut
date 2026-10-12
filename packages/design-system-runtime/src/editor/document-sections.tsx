import type * as React from "react";
import type * as Core from "../contracts";
import type * as M from "../contracts/documentation";
import type * as Files from "../contracts/file-browser";
import type * as Application from "../contracts/application";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installEditorDocumentSections(
  runtime: RuntimeBindings,
): () => void {
  var EMPTY_DOC_LINKS: Set<string>;
  var jsxDocumentSections: typeof import("react/jsx-runtime");
  function firstMarkdownTitle(markdown: string): {
    line: number;
    text: string;
  } | null {
    let flag: boolean = false,
      value = markdown.split(`
`);
    for (let index: number = 0; index < value.length; index++) {
      let value2 = value[index];
      if (/^```/.test(value2)) {
        flag = !flag;
        continue;
      }
      if (flag) {
        continue;
      }
      let value3 = /^#\s+(.+)$/.exec(value2);
      if (value3 !== null) {
        return {
          line: index,
          text: value3[1].trim(),
        };
      }
    }
    return null;
  }
  function replaceMarkdownTitle(markdown: string, title: string): string {
    let value = firstMarkdownTitle(markdown);
    if (value === null) {
      return markdown;
    }
    let value2 = markdown.split(`
`);
    value2[value.line] = "# " + title;
    return value2.join(`
`);
  }
  function DocumentSections({
    docs: docs,
    edit: edit,
    headFor: headFor,
  }: M.DocumentSectionsProps) {
    return (
      <jsxDocumentSections.Fragment>
        {docs.map((input: Core.ParsedDesignSystem["docs"][number]) =>
          (() => {
            const _Element = runtime.SectionCard;
            const _elementProps = {
              head: headFor(input),
              className: "ds-readme-sec ds-guidance-sec",
              "data-testid": "ds-guidance-" + input.path,
              cardKey: "guidance:" + input.path,
              anchorId: (0, runtime.commentTargetId)("doc", input.path),
              children: [
                <div
                  className={
                    "ds-doc-path ds-pad pt-sm font-mono text-caption text-muted"
                  }
                  {...runtime.UNCOMMENTABLE_PROPS}
                >
                  {input.path}
                </div>,
                <div className={runtime.README_MEASURE_CLASS_NAME}>
                  <runtime.MarkdownEditor
                    markdown={input.markdown}
                    readOnly={edit === undefined}
                    placeholder={
                      // CucCut: user-facing copy calls the agent "the agent", not Claude.
                      "Guidance for the agent — voice, do's and don'ts, anything the tokens can't say."
                    }
                    label={input.title}
                    testId={"ds-guidance-text-" + input.path}
                    onMarkdown={(input2: string) =>
                      edit?.setText(input.path, input2)
                    }
                    onDone={edit?.done}
                  />
                </div>,
              ],
            };
            const _elementKey = input.path;
            return <_Element key={_elementKey} {..._elementProps} />;
          })(),
        )}
      </jsxDocumentSections.Fragment>
    );
  }
  bindRuntimeValue(
    runtime,
    "EMPTY_DOC_LINKS",
    () => EMPTY_DOC_LINKS,
    (value) => {
      EMPTY_DOC_LINKS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxDocumentSections",
    () => jsxDocumentSections,
    (value) => {
      jsxDocumentSections = value;
    },
  );
  bindRuntimeValue(runtime, "firstMarkdownTitle", () => firstMarkdownTitle);
  bindRuntimeValue(runtime, "replaceMarkdownTitle", () => replaceMarkdownTitle);
  bindRuntimeValue(runtime, "DocumentSections", () => DocumentSections);
  return () => {
    EMPTY_DOC_LINKS = new Set();
    jsxDocumentSections = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
  };
}
