/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installPlatformPublish(runtime: RuntimeBindings): () => void {
  var publishAuthorizationErrorCodes: Dynamic;
  var hasPublishMethod: Dynamic;
  var publishErrorCodes: Dynamic;
  function hasCachedPublishCapability(): Dynamic {
    return hasPublishMethod((0, runtime.getCachedHostCapability)("self"));
  }
  function canRequestPublishCapability(): Dynamic {
    return hasCachedPublishCapability() || (0, runtime.hasCapabilityLoader)();
  }
  function getPublishCapability(): Dynamic {
    return (0, runtime.resolveHostCapability)("self", hasPublishMethod);
  }
  function normalizePublishError(input?: Dynamic): Dynamic {
    if (typeof input == "object" && input !== null && "code" in input) {
      let code: Dynamic = input.code,
        message: Dynamic = input.message,
        live: Dynamic = input.live,
        say: Dynamic = input.say;
      if (typeof code == "string" && publishErrorCodes.has(code))
        return {
          code: code,
          message: typeof message == "string" ? message : code,
          live: typeof live == "string" ? live : undefined,
          ...(typeof say == "string"
            ? {
                say: say,
              }
            : {}),
        };
      if (typeof code == "string")
        return {
          code: "upstream_error",
          message:
            (typeof message == "string" ? message : "publish failed") +
            " (unrecognized code: " +
            code +
            ")",
        };
    }
    return {
      code: "upstream_error",
      message: input instanceof Error ? input.message : String(input),
    };
  }
  function requirePublishCapability(): Dynamic {
    if (!canRequestPublishCapability())
      throw new Error(
        // CucCut: the host global is designHost.
        "window.designHost.self is missing \u2014 this view\u2019s runtime predates the self capability (or this page is running outside a Frame shell and the emulator). Content cannot be saved from here.",
      );
    return async (input?: Dynamic): Promise<Dynamic> => {
      let value: Dynamic = await getPublishCapability();
      if (value === null)
        throw {
          code: "not_granted",
          message: "The self capability is not available to this view.",
        };
      return value.publish(input);
    };
  }
  bindRuntimeValue(
    runtime,
    "publishAuthorizationErrorCodes",
    () => publishAuthorizationErrorCodes,
    (value) => {
      publishAuthorizationErrorCodes = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "hasPublishMethod",
    () => hasPublishMethod,
    (value) => {
      hasPublishMethod = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "hasCachedPublishCapability",
    () => hasCachedPublishCapability,
  );
  bindRuntimeValue(
    runtime,
    "canRequestPublishCapability",
    () => canRequestPublishCapability,
  );
  bindRuntimeValue(runtime, "getPublishCapability", () => getPublishCapability);
  bindRuntimeValue(
    runtime,
    "publishErrorCodes",
    () => publishErrorCodes,
    (value) => {
      publishErrorCodes = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "normalizePublishError",
    () => normalizePublishError,
  );
  bindRuntimeValue(
    runtime,
    "requirePublishCapability",
    () => requirePublishCapability,
  );
  return () => {
    publishAuthorizationErrorCodes = [
      "not_writer",
      "not_declared",
      "not_granted",
      "consent_required",
      "capability_disabled",
      "capability_removed",
    ];
    hasPublishMethod = (0, runtime.hasCapabilityMethod)("publish");
    publishErrorCodes = new Set([
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
