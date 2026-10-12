/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "./runtime-types";
import type {
  ModuleNamespace,
  ExportGetters,
  RequireFunction,
} from "./contracts/module-helpers";

export function installModuleHelpers(runtime: RuntimeBindings): () => void {
  var createObject: (prototype: object | null) => object;
  var getPrototypeOf: (value: object) => object | null;
  var defineProperty: typeof Object.defineProperty;
  var getOwnPropertyNames: (value: object) => string[];
  var getOwnPropertyDescriptor: typeof Object.getOwnPropertyDescriptor;
  var hasOwnProperty: typeof Object.prototype.hasOwnProperty;
  var commonJSNamespaceCache: WeakMap<object, object> | undefined;
  var esmNamespaceCache: WeakMap<object, object> | undefined;
  var toModuleNamespace: <Value extends object>(
    moduleValue: Value,
    nodeInterop?: boolean | number,
    namespace?: object,
  ) => ModuleNamespace<Value>;
  var toCommonJSNamespace: (moduleValue: object) => object;
  var commonJSExportCache: WeakMap<object, object> | undefined;
  var initializeCommonJS: (
    factory: (
      exports: Record<string, unknown>,
      record: { exports: unknown },
    ) => void,
    moduleRecord?: { exports: unknown },
  ) => () => unknown;
  var identity: <Value>(value?: Value) => Value | undefined;
  var defineLiveExports: (target: object, exports: ExportGetters) => void;
  var initializeOnce: <Value>(
    initializer: ((signal: 0) => Value) | 0 | undefined,
    result?: Value,
  ) => () => Value | undefined;
  var dynamicRequire: RequireFunction;
  var accentColorNames: string[];
  function readBoundProperty(this: object, property: PropertyKey): unknown {
    return (this as Record<PropertyKey, unknown>)[property];
  }
  function replaceExportGetter(
    this: ExportGetters,
    property: string,
    value: unknown,
  ): void {
    this[property] = identity.bind(null, value);
  }
  bindRuntimeValue(
    runtime,
    "createObject",
    () => createObject,
    (value) => {
      createObject = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "getPrototypeOf",
    () => getPrototypeOf,
    (value) => {
      getPrototypeOf = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "defineProperty",
    () => defineProperty,
    (value) => {
      defineProperty = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "getOwnPropertyNames",
    () => getOwnPropertyNames,
    (value) => {
      getOwnPropertyNames = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "getOwnPropertyDescriptor",
    () => getOwnPropertyDescriptor,
    (value) => {
      getOwnPropertyDescriptor = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "hasOwnProperty",
    () => hasOwnProperty,
    (value) => {
      hasOwnProperty = value;
    },
  );
  bindRuntimeValue(runtime, "readBoundProperty", () => readBoundProperty);
  bindRuntimeValue(
    runtime,
    "commonJSNamespaceCache",
    () => commonJSNamespaceCache,
    (value) => {
      commonJSNamespaceCache = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "esmNamespaceCache",
    () => esmNamespaceCache,
    (value) => {
      esmNamespaceCache = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "toModuleNamespace",
    () => toModuleNamespace,
    (value) => {
      toModuleNamespace = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "toCommonJSNamespace",
    () => toCommonJSNamespace,
    (value) => {
      toCommonJSNamespace = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "commonJSExportCache",
    () => commonJSExportCache,
    (value) => {
      commonJSExportCache = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeCommonJS",
    () => initializeCommonJS,
    (value) => {
      initializeCommonJS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "identity",
    () => identity,
    (value) => {
      identity = value;
    },
  );
  bindRuntimeValue(runtime, "replaceExportGetter", () => replaceExportGetter);
  bindRuntimeValue(
    runtime,
    "defineLiveExports",
    () => defineLiveExports,
    (value) => {
      defineLiveExports = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeOnce",
    () => initializeOnce,
    (value) => {
      initializeOnce = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "dynamicRequire",
    () => dynamicRequire,
    (value) => {
      dynamicRequire = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "accentColorNames",
    () => accentColorNames,
    (value) => {
      accentColorNames = value;
    },
  );
  return () => {
    createObject = Object.create;
    ({
      getPrototypeOf: getPrototypeOf,
      defineProperty: defineProperty,
      getOwnPropertyNames: getOwnPropertyNames,
      getOwnPropertyDescriptor: getOwnPropertyDescriptor,
    } = Object);
    hasOwnProperty = Object.prototype.hasOwnProperty;
    toModuleNamespace = <Value extends object>(
      moduleValue: Value,
      nodeInterop?: boolean | number,
      namespace?: object,
    ): ModuleNamespace<Value> => {
      var isObject: boolean =
        moduleValue != null && typeof moduleValue === "object";
      if (isObject) {
        var cache: WeakMap<object, object> = nodeInterop
            ? (commonJSNamespaceCache ??= new WeakMap())
            : (esmNamespaceCache ??= new WeakMap()),
          cachedNamespace: object | undefined = cache.get(moduleValue);
        if (cachedNamespace) {
          return cachedNamespace as ModuleNamespace<Value>;
        }
      }
      namespace =
        moduleValue != null ? createObject(getPrototypeOf(moduleValue)) : {};
      let result: object =
        nodeInterop ||
        !moduleValue ||
        !(moduleValue as { __esModule?: unknown }).__esModule
          ? defineProperty(namespace, "default", {
              value: moduleValue,
              enumerable: true,
            })
          : namespace;
      for (let value of getOwnPropertyNames(moduleValue)) {
        if (!hasOwnProperty.call(result, value)) {
          defineProperty(result, value, {
            get: readBoundProperty.bind(moduleValue, value),
            enumerable: true,
          });
        }
      }
      if (isObject) {
        cache!.set(moduleValue, result);
      }
      return result as ModuleNamespace<Value>;
    };
    toCommonJSNamespace = (moduleValue: object): object => {
      var namespace: object | undefined = (commonJSExportCache ??=
          new WeakMap()).get(moduleValue),
        descriptor: PropertyDescriptor | undefined;
      if (namespace) {
        return namespace;
      }
      namespace = defineProperty({}, "__esModule", {
        value: true,
      });
      if (
        (moduleValue && typeof moduleValue === "object") ||
        typeof moduleValue === "function"
      ) {
        for (var property of getOwnPropertyNames(moduleValue)) {
          if (!hasOwnProperty.call(namespace, property)) {
            defineProperty(namespace, property, {
              get: readBoundProperty.bind(moduleValue, property),
              enumerable:
                !(descriptor = getOwnPropertyDescriptor(
                  moduleValue,
                  property,
                )) || descriptor.enumerable,
            });
          }
        }
      }
      commonJSExportCache.set(moduleValue, namespace);
      return namespace;
    };
    initializeCommonJS =
      (
        factory: (
          exports: Record<string, unknown>,
          record: { exports: unknown },
        ) => void,
        moduleRecord?: { exports: unknown },
      ): (() => unknown) =>
      (): unknown => {
        moduleRecord ||
          factory(
            (moduleRecord = {
              exports: {},
            }).exports,
            moduleRecord,
          );
        return moduleRecord!.exports;
      };
    identity = <Value>(value?: Value): Value | undefined => value;
    defineLiveExports = (target: object, exports: ExportGetters): void => {
      for (var property in exports) {
        defineProperty(target, property, {
          get: exports[property],
          enumerable: true,
          configurable: true,
          set: replaceExportGetter.bind(exports, property),
        });
      }
    };
    initializeOnce =
      <Value>(
        initializer: ((signal: 0) => Value) | 0 | undefined,
        result?: Value,
      ): (() => Value | undefined) =>
      (): Value | undefined => {
        initializer && (result = initializer((initializer = 0)));
        return result;
      };
    dynamicRequire = ((input: RequireFunction): RequireFunction =>
      typeof require !== "undefined"
        ? require
        : typeof Proxy !== "undefined"
          ? new Proxy(input, {
              get: (input2: RequireFunction, options: PropertyKey): unknown =>
                (
                  (typeof require !== "undefined"
                    ? require
                    : input2) as unknown as Record<PropertyKey, unknown>
                )[options],
            })
          : input)(function (this: unknown, input: string): unknown {
      if (typeof require !== "undefined") {
        return (require as unknown as RequireFunction).apply(this, arguments);
      }
      throw Error('Dynamic require of "' + input + '" is not supported');
    });
  };
}
