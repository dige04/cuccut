/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorOutlineTree(runtime: RuntimeBindings): () => void {
  var OutlineTreeHandler: Dynamic;
  var OutlineTreeHandler_2: Dynamic;
  var OutlineTreeHandler_3: Dynamic;
  var OutlineTreeMatches: Dynamic;
  function flattenOutlineRows(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    let items: Dynamic = [],
      callback: Dynamic = (
        input2?: Dynamic,
        options2?: Dynamic,
        context2?: Dynamic,
        value?: Dynamic,
      ): Dynamic => {
        let value2: Dynamic = context(value);
        for (let value3 of input2 as Dynamic) {
          let value4: Dynamic = OutlineTreeHandler_3(value, value3.tid),
            value5: Dynamic = value3.children.length > 0,
            value6: Dynamic = value5 && value2.has(value3.tid);
          items.push({
            key: value4,
            level: options2,
            parentKey: context2,
            file: value,
            tid: value3.tid,
            expandable: value5,
            open: value6,
          });
          value6 && callback(value3.children, options2 + 1, value4, value);
        }
      };
    if (!options) {
      callback(input, 1, null, null);
      return items;
    }
    for (let value of options.objects as Dynamic)
      items.push({
        key: OutlineTreeHandler_2(value.id),
        level: 1,
        parentKey: null,
        file: null,
        tid: null,
        object: value.id,
        expandable: false,
        open: false,
      });
    for (let value of options.rows as Dynamic) {
      let value2: Dynamic =
          value.file === options.focused ? input : options.trees[value.file],
        value3: Dynamic = value2 != null && value2.length > 0,
        value4: Dynamic = value3 && options.open.has(value.file),
        value5: Dynamic = OutlineTreeHandler(value.file);
      items.push({
        key: value5,
        level: 1,
        parentKey: null,
        file: value.file,
        tid: null,
        expandable: value3,
        open: value4,
      });
      value4 && callback(value2, 2, value5, value.file);
    }
    return items;
  }
  function scrollOutlineRowIntoView(
    input?: Dynamic,
    options?: Dynamic,
    context: Dynamic = false,
  ): Dynamic {
    if (!input) return false;
    let bounds: Dynamic = options.getBoundingClientRect(),
      bounds2: Dynamic = input.getBoundingClientRect(),
      value: Dynamic =
        bounds.top < bounds2.top
          ? bounds.top - bounds2.top
          : bounds.bottom > bounds2.bottom
            ? bounds.bottom - bounds2.bottom
            : 0;
    return value === 0
      ? false
      : (context && !OutlineTreeMatches() && typeof input.scrollTo == "function"
          ? input.scrollTo({
              top: input.scrollTop + value,
              behavior: "smooth",
            })
          : (input.scrollTop += value),
        true);
  }
  function outlineAncestorMap(input?: Dynamic): Dynamic {
    let entries: Dynamic = new Map(),
      callback: Dynamic = (input2?: Dynamic, options?: Dynamic): Dynamic => {
        entries.set(input2.tid, options);
        for (let value of input2.children as Dynamic)
          callback(value, [...options, input2.tid]);
      };
    for (let value of input as Dynamic) callback(value, []);
    return entries;
  }
  function isOutlineRowTarget(input?: Dynamic): Dynamic {
    return (
      input.closest('[data-testid="dc-outline"] [role="treeitem"]') != null &&
      input.closest("button, input") == null
    );
  }
  bindRuntimeValue(
    runtime,
    "OutlineTreeHandler",
    () => OutlineTreeHandler,
    (value) => {
      OutlineTreeHandler = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "OutlineTreeHandler_2",
    () => OutlineTreeHandler_2,
    (value) => {
      OutlineTreeHandler_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "OutlineTreeHandler_3",
    () => OutlineTreeHandler_3,
    (value) => {
      OutlineTreeHandler_3 = value;
    },
  );
  bindRuntimeValue(runtime, "flattenOutlineRows", () => flattenOutlineRows);
  bindRuntimeValue(
    runtime,
    "OutlineTreeMatches",
    () => OutlineTreeMatches,
    (value) => {
      OutlineTreeMatches = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "scrollOutlineRowIntoView",
    () => scrollOutlineRowIntoView,
  );
  bindRuntimeValue(runtime, "outlineAncestorMap", () => outlineAncestorMap);
  bindRuntimeValue(runtime, "isOutlineRowTarget", () => isOutlineRowTarget);
  return () => {
    OutlineTreeHandler = (input?: Dynamic): Dynamic => `ab:${input}`;
    OutlineTreeHandler_2 = (input?: Dynamic): Dynamic => `ob:${input}`;
    OutlineTreeHandler_3 = (input?: Dynamic, options?: Dynamic): Dynamic =>
      `el:${input ?? ""}:${options}`;
    OutlineTreeMatches = (): Dynamic =>
      typeof matchMedia == "function" &&
      matchMedia("(prefers-reduced-motion: reduce)").matches;
  };
}
