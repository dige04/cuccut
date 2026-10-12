/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
import type * as React from "react";
import type {
  MarkdownInlineOutput,
  MarkdownSource,
  MarkdownSerializedItem,
  MarkdownEditorProps,
} from "../contracts/file-browser";
export function installEditorMarkdownEditor(
  runtime: RuntimeBindings,
): () => void {
  var jsxEditableMarkdown: typeof import("react/jsx-runtime");
  var MARKDOWN_COMMIT_DELAY_MS: number;
  var MARKDOWN_COMMIT_MAX_DELAY_MS: number;
  var EDITABLE_MARKDOWN_IMAGE_DATA_URL_PATTERN: RegExp;
  var TEXT_NODE_TYPE: number;
  var ELEMENT_NODE_TYPE: number;
  var trailingBacktickCount: (text: string) => number;
  var serializeMarkdownInlineNodes: (nodes: readonly Node[]) => string;
  function appendSerializedMarkdownInline(
    output: MarkdownInlineOutput,
    text: string,
  ): void {
    if (text === "") {
      return;
    }
    let value: string =
        output.ticks > 0 && text.charCodeAt(0) === 96 ? " " : "",
      value2 = trailingBacktickCount(text);
    output.ticks =
      value2 === text.length && value === "" ? output.ticks + value2 : value2;
    output.s += value + text;
  }
  function serializeMarkdownInlineNode(
    node: Node,
    previousTicks: number = 0,
  ): string {
    if (node.nodeType === TEXT_NODE_TYPE) {
      return node.textContent ?? "";
    }
    if (node.nodeType !== ELEMENT_NODE_TYPE) {
      return "";
    }
    let element: Element = node as Element,
      tagName = () =>
        serializeMarkdownInlineNodes(Array.from(element.childNodes)),
      callback = (input: string) => input.replace(/\s*\n\s*/g, " ");
    switch (element.tagName) {
      case "STRONG":
      case "B": {
        let value = callback(tagName());
        if (value.trim() === "") {
          return value;
        } else {
          return "**" + value + "**";
        }
      }
      case "EM":
      case "I": {
        let value = callback(tagName());
        if (value.trim() === "") {
          return value;
        } else {
          return "*" + value + "*";
        }
      }
      case "CODE": {
        let value = callback(element.textContent ?? "");
        if (value.trim() === "") {
          return value;
        }
        let value2 =
          (value.match(/`+/g) ?? []).reduce(
            (input: number, items: string): number =>
              Math.max(input, items.length),
            0,
          ) + 1;
        if (value2 === previousTicks) {
          value2 += 1;
        }
        let index: number = 0;
        while (index < value.length && value.charCodeAt(index) === 32) {
          index++;
        }
        let value3: number = value.length - 1;
        while (value3 > index && value.charCodeAt(value3) === 32) {
          value3--;
        }
        let value4: string =
            index < value.length &&
            (value.charCodeAt(index) === 96 || value.charCodeAt(value3) === 96)
              ? " "
              : "",
          value5 = "`".repeat(value2);
        return value5 + value4 + value + value4 + value5;
      }
      case "A": {
        let value = (0, runtime.linkUrlFromElement)(element),
          value2 = callback(tagName()).replace(/[\][]/g, " ");
        if (value !== "") {
          return "[" + value2 + "](" + value + ")";
        } else {
          return value2;
        }
      }
      case "BR":
        return `
`;
      default:
        return tagName();
    }
  }
  function escapeMarkdownTableCell(text: string) {
    let value = text.replace(/\|/g, "\\|").replace(/\n/g, " ").trim();
    if (/^:?-{2,}:?$/.test(value)) {
      return "\\" + value;
    } else {
      return value;
    }
  }
  function serializeMarkdownEditor(
    root: HTMLElement,
    blockModels?: (node: Element) => MarkdownSource | undefined,
  ): string {
    let items: MarkdownSerializedItem[] = [],
      callback = (input: string): void => {
        let value6 = input.trim();
        if (value6 !== "") {
          items.push({
            text: value6,
            typed: false,
          });
        }
      },
      callback2 = (input: string): void => {
        let value6 = input.trim();
        if (value6 !== "") {
          items.push({
            text: value6,
            typed: true,
          });
        }
      },
      text = "",
      index = 0,
      callback3 = (input: string): void => {
        let state = {
          s: text,
          ticks: index,
        };
        appendSerializedMarkdownInline(state, input);
        text = state.s;
        index = state.ticks;
      },
      callback4 = (): void => {
        callback2(text);
        text = "";
        index = 0;
      },
      callback5 = (input: string, options: Element): void => {
        callback4();
        let value6 = serializeMarkdownInlineNode(options)
          .replace(/\s*\n\s*/g, " ")
          .trim();
        if (value6 !== "") {
          callback2(input + " " + value6);
        }
      },
      callback6 = (element: Element): void => {
        switch (element.tagName) {
          case "H1":
            callback5("#", element);
            return;
          case "H2":
            callback5("##", element);
            return;
          case "H3":
          case "H4":
          case "H5":
          case "H6":
            callback5("###", element);
            return;
          case "PRE": {
            callback4();
            let value6 = (element.textContent ?? "").replace(/\n$/, ""),
              value7 = [...value6.matchAll(/`+/g)].reduce(
                (input: number, options: RegExpMatchArray): number =>
                  Math.max(input, options[0].length),
                0,
              ),
              value8 = "`".repeat(Math.max(3, value7 + 1));
            callback(
              value8 +
                `
` +
                value6 +
                `
` +
                value8,
            );
            return;
          }
          case "BLOCKQUOTE": {
            callback4();
            let value6 = serializeMarkdownInlineNode(element)
              .trim()
              .replace(/\n/g, " ");
            if (value6 !== "") {
              callback("> " + value6);
            }
            return;
          }
          case "UL":
          case "OL": {
            callback4();
            let value6: boolean = element.tagName === "OL",
              value7 = Array.from(element.children)
                .filter((input: Element): boolean => input.tagName === "LI")
                .map((input: Element) =>
                  serializeMarkdownInlineNode(input).trim().replace(/\n/g, " "),
                )
                .filter((input: string): boolean => input !== "")
                .map(
                  (input: string, options: number): string =>
                    (value6 ? String(options + 1) + ". " : "- ") + input,
                );
            if (value7.length > 0) {
              callback(
                value7.join(`
`),
              );
            }
            return;
          }
          case "HR":
            callback4();
            callback("---");
            return;
          case "IMG": {
            callback4();
            let value6 = element.getAttribute("src") ?? "";
            if (EDITABLE_MARKDOWN_IMAGE_DATA_URL_PATTERN.test(value6)) {
              let value7 = (element.getAttribute("alt") ?? "")
                .replace(/[\][()]/g, " ")
                .replace(/\s*\n\s*/g, " ");
              callback2("![" + value7 + "](" + value6 + ")");
            }
            return;
          }
          case "TABLE": {
            callback4();
            let items2: string[][] = [],
              flag: boolean = false,
              element2 = element.querySelector("thead");
            if (element2) {
              let value7 = Array.from(element2.querySelectorAll("th, td")).map(
                (input: Element) =>
                  escapeMarkdownTableCell(serializeMarkdownInlineNode(input)),
              );
              if (value7.length > 0) {
                items2.push(value7);
                flag = true;
              }
            }
            for (let value7 of Array.from(
              element.querySelectorAll("tbody tr"),
            )) {
              items2.push(
                Array.from(value7.children).map((input: Element) =>
                  escapeMarkdownTableCell(serializeMarkdownInlineNode(input)),
                ),
              );
            }
            if (items2.length === 0) {
              return;
            }
            let value6 = items2.map(
              (input: string[]): string => "| " + input.join(" | ") + " |",
            );
            if (flag && items2[0] !== undefined) {
              value6.splice(
                1,
                0,
                "| " + items2[0].map((): string => "---").join(" | ") + " |",
              );
            }
            callback(
              value6.join(`
`),
            );
            return;
          }
          case "P":
          case "DIV": {
            if (
              Array.from(element.children).some((input: Element) =>
                /^(H[1-6]|PRE|BLOCKQUOTE|UL|OL|HR|IMG|TABLE|P|DIV)$/.test(
                  input.tagName,
                ),
              )
            ) {
              callback4();
              callback7(element);
              return;
            }
            callback4();
            callback2(serializeMarkdownInlineNode(element).replace(/\n/g, " "));
            return;
          }
          default: {
            if (
              Array.from(element.children).some((input: Element) =>
                /^(H[1-6]|PRE|BLOCKQUOTE|UL|OL|HR|IMG|TABLE|P|DIV)$/.test(
                  input.tagName,
                ),
              )
            ) {
              callback4();
              callback7(element);
              return;
            }
            callback4();
            callback2((element.textContent ?? "").replace(/\s+/g, " "));
          }
        }
      },
      callback7 = (input: Element): void => {
        for (let value6 of Array.from(input.childNodes)) {
          if (value6.nodeType === TEXT_NODE_TYPE) {
            callback3(value6.textContent ?? "");
            continue;
          }
          if (value6.nodeType !== ELEMENT_NODE_TYPE) {
            continue;
          }
          let value7: Element = value6 as Element;
          if (value7.tagName === "BR") {
            callback4();
            continue;
          }
          if (
            /^(STRONG|B|EM|I|CODE|A|SPAN|U|S|SMALL|SUB|SUP|MARK|FONT)$/.test(
              value7.tagName,
            )
          ) {
            callback3(serializeMarkdownInlineNode(value7, index));
            continue;
          }
          let value8 = input === root ? blockModels?.(value7) : undefined;
          if (value8 !== undefined) {
            callback4();
            items.push({
              text: value8.text,
              typed: false,
              source: value8,
            });
            continue;
          }
          callback6(value7);
        }
      };
    callback7(root);
    callback4();
    let value: RegExp = /^\|.*\|$/,
      value2: RegExp = /^[-*+] /,
      value3: RegExp = /^\d{1,4}[.)] /,
      value4: RegExp = /^>/,
      value5 = items[0]?.text ?? "";
    for (let count: number = 1; count < items.length; count++) {
      let value6 = items[count - 1],
        value7 = items[count];
      if (
        value6.source !== undefined &&
        value7.source !== undefined &&
        value7.source.at === value6.source.at + 1
      ) {
        value5 +=
          `
` +
          value7.source.lead +
          value7.text;
        continue;
      }
      let value8 =
        value6.typed &&
        value7.typed &&
        ((value.test(value6.text) && value.test(value7.text)) ||
          (value2.test(value6.text) && value2.test(value7.text)) ||
          (value3.test(value6.text) && value3.test(value7.text)) ||
          (value4.test(value6.text) && value4.test(value7.text)));
      value5 +=
        (value8
          ? `
`
          : `

`) + value7.text;
    }
    return value5;
  }
  function removeMarkdownModelNodes(
    root: HTMLElement,
    blockModels: Map<Node, MarkdownSource>,
    removedNodes: MutationRecord[],
  ): void {
    let callback = (input: Node): void => {
      blockModels.delete(input);
      for (let value of blockModels.keys()) {
        if (input.contains(value)) {
          blockModels.delete(value);
        }
      }
    };
    for (let value of removedNodes) {
      for (
        let target: Node | null = value.target;
        target !== null && target !== root;
        target = target.parentNode
      ) {
        blockModels.delete(target);
      }
      value.addedNodes.forEach(callback);
      value.removedNodes.forEach(callback);
    }
  }
  function MarkdownEditor({
    markdown: markdown,
    onMarkdown: onMarkdown,
    onDone: onDone,
    placeholder: placeholder,
    readOnly: readOnly,
    label: label,
    testId: testId,
    stripClassName: stripClassName,
  }: MarkdownEditorProps) {
    let ref = runtime.DesignSystemReactRuntime.useRef<HTMLDivElement | null>(
        null,
      ),
      ref2 = runtime.DesignSystemReactRuntime.useRef(false),
      [value, value2] = runtime.DesignSystemReactRuntime.useState(false),
      ref3 = runtime.DesignSystemReactRuntime.useRef<HTMLDivElement | null>(
        null,
      ),
      ref4 = runtime.DesignSystemReactRuntime.useRef<string | null>(null),
      [value3, value4] = runtime.DesignSystemReactRuntime.useState(0),
      ref5 = runtime.DesignSystemReactRuntime.useRef(markdown),
      ref6 = runtime.DesignSystemReactRuntime.useRef(markdown);
    ref6.current = markdown;
    let ref7 = runtime.DesignSystemReactRuntime.useRef<number | null>(null);
    runtime.DesignSystemReactRuntime.useEffect(
      () => (): void => {
        if (ref7.current !== null) {
          cancelAnimationFrame(ref7.current);
        }
      },
      [],
    );
    runtime.DesignSystemReactRuntime.useEffect((): void => {
      if (ref2.current) {
        return;
      }
      if (markdown !== ref5.current) {
        ref5.current = markdown;
        ref4.current = null;
        value4((input: number) => input + 1);
      }
    }, [markdown]);
    let memo = runtime.DesignSystemReactRuntime.useMemo(
        () => (0, runtime.parseMarkdownBlocks)(ref5.current),
        [value3],
      ),
      value5 = readOnly
        ? undefined
        : {
            links: "edit",
            literalUnsafeLinks: true,
          },
      ref8 = runtime.DesignSystemReactRuntime.useRef(
        new Map<Node, MarkdownSource>(),
      ),
      ref9 = runtime.DesignSystemReactRuntime.useRef<HTMLDivElement | null>(
        null,
      ),
      ref10 = runtime.DesignSystemReactRuntime.useRef<MutationObserver | null>(
        null,
      );
    runtime.DesignSystemReactRuntime.useLayoutEffect(() => {
      let current = ref.current;
      if (current === null || typeof MutationObserver !== "function") {
        ref8.current = new Map();
        return;
      }
      if (ref9.current !== current) {
        ref9.current = current;
        ref8.current = new Map();
        let value7 = Array.from(current.children);
        if (value7.length === memo.sources.length) {
          value7.forEach((input: Element, options: number): void => {
            let value8 = memo.sources[options];
            if (value8 !== undefined) {
              ref8.current.set(input, {
                at: options,
                ...value8,
              });
            }
          });
        }
      }
      if (readOnly) {
        return;
      }
      let current2 = ref8.current,
        observer = new MutationObserver((input: MutationRecord[]) =>
          removeMarkdownModelNodes(current, current2, input),
        );
      observer.observe(current, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
      });
      ref10.current = observer;
      return (): void => {
        observer.disconnect();
        ref10.current = null;
      };
    }, [memo, readOnly]);
    let callback = (): void => {
        value2(false);
        ref11.current?.flush();
        onDone?.();
        if (ref7.current !== null) {
          cancelAnimationFrame(ref7.current);
        }
        ref7.current = requestAnimationFrame((): void => {
          ref7.current = null;
          let current = ref.current;
          if (
            current !== null &&
            current.ownerDocument.hasFocus() &&
            current.contains(current.ownerDocument.activeElement)
          ) {
            return;
          }
          ref2.current = false;
          ref5.current = ref6.current;
          ref4.current = null;
          value4((input: number) => input + 1);
        });
      },
      ref11 = runtime.DesignSystemReactRuntime.useRef<
        import("../contracts").MarkdownCommitQueue<string> | null
      >(null);
    if (ref11.current === null) {
      ref11.current = (0, runtime.createMarkdownCommitQueue)(
        MARKDOWN_COMMIT_DELAY_MS,
        MARKDOWN_COMMIT_MAX_DELAY_MS,
      );
    }
    runtime.DesignSystemReactRuntime.useLayoutEffect(
      () => () => ref11.current?.dispose(),
      [],
    );
    let ref12 = runtime.DesignSystemReactRuntime.useRef(readOnly);
    runtime.DesignSystemReactRuntime.useLayoutEffect((): void => {
      if (ref12.current === readOnly) {
        return;
      }
      ref12.current = readOnly;
      ref11.current?.flush();
      if (ref2.current) {
        ref2.current = false;
        value2(false);
        onDone?.();
      }
      value4((input: number) => input + 1);
    }, [readOnly]);
    let callback2 = (): void => {
        if (readOnly || ref.current === null) {
          return;
        }
        if (ref10.current !== null) {
          removeMarkdownModelNodes(
            ref.current,
            ref8.current,
            ref10.current.takeRecords(),
          );
        }
        let value7 = serializeMarkdownEditor(ref.current, (input: Element) =>
          ref8.current.get(input),
        );
        ref4.current = value7;
        ref5.current = value7;
        if (onMarkdown !== undefined) {
          ref11.current?.push(value7, onMarkdown);
        }
      },
      value6: boolean = ref5.current.trim() === "";
    return (
      <jsxEditableMarkdown.Fragment>
        {[
          (() => {
            const _Element = "div";
            const _elementProps = {
              ref: ref,
              className:
                "ds-readme" +
                (readOnly ? "" : " ds-readme-editable") +
                (value ? " ds-readme-editing" : ""),
              "data-testid": testId ?? "ds-readme-rendered",
              contentEditable: !readOnly,
              suppressContentEditableWarning: true,
              role: readOnly ? undefined : "textbox",
              "aria-multiline": readOnly ? undefined : true,
              "aria-label": label ?? "README",
              "data-placeholder": value6 ? placeholder : undefined,
              onFocus: (): void => {
                ref2.current = true;
                value2(true);
              },
              onPaste: (event: React.ClipboardEvent<HTMLDivElement>): void => {
                if (readOnly) {
                  return;
                }
                event.preventDefault();
                let value7 = event.clipboardData.getData("text/plain");
                if (value7 !== "") {
                  document.execCommand("insertText", false, value7);
                }
              },
              onDrop: (event: React.DragEvent<HTMLDivElement>): void => {
                event.preventDefault();
              },
              onClick: (event: React.MouseEvent<HTMLDivElement>): void => {
                if (readOnly || !(event.metaKey || event.ctrlKey)) {
                  return;
                }
                let ancestor = (event.target as Element).closest(
                  "a[data-href]",
                );
                if (
                  ancestor === null ||
                  !event.currentTarget.contains(ancestor)
                ) {
                  return;
                }
                event.preventDefault();
                (0, runtime.openExternalLink)(
                  (0, runtime.linkUrlFromElement)(ancestor),
                );
              },
              onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>): void => {
                if (event.defaultPrevented) {
                  return;
                }
                if (
                  event.key === "Escape" &&
                  (0, runtime.anyMenuOrPopoverOpen)(
                    event.currentTarget.ownerDocument,
                  )
                ) {
                  return;
                }
                let value7 = ref.current?.ownerDocument.getSelection();
                if (
                  event.key === "Enter" &&
                  (event.metaKey || event.ctrlKey) &&
                  !event.nativeEvent.isComposing &&
                  value7 != null &&
                  value7.rangeCount > 0
                ) {
                  let startContainer = value7.getRangeAt(0).startContainer,
                    value10 =
                      (startContainer.nodeType === ELEMENT_NODE_TYPE
                        ? (startContainer as Element)
                        : startContainer.parentElement
                      )?.closest("a[data-href]") ?? null;
                  if (
                    value10 !== null &&
                    event.currentTarget.contains(value10)
                  ) {
                    event.preventDefault();
                    (0, runtime.openExternalLink)(
                      (0, runtime.linkUrlFromElement)(value10),
                    );
                    return;
                  }
                }
                if (
                  event.key === "Escape" &&
                  (value7 == null || value7.isCollapsed)
                ) {
                  event.preventDefault();
                  event.stopPropagation();
                  let value10 =
                    ref.current
                      ?.closest(".ds-tokrow, tr")
                      ?.querySelector<HTMLElement>(
                        runtime.RENAME_BUTTON_SELECTOR,
                      ) ??
                    ref.current
                      ?.closest(".ds-postit")
                      ?.querySelector<HTMLElement>("[data-note-close]") ??
                    null;
                  if (value10 !== null) {
                    value10.focus();
                  } else {
                    (
                      ref.current?.ownerDocument
                        .activeElement as HTMLElement | null
                    )?.blur();
                  }
                  return;
                }
                if (value7 == null || value7.isCollapsed) {
                  return;
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  event.stopPropagation();
                  value7.collapseToEnd();
                  return;
                }
                let value8 =
                    (event.key === "Tab" && !event.shiftKey) ||
                    (event.key === "F10" && event.altKey),
                  value9 =
                    ref3.current?.querySelector<HTMLElement>(
                      "button:not(:disabled), input",
                    ) ??
                    ref3.current?.querySelector<HTMLElement>(
                      runtime.TOOLBAR_FOCUSABLE_SELECTOR,
                    );
                if (!value8 || value9 === null || value9 === undefined) {
                  return;
                }
                event.preventDefault();
                event.stopPropagation();
                value9.focus();
              },
              onInput: (event: React.InputEvent<HTMLDivElement>): void => {
                if (readOnly || ref.current === null) {
                  return;
                }
                if (/^history/.test(event.nativeEvent.inputType ?? "")) {
                  (0, runtime.prepareEditableLinks)(ref.current);
                }
                (0, runtime.autoformatMarkdownBlock)(
                  ref.current,
                  event.nativeEvent,
                  serializeMarkdownEditor,
                );
                callback2();
              },
              onBlur: (input: React.FocusEvent<HTMLDivElement>): void => {
                let value7 = input.relatedTarget ?? null;
                if (
                  value7 !== null &&
                  (ref.current?.contains(value7) ||
                    ref3.current?.contains(value7) ||
                    (value7 instanceof Element &&
                      value7.closest(
                        "[" + runtime.README_TOOLBAR_MENU_ATTRIBUTE + "]",
                      ) !== null))
                ) {
                  return;
                }
                callback();
              },
              children: memo.blocks.map(
                (
                  input: import("../contracts").MarkdownBlock,
                  options: number,
                ) => (0, runtime.renderMarkdownBlock)(input, options, value5),
              ),
            };
            const _elementKey = value3;
            return <_Element key={_elementKey} {..._elementProps} />;
          })(),
          readOnly ? null : (
            <p
              className={
                "ds-readme-hint not-prose mt-sm min-h-4 text-caption text-muted transition-opacity duration-base " +
                (value ? "opacity-100" : "opacity-0")
              }
              aria-hidden={!value}
            >
              {"Markdown shortcuts · select text to format"}
            </p>
          ),
          readOnly || !value ? null : (
            <jsxEditableMarkdown.Fragment>
              {[
                <runtime.MarkdownFormattingToolbar
                  root={ref}
                  hold={ref3}
                  onApplied={callback2}
                  onLeave={callback}
                  className={stripClassName}
                />,
                <runtime.MarkdownLinkPopover
                  root={ref}
                  className={stripClassName}
                />,
              ]}
            </jsxEditableMarkdown.Fragment>
          ),
        ]}
      </jsxEditableMarkdown.Fragment>
    );
  }
  bindRuntimeValue(
    runtime,
    "jsxEditableMarkdown",
    () => jsxEditableMarkdown,
    (value) => {
      jsxEditableMarkdown = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MARKDOWN_COMMIT_DELAY_MS",
    () => MARKDOWN_COMMIT_DELAY_MS,
    (value) => {
      MARKDOWN_COMMIT_DELAY_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MARKDOWN_COMMIT_MAX_DELAY_MS",
    () => MARKDOWN_COMMIT_MAX_DELAY_MS,
    (value) => {
      MARKDOWN_COMMIT_MAX_DELAY_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "EDITABLE_MARKDOWN_IMAGE_DATA_URL_PATTERN",
    () => EDITABLE_MARKDOWN_IMAGE_DATA_URL_PATTERN,
    (value) => {
      EDITABLE_MARKDOWN_IMAGE_DATA_URL_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TEXT_NODE_TYPE",
    () => TEXT_NODE_TYPE,
    (value) => {
      TEXT_NODE_TYPE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ELEMENT_NODE_TYPE",
    () => ELEMENT_NODE_TYPE,
    (value) => {
      ELEMENT_NODE_TYPE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "trailingBacktickCount",
    () => trailingBacktickCount,
    (value) => {
      trailingBacktickCount = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "appendSerializedMarkdownInline",
    () => appendSerializedMarkdownInline,
  );
  bindRuntimeValue(
    runtime,
    "serializeMarkdownInlineNodes",
    () => serializeMarkdownInlineNodes,
    (value) => {
      serializeMarkdownInlineNodes = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "serializeMarkdownInlineNode",
    () => serializeMarkdownInlineNode,
  );
  bindRuntimeValue(
    runtime,
    "escapeMarkdownTableCell",
    () => escapeMarkdownTableCell,
  );
  bindRuntimeValue(
    runtime,
    "serializeMarkdownEditor",
    () => serializeMarkdownEditor,
  );
  bindRuntimeValue(
    runtime,
    "removeMarkdownModelNodes",
    () => removeMarkdownModelNodes,
  );
  bindRuntimeValue(runtime, "MarkdownEditor", () => MarkdownEditor);
  return () => {
    jsxEditableMarkdown = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
    MARKDOWN_COMMIT_DELAY_MS = 150;
    MARKDOWN_COMMIT_MAX_DELAY_MS = 1000;
    EDITABLE_MARKDOWN_IMAGE_DATA_URL_PATTERN =
      /^data:image\/(png|jpeg|gif|webp|avif);base64,[A-Za-z0-9+/=]+$/;
    TEXT_NODE_TYPE = 3;
    ELEMENT_NODE_TYPE = 1;
    trailingBacktickCount = (text: string): number => {
      let index: number = 0;
      while (
        index < text.length &&
        text.charCodeAt(text.length - 1 - index) === 96
      ) {
        index++;
      }
      return index;
    };
    serializeMarkdownInlineNodes = (nodes: readonly Node[]) => {
      let state = {
        s: "",
        ticks: 0,
      };
      for (let value of nodes) {
        appendSerializedMarkdownInline(
          state,
          serializeMarkdownInlineNode(value, state.ticks),
        );
      }
      return state.s;
    };
  };
}
