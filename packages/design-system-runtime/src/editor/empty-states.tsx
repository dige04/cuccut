import type * as React from "react";
import type * as Token from "../contracts/token-editors";
import type * as Model from "../contracts";
import type * as Color from "../contracts/color-controls";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installEditorEmptyStates(runtime: RuntimeBindings): () => void {
  var jsxEditorEmptyStates: typeof import("react/jsx-runtime");
  var EMPTY_SECTION_HINTS: Record<Token.EmptySectionKind, string>;
  var READ_ONLY_EMPTY_SECTION_HINTS: Record<Token.EmptySectionKind, string>;
  function EmptyEditorList({
    text: text,
  }: {
    text: React.ReactNode;
  }): React.ReactElement {
    return (
      <p
        className={"ds-empty-list ds-pad py-md text-body text-secondary"}
        {...runtime.UNCOMMENTABLE_PROPS}
      >
        {text}
      </p>
    );
  }
  function EditorActionButton({
    onClick: onClick,
    label: label,
    icon: icon,
    "data-testid": dataTestid,
    disabled: disabled,
    why: why,
  }: Token.EditorActionButtonProps): React.ReactElement {
    return (
      <runtime.Button
        variant={"ghost"}
        size={"sm"}
        icon={icon}
        disabled={disabled}
        disabledReason={why}
        onClick={onClick}
        data-testid={dataTestid}
        {...runtime.UNCOMMENTABLE_PROPS}
      >
        {label}
      </runtime.Button>
    );
  }
  function SectionUsageNote({
    note: note,
    edgeRef: edgeRef,
  }: {
    note: React.ReactNode;
    edgeRef?: React.Ref<HTMLDivElement>;
  }): React.ReactElement {
    return (
      <div
        ref={edgeRef}
        className={"ds-handoff-note ds-sec min-w-0 px-xs"}
        data-testid={"ds-handoff-note-row"}
        {...runtime.UNCOMMENTABLE_PROPS}
      >
        {note}
      </div>
    );
  }
  function EmptySectionHint({
    kind: kind,
    readOnly = false,
  }: {
    kind: Token.EmptySectionKind;
    readOnly?: boolean;
  }): React.ReactElement {
    return (
      <p
        className={"text-body text-secondary"}
        data-testid={"ds-empty-" + kind}
        {...runtime.UNCOMMENTABLE_PROPS}
      >
        {readOnly ? "Nothing here yet." : READ_ONLY_EMPTY_SECTION_HINTS[kind]}
      </p>
    );
  }
  bindRuntimeValue(
    runtime,
    "jsxEditorEmptyStates",
    () => jsxEditorEmptyStates,
    (value) => {
      jsxEditorEmptyStates = value;
    },
  );
  bindRuntimeValue(runtime, "EmptyEditorList", () => EmptyEditorList);
  bindRuntimeValue(runtime, "EditorActionButton", () => EditorActionButton);
  bindRuntimeValue(runtime, "SectionUsageNote", () => SectionUsageNote);
  bindRuntimeValue(
    runtime,
    "EMPTY_SECTION_HINTS",
    () => EMPTY_SECTION_HINTS,
    (value) => {
      EMPTY_SECTION_HINTS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "READ_ONLY_EMPTY_SECTION_HINTS",
    () => READ_ONLY_EMPTY_SECTION_HINTS,
    (value) => {
      READ_ONLY_EMPTY_SECTION_HINTS = value;
    },
  );
  bindRuntimeValue(runtime, "EmptySectionHint", () => EmptySectionHint);
  return () => {
    jsxEditorEmptyStates = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
    // CucCut: user-facing copy calls the agent "the agent", not Claude.
    EMPTY_SECTION_HINTS = {
      colors:
        "Ask the agent for a palette, a dark or high-contrast theme, a check for contrast and colour-blind safety, or to pull the colours from your repo — or add groups by hand.",
      type: "Ask the agent to pick a type pairing, set up display, heading and body styles, or load your brand fonts — or add styles yourself.",
      spacing:
        "Ask the agent for a spacing scale — a few steps from tight to roomy — or add values yourself, with a note on when to use each.",
      corners:
        "Ask the agent for the corner radii, from sharp to fully round, or add them yourself.",
      shadows:
        "Ask the agent for an elevation scale, one shadow per level in each theme, or add them yourself.",
      components:
        "Ask the agent to build components from your code or a description — buttons, inputs, cards — and their previews and usage notes land here.",
      assets:
        "Ask the agent to gather your logos and icons from a repo, or drop files anywhere on the page.",
      family:
        "Ask the agent to fill this in, or add values with a note on when to use each.",
    };
    READ_ONLY_EMPTY_SECTION_HINTS = {
      colors: "No colors yet.",
      type: "No type styles or font files yet.",
      spacing: "No spacing values yet.",
      corners: "No corner radii yet.",
      shadows: "No shadows yet.",
      components: "No components yet.",
      assets: "No files yet.",
      family: "No tokens yet.",
    };
  };
}
