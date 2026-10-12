/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorComponentsDetach(
  runtime: RuntimeBindings,
): () => void {
  var ComponentsDetachLabel: Dynamic;
  var ComponentsDetachLabel_2: Dynamic;
  var ComponentsDetachLabel_3: Dynamic;
  var ThisComponentManagesItselfSoItMessage_3: Dynamic;
  var ComponentsDetachLabel_4: Dynamic;
  var ThisInstanceTakesValuesFromTheMessage: Dynamic;
  var ComponentsDetachLabel_5: Dynamic;
  var ComponentsDetachLabel_6: Dynamic;
  var ThisInstanceCanTBeDetachedWhereMessage: Dynamic;
  var CouldnTFindThisComponentSArtboardOnMessage: Dynamic;
  var ThisInstanceIsnTShownOnTheMessage: Dynamic;
  var CouldnTDetachThisInstanceRightNowMessage: Dynamic;
  var PartsOfThisComponentCanTBeMessage: Dynamic;
  var ComponentsDetachNameComponentPattern: Dynamic;
  var ComponentsDetachPositionLeftRightSet: Dynamic;
  var ComponentsDetachHelmetScriptPattern: Dynamic;
  var ComponentsDetachPattern: Dynamic;
  var ComponentsDetachPattern_2: Dynamic;
  var ComponentsDetachPattern_3: Dynamic;
  var ComponentsDetachPattern_4: Dynamic;
  var ComponentsDetachReplace: Dynamic;
  function parseDetachablePropValue(input?: Dynamic): Dynamic {
    let value: Dynamic = input.match(ComponentsDetachPattern)?.[1]?.trim();
    if (value == null || value.includes("{{"))
      return input.includes("{{") ? undefined : input;
    if (/[=!]=/.test(value)) return;
    if (value === "true" || value === "false") return value === "true";
    if (value === "null") return null;
    if (ComponentsDetachPattern_3.test(value)) return Number(value);
    let value2: Dynamic = value.match(ComponentsDetachPattern_4);
    return value2 ? (value2[1] ?? value2[2]) : undefined;
  }
  function detachComponentRefusal(input?: Dynamic, options?: Dynamic): Dynamic {
    if (input.isUneditable(options))
      return ThisComponentManagesItselfSoItMessage_3;
    if (input.isLoopDriven(options)) return ComponentsDetachLabel_4;
    if (
      (0, runtime.parseStyleDeclarations)(input.inlineStyleAttr(options)).some(
        (input2?: Dynamic): Dynamic =>
          !ComponentsDetachPositionLeftRightSet.has(input2.prop) &&
          (input2.prop + input2.value).includes("{{"),
      ) ||
      /(^|;)\s*\{\{[^:;]*\}\}\s*(;|$)/.test(input.inlineStyleAttr(options)) ||
      Object.values(input.attributes(options)).some(
        (input2?: Dynamic): Dynamic =>
          parseDetachablePropValue(input2) === undefined,
      )
    )
      return ThisInstanceTakesValuesFromTheMessage;
    if (
      input.childTids(options).length > 0 ||
      (input.element(options)?.textContent ?? "").trim() !== ""
    )
      return ComponentsDetachLabel_5;
    let value: Dynamic = input.parentTid(options);
    for (; value != null && /^sc-(if|for)$/.test(input.tagName(value) ?? ""); )
      value = input.parentTid(value);
    if (
      (value != null &&
        !(0, runtime.canContainHtmlTag)(input.tagName(value) ?? "", "div")) ||
      input.element(options)?.closest("p")
    )
      return ComponentsDetachLabel_6;
  }
  function isDetachableDcImport(input?: Dynamic, options?: Dynamic): Dynamic {
    return (
      input.tagName(options) === "dc-import" &&
      detachComponentRefusal(input, options) === undefined
    );
  }
  function selectionDetachRefusal(input?: Dynamic, options?: Dynamic): Dynamic {
    if (
      options.some(
        (input2?: Dynamic): Dynamic => isDetachableDcImport(input, input2),
      )
    )
      return;
    for (let value2 of options as Dynamic)
      if (input.tagName(value2) === "dc-import")
        return detachComponentRefusal(input, value2);
    let value: Dynamic = options.map(
      (input2?: Dynamic): Dynamic =>
        (0, runtime.parseComponentImport)(
          input.tagName(input2),
          input.attributes(input2),
        )?.kind,
    );
    return value.includes("system")
      ? ComponentsDetachLabel_2
      : value.includes("module")
        ? ComponentsDetachLabel_3
        : ComponentsDetachLabel;
  }
  function importedComponentName(input?: Dynamic): Dynamic {
    return input.name || input.component || "";
  }
  function detachableComponentProps(input?: Dynamic): Dynamic {
    let state: Dynamic = {};
    for (let [value, value2] of Object.entries(input) as Dynamic) {
      if (ComponentsDetachNameComponentPattern.test(value)) continue;
      let value3: Dynamic = parseDetachablePropValue(value2);
      value3 !== undefined && (state[ComponentsDetachReplace(value)] = value3);
    }
    return state;
  }
  function selectionUsesFlexGrid(input?: Dynamic, options?: Dynamic): Dynamic {
    return options.some((input2?: Dynamic): Dynamic => {
      let value: Dynamic = input.element(input2),
        value2: Dynamic = /^(inline-)?(flex|grid)$/.test(
          (0, runtime.getStyleProperty)(value?.getAttribute("style"), "display")
            .replace(/!important/i, "")
            .trim()
            .toLowerCase(),
        ),
        value3: Dynamic = [...(value?.childNodes ?? [])].some(
          (input3?: Dynamic): Dynamic => {
            let value4: Dynamic =
              input3.nodeType === 3 ? (input3.nodeValue ?? "") : "";
            return (
              /\{\{/.test(value4) &&
              (value4.replace(ComponentsDetachPattern_2, "").trim() !== "" ||
                (value4.match(ComponentsDetachPattern_2)?.length ?? 0) > 1)
            );
          },
        );
      return (
        (value2 && value3) ||
        selectionUsesFlexGrid(input, input.childTids(input2))
      );
    });
  }
  function hasUnresolvedTemplateExpression(input?: Dynamic): Dynamic {
    for (let value of input
      .replace(/<\!--[\s\S]*?-->/g, "")
      .matchAll(ComponentsDetachPattern_2) as Dynamic) {
      let value2: Dynamic = (value[1] ?? "").trim();
      if (
        !runtime.ClipboardTemplateFlatteningTrueFalseNullSet.has(value2) &&
        !ComponentsDetachPattern_3.test(value2) &&
        !ComponentsDetachPattern_4.test(value2)
      )
        return true;
    }
    return false;
  }
  function detachImportedComponent(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    if (!isDetachableDcImport(input, options))
      return {
        blocked:
          selectionDetachRefusal(input, [options]) ?? ComponentsDetachLabel,
      };
    let value: Dynamic = input.attributes(options),
      value2: Dynamic = context.model.helmetAssets(),
      value3: Dynamic = context.model
        .childTids(null)
        .filter(
          (input2?: Dynamic): Dynamic =>
            !ComponentsDetachHelmetScriptPattern.test(
              context.model.tagName(input2) ?? "",
            ),
        ),
      value4: Dynamic = value3
        .map((input2?: Dynamic): Dynamic => context.model.subtreeHtml(input2))
        .filter((input2?: Dynamic): Dynamic => input2 != null).join(`
`);
    if (
      value2.other ||
      value4 === "" ||
      context.model.rootText().trim() !== "" ||
      selectionUsesFlexGrid(context.model, value3)
    )
      return {
        blocked: PartsOfThisComponentCanTBeMessage,
      };
    let value5: Dynamic = detachableComponentProps(value),
      { vals: value6, held: value7 }: Dynamic = context,
      value8: Dynamic = (0, runtime.getLoopTemplateVariables)(value4),
      value9: Dynamic = (0, runtime.flattenTemplateValues)(
        value4,
        (input2?: Dynamic): Dynamic => {
          if (
            !(
              input2.startsWith("$") ||
              runtime.ClipboardTemplateFlatteningTrueFalseNullSet.has(input2) ||
              value8.has(input2) ||
              value7.includes(input2)
            )
          )
            return Object.hasOwn(value6, input2)
              ? value6[input2]
              : Object.hasOwn(value5, input2)
                ? value5[input2]
                : undefined;
        },
      );
    if (hasUnresolvedTemplateExpression(value9))
      return {
        blocked: PartsOfThisComponentCanTBeMessage,
      };
    let value10: Dynamic = (document as Dynamic).createElement("div"),
      value11: Dynamic = (0, runtime.serializeStyleDeclarations)(
        (0, runtime.parseStyleDeclarations)(
          input.inlineStyleAttr(options),
        ).filter(
          (input2?: Dynamic): Dynamic =>
            ComponentsDetachPositionLeftRightSet.has(input2.prop),
        ),
      );
    value11 && value10.setAttribute("style", value11);
    value10.setAttribute(
      "data-om-label",
      value["data-om-label"] || importedComponentName(value) || "Component",
    );
    let value12: Dynamic = (document as Dynamic).createElement("template");
    value12.content.appendChild(value10);
    let innerHTML: Dynamic = value12.innerHTML;
    return {
      html:
        innerHTML.slice(0, innerHTML.length - 6) +
        `
` +
        value9 +
        `
</div>`,
      assets: value2.assets,
      atomics: value2.atomics,
    };
  }
  bindRuntimeValue(
    runtime,
    "ComponentsDetachLabel",
    () => ComponentsDetachLabel,
    (value) => {
      ComponentsDetachLabel = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsDetachLabel_2",
    () => ComponentsDetachLabel_2,
    (value) => {
      ComponentsDetachLabel_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsDetachLabel_3",
    () => ComponentsDetachLabel_3,
    (value) => {
      ComponentsDetachLabel_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ThisComponentManagesItselfSoItMessage_3",
    () => ThisComponentManagesItselfSoItMessage_3,
    (value) => {
      ThisComponentManagesItselfSoItMessage_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsDetachLabel_4",
    () => ComponentsDetachLabel_4,
    (value) => {
      ComponentsDetachLabel_4 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ThisInstanceTakesValuesFromTheMessage",
    () => ThisInstanceTakesValuesFromTheMessage,
    (value) => {
      ThisInstanceTakesValuesFromTheMessage = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsDetachLabel_5",
    () => ComponentsDetachLabel_5,
    (value) => {
      ComponentsDetachLabel_5 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsDetachLabel_6",
    () => ComponentsDetachLabel_6,
    (value) => {
      ComponentsDetachLabel_6 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ThisInstanceCanTBeDetachedWhereMessage",
    () => ThisInstanceCanTBeDetachedWhereMessage,
    (value) => {
      ThisInstanceCanTBeDetachedWhereMessage = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CouldnTFindThisComponentSArtboardOnMessage",
    () => CouldnTFindThisComponentSArtboardOnMessage,
    (value) => {
      CouldnTFindThisComponentSArtboardOnMessage = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ThisInstanceIsnTShownOnTheMessage",
    () => ThisInstanceIsnTShownOnTheMessage,
    (value) => {
      ThisInstanceIsnTShownOnTheMessage = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CouldnTDetachThisInstanceRightNowMessage",
    () => CouldnTDetachThisInstanceRightNowMessage,
    (value) => {
      CouldnTDetachThisInstanceRightNowMessage = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PartsOfThisComponentCanTBeMessage",
    () => PartsOfThisComponentCanTBeMessage,
    (value) => {
      PartsOfThisComponentCanTBeMessage = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsDetachNameComponentPattern",
    () => ComponentsDetachNameComponentPattern,
    (value) => {
      ComponentsDetachNameComponentPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsDetachPositionLeftRightSet",
    () => ComponentsDetachPositionLeftRightSet,
    (value) => {
      ComponentsDetachPositionLeftRightSet = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsDetachHelmetScriptPattern",
    () => ComponentsDetachHelmetScriptPattern,
    (value) => {
      ComponentsDetachHelmetScriptPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsDetachPattern",
    () => ComponentsDetachPattern,
    (value) => {
      ComponentsDetachPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsDetachPattern_2",
    () => ComponentsDetachPattern_2,
    (value) => {
      ComponentsDetachPattern_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsDetachPattern_3",
    () => ComponentsDetachPattern_3,
    (value) => {
      ComponentsDetachPattern_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsDetachPattern_4",
    () => ComponentsDetachPattern_4,
    (value) => {
      ComponentsDetachPattern_4 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsDetachReplace",
    () => ComponentsDetachReplace,
    (value) => {
      ComponentsDetachReplace = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "parseDetachablePropValue",
    () => parseDetachablePropValue,
  );
  bindRuntimeValue(
    runtime,
    "detachComponentRefusal",
    () => detachComponentRefusal,
  );
  bindRuntimeValue(runtime, "isDetachableDcImport", () => isDetachableDcImport);
  bindRuntimeValue(
    runtime,
    "selectionDetachRefusal",
    () => selectionDetachRefusal,
  );
  bindRuntimeValue(
    runtime,
    "importedComponentName",
    () => importedComponentName,
  );
  bindRuntimeValue(
    runtime,
    "detachableComponentProps",
    () => detachableComponentProps,
  );
  bindRuntimeValue(
    runtime,
    "selectionUsesFlexGrid",
    () => selectionUsesFlexGrid,
  );
  bindRuntimeValue(
    runtime,
    "hasUnresolvedTemplateExpression",
    () => hasUnresolvedTemplateExpression,
  );
  bindRuntimeValue(
    runtime,
    "detachImportedComponent",
    () => detachImportedComponent,
  );
  return () => {
    ComponentsDetachLabel = "Select a component instance to detach it";
    ComponentsDetachLabel_2 = "Design system components can\u2019t be detached";
    ComponentsDetachLabel_3 = "Code components can\u2019t be detached";
    ThisComponentManagesItselfSoItMessage_3 =
      "This component manages itself, so it can\u2019t be detached";
    ComponentsDetachLabel_4 =
      "A repeated instance can\u2019t be detached on its own";
    ThisInstanceTakesValuesFromTheMessage =
      "This instance takes values from the page\u2019s script, so it can\u2019t be detached";
    ComponentsDetachLabel_5 =
      "An instance with content of its own can\u2019t be detached";
    ComponentsDetachLabel_6 =
      "An instance inside text or a button can\u2019t be detached";
    ThisInstanceCanTBeDetachedWhereMessage =
      "This instance can\u2019t be detached where it sits: the copy couldn\u2019t keep its structure there (a link inside a link, a form inside a form). Edit it in its own artboard.";
    CouldnTFindThisComponentSArtboardOnMessage =
      "Couldn\u2019t find this component\u2019s artboard on this canvas, so the instance can\u2019t be detached.";
    ThisInstanceIsnTShownOnTheMessage =
      "This instance isn\u2019t shown on the page right now, so it can\u2019t be detached. Show it first.";
    CouldnTDetachThisInstanceRightNowMessage =
      "Couldn\u2019t detach this instance right now. Try again.";
    PartsOfThisComponentCanTBeMessage =
      "Parts of this component can\u2019t be turned into plain elements yet, so it can\u2019t be detached. Edit it in its own artboard.";
    ComponentsDetachNameComponentPattern =
      /^(name|component|style|sc-name|hint-size|dc-props|dcProps|key|ref|children|style-.*)$/;
    ComponentsDetachPositionLeftRightSet = new Set([
      "position",
      "left",
      "right",
      "top",
      "bottom",
      "inset",
      "width",
      "height",
      "z-index",
      "transform",
    ]);
    ComponentsDetachHelmetScriptPattern =
      /^(helmet|script|style|template|link|meta|title)$/;
    ComponentsDetachPattern = /^\s*\{\{([\s\S]+?)\}\}\s*$/;
    ComponentsDetachPattern_2 = /\{\{([\s\S]*?)\}\}/g;
    ComponentsDetachPattern_3 = /^-?\d+(\.\d+)?$/;
    ComponentsDetachPattern_4 = /^(?:'([^']*)'|"([^"]*)")$/;
    ComponentsDetachReplace = (input?: Dynamic): Dynamic =>
      input.replace(
        /-([a-z])/g,
        (input2?: Dynamic, options?: Dynamic): Dynamic => options.toUpperCase(),
      );
  };
}
