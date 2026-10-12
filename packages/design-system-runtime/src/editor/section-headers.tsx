import type * as React from "react";
import type * as Token from "../contracts/token-editors";
import type * as Model from "../contracts";
import type * as Color from "../contracts/color-controls";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installEditorSectionHeaders(
  runtime: RuntimeBindings,
): () => void {
  var jsxSectionHeaders: typeof import("react/jsx-runtime");
  function SectionHeader({
    title: title,
    actions: actions,
    note: note,
    pageId: pageId,
    "data-testid": dataTestid,
  }: Token.SectionHeaderProps): React.ReactElement {
    return (
      <header className={"ds-page-head"} data-testid={dataTestid}>
        {[
          <div className={"flex min-w-0 flex-col gap-md"}>
            {[
              <h1
                className={"ds-page-title min-w-0"}
                {...(pageId !== undefined
                  ? (0, runtime.commentTargetProps)("page", pageId)
                  : {})}
              >
                {title}
              </h1>,
              note !== undefined ? (
                <p
                  className={
                    "ds-page-note max-w-[400px] text-body text-secondary"
                  }
                  data-testid={
                    dataTestid !== undefined ? dataTestid + "-note" : undefined
                  }
                  {...runtime.UNCOMMENTABLE_PROPS}
                >
                  {note}
                </p>
              ) : null,
            ]}
          </div>,
          actions !== undefined && actions !== null ? (
            <div
              className={"ds-page-actions flex items-center gap-sm"}
              {...runtime.UNCOMMENTABLE_PROPS}
            >
              {actions}
            </div>
          ) : null,
        ]}
      </header>
    );
  }
  function SectionSheet({
    children: children,
    "data-testid": dataTestid,
  }: Token.SectionSheetProps): React.ReactElement {
    return (
      <div
        className={"ds-sheet flex min-w-0 flex-col gap-xl"}
        data-testid={dataTestid ?? "ds-sheet"}
      >
        {children}
      </div>
    );
  }
  function SectionAddButton({
    label: label,
    what: what,
    icon = "Add",
    onClick: onClick,
    disabled: disabled,
    "data-testid": dataTestid,
  }: Token.SectionAddButtonProps): React.ReactElement {
    let value = (
      <runtime.Button
        variant={"secondary"}
        icon={icon}
        disabled={disabled}
        aria-label={what}
        onClick={(input: React.MouseEvent<HTMLButtonElement>) =>
          onClick(input.currentTarget)
        }
        data-testid={dataTestid}
      >
        {label}
      </runtime.Button>
    );
    if (what !== undefined && what !== label) {
      return (
        <runtime.TooltipWrapper tip={what}>{value}</runtime.TooltipWrapper>
      );
    } else {
      return value;
    }
  }
  function TokenTableSection({
    name: name,
    actions: actions,
    className: className,
    children: children,
    "data-testid": dataTestid,
    headTestId: headTestId,
    "aria-label": ariaLabel,
    ...props
  }: Token.TokenTableSectionProps): React.ReactElement {
    return (
      <section
        className={
          "ds-psec flex min-w-0 flex-col" +
          (className !== undefined ? " " + className : "")
        }
        aria-label={ariaLabel}
        data-testid={dataTestid}
        {...props}
      >
        {[
          name !== null || (actions !== undefined && actions !== null) ? (
            <div
              className={
                "ds-cgroup-head flex min-h-10 min-w-0 items-center gap-xs pb-xs"
              }
              data-testid={headTestId}
            >
              {[
                <span className={"ds-gname min-w-0 flex-1"}>{name}</span>,
                actions,
              ]}
            </div>
          ) : null,
          children,
        ]}
      </section>
    );
  }
  bindRuntimeValue(
    runtime,
    "jsxSectionHeaders",
    () => jsxSectionHeaders,
    (value) => {
      jsxSectionHeaders = value;
    },
  );
  bindRuntimeValue(runtime, "SectionHeader", () => SectionHeader);
  bindRuntimeValue(runtime, "SectionSheet", () => SectionSheet);
  bindRuntimeValue(runtime, "SectionAddButton", () => SectionAddButton);
  bindRuntimeValue(runtime, "TokenTableSection", () => TokenTableSection);
  return () => {
    jsxSectionHeaders = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
  };
}
