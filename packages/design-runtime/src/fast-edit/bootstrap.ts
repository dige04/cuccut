/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installFastEditBootstrap(runtime: RuntimeBindings): () => void {
  var FAST_EDIT_WORKER_META_NAME: Dynamic;
  var FAST_EDIT_WORKER_FETCH_RETRY_MS: Dynamic;
  var FAST_EDIT_WORKER_FETCH_TIMEOUT_MS: Dynamic;
  var FAST_EDIT_FEATURE_FLAG: Dynamic;
  var FAST_EDIT_SAMPLING_FLAG: Dynamic;
  var FAST_EDIT_MODEL_TIERS: Dynamic;
  var FAST_EDIT_REASONING_EFFORTS: Dynamic;
  async function loadFastEditWorker(options?: Dynamic): Promise<Dynamic> {
    let workerUrl: Dynamic = options.address();
    if (workerUrl === undefined) return false;
    for (let index: Dynamic = 0; ; index++) {
      let controller: Dynamic = new AbortController(),
        value: Dynamic = options.timer(
          FAST_EDIT_WORKER_FETCH_TIMEOUT_MS,
          (): Dynamic => controller.abort(),
        ),
        index2: Dynamic = 0,
        value2: Dynamic;
      try {
        let value3: Dynamic = await options.fetch(workerUrl, {
          priority: "low",
          signal: controller.signal,
        });
        index2 = value3.status;
        value3.ok && (value2 = new Uint8Array(await value3.arrayBuffer()));
      } catch {
        index2 = 0;
      } finally {
        value();
      }
      if (value2 !== undefined)
        try {
          return await options.accept(value2);
        } catch {
          return false;
        }
      if (
        !(index2 === 0 || index2 === 401 || index2 === 403) ||
        index >= FAST_EDIT_WORKER_FETCH_RETRY_MS.length
      )
        return false;
      await options.wait(FAST_EDIT_WORKER_FETCH_RETRY_MS[index]);
    }
  }
  function getFastEditWorkerUrl(): Dynamic {
    if (typeof document === "undefined") return;
    let value: Dynamic = (document as Dynamic)
      .querySelector('meta[name="' + FAST_EDIT_WORKER_META_NAME + '"]')
      ?.getAttribute("content");
    if (value)
      try {
        return new URL(value, (document as Dynamic).baseURI).href;
      } catch {
        return;
      }
  }
  async function readFastEditSamplingConfiguration(): Promise<Dynamic> {
    let {
        modelTier: value,
        model: value2,
        effort: value3,
      }: Dynamic = await (0, runtime.awaitFeatureFlag)(
        FAST_EDIT_SAMPLING_FLAG,
        {
          modelTier: "quick",
        },
      ),
      value4: Dynamic = FAST_EDIT_REASONING_EFFORTS.find(
        (input?: Dynamic): Dynamic => input === value3,
      );
    return {
      modelTier:
        FAST_EDIT_MODEL_TIERS.find(
          (input?: Dynamic): Dynamic => input === value,
        ) ?? "quick",
      ...(typeof value2 == "string" && value2 !== ""
        ? {
            model: value2,
          }
        : {}),
      ...(value4 !== undefined
        ? {
            effort: value4,
          }
        : {}),
    };
  }
  function initializeFastEdit(
    readFeatureFlag: Dynamic = runtime.awaitFeatureFlag,
    registerComposer: Dynamic = runtime.registerFastEditComposer,
  ): Dynamic {
    let enabledPromise: Dynamic = readFeatureFlag(
        FAST_EDIT_FEATURE_FLAG,
        false,
      ),
      workerAvailablePromise: Dynamic = enabledPromise
        .then(
          (input?: Dynamic): Dynamic =>
            input
              ? runtime.embeddedFastEditWorkerSource !== ""
                ? (0, runtime.installFastEditWorker)(
                    new TextEncoder().encode(
                      runtime.embeddedFastEditWorkerSource,
                    ),
                  )
                : loadFastEditWorker({
                    address: getFastEditWorkerUrl,
                    fetch: (input2?: Dynamic, options?: Dynamic): Dynamic =>
                      fetch(input2, options),
                    wait: (input2?: Dynamic): Dynamic =>
                      new Promise(
                        (input3?: Dynamic): Dynamic =>
                          setTimeout(input3, input2),
                      ),
                    timer: (input2?: Dynamic, options?: Dynamic): Dynamic => {
                      let value: Dynamic = setTimeout(options, input2);
                      return (): Dynamic => clearTimeout(value);
                    },
                    accept: runtime.installFastEditWorker,
                  })
              : false,
        )
        .catch((): Dynamic => false);
    (0, runtime.setEditorReadyPromise)(
      enabledPromise.then(
        async (input?: Dynamic): Promise<Dynamic> =>
          input &&
          (await (0, runtime.resolveSamplingCapability)(
            (input2?: Dynamic): Dynamic => typeof input2 == "function",
          )) !== null &&
          (await workerAvailablePromise),
      ),
    );
    enabledPromise.then(async (input?: Dynamic): Promise<Dynamic> => {
      if (!input) return;
      let { modelTier: value, ...value2 }: Dynamic =
        await readFastEditSamplingConfiguration();
      registerComposer({
        commentRules: runtime.fastEditCanvasSystemPrompt,
        newArtboardRules: runtime.fastEditFilesSystemPrompt,
        createEngine: (input2?: Dynamic): Dynamic =>
          (0, runtime.createSamplingClient)(input2, value2),
        sandbox: {
          ...runtime.fastEditSandboxAdapter,
          available: workerAvailablePromise,
        },
        tier: value,
      });
    });
  }
  bindRuntimeValue(
    runtime,
    "FAST_EDIT_WORKER_META_NAME",
    () => FAST_EDIT_WORKER_META_NAME,
    (value) => {
      FAST_EDIT_WORKER_META_NAME = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FAST_EDIT_WORKER_FETCH_RETRY_MS",
    () => FAST_EDIT_WORKER_FETCH_RETRY_MS,
    (value) => {
      FAST_EDIT_WORKER_FETCH_RETRY_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FAST_EDIT_WORKER_FETCH_TIMEOUT_MS",
    () => FAST_EDIT_WORKER_FETCH_TIMEOUT_MS,
    (value) => {
      FAST_EDIT_WORKER_FETCH_TIMEOUT_MS = value;
    },
  );
  bindRuntimeValue(runtime, "loadFastEditWorker", () => loadFastEditWorker);
  bindRuntimeValue(runtime, "getFastEditWorkerUrl", () => getFastEditWorkerUrl);
  bindRuntimeValue(
    runtime,
    "FAST_EDIT_FEATURE_FLAG",
    () => FAST_EDIT_FEATURE_FLAG,
    (value) => {
      FAST_EDIT_FEATURE_FLAG = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FAST_EDIT_SAMPLING_FLAG",
    () => FAST_EDIT_SAMPLING_FLAG,
    (value) => {
      FAST_EDIT_SAMPLING_FLAG = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FAST_EDIT_MODEL_TIERS",
    () => FAST_EDIT_MODEL_TIERS,
    (value) => {
      FAST_EDIT_MODEL_TIERS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FAST_EDIT_REASONING_EFFORTS",
    () => FAST_EDIT_REASONING_EFFORTS,
    (value) => {
      FAST_EDIT_REASONING_EFFORTS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "readFastEditSamplingConfiguration",
    () => readFastEditSamplingConfiguration,
  );
  bindRuntimeValue(runtime, "initializeFastEdit", () => initializeFastEdit);
  return () => {
    FAST_EDIT_WORKER_META_NAME = "fast-edit-worker-file";
    FAST_EDIT_WORKER_FETCH_RETRY_MS = [1500, 6e3];
    FAST_EDIT_WORKER_FETCH_TIMEOUT_MS = 3e4;
    FAST_EDIT_FEATURE_FLAG = "design_fast_edit";
    FAST_EDIT_SAMPLING_FLAG = "design_fast_edit_sample";
    FAST_EDIT_MODEL_TIERS = ["quick", "default", "complex"];
    FAST_EDIT_REASONING_EFFORTS = ["low", "medium", "high"];
  };
}
