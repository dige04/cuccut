import type * as React from "react";
import type * as Token from "../contracts/token-editors";
import type * as Model from "../contracts";
import type * as Color from "../contracts/color-controls";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installEditorSectionCard(runtime: RuntimeBindings): () => void {
  var reactSectionCollapse: typeof import("react");
  var jsxSectionCard: typeof import("react/jsx-runtime");
  var SECTION_CARD_CLASS_NAME: string;
  var SECTION_HEAD_INTERACTIVE_SELECTOR: string;
  function restoreFocusAfterRemoval(
    element: HTMLElement,
    force: boolean = false,
  ): () => void {
    let ownerDocument = element.ownerDocument,
      ancestor = element.closest(".ds-tokrow, tr, [data-card-key]");
    if (
      ancestor === null ||
      (!force && !ancestor.contains(ownerDocument.activeElement))
    ) {
      return (): void => {
        return;
      };
    }
    let parentElement = ancestor.parentElement,
      value =
        parentElement === null
          ? -1
          : [...parentElement.children]
              .filter((input) =>
                input.matches(".ds-tokrow, tr, [data-card-key]"),
              )
              .indexOf(ancestor),
      items: Element[] = [];
    for (
      let value2 = parentElement;
      value2 !== null && value2 !== ownerDocument.body;
      value2 = value2.parentElement
    ) {
      if (value2.matches('section, table, [role="table"]')) {
        items.push(
          ...[
            value2,
            value2.nextElementSibling,
            value2.previousElementSibling,
          ].filter((input): input is Element => input !== null),
        );
      }
    }
    let index: number = 0,
      callback = (): void => {
        let activeElement = ownerDocument.activeElement;
        if (
          ancestor.isConnected ||
          (activeElement !== null &&
            activeElement !== ownerDocument.body &&
            activeElement.closest('[role="menu"]') !== null)
        ) {
          if (++index < 20) {
            requestAnimationFrame(callback);
          }
          return;
        }
        if (activeElement !== null && activeElement !== ownerDocument.body) {
          return;
        }
        let value2 =
          parentElement !== null && parentElement.isConnected
            ? [...parentElement.children].filter((input) =>
                input.matches(".ds-tokrow, tr, [data-card-key]"),
              )
            : [];
        for (let value3 of [value2[value], value2[value - 1], ...items]) {
          if (value3 === undefined || !value3.isConnected) {
            continue;
          }
          let value4 =
            value3 instanceof HTMLElement && value3.tabIndex >= 0
              ? value3
              : value3.querySelector<HTMLElement>(
                  'button:not([disabled]), input:not([disabled]), [contenteditable="true"], [tabindex]:not([tabindex="-1"])',
                );
          if (value4 !== null) {
            value4.focus();
            return;
          }
        }
      };
    return () => requestAnimationFrame(callback);
  }
  function nearestScrollableAncestor(element: HTMLElement): HTMLElement {
    let parentElement = element.parentElement;
    while (parentElement !== null) {
      let overflowY = getComputedStyle(parentElement).overflowY;
      if (overflowY === "auto" || overflowY === "scroll") {
        return parentElement;
      }
      parentElement = parentElement.parentElement;
    }
    return document.documentElement;
  }
  function scrollEditorElementIntoView(element: HTMLElement | null): void {
    if (element === null) {
      return;
    }
    let value = nearestScrollableAncestor(element),
      value2 =
        value === document.documentElement
          ? 0
          : value.getBoundingClientRect().top,
      value3 = element.getBoundingClientRect().top - value2;
    if (value3 >= 0) {
      return;
    }
    let value4: number = Math.max(0, value.scrollTop + value3);
    if (typeof value.scrollTo === "function") {
      value.scrollTo({
        top: value4,
        behavior: "instant",
      });
    } else {
      value.scrollTop = value4;
    }
  }
  function isSectionHeadBackgroundEvent(
    event: React.MouseEvent<HTMLElement>,
  ): boolean {
    let target = event.target as Element;
    if (!event.currentTarget.contains(target)) {
      return false;
    }
    let ancestor = target.closest(SECTION_HEAD_INTERACTIVE_SELECTOR);
    return (
      ancestor === null ||
      !event.currentTarget.contains(ancestor) ||
      ancestor === event.currentTarget
    );
  }
  function SectionCollapseButton({
    open: open,
    onToggle: onToggle,
    label: label,
    "data-testid": dataTestid,
  }: Token.SectionCollapseButtonProps): React.ReactElement {
    return (
      <runtime.Button
        variant={"ghost"}
        size={"sm"}
        iconOnly={true}
        icon={"CaretRight"}
        aria-label={(open ? "Collapse " : "Expand ") + label}
        aria-expanded={open}
        tooltip={false}
        className={(0, runtime.joinClassNames)(
          "transition-transform duration-fast",
          open && "rotate-90",
        )}
        onClick={onToggle}
        data-testid={dataTestid}
        {...runtime.UNCOMMENTABLE_PROPS}
      />
    );
  }
  function RemoveSectionButton({
    label: label,
    why: why,
    onRemove: onRemove,
    icon = "X",
    verb = "Delete",
    "data-testid": dataTestid,
  }: Token.RemoveSectionButtonProps): React.ReactElement {
    let value = why !== undefined || onRemove === undefined;
    return (
      <runtime.DisabledReasonTooltip
        reason={value ? (why ?? "Read-only document") : undefined}
      >
        <runtime.Button
          variant={"ghost"}
          size={"sm"}
          iconOnly={true}
          icon={icon}
          aria-label={verb + " " + label}
          tooltip={verb}
          disabled={value}
          onClick={
            onRemove === undefined
              ? undefined
              : (input: React.MouseEvent<HTMLButtonElement>): void => {
                  let value2 = restoreFocusAfterRemoval(input.currentTarget);
                  onRemove();
                  value2();
                }
          }
          onKeyDown={(event: React.KeyboardEvent<HTMLButtonElement>): void => {
            if (event.repeat && (event.key === "Enter" || event.key === " ")) {
              event.preventDefault();
            }
          }}
          data-testid={dataTestid}
          {...runtime.UNCOMMENTABLE_PROPS}
        />
      </runtime.DisabledReasonTooltip>
    );
  }
  function SectionCard({
    head: head,
    actions: actions,
    className: className,
    cardKey: cardKey,
    anchorId: anchorId,
    dropGroup: dropGroup,
    overlay: overlay,
    dropHandlers: dropHandlers,
    "data-testid": dataTestid,
    flat = false,
    children: children,
  }: Token.SectionCardProps): React.ReactElement {
    let [value, value2] = reactSectionCollapse.useState(false),
      ref = reactSectionCollapse.useRef<HTMLDivElement | null>(null);
    reactSectionCollapse.useLayoutEffect((): void => {
      if (value) {
        scrollEditorElementIntoView(ref.current?.parentElement ?? null);
      }
    }, [value]);
    let callback = () => value2((input): boolean => !input),
      value3 = head["data-testid"],
      value4: boolean = head.onRename !== undefined,
      value5 = value4 ? (
        (() => {
          const _Element = runtime.EditableName;
          const _elementProps = {
            kind: "title" as const,
            name: head.title,
            defaultTitle: head.defaultTitle,
            placeholder: head.autoEdit?.placeholder ?? head.placeholder,
            taken: runtime.EMPTY_DOC_LINKS,
            commit: (input: string) => head.onRename?.(input) ?? true,
            autoEdit: head.autoEdit !== undefined,
            onEditing:
              head.autoEdit !== undefined
                ? (input: boolean): void => {
                    if (!input) {
                      head.autoEdit?.onEnd();
                    }
                  }
                : undefined,
            "data-testid": value3 !== undefined ? value3 + "-title" : undefined,
            inputTestId: value3 !== undefined ? value3 + "-field" : undefined,
          };
          const _elementKey = head.autoEdit !== undefined ? "naming" : "named";
          return <_Element key={_elementKey} {..._elementProps} />;
        })()
      ) : (
        <span
          data-testid={value3 !== undefined ? value3 + "-title" : undefined}
        >
          {head.title}
        </span>
      ),
      value6 =
        actions !== undefined || head.onRemove !== undefined || value4 ? (
          <jsxSectionCard.Fragment>
            {[
              actions,
              head.onRemove !== undefined ? (
                <RemoveSectionButton
                  label={head.title}
                  why={head.removeWhy}
                  onRemove={head.onRemove}
                  icon={flat ? "Trash" : "X"}
                  data-testid={
                    value3 !== undefined ? value3 + "-delete" : undefined
                  }
                />
              ) : null,
              value4 && !flat ? (
                <SectionCollapseButton
                  open={!value}
                  onToggle={callback}
                  label={head.title}
                />
              ) : null,
            ]}
          </jsxSectionCard.Fragment>
        ) : undefined;
    return (
      <runtime.Collapsible.Root
        open={!value}
        className={(0, runtime.joinClassNames)(
          SECTION_CARD_CLASS_NAME,
          className,
        )}
        data-testid={dataTestid}
        data-card-key={cardKey}
        data-id={anchorId}
        data-drop-group={dropGroup}
        data-collapsed={value ? "" : undefined}
        {...dropHandlers}
      >
        {[
          <div
            ref={ref}
            className={(0, runtime.joinClassNames)(
              "ds-sh sticky top-0 z-[2] bg-surface-1",
              !value && "border-b border-alpha-2",
            )}
            data-expanded={String(!value)}
            data-testid={value3}
            onClick={
              value4 && !flat
                ? (
                    input: React.MouseEvent<HTMLDivElement>,
                  ): void => {
                    if (isSectionHeadBackgroundEvent(input)) {
                      callback();
                    }
                  }
                : undefined
            }
            {...(anchorId !== undefined ? runtime.COMMENT_TARGET_PROPS : {})}
          >
            <runtime.PropertySectionHeader
              title={value5}
              actions={value6}
              collapsed={value}
              onToggle={value4 || flat ? undefined : callback}
            />
          </div>,
          <runtime.Collapsible.Panel keepMounted={true}>
            <div className={"flex min-w-0 flex-col"}>{children}</div>
          </runtime.Collapsible.Panel>,
          overlay,
        ]}
      </runtime.Collapsible.Root>
    );
  }
  bindRuntimeValue(
    runtime,
    "reactSectionCollapse",
    () => reactSectionCollapse,
    (value) => {
      reactSectionCollapse = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "restoreFocusAfterRemoval",
    () => restoreFocusAfterRemoval,
  );
  bindRuntimeValue(
    runtime,
    "nearestScrollableAncestor",
    () => nearestScrollableAncestor,
  );
  bindRuntimeValue(
    runtime,
    "scrollEditorElementIntoView",
    () => scrollEditorElementIntoView,
  );
  bindRuntimeValue(
    runtime,
    "jsxSectionCard",
    () => jsxSectionCard,
    (value) => {
      jsxSectionCard = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SECTION_CARD_CLASS_NAME",
    () => SECTION_CARD_CLASS_NAME,
    (value) => {
      SECTION_CARD_CLASS_NAME = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SECTION_HEAD_INTERACTIVE_SELECTOR",
    () => SECTION_HEAD_INTERACTIVE_SELECTOR,
    (value) => {
      SECTION_HEAD_INTERACTIVE_SELECTOR = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isSectionHeadBackgroundEvent",
    () => isSectionHeadBackgroundEvent,
  );
  bindRuntimeValue(
    runtime,
    "SectionCollapseButton",
    () => SectionCollapseButton,
  );
  bindRuntimeValue(runtime, "RemoveSectionButton", () => RemoveSectionButton);
  bindRuntimeValue(runtime, "SectionCard", () => SectionCard);
  return () => {
    reactSectionCollapse = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    jsxSectionCard = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
    SECTION_CARD_CLASS_NAME =
      "ds-sec relative flex min-w-0 flex-col overflow-clip rounded-card bg-surface-1 shadow-card-ring";
    SECTION_HEAD_INTERACTIVE_SELECTOR =
      'button,input,textarea,select,label,a,[role="button"],[role="radio"],[role="switch"],[role="checkbox"],[role="slider"],[role="menuitem"],[contenteditable="true"]';
  };
}
