/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";
export function installEditorModelDcEditorModel(
  runtime: RuntimeBindings,
): () => void {
  var ModelDcEditorModelStyleScriptPattern: Dynamic;
  var ModelDcEditorModelAbbrCitePattern: Dynamic;
  var DcEditorModel: Dynamic;
  bindRuntimeValue(
    runtime,
    "ModelDcEditorModelStyleScriptPattern",
    () => ModelDcEditorModelStyleScriptPattern,
    (value) => {
      ModelDcEditorModelStyleScriptPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ModelDcEditorModelAbbrCitePattern",
    () => ModelDcEditorModelAbbrCitePattern,
    (value) => {
      ModelDcEditorModelAbbrCitePattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DcEditorModel",
    () => DcEditorModel,
    (value) => {
      DcEditorModel = value;
    },
  );
  return () => {
    ModelDcEditorModelStyleScriptPattern =
      /^(style|script|template|title|noscript|textarea|helmet|sc-helmet|sc-raw-script|sc-raw-style)$/i;
    ModelDcEditorModelAbbrCitePattern =
      /^(a|abbr|b|bdi|bdo|cite|code|em|font|i|kbd|label|mark|q|s|samp|small|span|strong|sub|sup|time|u|var)$/i;
    DcEditorModel = class value {
      tpl: Dynamic;
      byTid: Dynamic = new Map();
      classRuleCache: Dynamic = null;
      pageTextCache: Dynamic;
      serialized: Dynamic = null;
      edits: Dynamic = null;
      raw: Dynamic;
      constructor(input: Dynamic, options: Dynamic) {
        this.raw = options?.raw ?? false;
        this.tpl = (document as Dynamic).createElement("template");
        this.tpl.innerHTML = this.raw
          ? input
          : (0, runtime.toParserHtml)(input);
        typeof MutationObserver !== "undefined" &&
          ((this.edits = new MutationObserver((): Dynamic => {
            this.serialized = null;
          })),
          this.edits.observe(this.tpl.content, {
            subtree: true,
            childList: true,
            attributes: true,
            characterData: true,
          }));
        this.restamp();
        for (let value2 of this.byTid.values() as Dynamic)
          (0, runtime.isImportedIcon)(value2) &&
            !value2.hasAttribute("data-uneditable") &&
            value2.setAttribute("data-uneditable", "");
      }
      rebuild(input: Dynamic): Dynamic {
        return new value(input, {
          raw: this.raw,
        });
      }
      rootText(): Dynamic {
        return [...this.tpl.content.childNodes]
          .map(
            (input?: Dynamic): Dynamic =>
              input.nodeType === 3 ? (input.nodeValue ?? "") : "",
          )
          .join("");
      }
      textRuns(): Dynamic {
        let items: Dynamic = [],
          text: Dynamic = "",
          callback: Dynamic = (): Dynamic => {
            text.trim() !== "" && items.push(text);
            text = "";
          },
          callback2: Dynamic = (input?: Dynamic): Dynamic => {
            for (let value2 of input.childNodes as Dynamic) {
              value2.nodeType === Node.TEXT_NODE &&
                (text += value2.nodeValue ?? "");
              if (value2.nodeType !== Node.ELEMENT_NODE) continue;
              let value3: Dynamic = value2;
              ModelDcEditorModelStyleScriptPattern.test(value3.tagName) ||
                value3.hasAttribute("hidden") ||
                (ModelDcEditorModelAbbrCitePattern.test(value3.tagName)
                  ? callback2(value3)
                  : (callback(), callback2(value3), callback()));
            }
          };
        callback2(this.tpl.content);
        callback();
        return items;
      }
      element(input: Dynamic): Dynamic {
        return this.byTid.get(input) ?? null;
      }
      elementsByAttr(input: Dynamic, options: Dynamic): Dynamic {
        let items: Dynamic = [];
        for (let value2 of this.byTid.values() as Dynamic)
          value2.getAttribute(input) === options && items.push(value2);
        return items;
      }
      isUneditable(input: Dynamic): Dynamic {
        let value2: Dynamic = this.element(input);
        return value2
          ? value2.hasAttribute("data-uneditable") ||
              value2.tagName.toLowerCase() === "deck-stage"
          : false;
      }
      targetParentLocked(input: Dynamic, options: Dynamic): Dynamic {
        if (input == null) return false;
        let value2: Dynamic = this.element(input);
        if (!value2) return false;
        let value3: Dynamic =
          options === "into" ? value2 : value2.parentElement;
        return value3
          ? value3.tagName.toLowerCase() === "deck-stage" ||
              value3.hasAttribute("data-uneditable")
          : false;
      }
      isLoopDriven(input: Dynamic): Dynamic {
        let value2: Dynamic = this.element(input);
        for (; value2; ) {
          if (value2.tagName.toLowerCase() === "sc-for") return true;
          value2 = value2.parentElement;
        }
        return false;
      }
      elementCount(): Dynamic {
        return this.byTid.size;
      }
      sameSkeleton(input: Dynamic): Dynamic {
        if (this.byTid.size !== input.elementCount()) return false;
        for (let [value2, value3] of this.byTid as Dynamic)
          if (input.element(value2)?.tagName !== value3.tagName) return false;
        return true;
      }
      survivesReparse(): Dynamic {
        let value2: Dynamic = this.serialize();
        return this.rebuild(value2).serialize() === value2;
      }
      serialize(): Dynamic {
        if (
          this.edits !== null &&
          this.edits.takeRecords().length === 0 &&
          this.serialized !== null
        )
          return this.serialized;
        let value2: Dynamic = this.tpl.cloneNode(true);
        for (let value4 of value2.content.querySelectorAll(
          `[${runtime.DcTplAttribute}]`,
        ) as Dynamic)
          value4.removeAttribute(runtime.DcTplAttribute);
        let value3: Dynamic = (0, runtime.fromParserHtml)(value2.innerHTML);
        this.edits !== null && (this.serialized = value3);
        return value3;
      }
      snapshot(): Dynamic {
        let values: Dynamic = new Set(["SCRIPT", "STYLE", "NOSCRIPT"]),
          items: Dynamic = [],
          callback: Dynamic = (input?: Dynamic, options?: Dynamic): Dynamic => {
            let value2: Dynamic = "  ".repeat(options),
              value3: Dynamic = this.raw
                ? input.tagName.toLowerCase()
                : (0, runtime.readableTagName)(input.tagName.toLowerCase()),
              value4: Dynamic = `${value2}<${value3}`;
            for (let value5 of input.attributes as Dynamic)
              value5.name !== runtime.DcTplAttribute &&
                (value4 += ` ${value5.name}="${value5.value.replace(/"/g, "&quot;").replace(/\n/g, " ")}"`);
            items.push(`${value4}>`);
            if (values.has(input.tagName)) items.push(`${value2}  \u2026`);
            else {
              let value5: Dynamic = input.closest("pre, textarea") != null;
              for (let value6 of input.childNodes as Dynamic)
                if (value6.nodeType === Node.ELEMENT_NODE)
                  callback(value6, options + 1);
                else if (value6.nodeType === Node.TEXT_NODE) {
                  let value7: Dynamic = value6.nodeValue ?? "";
                  if (value5)
                    for (let value8 of value7.split(`
`) as Dynamic)
                      items.push(`${value2}  ${value8}`);
                  else {
                    let value8: Dynamic = value7.replace(/\s+/g, " ").trim();
                    value8 && items.push(`${value2}  ${value8}`);
                  }
                }
            }
            items.push(`${value2}</${value3}>`);
          };
        for (let value2 of this.tpl.content.children as Dynamic)
          callback(value2, 0);
        return items.join(`
`);
      }
      setStyleProperty(
        input: Dynamic,
        options: Dynamic,
        context: Dynamic,
      ): Dynamic {
        let value2: Dynamic = this.element(input);
        if (!value2) return false;
        let value3: Dynamic = (0, runtime.setStyleProperty)(
          (0, runtime.expandShorthandForProperty)(
            value2.getAttribute("style"),
            options,
            context === null,
          ),
          options,
          context,
        );
        value3 === ""
          ? value2.removeAttribute("style")
          : value2.setAttribute("style", value3);
        return true;
      }
      setInlineStyleAttr(input: Dynamic, options: Dynamic): Dynamic {
        let value2: Dynamic = this.element(input);
        return value2
          ? (options === ""
              ? value2.removeAttribute("style")
              : value2.setAttribute("style", options),
            true)
          : false;
      }
      setText(input: Dynamic, options: Dynamic): Dynamic {
        let value2: Dynamic = this.element(input);
        return !value2 ||
          (value2.tagName !== "TEXTAREA" &&
            !(0, runtime.hasOnlyDirectText)(value2))
          ? false
          : ((value2.textContent = options),
            value2.tagName === "STYLE" && (this.classRuleCache = null),
            true);
      }
      setAttribute(
        input: Dynamic,
        options: Dynamic,
        context: Dynamic,
      ): Dynamic {
        let value2: Dynamic = this.element(input);
        if (!value2) return false;
        let value3: Dynamic = /[A-Z]/.test(options)
          ? runtime.ScCamelValue +
            options.replace(
              /[A-Z]/g,
              (input2?: Dynamic): Dynamic => "-" + input2.toLowerCase(),
            )
          : options;
        context == null || context === ""
          ? value2.removeAttribute(value3)
          : value2.setAttribute(value3, context);
        return true;
      }
      pageFillStageTid(): Dynamic {
        let value2: Dynamic = this.childTids(null).find(
            (input?: Dynamic): Dynamic =>
              !/^(helmet|sc-helmet|script|style|template)$/i.test(
                this.tagName(input) ?? "",
              ),
          ),
          value3: Dynamic = value2 == null ? null : this.element(value2);
        if (
          !value3 ||
          value3.tagName.toLowerCase() !== "section" ||
          !(value3.getAttribute("class") ?? "").split(/\s+/).includes("stage")
        )
          return null;
        let callback: Dynamic = (input?: Dynamic): Dynamic =>
          (0, runtime.getStyleProperty)(
            value3.getAttribute("style"),
            input,
          ).replace(/\s/g, "");
        return callback("width") === "100%" &&
          callback("height") === "100vh" &&
          (callback("background") || callback("background-color"))
          ? value2
          : null;
      }
      pageSheets(): Dynamic {
        let items: Dynamic = [
          ...this.tpl.content.querySelectorAll("sc-helmet style"),
        ];
        return {
          styles: items,
          css: items
            .map((input?: Dynamic): Dynamic => input.textContent ?? "")
            .join(runtime.HtmlAuthoringCss),
        };
      }
      pageFill(): Dynamic {
        let value2: Dynamic = this.pageFillStageTid(),
          { css: value3 }: Dynamic = this.pageSheets(),
          callback: Dynamic = (input?: Dynamic, options?: Dynamic): Dynamic =>
            value2 != null
              ? this.inlineStyleValue(value2, options)
              : (0, runtime.getCssRuleProperty)(value3, input, options),
          state: Dynamic = {
            background: callback("body", "background"),
            backgroundColor: callback("body", "background-color"),
            vars: {},
          };
        !state.background &&
          !state.backgroundColor &&
          (state = {
            ...state,
            background: callback("html", "background"),
            backgroundColor: callback("html", "background-color"),
          });
        for (let value4 of [
          state.background,
          state.backgroundColor,
        ] as Dynamic) {
          let value5: Dynamic =
            value4 && (0, runtime.resolveCssVariable)(value3, "body", value4);
          value5 && (state.vars[value4] = value5);
        }
        return state;
      }
      setPageFill(input: Dynamic): Dynamic {
        let value2: Dynamic = this.pageFillStageTid();
        if (value2 != null) {
          let flag: Dynamic = false;
          for (let value7 of input as Dynamic)
            this.inlineStyleValue(value2, value7.prop) !==
              (value7.value ?? "") &&
              this.setStyleProperty(value2, value7.prop, value7.value) &&
              (flag = true);
          return flag;
        }
        let items: Dynamic = ["background", "background-color"],
          { styles: value3, css: value4 }: Dynamic = this.pageSheets();
        if (
          value3.some(
            (input2?: Dynamic): Dynamic =>
              (0, runtime.stripCssNestedContent)(input2.textContent ?? ""),
          )
        )
          return false;
        let value5: Dynamic =
          items.every(
            (input2?: Dynamic): Dynamic =>
              !(0, runtime.getCssRuleProperty)(value4, "body", input2),
          ) &&
          items.some(
            (input2?: Dynamic): Dynamic =>
              (0, runtime.getCssRuleProperty)(value4, "html", input2),
          )
            ? (0, runtime.updateCssRuleProperties)(
                value4,
                "html",
                items.map(
                  (input2?: Dynamic): Dynamic => ({
                    prop: input2,
                    value: null,
                  }),
                ),
                items,
                false,
              )
            : value4;
        value5 = (0, runtime.updateCssRuleProperties)(
          value5,
          "body",
          input,
          items,
        );
        let value6: Dynamic = value5.split(runtime.HtmlAuthoringCss);
        if (value5 === value4 || value6.length !== Math.max(1, value3.length))
          return false;
        if (value3.length === 0) {
          let value7: Dynamic = (document as Dynamic).createElement(
              "sc-helmet",
            ),
            value8: Dynamic = (document as Dynamic).createElement("style");
          value8.textContent = value6[0];
          value7.appendChild(value8);
          this.tpl.content.appendChild(value7);
        } else
          value6.forEach((input2?: Dynamic, options?: Dynamic): Dynamic => {
            value3[options].textContent !== input2 &&
              (value3[options].textContent = input2);
          });
        this.classRuleCache = null;
        return true;
      }
      trailingHelmet(): Dynamic {
        let lastElementChild: Dynamic = this.tpl.content.lastElementChild;
        return lastElementChild &&
          lastElementChild.tagName.toLowerCase() === "sc-helmet" &&
          lastElementChild !== this.tpl.content.firstElementChild
          ? lastElementChild
          : null;
      }
      ensureWebfontLink(input: Dynamic): Dynamic {
        let value2: Dynamic = (0, runtime.buildGoogleFontsUrl)(input),
          value3: Dynamic = input.trim().replace(/\s+/g, "+"),
          value4: Dynamic = new RegExp(
            "[?&]family=" + value3.replace(/\+/g, "\\+") + "(?:[:&]|$)",
            "i",
          );
        for (let value5 of this.tpl.content.querySelectorAll(
          'link[rel="stylesheet"]',
        ) as Dynamic)
          if (
            value4.test(
              (value5.getAttribute("href") ?? "").replace(/%20/gi, "+"),
            )
          )
            return false;
        this.appendHelmetLink(value2);
        return true;
      }
      appendHelmetLink(input: Dynamic): Dynamic {
        let value2: Dynamic = this.trailingHelmet();
        value2 ||
          ((value2 = (document as Dynamic).createElement("sc-helmet")),
          this.tpl.content.appendChild(value2));
        let value3: Dynamic = (document as Dynamic).createElement("link");
        value3.setAttribute("rel", "stylesheet");
        value3.setAttribute("href", input);
        value2.appendChild(value3);
      }
      helmetAssets(): Dynamic {
        let content: Dynamic = this.tpl.content,
          value2: Dynamic = [...content.children].filter(
            (input?: Dynamic): Dynamic =>
              input.tagName.toLowerCase() === "sc-helmet",
          ),
          items: Dynamic = [],
          value3: Dynamic =
            content.querySelectorAll("sc-helmet").length !== value2.length,
          values: Dynamic = new Set([
            "rel",
            "href",
            "crossorigin",
            "referrerpolicy",
            runtime.DcTplAttribute,
          ]);
        for (let value4 of value2.flatMap(
          (input?: Dynamic): Dynamic => [...input.children],
        ) as Dynamic) {
          let value5: Dynamic = value4.tagName.toLowerCase(),
            value6: Dynamic = (value4.getAttribute("rel") ?? "")
              .toLowerCase()
              .split(/\s+/);
          if (value5 === "style") {
            let value7: Dynamic = value4.textContent ?? "";
            [...value4.attributes].some(
              (input?: Dynamic): Dynamic =>
                input.name !== runtime.DcTplAttribute,
            ) || !(0, runtime.stripLeadingCssAtRules)(value7)
              ? (value3 = true)
              : value7.trim() !== "" &&
                items.push({
                  css: value7,
                });
          } else if (value5 === "link" && value6.includes("stylesheet")) {
            let value7: Dynamic = value4.getAttribute("href") ?? "";
            value7 === "" ||
            value6.length !== 1 ||
            [...value4.attributes].some(
              (input?: Dynamic): Dynamic => !values.has(input.name),
            )
              ? (value3 = true)
              : items.push({
                  link: value7,
                });
          } else
            (value5 === "link"
              ? !value6.every(
                  (input?: Dynamic): Dynamic =>
                    /^(preconnect|dns-prefetch|icon|)$/.test(input),
                )
              : value5 !== "title" && value5 !== "meta") && (value3 = true);
        }
        for (let value4 of content.querySelectorAll(
          'style, script, link[rel~="stylesheet" i]',
        ) as Dynamic)
          value4.closest("sc-helmet") || (value3 = true);
        return {
          assets: items,
          atomics: value2.some(
            (input?: Dynamic): Dynamic => input.hasAttribute("data-dc-atomics"),
          ),
          other: value3,
        };
      }
      carryHelmet(input: Dynamic): Dynamic {
        let callback: Dynamic = (input2?: Dynamic): Dynamic =>
            [...input2.attributes].every(
              (input3?: Dynamic): Dynamic =>
                input3.name === runtime.DcTplAttribute,
            ),
          values: Dynamic = new Set(
            this.pageSheets()
              .styles.filter(callback)
              .map(
                (input2?: Dynamic): Dynamic =>
                  (input2.textContent ?? "").trim(),
              ),
          ),
          values2: Dynamic = new Set(
            [
              ...this.tpl.content.querySelectorAll('link[rel~="stylesheet" i]'),
            ].map((element?: Dynamic): Dynamic => element.getAttribute("href")),
          ),
          items: Dynamic = [];
        for (let value5 of input as Dynamic) {
          let value6: Dynamic =
              "css" in value5 ? value5.css.trim() : value5.link,
            value7: Dynamic = "css" in value5 ? values : values2;
          value6 === "" ||
            value7.has(value6) ||
            (value7.add(value6), items.push(value5));
        }
        if (!items.some((input2?: Dynamic): Dynamic => "css" in input2)) {
          for (let value5 of items as Dynamic)
            "link" in value5 && this.appendHelmetLink(value5.link);
          return true;
        }
        let value2: Dynamic = [...this.tpl.content.children].filter(
            (input2?: Dynamic): Dynamic =>
              input2.tagName.toLowerCase() === "sc-helmet",
          ),
          callback2: Dynamic = (input2?: Dynamic): Dynamic =>
            [...input2.children].flatMap(
              (input3?: Dynamic, options?: Dynamic): Dynamic =>
                /^(link|meta|script)$/i.test(input3.tagName) ? [] : [options],
            ),
          items2: Dynamic = [...this.tpl.content.querySelectorAll("sc-helmet")],
          callback3: Dynamic = (input2?: Dynamic, options?: Dynamic): Dynamic =>
            items.every(
              (input3?: Dynamic, options2?: Dynamic): Dynamic =>
                "link" in input3 ||
                !items2.some(
                  (input4?: Dynamic): Dynamic =>
                    input4 !== input2 &&
                    callback2(input4).includes(options + options2),
                ),
            ),
          value3: Dynamic = this.trailingHelmet(),
          value4: Dynamic =
            value2.find(
              (input2?: Dynamic): Dynamic =>
                (input2 !== value3 || callback2(input2).length > 0) &&
                callback3(input2, input2.children.length),
            ) ?? null;
        if (!value4) {
          if (!callback3(null, 0)) return false;
          value4 = (document as Dynamic).createElement("sc-helmet");
          this.tpl.content.insertBefore(value4, this.tpl.content.firstChild);
        }
        for (let value5 of items as Dynamic) {
          let value6: Dynamic = (document as Dynamic).createElement(
            "css" in value5 ? "style" : "link",
          );
          "css" in value5
            ? (value6.textContent = value5.css.trim())
            : (value6.setAttribute("rel", "stylesheet"),
              value6.setAttribute("href", value5.link));
          value4.appendChild(value6);
        }
        this.classRuleCache = null;
        return true;
      }
      ensureHelmetAtomics(): Dynamic {
        if (this.tpl.content.querySelector("sc-helmet[data-dc-atomics]"))
          return false;
        let value2: Dynamic =
          [...this.tpl.content.children].find(
            (input?: Dynamic): Dynamic =>
              input.tagName.toLowerCase() === "sc-helmet",
          ) ?? null;
        value2 ||
          ((value2 = (document as Dynamic).createElement("sc-helmet")),
          this.tpl.content.insertBefore(value2, this.tpl.content.firstChild));
        value2.setAttribute("data-dc-atomics", "");
        return true;
      }
      findDeckStage(input: Dynamic): Dynamic {
        let callback: Dynamic = (element?: Dynamic): Dynamic => {
            let value2: Dynamic = element.tagName.toLowerCase();
            return (
              (value2 === "x-import" &&
                element.getAttribute("component-from-global-scope") ===
                  "deck-stage") ||
              value2 === "deck-stage"
            );
          },
          callback2: Dynamic = (input2?: Dynamic): Dynamic =>
            input2 !== "template" &&
            input2 !== "script" &&
            input2 !== "style" &&
            input2 !== "sc-helmet",
          callback3: Dynamic = (
            input2?: Dynamic,
            options?: Dynamic,
          ): Dynamic => ({
            mountTid: input2,
            slideEls: [...options.children].filter(
              (input3?: Dynamic): Dynamic =>
                callback2(input3.tagName.toLowerCase()),
            ),
            slideTids: this.childTids(input2).filter(
              (input3?: Dynamic): Dynamic =>
                callback2(this.element(input3)?.tagName.toLowerCase() ?? ""),
            ),
          });
        if (input !== undefined) {
          let value2: Dynamic = this.element(input);
          return value2 && callback(value2) ? callback3(input, value2) : null;
        }
        for (let [value2, value3] of this.byTid as Dynamic)
          if (callback(value3)) return callback3(value2, value3);
        return null;
      }
      speakerNotesJson(): Dynamic {
        let element: Dynamic = this.tpl.content.querySelector(
          "script#speaker-notes",
        );
        if (!element) return null;
        try {
          let value2: Dynamic = JSON.parse(element.textContent ?? "[]");
          return Array.isArray(value2)
            ? value2.map(
                (input?: Dynamic): Dynamic =>
                  typeof input == "string" ? input : "",
              )
            : null;
        } catch {
          return null;
        }
      }
      speakerNotes(input: Dynamic): Dynamic {
        let value2: Dynamic = this.findDeckStage(input),
          value3: Dynamic = this.speakerNotesJson();
        if (value2) {
          let value4: Dynamic = value2.slideEls.map(
            (element?: Dynamic): Dynamic =>
              element.getAttribute("data-speaker-notes"),
          );
          if (value4.some((input2?: Dynamic): Dynamic => input2 !== null))
            return value4.map(
              (input2?: Dynamic, options?: Dynamic): Dynamic =>
                input2 ?? value3?.[options] ?? "",
            );
        }
        return value3;
      }
      syncSpeakerNotesJson(input: Dynamic): Dynamic {
        let element: Dynamic = this.tpl.content.querySelector(
          "script#speaker-notes",
        );
        if (!element) return;
        let value2: Dynamic = this.speakerNotes(input);
        value2 !== null &&
          (element.textContent =
            `
` +
            (0, runtime.safeJsonStringify)(value2, {
              space: 2,
            }) +
            `
`);
      }
      setSpeakerNote(element: Dynamic, options: Dynamic): Dynamic {
        return element.getAttribute("data-speaker-notes") === options
          ? false
          : (element.setAttribute("data-speaker-notes", options), true);
      }
      attributes(input: Dynamic): Dynamic {
        let value2: Dynamic = this.element(input);
        if (!value2) return {};
        let state: Dynamic = {};
        for (let { name: value3, value: value4 } of [
          ...value2.attributes,
        ] as Dynamic) {
          if (value3 === runtime.DcTplAttribute || value3 === "style") continue;
          let value5: Dynamic = value3.startsWith(runtime.ScCamelValue)
            ? (0, runtime.kebabToCamelCase)(
                value3.slice(runtime.ScCamelValue.length),
              )
            : value3;
          state[value5] = value4;
        }
        return state;
      }
      removeElement(input: Dynamic): Dynamic {
        let value2: Dynamic = this.element(input);
        return value2
          ? (value2.remove(),
            (0, runtime.editorAssert)(
              !value2.isConnected || !this.tpl.content.contains(value2),
              `removeElement(${input}) left the element in the template`,
            ),
            true)
          : false;
      }
      restamp(): Dynamic {
        this.byTid.clear();
        this.classRuleCache = null;
        let index: Dynamic = 0,
          callback: Dynamic = (input?: Dynamic): Dynamic => {
            if (input.nodeType === Node.ELEMENT_NODE) {
              let value2: Dynamic = input;
              value2.setAttribute(runtime.DcTplAttribute, String(index));
              this.byTid.set(index, value2);
              index++;
              if (this.raw && value2.tagName === "NOSCRIPT") return;
            }
            for (let value2 of input.childNodes as Dynamic) callback(value2);
          };
        callback(this.tpl.content);
      }
      parentTid(input: Dynamic): Dynamic {
        let value2: Dynamic = this.element(input)?.parentElement;
        if (!value2) return null;
        let attribute: Dynamic = value2.getAttribute(runtime.DcTplAttribute);
        return attribute == null ? null : parseInt(attribute, 10);
      }
      childTids(input: Dynamic): Dynamic {
        let value2: Dynamic =
          input == null ? this.tpl.content : this.element(input);
        if (!value2) return [];
        let items: Dynamic = [];
        for (let value3 of value2.children as Dynamic) {
          let attribute: Dynamic = value3.getAttribute(runtime.DcTplAttribute);
          attribute != null && items.push(parseInt(attribute, 10));
        }
        return items;
      }
      wrapElements(input: Dynamic, options: Dynamic): Dynamic {
        let value2: Dynamic = input
            .map((input2?: Dynamic): Dynamic => this.element(input2))
            .filter((input2?: Dynamic): Dynamic => input2 != null),
          value3: Dynamic = value2
            .filter(
              (input2?: Dynamic): Dynamic =>
                !value2.some(
                  (input3?: Dynamic): Dynamic =>
                    input3 !== input2 && input3.contains(input2),
                ),
            )
            .sort(
              (input2?: Dynamic, options2?: Dynamic): Dynamic =>
                input2.compareDocumentPosition(options2) &
                Node.DOCUMENT_POSITION_FOLLOWING
                  ? -1
                  : 1,
            );
        if (value3.length === 0) return null;
        let parentNode: Dynamic = value3[0].parentNode;
        for (
          ;
          parentNode &&
          !value3.every(
            (input2?: Dynamic): Dynamic => parentNode.contains(input2),
          );

        )
          parentNode = parentNode.parentNode;
        if (!parentNode) return null;
        for (let value7 of value3 as Dynamic)
          for (
            let parentElement: Dynamic = value7.parentElement;
            parentElement && parentElement !== parentNode;
            parentElement = parentElement.parentElement
          ) {
            let value8: Dynamic = parentElement.tagName.toLowerCase();
            if (
              /^(sc-for|sc-if|svg|deck-stage|x-import|dc-import)$/.test(
                value8,
              ) ||
              parentElement.hasAttribute("data-uneditable")
            )
              return null;
          }
        if (
          parentNode instanceof Element &&
          (parentNode.tagName.toLowerCase() === "deck-stage" ||
            parentNode.hasAttribute("data-uneditable")) &&
          !value3.every(
            (input2?: Dynamic): Dynamic => input2.parentNode === parentNode,
          )
        )
          return null;
        let value4: Dynamic = value3[0];
        for (; value4.parentNode && value4.parentNode !== parentNode; )
          value4 = value4.parentNode;
        let value5: Dynamic = (document as Dynamic).createElement("template");
        value5.innerHTML = this.raw
          ? options
          : (0, runtime.toParserHtml)(options);
        let firstElementChild: Dynamic = value5.content.firstElementChild;
        if (!firstElementChild) return null;
        let value6: Dynamic = parentNode;
        for (
          ;
          value6 instanceof Element &&
          /^(sc-if|sc-for)$/.test(value6.tagName.toLowerCase());

        )
          value6 = value6.parentNode;
        if (value6 instanceof Element) {
          if (value6.namespaceURI !== "http://www.w3.org/1999/xhtml")
            return null;
          let value7: Dynamic = (0, runtime.readableTagName)(
            value6.tagName.toLowerCase(),
          );
          if (
            !(0, runtime.canContainHtmlTag)(value7, firstElementChild.tagName)
          ) {
            if (!(0, runtime.canContainHtmlTag)(value7, "span")) return null;
            let value8: Dynamic =
              firstElementChild.ownerDocument.createElement("span");
            for (let value9 of [...firstElementChild.attributes] as Dynamic)
              value8.setAttribute(value9.name, value9.value);
            firstElementChild = value8;
          }
        }
        parentNode.insertBefore(firstElementChild, value4);
        for (let value7 of value3 as Dynamic)
          firstElementChild.appendChild(value7);
        return firstElementChild;
      }
      wrapTextRuns(input: Dynamic, options: Dynamic): Dynamic {
        let value2: Dynamic = this.element(input),
          value3: Dynamic = this.tagName(input) ?? "";
        if (
          !value2 ||
          value2.namespaceURI !== "http://www.w3.org/1999/xhtml" ||
          !(0, runtime.canContainHtmlChildren)(value3) ||
          value3 === "helmet" ||
          value3 === "x-import" ||
          value3 === "dc-import"
        )
          return [];
        let callback: Dynamic = (input2?: Dynamic): Dynamic =>
            input2.nodeType === 3 && (input2.nodeValue ?? "").trim() !== "",
          callback2: Dynamic = (input2?: Dynamic): Dynamic =>
            (input2.nodeType === 3 && !callback(input2)) ||
            input2.nodeType === 8,
          callback3: Dynamic = (input2?: Dynamic): Dynamic =>
            options &&
            input2.nodeType === 1 &&
            runtime.HtmlTagNormalizationSubscribers.has(
              input2.tagName.toLowerCase(),
            ) &&
            [...input2.querySelectorAll("*")].every(
              (input3?: Dynamic): Dynamic =>
                runtime.HtmlTagNormalizationSubscribers.has(
                  input3.tagName.toLowerCase(),
                ),
            ),
          items: Dynamic = [],
          items2: Dynamic = [],
          callback4: Dynamic = (): Dynamic => {
            for (; items2.length > 0 && callback2(items2[items2.length - 1]); )
              items2.pop();
            items2.some(callback) && items.push(items2);
            items2 = [];
          };
        for (let value4 of [...value2.childNodes] as Dynamic)
          callback(value4) ||
          callback3(value4) ||
          (callback2(value4) && items2.length > 0)
            ? items2.push(value4)
            : callback4();
        callback4();
        let items3: Dynamic = [];
        for (let value4 of items as Dynamic) {
          let value5: Dynamic = value4[0];
          if (value5.nodeType === 3) {
            let length: Dynamic = /^\s*/.exec(value5.nodeValue ?? "")![0]
              .length;
            length > 0 && (value4[0] = value5.splitText(length));
          }
          let value6: Dynamic = value4[value4.length - 1];
          if (value6.nodeType === 3) {
            let value8: Dynamic = value6.nodeValue ?? "",
              value9: Dynamic =
                value8.length - value8.replace(/\s+$/, "").length;
            value9 > 0 && value6.splitText(value8.length - value9);
          }
          let value7: Dynamic = value2.ownerDocument.createElement("span");
          value2.insertBefore(value7, value4[0]);
          for (let value8 of value4 as Dynamic) value7.appendChild(value8);
          items3.push(value7);
        }
        for (let value4 of [...value2.children] as Dynamic) {
          if (!/^(sc-if|sc-for)$/.test(value4.tagName.toLowerCase())) continue;
          let value5: Dynamic = parseInt(
            value4.getAttribute("data-dc-tpl") ?? "-1",
            10,
          );
          value5 >= 0 && items3.push(...this.wrapTextRuns(value5, options));
        }
        return items3;
      }
      unwrapElement(input: Dynamic): Dynamic {
        let value2: Dynamic = this.element(input),
          value3: Dynamic = value2?.parentNode;
        if (!value2 || !value3) return null;
        let items: Dynamic = [...value2.children];
        for (; value2.firstChild; )
          value3.insertBefore(value2.firstChild, value2);
        value2.remove();
        return items;
      }
      isWithin(input: Dynamic, options: Dynamic): Dynamic {
        let value2: Dynamic = this.element(input),
          value3: Dynamic = this.element(options);
        for (; value3; ) {
          if (value3 === value2) return true;
          value3 = value3.parentElement;
        }
        return false;
      }
      duplicateElement(input: Dynamic): Dynamic {
        let value2: Dynamic = this.element(input);
        if (!value2 || !value2.parentNode) return null;
        let value3: Dynamic = value2.cloneNode(true);
        value2.parentNode.insertBefore(value3, value2.nextSibling);
        (0, runtime.regenerateArrowHeadIds)(this.tpl.content, [value3]);
        return value3;
      }
      subtreeHtml(input: Dynamic): Dynamic {
        let value2: Dynamic = this.element(input);
        if (!value2) return null;
        let value3: Dynamic = value2.cloneNode(true);
        value3.removeAttribute(runtime.DcTplAttribute);
        for (let value5 of value3.querySelectorAll(
          `[${runtime.DcTplAttribute}]`,
        ) as Dynamic)
          value5.removeAttribute(runtime.DcTplAttribute);
        let value4: Dynamic = (document as Dynamic).createElement("template");
        value4.content.appendChild(value3);
        return (0, runtime.fromParserHtml)(value4.innerHTML);
      }
      deckSlides(input: Dynamic): Dynamic {
        let value2: Dynamic = [
          ...this.tpl.content.querySelectorAll(
            'x-import[component-from-global-scope="deck-stage"], deck-stage',
          ),
        ][input];
        return value2
          ? [...value2.children].filter(
              (input2?: Dynamic): Dynamic =>
                !/^(template|script|style)$/i.test(input2.tagName),
            )
          : null;
      }
      resolveSlideAnchor(input: Dynamic): Dynamic {
        let value2: Dynamic = this.deckSlides(input.deck);
        if (!value2) return null;
        if (input.label != null) {
          let value3: Dynamic = value2.filter(
            (element?: Dynamic): Dynamic =>
              element.getAttribute("data-label") === input.label,
          );
          if (value3.length === 1) return value3[0];
        }
        return value2.length !== input.count
          ? null
          : (value2[input.index] ?? null);
      }
      topLevelTags(input: Dynamic): Dynamic {
        let value2: Dynamic = (document as Dynamic).createElement("template");
        value2.innerHTML = this.raw ? input : (0, runtime.toParserHtml)(input);
        return [...value2.content.children].map(
          (input2?: Dynamic): Dynamic =>
            (0, runtime.readableTagName)(input2.tagName.toLowerCase()),
        );
      }
      insertHtml(input: Dynamic, options: Dynamic, context: Dynamic): Dynamic {
        let value2: Dynamic = (document as Dynamic).createElement("template");
        value2.innerHTML = this.raw ? input : (0, runtime.toParserHtml)(input);
        let items: Dynamic = [...value2.content.children];
        if (items.length === 0) return null;
        let content: Dynamic = value2.content;
        if (context === "root-end" || options == null) {
          this.tpl.content.insertBefore(content, this.trailingHelmet());
          (0, runtime.regenerateArrowHeadIds)(this.tpl.content, items);
          return items;
        }
        let value3: Dynamic = this.element(options);
        if (!value3) return null;
        if (context === "into") {
          if (!(0, runtime.canContainHtmlChildren)(value3.tagName)) return null;
          value3.appendChild(content);
        } else if (value3.parentNode)
          context === "before"
            ? value3.parentNode.insertBefore(content, value3)
            : value3.parentNode.insertBefore(content, value3.nextSibling);
        else return null;
        (0, runtime.editorAssert)(
          items.every(
            (input2?: Dynamic): Dynamic => this.tpl.content.contains(input2),
          ),
          `insertHtml(${options}, ${context}) did not land in the template`,
        );
        (0, runtime.regenerateArrowHeadIds)(this.tpl.content, items);
        return items;
      }
      isRenderedInPlace(
        input: Dynamic,
        options: Dynamic,
        context: Dynamic,
      ): Dynamic {
        let value2: Dynamic = this.element(input),
          value3: Dynamic = options == null ? null : this.element(options);
        return !value2 || !value3 || value2 === value3
          ? false
          : context === "before"
            ? (0, runtime.directiveSiblingsAdjacent)(value2, value3)
            : context === "after"
              ? (0, runtime.directiveSiblingsAdjacent)(value3, value2)
              : context === "into"
                ? (0, runtime.directiveParent)(value2) === value3 &&
                  (0, runtime.directiveSiblingsAdjacent)(value2, null)
                : false;
      }
      isInPlace(input: Dynamic, options: Dynamic, context: Dynamic): Dynamic {
        let value2: Dynamic = this.element(input),
          value3: Dynamic = options == null ? null : this.element(options);
        return !value2 || !value3 || value2 === value3
          ? false
          : context === "before"
            ? (0, runtime.siblingsSeparatedOnlyByWhitespace)(value2, value3)
            : context === "after"
              ? (0, runtime.siblingsSeparatedOnlyByWhitespace)(value3, value2)
              : context === "into"
                ? value2.parentNode === value3 &&
                  (0, runtime.siblingsSeparatedOnlyByWhitespace)(value2, null)
                : false;
      }
      blockEls(input: Dynamic): Dynamic {
        let value2: Dynamic = input.map(
          (input2?: Dynamic): Dynamic => this.element(input2),
        );
        if (
          value2.length === 0 ||
          value2.some((input2?: Dynamic): Dynamic => !input2) ||
          new Set(value2).size !== value2.length
        )
          return null;
        let value3: Dynamic = value2.sort(
          (input2?: Dynamic, options?: Dynamic): Dynamic =>
            input2.compareDocumentPosition(options) &
            Node.DOCUMENT_POSITION_FOLLOWING
              ? -1
              : 1,
        );
        for (let count: Dynamic = 1; count < value3.length; count++)
          if (value3[count - 1].contains(value3[count])) return null;
        return value3;
      }
      blockInPlace(
        items: Dynamic,
        options: Dynamic,
        context: Dynamic,
      ): Dynamic {
        if (items.includes(options)) return false;
        for (let count: Dynamic = 1; count < items.length; count++)
          if (
            !(0, runtime.directiveSiblingsAdjacent)(
              items[count - 1],
              items[count],
            )
          )
            return false;
        let value2: Dynamic = items[0],
          value3: Dynamic = items[items.length - 1];
        return context === "before"
          ? (0, runtime.directiveSiblingsAdjacent)(value3, options)
          : context === "after"
            ? (0, runtime.directiveSiblingsAdjacent)(options, value2)
            : context === "into"
              ? (0, runtime.directiveParent)(value2) === options &&
                (0, runtime.directiveSiblingsAdjacent)(value3, null)
              : false;
      }
      isBlockInPlace(
        input: Dynamic,
        options: Dynamic,
        context: Dynamic,
      ): Dynamic {
        let value2: Dynamic = this.blockEls(input),
          value3: Dynamic = options == null ? null : this.element(options);
        return (
          !!value2 && !!value3 && this.blockInPlace(value2, value3, context)
        );
      }
      moveBlockRelative(
        input: Dynamic,
        options: Dynamic,
        context: Dynamic,
      ): Dynamic {
        if (!this.canMoveBlockRelative(input, options, context)) return false;
        let value2: Dynamic = this.blockEls(input),
          value3: Dynamic = this.element(options),
          value4: Dynamic,
          value5: Dynamic;
        if (context === "into") {
          value4 = value3;
          value5 = null;
        } else
          for (
            value4 = value3.parentNode,
              value5 = context === "before" ? value3 : value3.nextSibling;
            value5 && value2.includes(value5);

          )
            value5 = value5.nextSibling;
        for (let value6 of value2 as Dynamic)
          value4.insertBefore(value6, value5);
        (0, runtime.editorAssert)(
          value2.every(
            (input2?: Dynamic): Dynamic => input2.parentNode === value4,
          ),
          `moveBlockRelative(${input.join(",")} ${context} ${options}) did not land together`,
        );
        return true;
      }
      canMoveBlockRelative(
        input: Dynamic,
        options: Dynamic,
        context: Dynamic,
      ): Dynamic {
        let value2: Dynamic = this.blockEls(input);
        if (!value2 || context === "root-end" || options == null) return false;
        let value3: Dynamic = this.element(options);
        if (
          !value3 ||
          value2.some((input2?: Dynamic): Dynamic => input2.contains(value3)) ||
          this.blockInPlace(value2, value3, context)
        )
          return false;
        if (context === "into")
          return value2.every(
            (input2?: Dynamic): Dynamic =>
              (0, runtime.canContainHtmlTag)(value3.tagName, input2.tagName),
          );
        if (!value3.parentNode) return false;
        let value4: Dynamic =
          value3.parentNode instanceof Element
            ? value3.parentNode.tagName
            : null;
        return (
          value4 == null ||
          value2.every(
            (input2?: Dynamic): Dynamic =>
              (0, runtime.canContainHtmlTag)(value4, input2.tagName),
          )
        );
      }
      canMoveRelative(
        input: Dynamic,
        options: Dynamic,
        context: Dynamic,
      ): Dynamic {
        let value2: Dynamic = this.element(input);
        if (!value2) return false;
        if (context === "root-end" || options == null) return true;
        let value3: Dynamic = this.element(options);
        return !value3 ||
          value3 === value2 ||
          this.isWithin(input, options) ||
          this.isInPlace(input, options, context)
          ? false
          : context === "into"
            ? (0, runtime.canContainHtmlTag)(value3.tagName, value2.tagName)
            : value3.parentNode != null;
      }
      moveRelative(
        input: Dynamic,
        options: Dynamic,
        context: Dynamic,
      ): Dynamic {
        if (!this.canMoveRelative(input, options, context)) return false;
        let value2: Dynamic = this.element(input);
        if (context === "root-end" || options == null) {
          this.tpl.content.insertBefore(value2, this.trailingHelmet());
          return true;
        }
        let value3: Dynamic = this.element(options);
        context === "into"
          ? (value3.appendChild(value2),
            (0, runtime.editorAssert)(
              value2.parentElement === value3,
              `moveRelative(${input} into ${options}) did not land in the target`,
            ))
          : context === "before"
            ? value3.parentNode.insertBefore(value2, value3)
            : value3.parentNode.insertBefore(value2, value3.nextSibling);
        (context === "before" || context === "after") &&
          (0, runtime.editorAssert)(
            value2.parentNode === value3.parentNode,
            `moveRelative(${input} ${context} ${options}) did not land beside the target`,
          );
        return true;
      }
      helmetClassRules(): Dynamic {
        if (this.classRuleCache) return this.classRuleCache;
        let text: Dynamic = "";
        for (let value4 of this.tpl.content.querySelectorAll(
          "sc-helmet style",
        ) as Dynamic)
          text +=
            (value4.textContent ?? "") +
            `
`;
        let value2: Dynamic = (0, runtime.parseUtilityClasses)(text),
          value3: Dynamic = !!this.tpl.content.querySelector(
            "sc-helmet[data-dc-atomics]",
          );
        this.classRuleCache = value3
          ? [...runtime.parseUtilityClassesValue, ...value2]
          : value2;
        return this.classRuleCache;
      }
      ancestorClassesOf(input: Dynamic): Dynamic {
        let values: Dynamic = new Set(),
          parentElement: Dynamic = input.parentElement;
        for (; parentElement; ) {
          let attribute: Dynamic = parentElement.getAttribute("class");
          if (attribute)
            for (let value2 of attribute.split(/\s+/) as Dynamic)
              value2 && values.add(value2);
          parentElement = parentElement.parentElement;
        }
        return values;
      }
      effectiveStyleFor(element: Dynamic): Dynamic {
        let value2: Dynamic = element.getAttribute("style") ?? "",
          value3: Dynamic = (element.getAttribute("class") ?? "").trim();
        return value3 === ""
          ? value2
          : (0, runtime.serializeStyleDeclarations)(
              this.effectiveDeclsFor(element, value3, value2),
            );
      }
      effectiveDeclsFor(
        input: Dynamic,
        options: Dynamic,
        context: Dynamic,
      ): Dynamic {
        return (0, runtime.mergeAuthoredStyle)(
          this.helmetClassRules(),
          options.split(/\s+/),
          context,
          this.ancestorClassesOf(input),
        );
      }
      inlineStyleValue(input: Dynamic, options: Dynamic): Dynamic {
        let value2: Dynamic = this.element(input);
        return value2
          ? (0, runtime.getStyleProperty)(value2.getAttribute("style"), options)
          : "";
      }
      inlineStyleAttr(input: Dynamic): Dynamic {
        return this.element(input)?.getAttribute("style") ?? "";
      }
      anyHasInlineDecl(input: Dynamic, options: Dynamic): Dynamic {
        let value2: Dynamic = (0, runtime.normalizeCssProperty)(options);
        return input.some((input2?: Dynamic): Dynamic => {
          let value3: Dynamic = (0, runtime.parseStyleDeclarations)(
            this.inlineStyleAttr(input2),
          );
          return (
            value3.some(
              (input3?: Dynamic): Dynamic => input3.prop === value2,
            ) ||
            (0, runtime.expandCssDeclarations)(value3).some(
              (input3?: Dynamic): Dynamic => input3.prop === value2,
            )
          );
        });
      }
      hasAuthoredStyle(input: Dynamic, options: Dynamic): Dynamic {
        let value2: Dynamic = (0, runtime.normalizeCssProperty)(options);
        return (0, runtime.expandCssDeclarations)(
          (0, runtime.parseStyleDeclarations)(this.effectiveStyleAttr(input)),
        ).some((input2?: Dynamic): Dynamic => input2.prop === value2);
      }
      effectiveStyleAttr(input: Dynamic): Dynamic {
        let value2: Dynamic = this.element(input);
        return value2 ? this.effectiveStyleFor(value2) : "";
      }
      effectiveStyleValue(input: Dynamic, options: Dynamic): Dynamic {
        return (0, runtime.getStyleProperty)(
          this.effectiveStyleAttr(input),
          options,
        );
      }
      classSources(input: Dynamic): Dynamic {
        let value2: Dynamic = this.element(input);
        if (!value2) return {};
        let value3: Dynamic = (value2.getAttribute("class") ?? "").trim();
        return value3 === ""
          ? {}
          : (0, runtime.getCssPropertySources)(
              this.effectiveDeclsFor(
                value2,
                value3,
                value2.getAttribute("style") ?? "",
              ),
            );
      }
      classOnlyStyleAttr(input: Dynamic): Dynamic {
        let value2: Dynamic = this.element(input);
        if (!value2) return "";
        let value3: Dynamic = (value2.getAttribute("class") ?? "").trim();
        return value3 === ""
          ? ""
          : (0, runtime.serializeStyleDeclarations)(
              this.effectiveDeclsFor(value2, value3, ""),
            );
      }
      inferDisplayValue(input: Dynamic): Dynamic {
        let value2: Dynamic = this.element(input);
        if (!value2) return null;
        let values: Dynamic = new Set(
            (0, runtime.parseStyleDeclarations)(
              value2.getAttribute("style"),
            ).map((input2?: Dynamic): Dynamic => input2.prop),
          ),
          callback: Dynamic = (...input2: Dynamic[]): Dynamic =>
            input2.some((input3?: Dynamic): Dynamic => values.has(input3));
        return callback(
          "grid",
          "grid-template",
          "grid-template-columns",
          "grid-template-rows",
          "grid-template-areas",
          "grid-auto-columns",
          "grid-auto-rows",
          "grid-auto-flow",
          "justify-items",
        )
          ? "grid"
          : callback(
                "flex-direction",
                "flex-wrap",
                "flex-flow",
                "justify-content",
                "align-items",
                "align-content",
                "gap",
                "row-gap",
                "column-gap",
              )
            ? "flex"
            : runtime.HtmlTagNormalizationSubscribers.has(
                  this.tagName(input) ?? "",
                )
              ? "inline"
              : null;
      }
      attribute(input: Dynamic, options: Dynamic): Dynamic {
        return this.element(input)?.getAttribute(options) ?? null;
      }
      takeMarkerAttr(input: Dynamic, options: Dynamic): Dynamic {
        let value2: Dynamic = options != null ? this.element(options) : null,
          value3: Dynamic = null;
        for (let [value4, value5] of this.byTid as Dynamic)
          (value2 && !value2.contains(value5)) ||
            (value5.hasAttribute(input) &&
              (value3 == null && (value3 = value4),
              value5.removeAttribute(input)));
        return value3;
      }
      tagName(input: Dynamic): Dynamic {
        let value2: Dynamic = this.element(input);
        if (!value2) return null;
        let value3: Dynamic = value2.tagName.toLowerCase();
        return value3 === "sc-helmet"
          ? "helmet"
          : (0, runtime.readableTagName)(value3);
      }
      text(input: Dynamic): Dynamic {
        let value2: Dynamic = this.element(input);
        return value2 &&
          (value2.tagName === "TEXTAREA" ||
            (0, runtime.hasOnlyDirectText)(value2))
          ? (value2.textContent ?? "")
          : null;
      }
      setInnerHtml(input: Dynamic, options: Dynamic): Dynamic {
        let value2: Dynamic = this.element(input);
        if (!value2) return false;
        this.classRuleCache = null;
        value2.innerHTML = options;
        for (let value3 of value2.querySelectorAll("*") as Dynamic) {
          value3.removeAttribute(runtime.DcTplAttribute);
          for (let value4 of [...value3.attributes] as Dynamic)
            value4.name.startsWith("data-dc-editor-") &&
              value3.removeAttribute(value4.name);
        }
        return true;
      }
      setTagName(input: Dynamic, options: Dynamic): Dynamic {
        let value2: Dynamic = this.element(input);
        if (!value2 || value2.tagName.toLowerCase() === options) return false;
        let value3: Dynamic = (document as Dynamic).createElement(options);
        for (let value4 of value2.attributes as Dynamic)
          value3.setAttribute(value4.name, value4.value);
        for (; value2.firstChild; ) value3.appendChild(value2.firstChild);
        value2.replaceWith(value3);
        this.byTid.set(input, value3);
        return true;
      }
      innerTemplateHtml(input: Dynamic): Dynamic {
        let value2: Dynamic = this.element(input);
        if (!value2) return "";
        let value3: Dynamic = value2.cloneNode(true);
        for (let value4 of value3.querySelectorAll(
          `[${runtime.DcTplAttribute}]`,
        ) as Dynamic)
          value4.removeAttribute(runtime.DcTplAttribute);
        return (0, runtime.fromParserHtml)(value3.innerHTML);
      }
      isTextEditable(input: Dynamic): Dynamic {
        let value2: Dynamic = this.element(input);
        if (!value2) return false;
        let value3: Dynamic = this.tagName(input) ?? "";
        return !(0, runtime.canContainHtmlChildren)(value3) ||
          value3 === "helmet" ||
          value3 === "x-import" ||
          value3 === "dc-import" ||
          (runtime.HtmlAuthoringTextTspanTextpathSet.has(value3) &&
            value2.children.length > 0)
          ? false
          : (0, runtime.isInlineTextContainer)(value2) &&
              !(0, runtime.isIconOnlyElement)(value2);
      }
      textEditables(): Dynamic {
        let items: Dynamic = [];
        for (let [value2, value3] of this.byTid as Dynamic)
          this.isTextEditable(value2) &&
            items.push(
              (0, runtime.containsTemplateText)(value3)
                ? {
                    tid: value2,
                    seed: this.innerTemplateHtml(value2),
                  }
                : {
                    tid: value2,
                  },
            );
        return items;
      }
      isOutlineRow(input: Dynamic): Dynamic {
        let value2: Dynamic = this.tagName(input);
        return value2 != null && this.outlineListsTag(value2);
      }
      outlineListsTag(input: Dynamic): Dynamic {
        return input === "helmet"
          ? false
          : !(
              this.raw &&
              (input === "script" ||
                input === "style" ||
                input === "link" ||
                input === "noscript" ||
                input === "template")
            );
      }
      importTextTargets(input: Dynamic, options: Dynamic): Dynamic {
        let value2: Dynamic = this.element(input);
        if (!value2 || this.isLoopDriven(input)) return [];
        let items: Dynamic = [],
          items2: Dynamic = [],
          callback: Dynamic = (
            input2?: Dynamic,
            options2?: Dynamic,
          ): Dynamic => {
            for (let value3 of input2.childNodes as Dynamic)
              value3.nodeType === Node.TEXT_NODE
                ? (options2 ? items2 : items).push(value3.nodeValue ?? "")
                : value3.nodeType === Node.ELEMENT_NODE &&
                  callback(value3, true);
          };
        callback(value2, false);
        items.filter((input2?: Dynamic): Dynamic => input2.trim() !== "")
          .length > 1 && items2.push(...items);
        return (0, runtime.componentTextOptions)(
          {
            tag: this.tagName(input),
            text: this.text(input),
            ownText: items.join(""),
            deepText: items2,
            attrs: this.attributes(input),
          },
          options,
        );
      }
      importTexts(input: Dynamic): Dynamic {
        let items: Dynamic = [];
        for (let [value2, value3] of this.byTid as Dynamic) {
          if (value3.tagName.toLowerCase() !== "x-import") continue;
          let value4: Dynamic = this.importTextTargets(value2, input);
          value4.length > 0 &&
            items.push({
              tid: value2,
              targets: value4,
            });
        }
        return items;
      }
      outline(): Dynamic {
        let callback: Dynamic = (input?: Dynamic): Dynamic => {
            let value2: Dynamic = input.trim().replace(/\s+/g, " ");
            return value2.length > 26 ? `${value2.slice(0, 26)}\u2026` : value2;
          },
          callback2: Dynamic = (element?: Dynamic): Dynamic => {
            let attribute: Dynamic = element.getAttribute(
              runtime.DcTplAttribute,
            );
            if (attribute == null) return null;
            let value2: Dynamic = parseInt(attribute, 10),
              value3: Dynamic =
                this.tagName(value2) ?? element.tagName.toLowerCase();
            if (!this.outlineListsTag(value3)) return null;
            let attribute2: Dynamic = element.getAttribute("data-om-label"),
              value4: Dynamic = value3 === "x-import" || value3 === "dc-import",
              value5: Dynamic = this.effectiveStyleFor(element),
              value6: Dynamic = (0, runtime.tagIcon)(value3),
              value7: Dynamic = (0, runtime.detectContainerLayout)(
                element,
                value5,
              ),
              value8: Dynamic =
                !value7 &&
                value3 !== "sc-if" &&
                value3 !== "sc-for" &&
                this.isTextEditable(value2),
              text: Dynamic = "group";
            value4
              ? (text = "Component")
              : value3 === "sc-if"
                ? (text = "Conditional group")
                : value3 === "sc-for"
                  ? (text = "Repeating group")
                  : value6
                    ? (text = value6)
                    : value7 === "column"
                      ? (text = "Column")
                      : value7 === "row"
                        ? (text = "Row")
                        : value7 === "grid"
                          ? (text = "Grid")
                          : (runtime.ModelDomTextSubscribers.has(value3) ||
                              (element.children.length === 0 &&
                                (element.textContent ?? "").trim() !== "") ||
                              value8) &&
                            (text = "Text");
            let value9: Dynamic = value4
                ? (0, runtime.parseComponentImport)(
                    value3,
                    this.attributes(value2),
                  )
                : null,
              value10: Dynamic = attribute2 || value9?.name || text,
              value11: Dynamic = (0, runtime.labelToElementKind)(text, value7),
              value12: Dynamic =
                element.getAttribute("data-label") ||
                element.getAttribute("data-screen-label") ||
                element.getAttribute("aria-label") ||
                element.getAttribute("label") ||
                "",
              value13: Dynamic = (0, runtime.slideElementLabel)(element),
              value14: Dynamic;
            if (value9) value14 = attribute2 ? value9.ref : value9.scope;
            else if (value4)
              value14 =
                element.getAttribute("component-from-global-scope") ||
                element.getAttribute("component") ||
                element.getAttribute("name") ||
                (element.getAttribute("from") || "")
                  .split("/")
                  .pop()
                  ?.replace(/(\.dc)?\.[a-z]+(\?.*)?$/i, "") ||
                undefined;
            else if (value13) {
              let element2: Dynamic = element.querySelector(
                  "h1, h2, h3, [data-title]",
                ),
                value17: Dynamic =
                  value12 ||
                  (element2?.textContent ?? "") ||
                  ((0, runtime.hasOnlyDirectText)(element)
                    ? (element.textContent ?? "")
                    : "");
              value14 = value17.trim()
                ? `${value13} \xB7 ${callback(value17)}`
                : value13;
            } else if (value12) value14 = callback(value12);
            else if ((0, runtime.hasOnlyDirectText)(element) || value8) {
              let value17: Dynamic = (element.textContent ?? "").trim();
              value17 && (value14 = `\u201C${callback(value17)}\u201D`);
            } else if (
              element.children.length > 0 &&
              value3 !== "sc-if" &&
              value3 !== "sc-for"
            ) {
              let value17: Dynamic = this.handleOf(element),
                value18: Dynamic = value17.startsWith("<")
                  ? (0, runtime.elementTextPreview)(element)
                  : "";
              value17.startsWith("<")
                ? value18 && (value14 = `\u201C${callback(value18)}\u201D`)
                : (value14 = value17);
            }
            let value15: Dynamic =
                (0, runtime.getStyleProperty)(
                  element.getAttribute("style"),
                  "display",
                ).trim() === "none",
              value16: Dynamic =
                element.parentElement?.tagName.toLowerCase() === "deck-stage" ||
                element.parentElement?.hasAttribute("data-uneditable") ===
                  true ||
                element.hasAttribute("data-uneditable") ||
                value3 === "deck-stage",
              items2: Dynamic = [];
            for (let value17 of element.children as Dynamic) {
              let value18: Dynamic = callback2(value17);
              value18 && items2.push(value18);
            }
            return {
              tid: value2,
              tag: value3,
              kind: text,
              label: value10,
              hidden: value15,
              children: items2,
              ...(value11
                ? {
                    glyph: value11,
                  }
                : {}),
              ...(attribute2
                ? {
                    userLabel: attribute2,
                  }
                : {}),
              ...(value14
                ? {
                    detail: value14,
                  }
                : {}),
              ...(value4 && !value9
                ? {
                    grayed: true,
                  }
                : {}),
              ...(value9
                ? {
                    component: value9,
                  }
                : {}),
              ...(value16
                ? {
                    noHide: true,
                  }
                : {}),
            };
          },
          items: Dynamic = [];
        for (let value2 of this.tpl.content.children as Dynamic) {
          let value3: Dynamic = callback2(value2);
          value3 && items.push(value3);
        }
        return items;
      }
      isTextual(input: Dynamic): Dynamic {
        let value2: Dynamic = this.element(input);
        if (!value2) return false;
        if (runtime.ModelDomTextSubscribers.has(this.tagName(input) ?? ""))
          return true;
        for (let value3 of value2.childNodes as Dynamic)
          if (
            value3.nodeType === Node.TEXT_NODE &&
            (value3.nodeValue ?? "").trim() !== ""
          )
            return true;
        return false;
      }
      handleOf(element: Dynamic): Dynamic {
        let value2: Dynamic = (element.getAttribute("id") ?? "").trim(),
          value3: Dynamic = (element.getAttribute("class") ?? "")
            .replace(/\{\{[\s\S]*?\}\}/g, " ")
            .split(/\s+/)
            .find(
              (input?: Dynamic): Dynamic =>
                /^[\w-]+$/.test(input) &&
                !runtime.HtmlAuthoringSubscribers.has(input),
            ),
          value4: Dynamic = /^[\w-]+$/.test(value2)
            ? "#" + value2
            : value3
              ? "." + value3
              : `<${(0, runtime.readableTagName)(element.tagName.toLowerCase())}>`;
        return value4.length > 28 ? value4.slice(0, 27) + "\u2026" : value4;
      }
      typeTextRules(input: Dynamic, options: Dynamic): Dynamic {
        this.pageTextCache?.css !== input &&
          (this.pageTextCache = {
            css: input,
            byTag: new Map(),
          });
        let entry: Dynamic = this.pageTextCache.byTag.get(options);
        entry ||
          ((entry = (0, runtime.getUnconditionalCssDeclarations)(
            input,
            options,
            runtime.ModelDomTextSplitValue,
          )),
          this.pageTextCache.byTag.set(options, entry));
        return entry;
      }
      inheritedTextStyle(input: Dynamic): Dynamic {
        let value2: Dynamic = this.element(input);
        if (!value2) return [];
        let { css: value3 }: Dynamic = this.pageSheets(),
          values: Dynamic = new Set(),
          items: Dynamic = [],
          callback: Dynamic = (input2?: Dynamic): Dynamic =>
            /^(|inherit|unset)$/i.test(input2),
          callback2: Dynamic = (
            input2?: Dynamic,
            options?: Dynamic,
            context: Dynamic = null,
          ): Dynamic => {
            let entries: Dynamic = new Map(
                input2.map(
                  (input3?: Dynamic, options2?: Dynamic): Dynamic => [
                    input3.prop,
                    {
                      v: input3.value.trim(),
                      i: options2,
                    },
                  ],
                ),
              ),
              entry: Dynamic = entries.get("font"),
              value4: Dynamic = entry && !callback(entry.v) ? entry.i : -1;
            for (let value5 of runtime.ModelDomTextSplitValue as Dynamic) {
              let entry2: Dynamic = entries.get(value5);
              if (
                values.has(value5) ||
                !entry2 ||
                callback(entry2.v) ||
                (entry2.i < value4 &&
                  runtime.ModelDomTextSplitValue_2.includes(value5))
              )
                continue;
              let value6: Dynamic =
                value5 === "font" &&
                runtime.ModelDomTextSplitValue_2.some(
                  (input3?: Dynamic): Dynamic =>
                    values.has(input3) ||
                    ((entries.get(input3)?.i ?? -1) > value4 &&
                      !callback(entries.get(input3).v)),
                );
              values.add(value5);
              !value6 &&
                options != null &&
                !/^(initial|revert|revert-layer)$/i.test(entry2.v) &&
                items.push({
                  prop: value5,
                  value: entry2.v,
                  from: options,
                  fromTid: context,
                });
            }
            if (value4 >= 0)
              for (let value5 of runtime.ModelDomTextSplitValue_2 as Dynamic)
                values.add(value5);
          };
        for (
          let value4: Dynamic = value2;
          value4;
          value4 = value4.parentElement
        ) {
          let value5: Dynamic = (0, runtime.readableTagName)(
            value4.tagName.toLowerCase(),
          );
          if (
            value4 === value2 &&
            runtime.ModelDomTextButtonInputPattern.test(value5)
          )
            return [];
          let value6: Dynamic = parseInt(
            value4.getAttribute(runtime.DcTplAttribute) ?? "",
            10,
          );
          callback2(
            [
              ...this.typeTextRules(value3, value5),
              ...(0, runtime.parseStyleDeclarations)(
                this.effectiveStyleFor(value4),
              ),
            ],
            value4 === value2 ? null : this.handleOf(value4),
            Number.isNaN(value6) ? null : value6,
          );
          if (runtime.ModelDomTextButtonInputPattern.test(value5)) return items;
          for (let value7 of (Object.hasOwn(
            runtime.ModelDomTextH1H2H3Config,
            value5,
          )
            ? runtime.ModelDomTextH1H2H3Config[value5]
            : ""
          ).split(" ") as Dynamic)
            values.add(value7);
          value5 === "a" && value4.hasAttribute("href") && values.add("color");
        }
        for (let value4 of ["body", "html"] as Dynamic)
          callback2(this.typeTextRules(value3, value4), value4);
        return items;
      }
    };
  };
}
