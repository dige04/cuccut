/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";
export function installEditorCssRules(runtime: RuntimeBindings): () => void {
  var CssRulesNoneTransparentPattern: Dynamic;
  function isUnescapedCharacter(text?: Dynamic, index?: Dynamic): Dynamic {
    let precedingIndex: Dynamic = index - 1;
    for (; precedingIndex >= 0 && text[precedingIndex] === "\\"; )
      precedingIndex--;
    return (index - 1 - precedingIndex) % 2 === 0;
  }
  function stripCssComments(items?: Dynamic): Dynamic {
    let text: Dynamic = "",
      index: Dynamic = 0,
      value: Dynamic = null;
    for (; index < items.length; ) {
      let value2: Dynamic = items[index];
      if (value) {
        text += value2;
        value2 === value &&
          isUnescapedCharacter(items, index) &&
          (value = null);
        index++;
      } else if (value2 === '"' || value2 === "'") {
        value = value2;
        text += value2;
        index++;
      } else if (value2 === "/" && items[index + 1] === "*") {
        let value3: Dynamic = items.indexOf("*/", index + 2);
        index = value3 === -1 ? items.length : value3 + 2;
      } else {
        text += value2;
        index++;
      }
    }
    return text;
  }
  function parseUtilityClasses(input?: Dynamic): Dynamic {
    let value: Dynamic = stripCssComments(input),
      items: Dynamic = [],
      index: Dynamic = 0;
    for (; index < value.length; ) {
      let value2: Dynamic = value.indexOf("{", index);
      if (value2 === -1) break;
      let value3: Dynamic = value.indexOf(";", index);
      if (value3 !== -1 && value3 < value2) {
        index = value3 + 1;
        continue;
      }
      let value4: Dynamic = value.slice(index, value2).trim(),
        count: Dynamic = 1,
        value5: Dynamic = value2 + 1,
        value6: Dynamic = null;
      for (; value5 < value.length && count > 0; ) {
        let value9: Dynamic = value[value5++];
        value6
          ? value9 === value6 &&
            isUnescapedCharacter(value, value5 - 1) &&
            (value6 = null)
          : value9 === '"' || value9 === "'"
            ? (value6 = value9)
            : value9 === "{"
              ? count++
              : value9 === "}" && count--;
      }
      let value7: Dynamic = value.slice(
        value2 + 1,
        count === 0 ? value5 - 1 : value5,
      );
      index = value5;
      if (value4.startsWith("@")) continue;
      let value8: Dynamic = (0, runtime.parseStyleDeclarations)(value7);
      for (let value9 of value4.split(",") as Dynamic) {
        let value10: Dynamic = value9.trim(),
          value11: Dynamic = /^\.(-?[_A-Za-z][\w-]*)$/.exec(value10);
        if (value11) {
          items.push({
            className: value11[1],
            decls: value8,
          });
          continue;
        }
        let value12: Dynamic =
          /^\.(-?[_A-Za-z][\w-]*)\.(-?[_A-Za-z][\w-]*)$/.exec(value10);
        if (value12) {
          items.push({
            className: value12[1],
            also: value12[2],
            decls: value8,
          });
          continue;
        }
        let value13: Dynamic =
          /^\.(-?[_A-Za-z][\w-]*)\s+\.(-?[_A-Za-z][\w-]*)$/.exec(value10);
        value13 &&
          items.push({
            parent: value13[1],
            className: value13[2],
            decls: value8,
          });
      }
    }
    return items;
  }
  function findCssRules(items?: Dynamic, options?: Dynamic): Dynamic {
    let items2: Dynamic = [],
      value: Dynamic = options.toLowerCase(),
      text: Dynamic = "",
      index: Dynamic = 0,
      index2: Dynamic = 0,
      value2: Dynamic = -1,
      flag: Dynamic = false,
      flag2: Dynamic = false,
      flag3: Dynamic = false,
      value3: Dynamic = null;
    for (let index3: Dynamic = 0; index3 < items.length; index3++) {
      let value4: Dynamic = items[index3];
      if (value3) {
        value4 === value3 &&
          isUnescapedCharacter(items, index3) &&
          (value3 = null);
        continue;
      }
      if (value4 === '"' || value4 === "'") {
        value3 = value4;
        index === 0 && (text += value4);
        continue;
      }
      if (value4 === "/" && items[index3 + 1] === "*") {
        let value5: Dynamic = items.indexOf("*/", index3 + 2);
        index3 = value5 === -1 ? items.length : value5 + 1;
        continue;
      }
      if (index === 0) {
        if (value4 === ";") text = "";
        else if (value4 === "{") {
          let value5: Dynamic = text
            .trim()
            .split(",")
            .map((input?: Dynamic): Dynamic => input.trim().toLowerCase());
          flag = !value5[0].startsWith("@") && value5.includes(value);
          flag2 = value5.every(
            (input?: Dynamic): Dynamic => input === value || input === "html",
          );
          let value6: Dynamic = /^@(media|supports|layer|container)\b/i
              .exec(value5[0])?.[1]
              ?.toLowerCase(),
            value7: Dynamic = [
              value5[0].replace(/^@media\b/i, ""),
              ...value5.slice(1),
            ].map((input?: Dynamic): Dynamic => input.trim());
          flag3 =
            value6 !== undefined &&
            !(
              value6 === "media" &&
              value7.every(
                (input?: Dynamic): Dynamic => /^(only\s+)?print\b/.test(input),
              )
            );
          value2 = index3 + 1;
          index = 1;
          index2 = 0;
          text = "";
        } else text += value4;
        continue;
      }
      if (value4 === "(") index2++;
      else if (value4 === ")") index2 = Math.max(0, index2 - 1);
      else {
        if (index2 > 0) continue;
        if (value4 === "{") index++;
        else if (value4 === "}" && --index === 0) {
          if (flag)
            items2.push({
              start: value2,
              end: index3,
              only: flag2,
            });
          else if (flag3)
            for (let value5 of findCssRules(
              items.slice(value2, index3),
              options,
            ) as Dynamic)
              items2.push({
                start: value5.start + value2,
                end: value5.end + value2,
                only: false,
                cond: true,
              });
          flag = false;
        }
      }
    }
    index > 0 &&
      flag &&
      items2.push({
        start: value2,
        end: items.length,
        only: flag2,
      });
    return items2;
  }
  function stripCssNestedContent(items?: Dynamic): Dynamic {
    let index: Dynamic = 0,
      value: Dynamic = null,
      text: Dynamic = "";
    for (let index2: Dynamic = 0; index2 < items.length; index2++) {
      let value2: Dynamic = items[index2];
      if (value)
        value2 === value &&
          isUnescapedCharacter(items, index2) &&
          (value = null);
      else if (value2 === '"' || value2 === "'") {
        value = value2;
        index === 0 && (text += value2);
      } else if (value2 === "/" && items[index2 + 1] === "*") {
        let value3: Dynamic = items.indexOf("*/", index2 + 2);
        if (value3 === -1) return true;
        index2 = value3 + 1;
      } else if (value2 === "{") {
        index++;
        text = "";
      } else if (value2 === "}") {
        if (index === 0) return true;
        index--;
        text = "";
      } else index === 0 && (text = value2 === ";" ? "" : text + value2);
    }
    return index > 0 || value !== null || text.trim() !== "";
  }
  function parseCssRuleDeclarations(items?: Dynamic): Dynamic {
    let items2: Dynamic = [],
      index: Dynamic = 0,
      index2: Dynamic = 0,
      index3: Dynamic = 0,
      value: Dynamic = null,
      callback: Dynamic = (
        input?: Dynamic,
        options: Dynamic = true,
      ): Dynamic => {
        let value2: Dynamic = stripCssComments(items.slice(index, input)),
          value3: Dynamic = value2.indexOf(":"),
          value4: Dynamic =
            value3 > 0 ? value2.slice(0, value3).trim().toLowerCase() : "";
        options &&
          /^-{0,2}[_a-z][\w-]*$/i.test(value4) &&
          value2.slice(value3 + 1).trim() &&
          items2.push({
            prop: value4,
            start: index,
            end: input,
          });
        index = input;
      };
    for (let index4: Dynamic = 0; index4 < items.length; index4++) {
      let value2: Dynamic = items[index4];
      if (value)
        value2 === value &&
          isUnescapedCharacter(items, index4) &&
          (value = null);
      else if (value2 === '"' || value2 === "'") value = value2;
      else if (value2 === "/" && items[index4 + 1] === "*") {
        let value3: Dynamic = items.indexOf("*/", index4 + 2);
        index4 = value3 === -1 ? items.length : value3 + 1;
      } else if (value2 === "(") index2++;
      else if (value2 === ")") index2 = Math.max(0, index2 - 1);
      else {
        if (index2 > 0) continue;
        value2 === "{"
          ? index3++
          : value2 === "}" && index3 > 0
            ? --index3 === 0 && callback(index4 + 1, false)
            : value2 === ";" && index3 === 0 && callback(index4 + 1);
      }
    }
    callback(Math.max(index, items.trimEnd().length));
    return items2;
  }
  function getCssRuleProperties(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    let items: Dynamic = [];
    for (let value of findCssRules(input, options) as Dynamic) {
      let value2: Dynamic = input.slice(value.start, value.end);
      for (let value3 of parseCssRuleDeclarations(value2) as Dynamic) {
        if (!context.includes(value3.prop)) continue;
        let value4: Dynamic = (0, runtime.getStyleProperty)(
            stripCssComments(value2.slice(value3.start, value3.end)).replace(
              /;\s*$/,
              "",
            ),
            value3.prop,
          ),
          value5: Dynamic = /!\s*important\s*$/i.test(value4);
        items.push({
          prop: value3.prop,
          value: value4.replace(/\s*!\s*important\s*$/i, ""),
          important: value5,
          rule: value,
          start: value.start + value3.start,
          end: value.start + value3.end,
        });
      }
    }
    return items
      .filter((input2?: Dynamic): Dynamic => !input2.important)
      .concat(items.filter((input2?: Dynamic): Dynamic => input2.important));
  }
  function getUnconditionalCssDeclarations(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    return getCssRuleProperties(
      input,
      options,
      context.map((input2?: Dynamic): Dynamic => input2.toLowerCase()),
    )
      .filter((input2?: Dynamic): Dynamic => !input2.rule.cond)
      .map(
        (input2?: Dynamic): Dynamic => ({
          prop: input2.prop,
          value: input2.value,
        }),
      );
  }
  function getCssRuleProperty(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    return (
      getCssRuleProperties(input, options, [context.toLowerCase()])
        .filter((input2?: Dynamic): Dynamic => !input2.rule.cond)
        .at(-1)?.value ?? ""
    );
  }
  function updateCssRuleProperties(
    items?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value: Dynamic = context.map((input?: Dynamic): Dynamic => input.prop),
    extra: Dynamic = true,
  ): Dynamic {
    let items2: Dynamic = [
        ...new Set(
          [
            ...value,
            ...context.map((input?: Dynamic): Dynamic => input.prop),
          ].map((input?: Dynamic): Dynamic => input.toLowerCase()),
        ),
      ],
      callback: Dynamic = (): Dynamic =>
        getCssRuleProperties(items, options, items2),
      callback2: Dynamic = (input?: Dynamic): Dynamic => {
        for (let value3 of [...input].sort(
          (input2?: Dynamic, options2?: Dynamic): Dynamic =>
            options2.start - input2.start,
        ) as Dynamic)
          items = items.slice(0, value3.start) + items.slice(value3.end);
      };
    for (let value3 of context as Dynamic) {
      if (value3.value == null || value3.value === "") continue;
      let value4: Dynamic = value3.prop.toLowerCase(),
        value5: Dynamic = callback(),
        value6: Dynamic =
          value4 +
          ": " +
          value3.value +
          (value5.some(
            (input?: Dynamic): Dynamic => input.important && !input.rule.only,
          )
            ? " !important"
            : "") +
          ";",
        value7: Dynamic = value5
          .filter((input?: Dynamic): Dynamic => input.prop === value4)
          .at(-1);
      if (
        value7?.rule.only &&
        !value7.important &&
        !value5.some(
          (input?: Dynamic): Dynamic =>
            (!input.rule.only || input.important) &&
            value5.indexOf(input) > value5.indexOf(value7),
        )
      ) {
        if (value7.value === value3.value) continue;
        let value15: Dynamic = items.slice(value7.start, value7.end),
          value16: Dynamic = /^(?:\s+|\/\*[\s\S]*?\*\/)*/.exec(value15)![0];
        items =
          items.slice(0, value7.start) +
          value16 +
          value6 +
          items.slice(value7.end);
        continue;
      }
      callback2(
        value5.filter(
          (input?: Dynamic): Dynamic =>
            input.prop === value4 && input.rule.only,
        ),
      );
      let value8: Dynamic = callback()
          .sort(
            (input?: Dynamic, options2?: Dynamic): Dynamic =>
              input.start - options2.start,
          )
          .at(-1)?.rule,
        value9: Dynamic = value8?.only
          ? value8
          : findCssRules(items, options)
              .filter(
                (input?: Dynamic): Dynamic =>
                  input.only && input.start > (value8?.end ?? -1),
              )
              .at(-1);
      if (!value9) {
        items +=
          (items.length === 0 || /\n\s*$/.test(items)
            ? ""
            : `
`) +
          options +
          " { " +
          value6 +
          ` }
`;
        continue;
      }
      let value10: Dynamic = items.slice(value9.start, value9.end),
        value11: Dynamic = /\s*$/.exec(value10)![0],
        value12: Dynamic = value10.slice(0, value10.length - value11.length),
        value13: Dynamic = stripCssComments(value12).trim(),
        value14: Dynamic = value13 === "" || /[;}]$/.test(value13) ? " " : "; ";
      items =
        items.slice(0, value9.start) +
        value12 +
        value14 +
        value6 +
        (value11 || " ") +
        items.slice(value9.end);
    }
    let value2: Dynamic = context
      .filter(
        (input?: Dynamic): Dynamic => input.value == null || input.value === "",
      )
      .map((input?: Dynamic): Dynamic => input.prop.toLowerCase());
    if (
      value2.length === 0 ||
      (callback2(
        callback().filter(
          (input?: Dynamic): Dynamic =>
            value2.includes(input.prop) && input.rule.only,
        ),
      ),
      !extra)
    )
      return items;
    let callback3: Dynamic = (input?: Dynamic): Dynamic => {
        let value3: Dynamic = /^var\(/i.test(input)
          ? (0, runtime.resolveCssVariable)(items, options, input)
          : input;
        return (
          value3 !== "" &&
          !/\b(url|[\w-]*gradient|image-set|image|cross-fade|element|paint)\(/i.test(
            value3,
          )
        );
      },
      callback4: Dynamic = (input?: Dynamic, options2?: Dynamic): Dynamic =>
        (!options2.important || input.important) &&
        (input.prop === options2.prop ||
          input.prop === "background" ||
          (options2.prop === "background" && callback3(options2.value)));
    for (let index: Dynamic = 0; index < 4; index++) {
      let value3: Dynamic = callback(),
        value4: Dynamic = value2.flatMap((input?: Dynamic): Dynamic => {
          let value5: Dynamic = value3
            .filter((input2?: Dynamic): Dynamic => input2.prop === input)
            .at(-1);
          return value5 &&
            !value5.rule.only &&
            !CssRulesNoneTransparentPattern.test(value5.value) &&
            !value3.some(
              (input2?: Dynamic): Dynamic =>
                input2.rule.only &&
                input2.start > value5.start &&
                callback4(input2, value5),
            )
            ? [value5]
            : [];
        });
      if (value4.length === 0) break;
      callback2(value4);
    }
    return items;
  }
  bindRuntimeValue(runtime, "isUnescapedCharacter", () => isUnescapedCharacter);
  bindRuntimeValue(runtime, "stripCssComments", () => stripCssComments);
  bindRuntimeValue(runtime, "parseUtilityClasses", () => parseUtilityClasses);
  bindRuntimeValue(runtime, "findCssRules", () => findCssRules);
  bindRuntimeValue(
    runtime,
    "stripCssNestedContent",
    () => stripCssNestedContent,
  );
  bindRuntimeValue(
    runtime,
    "parseCssRuleDeclarations",
    () => parseCssRuleDeclarations,
  );
  bindRuntimeValue(runtime, "getCssRuleProperties", () => getCssRuleProperties);
  bindRuntimeValue(
    runtime,
    "getUnconditionalCssDeclarations",
    () => getUnconditionalCssDeclarations,
  );
  bindRuntimeValue(runtime, "getCssRuleProperty", () => getCssRuleProperty);
  bindRuntimeValue(
    runtime,
    "CssRulesNoneTransparentPattern",
    () => CssRulesNoneTransparentPattern,
    (value) => {
      CssRulesNoneTransparentPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "updateCssRuleProperties",
    () => updateCssRuleProperties,
  );
  return () => {
    CssRulesNoneTransparentPattern =
      /^(none|transparent|initial|inherit|unset|revert)$/i;
  };
}
