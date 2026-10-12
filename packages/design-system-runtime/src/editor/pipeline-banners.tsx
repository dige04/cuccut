import type * as React from "react";
import type * as Editor from "../contracts/editor-runtime";
import type * as Model from "../contracts";
import type * as Application from "../contracts/application";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installEditorPipelineBanners(
  runtime: RuntimeBindings,
): () => void {
  var reactPipelineBanners: typeof import("react");
  var jsxPipelineBanners: typeof import("react/jsx-runtime");
  var PIPELINE_BANNER_STORAGE_PREFIX: string;
  var LEFT_OUT_BANNER_STORAGE_PREFIX: string;
  function relativeChangeTime(
    timestamp: string,
    now: number = Date.now(),
  ): string {
    let value = Date.parse(timestamp);
    if (Number.isNaN(value)) {
      return "";
    }
    let value2: number = Math.floor(Math.max(0, now - value) / 60000);
    if (value2 < 1) {
      return "just now";
    }
    if (value2 < 60) {
      return countedChangeNoun(value2, "minute") + " ago";
    }
    let value3: number = Math.floor(value2 / 60);
    if (value3 < 24) {
      return countedChangeNoun(value3, "hour") + " ago";
    }
    return countedChangeNoun(Math.floor(value3 / 24), "day") + " ago";
  }
  function countedChangeNoun(count: number, noun: string): string {
    return String(count) + " " + (count === 1 ? noun : noun + "s");
  }
  function PipelineChangeSummary({
    change: change,
    now: now,
  }: {
    change: Model.LastChange | null;
    now?: number;
  }): React.ReactElement | null {
    if (change === null) {
      return null;
    }
    let value = relativeChangeTime(change.at, now),
      value2: string = change.via !== undefined ? " via " + change.via : "";
    return (
      <runtime.TooltipWrapper
        tip={
          change.by +
          value2 +
          " · " +
          change.at +
          (change.note !== undefined ? " — " + change.note : "")
        }
        wrap={true}
      >
        <span
          className={"ds-last-change text-footnote text-muted"}
          data-testid={"ds-last-change"}
          {...runtime.UNCOMMENTABLE_PROPS}
        >
          {[
            "Last change: ",
            <span className={"ds-last-change-by text-secondary"}>
              {change.by}
            </span>,
            value2,
            value !== "" ? " · " + value : "",
            change.note !== undefined ? (
              <span className={"ds-last-change-note"}>
                {[" — “", change.note, "”"]}
              </span>
            ) : null,
          ]}
        </span>
      </runtime.TooltipWrapper>
    );
  }
  function isPipelineBannerDismissed(timestamp: string): boolean {
    try {
      return (
        sessionStorage.getItem(PIPELINE_BANNER_STORAGE_PREFIX + timestamp) ===
        "1"
      );
    } catch {
      return false;
    }
  }
  function PipelineChangeBanner({
    change: change,
    now: now,
  }: {
    change: Model.LastChange;
    now?: number;
  }): React.ReactElement | null {
    let [value, value2] = reactPipelineBanners.useState(() =>
      isPipelineBannerDismissed(change.at),
    );
    if (value) {
      return null;
    }
    let value3 = relativeChangeTime(change.at, now);
    return (
      <div {...runtime.UNCOMMENTABLE_PROPS}>
        <runtime.Callout
          variant={"warning"}
          onDismiss={(): void => {
            try {
              sessionStorage.setItem(
                PIPELINE_BANNER_STORAGE_PREFIX + change.at,
                "1",
              );
            } catch {}
            value2(true);
          }}
          data-testid={"ds-pipeline-banner"}
          className={"ds-pipeline-banner"}
        >
          <span className={"ds-pipeline-banner-text"}>
            {[
              "Written by a pipeline (",
              <span className={"font-mono"}>{change.via ?? ""}</span>,
              ")",
              value3 !== "" ? " " + value3 : "",
              ". Edits here may be overwritten on its next run.",
            ]}
          </span>
        </runtime.Callout>
      </div>
    );
  }
  function MigrationLeftOutBanner(): React.ReactElement | null {
    let value = reactPipelineBanners.useSyncExternalStore(
        runtime.subscribeStoredSystemStatus,
        runtime.getStoredSystemStatus as () => Editor.PipelineStoredStatus,
        runtime.getStoredSystemStatus as () => Editor.PipelineStoredStatus,
      ),
      value2: string =
        LEFT_OUT_BANNER_STORAGE_PREFIX +
        (value.convertedAt ?? "") +
        "/" +
        String(value.carried.length + value.carriedMore),
      [value3, value4] = reactPipelineBanners.useState(false),
      value5 = value.carried.filter(
        (input): boolean => input.form === "omitted",
      ),
      value6 = value5.length + (value.carriedMore > 0 ? value.carriedMore : 0);
    if (value3 || value6 === 0 || isSessionBannerDismissed(value2)) {
      return null;
    }
    let callback = (): void => {
        try {
          sessionStorage.setItem(value2, "1");
        } catch {}
        value4(true);
      },
      value7 = value5.slice(0, 3);
    return (
      <div {...runtime.UNCOMMENTABLE_PROPS}>
        <runtime.Callout
          variant={"warning"}
          onDismiss={callback}
          data-testid={"ds-left-out-banner"}
          className={"ds-left-out-banner"}
        >
          <span className={"ds-left-out-banner-text"}>
            {[
              (value.carriedMore > 0 ? "At least " : "") +
                countedChangeNoun(value6, "file") +
                " couldn’t be kept when this design system moved to live editing: ",
              value7.map((input, options) =>
                (() => {
                  const _Element = "span";
                  const _elementProps = {
                    children: [
                      options > 0 ? "; " : "",
                      <span className={"font-mono"}>{input.path}</span>,
                      <span className={"text-muted"}>
                        {[" (", input.reason, ")"]}
                      </span>,
                    ],
                  };
                  const _elementKey = input.path;
                  return <_Element key={_elementKey} {..._elementProps} />;
                })(),
              ),
              value5.length > value7.length
                ? " and " + String(value6 - value7.length) + " more."
                : ".",
              " They remain in this artifact",
              "’",
              "s earlier versions.",
            ]}
          </span>
        </runtime.Callout>
      </div>
    );
  }
  function isSessionBannerDismissed(key: string): boolean {
    try {
      return sessionStorage.getItem(key) === "1";
    } catch {
      return false;
    }
  }
  function IndexRecoveryBanner(): React.ReactElement | null {
    let value = reactPipelineBanners.useSyncExternalStore(
        runtime.subscribeRemoteTextProblems,
        runtime.getRemoteTextProblems as () => Map<string, string>,
        runtime.getRemoteTextProblems as () => Map<string, string>,
      ),
      [value2, value3] = reactPipelineBanners.useState(false);
    if (value2 || value.size === 0) {
      return null;
    }
    let value4 = [...value].slice(0, 3);
    return (
      <div {...runtime.UNCOMMENTABLE_PROPS}>
        <runtime.Callout
          variant={"warning"}
          onDismiss={() => value3(true)}
          data-testid={"ds-refused-code-banner"}
          className={"ds-left-out-banner"}
        >
          <span className={"ds-left-out-banner-text"}>
            {[
              countedChangeNoun(value.size, "file") +
                " added here could not be stored: ",
              value4.map(([input, input2], options) =>
                (() => {
                  const _Element2 = "span";
                  const _elementProps2 = {
                    children: [
                      options > 0 ? "; " : "",
                      <span className={"font-mono"}>{input}</span>,
                      <span className={"text-muted"}>
                        {[" (", input2, ")"]}
                      </span>,
                    ],
                  };
                  const _elementKey2 = input;
                  return <_Element2 key={_elementKey2} {..._elementProps2} />;
                })(),
              ),
              value.size > value4.length
                ? " and " + String(value.size - value4.length) + " more."
                : ".",
            ]}
          </span>
        </runtime.Callout>
      </div>
    );
  }
  bindRuntimeValue(
    runtime,
    "reactPipelineBanners",
    () => reactPipelineBanners,
    (value) => {
      reactPipelineBanners = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxPipelineBanners",
    () => jsxPipelineBanners,
    (value) => {
      jsxPipelineBanners = value;
    },
  );
  bindRuntimeValue(runtime, "relativeChangeTime", () => relativeChangeTime);
  bindRuntimeValue(runtime, "countedChangeNoun", () => countedChangeNoun);
  bindRuntimeValue(
    runtime,
    "PipelineChangeSummary",
    () => PipelineChangeSummary,
  );
  bindRuntimeValue(
    runtime,
    "PIPELINE_BANNER_STORAGE_PREFIX",
    () => PIPELINE_BANNER_STORAGE_PREFIX,
    (value) => {
      PIPELINE_BANNER_STORAGE_PREFIX = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isPipelineBannerDismissed",
    () => isPipelineBannerDismissed,
  );
  bindRuntimeValue(runtime, "PipelineChangeBanner", () => PipelineChangeBanner);
  bindRuntimeValue(
    runtime,
    "LEFT_OUT_BANNER_STORAGE_PREFIX",
    () => LEFT_OUT_BANNER_STORAGE_PREFIX,
    (value) => {
      LEFT_OUT_BANNER_STORAGE_PREFIX = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MigrationLeftOutBanner",
    () => MigrationLeftOutBanner,
  );
  bindRuntimeValue(
    runtime,
    "isSessionBannerDismissed",
    () => isSessionBannerDismissed,
  );
  bindRuntimeValue(runtime, "IndexRecoveryBanner", () => IndexRecoveryBanner);
  return () => {
    reactPipelineBanners = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    jsxPipelineBanners = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
    PIPELINE_BANNER_STORAGE_PREFIX = "ds-pipeline-banner/";
    LEFT_OUT_BANNER_STORAGE_PREFIX = "ds-left-out-banner/";
  };
}
