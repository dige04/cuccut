/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";
import type { HostCapabilityValidator } from "../environment/host-capabilities";
import type {
  ArtifactPublishOutcome,
  ArtifactPublisher,
} from "./artifact-document";

/** Error codes the self-publish capability reports (plus `upstream_error` for anything unrecognised). */
export type SelfPublishErrorCode =
  | "conflict"
  | "not_writer"
  | "not_declared"
  | "too_large"
  | "invalid_content"
  | "read_only_path"
  | "rate_limited"
  | "consent_required"
  | "upstream_error"
  | "not_granted"
  | "capability_disabled"
  | "capability_removed"
  | "transform_error";

/** A publish failure after normalisation. */
export interface SelfPublishError {
  code: SelfPublishErrorCode;
  message: string;
  /** The live version's identifier, when the store reports one. */
  live?: string | undefined;
  /** A sentence the host wants shown to the user as is. */
  say?: string;
}

/** The host's `self` capability: replaces the page this view was loaded from. */
export interface SelfPublishCapability {
  publish(page: string): Promise<ArtifactPublishOutcome | undefined>;
}

/** The fields read off a thrown publish error before they are validated. */
interface RawSelfPublishError {
  code: unknown;
  message?: unknown;
  live?: unknown;
  say?: unknown;
}

declare module "../bindings" {
  interface RuntimeBindings {
    SELF_PUBLISH_PERMISSION_ERROR_CODES: SelfPublishErrorCode[];
    supportsSelfPublish: HostCapabilityValidator<SelfPublishCapability>;
    selfPublishInstalled: () => boolean;
    selfPublishAvailable: () => boolean;
    getSelfPublishCapability: () => Promise<SelfPublishCapability | null>;
    SELF_PUBLISH_ERROR_CODE_SET: ReadonlySet<string>;
    normalizeSelfPublishError: (error: unknown) => SelfPublishError;
    createSelfPublisher: () => ArtifactPublisher;
  }
}

export function installDocumentsSelfPublish(
  runtime: RuntimeBindings,
): () => void {
  var SELF_PUBLISH_PERMISSION_ERROR_CODES: SelfPublishErrorCode[];
  var supportsSelfPublish: HostCapabilityValidator<SelfPublishCapability>;
  var SELF_PUBLISH_ERROR_CODE_SET: ReadonlySet<string>;
  function selfPublishInstalled(): boolean {
    return supportsSelfPublish((0, runtime.getHostCapability)("self"));
  }
  function selfPublishAvailable(): boolean {
    return selfPublishInstalled() || (0, runtime.hasHostCapabilityLoader)();
  }
  function getSelfPublishCapability(): Promise<SelfPublishCapability | null> {
    return (0, runtime.getOrLoadHostCapability)("self", supportsSelfPublish);
  }
  function normalizeSelfPublishError(error: unknown): SelfPublishError {
    if (typeof error === "object" && error !== null && "code" in error) {
      let {
        code: value,
        message: value2,
        live: value3,
        say: value4,
      }: RawSelfPublishError = error;
      if (typeof value === "string" && SELF_PUBLISH_ERROR_CODE_SET.has(value)) {
        return {
          code: value as SelfPublishErrorCode,
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
  function createSelfPublisher(): ArtifactPublisher {
    if (!selfPublishAvailable()) {
      throw Error(
        "slidesHost.self is missing — this view’s runtime predates " +
          "the self capability (or this page is running outside a Frame shell and the emulator). Content cannot be saved from here.",
      );
    }
    return async (input: string): Promise<ArtifactPublishOutcome | undefined> => {
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
    supportsSelfPublish = (0, runtime.capabilityHasMethod)("publish");
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
