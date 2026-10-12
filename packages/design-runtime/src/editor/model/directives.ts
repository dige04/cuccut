/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorModelDirectives(
  runtime: RuntimeBindings,
): () => void {
  function buildDirectiveMap(input?: Dynamic): Dynamic {
    let callback: Dynamic = (input2?: Dynamic): Dynamic =>
        input2 === "sc-if" || input2 === "sc-for",
      callback2: Dynamic = (input2?: Dynamic): Dynamic =>
        input2.flatMap(
          (input3?: Dynamic): Dynamic =>
            callback(input3.tag) ? callback2(input3.children) : [input3.tid],
        ),
      state: Dynamic = {},
      callback3: Dynamic = (input2?: Dynamic, options?: Dynamic): Dynamic => {
        for (let value of input2 as Dynamic) {
          if (callback(value.tag)) {
            let value2: Dynamic = callback2(value.children);
            value2.length > 0 &&
              (state[value.tid] = {
                kind: value.tag === "sc-if" ? "if" : "for",
                kids: value2,
                countKids: options
                  ? []
                  : value.children
                      .filter(
                        (input3?: Dynamic): Dynamic => !callback(input3.tag),
                      )
                      .map((input3?: Dynamic): Dynamic => input3.tid),
              });
          }
          callback3(value.children, options || value.tag === "sc-for");
        }
      };
    callback3(input, false);
    return state;
  }
  bindRuntimeValue(runtime, "buildDirectiveMap", () => buildDirectiveMap);
  return () => {};
}
