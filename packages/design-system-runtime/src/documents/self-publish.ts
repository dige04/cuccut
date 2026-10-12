import type * as Host from "../contracts/platform-host";
import type * as React from "react";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";

export function installDocumentsSelfPublish(
  runtime: RuntimeBindings,
): () => void {
  var SELF_PUBLISH_PERMISSION_ERROR_CODES: string[];
  var supportsSelfPublish: (value: unknown) => value is Host.SelfCapability;
  var SELF_PUBLISH_ERROR_CODE_SET: Set<string>;
  function selfPublishInstalled(): boolean {
    return supportsSelfPublish((0, runtime.getClaudeCapability)("self"));
  }
  function selfPublishAvailable(): boolean {
    return selfPublishInstalled() || (0, runtime.hasClaudeCapabilityLoader)();
  }
  function getSelfPublishCapability(): Promise<Host.SelfCapability | null> {
    return (0, runtime.getOrLoadClaudeCapability)("self", supportsSelfPublish);
  }
  function normalizeSelfPublishError(error: unknown): Host.PublishError {
    if (typeof error === "object" && error !== null && "code" in error) {
      let {
        code: value,
        message: value2,
        live: value3,
        say: value4,
      } = error as {
        code: unknown;
        message?: unknown;
        live?: unknown;
        say?: unknown;
      };
      if (typeof value === "string" && SELF_PUBLISH_ERROR_CODE_SET.has(value)) {
        return {
          code: value,
          message: typeof value2 === "string" ? value2 : value,
          live: typeof value3 === "string" ? value3 : undefined,
          ...(typeof value4 === "string"
            ? {
                say: value4,
              }
            : {}),
        };
      }
      if (typeof value === "string") {
        return {
          code: "upstream_error",
          message:
            (typeof value2 === "string" ? value2 : "publish failed") +
            " (unrecognized code: " +
            value +
            ")",
        };
      }
    }
    return {
      code: "upstream_error",
      message: error instanceof Error ? error.message : String(error),
    };
  }
  function createSelfPublisher(): Host.Publisher {
    if (!selfPublishAvailable()) {
      throw Error(
        // CucCut: the host global is designSystemHost, not claude.
        "window.designSystemHost.self is missing — this view’s runtime predates " +
          "the self capability (or this page is running outside a Frame shell and the emulator). Content cannot be saved from here.",
      );
    }
    return async (input): Promise<Host.PublishResult | undefined> => {
      let value = await getSelfPublishCapability();
      if (value === null) {
        throw {
          code: "not_granted",
          message: "The self capability is not available to this view.",
        };
      }
      return value.publish(input);
    };
  }
  bindRuntimeValue(
    runtime,
    "SELF_PUBLISH_PERMISSION_ERROR_CODES",
    () => SELF_PUBLISH_PERMISSION_ERROR_CODES,
    (value) => {
      SELF_PUBLISH_PERMISSION_ERROR_CODES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "supportsSelfPublish",
    () => supportsSelfPublish,
    (value) => {
      supportsSelfPublish = value;
    },
  );
  bindRuntimeValue(runtime, "selfPublishInstalled", () => selfPublishInstalled);
  bindRuntimeValue(runtime, "selfPublishAvailable", () => selfPublishAvailable);
  bindRuntimeValue(
    runtime,
    "getSelfPublishCapability",
    () => getSelfPublishCapability,
  );
  bindRuntimeValue(
    runtime,
    "SELF_PUBLISH_ERROR_CODE_SET",
    () => SELF_PUBLISH_ERROR_CODE_SET,
    (value) => {
      SELF_PUBLISH_ERROR_CODE_SET = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "normalizeSelfPublishError",
    () => normalizeSelfPublishError,
  );
  bindRuntimeValue(runtime, "createSelfPublisher", () => createSelfPublisher);
  return () => {
    SELF_PUBLISH_PERMISSION_ERROR_CODES = [
      "not_writer",
      "not_declared",
      "not_granted",
      "consent_required",
      "capability_disabled",
      "capability_removed",
    ];
    supportsSelfPublish = (0, runtime.capabilityHasMethod)(
      "publish",
    ) as typeof supportsSelfPublish;
    SELF_PUBLISH_ERROR_CODE_SET = new Set([
      "conflict",
      "not_writer",
      "not_declared",
      "too_large",
      "invalid_content",
      "read_only_path",
      "rate_limited",
      "consent_required",
      "upstream_error",
      "not_granted",
      "capability_disabled",
      "capability_removed",
      "transform_error",
    ]);
  };
}
