/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installExportCaptureFonts(
  runtime: RuntimeBindings,
): () => void {
  async function resolveCaptureFonts(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Promise<Dynamic> {
    let items: Dynamic = [],
      values: Dynamic = new Set();
    function value(input2?: Dynamic): Dynamic {
      let value6: Dynamic =
          /[?&]family=([^:&]+):ital,wght@([01]),([\d.]+)&/.exec(input2),
        fonts: Dynamic = input.fonts;
      if (!value6 || !fonts) return true;
      let value7: Dynamic = value6[1].replace(/\+/g, " ").toLowerCase(),
        value8: Dynamic = value6[2] === "1" ? "italic" : "normal",
        value9: Dynamic = value6[3].replace("..", " ");
      try {
        for (let value10 of fonts as Dynamic)
          if (
            value10.status !== "unloaded" &&
            value10.status !== "error" &&
            value10.style === value8 &&
            value10.weight === value9 &&
            value10.family.replace(/["']/g, "").toLowerCase() === value7
          )
            return true;
      } catch {
        return true;
      }
      return false;
    }
    async function value2(input2?: Dynamic): Promise<Dynamic> {
      try {
        let value6: Dynamic = await fetch(input2);
        if (!value6.ok) throw new Error("http " + value6.status);
        let value7: Dynamic =
          (await value6.text()).match(/@font-face\s*{[^}]*}/g) || [];
        for (let index: Dynamic = 0; index < value7.length; index++)
          items.push({
            css: value7[index],
            base: input2,
          });
      } catch {
        context.push(
          "cross-origin stylesheet " +
            input2 +
            " could not be read; its @font-face rules are not inlined and those fonts may fall back",
        );
      }
    }
    function value3(input2?: Dynamic): Dynamic {
      try {
        let value6: Dynamic = input2.media && input2.media.mediaText;
        if (value6)
          return options.matchMedia ? options.matchMedia(value6).matches : true;
        if (
          input2.conditionText !== undefined &&
          options.CSS &&
          options.CSS.supports
        )
          return options.CSS.supports(input2.conditionText);
      } catch {}
      return true;
    }
    async function value4(
      input2?: Dynamic,
      options2?: Dynamic,
    ): Promise<Dynamic> {
      if (
        !input2 ||
        values.has(input2) ||
        (input2.href && values.has(input2.href))
      )
        return;
      values.add(input2);
      input2.href && values.add(input2.href);
      let ownerNode: Dynamic = input2.ownerNode;
      if (
        input2.href &&
        ownerNode &&
        ownerNode.nodeType === 1 &&
        ownerNode.hasAttribute("data-font-variant") &&
        !value(input2.href)
      )
        return;
      let value6: Dynamic;
      try {
        value6 = input2.cssRules;
      } catch {
        input2.href && (await value2(input2.href));
        return;
      }
      await value5(value6, input2.href || options2);
    }
    async function value5(
      items2?: Dynamic,
      options2?: Dynamic,
    ): Promise<Dynamic> {
      for (let index: Dynamic = 0; index < items2.length; index++) {
        let value6: Dynamic = items2[index];
        if (value6.type === CSSRule.FONT_FACE_RULE)
          items.push({
            css: value6.cssText,
            base: options2,
          });
        else if ("styleSheet" in value6) {
          if (!value3(value6)) continue;
          if (value6.styleSheet) await value4(value6.styleSheet, options2);
          else if (value6.href) {
            let href: Dynamic = value6.href;
            try {
              href = new URL(value6.href, options2).href;
            } catch {}
            values.has(href) || (values.add(href), await value2(href));
          }
        } else
          value6.cssRules &&
            value3(value6) &&
            (await value5(value6.cssRules, options2));
      }
    }
    try {
      for (let index: Dynamic = 0; index < input.styleSheets.length; index++)
        await value4(input.styleSheets[index], input.baseURI);
      let value6: Dynamic = input.adoptedStyleSheets || [];
      for (let index: Dynamic = 0; index < value6.length; index++)
        await value4(value6[index], input.baseURI);
    } catch {}
    return items;
  }
  function collectUsedFontFaces(
    input?: Dynamic,
    items?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    try {
      if (!input.fonts || !input.fonts.forEach) return;
      let callback: Dynamic = (input2?: Dynamic): Dynamic =>
          input2.replace(/^\s*["']?|["']?\s*$/g, "").toLowerCase(),
        state: Dynamic = {};
      for (let index: Dynamic = 0; index < items.length; index++) {
        let value: Dynamic = items[index].css.match(
          /font-family\s*:\s*([^;}]+)/i,
        );
        value && (state[callback(value[1])] = 1);
      }
      let state2: Dynamic = {};
      input.fonts.forEach((state3?: Dynamic): Dynamic => {
        let value: Dynamic = callback(state3.family);
        state3.status === "loaded" &&
          !state[value] &&
          !state2[value] &&
          ((state2[value] = 1),
          context.push(
            "font not inlined (a fallback face is used): " + state3.family,
          ));
      });
    } catch {}
  }
  bindRuntimeValue(runtime, "resolveCaptureFonts", () => resolveCaptureFonts);
  bindRuntimeValue(runtime, "collectUsedFontFaces", () => collectUsedFontFaces);
  return () => {};
}
