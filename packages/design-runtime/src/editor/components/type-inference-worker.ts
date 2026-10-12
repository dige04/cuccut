/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorComponentsTypeInferenceWorker(
  runtime: RuntimeBindings,
): () => void {
  var ComponentsTypeInferenceWorkerObservedElements: Dynamic;
  var ComponentsTypeInferenceWorkerCurrentState: Dynamic;
  var ComponentsTypeInferenceWorkerCreateObjectURLValue: Dynamic;
  var ComponentsTypeInferenceWorkerConstant: Dynamic;
  var ComponentsTypeInferenceWorkerCache: Dynamic;
  var ComponentsTypeInferenceWorkerElementCache: Dynamic;
  function componentDeclarationFiles(
    input?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    let value: Dynamic = input.split(".")[0].toLowerCase(),
      entry: Dynamic =
        runtime.ComponentsDeclarationResolverElementCache.get(options);
    entry === undefined &&
      runtime.ComponentsDeclarationResolverElementCache.set(
        options,
        (entry = new Map()),
      );
    let entry2: Dynamic = entry.get(value);
    if (entry2 !== undefined) return entry2;
    let value2: Dynamic =
        "ds/" +
        value
          .replace(/[^a-z0-9_-]+/g, "-")
          .replace(/^[-_]+/, "")
          .slice(0, 64)
          .replace(/-+$/, "") +
        "/",
      callback: Dynamic = (input2?: Dynamic): Dynamic => {
        let value4: Dynamic = input2.toLowerCase();
        return Number(
          value4.startsWith("ds/")
            ? value4.startsWith(value2)
            : value4.startsWith(value),
        );
      },
      value3: Dynamic = Object.entries(options)
        .filter(
          ([, input2]: Dynamic): Dynamic =>
            !(0, runtime.typeExpressionTooDeep)(input2),
        )
        .sort(
          ([input2]: Dynamic, [options2]: Dynamic): Dynamic =>
            callback(options2) - callback(input2) ||
            (input2 < options2 ? -1 : input2 > options2 ? 1 : 0),
        )
        .map(([, input2]: Dynamic): Dynamic => input2);
    entry.set(value, value3);
    return value3;
  }
  function supportsTypeInferenceWorker(): Dynamic {
    return typeof Worker !== "undefined" && typeof Blob !== "undefined";
  }
  function getTypeInferenceWorker(): Dynamic {
    if (ComponentsTypeInferenceWorkerCurrentState !== null)
      return ComponentsTypeInferenceWorkerCurrentState;
    ComponentsTypeInferenceWorkerCreateObjectURLValue ??= URL.createObjectURL(
      new Blob([runtime.propertyScrubberSource], {
        type: "text/javascript",
      }),
    );
    let value: Dynamic = new Worker(
      ComponentsTypeInferenceWorkerCreateObjectURLValue,
    );
    value.onmessage = (input?: Dynamic): Dynamic => {
      let entry: Dynamic = ComponentsTypeInferenceWorkerCache.get(
        input.data.id,
      );
      entry !== undefined &&
        (ComponentsTypeInferenceWorkerCache.delete(input.data.id),
        clearTimeout(entry.timer),
        entry.resolve(Array.isArray(input.data.specs) ? input.data.specs : []));
    };
    value.onerror = (): Dynamic => {
      console.warn(
        "design (props panel): the type-declaration reader could not run here \u2014 showing values only",
      );
      ComponentsTypeInferenceWorkerCurrentState === value &&
        terminateTypeInferenceWorker();
    };
    return (ComponentsTypeInferenceWorkerCurrentState = value);
  }
  function terminateTypeInferenceWorker(): Dynamic {
    ComponentsTypeInferenceWorkerCurrentState?.terminate();
    ComponentsTypeInferenceWorkerCurrentState = null;
    for (let value of ComponentsTypeInferenceWorkerCache.values() as Dynamic) {
      clearTimeout(value.timer);
      value.resolve([]);
    }
    ComponentsTypeInferenceWorkerCache.clear();
  }
  function inferPropsInWorker(input?: Dynamic, options?: Dynamic): Dynamic {
    return ComponentsTypeInferenceWorkerObservedElements.has(options)
      ? Promise.resolve([])
      : new Promise((input2?: Dynamic): Dynamic => {
          let value: Dynamic = ComponentsTypeInferenceWorkerConstant++,
            value2: Dynamic = setTimeout((): Dynamic => {
              ComponentsTypeInferenceWorkerCache.has(value) &&
                (ComponentsTypeInferenceWorkerObservedElements.add(options),
                console.warn(
                  "design (props panel): reading the design system's type declarations took over " +
                    String(runtime.ComponentsDeclarationResolverDelayMs) +
                    " ms \u2014 showing values only",
                ),
                terminateTypeInferenceWorker());
            }, runtime.ComponentsDeclarationResolverDelayMs);
          ComponentsTypeInferenceWorkerCache.set(value, {
            resolve: input2,
            timer: value2,
            texts: options,
          });
          try {
            getTypeInferenceWorker().postMessage({
              id: value,
              names: input,
              texts: options,
              keep: runtime.ComponentsDeclarationResolverNameTypeValueValues,
            });
          } catch {
            console.warn(
              "design (props panel): the type-declaration reader could not start here \u2014 showing values only",
            );
            terminateTypeInferenceWorker();
          }
        });
  }
  function cachedInferredComponentProps(
    input?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    return ComponentsTypeInferenceWorkerElementCache.get(options)?.get(input);
  }
  async function inferInstalledComponentProps(
    input?: Dynamic,
    options?: Dynamic,
  ): Promise<Dynamic> {
    let value: Dynamic = cachedInferredComponentProps(input, options);
    if (value !== undefined) return value;
    let value2: Dynamic = componentDeclarationFiles(input, options),
      items: Dynamic = [];
    if (value2.length > 0) {
      let value3: Dynamic = (0, runtime.componentTypeCandidates)(input);
      items = supportsTypeInferenceWorker()
        ? await inferPropsInWorker(value3, value2)
        : (0, runtime.inferPropsFromDeclarations)(
            value3,
            value2,
            runtime.ComponentsDeclarationResolverNameTypeValueValues,
          );
    }
    let entry: Dynamic = ComponentsTypeInferenceWorkerElementCache.get(options);
    entry === undefined &&
      ComponentsTypeInferenceWorkerElementCache.set(
        options,
        (entry = new Map()),
      );
    entry.set(input, items);
    return items;
  }
  bindRuntimeValue(
    runtime,
    "componentDeclarationFiles",
    () => componentDeclarationFiles,
  );
  bindRuntimeValue(
    runtime,
    "ComponentsTypeInferenceWorkerObservedElements",
    () => ComponentsTypeInferenceWorkerObservedElements,
    (value) => {
      ComponentsTypeInferenceWorkerObservedElements = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsTypeInferenceWorkerCurrentState",
    () => ComponentsTypeInferenceWorkerCurrentState,
    (value) => {
      ComponentsTypeInferenceWorkerCurrentState = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsTypeInferenceWorkerCreateObjectURLValue",
    () => ComponentsTypeInferenceWorkerCreateObjectURLValue,
    (value) => {
      ComponentsTypeInferenceWorkerCreateObjectURLValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsTypeInferenceWorkerConstant",
    () => ComponentsTypeInferenceWorkerConstant,
    (value) => {
      ComponentsTypeInferenceWorkerConstant = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsTypeInferenceWorkerCache",
    () => ComponentsTypeInferenceWorkerCache,
    (value) => {
      ComponentsTypeInferenceWorkerCache = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "supportsTypeInferenceWorker",
    () => supportsTypeInferenceWorker,
  );
  bindRuntimeValue(
    runtime,
    "getTypeInferenceWorker",
    () => getTypeInferenceWorker,
  );
  bindRuntimeValue(
    runtime,
    "terminateTypeInferenceWorker",
    () => terminateTypeInferenceWorker,
  );
  bindRuntimeValue(runtime, "inferPropsInWorker", () => inferPropsInWorker);
  bindRuntimeValue(
    runtime,
    "ComponentsTypeInferenceWorkerElementCache",
    () => ComponentsTypeInferenceWorkerElementCache,
    (value) => {
      ComponentsTypeInferenceWorkerElementCache = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "cachedInferredComponentProps",
    () => cachedInferredComponentProps,
  );
  bindRuntimeValue(
    runtime,
    "inferInstalledComponentProps",
    () => inferInstalledComponentProps,
  );
  return () => {
    ComponentsTypeInferenceWorkerObservedElements = new WeakSet();
    ComponentsTypeInferenceWorkerCurrentState = null;
    ComponentsTypeInferenceWorkerCreateObjectURLValue = null;
    ComponentsTypeInferenceWorkerConstant = 1;
    ComponentsTypeInferenceWorkerCache = new Map();
    ComponentsTypeInferenceWorkerElementCache = new WeakMap();
  };
}
