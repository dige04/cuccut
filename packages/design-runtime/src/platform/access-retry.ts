/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installPlatformAccessRetry(
  runtime: RuntimeBindings,
): () => void {
  var PlatformAccessRetryItems: Dynamic;
  function isRetryableAccessFailure(input?: Dynamic): Dynamic {
    let value: Dynamic = input?.status;
    return value === 401 || value === 403 || value === 404;
  }
  async function listWritableFiles(input?: Dynamic): Promise<Dynamic> {
    if (
      input.mayWrite === true &&
      typeof input.listUnlessNarrowed == "function"
    )
      return await input.listUnlessNarrowed();
    let value: Dynamic = await input.list();
    if (
      input.mayWrite === true &&
      (0, runtime.isNarrowedFileContext)(value, input)
    )
      throw {
        code: "http",
        status: 403,
        narrowed: true,
        message: "_files.json: marked as narrowed",
      };
    return value;
  }
  async function retryAccessFailure(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    items: Dynamic = PlatformAccessRetryItems,
  ): Promise<Dynamic> {
    let value: Dynamic = options ?? {
      setTimeout: (input2?: Dynamic, options2?: Dynamic): Dynamic =>
        setTimeout(input2, options2),
    };
    for (let index: Dynamic = 0; ; index++)
      try {
        return await input();
      } catch (value2: Dynamic) {
        if (index >= items.length || !isRetryableAccessFailure(value2))
          throw value2;
        context?.(index + 1, value2);
        await new Promise((input2?: Dynamic): Dynamic => {
          value.setTimeout(input2, items[index]);
        });
      }
  }
  bindRuntimeValue(
    runtime,
    "PlatformAccessRetryItems",
    () => PlatformAccessRetryItems,
    (value) => {
      PlatformAccessRetryItems = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isRetryableAccessFailure",
    () => isRetryableAccessFailure,
  );
  bindRuntimeValue(runtime, "listWritableFiles", () => listWritableFiles);
  bindRuntimeValue(runtime, "retryAccessFailure", () => retryAccessFailure);
  return () => {
    PlatformAccessRetryItems = [50, 100, 200, 400, 800];
  };
}
