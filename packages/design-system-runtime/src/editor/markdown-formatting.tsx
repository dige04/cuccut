import type * as React from "react";
import type * as Core from "../contracts";
import type * as M from "../contracts/documentation";
import type * as Files from "../contracts/file-browser";
import type * as Application from "../contracts/application";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installEditorMarkdownFormatting(
  runtime: RuntimeBindings,
): () => void {
  var jsxMarkdownToolbar: typeof import("react/jsx-runtime");
  var MARKDOWN_BLOCK_LABELS: Record<Core.MarkdownFormatState["block"], string>;
  var README_TOOLBAR_MENU_ATTRIBUTE: string;
  var README_TOOLBAR_MENU_PROPS: {
    [attribute: `data-${string}`]: string;
  };
  var TOOLBAR_FOCUSABLE_SELECTOR: string;
  var EDITABLE_MARKDOWN_BLOCK_TYPES: ("p" | "h2" | "h3" | "quote")[];
  var isEditableMarkdownBlock: (
    kind: Core.MarkdownFormatState["block"],
  ) => boolean;
  var EMPTY_SELECTION_STYLE_STATE: M.SelectionStyleState;
  function disabledMarkdownFormats(
    format: Core.MarkdownFormatState,
    hasSelection: boolean,
    selectedStyles: M.SelectionStyleState = EMPTY_SELECTION_STYLE_STATE,
  ) {
    let hasLink: boolean = format.link !== undefined;
    return {
      bold:
        selectedStyles.italic ||
        selectedStyles.code ||
        selectedStyles.link ||
        (!format.bold && (hasLink || format.italic || format.code))
          ? "The README can’t show two styles on the same text yet"
          : undefined,
      italic:
        selectedStyles.bold ||
        selectedStyles.code ||
        selectedStyles.link ||
        (!format.italic && (hasLink || format.bold || format.code))
          ? "The README can’t show two styles on the same text yet"
          : undefined,
      link: hasLink
        ? undefined
        : format.code
          ? "Code can’t carry a link"
          : format.bold ||
              format.italic ||
              selectedStyles.bold ||
              selectedStyles.italic ||
              selectedStyles.code ||
              selectedStyles.link
            ? "The README can’t show two styles on the same text yet"
            : !hasSelection
              ? "Select some text to link"
              : undefined,
    };
  }
  function selectedMarkdownStyles(
    root: HTMLElement | null,
  ): M.SelectionStyleState {
    let selection = root?.ownerDocument.getSelection();
    if (
      selection == null ||
      selection.rangeCount === 0 ||
      selection.isCollapsed ||
      root === null
    ) {
      return EMPTY_SELECTION_STYLE_STATE;
    }
    let selectedContent = selection.getRangeAt(0).cloneContents();
    return {
      bold: selectedContent.querySelector("b, strong") !== null,
      italic: selectedContent.querySelector("i, em") !== null,
      code: selectedContent.querySelector("code") !== null,
      link: selectedContent.querySelector("a, [data-href]") !== null,
    };
  }
  function MarkdownFormattingToolbar({
    root: root,
    hold: hold,
    onApplied: onApplied,
    onLeave: onLeave,
    className: className,
  }: M.MarkdownFormattingToolbarProps) {
    let value = (0, runtime.useSelectionToolbar)(root, {
        holdWhileFocusIn: hold,
      }),
      value2 = (0, runtime.useCdsLayerAwareZIndex)(45),
      [value3, value4] = runtime.reactMarkdownToolbar.useState(
        runtime.EMPTY_MARKDOWN_FORMAT_STATE,
      ),
      [value5, value6] = runtime.reactMarkdownToolbar.useState<string | null>(
        null,
      ),
      [value7, value8] = runtime.reactMarkdownToolbar.useState(false),
      [value9, value10] = runtime.reactMarkdownToolbar.useState(
        EMPTY_SELECTION_STYLE_STATE,
      ),
      [value11, value12] = runtime.reactMarkdownToolbar.useState<
        Files.MarkdownBlockKind[]
      >([]);
    runtime.reactMarkdownToolbar.useEffect(() => {
      let callback4 = (): void => {
        let current = root.current,
          value17 =
            current === null
              ? null
              : (0, runtime.readMarkdownSelectionFormat)(current);
        if (value17 !== null) {
          value4(value17);
        }
        value10(selectedMarkdownStyles(current));
        value12(
          current === null
            ? []
            : (0, runtime.selectedMarkdownBlockKinds)(current),
        );
      };
      callback4();
      document.addEventListener("selectionchange", callback4);
      return () => document.removeEventListener("selectionchange", callback4);
    }, [root]);
    runtime.reactMarkdownToolbar.useEffect((): void => {
      if (value.open) {
        return;
      }
      value6(null);
      value8(false);
    }, [value.open]);
    let callback = (input: Files.MarkdownCommand): void => {
        if (
          root.current !== null &&
          !root.current.contains(document.activeElement)
        ) {
          callback2();
        }
        (0, runtime.applyMarkdownFormat)(
          input,
          document,
          value11.includes("quote") ? "quote" : value3.block,
        );
        let current = root.current;
        if (current !== null) {
          value4(
            (0, runtime.readMarkdownSelectionFormat)(current) ??
              runtime.EMPTY_MARKDOWN_FORMAT_STATE,
          );
        }
        onApplied();
        value.refresh();
      },
      callback2 = (): void => {
        let value17 = value.range(),
          value18 = document.getSelection();
        if (value17 === null || value18 === null) {
          return;
        }
        root.current?.focus();
        value18.removeAllRanges();
        value18.addRange(value17);
      },
      callback3 = () => {
        if ((0, runtime.normalizeExternalLinkInput)(value5 ?? "") === null) {
          return value8(true);
        }
        callback2();
        (0, runtime.applyMarkdownLink)(
          value5 ?? "",
          document,
          root.current ?? undefined,
        );
        value6(null);
        onApplied();
      },
      value13 = value3.ul || value3.ol,
      value14 = value11.length === 1 ? value11[0] : undefined,
      value15: boolean = value3.block === "p",
      value16 = disabledMarkdownFormats(value3, true, value9);
    return runtime.reactDomMarkdownToolbar.createPortal(
      <div
        ref={value.stripRef as React.Ref<HTMLDivElement>}
        style={{
          ...value.style,
          zIndex: value2,
        }}
        className={className}
        data-testid={"ds-readme-strip"}
        {...runtime.UNCOMMENTABLE_PROPS}
      >
        <div
          ref={hold}
          onBlur={(input: React.FocusEvent<HTMLElement>): void => {
            let relatedTarget = input.relatedTarget;
            if (
              relatedTarget !== null &&
              (root.current?.contains(relatedTarget) ||
                hold.current?.contains(relatedTarget) ||
                relatedTarget.closest(
                  "[" +
                    README_TOOLBAR_MENU_ATTRIBUTE +
                    "], [data-base-ui-focus-guard]",
                ) !== null)
            ) {
              return;
            }
            if (
              relatedTarget === null &&
              document.activeElement !== null &&
              hold.current?.contains(document.activeElement)
            ) {
              return;
            }
            value6(null);
            onLeave();
          }}
          onKeyDown={(event: React.KeyboardEvent<HTMLDivElement>): void => {
            if (
              event.defaultPrevented ||
              (0, runtime.isComposingEvent)(event)
            ) {
              return;
            }
            let target = event.target as HTMLElement;
            if (target.tagName === "INPUT" && event.key !== "Tab") {
              return;
            }
            let items = [
                ...event.currentTarget.querySelectorAll<HTMLElement>(
                  TOOLBAR_FOCUSABLE_SELECTOR,
                ),
              ],
              value17 = items.indexOf(target);
            if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
              if (value17 < 0 || items.length === 0) {
                return;
              }
              event.preventDefault();
              items[
                (value17 +
                  (event.key === "ArrowRight" ? 1 : items.length - 1)) %
                  items.length
              ]?.focus();
            } else if (event.key === "Escape") {
              if ((0, runtime.anyMenuOrPopoverOpen)(document)) {
                return;
              }
              event.preventDefault();
              event.stopPropagation();
              callback2();
            } else if (event.key === "Tab" && value17 >= 0) {
              event.preventDefault();
              event.stopPropagation();
              root.current?.focus();
              document.getSelection()?.collapseToEnd();
            }
          }}
        >
          <runtime.ToolbarStrip aria-label={"Format"} placed={value.placed}>
            {value5 !== null ? (
              <jsxMarkdownToolbar.Fragment>
                {[
                  <input
                    autoFocus={true}
                    value={value5}
                    placeholder={"Paste a link, then Enter"}
                    aria-label={"Link URL"}
                    aria-invalid={value7}
                    spellCheck={false}
                    className={(0, runtime.joinClassNames)(
                      "h-7 w-56 min-w-0 bg-transparent px-2 text-xs text-fg outline-none placeholder:text-fg-muted",
                      "pointer-coarse:h-10 pointer-coarse:text-sm",
                      value7 && "text-bad",
                    )}
                    onChange={(
                      event: React.ChangeEvent<HTMLInputElement>,
                    ): void => {
                      value6(event.target.value);
                      value8(false);
                    }}
                    onBlur={(input: React.FocusEvent<HTMLElement>): void => {
                      let relatedTarget = input.relatedTarget;
                      if (
                        relatedTarget !== null &&
                        (root.current?.contains(relatedTarget) ||
                          hold.current?.contains(relatedTarget))
                      ) {
                        return;
                      }
                      value6(null);
                      onLeave();
                    }}
                    onKeyDown={(
                      event: React.KeyboardEvent<HTMLInputElement>,
                    ): void => {
                      if ((0, runtime.isComposingEvent)(event)) {
                        return;
                      }
                      if (event.key === "Enter") {
                        event.preventDefault();
                        callback3();
                      } else if (event.key === "Escape") {
                        event.preventDefault();
                        event.stopPropagation();
                        value6(null);
                        value8(false);
                        callback2();
                      }
                    }}
                  />,
                  <runtime.ToolbarStripButton
                    title={"Cancel"}
                    aria-label={"Cancel"}
                    icon={"X"}
                    onClick={(): void => {
                      value6(null);
                      value8(false);
                      callback2();
                    }}
                  />,
                ]}
              </jsxMarkdownToolbar.Fragment>
            ) : (
              <jsxMarkdownToolbar.Fragment>
                {[
                  <runtime.ToolbarStripButton
                    title={value16.bold ?? "Bold"}
                    aria-label={"Bold"}
                    icon={"TextBold"}
                    aria-pressed={value3.bold}
                    disabled={value16.bold !== undefined}
                    onClick={() => callback("bold")}
                  />,
                  <runtime.ToolbarStripButton
                    title={value16.italic ?? "Italic"}
                    aria-label={"Italic"}
                    icon={"TextItalics"}
                    aria-pressed={value3.italic}
                    disabled={value16.italic !== undefined}
                    onClick={() => callback("italic")}
                  />,
                  <runtime.ToolbarStripButton
                    title={
                      value16.link ??
                      (value3.link !== undefined ? "Remove link" : "Link")
                    }
                    aria-label={
                      value3.link !== undefined ? "Remove link" : "Link"
                    }
                    icon={"Link"}
                    aria-pressed={value3.link !== undefined}
                    disabled={value16.link !== undefined}
                    onClick={(): void => {
                      if (value3.link !== undefined) {
                        callback("unlink");
                      } else {
                        value8(false);
                        value6("");
                      }
                    }}
                  />,
                  <runtime.ToolbarDivider />,
                  (() => {
                    const _Element = runtime.ToolbarSelect;
                    const _elementProps = {
                      title: value13
                        ? "A list item stays a paragraph"
                        : "Block style",
                      testid: "ds-readme-block-menu",
                      disabled: value13,
                      value:
                        value14 !== undefined &&
                        isEditableMarkdownBlock(value14)
                          ? value14
                          : null,
                      chipLabel: MARKDOWN_BLOCK_LABELS[value14 ?? value3.block],
                      options: EDITABLE_MARKDOWN_BLOCK_TYPES.map(
                        (input: Core.MarkdownFormatState["block"]) => ({
                          value: input,
                          label: MARKDOWN_BLOCK_LABELS[input],
                        }),
                      ),
                      onChange: (input: Files.MarkdownCommand) =>
                        callback(input),
                      popupAttrs: README_TOOLBAR_MENU_PROPS,
                    };
                    const _elementKey = value.open ? "open" : "shut";
                    return <_Element key={_elementKey} {..._elementProps} />;
                  })(),
                  <runtime.ToolbarStripButton
                    title={
                      value15 ? "Bulleted list" : "Only paragraphs become lists"
                    }
                    aria-label={"Bulleted list"}
                    icon={"ListBullet"}
                    aria-pressed={value3.ul}
                    disabled={!value15}
                    onClick={() => callback("ul")}
                  />,
                  <runtime.ToolbarStripButton
                    title={
                      value15 ? "Numbered list" : "Only paragraphs become lists"
                    }
                    aria-label={"Numbered list"}
                    icon={"ListNumbered"}
                    aria-pressed={value3.ol}
                    disabled={!value15}
                    onClick={() => callback("ol")}
                  />,
                ]}
              </jsxMarkdownToolbar.Fragment>
            )}
          </runtime.ToolbarStrip>
        </div>
      </div>,
      document.body,
    );
  }
  function MarkdownLinkPopover({
    root: root,
    className: className,
  }: M.MarkdownLinkPopoverProps) {
    let value = (0, runtime.useCdsLayerAwareZIndex)(45),
      ref = runtime.reactMarkdownToolbar.useRef<HTMLDivElement>(null),
      [value2, value3] =
        runtime.reactMarkdownToolbar.useState<M.MarkdownLinkState | null>(null),
      [value4, value5] =
        runtime.reactMarkdownToolbar.useState<React.CSSProperties>({
          position: "fixed",
          top: 0,
          left: 0,
          visibility: "hidden",
        });
    runtime.reactMarkdownToolbar.useEffect(() => {
      let value6 = root.current?.ownerDocument ?? document,
        value7 = value6.defaultView ?? window,
        callback = () => {
          let current = root.current,
            value8 = value6.getSelection();
          if (
            current === null ||
            value8 === null ||
            value8.rangeCount === 0 ||
            !value8.isCollapsed
          ) {
            return value3(null);
          }
          let startContainer = value8.getRangeAt(0).startContainer,
            value9 =
              (startContainer.nodeType === 1
                ? (startContainer as Element)
                : startContainer.parentElement
              )?.closest("a[data-href]") ?? null,
            value10: string =
              value9 === null || !current.contains(value9)
                ? ""
                : (0, runtime.safeLinkUrlFromElement)(value9);
          if (value9 === null || value10 === "") {
            return value3(null);
          }
          let bounds = value9.getBoundingClientRect();
          value3((input: M.MarkdownLinkState | null) =>
            input !== null &&
            input.href === value10 &&
            input.rect.top === bounds.top &&
            input.rect.left === bounds.left
              ? input
              : {
                  href: value10,
                  rect: bounds,
                },
          );
        };
      callback();
      value6.addEventListener("selectionchange", callback);
      value7.addEventListener("scroll", callback, {
        capture: true,
        passive: true,
      });
      value7.addEventListener("resize", callback);
      return (): void => {
        value6.removeEventListener("selectionchange", callback);
        value7.removeEventListener("scroll", callback, {
          capture: true,
        });
        value7.removeEventListener("resize", callback);
      };
    }, [root]);
    runtime.reactMarkdownToolbar.useLayoutEffect((): void => {
      if (value2 === null) {
        return;
      }
      let value6 = ref.current?.offsetWidth ?? 0,
        value7 = ref.current?.offsetHeight ?? 0,
        clientWidth = document.documentElement.clientWidth,
        clientHeight = document.documentElement.clientHeight,
        value8: boolean = value2.rect.bottom + 6 + value7 <= clientHeight - 8;
      value5({
        position: "fixed",
        top: Math.round(
          value8 ? value2.rect.bottom + 6 : value2.rect.top - 6 - value7,
        ),
        left: Math.round(
          Math.max(8, Math.min(value2.rect.left, clientWidth - value6 - 8)),
        ),
      });
    }, [value2]);
    if (value2 === null) {
      return null;
    }
    return runtime.reactDomMarkdownToolbar.createPortal(
      <div
        ref={ref}
        style={{
          ...value4,
          zIndex: value,
        }}
        className={className}
        data-testid={"ds-readme-link-bubble"}
      >
        <runtime.ToolbarStrip
          aria-label={"Link"}
          surface={"popover"}
          style={
            {
              "--mc-strip-pad": "9px",
              borderRadius: "0.75rem",
            } as M.MarkdownStripStyle
          }
        >
          <a
            {...(0, runtime.externalLinkProps)(value2.href)}
            title={value2.href}
            className={
              "inline-flex max-w-64 items-center gap-1 px-1 text-xs text-blue-text hover:underline pointer-coarse:min-h-10 pointer-coarse:text-sm"
            }
          >
            {[
              <span className={"truncate"}>
                {externalLinkDisplayLabel(value2.href)}
              </span>,
              <runtime.KitIcon name={"ArrowUpRight"} size={12} />,
            ]}
          </a>
        </runtime.ToolbarStrip>
      </div>,
      document.body,
    );
  }
  function externalLinkDisplayLabel(url: string): string {
    try {
      let value = new URL(url);
      return (
        value.host.replace(/^www\./, "") +
        (value.pathname === "/" && value.search === ""
          ? ""
          : value.pathname + value.search)
      );
    } catch {
      return url;
    }
  }
  bindRuntimeValue(
    runtime,
    "jsxMarkdownToolbar",
    () => jsxMarkdownToolbar,
    (value) => {
      jsxMarkdownToolbar = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MARKDOWN_BLOCK_LABELS",
    () => MARKDOWN_BLOCK_LABELS,
    (value) => {
      MARKDOWN_BLOCK_LABELS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "README_TOOLBAR_MENU_ATTRIBUTE",
    () => README_TOOLBAR_MENU_ATTRIBUTE,
    (value) => {
      README_TOOLBAR_MENU_ATTRIBUTE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "README_TOOLBAR_MENU_PROPS",
    () => README_TOOLBAR_MENU_PROPS,
    (value) => {
      README_TOOLBAR_MENU_PROPS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TOOLBAR_FOCUSABLE_SELECTOR",
    () => TOOLBAR_FOCUSABLE_SELECTOR,
    (value) => {
      TOOLBAR_FOCUSABLE_SELECTOR = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "EDITABLE_MARKDOWN_BLOCK_TYPES",
    () => EDITABLE_MARKDOWN_BLOCK_TYPES,
    (value) => {
      EDITABLE_MARKDOWN_BLOCK_TYPES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isEditableMarkdownBlock",
    () => isEditableMarkdownBlock,
    (value) => {
      isEditableMarkdownBlock = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "EMPTY_SELECTION_STYLE_STATE",
    () => EMPTY_SELECTION_STYLE_STATE,
    (value) => {
      EMPTY_SELECTION_STYLE_STATE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "disabledMarkdownFormats",
    () => disabledMarkdownFormats,
  );
  bindRuntimeValue(
    runtime,
    "selectedMarkdownStyles",
    () => selectedMarkdownStyles,
  );
  bindRuntimeValue(
    runtime,
    "MarkdownFormattingToolbar",
    () => MarkdownFormattingToolbar,
  );
  bindRuntimeValue(runtime, "MarkdownLinkPopover", () => MarkdownLinkPopover);
  bindRuntimeValue(
    runtime,
    "externalLinkDisplayLabel",
    () => externalLinkDisplayLabel,
  );
  return () => {
    jsxMarkdownToolbar = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
    MARKDOWN_BLOCK_LABELS = {
      p: "Paragraph",
      h1: "Title",
      h2: "Heading",
      h3: "Subheading",
      quote: "Quote",
      pre: "Code",
    };
    README_TOOLBAR_MENU_ATTRIBUTE = "data-readme-strip-menu";
    README_TOOLBAR_MENU_PROPS = {
      ...runtime.UNCOMMENTABLE_PROPS,
      [README_TOOLBAR_MENU_ATTRIBUTE]: "",
    };
    TOOLBAR_FOCUSABLE_SELECTOR =
      'button:not(:disabled), [role="button"][aria-disabled="true"], input';
    EDITABLE_MARKDOWN_BLOCK_TYPES = ["p", "h2", "h3", "quote"];
    isEditableMarkdownBlock = (input: Core.MarkdownFormatState["block"]) =>
      (
        EDITABLE_MARKDOWN_BLOCK_TYPES as readonly Core.MarkdownFormatState["block"][]
      ).includes(input);
    EMPTY_SELECTION_STYLE_STATE = {
      bold: false,
      italic: false,
      code: false,
      link: false,
    };
  };
}
