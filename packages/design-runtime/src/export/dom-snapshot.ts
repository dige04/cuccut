/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installExportDomSnapshot(runtime: RuntimeBindings): () => void {
  function captureDomSnapshot(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
    extra?: Dynamic,
  ): Dynamic {
    let state: Dynamic = {
        SCRIPT: 1,
        STYLE: 1,
        NOSCRIPT: 1,
        TEMPLATE: 1,
        IFRAME: 1,
        HEAD: 1,
      },
      count: Dynamic = 4e3,
      count2: Dynamic = 64,
      count3: Dynamic = 500,
      count4: Dynamic = 2048,
      count5: Dynamic = 2,
      text: Dynamic = "http://www.w3.org/1999/xlink",
      value2: Dynamic = (extra && extra.skipAttrs) || [],
      bounds: Dynamic = options.getBoundingClientRect(),
      value3: Dynamic = options.offsetWidth || 0,
      value4: Dynamic = options.offsetHeight || 0,
      value5: Dynamic =
        value3 > 0 && bounds.width > 0 ? bounds.width / value3 : 1,
      value6: Dynamic = context || value3 || bounds.width / value5,
      value7: Dynamic = value || value4 || bounds.height / value5,
      value8: Dynamic = bounds.top - ((extra && extra.dy) || 0) * value5,
      items: Dynamic = [],
      flag: Dynamic = false,
      callback: Dynamic = (input2?: Dynamic): Dynamic => {
        if (input2.parentElement) return input2.parentElement;
        let parentNode: Dynamic = input2.parentNode;
        return (
          (parentNode !== null &&
            parentNode.nodeType === 11 &&
            parentNode.host) ||
          null
        );
      },
      callback2: Dynamic = (input2?: Dynamic): Dynamic => {
        if (state[input2.tagName.toUpperCase()] === 1) return true;
        for (let index: Dynamic = 0; index < value2.length; index++)
          if (input2.hasAttribute(value2[index])) return true;
        return false;
      },
      entries: Dynamic = new Map(),
      callback3: Dynamic = (input2?: Dynamic): Dynamic => {
        let entry: Dynamic = entries.get(input2);
        if (entry !== undefined) return entry;
        let value9: Dynamic = input2 === options ? null : callback(input2),
          value10: Dynamic =
            parseFloat(input(input2).opacity) <= 0 ||
            (value9 !== null && callback3(value9));
        entries.set(input2, value10);
        return value10;
      },
      entries2: Dynamic = new Map(),
      callback4: Dynamic = (input2?: Dynamic): Dynamic => {
        let entry: Dynamic = entries2.get(input2);
        if (entry !== undefined) return entry;
        let style: Dynamic = input2.style,
          value9: Dynamic = style ? style.visibility : "",
          value10: Dynamic = input2 === options ? null : callback(input2),
          value11: Dynamic =
            value9 === "hidden" ||
            value9 === "collapse" ||
            (value9 !== "visible" && value10 !== null && callback4(value10));
        entries2.set(input2, value11);
        return value11;
      },
      callback5: Dynamic = (input2?: Dynamic): Dynamic => {
        let display: Dynamic = input(input2).display;
        return display === "contents" ||
          typeof input2.checkVisibility != "function"
          ? display === "none"
          : !input2.checkVisibility();
      },
      callback6: Dynamic = (input2?: Dynamic): Dynamic =>
        extra && extra.inlineVisibility
          ? callback4(input2)
          : /^(hidden|collapse)$/.test(input(input2).visibility),
      callback7: Dynamic = (input2?: Dynamic): Dynamic => {
        let position: Dynamic = input(input2).position,
          value9: Dynamic = callback(input2);
        if (position !== "absolute" && position !== "fixed") return value9;
        let callback12: Dynamic = (input3?: Dynamic): Dynamic =>
          input3 === undefined ||
          input3 === "" ||
          input3 === "none" ||
          input3 === "normal" ||
          input3 === "auto";
        for (; value9 !== null && value9 !== options; ) {
          let value10: Dynamic = input(value9);
          if (
            (position === "absolute" && value10.position !== "static") ||
            !callback12(value10.transform) ||
            !callback12(value10.translate) ||
            !callback12(value10.rotate) ||
            !callback12(value10.scale) ||
            !callback12(value10.perspective) ||
            !callback12(value10.filter) ||
            !callback12(value10.backdropFilter) ||
            !callback12(value10.contain) ||
            /transform|perspective|filter|translate|rotate|scale|contain/.test(
              value10.willChange || "",
            )
          )
            return value9;
          value9 = callback(value9);
        }
        return position === "fixed" ? null : value9;
      },
      entries3: Dynamic = new Map(),
      callback8: Dynamic = (input2?: Dynamic): Dynamic => {
        if (input2 === options) return null;
        if (entries3.has(input2)) return entries3.get(input2);
        let value9: Dynamic = callback7(input2),
          value10: Dynamic = value9 !== null ? callback8(value9) : null;
        if (value9 !== null && value9 !== options) {
          let value11: Dynamic = input(value9),
            value12: Dynamic = /^(hidden|clip|scroll|auto)$/.test(
              value11.overflowX,
            ),
            value13: Dynamic = /^(hidden|clip|scroll|auto)$/.test(
              value11.overflowY,
            );
          if (value12 || value13) {
            let bounds2: Dynamic = value9.getBoundingClientRect(),
              state2: Dynamic = {
                l: value12
                  ? bounds2.left + (parseFloat(value11.borderLeftWidth) || 0)
                  : -1 / 0,
                t: value13
                  ? bounds2.top + (parseFloat(value11.borderTopWidth) || 0)
                  : -1 / 0,
                r: value12
                  ? bounds2.right - (parseFloat(value11.borderRightWidth) || 0)
                  : 1 / 0,
                b: value13
                  ? bounds2.bottom -
                    (parseFloat(value11.borderBottomWidth) || 0)
                  : 1 / 0,
              };
            value10 =
              value10 === null
                ? state2
                : {
                    l: Math.max(value10.l, state2.l),
                    t: Math.max(value10.t, state2.t),
                    r: Math.min(value10.r, state2.r),
                    b: Math.min(value10.b, state2.b),
                  };
          }
        }
        entries3.set(input2, value10);
        return value10;
      },
      callback9: Dynamic = (input2?: Dynamic): Dynamic => {
        if (input2.shadowRoot) return input2.shadowRoot.childNodes;
        if (input2.tagName.toUpperCase() === "SLOT") {
          let value9: Dynamic = input2.assignedNodes({
            flatten: true,
          });
          if (value9.length) return value9;
        }
        return input2.childNodes;
      },
      callback10: Dynamic = (input2?: Dynamic, options2?: Dynamic): Dynamic => {
        let items2: Dynamic = [],
          index: Dynamic = 0,
          callback12: Dynamic = (input3?: Dynamic): Dynamic => {
            if (++index > count3 || callback3(input3) || callback5(input3))
              return;
            let value10: Dynamic = callback8(input3),
              value11: Dynamic = callback6(input3)
                ? []
                : input3.getClientRects();
            for (let index2: Dynamic = 0; index2 < value11.length; index2++) {
              let value13: Dynamic = value11[index2],
                left: Dynamic = value13.left,
                top: Dynamic = value13.top,
                right: Dynamic = value13.right,
                bottom: Dynamic = value13.bottom;
              value10 !== null &&
                ((left = Math.max(left, value10.l)),
                (top = Math.max(top, value10.t)),
                (right = Math.min(right, value10.r)),
                (bottom = Math.min(bottom, value10.b)));
              let state2: Dynamic = {
                l: Math.max(0, (left - bounds.left) / value5),
                t: Math.max(0, (top - value8) / value5),
                r: Math.min(value6, (right - bounds.left) / value5),
                b: Math.min(value7, (bottom - value8) / value5),
              };
              state2.r - state2.l >= count5 &&
                state2.b - state2.t >= count5 &&
                items2.push(state2);
            }
            let value12: Dynamic = callback9(input3);
            for (let index2: Dynamic = 0; index2 < value12.length; index2++) {
              let value13: Dynamic = value12[index2];
              value13 &&
                value13.nodeType === 1 &&
                !callback2(value13) &&
                callback12(value13);
            }
          };
        callback12(input2);
        items2.sort(
          (input3?: Dynamic, options3?: Dynamic): Dynamic =>
            (options3.r - options3.l) * (options3.b - options3.t) -
            (input3.r - input3.l) * (input3.b - input3.t),
        );
        let items3: Dynamic = [];
        for (let value10 of items2 as Dynamic) {
          if (items3.length >= count2) break;
          let flag2: Dynamic = false;
          for (let value11 of items3 as Dynamic)
            if (
              value10.l >= value11.l - 0.5 &&
              value10.t >= value11.t - 0.5 &&
              value10.r <= value11.r + 0.5 &&
              value10.b <= value11.b + 0.5
            ) {
              flag2 = true;
              break;
            }
          flag2 || items3.push(value10);
        }
        items3.sort(
          (input3?: Dynamic, options3?: Dynamic): Dynamic =>
            input3.t - options3.t || input3.l - options3.l,
        );
        let items4: Dynamic = [];
        for (let value10 of items3 as Dynamic) {
          let value11: Dynamic = items4[items4.length - 1];
          value11 &&
          Math.abs(value11.t - value10.t) < 1 &&
          Math.abs(value11.b - value10.b) < 1 &&
          value10.l <= value11.r + 1 &&
          value10.r >= value11.l - 1
            ? ((value11.l = Math.min(value11.l, value10.l)),
              (value11.t = Math.min(value11.t, value10.t)),
              (value11.r = Math.max(value11.r, value10.r)),
              (value11.b = Math.max(value11.b, value10.b)))
            : items4.push(value10);
        }
        let value9: Dynamic =
          items4.length > 0 && items.length < count && extra && extra.anchorId
            ? extra.anchorId(input2)
            : undefined;
        for (let value10 of items4 as Dynamic) {
          if (items.length >= count) {
            flag = true;
            return;
          }
          items.push(
            value9 === undefined
              ? {
                  u: options2,
                  x: value10.l,
                  y: value10.t,
                  w: value10.r - value10.l,
                  h: value10.b - value10.t,
                }
              : {
                  u: options2,
                  x: value10.l,
                  y: value10.t,
                  w: value10.r - value10.l,
                  h: value10.b - value10.t,
                  a: value9,
                },
          );
        }
      },
      callback11: Dynamic = (element?: Dynamic): Dynamic => {
        if (
          flag ||
          callback2(element) ||
          (element !== options && callback5(element))
        )
          return;
        if (element.localName.toLowerCase() === "a") {
          let value10: Dynamic =
              extra && extra.hrefOf
                ? extra.hrefOf(element)
                : element.getAttribute("href") ||
                  element.getAttributeNS(text, "href"),
            value11: Dynamic = typeof value10 == "string" ? value10.trim() : "";
          if (
            value11 !== "" &&
            value11.length <= count4 &&
            /^(?:https?:\/\/|mailto:)/i.test(value11)
          ) {
            callback10(element, value11);
            return;
          }
        }
        let value9: Dynamic = callback9(element);
        for (let index: Dynamic = 0; index < value9.length; index++) {
          let value10: Dynamic = value9[index];
          value10 && value10.nodeType === 1 && callback11(value10);
        }
      };
    callback11(options);
    return {
      links: items,
      truncated: flag,
    };
  }
  bindRuntimeValue(runtime, "captureDomSnapshot", () => captureDomSnapshot);
  return () => {};
}
