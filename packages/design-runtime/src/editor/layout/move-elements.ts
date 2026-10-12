/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorLayoutMoveElements(
  runtime: RuntimeBindings,
): () => void {
  var LayoutMoveElementsLeftRightTopConfig: Dynamic;
  var LayoutMoveElementsGetAttribute: Dynamic;
  function freezeInheritedTextStyle(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    let entries: Dynamic = new Map();
    for (let [value, value2] of (0, runtime.normalizeTextStyleSnapshot)(
      context,
    ) as Dynamic)
      input.hasAuthoredStyle(options, value) ||
        (input.setStyleProperty(options, value, value2),
        entries.set(value, value2));
    return entries;
  }
  function displacedDropFollowers(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
    extra?: Dynamic,
  ): Dynamic {
    let items: Dynamic = [];
    for (let value2 of options as Dynamic) {
      let value3: Dynamic = input.element(value2.tid);
      if (
        !value3 ||
        value2.tid === context ||
        (0, runtime.containsUneditableSelection)(input, [value2.tid]) ||
        input.isWithin(context, value2.tid)
      )
        continue;
      let value4: Dynamic = input.parentTid(value2.tid);
      if (value == null) {
        if (value4 != null && !input.moveRelative(value2.tid, null, "root-end"))
          continue;
      } else if (
        value4 !== value &&
        (input.isWithin(value2.tid, value) ||
          !input.moveRelative(value2.tid, value, "into"))
      )
        continue;
      let value5: Dynamic = input.inlineStyleValue(value2.tid, "position");
      value5 !== "absolute" &&
        value5 !== "fixed" &&
        input.setStyleProperty(value2.tid, "position", "absolute");
      for (let [value7, value8] of Object.entries(value2.absStyles) as Dynamic)
        if (value7 !== "position") {
          input.setStyleProperty(value2.tid, value7, value8);
          for (let value9 of (LayoutMoveElementsLeftRightTopConfig[value7] ??
            []) as Dynamic)
            input.setStyleProperty(value2.tid, value9, null);
        }
      let value6: Dynamic =
        input.parentTid(value2.tid) !== value4
          ? freezeInheritedTextStyle(input, value2.tid, value2.freezeStyle)
          : new Map();
      extra &&
        input.setAttribute(
          value2.tid,
          "data-dc-drag-follower",
          String(value2.tid),
        );
      items.push({
        el: value3,
        pinned: value6,
        freezeStyle: value2.freezeStyle,
      });
    }
    return items;
  }
  function sameParentDropGroup(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    let value: Dynamic = input.parentTid(options);
    if (!context?.length || value == null) return null;
    let value2: Dynamic = context
      .map((input2?: Dynamic): Dynamic => input2.tid)
      .filter(
        (input2?: Dynamic): Dynamic =>
          input2 !== options &&
          input.parentTid(input2) === value &&
          !input.isUneditable(input2) &&
          !(0, runtime.containsUneditableSelection)(input, [input2]),
      );
    return value2.length > 0 ? [options, ...value2] : null;
  }
  function elementMoveRefusal(input?: Dynamic, options?: Dynamic): Dynamic {
    if (
      options.absolute &&
      options.breakout !== true &&
      !options.alt &&
      options.previewBlock === true
    )
      return "preview-block";
    let value: Dynamic = input.element(options.tid);
    if (!value) return "missing";
    if (options.targetTid != null && !input.element(options.targetTid))
      return "target-missing";
    if (
      (0, runtime.containsUneditableSelection)(input, [options.tid]) ||
      (options.targetTid != null &&
        (0, runtime.containsUneditableSelection)(input, [options.targetTid]))
    )
      return "loop-driven";
    if (input.targetParentLocked(options.targetTid, options.position))
      return "locked-parent";
    if (
      options.targetTid != null &&
      !options.alt &&
      input.isWithin(options.tid, options.targetTid) &&
      options.position === "into"
    )
      return "no-op";
    if (options.alt && !value.parentNode) return "no-parent";
    if (!options.absolute && !options.alt) {
      if (
        options.block
          ? input.isBlockInPlace(
              options.block,
              options.targetTid,
              options.position,
            )
          : input.isInPlace(options.tid, options.targetTid, options.position)
      )
        return "in-place";
      if (
        !(options.block
          ? input.canMoveBlockRelative(
              options.block,
              options.targetTid,
              options.position,
            )
          : input.canMoveRelative(
              options.tid,
              options.targetTid,
              options.position,
            ))
      )
        return "model-refused";
    }
    return null;
  }
  function moveModelElement(input?: Dynamic, options?: Dynamic): Dynamic {
    if (elementMoveRefusal(input.model, options) !== null) return null;
    let value: Dynamic =
        options.targetTid != null
          ? input.model.element(options.targetTid)
          : null,
      tid: Dynamic = options.tid;
    if (options.alt) {
      let value9: Dynamic = input.model.duplicateElement(options.tid);
      input.model.restamp();
      tid = LayoutMoveElementsGetAttribute(value9);
    }
    let value2: Dynamic = value ? LayoutMoveElementsGetAttribute(value) : null,
      value3: Dynamic = input.model.element(tid),
      value4: Dynamic = input.model.parentTid(tid),
      items: Dynamic = [],
      items2: Dynamic = [],
      items3: Dynamic = [];
    if (options.absolute) {
      value2 != null && input.model.parentTid(tid) !== value2
        ? input.model.moveRelative(tid, value2, "into")
        : value2 == null &&
          options.position === "root-end" &&
          input.model.parentTid(tid) != null &&
          input.model.moveRelative(tid, null, "root-end");
      let value9: Dynamic = input.model.inlineStyleValue(tid, "position");
      if (value9 !== "absolute" && value9 !== "fixed") {
        let value10: Dynamic =
          options.fixed === true &&
          value2 == null &&
          options.position === "into";
        input.model.setStyleProperty(
          tid,
          "position",
          value10 ? "fixed" : "absolute",
        );
      }
      for (let [value10, value11] of Object.entries(
        options.absStyles ?? {},
      ) as Dynamic)
        if (value10 !== "position") {
          input.model.setStyleProperty(tid, value10, value11);
          for (let value12 of (LayoutMoveElementsLeftRightTopConfig[value10] ??
            []) as Dynamic)
            input.model.setStyleProperty(tid, value12, null);
        }
      (options.parentNeedsPositioning === true ||
        (options.targetTid != null &&
          options.previewPositioned?.has(options.targetTid) === true)) &&
        value2 != null &&
        !input.model.inlineStyleValue(value2, "position") &&
        input.model.setStyleProperty(value2, "position", "relative");
      options.flatten &&
        !options.alt &&
        (0, runtime.restoreGroupPosition)(
          input.model,
          options.flatten,
          tid,
          value4,
        );
      if (
        options.followers &&
        value2 == null &&
        options.position === "into" &&
        !options.alt
      ) {
        let value10: Dynamic = input.model.parentTid(tid);
        for (let value11 of options.followers as Dynamic) {
          if (
            value11.tid === tid ||
            !input.model.element(value11.tid) ||
            input.model.parentTid(value11.tid) !== value10 ||
            (0, runtime.containsUneditableSelection)(input.model, [value11.tid])
          )
            continue;
          let value12: Dynamic = input.model.inlineStyleValue(
            value11.tid,
            "position",
          );
          value12 !== "absolute" &&
            value12 !== "fixed" &&
            input.model.setStyleProperty(
              value11.tid,
              "position",
              value11.fixed ? "fixed" : "absolute",
            );
          for (let [value13, value14] of Object.entries(
            value11.absStyles,
          ) as Dynamic)
            if (value13 !== "position") {
              input.model.setStyleProperty(value11.tid, value13, value14);
              for (let value15 of (LayoutMoveElementsLeftRightTopConfig[
                value13
              ] ?? []) as Dynamic)
                input.model.setStyleProperty(value11.tid, value15, null);
            }
          items.push(value11.tid);
        }
      } else
        options.followers &&
          options.breakout === true &&
          !options.alt &&
          (items2 = displacedDropFollowers(
            input.model,
            options.followers,
            tid,
            value2,
            false,
          ));
    } else {
      let value9: Dynamic = (options.block ?? []).filter(
          (input2?: Dynamic): Dynamic => input2 !== tid,
        ),
        value10: Dynamic = value9.map(
          (input2?: Dynamic): Dynamic => input.model.element(input2),
        );
      (options.block
        ? input.model.moveBlockRelative(options.block, value2, options.position)
        : input.model.moveRelative(tid, value2, options.position)) &&
        value9.forEach((input2?: Dynamic, options2?: Dynamic): Dynamic => {
          let value11: Dynamic = value10[options2];
          value11 &&
            items3.push({
              el: value11,
              tid: input2,
              frozen: options.group?.find(
                (input3?: Dynamic): Dynamic => input3.tid === input2,
              )?.freezeStyle,
            });
        });
      if (options.clearPositioning === true)
        for (let value11 of [
          "position",
          "left",
          "top",
          "right",
          "bottom",
        ] as Dynamic)
          input.model.setStyleProperty(tid, value11, null);
    }
    let value5: Dynamic = input.model.parentTid(tid) !== value4,
      value6: Dynamic = value5
        ? freezeInheritedTextStyle(input.model, tid, options.freezeStyle)
        : new Map(),
      value7: Dynamic = value5
        ? items3.map(
            (input2?: Dynamic): Dynamic => ({
              el: input2.el,
              pinned: freezeInheritedTextStyle(
                input.model,
                input2.tid,
                input2.frozen,
              ),
              frozen: input2.frozen,
            }),
          )
        : [];
    input.model.restamp();
    let value8: Dynamic = LayoutMoveElementsGetAttribute(value3);
    for (let value9 of items2 as Dynamic) {
      let value10: Dynamic = LayoutMoveElementsGetAttribute(value9.el);
      value10 >= 0 && items.push(value10);
    }
    for (let value9 of items3 as Dynamic)
      items.push(LayoutMoveElementsGetAttribute(value9.el));
    let items4: Dynamic = [];
    value6.size > 0 &&
      value8 >= 0 &&
      items4.push({
        tid: value8,
        el: value3,
        pinned: value6,
        freeze: options.freezeStyle,
      });
    for (let value9 of items2 as Dynamic) {
      let value10: Dynamic = LayoutMoveElementsGetAttribute(value9.el);
      value9.pinned.size > 0 &&
        value10 >= 0 &&
        items4.push({
          tid: value10,
          el: value9.el,
          pinned: value9.pinned,
          freeze: value9.freezeStyle,
        });
    }
    for (let value9 of value7 as Dynamic) {
      let value10: Dynamic = LayoutMoveElementsGetAttribute(value9.el);
      value9.pinned.size > 0 &&
        value10 >= 0 &&
        items4.push({
          tid: value10,
          el: value9.el,
          pinned: value9.pinned,
          freeze: value9.frozen,
        });
    }
    return {
      newTid: value8,
      movingEl: value3,
      groupTids: items,
      reparented: value5,
      pins: items4,
      kind: options.alt
        ? "duplicate-drag"
        : options.breakout === true
          ? "breakout-drag"
          : "move-drag",
    };
  }
  bindRuntimeValue(
    runtime,
    "LayoutMoveElementsLeftRightTopConfig",
    () => LayoutMoveElementsLeftRightTopConfig,
    (value) => {
      LayoutMoveElementsLeftRightTopConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "freezeInheritedTextStyle",
    () => freezeInheritedTextStyle,
  );
  bindRuntimeValue(
    runtime,
    "displacedDropFollowers",
    () => displacedDropFollowers,
  );
  bindRuntimeValue(runtime, "sameParentDropGroup", () => sameParentDropGroup);
  bindRuntimeValue(runtime, "elementMoveRefusal", () => elementMoveRefusal);
  bindRuntimeValue(
    runtime,
    "LayoutMoveElementsGetAttribute",
    () => LayoutMoveElementsGetAttribute,
    (value) => {
      LayoutMoveElementsGetAttribute = value;
    },
  );
  bindRuntimeValue(runtime, "moveModelElement", () => moveModelElement);
  return () => {
    LayoutMoveElementsLeftRightTopConfig = {
      left: ["right"],
      right: ["left"],
      top: ["bottom"],
      bottom: ["top"],
      margin: ["margin-top", "margin-right", "margin-bottom", "margin-left"],
      "grid-area": [
        "grid-row",
        "grid-column",
        "grid-row-start",
        "grid-row-end",
        "grid-column-start",
        "grid-column-end",
      ],
    };
    LayoutMoveElementsGetAttribute = (element?: Dynamic): Dynamic =>
      parseInt(element.getAttribute("data-dc-tpl") ?? "-1", 10);
  };
}
