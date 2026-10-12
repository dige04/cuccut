/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorModelThreeWayMerge(
  runtime: RuntimeBindings,
): () => void {
  var ModelThreeWayMergeSCRIPTSTYLETEXTAREASet: Dynamic;
  var classifyThreeWayChange: Dynamic;
  function describeMergeField(source?: Dynamic): Dynamic {
    return source.kind === "text"
      ? "the text of " + (0, runtime.ModelPublishingHandler)(source.tag)
      : source.kind === "props-key"
        ? "the \u201C" + source.name + "\u201D setting"
        : "the " +
          source.name.replace(/^style:/, "") +
          " of " +
          (0, runtime.ModelPublishingHandler)(source.tag);
  }
  function sameModelStructure(input?: Dynamic, options?: Dynamic): Dynamic {
    if (!input.sameSkeleton(options)) return false;
    let value: Dynamic = input.elementCount();
    for (let index: Dynamic = 0; index < value; index++)
      if (input.parentTid(index) !== options.parentTid(index)) return false;
    return true;
  }
  function elementAttributeMap(input?: Dynamic): Dynamic {
    let entries: Dynamic = new Map();
    for (let value of [...input.attributes] as Dynamic)
      value.name !== runtime.DcTplAttribute &&
        value.name !== "style" &&
        entries.set(value.name, value.value);
    return entries;
  }
  function elementStyleMap(element?: Dynamic): Dynamic {
    let entries: Dynamic = new Map();
    for (let value of (0, runtime.parseStyleDeclarations)(
      element.getAttribute("style"),
    ) as Dynamic)
      entries.set(value.prop, value.value);
    return entries;
  }
  function elementTextSlots(input?: Dynamic): Dynamic {
    let items: Dynamic = [""];
    for (let value of [...input.childNodes] as Dynamic)
      value.nodeType === 1
        ? items.push("")
        : value.nodeType === 3 &&
          (items[items.length - 1] += value.nodeValue ?? "");
    return items;
  }
  function replaceElementTextSlot(
    element?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    let index: Dynamic = 0,
      flag: Dynamic = false;
    for (let value of [...element.childNodes] as Dynamic) {
      if (value.nodeType === 1) {
        index === options &&
          !flag &&
          context !== "" &&
          (element.insertBefore(
            element.ownerDocument.createTextNode(context),
            value,
          ),
          (flag = true));
        index += 1;
        continue;
      }
      value.nodeType !== 3 ||
        index !== options ||
        (!flag && context !== ""
          ? ((value.nodeValue = context), (flag = true))
          : value.remove());
    }
    !flag &&
      context !== "" &&
      index === options &&
      element.appendChild(element.ownerDocument.createTextNode(context));
  }
  function mergeDcTemplates(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
  ): Dynamic {
    let items: Dynamic = [],
      items2: Dynamic = [],
      state: Dynamic = {
        baseTheirs: false,
        baseMine: false,
      },
      callback: Dynamic = (input2?: Dynamic): Dynamic => ({
        ok: false,
        why: input2,
        applied: [],
        overlaps: [],
        guard: state,
      });
    try {
      if (options === input)
        return {
          ok: true,
          merged: context,
          applied: items,
          overlaps: items2,
          guard: {
            baseTheirs: true,
            baseMine: true,
          },
        };
      if (context === input || context === options)
        return {
          ok: true,
          merged: options,
          applied: items,
          overlaps: items2,
          guard: {
            baseTheirs: true,
            baseMine: true,
          },
        };
      let value2: Dynamic = new runtime.DcEditorModel(input, value),
        value3: Dynamic = new runtime.DcEditorModel(options, value),
        value4: Dynamic = new runtime.DcEditorModel(context, value);
      state.baseTheirs = sameModelStructure(value2, value4);
      state.baseMine = sameModelStructure(value2, value3);
      if (!state.baseTheirs)
        return callback(
          "their version added, removed, moved or retagged elements",
        );
      if (!state.baseMine)
        return callback("my edit added, removed, moved or retagged elements");
      if (
        value2.rootText() !== value3.rootText() &&
        value2.rootText() !== value4.rootText() &&
        value3.rootText() !== value4.rootText()
      )
        return callback("both sides changed text at the template root");
      let value5: Dynamic = value2.elementCount();
      for (let index: Dynamic = 0; index < value5; index++) {
        let value7: Dynamic = value2.element(index),
          value8: Dynamic = value3.element(index),
          value9: Dynamic = value4.element(index),
          value10: Dynamic = value7.tagName.toLowerCase(),
          value11: Dynamic = elementAttributeMap(value7),
          value12: Dynamic = elementAttributeMap(value8),
          value13: Dynamic = elementAttributeMap(value9);
        for (let value20 of new Set([
          ...value11.keys(),
          ...value12.keys(),
        ]) as Dynamic) {
          let value21: Dynamic = value11.get(value20) ?? null,
            value22: Dynamic = value12.get(value20) ?? null,
            value23: Dynamic = value13.get(value20) ?? null;
          if (value21 === value22 || value22 === value23) continue;
          let state2: Dynamic = {
            tid: index,
            tag: value10,
            kind: "attr",
            name: value20,
            from: value21,
            to: value22,
          };
          value23 !== value21 &&
            items2.push({
              ...state2,
              theirs: value23,
            });
          value22 === null
            ? value9.removeAttribute(value20)
            : value9.setAttribute(value20, value22);
          items.push(state2);
        }
        let value14: Dynamic = elementStyleMap(value7),
          value15: Dynamic = elementStyleMap(value8),
          value16: Dynamic = elementStyleMap(value9);
        for (let value20 of new Set([
          ...value14.keys(),
          ...value15.keys(),
        ]) as Dynamic) {
          let value21: Dynamic = value14.get(value20) ?? null,
            value22: Dynamic = value15.get(value20) ?? null,
            value23: Dynamic = value16.get(value20) ?? null;
          if (value21 === value22 || value22 === value23) continue;
          let state2: Dynamic = {
            tid: index,
            tag: value10,
            kind: "style",
            name: value20,
            from: value21,
            to: value22,
          };
          value23 !== value21 &&
            items2.push({
              ...state2,
              theirs: value23,
            });
          value4.setStyleProperty(index, value20, value22);
          items.push(state2);
        }
        let value17: Dynamic = elementTextSlots(value7),
          value18: Dynamic = elementTextSlots(value8),
          value19: Dynamic = elementTextSlots(value9);
        if (
          value17.length !== value18.length ||
          value17.length !== value19.length
        )
          return callback(
            "text and elements are interleaved differently in <" +
              value10 +
              ">",
          );
        for (let index2: Dynamic = 0; index2 < value17.length; index2++) {
          if (
            value17[index2] === value18[index2] ||
            value18[index2] === value19[index2]
          )
            continue;
          if (
            ModelThreeWayMergeSCRIPTSTYLETEXTAREASet.has(value7.tagName) &&
            value19[index2] !== value17[index2]
          )
            return callback("both sides rewrote the <" + value10 + "> body");
          let state2: Dynamic = {
            tid: index,
            tag: value10,
            kind: "text",
            name: String(index2),
            from: value17[index2],
            to: value18[index2],
          };
          value19[index2] !== value17[index2] &&
            items2.push({
              ...state2,
              theirs: value19[index2],
            });
          replaceElementTextSlot(value9, index2, value18[index2]);
          items.push(state2);
        }
      }
      let value6: Dynamic = value4.serialize();
      value3.rootText() !== value2.rootText() &&
        value4.rootText() === value2.rootText() &&
        items.length === 0 &&
        (value6 = options);
      return {
        ok: true,
        merged: value6,
        applied: items,
        overlaps: items2,
        guard: state,
      };
    } catch (value2: Dynamic) {
      return callback(
        "the merge threw: " +
          (value2 instanceof Error ? value2.message : String(value2)),
      );
    }
  }
  function splitDcDocumentRegions(input?: Dynamic): Dynamic {
    let value: Dynamic = (0, runtime.parseDcHtmlDocument)(input);
    if (!value) return null;
    let value2: Dynamic = (0, runtime.getDcPropsJson)(input),
      value3: Dynamic = (0, runtime.replaceDcTemplate)(input, value, ""),
      value4: Dynamic = (0, runtime.parseDcHtmlDocument)(value3);
    value4?.jsMatch && (value3 = (0, runtime.setDcScript)(value3, value4, ""));
    value2 !== null &&
      (value3 = (0, runtime.setDcPropsJson)(value3, "{}") ?? value3);
    return {
      template: value.template,
      js: value.js,
      props: value2,
      outer: value3,
    };
  }
  function mergeDcProps(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
    extra?: Dynamic,
  ): Dynamic {
    let callback: Dynamic = (input2?: Dynamic): Dynamic => {
        if (input2 === null) return {};
        try {
          let value5: Dynamic = JSON.parse(input2);
          return value5 !== null &&
            typeof value5 == "object" &&
            !Array.isArray(value5)
            ? value5
            : null;
        } catch {
          return null;
        }
      },
      value2: Dynamic = callback(input),
      value3: Dynamic = callback(options),
      value4: Dynamic = callback(context);
    if (value2 === null || value3 === null || value4 === null) return;
    let callback2: Dynamic = (input2?: Dynamic): Dynamic =>
        input2 === undefined ? null : JSON.stringify(input2),
      state: Dynamic = {
        ...value4,
      };
    for (let value5 of new Set([
      ...Object.keys(value2),
      ...Object.keys(value3),
    ]) as Dynamic) {
      let value6: Dynamic = callback2(value2[value5]),
        value7: Dynamic = callback2(value3[value5]),
        value8: Dynamic = callback2(value4[value5]);
      if (value6 === value7 || value7 === value8) continue;
      let state2: Dynamic = {
        tid: -1,
        tag: "script",
        kind: "props-key",
        name: value5,
        from: value6,
        to: value7,
      };
      value8 !== value6 &&
        extra.push({
          ...state2,
          theirs: value8,
        });
      value7 === null ? delete state[value5] : (state[value5] = value3[value5]);
      value.push(state2);
    }
    return JSON.stringify(state);
  }
  function mergeDcDocuments(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    let state: Dynamic = {
        template: "same",
        script: "same",
        outer: "same",
      },
      callback: Dynamic = (input2?: Dynamic, options2?: Dynamic): Dynamic => ({
        ok: false,
        why: input2,
        applied: [],
        overlaps: [],
        guard: {
          baseTheirs: false,
          baseMine: false,
        },
        ...options2,
        regions: state,
      });
    try {
      if (options === input || options === context)
        return {
          ok: true,
          merged: context,
          applied: [],
          overlaps: [],
          guard: {
            baseTheirs: true,
            baseMine: true,
          },
          regions: {
            template: "theirs",
            script: "theirs",
            outer: "theirs",
          },
        };
      if (context === input)
        return {
          ok: true,
          merged: options,
          applied: [],
          overlaps: [],
          guard: {
            baseTheirs: true,
            baseMine: true,
          },
          regions: {
            template: "mine",
            script: "mine",
            outer: "mine",
          },
        };
      let value: Dynamic = splitDcDocumentRegions(input),
        value2: Dynamic = splitDcDocumentRegions(options),
        value3: Dynamic = splitDcDocumentRegions(context);
      if (!value || !value2 || !value3)
        return callback("not a parseable .dc.html on every side");
      let items: Dynamic = [],
        items2: Dynamic = [],
        state2: Dynamic = {
          baseTheirs: true,
          baseMine: true,
        },
        value4: Dynamic = classifyThreeWayChange(
          value.js,
          value2.js,
          value3.js,
        );
      if (value4 === "both")
        return callback("both sides rewrote the logic script");
      state.script = value4;
      let value5: Dynamic = classifyThreeWayChange(
        value.outer,
        value2.outer,
        value3.outer,
      );
      if (value5 === "both")
        return callback(
          "both sides changed the document outside the template (head or script tag)",
        );
      let value6: Dynamic = classifyThreeWayChange(
          value.props,
          value2.props,
          value3.props,
        ),
        value7: Dynamic = value6 === "mine" ? value2.props : value3.props;
      if (
        value6 === "both" &&
        ((value7 = mergeDcProps(
          value.props,
          value2.props,
          value3.props,
          items,
          items2,
        )),
        value7 === undefined)
      )
        return callback(
          "both sides changed data-props and one of them is not a JSON object",
        );
      state.outer =
        value6 === "both"
          ? "merged"
          : value5 === "same"
            ? value6 === "same"
              ? "same"
              : value6
            : value5 === value6 || value6 === "same"
              ? value5
              : "merged";
      let template: Dynamic = value3.template,
        value8: Dynamic = classifyThreeWayChange(
          value.template,
          value2.template,
          value3.template,
        );
      state.template = value8 === "both" ? "merged" : value8;
      if (value8 === "mine") template = value2.template;
      else if (value8 === "both") {
        let value14: Dynamic = mergeDcTemplates(
          value.template,
          value2.template,
          value3.template,
        );
        state2 = value14.guard;
        if (!value14.ok || value14.merged === undefined)
          return callback(value14.why ?? "the template could not be merged", {
            guard: state2,
          });
        template = value14.merged;
        items.push(...value14.applied);
        items2.push(...value14.overlaps);
      }
      let value9: Dynamic = value5 === "mine" ? options : context,
        value10: Dynamic = (0, runtime.parseDcHtmlDocument)(value9);
      if (!value10) return callback("the kept document did not parse");
      value9 = (0, runtime.replaceDcTemplate)(value9, value10, template);
      let value11: Dynamic = value4 === "mine" ? value2.js : value3.js,
        value12: Dynamic = (0, runtime.parseDcHtmlDocument)(value9);
      if (!value12) return callback("the composed document did not parse");
      value12.js !== value11 &&
        (value9 = (0, runtime.setDcScript)(value9, value12, value11));
      (0, runtime.getDcPropsJson)(value9) !== (value7 ?? null) &&
        value7 !== null &&
        value7 !== undefined &&
        (value9 = (0, runtime.setDcPropsJson)(value9, value7) ?? value9);
      let value13: Dynamic = splitDcDocumentRegions(value9);
      return !value13 || value13.template !== template || value13.js !== value11
        ? callback("the composed document did not round-trip")
        : {
            ok: true,
            merged: value9,
            applied: items,
            overlaps: items2,
            guard: state2,
            regions: state,
          };
    } catch (value: Dynamic) {
      return callback(
        "the merge threw: " +
          (value instanceof Error ? value.message : String(value)),
      );
    }
  }
  bindRuntimeValue(runtime, "describeMergeField", () => describeMergeField);
  bindRuntimeValue(runtime, "sameModelStructure", () => sameModelStructure);
  bindRuntimeValue(runtime, "elementAttributeMap", () => elementAttributeMap);
  bindRuntimeValue(runtime, "elementStyleMap", () => elementStyleMap);
  bindRuntimeValue(runtime, "elementTextSlots", () => elementTextSlots);
  bindRuntimeValue(
    runtime,
    "replaceElementTextSlot",
    () => replaceElementTextSlot,
  );
  bindRuntimeValue(
    runtime,
    "ModelThreeWayMergeSCRIPTSTYLETEXTAREASet",
    () => ModelThreeWayMergeSCRIPTSTYLETEXTAREASet,
    (value) => {
      ModelThreeWayMergeSCRIPTSTYLETEXTAREASet = value;
    },
  );
  bindRuntimeValue(runtime, "mergeDcTemplates", () => mergeDcTemplates);
  bindRuntimeValue(
    runtime,
    "splitDcDocumentRegions",
    () => splitDcDocumentRegions,
  );
  bindRuntimeValue(
    runtime,
    "classifyThreeWayChange",
    () => classifyThreeWayChange,
    (value) => {
      classifyThreeWayChange = value;
    },
  );
  bindRuntimeValue(runtime, "mergeDcProps", () => mergeDcProps);
  bindRuntimeValue(runtime, "mergeDcDocuments", () => mergeDcDocuments);
  return () => {
    ModelThreeWayMergeSCRIPTSTYLETEXTAREASet = new Set([
      "SCRIPT",
      "STYLE",
      "TEXTAREA",
      "TITLE",
    ]);
    classifyThreeWayChange = (
      input?: Dynamic,
      options?: Dynamic,
      context?: Dynamic,
    ): Dynamic =>
      options === context
        ? options === input
          ? "same"
          : "theirs"
        : options === input
          ? "theirs"
          : context === input
            ? "mine"
            : "both";
  };
}
