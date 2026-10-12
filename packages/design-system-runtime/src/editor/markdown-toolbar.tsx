/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
import type * as React from "react";
import type {
  ToolbarSelectProps,
  ToolbarSelectOption,
  MarkdownBlockKind,
  MarkdownCommand,
  ComposingEvent,
} from "../contracts/file-browser";
export function installEditorMarkdownToolbar(
  runtime: RuntimeBindings,
): () => void {
  var reactMarkdownToolbar: typeof import("react");
  var reactDomMarkdownToolbar: typeof import("react-dom");
  var reactToolbarPicker: typeof import("react");
  var jsxToolbarPicker: typeof import("react/jsx-runtime");
  var EMPTY_MARKDOWN_FORMAT_STATE: import("../contracts").MarkdownFormatState;
  function ToolbarSelect({
    value: value,
    options: options,
    onChange: onChange,
    title: title,
    testid: testid,
    chipLabel: chipLabel,
    popoverClassName: popoverClassName,
    disabled = false,
    popupAttrs: popupAttrs,
  }: ToolbarSelectProps) {
    let value2 =
        reactToolbarPicker.useContext(runtime.ToolbarTooltipSideContext) ??
        "bottom",
      [value3, value4] = reactToolbarPicker.useState(value2),
      [value5, value6] = reactToolbarPicker.useState(false),
      ref = reactToolbarPicker.useRef<HTMLDivElement | null>(null),
      ref2 = reactToolbarPicker.useRef<HTMLElement | SVGElement | null>(null),
      value7 = value5 && !disabled;
    reactToolbarPicker.useEffect((): void => {
      if (disabled) {
        value6(false);
      }
    }, [disabled]);
    let value8 = options.find(
        (input: ToolbarSelectOption): boolean => input.value === value,
      ),
      value9 =
        value8 === undefined
          ? (value ?? "")
          : (value8.text ??
            (typeof value8.label === "string" ? value8.label : value)),
      value10 = chipLabel ?? value9,
      value11: string | undefined =
        typeof value10 === "string" || typeof value10 === "number"
          ? String(value10)
          : undefined,
      value12 =
        disabled || value11 === undefined
          ? undefined
          : value11 === ""
            ? title
            : title + ": " + value11;
    return (
      <span className={"inline-flex"}>
        {[
          value7 ? <runtime.PopupScrim onClose={() => value6(false)} /> : null,
          <runtime.Menu.Root
            open={value7}
            disabled={disabled}
            modal={false}
            onOpenChange={(
              input: boolean,
              options2: import("@base-ui/react/menu").Menu.Root.ChangeEventDetails,
            ): void => {
              if (!input && options2.reason === "outside-press") {
                let value13 = options2.event?.target;
                if (
                  value13 instanceof Element &&
                  value13.hasAttribute("data-mc-scrim")
                ) {
                  options2.cancel();
                  return;
                }
              }
              if (input) {
                value4(value2);
                ref2.current = null;
              }
              value6(input);
            }}
          >
            {[
              <runtime.Menu.Trigger
                render={
                  <runtime.ToolbarStripButton
                    data-testid={testid}
                    title={title}
                    aria-label={value12}
                    chevron={true}
                    disabled={disabled}
                  >
                    {value10}
                  </runtime.ToolbarStripButton>
                }
              />,
              <runtime.Menu.Popup
                {...popupAttrs}
                ref={ref}
                aria-label={title}
                data-mc-menu={""}
                side={value3}
                initialFocus={(input: string): boolean => input === "keyboard"}
                finalFocus={() => ref2.current ?? true}
                onKeyDown={(input: React.KeyboardEvent<HTMLElement>): void => {
                  if (input.key !== "Tab" && !input.metaKey && !input.ctrlKey) {
                    input.stopPropagation();
                  }
                }}
                className={popoverClassName}
              >
                <runtime.Menu.Group>
                  {options.map((input: ToolbarSelectOption) =>
                    (() => {
                      const _Element = runtime.Menu.Item;
                      const _elementProps = {
                        checkedRole: "radio" as const,
                        checked: input.value === value,
                        "data-testid": testid
                          ? testid + "-" + input.value
                          : undefined,
                        onClick: (): void => {
                          if (input.value !== value) {
                            onChange(input.value);
                          }
                          let value13 = ref.current?.ownerDocument
                            .activeElement as HTMLElement | SVGElement | null;
                          ref2.current =
                            value13 !== null &&
                            value13 !== value13.ownerDocument.body &&
                            !(ref.current?.contains(value13) ?? false)
                              ? value13
                              : null;
                        },
                        children:
                          typeof input.label === "string" ? (
                            input.label
                          ) : (
                            <span
                              className={
                                "flex min-w-0 flex-1 items-center gap-xs"
                              }
                            >
                              {input.label}
                            </span>
                          ),
                      };
                      const _elementKey = input.value;
                      return <_Element key={_elementKey} {..._elementProps} />;
                    })(),
                  )}
                </runtime.Menu.Group>
              </runtime.Menu.Popup>,
            ]}
          </runtime.Menu.Root>,
        ]}
      </span>
    );
  }
  function markdownBlockAtNode(
    node: Node,
    root: HTMLElement,
  ): MarkdownBlockKind {
    let element = node.nodeType === 3 ? node.parentElement : (node as Element);
    for (
      ;
      element !== null && element !== root;
      element = element.parentElement
    ) {
      let tagName = element.tagName;
      if (tagName === "H1") {
        return "h1";
      }
      if (tagName === "H2") {
        return "h2";
      }
      if (/^H[3-6]$/.test(tagName)) {
        return "h3";
      }
      if (tagName === "BLOCKQUOTE") {
        return "quote";
      }
      if (tagName === "PRE") {
        return "pre";
      }
    }
    return "p";
  }
  function selectedMarkdownBlockKinds(root: HTMLElement) {
    let selection = root.ownerDocument.getSelection();
    if (
      selection === null ||
      selection.rangeCount === 0 ||
      selection.isCollapsed
    ) {
      return [];
    }
    let range = selection.getRangeAt(0);
    if (
      !root.contains(range.startContainer) ||
      !root.contains(range.endContainer)
    ) {
      return [];
    }
    let blockTypes: MarkdownBlockKind[] = [],
      textWalker = root.ownerDocument.createTreeWalker(root, 4);
    for (
      let value = textWalker.nextNode();
      value !== null;
      value = textWalker.nextNode()
    ) {
      if (!range.intersectsNode(value)) {
        continue;
      }
      let value2 = value === range.startContainer ? range.startOffset : 0;
      if (
        (value === range.endContainer
          ? range.endOffset
          : (value.textContent?.length ?? 0)) <= value2
      ) {
        continue;
      }
      let value3 = markdownBlockAtNode(value, root);
      if (!blockTypes.includes(value3)) {
        blockTypes.push(value3);
      }
    }
    return blockTypes;
  }
  function readMarkdownSelectionFormat(root: HTMLElement) {
    let selection = root.ownerDocument.getSelection();
    if (selection === null || selection.rangeCount === 0) {
      return null;
    }
    let selectionNode = selection.getRangeAt(0).startContainer;
    if (!root.contains(selectionNode)) {
      return null;
    }
    let format = {
        ...EMPTY_MARKDOWN_FORMAT_STATE,
      },
      element =
        selectionNode.nodeType === 3
          ? selectionNode.parentElement
          : (selectionNode as Element);
    for (
      ;
      element !== null && element !== root;
      element = element.parentElement
    ) {
      let tagName = element.tagName;
      if (tagName === "B" || tagName === "STRONG") {
        format.bold = true;
      } else if (tagName === "I" || tagName === "EM") {
        format.italic = true;
      } else if (tagName === "CODE") {
        format.code = true;
      } else if (tagName === "UL") {
        [format.ul, format.ol] = [true, false];
      } else if (tagName === "OL") {
        [format.ul, format.ol] = [false, true];
      } else if (tagName === "A" && format.link === undefined) {
        format.link = (0, runtime.linkUrlFromElement)(element);
      } else if (format.block === "p") {
        if (tagName === "H1") {
          format.block = "h1";
        } else if (tagName === "H2") {
          format.block = "h2";
        } else if (/^H[3-6]$/.test(tagName)) {
          format.block = "h3";
        } else if (tagName === "BLOCKQUOTE") {
          format.block = "quote";
        } else if (tagName === "PRE") {
          format.block = "pre";
        }
      }
    }
    return format;
  }
  function normalizeExternalLinkInput(input: string) {
    let url = input.trim();
    if (url === "") {
      return null;
    }
    if (!/^[a-z][a-z0-9+.-]*:/i.test(url)) {
      url = "https://" + url;
    }
    return (0, runtime.classifyExternalLink)(url);
  }
  function executeMarkdownCommand(
    document2: Document,
    command: string,
    value?: string,
  ): void {
    document2.execCommand("styleWithCSS", false, "false");
    document2.execCommand(command, false, value);
  }
  function applyMarkdownFormat(
    format: MarkdownCommand,
    document2: Document = document,
    currentBlock?: MarkdownBlockKind,
  ) {
    if (
      currentBlock === "quote" &&
      format !== "quote" &&
      format !== "bold" &&
      format !== "italic" &&
      format !== "unlink"
    ) {
      executeMarkdownCommand(document2, "outdent");
    }
    switch (format) {
      case "bold":
      case "italic":
        return executeMarkdownCommand(document2, format);
      case "ul":
        return executeMarkdownCommand(document2, "insertUnorderedList");
      case "ol":
        return executeMarkdownCommand(document2, "insertOrderedList");
      case "p":
      case "h2":
      case "h3":
        return executeMarkdownCommand(
          document2,
          "formatBlock",
          format.toUpperCase(),
        );
      case "quote":
        return executeMarkdownCommand(document2, "formatBlock", "BLOCKQUOTE");
      case "unlink":
        return executeMarkdownCommand(document2, "unlink");
    }
  }
  function applyMarkdownLink(
    input: string,
    document2: Document = document,
    root?: HTMLElement,
  ): boolean {
    let value = normalizeExternalLinkInput(input);
    if (value === null) {
      return false;
    }
    executeMarkdownCommand(document2, "createLink", value);
    if (root !== undefined) {
      (0, runtime.prepareEditableLinks)(root);
    }
    return true;
  }
  function isComposingEvent(event: ComposingEvent) {
    return (
      event.nativeEvent?.isComposing === true ||
      event.isComposing === true ||
      event.keyCode === 229
    );
  }
  bindRuntimeValue(
    runtime,
    "reactMarkdownToolbar",
    () => reactMarkdownToolbar,
    (value) => {
      reactMarkdownToolbar = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactDomMarkdownToolbar",
    () => reactDomMarkdownToolbar,
    (value) => {
      reactDomMarkdownToolbar = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactToolbarPicker",
    () => reactToolbarPicker,
    (value) => {
      reactToolbarPicker = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxToolbarPicker",
    () => jsxToolbarPicker,
    (value) => {
      jsxToolbarPicker = value;
    },
  );
  bindRuntimeValue(runtime, "ToolbarSelect", () => ToolbarSelect);
  bindRuntimeValue(
    runtime,
    "EMPTY_MARKDOWN_FORMAT_STATE",
    () => EMPTY_MARKDOWN_FORMAT_STATE,
    (value) => {
      EMPTY_MARKDOWN_FORMAT_STATE = value;
    },
  );
  bindRuntimeValue(runtime, "markdownBlockAtNode", () => markdownBlockAtNode);
  bindRuntimeValue(
    runtime,
    "selectedMarkdownBlockKinds",
    () => selectedMarkdownBlockKinds,
  );
  bindRuntimeValue(
    runtime,
    "readMarkdownSelectionFormat",
    () => readMarkdownSelectionFormat,
  );
  bindRuntimeValue(
    runtime,
    "normalizeExternalLinkInput",
    () => normalizeExternalLinkInput,
  );
  bindRuntimeValue(
    runtime,
    "executeMarkdownCommand",
    () => executeMarkdownCommand,
  );
  bindRuntimeValue(runtime, "applyMarkdownFormat", () => applyMarkdownFormat);
  bindRuntimeValue(runtime, "applyMarkdownLink", () => applyMarkdownLink);
  bindRuntimeValue(runtime, "isComposingEvent", () => isComposingEvent);
  return () => {
    reactMarkdownToolbar = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    reactDomMarkdownToolbar = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactDomNamespace)(),
      1,
    );
    reactToolbarPicker = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    jsxToolbarPicker = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
    EMPTY_MARKDOWN_FORMAT_STATE = {
      bold: false,
      italic: false,
      ul: false,
      ol: false,
      code: false,
      block: "p",
    };
  };
}
