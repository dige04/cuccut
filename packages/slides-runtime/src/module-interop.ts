/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type ModuleNamespace,
  type RuntimeBindings,
} from "./bindings";

/** Getters of a module's live exports, by export name. */
type ExportGetters = Record<string, () => unknown>;
/** A CommonJS module body: fills `exports` (or replaces `module.exports`). */
type CommonJSFactory<T> = (exports: T, module: { exports: T }) => void;
type RequireFunction = (id: string) => unknown;

declare module "./bindings" {
  interface RuntimeBindings {
    createObject: typeof Object.create;
    getPrototypeOf: typeof Object.getPrototypeOf;
    defineProperty: typeof Object.defineProperty;
    getOwnPropertyNames: typeof Object.getOwnPropertyNames;
    hasOwnProperty: typeof Object.prototype.hasOwnProperty;
    readBoundProperty: (this: Record<string, unknown>, key: string) => unknown;
    commonJSNamespaceCache: WeakMap<object, object> | undefined;
    esmNamespaceCache: WeakMap<object, object> | undefined;
    /** Wraps a module as an ES namespace; with `nodeMode` (1) `default` is always the module itself. */
    toModuleNamespace: <T>(module: T, nodeMode?: number) => ModuleNamespace<T>;
    initializeCommonJS: <T>(factory: CommonJSFactory<T>) => () => T;
    identity: <T>(value: T) => T;
    replaceExportGetter: (
      this: ExportGetters,
      key: string,
      value: unknown,
    ) => void;
    defineLiveExports: (target: object, getters: ExportGetters) => void;
    /** Runs `init` on the first call only and returns its result on every call. */
    initializeOnce: <T>(init: (done: 0) => T) => () => T;
    dynamicRequire: RequireFunction;
  }
}

export function installModuleInterop(runtime: RuntimeBindings): () => void {
  var createObject: RuntimeBindings["createObject"];
  var getPrototypeOf: RuntimeBindings["getPrototypeOf"];
  var defineProperty: RuntimeBindings["defineProperty"];
  var getOwnPropertyNames: RuntimeBindings["getOwnPropertyNames"];
  var hasOwnProperty: RuntimeBindings["hasOwnProperty"];
  var commonJSNamespaceCache: RuntimeBindings["commonJSNamespaceCache"];
  var esmNamespaceCache: RuntimeBindings["esmNamespaceCache"];
  var toModuleNamespace: RuntimeBindings["toModuleNamespace"];
  var initializeCommonJS: RuntimeBindings["initializeCommonJS"];
  var identity: RuntimeBindings["identity"];
  var defineLiveExports: RuntimeBindings["defineLiveExports"];
  var initializeOnce: RuntimeBindings["initializeOnce"];
  var dynamicRequire: RuntimeBindings["dynamicRequire"];
  function readBoundProperty(
    this: Record<string, unknown>,
    input: string,
  ): unknown {
    return this[input];
  }
  function replaceExportGetter(
    this: ExportGetters,
    input: string,
    options: unknown,
  ): void {
    this[input] = identity.bind(null, options);
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
  return () => {
    createObject = Object.create;
    ({
      getPrototypeOf: getPrototypeOf,
      defineProperty: defineProperty,
      getOwnPropertyNames: getOwnPropertyNames,
    } = Object);
    hasOwnProperty = Object.prototype.hasOwnProperty;
    toModuleNamespace = <T>(
      input: T,
      options?: number,
      context?: object,
    ): ModuleNamespace<T> => {
      var value: boolean = input != null && typeof input === "object";
      if (value) {
        var value2: WeakMap<object, object> = options
            ? (commonJSNamespaceCache ??= new WeakMap())
            : (esmNamespaceCache ??= new WeakMap()),
          entry: object | undefined = value2.get(input as object);
        if (entry) {
          return entry as ModuleNamespace<T>;
        }
      }
      context = input != null ? createObject(getPrototypeOf(input)) : {};
      let value3: object =
        options || !input || !(input as { __esModule?: boolean }).__esModule
          ? defineProperty(context as object, "default", {
              value: input,
              enumerable: true,
            })
          : (context as object);
      for (let value4 of getOwnPropertyNames(input) as string[])
        if (!hasOwnProperty.call(value3, value4)) {
          defineProperty(value3, value4, {
            get: readBoundProperty.bind(
              input as Record<string, unknown>,
              value4,
            ),
            enumerable: true,
          });
        }
      if (value) {
        value2!.set(input as object, value3);
      }
      return value3 as ModuleNamespace<T>;
    };
    initializeCommonJS =
      <T>(input: CommonJSFactory<T>, options?: { exports: T }): (() => T) =>
      (): T => {
        options ||
          input(
            (options = {
              exports: {} as T,
            }).exports,
            options,
          );
        return options!.exports;
      };
    identity = <T>(input: T): T => input;
    defineLiveExports = (input: object, options: ExportGetters): void => {
      for (var value in options)
        defineProperty(input, value, {
          get: options[value],
          enumerable: true,
          configurable: true,
          set: replaceExportGetter.bind(options, value),
        });
    };
    initializeOnce =
      <T>(input: ((done: 0) => T) | 0, options?: T): (() => T) =>
      (): T => {
        input && (options = input((input = 0)));
        return options as T;
      };
    dynamicRequire = ((input: RequireFunction): RequireFunction =>
      typeof require !== "undefined"
        ? require
        : typeof Proxy !== "undefined"
          ? new Proxy(input, {
              get: (input2: RequireFunction, options: string | symbol): unknown =>
                (
                  (typeof require !== "undefined"
                    ? require
                    : input2) as unknown as Record<string | symbol, unknown>
                )[options],
            })
          : input)(function (this: unknown, input: string): unknown {
      if (typeof require !== "undefined") {
        return require.apply(this, arguments as unknown as [id: string]);
      }
      throw Error('Dynamic require of "' + input + '" is not supported');
    });
  };
}
