/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installFastEditSandboxAdapter(
  runtime: RuntimeBindings,
): () => void {
  var fastEditSandboxAdapter: Dynamic;
  var ReactFastEdit: Dynamic;
  function createSamplingClient(
    sample?: Dynamic,
    configuration?: Dynamic,
  ): Dynamic {
    return {
      call({
        turns: turns,
        tier: tier,
        images: images,
        onText: onText,
      }: Dynamic): Dynamic {
        let controller: Dynamic = new AbortController();
        return {
          promise: sample([...turns], {
            cache: false,
            modelTier: tier,
            ...configuration,
            ...(images.length > 0
              ? {
                  images: [...images],
                }
              : {}),
            signal: controller.signal,
            onText: (input?: Dynamic): Dynamic => onText(input.text),
          }),
          cancel: (): Dynamic => controller.abort(),
        };
      },
      maxPromptBytes: async (): Promise<Dynamic> =>
        (await sample.limits?.())?.maxPromptBytes,
      dispose: (): Dynamic => {},
    };
  }
  bindRuntimeValue(
    runtime,
    "fastEditSandboxAdapter",
    () => fastEditSandboxAdapter,
    (value) => {
      fastEditSandboxAdapter = value;
    },
  );
  bindRuntimeValue(runtime, "createSamplingClient", () => createSamplingClient);
  bindRuntimeValue(
    runtime,
    "ReactFastEdit",
    () => ReactFastEdit,
    (value) => {
      ReactFastEdit = value;
    },
  );
  return () => {
    fastEditSandboxAdapter = {
      create(input: Dynamic): Dynamic {
        let value: Dynamic = (0, runtime.createFastEditSandbox)({
            sdk: 3,
            files: input.files.map(
              (input2?: Dynamic): Dynamic => ({
                ...input2,
              }),
            ),
            index: {
              title: input.title,
            },
            ...(input.current !== undefined
              ? {
                  current: input.current,
                }
              : {}),
            limits: runtime.FAST_EDIT_CANVAS_SANDBOX_LIMITS,
            onHtml: (input2?: Dynamic): Dynamic =>
              input.onHtml({
                id: input2.slideId ?? null,
                html: input2.html,
                ...(input2.final === true
                  ? {
                      final: true,
                    }
                  : {}),
              }),
            onOp: (input2?: Dynamic): Dynamic => input.onOp(input2.op),
            onDone: (input2?: Dynamic): Dynamic =>
              input.onDone({
                changed: Array.isArray(input2.changed) ? input2.changed : [],
                ...(typeof input2.stmt == "string"
                  ? {
                      stmt: input2.stmt,
                    }
                  : {}),
                ...(input2.threw !== undefined || input2.skipped === true
                  ? {
                      failed: true,
                    }
                  : {}),
              }),
            onError: (input2?: Dynamic): Dynamic => input.onError(input2),
            onLog: (input2?: Dynamic): Dynamic =>
              input.onLog(
                typeof input2.n == "number"
                  ? {
                      n: input2.n,
                      message:
                        String(input2.message) +
                        (input2.cut === true
                          ? `
(cut here)`
                          : ""),
                    }
                  : {},
              ),
            onTouch: (input2?: Dynamic): Dynamic =>
              input.onTouch(input2.slideId),
            onPreview: (event?: Dynamic): Dynamic =>
              input.onPreview?.({
                method: event.method,
                target: event.target,
                html: event.html,
              }),
          }),
          flag: Dynamic = false,
          callback: Dynamic = (input2?: Dynamic): Dynamic => {
            if (!flag)
              try {
                input2();
              } catch {
                flag = true;
                input.onError({
                  message: "the sandbox frame is gone",
                  fatal: true,
                });
              }
          };
        return {
          ready: Promise.resolve(value.ready).then(
            (input2?: Dynamic): Dynamic =>
              input2 === undefined
                ? {
                    ok: true,
                  }
                : input2,
          ),
          feed: (input2?: Dynamic): Dynamic =>
            callback((): Dynamic => value.feed(input2)),
          flush: (): Dynamic => callback((): Dynamic => value.flush?.()),
          end: (): Dynamic => callback((): Dynamic => value.end()),
          stop: (): Dynamic => value.stop(),
          destroy: (): Dynamic => value.destroy(),
          view: async (input2?: Dynamic): Promise<Dynamic> => {
            let value2: Dynamic = await value.view?.(input2);
            return value2 == null
              ? null
              : {
                  html: value2.html,
                  prefix: value2.prefix,
                };
          },
        };
      },
      roundTrip(input: Dynamic): Dynamic {
        return new Promise((input2?: Dynamic): Dynamic => {
          let value: Dynamic,
            callback: Dynamic = (input3?: Dynamic): Dynamic => {
              try {
                value?.destroy();
              } catch {}
              input2(input3);
            };
          try {
            value = (0, runtime.createFastEditSandbox)({
              html: input,
              onHtml: (input3?: Dynamic): Dynamic => {
                input3.final === true && callback(input3.html);
              },
              onError: (input3?: Dynamic): Dynamic => {
                input3.fatal === true && callback(null);
              },
            });
          } catch {
            input2(null);
            return;
          }
          Promise.resolve(value.ready)
            .then((input3?: Dynamic): Dynamic => {
              input3 !== undefined && input3.ok === false
                ? callback(null)
                : value.end();
            })
            .catch((): Dynamic => callback(null));
          setTimeout((): Dynamic => callback(null), 4e3);
        });
      },
    };
    ReactFastEdit = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react)(),
      1,
    );
  };
}
