/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorComponentsPropCache(
  runtime: RuntimeBindings,
): () => void {
  var reactComponentsPropCache: Dynamic;
  var ComponentsPropCacheCache: Dynamic;
  function getComponentPropsCache(input?: Dynamic, options?: Dynamic): Dynamic {
    let entry: Dynamic = ComponentsPropCacheCache.get(input);
    entry || ((entry = new Map()), ComponentsPropCacheCache.set(input, entry));
    let entry2: Dynamic = entry.get(options);
    entry2 ||
      ((entry2 = {
        unsaved: new Map(),
        defaults: new Map(),
      }),
      entry.set(options, entry2));
    return entry2;
  }
  function cacheUnsavedComponentProp(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
  ): Dynamic {
    if (!(!input || !options || !context)) {
      if (value === undefined) {
        ComponentsPropCacheCache.get(input)
          ?.get(options)
          ?.unsaved.delete(context);
        return;
      }
      getComponentPropsCache(input, options).unsaved.set(context, value);
    }
  }
  function clearUnsavedComponentProps(
    input?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    ComponentsPropCacheCache.get(input)?.get(options)?.unsaved.clear();
  }
  function adoptComponentPropDefaults(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    if (!input || !options) return;
    let value: Dynamic = Object.keys(context);
    if (value.length === 0) return;
    let value2: Dynamic = getComponentPropsCache(input, options);
    for (let value3 of value as Dynamic) {
      value2.defaults.set(value3, context[value3]);
      value2.unsaved.delete(value3);
    }
  }
  bindRuntimeValue(
    runtime,
    "reactComponentsPropCache",
    () => reactComponentsPropCache,
    (value) => {
      reactComponentsPropCache = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsPropCacheCache",
    () => ComponentsPropCacheCache,
    (value) => {
      ComponentsPropCacheCache = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "getComponentPropsCache",
    () => getComponentPropsCache,
  );
  bindRuntimeValue(
    runtime,
    "cacheUnsavedComponentProp",
    () => cacheUnsavedComponentProp,
  );
  bindRuntimeValue(
    runtime,
    "clearUnsavedComponentProps",
    () => clearUnsavedComponentProps,
  );
  bindRuntimeValue(
    runtime,
    "adoptComponentPropDefaults",
    () => adoptComponentPropDefaults,
  );
  return () => {
    reactComponentsPropCache = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react)(),
      1,
    );
    ComponentsPropCacheCache = new Map();
  };
}
