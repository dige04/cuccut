/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installExportCaptureText(runtime: RuntimeBindings): () => void {
  function captureReadableText(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
    extra?: Dynamic,
    detail?: Dynamic,
    argument?: Dynamic,
    argument2?: Dynamic,
    argument3?: Dynamic,
  ): Dynamic {
    let state: Dynamic = {
        SCRIPT: 1,
        STYLE: 1,
        NOSCRIPT: 1,
        TEMPLATE: 1,
        IFRAME: 1,
        HEAD: 1,
        TITLE: 1,
      },
      value2: Dynamic = 511 / 2 / 1e3,
      count: Dynamic = 2e3,
      bounds: Dynamic = context.getBoundingClientRect(),
      value3: Dynamic = context.offsetWidth || 0,
      value4: Dynamic = context.offsetHeight || 0,
      value5: Dynamic =
        value3 > 0 && bounds.width > 0 ? bounds.width / value3 : 1,
      value6: Dynamic = extra || value3 || bounds.width / value5,
      value7: Dynamic = detail || value4 || bounds.height / value5,
      value8: Dynamic = input.createRange(),
      items: Dynamic = [],
      index: Dynamic = 0,
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
      entries: Dynamic = new Map(),
      callback2: Dynamic = (input2?: Dynamic): Dynamic => {
        let entry: Dynamic = entries.get(input2);
        if (entry !== undefined) return entry;
        let value12: Dynamic = input2 === context ? null : callback(input2),
          value13: Dynamic =
            parseFloat(options(input2).opacity) <= 0 ||
            (value12 !== null && callback2(value12));
        entries.set(input2, value13);
        return value13;
      },
      entries2: Dynamic = new Map(),
      callback3: Dynamic = (input2?: Dynamic, options2?: Dynamic): Dynamic => {
        let entry: Dynamic = entries2.get(input2);
        if (entry === undefined) {
          let value12: Dynamic = input2;
          entry =
            value12.scrollHeight - value12.clientHeight > options2
              ? 1 / 0
              : (input2.getBoundingClientRect().bottom - bounds.top) / value5;
          entries2.set(input2, entry);
        }
        return entry;
      },
      entries3: Dynamic = new Map(),
      callback4: Dynamic = (input2?: Dynamic): Dynamic => {
        let entry: Dynamic = entries3.get(input2);
        if (entry === undefined) {
          let value12: Dynamic = options(input2),
            whiteSpace: Dynamic = value12.whiteSpace,
            display: Dynamic = value12.display,
            value13: Dynamic = display === "none",
            value14: Dynamic = parseFloat(value12.fontSize),
            value15: Dynamic =
              input2 instanceof SVGGraphicsElement &&
              !(input2 instanceof SVGSVGElement)
                ? input2.getScreenCTM()
                : null;
          value15 && (value14 = (value14 * Math.abs(value15.d)) / value5);
          entry = {
            none: value13,
            inline:
              display.indexOf("inline") >= 0 ||
              display === "contents" ||
              display.indexOf("ruby") === 0,
            atomic: display.indexOf("inline-") === 0,
            ok:
              !value13 &&
              value12.visibility === "visible" &&
              !callback2(input2),
            size: value14,
            collapse:
              whiteSpace !== "pre" &&
              whiteSpace !== "pre-wrap" &&
              whiteSpace !== "break-spaces",
            tt: value12.textTransform,
          };
          entries3.set(input2, entry);
        }
        return entry;
      },
      items2: Dynamic = [],
      state2: Dynamic = {
        H1: 1,
        H2: 2,
        H3: 3,
        H4: 4,
        H5: 5,
        H6: 6,
      },
      items3: Dynamic = ["H1", "H2", "H3", "H4", "H5", "H6"],
      state3: Dynamic = {
        UL: 1,
        OL: 1,
        MENU: 1,
      },
      callback5: Dynamic = (element?: Dynamic): Dynamic => {
        let value12: Dynamic = element.getAttribute("role") || null,
          value13: Dynamic = state2[element.tagName.toUpperCase()];
        if (value13 !== undefined && value12 === null) return value13;
        if (value12 !== "heading") return 0;
        let value14: Dynamic = Math.floor(
          Number(element.getAttribute("aria-level")),
        );
        return value14 >= 1
          ? Math.min(value14, 6)
          : value13 !== undefined
            ? value13
            : 2;
      },
      entries4: Dynamic = new Map(),
      callback6: Dynamic = (input2?: Dynamic): Dynamic => {
        let entry: Dynamic = entries4.get(input2);
        if (entry === undefined) {
          let value12: Dynamic = input2 === context ? null : callback(input2);
          entry =
            callback5(input2) > 0
              ? input2
              : value12 === null
                ? null
                : callback6(value12);
          entries4.set(input2, entry);
        }
        return entry;
      },
      callback7: Dynamic = (element?: Dynamic): Dynamic => {
        let value12: Dynamic = element.getAttribute("role") || null;
        return (
          value12 === "list" ||
          (value12 === null && state3[element.tagName.toUpperCase()] === 1)
        );
      },
      callback8: Dynamic = (element?: Dynamic): Dynamic => {
        let value12: Dynamic = element.getAttribute("role") || null;
        return (
          value12 === "listitem" ||
          (value12 === null && element.tagName.toUpperCase() === "LI")
        );
      },
      entries5: Dynamic = new Map(),
      callback9: Dynamic = (input2?: Dynamic): Dynamic => {
        let entry: Dynamic = entries5.get(input2);
        if (entry === undefined) {
          let value12: Dynamic = input2 === context ? null : callback(input2),
            value13: Dynamic = value12 === null ? null : callback9(value12);
          entry =
            value13 !== null ? value13 : callback7(input2) ? input2 : null;
          entries5.set(input2, entry);
        }
        return entry;
      },
      entries6: Dynamic = new Map(),
      entries7: Dynamic = new Map(),
      callback10: Dynamic = (input2?: Dynamic): Dynamic => {
        let entry: Dynamic = entries6.get(input2);
        if (entry === undefined) {
          let value12: Dynamic = input2 === context ? null : callback(input2),
            value13: Dynamic = callback8(input2)
              ? value12 && callback9(value12)
              : null;
          if (value13) {
            let value14: Dynamic = entries7.get(value13) || 0;
            entries7.set(value13, value14 + 1);
            entry = {
              list: value13,
              index: value14,
            };
          } else entry = value12 === null ? null : callback10(value12);
          entries6.set(input2, entry);
        }
        return entry;
      },
      entries8: Dynamic = new Map(),
      callback11: Dynamic = (input2?: Dynamic): Dynamic => {
        let entry: Dynamic = entries8.get(input2);
        if (entry === undefined) {
          let value12: Dynamic = input2 === context ? null : callback(input2),
            value13: Dynamic =
              input2.namespaceURI === "http://www.w3.org/2000/svg"
                ? input2.tagName !== "text"
                : callback4(input2).inline;
          entry = value12 === null || !value13 ? input2 : callback11(value12);
          entries8.set(input2, entry);
        }
        return entry;
      },
      entries9: Dynamic = new Map(),
      callback12: Dynamic = (element?: Dynamic): Dynamic => {
        let entry: Dynamic = entries9.get(element);
        if (entry === undefined) {
          let value12: Dynamic = element === context ? null : callback(element),
            value13: Dynamic = value12 === null ? null : callback12(value12);
          entry =
            value13 !== null
              ? value13
              : element.getAttribute("aria-hidden") === "true" ||
                  element.getAttribute("role") === "img"
                ? element
                : null;
          entries9.set(element, entry);
        }
        return entry;
      },
      entries10: Dynamic = new Map(),
      callback13: Dynamic = (input2?: Dynamic): Dynamic => {
        let entry: Dynamic = entries10.get(input2);
        if (entry === undefined) {
          let value12: Dynamic = callback4(input2),
            value13: Dynamic =
              input2 === context || !value12.inline ? null : callback(input2);
          entry =
            value12.inline && value12.atomic
              ? input2
              : value13 === null
                ? null
                : callback13(value13);
          entries10.set(input2, entry);
        }
        return entry;
      },
      entries11: Dynamic = new Map(),
      callback14: Dynamic = (input2?: Dynamic): Dynamic => {
        if (argument3 === undefined) return;
        let entry: Dynamic = entries11.get(input2);
        if (entry === undefined) {
          let entry2: Dynamic = argument3.get(input2),
            value12: Dynamic = input2 === context ? null : callback(input2),
            value13: Dynamic =
              entry2 !== undefined || value12 === null
                ? undefined
                : callback14(value12);
          entry =
            entry2 !== undefined
              ? entry2
              : value13 === undefined
                ? null
                : value13;
          entries11.set(input2, entry);
        }
        return entry === null ? undefined : entry;
      },
      callback15: Dynamic = (
        element?: Dynamic,
        options2?: Dynamic,
      ): Dynamic => {
        let attribute: Dynamic = element.getAttribute("aria-labelledby");
        if (attribute !== null) {
          let value12: Dynamic = attribute
            .split(/\s+/)
            .map(
              (input2?: Dynamic): Dynamic =>
                input2 === "" ? null : input.getElementById(input2),
            )
            .map(
              (input2?: Dynamic): Dynamic =>
                input2 === null ? "" : (input2.textContent || "").trim(),
            )
            .filter((input2?: Dynamic): Dynamic => input2 !== "")
            .join(" ")
            .slice(0, 2e3);
          if (value12 !== "") return value12;
        }
        let attribute2: Dynamic = element.getAttribute("aria-label");
        if (attribute2 !== null && attribute2.trim() !== "")
          return attribute2.trim();
        if (options2 === "IMG") {
          let attribute4: Dynamic = element.getAttribute("alt");
          if (attribute4 !== null) return attribute4.trim();
        } else
          for (
            let firstElementChild: Dynamic = element.firstElementChild;
            firstElementChild !== null;
            firstElementChild = firstElementChild.nextElementSibling
          )
            if (firstElementChild.tagName.toLowerCase() === "title")
              return (firstElementChild.textContent || "").trim();
        let attribute3: Dynamic = element.getAttribute("title");
        return attribute3 !== null && attribute3.trim() !== ""
          ? attribute3.trim()
          : undefined;
      },
      items4: Dynamic = [new Map(), new Map(), new Map()],
      entries12: Dynamic = new Map(),
      index2: Dynamic = 0,
      value9: Dynamic = -1,
      callback16: Dynamic = (input2?: Dynamic, options2?: Dynamic): Dynamic => {
        let value12: Dynamic = callback12(input2);
        if (value12 !== null) {
          let entry2: Dynamic = entries12.get(value12);
          entry2 === undefined &&
            ((entry2 = items2.length),
            items2.push("Artifact"),
            entries12.set(value12, entry2));
          return {
            b: entry2,
          };
        }
        let value13: Dynamic = callback6(input2),
          value14: Dynamic = value13 === null ? callback10(input2) : null,
          value15: Dynamic = value13 !== null ? 0 : value14 !== null ? 1 : 2,
          value16: Dynamic =
            value13 !== null
              ? value13
              : value14 !== null
                ? value14.list
                : callback11(input2),
          entry: Dynamic = items4[value15].get(value16);
        entry === undefined ||
        (!options2 &&
          (entry !== value9 || (value14 !== null && value14.index < index2)))
          ? ((entry = items2.length),
            items2.push(
              value13 !== null
                ? items3[callback5(value13) - 1]
                : value14 !== null
                  ? "L"
                  : "P",
            ),
            items4[value15].set(value16, entry),
            (value9 = entry))
          : options2 || (value9 = entry);
        value14 !== null && !options2 && (index2 = value14.index);
        return value14 !== null
          ? {
              b: entry,
              i: value14.index,
            }
          : {
              b: entry,
            };
      },
      flag2: Dynamic = false,
      value10: Dynamic = -1,
      value11: Dynamic = null,
      text: Dynamic = "",
      callback17: Dynamic = (input2?: Dynamic, options2?: Dynamic): Dynamic =>
        /[\p{Ps}\p{Pi}]/u.test(input2) ||
        /[\p{Pe}\p{Pf}\p{Po}]/u.test(options2),
      state4: Dynamic = {
        SVG: 1,
        CANVAS: 1,
        VIDEO: 1,
        AUDIO: 1,
        INPUT: 1,
        SELECT: 1,
        TEXTAREA: 1,
        BUTTON: 1,
        OBJECT: 1,
        EMBED: 1,
        HR: 1,
        METER: 1,
        PROGRESS: 1,
      },
      callback18: Dynamic = (): Dynamic => {
        let index3: Dynamic = 0,
          value12: Dynamic = value8.getClientRects();
        for (let index4: Dynamic = 0; index4 < value12.length; index4++) {
          let value13: Dynamic = value12[index4];
          value13.width > 0.01 && value13.height > 0.01 && index3++;
        }
        return index3;
      },
      callback19: Dynamic = (input2?: Dynamic): Dynamic => {
        let length: Dynamic = input2.data.length;
        value8.setStart(input2, 0);
        value8.setEnd(input2, length);
        if (callback18() <= 1) return [[0, length]];
        let items5: Dynamic = [],
          index3: Dynamic = 0;
        for (let count2: Dynamic = 1; count2 <= length; count2++) {
          value8.setStart(input2, index3);
          value8.setEnd(input2, count2);
          callback18() > 1 && count2 - 1 > index3
            ? (items5.push([index3, count2 - 1]), (index3 = count2 - 1))
            : count2 - index3 >= count &&
              (items5.push([index3, count2]), (index3 = count2));
        }
        length > index3 && items5.push([index3, length]);
        return items5;
      },
      callback20: Dynamic = (input2?: Dynamic): Dynamic =>
        input2 === " " ||
        input2 ===
          `
` ||
        input2 === "	" ||
        input2 === "\r" ||
        input2 === "\f",
      callback21: Dynamic = (input2?: Dynamic): Dynamic => {
        let data: Dynamic = input2.data;
        if (data.trim() === "") {
          data !== "" && (flag2 = true);
          return;
        }
        let value12: Dynamic = callback(input2);
        if (value12 === null) return;
        let value13: Dynamic = callback4(value12),
          value14: Dynamic = callback14(value12);
        if (!value13.ok || !(value13.size > 0)) {
          flag2 = true;
          return;
        }
        index += data.length;
        if (index > value) {
          flag = true;
          if (argument) {
            value8.setStart(input2, 0);
            value8.setEnd(input2, data.length);
            let value16: Dynamic = value8.getClientRects();
            for (let index4: Dynamic = 0; index4 < value16.length; index4++) {
              let value17: Dynamic = value16[index4];
              value17.height > 0.01 &&
                argument.push([
                  (value17.top - bounds.top) / value5,
                  Math.min(
                    (value17.bottom - bounds.top) / value5,
                    callback3(value12, value13.size),
                  ),
                ]);
            }
          }
          return;
        }
        let value15: Dynamic,
          index3: Dynamic = 0;
        for (let value16 of callback19(input2) as Dynamic) {
          let value17: Dynamic = value16[0],
            value18: Dynamic = value16[1];
          for (; value17 < value18 && callback20(data.charAt(value17)); )
            value17++;
          for (; value18 > value17 && callback20(data.charAt(value18 - 1)); )
            value18--;
          if (value17 >= value18) {
            value16[1] > value16[0] && (flag2 = true);
            continue;
          }
          value17 > index3 &&
            (flag2 = flag2 || /[ \n\t\r\f]/.test(data.slice(index3, value17)));
          let value19: Dynamic = data.slice(value17, value18);
          value13.collapse && (value19 = value19.replace(/[ \n\t\r\f]+/g, " "));
          value13.tt === "uppercase"
            ? (value19 = value19.toUpperCase())
            : value13.tt === "lowercase"
              ? (value19 = value19.toLowerCase())
              : value13.tt === "capitalize" &&
                (value19 = value19.replace(
                  /(^|[^A-Za-z0-9\u00C0-\u024F'])([a-z\u00DF-\u00FF])/g,
                  (
                    input3?: Dynamic,
                    options2?: Dynamic,
                    context2?: Dynamic,
                  ): Dynamic => options2 + context2.toUpperCase(),
                ));
          value8.setStart(input2, value17);
          value8.setEnd(input2, value18);
          let bounds2: Dynamic = value8.getBoundingClientRect(),
            value20: Dynamic = (bounds2.left - bounds.left) / value5,
            value21: Dynamic = (bounds2.top - bounds.top) / value5,
            value22: Dynamic = bounds2.height / value5,
            value23: Dynamic = bounds2.width / value5;
          if (
            bounds2.width <= 0.01 ||
            bounds2.height <= 0.01 ||
            value20 >= value6 ||
            value20 + value23 <= 0
          ) {
            flag2 = true;
            continue;
          }
          let value24: Dynamic = value21 + (argument2 || 0);
          if (value24 < value7 && value24 + value22 > 0) {
            let value25: Dynamic = Math.min(value23, value6 - value20),
              value26: Dynamic = Math.min(value13.size, value22),
              value27: Dynamic = Math.min(
                value7,
                Math.max(0, value24 + value22 / 2 + value26 * value2),
              );
            value15 === undefined && (value15 = callback16(value12));
            let value28: Dynamic = callback13(value12) || callback11(value12),
              value29: Dynamic =
                value15.i === undefined
                  ? {
                      t: value19,
                      x: value20,
                      y: value27,
                      s: value26,
                      w: value25,
                      b: value15.b,
                    }
                  : {
                      t: value19,
                      x: value20,
                      y: value27,
                      s: value26,
                      w: value25,
                      b: value15.b,
                      i: value15.i,
                    };
            value15.b === value10 &&
              (value29.sp =
                flag2 ||
                (value28 !== value11 && !callback17(text, value19.charAt(0))));
            value14 !== undefined && (value29.a = value14);
            items.push(value29);
            items2[value15.b] === "Artifact"
              ? (flag2 = true)
              : ((flag2 = false),
                (value10 = value15.b),
                (value11 = value28),
                (text = value19.charAt(value19.length - 1)));
          } else flag2 = true;
          index3 = value18;
          argument &&
            value21 < value7 &&
            value21 + value22 > 0 &&
            argument.push([
              value21,
              Math.min(value21 + value22, callback3(value12, value13.size)),
            ]);
        }
        index3 > 0 && index3 < data.length && (flag2 = true);
      },
      callback22: Dynamic = (
        element?: Dynamic,
        options2?: Dynamic,
      ): Dynamic => {
        let attribute: Dynamic = element.getAttribute("role"),
          value12: Dynamic = element === context ? null : callback(element);
        if (
          attribute === "presentation" ||
          attribute === "none" ||
          element.getAttribute("aria-hidden") === "true" ||
          (value12 !== null && callback12(value12) !== null) ||
          !callback4(element).ok
        )
          return;
        let value13: Dynamic = callback15(element, options2);
        if (value13 === "") return;
        let bounds2: Dynamic = element.getBoundingClientRect(),
          value14: Dynamic = (bounds2.left - bounds.left) / value5,
          value15: Dynamic =
            (bounds2.top - bounds.top) / value5 + (argument2 || 0),
          value16: Dynamic = bounds2.width / value5,
          value17: Dynamic = bounds2.height / value5;
        if (
          value16 <= 0.01 ||
          value17 <= 0.01 ||
          value14 >= value6 ||
          value14 + value16 <= 0 ||
          value15 >= value7 ||
          value15 + value17 <= 0
        )
          return;
        value12 !== null &&
          (callback6(value12) !== null || callback10(value12) !== null) &&
          callback16(value12, true);
        let value18: Dynamic =
            value13 === undefined
              ? {
                  r: "Figure",
                  x: value14,
                  y: value15,
                  w: value16,
                  h: value17,
                }
              : {
                  r: "Figure",
                  a: value13,
                  x: value14,
                  y: value15,
                  w: value16,
                  h: value17,
                },
          value19: Dynamic = callback14(element);
        value19 !== undefined && (value18.l = value19);
        items2.push(value18);
      },
      callback23: Dynamic = (input2?: Dynamic): Dynamic => {
        if (flag && !argument) return;
        if (input2.nodeType === 3) {
          callback21(input2);
          return;
        }
        if (input2.nodeType !== 1) return;
        let value12: Dynamic = input2,
          value13: Dynamic = value12.tagName.toUpperCase();
        if (
          state[value13] === 1 ||
          value12.hasAttribute("data-omelette-chrome") ||
          value12.hasAttribute("data-noncommentable") ||
          value12.hasAttribute("data-dc-editor-overlay") ||
          (value12 !== context && callback4(value12).none)
        )
          return;
        if (value13 === "BR") {
          flag2 = true;
          return;
        }
        let value14: Dynamic =
          value12 !== context &&
          (!callback4(value12).inline || state4[value13] === 1);
        value14 && (flag2 = true);
        callback6(value12);
        callback9(value12);
        callback10(value12);
        callback11(value12);
        callback13(value12);
        callback14(value12);
        if (
          (value13 === "IMG" || value12.getAttribute("role") === "img") &&
          (callback22(value12, value13), (flag2 = true), value13 === "IMG")
        )
          return;
        callback12(value12);
        let value15: Dynamic;
        if (value12.shadowRoot) value15 = value12.shadowRoot.childNodes;
        else if (value13 === "SLOT") {
          let value16: Dynamic = value12.assignedNodes({
            flatten: true,
          });
          value15 = value16.length ? value16 : value12.childNodes;
        } else value15 = value12.childNodes;
        for (let index3: Dynamic = 0; index3 < value15.length; index3++) {
          let value16: Dynamic = value15[index3];
          value16 && callback23(value16);
        }
        value14 && (flag2 = true);
      };
    callback23(context);
    return {
      runs: items,
      truncated: flag,
      blocks: items2,
    };
  }
  bindRuntimeValue(runtime, "captureReadableText", () => captureReadableText);
  return () => {};
}
