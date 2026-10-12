/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installPlatformFeatureFlags(
  runtime: RuntimeBindings,
): () => void {
  var AppifactFlagsValue: Dynamic;
  var DesignArtboardsAtAddressValue: Dynamic;
  var PlatformFeatureFlagsThenValue: Dynamic;
  var artboardAddressFlagResolved: Dynamic;
  var PlatformFeatureFlagsSubscribers: Dynamic;
  function getFeatureFlags(): Dynamic {
    let value: Dynamic = (globalThis as Dynamic)[AppifactFlagsValue];
    if (typeof value != "object" || value === null) return;
    let value2: Dynamic = value;
    return typeof value2.ready == "function" &&
      typeof value2.get == "function" &&
      typeof value2.all == "function"
      ? value
      : undefined;
  }
  function matchesFeatureFlagType(input?: Dynamic, options?: Dynamic): Dynamic {
    return options === null
      ? true
      : Array.isArray(options)
        ? Array.isArray(input)
        : typeof options == "object"
          ? typeof input == "object" && input !== null && !Array.isArray(input)
          : typeof input == typeof options;
  }
  async function awaitFeatureFlag(
    input?: Dynamic,
    options?: Dynamic,
  ): Promise<Dynamic> {
    try {
      let value: Dynamic = getFeatureFlags();
      if (value === undefined) return options;
      try {
        await value.ready();
      } catch {}
      let entry: Dynamic = value.get(input, options);
      return matchesFeatureFlagType(entry, options) ? entry : options;
    } catch {
      return options;
    }
  }
  function getFeatureFlag(input?: Dynamic, options?: Dynamic): Dynamic {
    try {
      let value: Dynamic = getFeatureFlags()?.get(input, options);
      return value !== undefined && matchesFeatureFlagType(value, options)
        ? value
        : options;
    } catch {
      return options;
    }
  }
  function artboardsAtAddressEnabled(): Dynamic {
    return getFeatureFlag(DesignArtboardsAtAddressValue, false);
  }
  function subscribeArtboardsAtAddressFlag(input?: Dynamic): Dynamic {
    return artboardAddressFlagResolved || artboardsAtAddressEnabled()
      ? (): Dynamic => {}
      : (PlatformFeatureFlagsSubscribers.add(input),
        (PlatformFeatureFlagsThenValue ??= awaitFeatureFlag(
          DesignArtboardsAtAddressValue,
          false,
        ).then((input2?: Dynamic): Dynamic => {
          artboardAddressFlagResolved = true;
          let items: Dynamic = [...PlatformFeatureFlagsSubscribers];
          PlatformFeatureFlagsSubscribers.clear();
          if (input2)
            for (let value of items as Dynamic)
              try {
                value();
              } catch {}
          return input2;
        })),
        (): Dynamic => {
          PlatformFeatureFlagsSubscribers.delete(input);
        });
  }
  bindRuntimeValue(
    runtime,
    "AppifactFlagsValue",
    () => AppifactFlagsValue,
    (value) => {
      AppifactFlagsValue = value;
    },
  );
  bindRuntimeValue(runtime, "getFeatureFlags", () => getFeatureFlags);
  bindRuntimeValue(
    runtime,
    "matchesFeatureFlagType",
    () => matchesFeatureFlagType,
  );
  bindRuntimeValue(runtime, "awaitFeatureFlag", () => awaitFeatureFlag);
  bindRuntimeValue(runtime, "getFeatureFlag", () => getFeatureFlag);
  bindRuntimeValue(
    runtime,
    "DesignArtboardsAtAddressValue",
    () => DesignArtboardsAtAddressValue,
    (value) => {
      DesignArtboardsAtAddressValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFeatureFlagsThenValue",
    () => PlatformFeatureFlagsThenValue,
    (value) => {
      PlatformFeatureFlagsThenValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "artboardAddressFlagResolved",
    () => artboardAddressFlagResolved,
    (value) => {
      artboardAddressFlagResolved = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFeatureFlagsSubscribers",
    () => PlatformFeatureFlagsSubscribers,
    (value) => {
      PlatformFeatureFlagsSubscribers = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "artboardsAtAddressEnabled",
    () => artboardsAtAddressEnabled,
  );
  bindRuntimeValue(
    runtime,
    "subscribeArtboardsAtAddressFlag",
    () => subscribeArtboardsAtAddressFlag,
  );
  return () => {
    AppifactFlagsValue = "__appifact_flags";
    DesignArtboardsAtAddressValue = "design_artboards_at_address";
    artboardAddressFlagResolved = false;
    PlatformFeatureFlagsSubscribers = new Set();
  };
}
