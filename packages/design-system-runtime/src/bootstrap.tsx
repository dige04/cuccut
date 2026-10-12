/** Restored application module; prepare first, initialize in original order. */
import { type RuntimeBindings } from "./runtime-types";
export function installBootstrap(runtime: RuntimeBindings): () => void {
  return () => {
    ((0, runtime.normalizeSaveHome)(
      (0, runtime.detectCompiledPageStorageMode)(document),
    ) === "files"
      ? (0, runtime.bootDesignSystemFilesMode)()
          .catch((input: unknown): void =>
            (0, runtime.configureLegacyDesignSystemBoot)(
              (0, runtime.failedLegacyStateOutcome)(input),
            ),
          )
          .then((): void => {
            if (!(0, runtime.hasConfiguredDocumentFactory)()) {
              (0, runtime.configureLegacyDesignSystemBoot)(
                (0, runtime.failedLegacyStateOutcome)(
                  Error("the page found nothing to open"),
                ),
              );
            }
          })
      : Promise.resolve()
    )
      .then((): void => {
        if (!runtime.perFileDesignSystemBooted) {
          (0, runtime.releaseEarlyHotUpdatesForLegacyMode)();
        }
      })
      .then(runtime.detectAutoSavingArtifactRuntime)
      .then((): void => {
        let value = document.getElementById("root");
        if (!value) {
          throw Error("missing #root");
        }
        runtime.reactDOMClientForUiDisclosure
          .createRoot(value)
          .render(<runtime.DesignSystemApp />);
      });
  };
}
