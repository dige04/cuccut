/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installFastEditTemplateValidation(
  runtime: RuntimeBindings,
): () => void {
  var MAX_FAST_EDIT_TEMPLATE_CHARS: Dynamic;
  var MAX_FAST_EDIT_TEMPLATE_ELEMENTS: Dynamic;
  var MAX_FAST_EDIT_TEMPLATE_DEPTH: Dynamic;
  var serializeFastEditTemplate: Dynamic;
  var fastEditTemplateFailure: Dynamic;
  var TEMPLATE_ELEMENT_ID_PATTERN: Dynamic;
  var validateTemplateElementId: Dynamic;
  var TEMPLATE_XML_NAME_PATTERN: Dynamic;
  var FORBIDDEN_TEMPLATE_ATTRIBUTE_NAMES: Dynamic;
  var VOID_TEMPLATE_ELEMENTS: Dynamic;
  var FORBIDDEN_TEMPLATE_TAGS: Dynamic;
  var SAFE_TEMPLATE_STATE_ATTRIBUTES: Dynamic;
  var MULTICOLUMN_PROPERTY_PATTERN: Dynamic;
  var hasColumnLayout: Dynamic;
  var checkTemplateClosingTags: Dynamic;
  function splitCssDeclarations_2(style?: Dynamic): Dynamic {
    let declarations: Dynamic = [],
      declaration: Dynamic = "",
      parenthesisDepth: Dynamic = 0,
      quote: Dynamic = "";
    for (let value of String(style ?? "") as Dynamic) {
      if (quote !== "") {
        value === quote && (quote = "");
        declaration += value;
        continue;
      }
      if (value === '"' || value === "'") {
        quote = value;
        declaration += value;
        continue;
      }
      value === "("
        ? (parenthesisDepth += 1)
        : value === ")" &&
          (parenthesisDepth = Math.max(0, parenthesisDepth - 1));
      if (value === ";" && parenthesisDepth === 0) {
        declaration.trim() !== "" && declarations.push(declaration.trim());
        declaration = "";
        continue;
      }
      declaration += value;
    }
    declaration.trim() !== "" && declarations.push(declaration.trim());
    return declarations;
  }
  function parseFastEditTemplate(html?: Dynamic): Dynamic {
    let template: Dynamic = (document as Dynamic).createElement("template");
    template.innerHTML = (0, runtime.toParserHtml)(html);
    return template;
  }
  function findForbiddenTemplateMarkup(html?: Dynamic): Dynamic {
    let forbiddenMarkup: Dynamic =
      (0, runtime.findForbiddenTemplateTag)(html) ??
      (/<\/?x-dc/i.test(html)
        ? "<x-dc>"
        : /<noscript/i.test(html)
          ? "<noscript>"
          : null);
    return forbiddenMarkup === null
      ? null
      : fastEditTemplateFailure(
          forbiddenMarkup === "<x-dc>" || forbiddenMarkup === "data-dc-script"
            ? "outside"
            : "not_template",
          forbiddenMarkup,
          forbiddenMarkup.replace(/[<>!]/g, "").toLowerCase(),
        );
  }
  function* inspectTemplateElementNames(
    element?: Dynamic,
  ): Generator<Dynamic, Dynamic, Dynamic> {
    TEMPLATE_XML_NAME_PATTERN.test(element.localName) ||
      (yield ["an element named " + element.localName, element.localName]);
    for (let value of element.attributes as Dynamic) {
      let value2: Dynamic = value.name.startsWith(runtime.ScCamelValue)
        ? (0, runtime.kebabToCamelCase)(
            value.name.slice(runtime.ScCamelValue.length),
          )
        : value.name;
      ((FORBIDDEN_TEMPLATE_ATTRIBUTE_NAMES.has(value2) &&
        (value2 !== "children" ||
          VOID_TEMPLATE_ELEMENTS.has(element.localName))) ||
        (value2.startsWith("style-") &&
          (/[{}]/.test(value.value) ||
            !SAFE_TEMPLATE_STATE_ATTRIBUTES.pseudo(value2.slice(6))))) &&
        (yield ["an attribute named " + value2, value2]);
    }
  }
  function inspectTemplateComplexity(template?: Dynamic): Dynamic {
    let complexity: Dynamic = {
        elements: 0,
        depth: 0,
        columns: 0,
        throws: new Map(),
      },
      walk: Dynamic = (
        input?: Dynamic,
        options?: Dynamic,
        context?: Dynamic,
      ): Dynamic => {
        for (let value of [
          ...input.childNodes,
          ...(input.content?.childNodes ?? []),
        ] as Dynamic) {
          if (value.nodeType !== 1) continue;
          let value2: Dynamic = value,
            value3: Dynamic = context + (hasColumnLayout(value2) ? 1 : 0);
          complexity.elements += 1;
          complexity.depth = Math.max(complexity.depth, options + 1);
          complexity.columns = Math.max(complexity.columns, value3);
          for (let [value4, value5] of inspectTemplateElementNames(
            value2,
          ) as Dynamic)
            complexity.throws.set(value4, value5);
          options < MAX_FAST_EDIT_TEMPLATE_DEPTH &&
            walk(value2, options + 1, value3);
        }
      };
    walk(template, 0, 0);
    return complexity;
  }
  function hasClosedTemplateMarkup(html?: Dynamic): Dynamic {
    let DOMParser2: Dynamic = (document as Dynamic).defaultView.DOMParser,
      value: Dynamic = new DOMParser2().parseFromString(
        "<!doctype html><html><head></head><body><x-dc>" +
          html +
          "</x-dc><x-dc-end></x-dc-end></body></html>",
        "text/html",
      ).body?.lastElementChild,
      value2: Dynamic = value?.previousElementSibling;
    return (
      value?.localName === "x-dc-end" &&
      value.childNodes.length === 0 &&
      value2?.localName === "x-dc" &&
      value2.previousElementSibling === null
    );
  }
  function validateFastEditTemplate(
    before?: Dynamic,
    after?: Dynamic,
  ): Dynamic {
    try {
      return validateFastEditTemplateUnsafe(before, after);
    } catch {
      return {
        ok: false,
        code: "not_template",
        detail: "threw",
        what: "threw",
      };
    }
  }
  function validateFastEditTemplateUnsafe(
    before?: Dynamic,
    after?: Dynamic,
  ): Dynamic {
    let failure: Dynamic = (
      input?: Dynamic,
      options: Dynamic = false,
    ): Dynamic => ({
      ok: false,
      ...input,
      code: options ? "box_cannot_hold" : input.code,
      detail: input.detail.slice(0, 160),
    });
    if (typeof after != "string" || typeof before != "string")
      return failure(
        fastEditTemplateFailure("not_template", "not text", "not_text"),
      );
    if (after.length > MAX_FAST_EDIT_TEMPLATE_CHARS)
      return failure(
        fastEditTemplateFailure("too_big", String(after.length), "characters"),
      );
    let value: Dynamic = findForbiddenTemplateMarkup(after);
    if (value !== null)
      return failure(value, findForbiddenTemplateMarkup(before) !== null);
    let value2: Dynamic = parseFastEditTemplate(after),
      value3: Dynamic = inspectTemplateComplexity(value2.content),
      value4: Dynamic = serializeFastEditTemplate(value2),
      value5: Dynamic,
      callback: Dynamic = (): Dynamic =>
        (value5 ??= inspectTemplateComplexity(
          parseFastEditTemplate(before).content,
        ));
    if (value3.elements > MAX_FAST_EDIT_TEMPLATE_ELEMENTS)
      return failure(
        fastEditTemplateFailure("too_big", "elements", "elements"),
      );
    if (value3.depth > MAX_FAST_EDIT_TEMPLATE_DEPTH)
      return failure(
        fastEditTemplateFailure("too_big", "depth", "depth"),
        callback().depth > MAX_FAST_EDIT_TEMPLATE_DEPTH,
      );
    if (value3.columns >= 2 && value3.columns > callback().columns)
      return failure(
        fastEditTemplateFailure("too_big", "columns inside columns", "columns"),
      );
    let value6: Dynamic =
      value3.throws.size === 0
        ? undefined
        : [...value3.throws].find(
            ([input]: Dynamic): Dynamic => !callback().throws.has(input),
          );
    if (value6 !== undefined)
      return failure(
        fastEditTemplateFailure(
          "not_template",
          value6[0],
          validateTemplateElementId(value6[1]),
        ),
      );
    if (value4.length > MAX_FAST_EDIT_TEMPLATE_CHARS)
      return failure(
        fastEditTemplateFailure("too_big", String(value4.length), "characters"),
      );
    if (serializeFastEditTemplate(parseFastEditTemplate(value4)) !== value4)
      return failure(
        fastEditTemplateFailure("reparse", "unstable", "unstable"),
      );
    let value7: Dynamic = findForbiddenTemplateMarkup(value4);
    if (value7 !== null)
      return failure(value7, findForbiddenTemplateMarkup(before) !== null);
    let value8: Dynamic = checkTemplateClosingTags(before, value4);
    return value8 !== null
      ? failure(value8)
      : {
          ok: true,
          template: value4,
        };
  }
  function validateArtboardTemplateReplacement(
    documentHtml?: Dynamic,
    templateHtml?: Dynamic,
  ): Dynamic {
    let failure: Dynamic = (
        input?: Dynamic,
        options?: Dynamic,
        context?: Dynamic,
      ): Dynamic => ({
        ok: false,
        code: input,
        detail: options,
        ...(context !== undefined
          ? {
              what: context,
            }
          : {}),
      }),
      region: Dynamic = (0, runtime.parseDcHtmlDocument)(documentHtml);
    if (region === null) return failure("not_template", "no x-dc", "no_region");
    if (/<\/?x-dc/i.test(templateHtml) || /data-dc-script/i.test(templateHtml))
      return failure("outside", "scaffold", "scaffold");
    let value: Dynamic = (0, runtime.replaceDcTemplate)(
        documentHtml,
        region,
        templateHtml,
      ),
      value2: Dynamic = (0, runtime.parseDcHtmlDocument)(value);
    if (value2 === null) return failure("outside", "unparsable", "unparsable");
    let value3: Dynamic = documentHtml.slice(0, region.templateStart),
      value4: Dynamic = documentHtml.slice(region.templateEnd);
    if (
      !/<body(?:\s[^>]*)?>\s*$/i.test(
        value3.slice(0, Math.max(0, value3.search(/<x-dc[\s>][^<]*$/i))),
      )
    )
      return failure(
        "box_cannot_hold",
        "the region does not open straight after the body tag",
        "region_not_after_body",
      );
    if (
      value2.templateStart !== region.templateStart ||
      value.slice(0, value2.templateStart) !== value3
    )
      return failure("outside", "before", "before");
    if (
      value2.template !== templateHtml ||
      value.slice(value2.templateEnd) !== value4
    )
      return failure("outside", "after", "after");
    if (value.search(/<\/x-dc/i) !== value2.templateEnd)
      return failure("outside", "early close", "early_close");
    if (
      value2.js !== region.js ||
      (value2.jsMatch?.[0] ?? null) !== (region.jsMatch?.[0] ?? null)
    )
      return failure("outside", "script", "script");
    if (
      (0, runtime.getDcPropsJson)(value) !==
      (0, runtime.getDcPropsJson)(documentHtml)
    )
      return failure("outside", "props", "props");
    try {
      if (
        serializeFastEditTemplate(parseFastEditTemplate(templateHtml)) !==
        templateHtml
      )
        return failure("reparse", "unstable", "unstable");
      let value5: Dynamic = checkTemplateClosingTags(
        region.template,
        templateHtml,
      );
      if (value5 !== null)
        return failure(value5.code, value5.detail, value5.what);
    } catch {
      return failure("not_template", "threw", "threw");
    }
    return {
      ok: true,
      next: value,
    };
  }
  bindRuntimeValue(
    runtime,
    "MAX_FAST_EDIT_TEMPLATE_CHARS",
    () => MAX_FAST_EDIT_TEMPLATE_CHARS,
    (value) => {
      MAX_FAST_EDIT_TEMPLATE_CHARS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_FAST_EDIT_TEMPLATE_ELEMENTS",
    () => MAX_FAST_EDIT_TEMPLATE_ELEMENTS,
    (value) => {
      MAX_FAST_EDIT_TEMPLATE_ELEMENTS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_FAST_EDIT_TEMPLATE_DEPTH",
    () => MAX_FAST_EDIT_TEMPLATE_DEPTH,
    (value) => {
      MAX_FAST_EDIT_TEMPLATE_DEPTH = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "splitCssDeclarations_2",
    () => splitCssDeclarations_2,
  );
  bindRuntimeValue(
    runtime,
    "parseFastEditTemplate",
    () => parseFastEditTemplate,
  );
  bindRuntimeValue(
    runtime,
    "serializeFastEditTemplate",
    () => serializeFastEditTemplate,
    (value) => {
      serializeFastEditTemplate = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "fastEditTemplateFailure",
    () => fastEditTemplateFailure,
    (value) => {
      fastEditTemplateFailure = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TEMPLATE_ELEMENT_ID_PATTERN",
    () => TEMPLATE_ELEMENT_ID_PATTERN,
    (value) => {
      TEMPLATE_ELEMENT_ID_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "validateTemplateElementId",
    () => validateTemplateElementId,
    (value) => {
      validateTemplateElementId = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "findForbiddenTemplateMarkup",
    () => findForbiddenTemplateMarkup,
  );
  bindRuntimeValue(
    runtime,
    "TEMPLATE_XML_NAME_PATTERN",
    () => TEMPLATE_XML_NAME_PATTERN,
    (value) => {
      TEMPLATE_XML_NAME_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FORBIDDEN_TEMPLATE_ATTRIBUTE_NAMES",
    () => FORBIDDEN_TEMPLATE_ATTRIBUTE_NAMES,
    (value) => {
      FORBIDDEN_TEMPLATE_ATTRIBUTE_NAMES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "VOID_TEMPLATE_ELEMENTS",
    () => VOID_TEMPLATE_ELEMENTS,
    (value) => {
      VOID_TEMPLATE_ELEMENTS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FORBIDDEN_TEMPLATE_TAGS",
    () => FORBIDDEN_TEMPLATE_TAGS,
    (value) => {
      FORBIDDEN_TEMPLATE_TAGS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SAFE_TEMPLATE_STATE_ATTRIBUTES",
    () => SAFE_TEMPLATE_STATE_ATTRIBUTES,
    (value) => {
      SAFE_TEMPLATE_STATE_ATTRIBUTES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "inspectTemplateElementNames",
    () => inspectTemplateElementNames,
  );
  bindRuntimeValue(
    runtime,
    "MULTICOLUMN_PROPERTY_PATTERN",
    () => MULTICOLUMN_PROPERTY_PATTERN,
    (value) => {
      MULTICOLUMN_PROPERTY_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "hasColumnLayout",
    () => hasColumnLayout,
    (value) => {
      hasColumnLayout = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "inspectTemplateComplexity",
    () => inspectTemplateComplexity,
  );
  bindRuntimeValue(
    runtime,
    "hasClosedTemplateMarkup",
    () => hasClosedTemplateMarkup,
  );
  bindRuntimeValue(
    runtime,
    "checkTemplateClosingTags",
    () => checkTemplateClosingTags,
    (value) => {
      checkTemplateClosingTags = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "validateFastEditTemplate",
    () => validateFastEditTemplate,
  );
  bindRuntimeValue(
    runtime,
    "validateFastEditTemplateUnsafe",
    () => validateFastEditTemplateUnsafe,
  );
  bindRuntimeValue(
    runtime,
    "validateArtboardTemplateReplacement",
    () => validateArtboardTemplateReplacement,
  );
  return () => {
    MAX_FAST_EDIT_TEMPLATE_CHARS = 2e5;
    MAX_FAST_EDIT_TEMPLATE_ELEMENTS = 5e3;
    MAX_FAST_EDIT_TEMPLATE_DEPTH = 100;
    serializeFastEditTemplate = (input?: Dynamic): Dynamic =>
      (0, runtime.fromParserHtml)(input.innerHTML);
    fastEditTemplateFailure = (
      input?: Dynamic,
      options?: Dynamic,
      context?: Dynamic,
    ): Dynamic => ({
      code: input,
      detail: options,
      ...(context !== undefined
        ? {
            what: context,
          }
        : {}),
    });
    TEMPLATE_ELEMENT_ID_PATTERN = /^[A-Za-z][A-Za-z0-9._:-]{0,39}$/;
    validateTemplateElementId = (input?: Dynamic): Dynamic =>
      TEMPLATE_ELEMENT_ID_PATTERN.test(input) ? input : undefined;
    TEMPLATE_XML_NAME_PATTERN =
      /^(?!xml(?:ns)?:|xmlns$)[A-Za-z][A-Za-z0-9._-]*(?::[A-Za-z][A-Za-z0-9._-]*)?$/i;
    FORBIDDEN_TEMPLATE_ATTRIBUTE_NAMES = new Set([
      "on",
      "dangerouslySetInnerHTML",
      "children",
    ]);
    VOID_TEMPLATE_ELEMENTS = new Set([
      "area",
      "base",
      "br",
      "col",
      "embed",
      "hr",
      "img",
      "input",
      "keygen",
      "link",
      "meta",
      "param",
      "source",
      "track",
      "wbr",
      "menuitem",
    ]);
    FORBIDDEN_TEMPLATE_TAGS = /^[A-Za-z-]+(?:\([^()]*\))?$/;
    SAFE_TEMPLATE_STATE_ATTRIBUTES = {
      pseudo(input: Dynamic): Dynamic {
        if (!FORBIDDEN_TEMPLATE_TAGS.test(input)) return false;
        let value: Dynamic = (document as Dynamic).defaultView?.CSS;
        if (typeof value?.supports != "function") return true;
        try {
          return (
            value.supports("selector(:no-such-pseudo-class)") ||
            value.supports(
              "selector(" +
                (input === "before" || input === "after" ? "::" : ":") +
                input +
                ")",
            )
          );
        } catch {
          return true;
        }
      },
    };
    MULTICOLUMN_PROPERTY_PATTERN =
      /^(?:-webkit-|-moz-)?column(?:s|-count|-width)$/;
    hasColumnLayout = (element?: Dynamic): Dynamic => {
      let value: Dynamic = element.getAttribute("style") ?? "";
      return (
        /column/i.test(value) &&
        value
          .split(";")
          .some(
            (input?: Dynamic): Dynamic =>
              MULTICOLUMN_PROPERTY_PATTERN.test(
                (0, runtime.camelToKebabCss)(
                  input.slice(0, Math.max(0, input.indexOf(":"))).trim(),
                ).toLowerCase(),
              ),
          )
      );
    };
    checkTemplateClosingTags = (
      input?: Dynamic,
      options?: Dynamic,
    ): Dynamic => {
      let value: Dynamic = hasClosedTemplateMarkup(input);
      return value && hasClosedTemplateMarkup(options)
        ? null
        : fastEditTemplateFailure(
            value ? "not_template" : "box_cannot_hold",
            "something is left open at the end",
            "left_open",
          );
    };
  };
}
