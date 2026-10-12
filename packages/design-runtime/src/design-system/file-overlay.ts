/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installDesignSystemFileOverlay(
  runtime: RuntimeBindings,
): () => void {
  var DesignSystemFileOverlayKeyCarriedTextsConfig: Dynamic;
  var DesignSystemFileOverlayStoredOverlayOutConfig: Dynamic;
  function refreshDesignSystemFileOverlay(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    let value: Dynamic = (0, runtime.parseInstalledDesignSystems)(input),
      entries: Dynamic = new Map(
        value.map((input2?: Dynamic): Dynamic => {
          let value5: Dynamic = (0, runtime.designSystemTokensPath)(
              input2.namespace,
            ),
            value6: Dynamic = value5.slice(runtime.ProjectValue.length);
          return [
            value5,
            options[value6] ??
              runtime.DesignSystemPublishedFilesFromEntriesValue[value6],
          ];
        }),
      ),
      value2: Dynamic = JSON.stringify(value),
      value3: Dynamic = DesignSystemFileOverlayKeyCarriedTextsConfig;
    if (
      value3 !== undefined &&
      value3.key === value2 &&
      value3.carried === context &&
      [...entries].every(
        ([input2, input3]: Dynamic): Dynamic =>
          value3.texts.get(input2) === input3,
      )
    )
      return value3.doc;
    let value4: Dynamic =
      (0, runtime.readInstalledDesignSystemTokens)(
        input,
        (input2?: Dynamic): Dynamic => entries.get(input2),
        context,
      ) ?? context;
    DesignSystemFileOverlayKeyCarriedTextsConfig = {
      key: value2,
      carried: context,
      texts: entries,
      doc: value4,
    };
    return value4;
  }
  function mergeDesignSystemFileOverlay(input?: Dynamic): Dynamic {
    return Object.keys(runtime.DesignSystemPublishedFilesFromEntriesValue)
      .length === 0
      ? input
      : ((DesignSystemFileOverlayStoredOverlayOutConfig === undefined ||
          DesignSystemFileOverlayStoredOverlayOutConfig.stored !== input ||
          DesignSystemFileOverlayStoredOverlayOutConfig.overlay !==
            runtime.DesignSystemPublishedFilesFromEntriesValue) &&
          (DesignSystemFileOverlayStoredOverlayOutConfig = {
            stored: input,
            overlay: runtime.DesignSystemPublishedFilesFromEntriesValue,
            out: {
              ...runtime.DesignSystemPublishedFilesFromEntriesValue,
              ...input,
            },
          }),
        DesignSystemFileOverlayStoredOverlayOutConfig.out);
  }
  function subscribeDesignSystemFiles(input?: Dynamic): Dynamic {
    runtime.DesignSystemPublishedFilesSubscribers.add(input);
    return (): Dynamic => {
      runtime.DesignSystemPublishedFilesSubscribers.delete(input);
    };
  }
  bindRuntimeValue(
    runtime,
    "refreshDesignSystemFileOverlay",
    () => refreshDesignSystemFileOverlay,
  );
  bindRuntimeValue(
    runtime,
    "DesignSystemFileOverlayKeyCarriedTextsConfig",
    () => DesignSystemFileOverlayKeyCarriedTextsConfig,
    (value) => {
      DesignSystemFileOverlayKeyCarriedTextsConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DesignSystemFileOverlayStoredOverlayOutConfig",
    () => DesignSystemFileOverlayStoredOverlayOutConfig,
    (value) => {
      DesignSystemFileOverlayStoredOverlayOutConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "mergeDesignSystemFileOverlay",
    () => mergeDesignSystemFileOverlay,
  );
  bindRuntimeValue(
    runtime,
    "subscribeDesignSystemFiles",
    () => subscribeDesignSystemFiles,
  );
  return () => {};
}
