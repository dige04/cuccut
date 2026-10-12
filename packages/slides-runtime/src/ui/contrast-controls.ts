/** Restored application module; prepare first, initialize in original order. */
import type {
  PointerEvent as ReactPointerEvent,
  ReactElement,
  RefObject,
} from "react";
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type JsxNamespace,
  type ReactNamespace,
} from "../bindings";
import type { ClassNameInput } from "./property-icons";

/** Non-premultiplied color with channels in 0..1. */
export interface ContrastRgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

/** The ground a color was checked against. */
export interface ContrastGround {
  label: string;
  css: string;
}

/** One contrast check of a color against one ground. */
export interface ContrastCheck {
  ratio: number;
  /** Ratio the check demands. */
  min: number;
  passes: boolean;
  ground: ContrastGround;
}

/** A suggested readable shade; `onUse` applies it (touch tells how it was chosen). */
export interface ContrastFix {
  css: string;
  ratio: number;
  ground: string;
  onUse: (byTouch: boolean) => void;
}

/** What the contrast mark, lockup and details render. */
export interface ContrastDisplayInfo {
  worst: ContrastCheck;
  title: string;
  /** Screen-reader sentence naming every failing ground. */
  sentence: string;
  /** Shortened spoken summary for live announcements. */
  spoken: string;
}

/** A foreground color: CSS text or already parsed channels. */
export type ContrastForeground = string | ContrastRgba | undefined;

export type ContrastFixRootRef =
  | ((element: HTMLElement | null) => void)
  | RefObject<HTMLElement | null>;

export interface ContrastMarkProps {
  results: readonly ContrastCheck[];
  /** Include the screen-reader sentence (default true). */
  sentence?: boolean;
  className?: ClassNameInput;
}

export interface ContrastLockupProps {
  fg: ContrastForeground;
  results: readonly ContrastCheck[];
  className?: ClassNameInput;
}

export interface ContrastFixButtonProps {
  fix: ContrastFix;
  /** Keep the button laid out but invisible. */
  held?: boolean;
  rootRef?: ContrastFixRootRef;
  /** Called when the button unmounts while it held focus. */
  onGoneFocused?: () => void;
}

export interface ContrastColorDetailsProps {
  fg: ContrastForeground;
  results: readonly ContrastCheck[];
  sentenceId?: string;
  fix?: ContrastFix;
  fixHeld?: boolean;
  fixRef?: ContrastFixRootRef;
  onFixGoneFocused?: () => void;
}

declare module "../bindings" {
  interface RuntimeBindings {
    reactForUiContrastControls: ReactNamespace;
    jsxForUiContrastControls: JsxNamespace;
    opaqueContrastColor: (
      color: ContrastRgba | undefined,
    ) => ContrastRgba | undefined;
    contrastVerdictClass: (passes: boolean) => string;
    initializeUiContrastControls: () => void;
    contrastDisplayInfo: (
      results: readonly ContrastCheck[],
    ) => ContrastDisplayInfo;
    contrastRgbCss: (color: ContrastRgba | undefined) => string | undefined;
    ContrastMark: (props: ContrastMarkProps) => ReactElement;
    ContrastLockup: (props: ContrastLockupProps) => ReactElement;
    ContrastColorDetails: (props: ContrastColorDetailsProps) => ReactElement;
    ContrastFixButton: (props: ContrastFixButtonProps) => ReactElement;
  }
}

export function installUiContrastControls(
  runtime: RuntimeBindings,
): () => void {
  var reactForUiContrastControls: ReactNamespace;
  var jsxForUiContrastControls: JsxNamespace;
  var opaqueContrastColor: (
    color: ContrastRgba | undefined,
  ) => ContrastRgba | undefined;
  var contrastVerdictClass: (passes: boolean) => string;
  var initializeUiContrastControls: () => void;
  function contrastDisplayInfo(
    results: readonly ContrastCheck[],
  ): ContrastDisplayInfo {
    let value = (0, runtime.worstContrastResult)(results),
      value2 = results.filter((input) => input !== value),
      items = [
        value,
        ...value2.sort((input, options) => input.ratio - options.ratio),
      ],
      state = {
        ratio: (0, runtime.contrastRatioSpoken)(value.ratio),
        ground: value.ground.label,
        passes: value.passes,
        min: (0, runtime.contrastRatioSpoken)(value.min),
        alsoPassing: value2.filter((input) => input.passes).length,
      },
      value3 = value2.filter((input) => !input.passes),
      value4 = (0, runtime.contrastResultCountSummary)({
        ...state,
        alsoFailing: value3.length,
      }),
      value5 = value4.length - runtime.MAX_ANNOUNCEMENT_LENGTH;
    if (value5 > 0) {
      let value6 = state.ground
        .slice(0, Math.max(1, state.ground.length - value5 - 1))
        .replace(/[\uD800-\uDBFF]$/, "");
      value4 = (0, runtime.contrastResultCountSummary)({
        ...state,
        ground: value6 + "…",
        alsoFailing: value3.length,
      });
    }
    return {
      worst: value,
      title: items
        .map(
          (input) =>
            (0, runtime.contrastRatioReadout)(input.ratio) +
            " " +
            runtime.CONTRAST_GROUND_PREPOSITION +
            " " +
            input.ground.label,
        )
        .join(" · "),
      sentence: (0, runtime.contrastResultDetails)({
        ...state,
        alsoFailing: value3.map((input) => input.ground.label),
      }),
      spoken: value4,
    };
  }
  function contrastRgbCss(color: ContrastRgba | undefined): string | undefined {
    if (color === undefined) {
      return;
    }
    let callback = (input: number) => Math.round(input * 255);
    return (
      "rgb(" +
      String(callback(color.r)) +
      " " +
      String(callback(color.g)) +
      " " +
      String(callback(color.b)) +
      " / " +
      String(Math.round(color.a * 1000) / 1000) +
      ")"
    );
  }
  function ContrastMark({
    results: results,
    sentence = true,
    className: className,
  }: ContrastMarkProps): ReactElement {
    let value = contrastDisplayInfo(results),
      worst = value.worst;
    return jsxForUiContrastControls.jsxs("span", {
      "data-kit": "contrast-mark",
      "data-verdict": worst.passes ? "pass" : "fail",
      title: value.title,
      "aria-hidden": sentence ? undefined : true,
      className: (0, runtime.joinClassNames)(
        "inline-flex shrink-0 items-center gap-0.5 text-caption",
        contrastVerdictClass(worst.passes),
        className,
      ),
      children: [
        jsxForUiContrastControls.jsxs("span", {
          "aria-hidden": "true",
          className: "flex items-center gap-0.5",
          children: [
            jsxForUiContrastControls.jsx(runtime.Icon, {
              name: worst.passes ? "Check" : "Warning",
              size: "xs",
            }),
            jsxForUiContrastControls.jsx("span", {
              className: "tabular-nums",
              children: (0, runtime.contrastRatioReadout)(worst.ratio),
            }),
          ],
        }),
        sentence
          ? jsxForUiContrastControls.jsx("span", {
              className: "sr-only",
              children: value.sentence,
            })
          : null,
      ],
    });
  }
  function ContrastLockup({
    fg: fg2,
    results: results,
    className: className,
  }: ContrastLockupProps): ReactElement {
    let value = contrastDisplayInfo(results),
      worst = value.worst;
    return jsxForUiContrastControls.jsxs("span", {
      "data-kit": "contrast-lockup",
      "data-verdict": worst.passes ? "pass" : "fail",
      "aria-hidden": "true",
      title: value.title,
      className: (0, runtime.joinClassNames)(
        "inline-flex min-w-0 items-center gap-1.5 text-caption leading-4",
        className,
      ),
      children: [
        jsxForUiContrastControls.jsx("span", {
          "data-kit": "contrast-swatch",
          className:
            "inline-flex size-4 shrink-0 items-center justify-center rounded-[4px] shadow-card-ring",
          style: {
            backgroundColor: contrastRgbCss(
              opaqueContrastColor(
                (0, runtime.parseContrastColor)(worst.ground.css),
              ),
            ),
            color: contrastRgbCss(
              typeof fg2 === "string"
                ? (0, runtime.parseContrastColor)(fg2)
                : fg2,
            ),
          },
          children: jsxForUiContrastControls.jsx(runtime.Icon, {
            name: "TextAa",
            size: "xs",
          }),
        }),
        jsxForUiContrastControls.jsx("span", {
          className: worst.passes ? "text-primary" : "text-warning",
          children: worst.passes
            ? runtime.CONTRAST_PASSES_LABEL
            : runtime.CONTRAST_FAILS_LABEL,
        }),
      ],
    });
  }
  function ContrastColorDetails({
    fg: fg2,
    results: results,
    sentenceId: sentenceId,
    fix: fix,
    fixHeld = false,
    fixRef: fixRef,
    onFixGoneFocused: onFixGoneFocused,
  }: ContrastColorDetailsProps): ReactElement {
    let value = contrastDisplayInfo(results),
      worst = value.worst;
    return jsxForUiContrastControls.jsxs("div", {
      className:
        "mt-1.5 flex min-h-4 min-w-0 flex-wrap items-center gap-x-2 gap-y-1",
      children: [
        jsxForUiContrastControls.jsxs("span", {
          "data-kit": "contrast-readout",
          "data-verdict": worst.passes ? "pass" : "fail",
          className: "inline-flex min-w-0 items-center",
          children: [
            jsxForUiContrastControls.jsx(ContrastLockup, {
              fg: fg2,
              results: results,
            }),
            jsxForUiContrastControls.jsx("span", {
              id: sentenceId,
              className: "sr-only",
              children: value.sentence,
            }),
          ],
        }),
        fix !== undefined
          ? jsxForUiContrastControls.jsx(ContrastFixButton, {
              fix: fix,
              held: fixHeld,
              rootRef: fixRef,
              onGoneFocused: onFixGoneFocused,
            })
          : null,
      ],
    });
  }
  function ContrastFixButton({
    fix: fix,
    held = false,
    rootRef: rootRef,
    onGoneFocused: onGoneFocused,
  }: ContrastFixButtonProps): ReactElement {
    let value = reactForUiContrastControls.useId(),
      ref = reactForUiContrastControls.useRef(false),
      ref2 = reactForUiContrastControls.useRef<HTMLElement | null>(null),
      callback = reactForUiContrastControls.useCallback(
        (input: HTMLElement | null) => {
          ref2.current = input;
          if (typeof rootRef === "function") {
            rootRef(input);
          } else if (rootRef) {
            rootRef.current = input;
          }
        },
        [rootRef],
      ),
      ref3 = reactForUiContrastControls.useRef(false),
      ref4 = reactForUiContrastControls.useRef(held);
    ref4.current = held;
    let ref5 = reactForUiContrastControls.useRef(onGoneFocused);
    ref5.current = onGoneFocused;
    reactForUiContrastControls.useLayoutEffect(
      () => () => {
        if (ref3.current || ref4.current || ref2.current === null) {
          return;
        }
        if (ref2.current.contains(document.activeElement)) {
          ref5.current?.();
        }
      },
      [],
    );
    return jsxForUiContrastControls.jsxs("span", {
      ref: callback,
      "data-kit": "contrast-fix",
      "data-shade": fix.css,
      "aria-hidden": held ? true : undefined,
      className: (0, runtime.joinClassNames)(
        "inline-flex min-w-0 items-center",
        held && "invisible",
      ),
      children: [
        jsxForUiContrastControls.jsx(runtime.Button, {
          variant: "secondary",
          title:
            fix.css +
            " · " +
            (0, runtime.contrastRatioReadout)(fix.ratio) +
            " " +
            runtime.CONTRAST_GROUND_PREPOSITION +
            " " +
            fix.ground,
          "aria-describedby": value,
          disabled: held,
          onPointerDown: (input: ReactPointerEvent<HTMLElement>) => {
            ref.current = input.pointerType === "touch";
          },
          onClick: () => {
            let current = ref.current;
            ref.current = false;
            ref3.current = current;
            fix.onUse(current);
          },
          children: runtime.COLOR_FIX_LABEL,
        }),
        jsxForUiContrastControls.jsx("span", {
          id: value,
          className: "sr-only",
          children: (0, runtime.contrastFixDescription)({
            hex: fix.css,
            ratio: (0, runtime.contrastRatioSpoken)(fix.ratio),
            ground: fix.ground,
          }),
        }),
      ],
    });
  }
  bindRuntimeValue(runtime, "contrastDisplayInfo", () => contrastDisplayInfo);
  bindRuntimeValue(runtime, "contrastRgbCss", () => contrastRgbCss);
  bindRuntimeValue(runtime, "ContrastMark", () => ContrastMark);
  bindRuntimeValue(runtime, "ContrastLockup", () => ContrastLockup);
  bindRuntimeValue(runtime, "ContrastColorDetails", () => ContrastColorDetails);
  bindRuntimeValue(runtime, "ContrastFixButton", () => ContrastFixButton);
  bindRuntimeValue(
    runtime,
    "reactForUiContrastControls",
    () => reactForUiContrastControls,
    (value) => {
      reactForUiContrastControls = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxForUiContrastControls",
    () => jsxForUiContrastControls,
    (value) => {
      jsxForUiContrastControls = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "opaqueContrastColor",
    () => opaqueContrastColor,
    (value) => {
      opaqueContrastColor = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "contrastVerdictClass",
    () => contrastVerdictClass,
    (value) => {
      contrastVerdictClass = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeUiContrastControls",
    () => initializeUiContrastControls,
    (value) => {
      initializeUiContrastControls = value;
    },
  );
  return () => {
    opaqueContrastColor = (color) =>
      color === undefined
        ? undefined
        : {
            ...color,
            a: 1,
          };
    contrastVerdictClass = (passes) =>
      passes ? "text-secondary" : "text-warning";
    initializeUiContrastControls = (0, runtime.initializeOnce)(() => {
      (0, runtime.initializeUiInputs210)();
      (0, runtime.initializeUiContrast)();
      (0, runtime.initializeUiAnnouncements)();
      (0, runtime.initializeUiPropertyLabels)();
      reactForUiContrastControls = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
      jsxForUiContrastControls = (0, runtime.toModuleNamespace)(
        (0, runtime.loadJsxNamespace)(),
        1,
      );
    });
  };
}
