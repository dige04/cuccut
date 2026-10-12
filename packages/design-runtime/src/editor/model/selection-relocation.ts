/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorModelSelectionRelocation(
  runtime: RuntimeBindings,
): () => void {
  var ModelSelectionRelocationLimit: Dynamic;
  var ModelSelectionRelocationLimit_2: Dynamic;
  var ModelSelectionRelocationImul: Dynamic;
  var ModelSelectionRelocationReplace: Dynamic;
  var ModelSelectionRelocationElementCache: Dynamic;
  var ModelSelectionRelocationConstant: Dynamic;
  var ModelSelectionRelocationMap: Dynamic;
  var ModelSelectionRelocationIncludes: Dynamic;
  function indexModelForRelocation(input?: Dynamic): Dynamic {
    let value: Dynamic = input.elementCount(),
      items: Dynamic = [],
      items2: Dynamic = [],
      items3: Dynamic = [],
      items4: Dynamic = [],
      items5: Dynamic = [],
      items6: Dynamic = [],
      items7: Dynamic = [],
      value2: Dynamic = new Array(value).fill(0);
    for (let index: Dynamic = 0; index < value; index++) {
      let value3: Dynamic = input.parentTid(index),
        value4: Dynamic = input.element(index);
      items.push(value3);
      items2.push(value3 == null ? 0 : items2[value3] + 1);
      items3.push(value4?.tagName ?? "");
      if (value3 != null && !(value3 < index))
        throw new Error(
          "element " +
            index +
            " has parent " +
            value3 +
            ": not numbered in document order",
        );
      let value5: Dynamic = ModelSelectionRelocationReplace(items3[index]);
      for (let value7 of (value4 ? [...value4.attributes] : []) as Dynamic)
        value7.name !== runtime.DcTplAttribute &&
          (value5 +=
            "" +
            ModelSelectionRelocationReplace(value7.name) +
            "=" +
            ModelSelectionRelocationReplace(value7.value));
      let value6: Dynamic = value5;
      items6.push(
        /^(pre|textarea)$/i.test(items3[index]) ||
          (value3 != null && items6[value3]),
      );
      if (value4 && !/^(style|script)$/i.test(items3[index])) {
        let text: Dynamic = "",
          index2: Dynamic = 0,
          callback3: Dynamic = (): Dynamic => {
            let value7: Dynamic = items6[index]
              ? text
              : text.replace(/[ \t\n\f\r]+/g, " ").replace(/^ | $/g, "");
            value7 !== "" &&
              ((value5 += "" + ModelSelectionRelocationReplace(value7)),
              (value6 +=
                "" + ModelSelectionRelocationReplace(value7) + "" + index2));
            text = "";
          };
        for (let value7 of [...value4.childNodes] as Dynamic)
          value7.nodeType === 3
            ? (text += value7.nodeValue ?? "")
            : value7.nodeType === 1 && (callback3(), index2++);
        callback3();
      }
      items4.push(value5);
      items5.push(value6);
      items7.push(items2[index] + "" + value6);
    }
    for (let value3: Dynamic = value - 1; value3 >= 0; value3--) {
      value2[value3] = Math.max(value2[value3], value3 + 1);
      items[value3] != null &&
        (value2[items[value3]] = Math.max(
          value2[items[value3]],
          value2[value3],
        ));
    }
    let entries: Dynamic = new Map(),
      callback: Dynamic = (input2?: Dynamic): Dynamic => {
        let entry: Dynamic = entries.get(input2);
        if (entry == null) {
          entry = "";
          for (let value3: Dynamic = input2; value3 < value2[input2]; value3++)
            entry +=
              items2[value3] - items2[input2] + "" + items5[value3] + "\0";
          entries.set(input2, entry);
        }
        return entry;
      },
      callback2: Dynamic = (input2?: Dynamic): Dynamic => {
        for (let value3: Dynamic = input2; value3 < value2[input2]; value3++)
          if (
            items4[value3] !== ModelSelectionRelocationReplace(items3[value3])
          )
            return false;
        return true;
      },
      entries2: Dynamic = new Map();
    return {
      n: value,
      parent: items,
      depth: items2,
      end: value2,
      own: items4,
      exact: items5,
      key: items7,
      sig: callback,
      bare: callback2,
      withSource: (
        input2?: Dynamic,
        options?: Dynamic,
        context?: Dynamic,
      ): Dynamic => {
        let value3: Dynamic = options + " " + context,
          entry: Dynamic = entries2.get(value3);
        if (!entry) {
          entry = new Map();
          for (let index: Dynamic = 0; index < value; index++) {
            if (value2[index] - index !== context || items3[index] !== options)
              continue;
            let entry2: Dynamic = entry.get(callback(index));
            entry2 ? entry2.push(index) : entry.set(callback(index), [index]);
          }
          entries2.set(value3, entry);
        }
        return entry.get(input2) ?? [];
      },
      tag: (input2?: Dynamic): Dynamic => items3[input2] ?? "",
      kids: (input2?: Dynamic): Dynamic => input.childTids(input2),
    };
  }
  function buildModelSignatureLookup(
    input?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    let entries: Dynamic = new Map();
    return (input2?: Dynamic): Dynamic => {
      if (!entries.has(input2)) {
        let value: Dynamic = input.sig(input2),
          value2: Dynamic =
            (input.bare(input2)
              ? []
              : input.withSource(
                  value,
                  input.tag(input2),
                  input.end[input2] - input2,
                )
            ).length === 1
              ? options.withSource(
                  value,
                  input.tag(input2),
                  input.end[input2] - input2,
                )
              : [];
        entries.set(input2, value2.length === 1 ? value2[0] : null);
      }
      return entries.get(input2);
    };
  }
  function getModelRelocationPair(input?: Dynamic, options?: Dynamic): Dynamic {
    let entry: Dynamic = ModelSelectionRelocationElementCache.get(input);
    if (entry?.nowModel === options) return entry.pair;
    let value: Dynamic = indexModelForRelocation(input),
      value2: Dynamic = indexModelForRelocation(options),
      index: Dynamic = 0;
    for (
      ;
      index < value.n &&
      index < value2.n &&
      value.key[index] === value2.key[index];

    )
      index++;
    let index2: Dynamic = 0;
    for (
      ;
      index2 < value.n &&
      index2 < value2.n &&
      value.key[value.n - 1 - index2] === value2.key[value2.n - 1 - index2];

    )
      index2++;
    let state: Dynamic = {
      prev: value,
      now: value2,
      to: buildModelSignatureLookup(value, value2),
      head: index,
      tail: index2,
    };
    ModelSelectionRelocationElementCache.set(input, {
      nowModel: options,
      pair: state,
    });
    return state;
  }
  function relocateModelElementIds(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    if (input === options) return [...context];
    try {
      let items: Dynamic = [...new Set(context)],
        value: Dynamic = ModelSelectionRelocationMap(
          matchModelElementIds(input, options, items),
        );
      return context.map(
        (input2?: Dynamic): Dynamic => value[items.indexOf(input2)],
      );
    } catch (value: Dynamic) {
      ModelSelectionRelocationConstant++;
      console.warn(
        "[dc-editor] the selection could not be followed, so it is dropped:",
        value,
      );
      return context.map((): Dynamic => null);
    }
  }
  function matchModelElementIds(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    if (
      input.elementCount() > ModelSelectionRelocationLimit ||
      options.elementCount() > ModelSelectionRelocationLimit
    )
      return context.map((): Dynamic => null);
    let {
        prev: value,
        now: value2,
        to: value3,
        head: value4,
        tail: value5,
      }: Dynamic = getModelRelocationPair(input, options),
      value6: Dynamic = value2.n - value.n,
      callback: Dynamic = (
        input2?: Dynamic,
        options2?: Dynamic,
        context2?: Dynamic,
        value7?: Dynamic,
      ): Dynamic => {
        let value8: Dynamic = input2.end[options2] - options2,
          items: Dynamic = [];
        for (
          let value9: Dynamic = value7 + 1;
          value9 + value8 <= context2.end[value7];
          value9++
        ) {
          if (context2.end[value9] - value9 !== value8) continue;
          let flag: Dynamic = true;
          for (let index: Dynamic = 0; flag && index < value8; index++)
            flag =
              context2.exact[value9 + index] ===
                input2.exact[options2 + index] &&
              context2.depth[value9 + index] - context2.depth[value9] ===
                input2.depth[options2 + index] - input2.depth[options2];
          flag && items.push(value9);
        }
        return items;
      },
      entries: Dynamic = new Map(),
      callback2: Dynamic = (input2?: Dynamic): Dynamic => (
        entries.has(input2) || entries.set(input2, callback3(input2)),
        entries.get(input2)
      ),
      callback3: Dynamic = (input2?: Dynamic): Dynamic => {
        if (
          !(
            input2 <= value4 &&
            value.n - value.end[input2] <= value5 &&
            input2 < value2.n &&
            value2.depth[input2] === value.depth[input2] &&
            value2.end[input2] === value2.n - (value.n - value.end[input2])
          )
        )
          return null;
        let value7: Dynamic = value2.own[input2] === value.own[input2],
          value8: Dynamic = callback(value, input2, value2, input2);
        if (value8.length > 0)
          return value8.length === 1 && !value7 && !value.bare(input2)
            ? value8[0]
            : null;
        if (
          value2.tag(input2) !== value.tag(input2) ||
          callback(value2, input2, value, input2).length > 0
        )
          return null;
        for (
          let value9: Dynamic = input2 + 1;
          value9 < value2.end[input2];
          value9++
        )
          if (
            value2.own[value9] === value.own[input2] &&
            !(value9 < value4 || value9 >= value2.n - value5)
          )
            return null;
        if (!value7) {
          for (
            let value9: Dynamic = input2 + 1;
            value9 < value.end[input2];
            value9++
          )
            if (
              value.own[value9] === value2.own[input2] &&
              !(value9 >= value.n - value5)
            )
              return null;
        }
        return input2;
      },
      callback4: Dynamic = (input2?: Dynamic): Dynamic => {
        if (
          value.end[input2] <= value4 &&
          value2.end[input2] === value.end[input2]
        )
          return input2;
        if (value.n - input2 > value5) return null;
        for (
          let value7: Dynamic = value.parent[input2];
          value7 != null;
          value7 = value.parent[value7]
        )
          if (!(value7 >= value.n - value5 || callback2(value7) === value7))
            return null;
        return input2 + value6;
      },
      callback5: Dynamic = (input2?: Dynamic): Dynamic => {
        for (
          let value7: Dynamic = input2;
          value7 != null;
          value7 = value.parent[value7]
        )
          if (value.kids(value7).length >= 2 && value3(value7) != null)
            return value3(value7) + (input2 - value7);
        return null;
      };
    return context.map((input2?: Dynamic): Dynamic => {
      if (!(input2 >= 0 && input2 < value.n)) return null;
      let value7: Dynamic =
        callback4(input2) ?? callback5(input2) ?? callback2(input2);
      return value7 != null &&
        /^(style|script)$/i.test(value.tag(input2)) &&
        input.element(input2)?.textContent !==
          options.element(value7)?.textContent
        ? null
        : value7;
    });
  }
  function unchangedAncestorRelocation(
    { prev: prev, now: now }: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    let callback: Dynamic = (input?: Dynamic): Dynamic =>
        prev.withSource(
          prev.sig(input),
          prev.tag(input),
          prev.end[input] - input,
        ).length === 1,
      value: Dynamic = prev.parent[options] ?? null;
    for (
      ;
      value !== null && (prev.kids(value).length < 2 || !callback(value));

    )
      value = prev.parent[value] ?? null;
    let value2: Dynamic = value ?? options;
    return (
      callback(value2) &&
      value2 < now.n &&
      prev.depth[value2] === now.depth[value2] &&
      prev.sig(value2) === now.sig(value2)
    );
  }
  function hasSameModelPrefix(
    { prev: prev, now: now }: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    if (options >= now.n) return false;
    let values: Dynamic = new Set(
      prev.own.map(ModelSelectionRelocationIncludes),
    );
    for (let index: Dynamic = 0; index <= options; index++) {
      if (
        prev.depth[index] !== now.depth[index] ||
        prev.tag(index) !== now.tag(index)
      )
        return false;
      let value: Dynamic = ModelSelectionRelocationIncludes(now.own[index]);
      if (
        value !== "" &&
        value !== ModelSelectionRelocationIncludes(prev.own[index]) &&
        values.has(value)
      )
        return false;
    }
    return true;
  }
  function relocateTextElementId(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    try {
      if (
        Math.max(input.elementCount(), options.elementCount()) >
        ModelSelectionRelocationLimit
      )
        return null;
      ModelSelectionRelocationElementCache.delete(input);
      let value: Dynamic = getModelRelocationPair(input, options);
      return Number.isInteger(context) && context >= 0 && context < value.prev.n
        ? unchangedAncestorRelocation(value, context)
          ? context
          : (relocateModelElementIds(input, options, [context])[0] ??
            value.to(context) ??
            (hasSameModelPrefix(value, context) ? context : null))
        : null;
    } catch (value: Dynamic) {
      ModelSelectionRelocationConstant++;
      console.warn(
        "[dc-editor] could not work out where the typed text belongs, so it is treated as having no certain place:",
        value,
      );
      return null;
    }
  }
  function relocateTextEditTarget(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value: Dynamic = (input2?: Dynamic, options2?: Dynamic): Dynamic =>
      input2.isTextEditable(options2),
  ): Dynamic {
    let value2: Dynamic = input
      ? relocateTextElementId(input, options, context)
      : context;
    return input && (value2 === null || !value(options, value2))
      ? {
          into: input,
          tid: context,
        }
      : {
          into: options,
          tid: value2 ?? context,
        };
  }
  function relocateSingleElementId(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    return input
      ? (ModelSelectionRelocationElementCache.delete(input),
        relocateModelElementIds(input, options, [context])[0] ?? null)
      : context;
  }
  function relocateSelectedTextElement(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
  ): Dynamic {
    let value2: Dynamic =
      value === null ? null : relocateTextEditTarget(input, options, value);
    if (value2 && value === context)
      return value2.into === options ? value2.tid : null;
    let value3: Dynamic = relocateSingleElementId(input, options, context);
    return value3 !== null &&
      value2?.into === options &&
      !options.element(value3)?.contains(options.element(value2.tid) ?? null)
      ? null
      : value3;
  }
  function relocateSelectionRef(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
  ): Dynamic {
    let current: Dynamic = input.current;
    if (current?.name !== options || context === value) return;
    let value2: Dynamic = context
      ? relocateModelElementIds(context, value, current.tids).filter(
          (input2?: Dynamic): Dynamic => input2 != null,
        )
      : [];
    input.current =
      value2.length > 0
        ? {
            ...current,
            tids: value2,
          }
        : null;
    return input.current;
  }
  function latestSelectionSequence(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    return options?.seq === context ? options : input;
  }
  function isOtherSelection(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    return (
      input === null ||
      (input.name === options &&
        !(input.tids.length === 1 && input.tids[0] === context))
    );
  }
  function deferSelectionClear(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
  ): Dynamic {
    let callback: Dynamic = (input2?: Dynamic): Dynamic => {
      input2 !== options ||
        input.current !== callback ||
        ((input.current = null), context());
    };
    input.current = callback;
    value != null && setTimeout((): Dynamic => callback(options), value);
  }
  function modelSelectionIdentityGuard(
    input?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    let value: Dynamic = options.map(
      (input2?: Dynamic): Dynamic => input.element(input2),
    );
    return (input2?: Dynamic): Dynamic =>
      input2 === input &&
      options.every(
        (input3?: Dynamic, options2?: Dynamic): Dynamic =>
          input.element(input3) === value[options2],
      );
  }
  bindRuntimeValue(
    runtime,
    "ModelSelectionRelocationLimit",
    () => ModelSelectionRelocationLimit,
    (value) => {
      ModelSelectionRelocationLimit = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ModelSelectionRelocationLimit_2",
    () => ModelSelectionRelocationLimit_2,
    (value) => {
      ModelSelectionRelocationLimit_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ModelSelectionRelocationImul",
    () => ModelSelectionRelocationImul,
    (value) => {
      ModelSelectionRelocationImul = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ModelSelectionRelocationReplace",
    () => ModelSelectionRelocationReplace,
    (value) => {
      ModelSelectionRelocationReplace = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "indexModelForRelocation",
    () => indexModelForRelocation,
  );
  bindRuntimeValue(
    runtime,
    "buildModelSignatureLookup",
    () => buildModelSignatureLookup,
  );
  bindRuntimeValue(
    runtime,
    "ModelSelectionRelocationElementCache",
    () => ModelSelectionRelocationElementCache,
    (value) => {
      ModelSelectionRelocationElementCache = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "getModelRelocationPair",
    () => getModelRelocationPair,
  );
  bindRuntimeValue(
    runtime,
    "ModelSelectionRelocationConstant",
    () => ModelSelectionRelocationConstant,
    (value) => {
      ModelSelectionRelocationConstant = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ModelSelectionRelocationMap",
    () => ModelSelectionRelocationMap,
    (value) => {
      ModelSelectionRelocationMap = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "relocateModelElementIds",
    () => relocateModelElementIds,
  );
  bindRuntimeValue(runtime, "matchModelElementIds", () => matchModelElementIds);
  bindRuntimeValue(
    runtime,
    "ModelSelectionRelocationIncludes",
    () => ModelSelectionRelocationIncludes,
    (value) => {
      ModelSelectionRelocationIncludes = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "unchangedAncestorRelocation",
    () => unchangedAncestorRelocation,
  );
  bindRuntimeValue(runtime, "hasSameModelPrefix", () => hasSameModelPrefix);
  bindRuntimeValue(
    runtime,
    "relocateTextElementId",
    () => relocateTextElementId,
  );
  bindRuntimeValue(
    runtime,
    "relocateTextEditTarget",
    () => relocateTextEditTarget,
  );
  bindRuntimeValue(
    runtime,
    "relocateSingleElementId",
    () => relocateSingleElementId,
  );
  bindRuntimeValue(
    runtime,
    "relocateSelectedTextElement",
    () => relocateSelectedTextElement,
  );
  bindRuntimeValue(runtime, "relocateSelectionRef", () => relocateSelectionRef);
  bindRuntimeValue(
    runtime,
    "latestSelectionSequence",
    () => latestSelectionSequence,
  );
  bindRuntimeValue(runtime, "isOtherSelection", () => isOtherSelection);
  bindRuntimeValue(runtime, "deferSelectionClear", () => deferSelectionClear);
  bindRuntimeValue(
    runtime,
    "modelSelectionIdentityGuard",
    () => modelSelectionIdentityGuard,
  );
  return () => {
    ModelSelectionRelocationLimit = 2e4;
    ModelSelectionRelocationLimit_2 = 1024;
    ModelSelectionRelocationImul = (items?: Dynamic): Dynamic => {
      let count: Dynamic = 2166136261;
      for (let index: Dynamic = 0; index < items.length; index++)
        count = Math.imul(count ^ items.charCodeAt(index), 16777619);
      return "\\#" + items.length + "#" + (count >>> 0).toString(36);
    };
    ModelSelectionRelocationReplace = (items?: Dynamic): Dynamic =>
      items.length > ModelSelectionRelocationLimit_2
        ? ModelSelectionRelocationImul(items)
        : items.replace(
            /[\u0000-\u0004\\]/g,
            (input?: Dynamic): Dynamic => "\\" + input.charCodeAt(0),
          );
    ModelSelectionRelocationElementCache = new WeakMap();
    ModelSelectionRelocationConstant = 0;
    ModelSelectionRelocationMap = (input?: Dynamic): Dynamic =>
      input.map(
        (input2?: Dynamic): Dynamic =>
          input2 != null && input.indexOf(input2) !== input.lastIndexOf(input2)
            ? null
            : input2,
      );
    ModelSelectionRelocationIncludes = (input?: Dynamic): Dynamic =>
      input.includes("") ? input.slice(input.indexOf("")) : "";
  };
}
