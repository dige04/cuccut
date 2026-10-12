/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installPreviewEvaluation(runtime: RuntimeBindings): () => void {
  var previewEvaluationRequests: Dynamic;
  var previewEvaluationSequence: Dynamic;
  var previewMessageListenerInstalled: Dynamic;
  function installPreviewMessageListener(): Dynamic {
    previewMessageListenerInstalled ||
      ((previewMessageListenerInstalled = true),
      (window as Dynamic).addEventListener(
        "message",
        (input?: Dynamic): Dynamic => {
          if (input.origin !== (0, runtime.currentHttpOrigin)()) return;
          let data: Dynamic = input.data;
          data == null ||
            typeof data != "object" ||
            !data.__om_eval_r ||
            typeof data.id != "string" ||
            previewEvaluationRequests.get(data.id)?.(input);
        },
      ));
  }
  function createPreviewHandle(input?: Dynamic): Dynamic {
    if (!input) return null;
    let value: Dynamic = input;
    function value2(input2?: Dynamic, options: Dynamic = 1e4): Dynamic {
      let value4: Dynamic = (0, runtime.getPreviewGenerationGate)(value);
      return value4.blocked != null
        ? Promise.reject(new Error("preview is blocked: " + value4.blocked))
        : new Promise((input3?: Dynamic, options2?: Dynamic): Dynamic => {
            let value5: Dynamic =
                (++previewEvaluationSequence).toString(36) +
                "." +
                Math.random().toString(36).slice(2),
              value6: Dynamic = setTimeout((): Dynamic => {
                callback2();
                options2(
                  new Error(`executeJavaScript timed out (${options / 1e3}s)`),
                );
              }, options),
              callback: Dynamic = (input4?: Dynamic): Dynamic => {
                if (!(0, runtime.isPreviewMessage)(input4, value)) return;
                let data: Dynamic = input4.data;
                callback2();
                if (data.ok) {
                  if (data.v === undefined) input3(undefined);
                  else
                    try {
                      input3(JSON.parse(data.v));
                    } catch (value7: Dynamic) {
                      options2(
                        new Error(
                          `eval returned unparseable JSON: ${(0, runtime.errorMessage)(value7)}`,
                        ),
                      );
                    }
                } else options2(new Error(data.e || "eval failed"));
              },
              callback2: Dynamic = (): Dynamic => {
                clearTimeout(value6);
                previewEvaluationRequests.delete(value5);
              };
            installPreviewMessageListener();
            previewEvaluationRequests.set(value5, callback);
            value.contentWindow?.postMessage(
              {
                __om_eval: 1,
                id: value5,
                code: input2,
              },
              "*",
            );
          });
    }
    function value3(input2?: Dynamic, options?: Dynamic): Dynamic {
      return value2(input2, options);
    }
    let entries: Dynamic = new Map();
    return {
      reload(): Dynamic {
        value3("location.reload()").catch((): Dynamic => {
          let value4: Dynamic = new URL(
            value.src,
            (window as Dynamic).location.href,
          );
          value4.searchParams.set("_r", String(Date.now()));
          value.src = value4.toString();
        });
      },
      setZoomFactor(input2: Dynamic): Dynamic {
        value.style.transform = `scale(${input2})`;
        value.style.transformOrigin = "top left";
        value.style.width = `${100 / input2}%`;
        value.style.height = `${100 / input2}%`;
      },
      lockViewportSize(input2: Dynamic, options: Dynamic): Dynamic {
        let text: Dynamic = "data-genpptx-vplock",
          value4: Dynamic =
            Math.abs(value.offsetWidth - input2) >= 1 ||
            Math.abs(value.offsetHeight - options) >= 1;
        value.setAttribute(text, "");
        let value5: Dynamic = (document as Dynamic).createElement("style");
        value5.setAttribute(text, "");
        value5.textContent = `iframe[${text}]{width:${input2}px!important;height:${options}px!important;flex:none!important;max-width:none!important;max-height:none!important;transform:none!important}`;
        (document as Dynamic).head.appendChild(value5);
        value.getBoundingClientRect();
        return {
          unlock: (): Dynamic => {
            value.removeAttribute(text);
            value5.remove();
          },
          resized: value4,
        };
      },
      async executeJavaScript(
        input2: Dynamic,
        options: Dynamic,
      ): Promise<Dynamic> {
        return value3(input2, options);
      },
      executeJavaScriptUnchecked(input2: Dynamic): Dynamic {
        value3(input2).catch((): Dynamic => {});
      },
      async awaitSettled(input2: Dynamic = 500): Promise<Dynamic> {
        let value4: Dynamic =
            typeof input2 == "number"
              ? {
                  capMs: input2,
                }
              : input2,
          value5: Dynamic,
          promise: Dynamic = new Promise((input3?: Dynamic): Dynamic => {
            value5 = setTimeout(input3, value4.capMs);
          });
        try {
          await Promise.race([
            value3(
              (0, runtime.buildSettlementScript)(value4),
              value4.capMs + 1e3,
            ).then(
              (): Dynamic => {},
              (): Dynamic => promise,
            ),
            promise,
          ]);
        } finally {
          clearTimeout(value5);
        }
      },
      addEventListener(input2: Dynamic, options: Dynamic): Dynamic {
        if (input2 === "dom-ready") value.addEventListener("load", options);
        else if (input2 === "console-message") {
          let callback: Dynamic = (input3?: Dynamic): Dynamic => {
            if (!(0, runtime.isPreviewMessage)(input3, value)) return;
            let data: Dynamic = input3.data;
            data?.__omelette_log &&
              data.type === "log" &&
              options({
                message: data.data,
              });
          };
          entries.set(options, callback);
          (window as Dynamic).addEventListener("message", callback);
        } else value.addEventListener(input2, options);
      },
      removeEventListener(input2: Dynamic, options: Dynamic): Dynamic {
        if (input2 === "dom-ready") value.removeEventListener("load", options);
        else if (input2 === "console-message") {
          let entry: Dynamic = entries.get(options);
          entry &&
            ((window as Dynamic).removeEventListener("message", entry),
            entries.delete(options));
        } else value.removeEventListener(input2, options);
      },
    };
  }
  bindRuntimeValue(
    runtime,
    "previewEvaluationRequests",
    () => previewEvaluationRequests,
    (value) => {
      previewEvaluationRequests = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "previewEvaluationSequence",
    () => previewEvaluationSequence,
    (value) => {
      previewEvaluationSequence = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "previewMessageListenerInstalled",
    () => previewMessageListenerInstalled,
    (value) => {
      previewMessageListenerInstalled = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "installPreviewMessageListener",
    () => installPreviewMessageListener,
  );
  bindRuntimeValue(runtime, "createPreviewHandle", () => createPreviewHandle);
  return () => {
    previewEvaluationRequests = new Map();
    previewEvaluationSequence = 0;
    previewMessageListenerInstalled = false;
  };
}
