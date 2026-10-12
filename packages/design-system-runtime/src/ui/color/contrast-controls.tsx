import type * as React from "react";
import type * as Color from "../../contracts/color-controls";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../../runtime-types";
export function installUiColorContrastControls(
  runtime: RuntimeBindings,
): () => void {
  var jsxForUiContrastControls: typeof import("react/jsx-runtime");
  var opaqueContrastColor: (
    color: Color.RgbaColor | undefined,
  ) => Color.RgbaColor | undefined;
  var contrastVerdictClass: (passes: boolean) => string;
  function contrastDisplayInfo(
    results: Color.ContrastResult[],
  ): Color.ContrastDisplayInfo {
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
  function contrastRgbCss(
    color: Color.RgbaColor | undefined,
  ): string | undefined {
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
  }: Color.ContrastMarkProps): React.ReactElement {
    let value = contrastDisplayInfo(results),
      worst = value.worst;
    return (
      <span
        data-kit={"contrast-mark"}
        data-verdict={worst.passes ? "pass" : "fail"}
        title={value.title}
        aria-hidden={sentence ? undefined : true}
        className={(0, runtime.joinClassNames)(
          "inline-flex shrink-0 items-center gap-0.5 text-caption",
          contrastVerdictClass(worst.passes),
          className,
        )}
      >
        {[
          <span aria-hidden={"true"} className={"flex items-center gap-0.5"}>
            {[
              <runtime.Icon
                name={worst.passes ? "Check" : "Warning"}
                size={"xs"}
              />,
              <span className={"tabular-nums"}>
                {(0, runtime.contrastRatioReadout)(worst.ratio)}
              </span>,
            ]}
          </span>,
          sentence ? <span className={"sr-only"}>{value.sentence}</span> : null,
        ]}
      </span>
    );
  }
  function ContrastCaption({
    result: result,
    name: name,
    className: className,
  }: Color.ContrastCaptionProps): React.ReactElement {
    return (
      <span
        data-kit={"contrast-caption"}
        aria-hidden={"true"}
        className={(0, runtime.joinClassNames)(
          "flex min-w-0 flex-wrap items-center gap-x-1 text-caption leading-tight",
          contrastVerdictClass(result.passes),
          className,
        )}
      >
        {[
          <span>
            {result.passes
              ? runtime.CONTRAST_GROUND_PREPOSITION
              : runtime.CONTRAST_POOR_GROUND_PREPOSITION}
          </span>,
          <span className={"inline-flex min-w-0 items-center gap-1"}>
            {[
              <span className={"min-w-0 break-words"}>
                {name ?? result.ground.label}
              </span>,
              <span
                className={
                  "inline-block size-3 shrink-0 rounded-[3px] shadow-field-ring"
                }
                style={{
                  backgroundColor: contrastRgbCss(
                    (0, runtime.parseContrastColor)(result.ground.css),
                  ),
                }}
              />,
            ]}
          </span>,
        ]}
      </span>
    );
  }
  function ContrastLockup({
    fg: fg,
    results: results,
    className: className,
  }: Color.ContrastLockupProps): React.ReactElement {
    let value = contrastDisplayInfo(results),
      worst = value.worst;
    return (
      <span
        data-kit={"contrast-lockup"}
        data-verdict={worst.passes ? "pass" : "fail"}
        aria-hidden={"true"}
        title={value.title}
        className={(0, runtime.joinClassNames)(
          "inline-flex min-w-0 items-center gap-1.5 text-caption leading-4",
          className,
        )}
      >
        {[
          <span
            data-kit={"contrast-swatch"}
            className={
              "inline-flex size-4 shrink-0 items-center justify-center rounded-[4px] shadow-card-ring"
            }
            style={{
              backgroundColor: contrastRgbCss(
                opaqueContrastColor(
                  (0, runtime.parseContrastColor)(worst.ground.css),
                ),
              ),
              color: contrastRgbCss(
                typeof fg === "string"
                  ? (0, runtime.parseContrastColor)(fg)
                  : fg,
              ),
            }}
          >
            <runtime.Icon name={"TextAa"} size={"xs"} />
          </span>,
          <span className={worst.passes ? "text-primary" : "text-warning"}>
            {worst.passes
              ? runtime.CONTRAST_PASSES_LABEL
              : runtime.CONTRAST_FAILS_LABEL}
          </span>,
        ]}
      </span>
    );
  }
  function ContrastColorDetails({
    fg: fg,
    results: results,
    sentenceId: sentenceId,
    fix: fix,
    fixHeld = false,
    fixRef: fixRef,
    onFixGoneFocused: onFixGoneFocused,
  }: Color.ContrastColorDetailsProps): React.ReactElement {
    let value = contrastDisplayInfo(results),
      worst = value.worst;
    return (
      <div
        className={
          "mt-1.5 flex min-h-4 min-w-0 flex-wrap items-center gap-x-2 gap-y-1"
        }
      >
        {[
          <span
            data-kit={"contrast-readout"}
            data-verdict={worst.passes ? "pass" : "fail"}
            className={"inline-flex min-w-0 items-center"}
          >
            {[
              <ContrastLockup fg={fg} results={results} />,
              <span id={sentenceId} className={"sr-only"}>
                {value.sentence}
              </span>,
            ]}
          </span>,
          fix !== undefined ? (
            <ContrastFixButton
              fix={fix}
              held={fixHeld}
              rootRef={fixRef}
              onGoneFocused={onFixGoneFocused}
            />
          ) : null,
        ]}
      </div>
    );
  }
  function ContrastFixButton({
    fix: fix,
    held = false,
    rootRef: rootRef,
    onGoneFocused: onGoneFocused,
  }: Color.ContrastFixButtonProps): React.ReactElement {
    let value = (runtime.reactForUiContrastControls as typeof React).useId(),
      ref = (runtime.reactForUiContrastControls as typeof React).useRef(false),
      ref2 = (
        runtime.reactForUiContrastControls as typeof React
      ).useRef<HTMLSpanElement | null>(null),
      callback = (
        runtime.reactForUiContrastControls as typeof React
      ).useCallback(
        (input: HTMLSpanElement | null) => {
          ref2.current = input;
          if (typeof rootRef === "function") {
            rootRef(input);
          } else if (rootRef) {
            rootRef.current = input;
          }
        },
        [rootRef],
      ),
      ref3 = (runtime.reactForUiContrastControls as typeof React).useRef(false),
      ref4 = (runtime.reactForUiContrastControls as typeof React).useRef(held);
    ref4.current = held;
    let ref5 = (runtime.reactForUiContrastControls as typeof React).useRef(
      onGoneFocused,
    );
    ref5.current = onGoneFocused;
    (runtime.reactForUiContrastControls as typeof React).useLayoutEffect(
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
    return (
      <span
        ref={callback}
        data-kit={"contrast-fix"}
        data-shade={fix.css}
        aria-hidden={held ? true : undefined}
        className={(0, runtime.joinClassNames)(
          "inline-flex min-w-0 items-center",
          held && "invisible",
        )}
      >
        {[
          <runtime.Button
            variant={"secondary"}
            title={
              fix.css +
              " · " +
              (0, runtime.contrastRatioReadout)(fix.ratio) +
              " " +
              runtime.CONTRAST_GROUND_PREPOSITION +
              " " +
              fix.ground
            }
            aria-describedby={value}
            disabled={held}
            onPointerDown={(input: React.PointerEvent<HTMLButtonElement>) => {
              ref.current = input.pointerType === "touch";
            }}
            onClick={() => {
              let current = ref.current;
              ref.current = false;
              ref3.current = current;
              fix.onUse(current);
            }}
          >
            {runtime.COLOR_FIX_LABEL}
          </runtime.Button>,
          <span id={value} className={"sr-only"}>
            {(0, runtime.contrastFixDescription)({
              hex: fix.css,
              ratio: (0, runtime.contrastRatioSpoken)(fix.ratio),
              ground: fix.ground,
            })}
          </span>,
        ]}
      </span>
    );
  }
  bindRuntimeValue(
    runtime,
    "jsxForUiContrastControls",
    () => jsxForUiContrastControls,
    (value) => {
      jsxForUiContrastControls = value;
    },
  );
  bindRuntimeValue(runtime, "contrastDisplayInfo", () => contrastDisplayInfo);
  bindRuntimeValue(runtime, "contrastRgbCss", () => contrastRgbCss);
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
  bindRuntimeValue(runtime, "ContrastMark", () => ContrastMark);
  bindRuntimeValue(runtime, "ContrastCaption", () => ContrastCaption);
  bindRuntimeValue(runtime, "ContrastLockup", () => ContrastLockup);
  bindRuntimeValue(runtime, "ContrastColorDetails", () => ContrastColorDetails);
  bindRuntimeValue(runtime, "ContrastFixButton", () => ContrastFixButton);
  return () => {
    jsxForUiContrastControls = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
    opaqueContrastColor = (color) =>
      color === undefined
        ? undefined
        : {
            ...color,
            a: 1,
          };
    contrastVerdictClass = (passes) =>
      passes ? "text-secondary" : "text-warning";
  };
}
