/** Restored application module; prepare first, initialize in original order. */
import type { ReactElement } from "react";
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type JsxNamespace,
  type ReactNamespace,
} from "../bindings";
import type { SlideId } from "../deck-contracts";

/** Identifies the held slide a repair request is about. */
export interface SlideRepairContext {
  slideId: SlideId;
  /** The deck's memory scope, when it has one. */
  scope?: string;
  deckTitle?: string;
}
export interface DamagedSlideNoticeProps extends SlideRepairContext {
  /** Why the slide is held. */
  reason: string;
  /** The page's diagnostic text for the broken slide HTML. */
  diagnostic: string;
  /** True when the viewer may ask the agent to repair the slide. */
  canAsk: boolean;
  className?: string;
}
/** How the repair request reached the agent (sent, staged in the composer, copied, ...). */
export type AgentSendResult = Awaited<
  ReturnType<RuntimeBindings["sendOrSuggestToAgent"]>
>;

declare module "../bindings" {
  interface RuntimeBindings {
    ReactDamagedSlide: ReactNamespace;
    DamagedSlideJsx: JsxNamespace;
    DIAGNOSTIC_SLIDE_ID_PATTERN: RegExp;
    SLIDE_DIAGNOSTIC_SELECTION_MAX_CHARS: number;
    buildSlideDiagnosticRequest: (
      context: Pick<SlideRepairContext, "slideId" | "scope">,
      perspective: "I" | "The viewer",
    ) => string;
    buildSlideRepairPrompt: (
      context: SlideRepairContext,
      diagnostic: string,
    ) => string;
    askAgentToRepairSlide: (
      context: SlideRepairContext,
      diagnostic: string,
      triggerElement: unknown,
    ) => Promise<AgentSendResult>;
    DAMAGED_SLIDE_MESSAGE: string;
    SLIDE_REPAIR_REQUEST_TIMEOUT_MS: number;
    VIEW_ONLY_SLIDE_REPAIR_MESSAGE: string;
    DamagedSlideNotice: (props: DamagedSlideNoticeProps) => ReactElement;
  }
}

export function installEditorDamagedSlide(
  runtime: RuntimeBindings,
): () => void {
  var ReactDamagedSlide: ReactNamespace;
  var DIAGNOSTIC_SLIDE_ID_PATTERN: RuntimeBindings["DIAGNOSTIC_SLIDE_ID_PATTERN"];
  var SLIDE_DIAGNOSTIC_SELECTION_MAX_CHARS: RuntimeBindings["SLIDE_DIAGNOSTIC_SELECTION_MAX_CHARS"];
  var DamagedSlideJsx: JsxNamespace;
  var DAMAGED_SLIDE_MESSAGE: RuntimeBindings["DAMAGED_SLIDE_MESSAGE"];
  var SLIDE_REPAIR_REQUEST_TIMEOUT_MS: RuntimeBindings["SLIDE_REPAIR_REQUEST_TIMEOUT_MS"];
  var VIEW_ONLY_SLIDE_REPAIR_MESSAGE: RuntimeBindings["VIEW_ONLY_SLIDE_REPAIR_MESSAGE"];
  function buildSlideDiagnosticRequest(
    { slideId: slideId, scope: scope }: Pick<SlideRepairContext, "slideId" | "scope">,
    perspective: "I" | "The viewer",
  ): string {
    let quotedId = DIAGNOSTIC_SLIDE_ID_PATTERN.test(slideId)
        ? "`" + slideId + "`"
        : null,
      value =
        scope !== undefined && scope !== ""
          ? "the slide " +
            (quotedId ?? "on screen") +
            " of the deck " +
            (perspective === "I" ? "I have" : "the viewer has") +
            " open in this page" +
            (DIAGNOSTIC_SLIDE_ID_PATTERN.test(scope)
              ? " (deck `" + scope + "`)"
              : "")
          : quotedId !== null
            ? "`slides/" + slideId + "`"
            : "the slide on screen";
    return (
      perspective +
      " can’t edit one slide of " +
      (perspective === "I" ? "my Slides deck" : "this deck") +
      " in the page: the document saved for " +
      value +
      " can’t be read as a slide (its `html` breaks a rule of the slide format, or is missing), so the page shows only what it could read and keeps the slide read-only. " +
      "The page’s diagnostic comes with this message; a line:col in it counts within that `html` string. " +
      "Please read that document, fix only that problem while keeping all of the slide’s content and appearance and staying within the slide format’s rules (the Slides instructions for this deck list them), and write it back as an update of its `html`. " +
      "The page has not changed the document, and the slide is editable again as soon as a valid one lands."
    );
  }
  function buildSlideRepairPrompt(
    context: SlideRepairContext,
    diagnostic: string,
  ): string {
    let deckTitleLine =
      context.deckTitle !== undefined && context.deckTitle.trim() !== ""
        ? `

The deck’s title, from its saved document:
` +
          (0, runtime.wrapUntrustedArtifactText)(
            "deck title",
            (0, runtime.safeArtifactLabel)(context.deckTitle),
          )
        : "";
    return (
      buildSlideDiagnosticRequest(context, "I") +
      deckTitleLine +
      `

` +
      (0, runtime.wrapUntrustedArtifactText)(
        "diagnostic text from the page (it can quote the slide’s own content)",
        (0, runtime.truncateUtf16Safely)(
          diagnostic,
          SLIDE_DIAGNOSTIC_SELECTION_MAX_CHARS,
        ),
      )
    );
  }
  function askAgentToRepairSlide(
    context: SlideRepairContext,
    diagnostic: string,
    triggerElement: unknown,
  ): Promise<AgentSendResult> {
    let prompt = buildSlideRepairPrompt(context, diagnostic);
    if (triggerElement === null) {
      return (0, runtime.suggestPromptOrCopy)(prompt);
    }
    return (0, runtime.sendOrSuggestToAgent)(
      {
        selection: {
          label: "Slide problem",
          text: (0, runtime.truncateUtf16Safely)(
            diagnostic,
            SLIDE_DIAGNOSTIC_SELECTION_MAX_CHARS,
          ),
        },
        request: buildSlideDiagnosticRequest(context, "The viewer"),
        fallbackPrompt: prompt,
      },
      triggerElement,
    );
  }
  function DamagedSlideNotice({
    slideId: slideId,
    scope: scope,
    deckTitle: deckTitle,
    reason: reason,
    diagnostic: diagnostic,
    canAsk: canAsk,
    className: className,
  }: DamagedSlideNoticeProps): ReactElement {
    let ref = ReactDamagedSlide.useRef<unknown>(null),
      ref2 = ReactDamagedSlide.useRef(true),
      ref3 = ReactDamagedSlide.useRef(0),
      ref4 = ReactDamagedSlide.useRef(0),
      [value, value2] = ReactDamagedSlide.useState(false),
      [value3, value4] = ReactDamagedSlide.useState<string | null>(null),
      callback = ReactDamagedSlide.useCallback((): void => {
        let value6 = ++ref4.current;
        (0, runtime.availableAgentSessionRoom)().then(
          (input: unknown): void => {
            if (ref2.current && value6 === ref4.current) {
              ref.current = input;
            }
          },
        );
      }, []);
    ReactDamagedSlide.useEffect((): (() => void) => {
      ref2.current = true;
      if (canAsk) {
        callback();
      }
      let value6 = canAsk
        ? setInterval(callback, SLIDE_REPAIR_REQUEST_TIMEOUT_MS)
        : undefined;
      return (): void => {
        ref2.current = false;
        ref.current = null;
        if (value6 !== undefined) {
          clearInterval(value6);
        }
      };
    }, [canAsk, callback]);
    ReactDamagedSlide.useEffect((): void => {
      ref3.current++;
      value2(false);
      value4(null);
    }, [slideId, diagnostic]);
    async function value5(): Promise<void> {
      if (value) {
        return;
      }
      value2(true);
      let value6 = ++ref3.current,
        state: SlideRepairContext = {
          slideId: slideId,
          ...(scope !== undefined
            ? {
                scope: scope,
              }
            : {}),
          ...(deckTitle !== undefined
            ? {
                deckTitle: deckTitle,
              }
            : {}),
        },
        value7 = await askAgentToRepairSlide(
          state,
          diagnostic,
          ref.current,
        );
      (0, runtime.showToast)((0, runtime.agentSendResultMessage)(value7));
      if (!ref2.current || value6 !== ref3.current) {
        return;
      }
      value2(false);
      value4(
        value7 === "failed" ? buildSlideRepairPrompt(state, diagnostic) : null,
      );
      if (value7 !== "staged") {
        callback();
      }
    }
    return DamagedSlideJsx.jsxs("div", {
      "data-testid": "slides-held-notice",
      className: className,
      children: [
        DamagedSlideJsx.jsxs(runtime.Callout, {
          variant: "warning",
          role: "none",
          actionAlign: "center",
          action: canAsk
            ? DamagedSlideJsx.jsx(runtime.Button, {
                variant: "secondary",
                busy: value,
                onPointerEnter: callback,
                onFocus: callback,
                onClick: (): void => void value5(),
                "data-testid": "slides-held-ask",
                children: "Ask the agent to fix",
              })
            : undefined,
          children: [
            DAMAGED_SLIDE_MESSAGE +
              (canAsk ? "" : " " + VIEW_ONLY_SLIDE_REPAIR_MESSAGE),
            DamagedSlideJsx.jsx("span", {
              className: "block select-text break-words text-fg-secondary",
              children: "Details: " + reason,
            }),
          ],
        }),
        value3 !== null
          ? DamagedSlideJsx.jsxs("div", {
              className: "mt-1.5 flex flex-col gap-1",
              children: [
                DamagedSlideJsx.jsx("p", {
                  className: "text-xs text-fg-muted",
                  children: "Paste this to the agent:",
                }),
                DamagedSlideJsx.jsx("pre", {
                  className:
                    "select-text max-h-32 overflow-auto whitespace-pre-wrap break-words rounded-md bg-wash-1 p-2 text-[11px] leading-snug text-fg-secondary",
                  children: value3,
                }),
              ],
            })
          : null,
      ],
    });
  }
  bindRuntimeValue(
    runtime,
    "ReactDamagedSlide",
    () => ReactDamagedSlide,
    (value) => {
      ReactDamagedSlide = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DIAGNOSTIC_SLIDE_ID_PATTERN",
    () => DIAGNOSTIC_SLIDE_ID_PATTERN,
    (value) => {
      DIAGNOSTIC_SLIDE_ID_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SLIDE_DIAGNOSTIC_SELECTION_MAX_CHARS",
    () => SLIDE_DIAGNOSTIC_SELECTION_MAX_CHARS,
    (value) => {
      SLIDE_DIAGNOSTIC_SELECTION_MAX_CHARS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "buildSlideDiagnosticRequest",
    () => buildSlideDiagnosticRequest,
  );
  bindRuntimeValue(
    runtime,
    "buildSlideRepairPrompt",
    () => buildSlideRepairPrompt,
  );
  bindRuntimeValue(
    runtime,
    "askAgentToRepairSlide",
    () => askAgentToRepairSlide,
  );
  bindRuntimeValue(
    runtime,
    "DamagedSlideJsx",
    () => DamagedSlideJsx,
    (value) => {
      DamagedSlideJsx = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DAMAGED_SLIDE_MESSAGE",
    () => DAMAGED_SLIDE_MESSAGE,
    (value) => {
      DAMAGED_SLIDE_MESSAGE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SLIDE_REPAIR_REQUEST_TIMEOUT_MS",
    () => SLIDE_REPAIR_REQUEST_TIMEOUT_MS,
    (value) => {
      SLIDE_REPAIR_REQUEST_TIMEOUT_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "VIEW_ONLY_SLIDE_REPAIR_MESSAGE",
    () => VIEW_ONLY_SLIDE_REPAIR_MESSAGE,
    (value) => {
      VIEW_ONLY_SLIDE_REPAIR_MESSAGE = value;
    },
  );
  bindRuntimeValue(runtime, "DamagedSlideNotice", () => DamagedSlideNotice);
  return () => {
    (0, runtime.initializeUiInputs210)();
    ReactDamagedSlide = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    DIAGNOSTIC_SLIDE_ID_PATTERN = /^[\w-]{1,64}$/;
    SLIDE_DIAGNOSTIC_SELECTION_MAX_CHARS = 600;
    DamagedSlideJsx = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
    DAMAGED_SLIDE_MESSAGE =
      "This slide can’t be edited right now. Its saved content has a problem, so part of it may be hidden. What was saved is still there.";
    SLIDE_REPAIR_REQUEST_TIMEOUT_MS = 1e4;
    VIEW_ONLY_SLIDE_REPAIR_MESSAGE =
      "Someone who can edit this presentation can ask the agent to fix the slide.";
  };
}
