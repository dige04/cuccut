/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installExportCaptureLayout(
  runtime: RuntimeBindings,
): () => void {
  function inspectCaptureLayout(
    doc?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
    extra: Dynamic = 300,
  ): Dynamic {
    let value2: Dynamic = /^(IMG|SVG|CANVAS|VIDEO)$/i,
      text: Dynamic =
        "[data-dc-editor-overlay],[data-omelette-chrome],[data-noncommentable]",
      state: Dynamic = {
        ic: 0,
        sr: 0,
        cd: 0,
        ur: 0,
      },
      body: Dynamic = doc.body,
      documentElement: Dynamic = doc.documentElement;
    if (!body) return state;
    let defaultView: Dynamic = doc.defaultView,
      value3: Dynamic = defaultView ? defaultView.scrollY : 0,
      value4: Dynamic = Date.now(),
      callback: Dynamic = (): Dynamic => Date.now() - value4 > extra,
      callback2: Dynamic = (input?: Dynamic): Dynamic =>
        options(input).overflowY,
      value5: Dynamic = /hidden|clip/.test(
        callback2(documentElement) + callback2(body),
      ),
      value6: Dynamic =
        /auto|scroll/.test(callback2(body)) &&
        body.scrollHeight > body.clientHeight + 1,
      callback3: Dynamic = (input?: Dynamic): Dynamic =>
        input !== undefined && input !== "" && input !== "none",
      callback4: Dynamic = (input?: Dynamic): Dynamic => {
        let value10: Dynamic = input;
        return (
          callback3(value10.webkitLineClamp) ||
          callback3(value10.lineClamp) ||
          input.textOverflow === "ellipsis"
        );
      },
      entries: Dynamic = new Map(),
      callback5: Dynamic = (input?: Dynamic): Dynamic => {
        let entry: Dynamic = entries.get(input);
        if (entry !== undefined) return entry;
        let value10: Dynamic = options(input),
          value11: Dynamic = /auto|scroll/.test(value10.overflowY);
        if (value11 || /hidden|clip/.test(value10.overflowY)) {
          let bounds: Dynamic = input.getBoundingClientRect();
          entry = {
            el: input,
            scrolls: value11,
            clamps: callback4(value10),
            top: bounds.top + value3,
            bottom: bounds.bottom + value3,
            width: bounds.width,
            height: bounds.height,
          };
        } else entry = null;
        entries.set(input, entry);
        return entry;
      },
      entries2: Dynamic = new Map(),
      callback6: Dynamic = (input?: Dynamic): Dynamic => {
        let items: Dynamic = [],
          value10: Dynamic = null;
        for (
          let value11: Dynamic = input;
          value11 !== null && value11 !== body && value11 !== documentElement;
          value11 = value11.parentElement
        ) {
          let entry: Dynamic = entries2.get(value11);
          if (entry !== undefined) {
            value10 = entry;
            break;
          }
          items.push(value11);
          value10 = callback5(value11);
          if (value10 !== null) break;
        }
        for (let value11 of items as Dynamic) entries2.set(value11, value10);
        return value10;
      },
      values: Dynamic = new Set(),
      callback7: Dynamic = (
        input?: Dynamic,
        options2?: Dynamic,
        context2?: Dynamic,
      ): Dynamic => {
        for (
          let value10: Dynamic = callback6(context2);
          value10 !== null;
          value10 = callback6(value10.el.parentElement)
        ) {
          if (value10.width < 8 && value10.height < 8) return;
          if (!(input < value10.bottom - 2)) {
            if (value10.clamps) return;
            value10.height < 16
              ? values.has(value10.el) ||
                (values.add(value10.el), (state.cd += 1))
              : options2 >= value10.bottom + 24 &&
                (value10.scrolls ? (state.sr += 1) : (state.ic += 1));
            return;
          }
        }
        value5 &&
          input >= value - 2 &&
          options2 >= value + 24 &&
          (value6 ? (state.sr += 1) : (state.ic += 1));
      },
      callback8: Dynamic = (input?: Dynamic): Dynamic => {
        let checkVisibility: Dynamic = input.checkVisibility;
        return typeof checkVisibility == "function"
          ? checkVisibility.call(input)
          : options(input).display !== "none";
      },
      callback9: Dynamic = (input?: Dynamic): Dynamic => {
        let ancestor: Dynamic = input.closest("details:not([open])");
        if (ancestor === null || ancestor === input) return false;
        let ancestor2: Dynamic = input.closest("summary");
        return !(ancestor2 !== null && ancestor2.parentElement === ancestor);
      },
      callback10: Dynamic = (input?: Dynamic): Dynamic => {
        for (
          let firstChild: Dynamic = input.firstChild;
          firstChild !== null;
          firstChild = firstChild.nextSibling
        ) {
          if (firstChild.nodeType === 3 && firstChild.data.trim() !== "")
            return true;
          if (firstChild.nodeType !== 1 || firstChild.tagName === "SUMMARY")
            continue;
          let value10: Dynamic = firstChild;
          if (
            (value10.textContent ?? "").trim() !== "" ||
            value2.test(value10.tagName) ||
            value10.querySelector("img,svg,canvas,video") !== null
          )
            return true;
        }
        return false;
      },
      callback11: Dynamic = (input?: Dynamic): Dynamic =>
        parseFloat(options(input).opacity) <= 0.05,
      callback12: Dynamic = (input?: Dynamic): Dynamic => {
        for (
          let parentElement: Dynamic = input.parentElement;
          parentElement !== null && parentElement !== body;
          parentElement = parentElement.parentElement
        )
          if (callback11(parentElement)) return true;
        return false;
      },
      callback13: Dynamic = (input?: Dynamic): Dynamic => {
        try {
          let value10: Dynamic = defaultView && defaultView.DocumentTimeline;
          return input
            .getAnimations()
            .some(
              (input2?: Dynamic): Dynamic =>
                input2.timeline !== null &&
                !(value10 && input2.timeline instanceof value10),
            );
        } catch {
          return false;
        }
      },
      value7: Dynamic = context.querySelectorAll("*");
    for (
      let index2: Dynamic = 0;
      index2 < value7.length && index2 < 2e4 && !callback();
      index2++
    ) {
      let value10: Dynamic = value7[index2];
      if (
        (value10.namespaceURI !== "http://www.w3.org/1999/xhtml" &&
          !value2.test(value10.tagName)) ||
        value10.closest(text) !== null ||
        callback9(value10) ||
        !callback8(value10)
      )
        continue;
      let value11: Dynamic = options(value10);
      if (value10.tagName === "DETAILS" && !value10.open) {
        callback10(value10) && (state.cd += 1);
        continue;
      }
      if (value2.test(value10.tagName)) {
        let bounds: Dynamic = value10.getBoundingClientRect();
        bounds.width > 0 &&
          bounds.height > 0 &&
          value11.visibility === "visible" &&
          callback7(
            bounds.top + value3,
            bounds.bottom + value3,
            value10.parentElement,
          );
        continue;
      }
      parseFloat(value11.opacity) <= 0.05 &&
        /^(static|relative|sticky)$/.test(value11.position) &&
        value10.getBoundingClientRect().height >= 40 &&
        (value10.textContent ?? "").trim().length >= 20 &&
        !callback12(value10) &&
        !callback13(value10) &&
        (state.ur += 1);
    }
    let value8: Dynamic = doc.createTreeWalker(context, 4),
      value9: Dynamic = doc.createRange(),
      index: Dynamic = 0;
    for (
      let value10: Dynamic = value8.nextNode();
      value10 !== null && index < 2e4 && !callback();
      value10 = value8.nextNode()
    ) {
      if (value10.data.trim() === "") continue;
      let parentElement: Dynamic = value10.parentElement;
      if (
        parentElement === null ||
        parentElement.closest("script,style,template,noscript") !== null ||
        parentElement.closest(text) !== null ||
        callback9(parentElement)
      )
        continue;
      let value11: Dynamic = options(parentElement);
      if (value11.display === "none" || value11.visibility !== "visible")
        continue;
      value9.selectNodeContents(value10);
      let value12: Dynamic = value9.getClientRects();
      for (let index2: Dynamic = 0; index2 < value12.length; index2++) {
        let value13: Dynamic = value12[index2];
        value13.height < 0.5 ||
          value13.width < 0.5 ||
          ((index += 1),
          callback7(
            value13.top + value3,
            value13.bottom + value3,
            parentElement,
          ));
      }
    }
    return state;
  }
  bindRuntimeValue(runtime, "inspectCaptureLayout", () => inspectCaptureLayout);
  return () => {};
}
