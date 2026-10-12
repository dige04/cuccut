/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";
export function installEditorColorContrastUi(
  runtime: RuntimeBindings,
): () => void {
  var jsxColorContrastUi: Dynamic;
  var withoutAlpha: Dynamic;
  var contrastVerdictClassName: Dynamic;
  function summarizeContrastResults(input?: Dynamic): Dynamic {
    let value: Dynamic = (0, runtime.worstContrastResult)(input),
      value2: Dynamic = input.filter(
        (input2?: Dynamic): Dynamic => input2 !== value,
      ),
      items: Dynamic = [
        value,
        ...value2.sort(
          (input2?: Dynamic, options?: Dynamic): Dynamic =>
            input2.ratio - options.ratio,
        ),
      ],
      state: Dynamic = {
        ratio: (0, runtime.formatSpokenContrastRatio)(value.ratio),
        ground: value.ground.label,
        passes: value.passes,
        min: (0, runtime.formatSpokenContrastRatio)(value.min),
        alsoPassing: value2.filter((input2?: Dynamic): Dynamic => input2.passes)
          .length,
      },
      value3: Dynamic = value2.filter(
        (input2?: Dynamic): Dynamic => !input2.passes,
      ),
      value4: Dynamic = (0, runtime.summarizedContrastSentence)({
        ...state,
        alsoFailing: value3.length,
      }),
      value5: Dynamic = value4.length - runtime.AccessibilityAnnouncerLimit;
    if (value5 > 0) {
      let value6: Dynamic = state.ground
        .slice(0, Math.max(1, state.ground.length - value5 - 1))
        .replace(/[\uD800-\uDBFF]$/, "");
      value4 = (0, runtime.summarizedContrastSentence)({
        ...state,
        ground: value6 + "\u2026",
        alsoFailing: value3.length,
      });
    }
    return {
      worst: value,
      title: items
        .map(
          (input2?: Dynamic): Dynamic =>
            (0, runtime.formatContrastRatio)(input2.ratio) +
            " " +
            runtime.OnValue +
            " " +
            input2.ground.label,
        )
        .join(" \xB7 "),
      sentence: (0, runtime.detailedContrastSentence)({
        ...state,
        alsoFailing: value3.map(
          (input2?: Dynamic): Dynamic => input2.ground.label,
        ),
      }),
      spoken: value4,
    };
  }
  function rgbaCssValue(input?: Dynamic): Dynamic {
    if (input === undefined) return;
    let callback: Dynamic = (input2?: Dynamic): Dynamic =>
      Math.round(input2 * 255);
    return (
      "rgb(" +
      String(callback(input.r)) +
      " " +
      String(callback(input.g)) +
      " " +
      String(callback(input.b)) +
      " / " +
      String(Math.round(input.a * 1e3) / 1e3) +
      ")"
    );
  }
  function ContrastMark({
    results: results,
    sentence = true,
    className: className,
  }: Dynamic): Dynamic {
    let value: Dynamic = summarizeContrastResults(results),
      worst: Dynamic = value.worst;
    return (
      <span
        data-kit={"contrast-mark"}
        data-verdict={worst.passes ? "pass" : "fail"}
        title={value.title}
        aria-hidden={sentence ? undefined : true}
        className={(0, runtime.joinClassNames)(
          "inline-flex shrink-0 items-center gap-0.5 text-caption",
          contrastVerdictClassName(worst.passes),
          className,
        )}
      >
        <span aria-hidden={"true"} className={"flex items-center gap-0.5"}>
          <runtime.Icon name={worst.passes ? "Check" : "Warning"} size={"xs"} />
          <span className={"tabular-nums"}>
            {(0, runtime.formatContrastRatio)(worst.ratio)}
          </span>
        </span>
        {sentence ? <span className={"sr-only"}>{value.sentence}</span> : null}
      </span>
    );
  }
  function ContrastLockup({
    fg: fg2,
    results: results,
    className: className,
  }: Dynamic): Dynamic {
    let value: Dynamic = summarizeContrastResults(results),
      worst: Dynamic = value.worst;
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
        <span
          data-kit={"contrast-swatch"}
          className={
            "inline-flex size-4 shrink-0 items-center justify-center rounded-[4px] shadow-card-ring"
          }
          style={{
            backgroundColor: rgbaCssValue(
              withoutAlpha((0, runtime.parseRgbaColor)(worst.ground.css)),
            ),
            color: rgbaCssValue(
              typeof fg2 == "string" ? (0, runtime.parseRgbaColor)(fg2) : fg2,
            ),
          }}
        >
          <runtime.Icon name={"TextAa"} size={"xs"} />
        </span>
        <span className={worst.passes ? "text-primary" : "text-warning"}>
          {worst.passes
            ? runtime.ColorContrastCopyLabel_9
            : runtime.ColorContrastCopyLabel_10}
        </span>
      </span>
    );
  }
  function ContrastAdvice({
    fg: fg2,
    results: results,
    sentenceId: sentenceId,
    fix: fix,
    fixHeld = false,
    fixRef: fixRef,
    onFixGoneFocused: onFixGoneFocused,
  }: Dynamic): Dynamic {
    let value: Dynamic = summarizeContrastResults(results),
      worst: Dynamic = value.worst;
    return (
      <div
        className={
          "mt-1.5 flex min-h-4 min-w-0 flex-wrap items-center gap-x-2 gap-y-1"
        }
      >
        <span
          data-kit={"contrast-readout"}
          data-verdict={worst.passes ? "pass" : "fail"}
          className={"inline-flex min-w-0 items-center"}
        >
          <ContrastLockup fg={fg2} results={results} />
          <span id={sentenceId} className={"sr-only"}>
            {value.sentence}
          </span>
        </span>
        {fix !== undefined ? (
          <ReadableShadeButton
            fix={fix}
            held={fixHeld}
            rootRef={fixRef}
            onGoneFocused={onFixGoneFocused}
          />
        ) : null}
      </div>
    );
  }
  function ReadableShadeButton({
    fix: fix,
    held = false,
    rootRef: rootRef,
    onGoneFocused: onGoneFocused,
  }: Dynamic): Dynamic {
    let value: Dynamic = (0, runtime.reactColorContrastCopy.useId)(),
      value2: Dynamic = (0, runtime.reactColorContrastCopy.useRef)(false),
      value3: Dynamic = (0, runtime.reactColorContrastCopy.useRef)(null),
      value4: Dynamic = (0, runtime.reactColorContrastCopy.useCallback)(
        (input?: Dynamic): Dynamic => {
          value3.current = input;
          typeof rootRef == "function"
            ? rootRef(input)
            : rootRef && (rootRef.current = input);
        },
        [rootRef],
      ),
      value5: Dynamic = (0, runtime.reactColorContrastCopy.useRef)(false),
      value6: Dynamic = (0, runtime.reactColorContrastCopy.useRef)(held);
    value6.current = held;
    let value7: Dynamic = (0, runtime.reactColorContrastCopy.useRef)(
      onGoneFocused,
    );
    value7.current = onGoneFocused;
    (0, runtime.reactColorContrastCopy.useLayoutEffect)(
      (): Dynamic => (): Dynamic => {
        value5.current ||
          value6.current ||
          value3.current === null ||
          (value3.current.contains((document as Dynamic).activeElement) &&
            value7.current?.());
      },
      [],
    );
    return (
      <span
        ref={value4}
        data-kit={"contrast-fix"}
        data-shade={fix.css}
        aria-hidden={held ? true : undefined}
        className={(0, runtime.joinClassNames)(
          "inline-flex min-w-0 items-center",
          held && "invisible",
        )}
      >
        <runtime.Button
          variant={"secondary"}
          title={
            fix.css +
            " \xB7 " +
            (0, runtime.formatContrastRatio)(fix.ratio) +
            " " +
            runtime.OnValue +
            " " +
            fix.ground
          }
          aria-describedby={value}
          disabled={held}
          onPointerDown={(input?: Dynamic): Dynamic => {
            value2.current = input.pointerType === "touch";
          }}
          onClick={(): Dynamic => {
            let current: Dynamic = value2.current;
            value2.current = false;
            value5.current = current;
            fix.onUse(current);
          }}
        >
          {runtime.ColorContrastCopyLabel_11}
        </runtime.Button>
        <span id={value} className={"sr-only"}>
          {(0, runtime.readableShadeDescription)({
            hex: fix.css,
            ratio: (0, runtime.formatSpokenContrastRatio)(fix.ratio),
            ground: fix.ground,
          })}
        </span>
      </span>
    );
  }
  bindRuntimeValue(
    runtime,
    "jsxColorContrastUi",
    () => jsxColorContrastUi,
    (value) => {
      jsxColorContrastUi = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "summarizeContrastResults",
    () => summarizeContrastResults,
  );
  bindRuntimeValue(runtime, "rgbaCssValue", () => rgbaCssValue);
  bindRuntimeValue(
    runtime,
    "withoutAlpha",
    () => withoutAlpha,
    (value) => {
      withoutAlpha = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "contrastVerdictClassName",
    () => contrastVerdictClassName,
    (value) => {
      contrastVerdictClassName = value;
    },
  );
  bindRuntimeValue(runtime, "ContrastMark", () => ContrastMark);
  bindRuntimeValue(runtime, "ContrastLockup", () => ContrastLockup);
  bindRuntimeValue(runtime, "ContrastAdvice", () => ContrastAdvice);
  bindRuntimeValue(runtime, "ReadableShadeButton", () => ReadableShadeButton);
  return () => {
    jsxColorContrastUi = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_jsx_runtime)(),
      1,
    );
    withoutAlpha = (input?: Dynamic): Dynamic =>
      input === undefined
        ? undefined
        : {
            ...input,
            a: 1,
          };
    contrastVerdictClassName = (input?: Dynamic): Dynamic =>
      input ? "text-secondary" : "text-warning";
  };
}
