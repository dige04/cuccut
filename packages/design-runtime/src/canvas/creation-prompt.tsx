/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";
export function installCanvasCreationPrompt(
  runtime: RuntimeBindings,
): () => void {
  var designCreationTips: Dynamic;
  var jsx_xu: Dynamic;
  var AddArtboardPromptButton: Dynamic;
  var CreationWorkingAnnouncement: Dynamic;
  function designCreationTipIndex(elapsedMs?: Dynamic): Dynamic {
    return elapsedMs < 3e3
      ? -1
      : Math.floor((elapsedMs - 3e3) / 5e3) % designCreationTips.length;
  }
  function timeUntilNextDesignCreationTip(elapsedMs?: Dynamic): Dynamic {
    return elapsedMs < 3e3 ? 3e3 - elapsedMs : 5e3 - ((elapsedMs - 3e3) % 5e3);
  }
  function EmptyCanvasPrompt({
    sentence: sentence,
    onAdd: onAdd,
  }: Dynamic): Dynamic {
    return (
      <jsx_xu.Fragment>
        <p className={"m-0 text-[12.5px] text-secondary"}>{sentence}</p>
        {AddArtboardPromptButton(onAdd)}
      </jsx_xu.Fragment>
    );
  }
  function BusyCanvasPrompt({
    prompt: prompt,
    tucked = false,
    sentence: sentence,
    busy: busy,
    onAdd: onAdd,
  }: Dynamic): Dynamic {
    let value: Dynamic = (0, runtime.useClaudeActivity)() === "working";
    return (
      <runtime.ClaudeWorkingLabel
        working={value}
        busy={busy}
        tint={"violet"}
        idle={
          <p
            className={
              "m-0 text-[12.5px] text-secondary" + (prompt ? "" : " invisible")
            }
            aria-hidden={prompt ? undefined : true}
          >
            {sentence}
          </p>
        }
        action={prompt ? AddArtboardPromptButton(onAdd, tucked) : null}
      />
    );
  }
  function DesignCreationPrompt({
    tip: tip,
    card = false,
    prompt: prompt,
    tucked = false,
    sentence: sentence,
    busy: busy,
    onAdd: onAdd,
  }: Dynamic): Dynamic {
    let value: Dynamic = (0, runtime.useHostDrawsClaudeTips)(),
      value2: Dynamic = (
        <runtime.PeerBadge
          tint={"violet"}
          label={
            value
              ? {
                  kind: "name",
                  // CucCut: user-facing copy calls the agent "the agent", not Claude.
                  text: "Agent",
                }
              : {
                  kind: "words",
                  text:
                    tip < 0
                      ? runtime.CanvasWorkingLabelAnimationLabel
                      : designCreationTips[tip],
                  index: tip,
                  shimmer: true,
                  outMs: 80,
                  inMs: 120,
                }
          }
        />
      );
    return card ? (
      <div
        data-testid={"dc-creation-tips"}
        className={"flex flex-col items-center gap-3"}
      >
        <div className={"relative"} aria-busy={busy ? true : undefined}>
          <div
            aria-hidden={"true"}
            className={"dc-creation-card aspect-[20/1]"}
          />
          <div
            aria-hidden={"true"}
            data-testid={"dc-creation-card"}
            className={"dc-creation-card aspect-[4/3] mc-claude-box"}
          />
          <div
            aria-hidden={"true"}
            className={
              "absolute inset-x-0 bottom-0 flex aspect-[4/3] items-center justify-center pb-12"
            }
          >
            {value2}
          </div>
        </div>
        {prompt ? AddArtboardPromptButton(onAdd, true) : null}
        <span className={"sr-only"}>
          {runtime.CanvasWorkingLabelAnimationLabel}
        </span>
      </div>
    ) : (
      <div
        data-testid={"dc-creation-tips"}
        className={"flex flex-col items-center gap-3"}
      >
        <div className={"relative"} aria-busy={busy ? true : undefined}>
          <p
            className={"invisible m-0 text-[12.5px] text-secondary"}
            aria-hidden={"true"}
          >
            {sentence}
          </p>
          <div
            className={
              "absolute inset-x-0 -bottom-3 flex items-center justify-center"
            }
            style={{
              height: "max(100% + 68px, 156px)",
            }}
            aria-hidden={"true"}
          >
            {value2}
          </div>
        </div>
        {prompt ? AddArtboardPromptButton(onAdd, tucked) : null}
        <span className={"sr-only"}>
          {runtime.CanvasWorkingLabelAnimationLabel}
        </span>
      </div>
    );
  }
  bindRuntimeValue(
    runtime,
    "designCreationTips",
    () => designCreationTips,
    (value) => {
      designCreationTips = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "designCreationTipIndex",
    () => designCreationTipIndex,
  );
  bindRuntimeValue(
    runtime,
    "timeUntilNextDesignCreationTip",
    () => timeUntilNextDesignCreationTip,
  );
  bindRuntimeValue(
    runtime,
    "jsx_xu",
    () => jsx_xu,
    (value) => {
      jsx_xu = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "AddArtboardPromptButton",
    () => AddArtboardPromptButton,
    (value) => {
      AddArtboardPromptButton = value;
    },
  );
  bindRuntimeValue(runtime, "EmptyCanvasPrompt", () => EmptyCanvasPrompt);
  bindRuntimeValue(runtime, "BusyCanvasPrompt", () => BusyCanvasPrompt);
  bindRuntimeValue(
    runtime,
    "CreationWorkingAnnouncement",
    () => CreationWorkingAnnouncement,
    (value) => {
      CreationWorkingAnnouncement = value;
    },
  );
  bindRuntimeValue(runtime, "DesignCreationPrompt", () => DesignCreationPrompt);
  return () => {
    (0, runtime.initializeCdsIndex)();
    designCreationTips = [
      "Double-click text to edit it.",
      // CucCut: user-facing copy calls the agent "the agent", not Claude.
      "Comment on any part, and the agent can revise it.",
      "Invite people to view, comment, or edit.",
      "Use @ in a comment to mention someone.",
      "Drag in a picture from your computer.",
      "Every edit saves automatically.",
      "People you share with see your changes live.",
      "Drag an artboard by its title to move it.",
      "Select any element to comment on it.",
    ];
    jsx_xu = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_jsx_runtime)(),
      1,
    );
    AddArtboardPromptButton = (
      input?: Dynamic,
      options: Dynamic = false,
    ): Dynamic => (
      <span
        data-tucked={options || undefined}
        className={
          options ? "sr-only has-[:focus-visible]:not-sr-only" : "contents"
        }
      >
        <runtime.Button
          variant={"secondary"}
          className={"pointer-events-auto"}
          data-testid={"dc-empty-page-add"}
          onClick={input}
        >
          {"Add an artboard"}
        </runtime.Button>
      </span>
    );
    CreationWorkingAnnouncement = (): Dynamic => (
      <span className={"sr-only"} data-testid={"dc-creation-working"}>
        {runtime.CanvasWorkingLabelAnimationLabel}
      </span>
    );
  };
}
