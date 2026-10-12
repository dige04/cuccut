/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installExportCaptureStyle(
  runtime: RuntimeBindings,
): () => void {
  function captureElementStyle(
    doc?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
    extra?: Dynamic,
    detail?: Dynamic,
    argument?: Dynamic,
  ): Dynamic {
    let value2: Dynamic =
        /^((border-(top|right|bottom|left)|outline|column-rule)-width|outline-offset)$/,
      count: Dynamic = 1,
      index: Dynamic = 0,
      index2: Dynamic = 0,
      value3: Dynamic = null,
      value4: Dynamic = null,
      items: Dynamic = [1, 1],
      callback: Dynamic = (input?: Dynamic): Dynamic =>
        input.assignedSlot ||
        input.parentElement ||
        (input.getRootNode().host ?? null),
      callback2: Dynamic = (input?: Dynamic, options2?: Dynamic): Dynamic => {
        let value13: Dynamic = /^matrix\(([^)]+)\)$/.exec(
            options2.transform || "none",
          ),
          value14: Dynamic = value13
            ? value13[1].split(",").map(Number)
            : [1, 0, 0, 1],
          value15: Dynamic =
            (options2.scale || "none") === "none"
              ? [1, 1]
              : options2.scale.split(" ").map(Number),
          value16: Dynamic =
            (value13 !== null || (options2.transform || "none") === "none") &&
            value14[1] === 0 &&
            value14[2] === 0 &&
            (options2.rotate || "none") === "none" &&
            value15.length < 3,
          [items3, items4]: Dynamic = [
            Math.abs(value14[0] * value15[0]),
            Math.abs(value14[3] * (value15[1] ?? value15[0])),
          ];
        return input && value16 && items3 > 0 && items4 > 0
          ? [input[0] * items3, input[1] * items4]
          : null;
      },
      callback3: Dynamic = (
        input?: Dynamic,
        options2?: Dynamic,
        context2?: Dynamic,
        value13?: Dynamic,
      ): Dynamic => {
        let value14: Dynamic = parseFloat(input),
          value15: Dynamic = 64 * (argument || 1) * count,
          value16: Dynamic =
            0.5 *
              Math.pow(
                10,
                Math.max(1, Math.floor(Math.log10(Math.max(value14, 1))) + 1) -
                  6,
              ) +
            value14 * 24e-8,
          value17: Dynamic = Math.ceil((value14 - value16) * value15),
          value18: Dynamic = Math.floor((value14 + value16) * value15);
        if (value18 > value17) {
          if (value13 === undefined) return input;
          let callback6: Dynamic = (input2?: Dynamic): Dynamic => {
              let value21: Dynamic = parseFloat(input2) || 0,
                value22: Dynamic =
                  (0.5 *
                    Math.pow(
                      10,
                      Math.max(
                        1,
                        Math.floor(Math.log10(Math.max(value21, 1))) + 1,
                      ) - 6,
                    ) +
                    value21 * 24e-8) *
                  value15,
                [items3, items4]: Dynamic = [
                  Math.floor(value21 * value15 - value22),
                  Math.floor(value21 * value15 + value22),
                ];
              return Math.abs(
                value21 * value15 - Math.round(value21 * value15),
              ) < 1e-6
                ? Math.round(value21 * value15)
                : items3 === items4
                  ? items3
                  : NaN;
            },
            callback7: Dynamic = (input2?: Dynamic): Dynamic =>
              Math.round((parseFloat(input2) || 0) * value15),
            bounds: Dynamic = options2.getBoundingClientRect(),
            value19: Dynamic =
              context2.boxSizing === "border-box"
                ? 0
                : value13
                  ? callback6(context2.paddingLeft) +
                    callback6(context2.paddingRight) +
                    callback7(context2.borderLeftWidth) +
                    callback7(context2.borderRightWidth)
                  : callback6(context2.paddingTop) +
                    callback6(context2.paddingBottom) +
                    callback7(context2.borderTopWidth) +
                    callback7(context2.borderBottomWidth),
            value20: Dynamic = items
              ? Math.round(
                  (value13
                    ? bounds.width / items[0]
                    : bounds.height / items[1]) *
                    64 *
                    (argument || 1),
                ) - value19
              : -1;
          value17 =
            value20 >= value17 && value20 <= value18 ? value20 : value18;
        }
        return value18 < value17
          ? input
          : ((value17 + 0.25) / value15).toFixed(7) + "px";
      },
      value5: Dynamic =
        /^[A-Z_a-z\xC0-\xD6\xD8-\xF6\xF8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD\u{10000}-\u{EFFFF}][-.0-9A-Z_a-z\xB7\xC0-\xD6\xD8-\xF6\xF8-\u037D\u037F-\u1FFF\u200C\u200D\u203F\u2040\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD\u{10000}-\u{EFFFF}]*$/u,
      callback4: Dynamic = (input?: Dynamic): Dynamic =>
        input.indexOf("]]>") >= 0 ||
        /[{};"'\x00-\x1f]|\/\*/.test(
          input.replace(/"(?:[^"\\\n\r\f]|\\.)*"|'(?:[^'\\\n\r\f]|\\.)*'/g, ""),
        ),
      value6: Dynamic = /(^|[\s,(/])url\((?!\s*["']?(data:|#))/,
      callback5: Dynamic = (input?: Dynamic, items3?: Dynamic): Dynamic => {
        let text: Dynamic = "";
        for (let index6: Dynamic = 0; index6 < items3.length; index6++) {
          let value13: Dynamic = items3[index6],
            value14: Dynamic = input.getPropertyValue(value13);
          !value14 ||
            value13 === "content" ||
            value13 === "-webkit-border-image" ||
            value13.slice(0, 2) === "--" ||
            callback4(value14) ||
            (value6.test(value14)
              ? value.push(
                  "pseudo-element " +
                    value13 +
                    " image not rendered (only data: images are carried): " +
                    value14,
                )
              : (text += value13 + ":" + value14 + ";"));
        }
        return text + "animation:none;transition:none;";
      },
      index3: Dynamic = 0,
      items2: Dynamic = [
        "color",
        "font-family",
        "font-feature-settings",
        "font-kerning",
        "font-size",
        "font-stretch",
        "font-style",
        "font-variant-caps",
        "font-variant-ligatures",
        "font-variant-numeric",
        "font-weight",
        "letter-spacing",
        "line-height",
        "text-shadow",
        "text-transform",
        "word-spacing",
        "-webkit-text-fill-color",
        "-webkit-text-stroke-color",
        "-webkit-text-stroke-width",
      ],
      state: Dynamic = {
        float: "none",
        "vertical-align": "baseline",
        opacity: "1",
        "background-color": "rgba(0, 0, 0, 0)",
        "background-image": "none",
        "box-shadow": "none",
        "text-decoration-line": "none",
        "margin-top": "0px",
        "margin-right": "0px",
        "margin-bottom": "0px",
        "margin-left": "0px",
        "padding-top": "0px",
        "padding-right": "0px",
        "padding-bottom": "0px",
        "padding-left": "0px",
        "border-top-width": "0px",
        "border-right-width": "0px",
        "border-bottom-width": "0px",
        "border-left-width": "0px",
      },
      value7: Dynamic = items2.concat(Object.keys(state), [
        "border-top-style",
        "border-right-style",
        "border-bottom-style",
        "border-left-style",
        "border-top-color",
        "border-right-color",
        "border-bottom-color",
        "border-left-color",
        "border-top-left-radius",
        "border-top-right-radius",
        "border-bottom-right-radius",
        "border-bottom-left-radius",
        "background-clip",
        "text-decoration-color",
        "text-decoration-style",
      ]),
      index4: Dynamic = 0,
      value8: Dynamic =
        /^(fill|stroke|marker|color|clip-rule$|visibility$|paint-order$|shape-rendering$|text-rendering$|font-|letter-spacing$|word-spacing$|text-anchor$|dominant-baseline$|writing-mode$|direction$)/,
      state2: Dynamic = {
        "overflow-x": "hidden",
        "overflow-y": "hidden",
        opacity: "1",
        "clip-path": "none",
        "mask-image": "none",
        filter: "none",
        transform: "none",
        "transform-origin": "0px 0px",
        "mix-blend-mode": "normal",
        isolation: "auto",
      };
    function value9(input?: Dynamic, options2?: Dynamic): Dynamic {
      let value13: Dynamic;
      try {
        value13 = options(input, "::first-letter");
      } catch {
        return "";
      }
      let flag: Dynamic = false;
      for (let index6: Dynamic = 0; index6 < items2.length && !flag; index6++) {
        let value14: Dynamic = value13.getPropertyValue(items2[index6]);
        flag =
          !!value14 && value14 !== options2.getPropertyValue(items2[index6]);
      }
      for (let value14 in state)
        !flag &&
          (value13.getPropertyValue(value14) || state[value14]) !==
            state[value14] &&
          (flag = true);
      return flag ? callback5(value13, value7) : "";
    }
    function value10(
      input?: Dynamic,
      options2?: Dynamic,
      context2?: Dynamic,
    ): Dynamic {
      let value13: Dynamic = options(input, options2),
        content: Dynamic = value13.content;
      if (!content || content === "none" || content === "normal") return null;
      let value14: Dynamic;
      try {
        value14 = JSON.parse(content);
      } catch {}
      let value15: Dynamic =
        detail &&
        value13.getPropertyValue("visibility") === "hidden" &&
        options(input).getPropertyValue("visibility") === "hidden"
          ? "visibility:inherit;"
          : "";
      if (
        typeof value14 != "string" &&
        extra &&
        !callback4(content) &&
        !value6.test(value13.getPropertyValue("background-image"))
      ) {
        value6.test(content) &&
          value.push(
            "::before/::after content image not rendered (only data: images are carried): " +
              content,
          );
        let value17: Dynamic =
          options2 === "::before" ? "data-om-cap-pb" : "data-om-cap-pa";
        context2.setAttribute(value17, String(index3));
        extra.push(
          "[" +
            value17 +
            '="' +
            index3 +
            '"]' +
            options2 +
            "{" +
            callback5(value13, value13) +
            value15 +
            "content:" +
            content +
            ";}",
        );
        index3++;
        return null;
      }
      let value16: Dynamic = doc.createElement("span"),
        text: Dynamic = "";
      for (let index6: Dynamic = 0; index6 < value13.length; index6++) {
        let value17: Dynamic = value13[index6];
        value17 !== "-webkit-border-image" &&
          (text += value17 + ":" + value13.getPropertyValue(value17) + ";");
      }
      text += "animation:none;transition:none;" + value15;
      value16.setAttribute("style", text);
      typeof value14 == "string"
        ? (value16.textContent = value14)
        : value.push(
            "::before/::after content not rendered (only single quoted-string content is synthesized): " +
              content,
          );
      return value16;
    }
    let index5: Dynamic = 0;
    function value11(element?: Dynamic): Dynamic {
      try {
        if (!element.getAttribute("placeholder") || element.value) return "";
        let value13: Dynamic = options(element, "::placeholder"),
          items3: Dynamic = [
            "color",
            "opacity",
            "font-family",
            "font-size",
            "font-style",
            "font-weight",
            "letter-spacing",
            "text-transform",
            "-webkit-text-fill-color",
          ],
          text: Dynamic = "";
        for (let index6: Dynamic = 0; index6 < items3.length; index6++) {
          let value15: Dynamic = value13.getPropertyValue(items3[index6]);
          value15 && (text += items3[index6] + ":" + value15 + ";");
        }
        let value14: Dynamic = text;
        for (; value14.indexOf("]]>") >= 0; )
          value14 = value14.split("]]>").join("");
        return value14;
      } catch {
        return "";
      }
    }
    function value12(input?: Dynamic): Dynamic {
      if (input.nodeType === 8 || input.nodeType === 7)
        return doc.createTextNode("");
      if (input.nodeType !== 1) {
        let value31: Dynamic = input.cloneNode(false);
        for (
          let firstChild: Dynamic = input.firstChild;
          firstChild;
          firstChild = firstChild.nextSibling
        )
          value31.appendChild(value12(firstChild));
        return value31;
      }
      let value13: Dynamic = input,
        value14: Dynamic = value13.tagName.toUpperCase();
      if (
        value14 === "SCRIPT" ||
        value14 === "STYLE" ||
        value13.hasAttribute("data-omelette-chrome") ||
        value13.hasAttribute("data-noncommentable") ||
        value13.hasAttribute("data-dc-editor-overlay")
      )
        return doc.createTextNode("");
      value14 === "IFRAME" &&
        value.push(
          "<iframe> content is not captured (src=" +
            (value13.getAttribute("src") || "about:blank") +
            ")",
        );
      let value15: Dynamic;
      if (value5.test(value13.localName)) value15 = value13.cloneNode(false);
      else if (value13.namespaceURI === "http://www.w3.org/1999/xhtml")
        value15 = doc.createElement("span");
      else return doc.createTextNode("");
      for (
        let value31: Dynamic = value15.attributes.length - 1;
        value31 >= 0;
        value31--
      ) {
        let value32: Dynamic = value15.attributes[value31];
        (value32.namespaceURI === null
          ? value32.name === "xmlns" ||
            !value5.test(value32.name) ||
            value32.name.indexOf("data-om-cap-") === 0
          : !value32.value &&
            value32.namespaceURI === "http://www.w3.org/2000/xmlns/") &&
          value15.removeAttributeNode(value32);
      }
      let value16: Dynamic =
          value13.namespaceURI === "http://www.w3.org/2000/svg",
        value17: Dynamic =
          value16 &&
          /^(clipPath|mask|pattern|marker|linearGradient|radialGradient|filter)$/.test(
            value13.localName,
          );
      if (
        value16 &&
        (index2 > 0 ? !value17 : /^(symbol|defs)$/.test(value13.localName))
      ) {
        let value31: Dynamic = value13.localName === "symbol",
          value32: Dynamic = options(value13);
        value13.parentElement !== value3 &&
          ((value3 = value13.parentElement),
          (value4 = value3 ? options(value3) : null));
        let text2: Dynamic = "";
        for (let index6: Dynamic = 0; index6 < value32.length; index6++) {
          let value33: Dynamic = value32[index6],
            value34: Dynamic = value32.getPropertyValue(value33);
          !value34 ||
            value33.slice(0, 2) === "--" ||
            value33 === "-webkit-border-image" ||
            ((value31 || index2 === 0) && !value8.test(value33)
              ? !value31 ||
                state2[value33] === undefined ||
                state2[value33] === value34
              : value4 && value4.getPropertyValue(value33) === value34) ||
            (value34 === value32.color &&
              (/currentcolor/i.test(value13.getAttribute(value33) || "") ||
                /currentcolor/i.test(
                  (value13.style && value13.style.getPropertyValue(value33)) ||
                    "",
                )) &&
              (value34 = "currentcolor"),
            (text2 += value33 + ":" + value34 + ";"));
        }
        let attribute: Dynamic = value13.getAttribute("style");
        text2 &&
          value15.setAttribute(
            "style",
            (attribute ? attribute.replace(/[;\s]*$/, ";") : "") + text2,
          );
        index2++;
        try {
          for (
            let firstChild: Dynamic = value13.firstChild;
            firstChild;
            firstChild = firstChild.nextSibling
          )
            value15.appendChild(value12(firstChild));
        } finally {
          index2--;
        }
        return value15;
      }
      if (value13.namespaceURI === "http://www.w3.org/1999/xhtml")
        if (value14 === "INPUT") {
          let value31: Dynamic = value13,
            value32: Dynamic = (value31.type || "").toLowerCase();
          value32 === "checkbox" || value32 === "radio"
            ? value31.checked
              ? value15.setAttribute("checked", "")
              : value15.removeAttribute("checked")
            : !/^(file|submit|reset|button|image|hidden)$/.test(value32) &&
              typeof value31.value == "string" &&
              value15.setAttribute(
                "value",
                value32 === "password"
                  ? "\u2022".repeat(value31.value.length)
                  : value31.value,
              );
        } else
          value14 === "OPTION" &&
            (value13.selected
              ? value15.setAttribute("selected", "")
              : value15.removeAttribute("selected"));
      let value18: Dynamic = options(value13),
        value19: Dynamic =
          (value14 === "PROGRESS" || value14 === "METER") &&
          value18.appearance === "auto" &&
          /^(transparent|rgba\(0, 0, 0, 0\))$/.test(value18.backgroundColor) &&
          value18.backgroundImage === "none" &&
          value18.borderImageSource === "none" &&
          value18.borderTopStyle === "none" &&
          value18.borderRightStyle === "none" &&
          value18.borderBottomStyle === "none" &&
          value18.borderLeftStyle === "none" &&
          value18.borderTopLeftRadius === "0px" &&
          value18.borderTopRightRadius === "0px" &&
          value18.borderBottomRightRadius === "0px" &&
          value18.borderBottomLeftRadius === "0px",
        value20: Dynamic = count,
        value21: Dynamic = value20 * (parseFloat(value18.zoom) || 1),
        value22: Dynamic =
          !!argument && value13.namespaceURI === "http://www.w3.org/1999/xhtml",
        value23: Dynamic = !/^(vertical|sideways)/.test(
          value18.writingMode || "",
        ),
        value24: Dynamic =
          (value18.columnCount || "auto") !== "auto" ||
          (value18.columnWidth || "auto") !== "auto" ||
          (/flex$/.test(value18.display) &&
            /^column/.test(value18.flexDirection || "") &&
            (value18.flexWrap || "nowrap") !== "nowrap"),
        callback6: Dynamic = (input2?: Dynamic): Dynamic =>
          input2 === "inline-size" ||
          input2 === (value23 ? "width" : "height") ||
          (value24 &&
            (input2 === "block-size" ||
              input2 === (value23 ? "height" : "width"))),
        value25: Dynamic = items;
      if (value22 && index === 0)
        for (
          let value31: Dynamic = callback(value13);
          value31 && items;
          value31 = callback(value31)
        )
          items = callback2(items, options(value31));
      let value26: Dynamic = callback2(items, value18),
        text: Dynamic = "";
      count = value21;
      items = value26;
      for (let index6: Dynamic = 0; index6 < value18.length; index6++) {
        let value31: Dynamic = value18[index6];
        if (
          value31 === "-webkit-border-image" ||
          (value19 && /^(background|border)/.test(value31))
        )
          continue;
        let value32: Dynamic = value18.getPropertyValue(value31);
        value31 === "-webkit-text-fill-color" &&
          value32 === value18.color &&
          (value32 = "currentcolor");
        let value33: Dynamic = callback6(value31)
          ? value31 === "width" ||
            (value31 !== "height" && (value31 === "inline-size") === value23)
          : undefined;
        text +=
          value31 +
          ":" +
          (value22 &&
          (value33 !== undefined || value2.test(value31)) &&
          /^\d+(\.\d+)?px$/.test(value32) &&
          parseFloat(value32) > 0
            ? callback3(value32, value13, value18, value33)
            : value32) +
          ";";
      }
      count = value20;
      items = value25;
      text += "animation:none;transition:none;";
      if (detail) {
        if (value13 === detail) text += "visibility:visible;opacity:1;";
        else if (value18.getPropertyValue("visibility") === "hidden") {
          let value31: Dynamic = value13.getRootNode(),
            value32: Dynamic =
              value13.parentElement || (value31 && value31.host);
          value32 &&
            options(value32).getPropertyValue("visibility") === "hidden" &&
            (text += "visibility:inherit;");
        }
      }
      context &&
        (value13 === doc.documentElement || value13 === doc.body) &&
        (text += "background:transparent;");
      value13 === doc.documentElement &&
        value13.hasAttribute("data-dc-canvas") &&
        (text += "overflow:visible;");
      value15.setAttribute("style", text);
      if (extra && (value14 === "INPUT" || value14 === "TEXTAREA")) {
        let value31: Dynamic = value11(value13);
        value31 &&
          (value15.setAttribute("data-om-cap-ph", String(index5)),
          extra.push(
            '[data-om-cap-ph="' + index5 + '"]::placeholder{' + value31 + "}",
          ),
          index5++);
      }
      if (
        extra &&
        value13.firstChild &&
        value13.namespaceURI === "http://www.w3.org/1999/xhtml" &&
        /^(block|list-item|inline-block|flow-root|table-cell|table-caption)$/.test(
          value18.display,
        )
      ) {
        let value31: Dynamic = value9(value13, value18);
        value31 &&
          (value15.setAttribute("data-om-cap-fl", String(index4)),
          extra.push(
            '[data-om-cap-fl="' + index4 + '"]::first-letter{' + value31 + "}",
          ),
          index4++);
      }
      if (value14 === "CANVAS")
        try {
          let __omCapGl: Dynamic = value13.__omCapGl,
            value31: Dynamic = doc.createElement("img");
          if (__omCapGl && __omCapGl.url) value31.src = __omCapGl.url;
          else {
            let value32: Dynamic = value13.toDataURL();
            if (__omCapGl && !__omCapGl.url) {
              let value33: Dynamic = doc.createElement("canvas");
              value33.width = value13.width;
              value33.height = value13.height;
              value32 === value33.toDataURL() &&
                value.push(
                  "canvas read back blank (either empty, or a WebGL canvas whose buffer cannot be read without preserveDrawingBuffer) \u2014 it may render blank in the export",
                );
            }
            value31.src = value32;
          }
          value31.setAttribute("style", text);
          return value31;
        } catch {
          value.push(
            "<canvas> could not be serialized (tainted by cross-origin content)",
          );
        }
      if (value14 === "VIDEO" && value13.readyState >= 2)
        try {
          let value31: Dynamic = value13,
            value32: Dynamic = doc.createElement("canvas");
          value32.width = value31.videoWidth || value31.clientWidth;
          value32.height = value31.videoHeight || value31.clientHeight;
          let value33: Dynamic = value32.getContext("2d");
          if (value33) {
            value33.drawImage(value31, 0, 0, value32.width, value32.height);
            let value34: Dynamic = doc.createElement("img");
            value34.src = value32.toDataURL();
            value34.setAttribute("style", text);
            value34.width = value31.clientWidth;
            value34.height = value31.clientHeight;
            return value34;
          }
        } catch {
          value.push(
            "<video> frame could not be serialized (tainted by cross-origin content)",
          );
        }
      value14 === "VIDEO" &&
        value13.readyState < 2 &&
        value.push(
          "<video> had no frame to draw: its image could not be embedded (renders blank in the export)",
        );
      if (
        value14 === "SVG" &&
        value13.ownerSVGElement == null &&
        value13.hasAttribute("data-om-exportable-video-with-duration-secs")
      ) {
        let element: Dynamic = value13.querySelector("foreignObject");
        if (element)
          try {
            let value31: Dynamic = doc.createElement("div");
            value31.setAttribute("style", text);
            count = value21;
            items = value26;
            index++;
            try {
              for (
                let firstChild: Dynamic = element.firstChild;
                firstChild;
                firstChild = firstChild.nextSibling
              )
                value31.appendChild(value12(firstChild));
            } finally {
              count = value20;
              items = value25;
              index--;
            }
            return value31;
          } catch (value31: Dynamic) {
            value.push(
              "inline <svg><foreignObject> could not be unwrapped: " +
                ((value31 && value31.message) || String(value31)),
            );
          }
      }
      let value27: Dynamic = value10(value13, "::before", value15);
      value27 && value15.appendChild(value27);
      let value28: Dynamic;
      if (value13.shadowRoot) value28 = value13.shadowRoot.childNodes;
      else if (value14 === "TEXTAREA" && typeof value13.value == "string")
        value28 = [doc.createTextNode(value13.value)];
      else if (value14 === "SLOT") {
        let value31: Dynamic = value13.assignedNodes({
          flatten: true,
        });
        value28 = value31.length ? value31 : value13.childNodes;
      } else value28 = value13.childNodes;
      count = value21;
      items = value26;
      let value29: Dynamic = index2;
      value17 && (index2 = 0);
      index++;
      try {
        for (let index6: Dynamic = 0; index6 < value28.length; index6++) {
          let value31: Dynamic = value28[index6];
          value31 && value15.appendChild(value12(value31));
        }
      } finally {
        count = value20;
        items = value25;
        index2 = value29;
        index--;
      }
      let value30: Dynamic = value10(value13, "::after", value15);
      value30 && value15.appendChild(value30);
      return value15;
    }
    return value12;
  }
  bindRuntimeValue(runtime, "captureElementStyle", () => captureElementStyle);
  return () => {};
}
