/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installPreviewComponentImports(
  runtime: RuntimeBindings,
): () => void {
  var isProjectSourcePath: Dynamic;
  var PreviewComponentImportsImportPattern: Dynamic;
  var PreviewComponentImportsHandler: Dynamic;
  var PreviewComponentImportsAmpLtGtConfig: Dynamic;
  var PreviewComponentImportsReplace: Dynamic;
  var PreviewComponentImportsTest: Dynamic;
  function scanComponentImports(items?: Dynamic): Dynamic {
    let items2: Dynamic = [];
    PreviewComponentImportsImportPattern.lastIndex = 0;
    for (
      let value: Dynamic = PreviewComponentImportsImportPattern.exec(items);
      value !== null;
      value = PreviewComponentImportsImportPattern.exec(items)
    ) {
      let state: Dynamic = {},
        text: Dynamic = "",
        callback: Dynamic = (input?: Dynamic, options?: Dynamic): Dynamic => {
          let value6: Dynamic = text.toLowerCase();
          (value6 === "name" || value6 === "component") &&
            state[value6] === undefined &&
            (state[value6] = [input, options]);
          text = "";
        },
        text2: Dynamic = "gap",
        text3: Dynamic = "",
        value2: Dynamic = -1,
        value3: Dynamic = value.index + value[0].length;
      for (; value3 < items.length; value3 += 1) {
        let value6: Dynamic = items[value3];
        if (text2 === "quoted") {
          value6 === text3 && (callback(value2, value3), (text2 = "gap"));
          continue;
        }
        if (value6 === ">" || value6 === "<") break;
        if (text2 === "gap") {
          if (PreviewComponentImportsHandler(value6)) continue;
          value6 === "/"
            ? (text = "")
            : value6 === "=" && text !== ""
              ? (text2 = "eq")
              : ((text = value6), (text2 = "key"));
        } else if (text2 === "key")
          PreviewComponentImportsHandler(value6)
            ? (text2 = "gap")
            : value6 === "="
              ? (text2 = "eq")
              : value6 === "/"
                ? ((text = ""), (text2 = "gap"))
                : (text += value6);
        else if (text2 === "eq") {
          if (PreviewComponentImportsHandler(value6)) continue;
          value6 === '"' || value6 === "'"
            ? ((text3 = value6), (value2 = value3 + 1), (text2 = "quoted"))
            : ((value2 = value3), (text2 = "bare"));
        } else
          PreviewComponentImportsHandler(value6) &&
            (callback(value2, value3), (text2 = "gap"));
      }
      text2 === "bare" && callback(value2, value3);
      let value4: Dynamic = /^<d/i.test(value[0])
          ? [state.name, state.component]
          : [state.component, state.name],
        value5: Dynamic =
          value4.find(
            (input?: Dynamic): Dynamic =>
              input !== undefined && input[1] > input[0],
          ) ?? value4.find((input?: Dynamic): Dynamic => input !== undefined);
      value5 !== undefined &&
        items2.push({
          at: value.index,
          tag: items.slice(value.index, value3),
          value: items.slice(value5[0], value5[1]),
          from: value5[0] - value.index,
          to: value5[1] - value.index,
        });
      PreviewComponentImportsImportPattern.lastIndex = value3;
    }
    return items2;
  }
  function decodeHtmlAttributeEntities(input?: Dynamic): Dynamic {
    return input.replace(
      /&(amp|lt|gt|quot|apos|#[0-9]{1,7}|#x[0-9a-f]{1,6});/gi,
      (input2?: Dynamic, options?: Dynamic): Dynamic => {
        if (options[0] !== "#")
          return (
            PreviewComponentImportsAmpLtGtConfig[options.toLowerCase()] ??
            input2
          );
        let value: Dynamic =
          options[1] === "x" || options[1] === "X"
            ? parseInt(options.slice(2), 16)
            : parseInt(options.slice(1), 10);
        return value > 0 && value <= 1114111
          ? String.fromCodePoint(value)
          : input2;
      },
    );
  }
  function containsFileReference(input?: Dynamic, options?: Dynamic): Dynamic {
    for (
      let value: Dynamic = input.indexOf(options);
      value >= 0;
      value = input.indexOf(options, value + 1)
    ) {
      let value2: Dynamic = value === 0 ? "" : input[value - 1];
      if (value2 === "") return true;
      if (
        !/[A-Za-z0-9_.-]/.test(value2) &&
        (value2 !== "/" ||
          (input[value - 2] === "." &&
            !/[A-Za-z0-9_./-]/.test(input[value - 3] ?? "")))
      )
        return true;
    }
    return false;
  }
  function getProjectFileDependencies(
    input?: Dynamic,
    options?: Dynamic,
    context: Dynamic = false,
    value: Dynamic = "",
  ): Dynamic {
    let values: Dynamic = new Set();
    for (let value3 of scanComponentImports(input) as Dynamic) {
      let value4: Dynamic =
        decodeHtmlAttributeEntities(value3.value) + ".dc.html";
      values.add(
        context
          ? ((0, runtime.resolveProjectAssetPath)(value, value4) ?? value4)
          : (value4.split("/").pop() ?? value4),
      );
    }
    let value2: Dynamic = context
        ? containsFileReference
        : (input2?: Dynamic, options2?: Dynamic): Dynamic =>
            input2.includes(options2),
      items: Dynamic = [];
    for (let value3 of options as Dynamic) {
      let value4: Dynamic = value3.split("/").pop() ?? value3;
      (values.has(context ? value3 : value4) ||
        value2(input, value3) ||
        (!context && value2(input, value4))) &&
        items.push(value3);
    }
    return items;
  }
  function getImportedArtboardNames(input?: Dynamic): Dynamic {
    let values: Dynamic = new Set();
    for (let value of scanComponentImports(
      (0, runtime.maskHtmlRawContent)(input, {
        bodies: "keep",
      }),
    ) as Dynamic) {
      let value2: Dynamic = decodeHtmlAttributeEntities(value.value);
      value2 !== "" &&
        PreviewComponentImportsTest(value.tag, value2) &&
        values.add(PreviewComponentImportsReplace(value2));
    }
    return [...values];
  }
  function renameComponentImports(input?: Dynamic, options?: Dynamic): Dynamic {
    if (options.size === 0) return input;
    let text: Dynamic = "",
      index: Dynamic = 0;
    for (let value of scanComponentImports(input) as Dynamic) {
      let value2: Dynamic = decodeHtmlAttributeEntities(value.value),
        value3: Dynamic =
          value.value === "" || !PreviewComponentImportsTest(value.tag, value2)
            ? undefined
            : options.get(PreviewComponentImportsReplace(value2)),
        value4: Dynamic = /^(.*\/)?(.+?)(\.dc\.html)?$/i.exec(value2);
      value3 === undefined ||
        value4 === null ||
        ((text +=
          input.slice(index, value.at + value.from) +
          (value4[1] ?? "") +
          value3 +
          (value4[3] ?? "")),
        (index = value.at + value.to));
    }
    return text + input.slice(index);
  }
  function rewriteProjectReferences(
    input?: Dynamic,
    options?: Dynamic,
    context: Dynamic = new Set(),
    value?: Dynamic,
  ): Dynamic {
    if (options.size === 0) return input;
    let value2: Dynamic = [...options.keys()]
        .sort(
          (items?: Dynamic, items2?: Dynamic): Dynamic =>
            items2.length - items.length,
        )
        .map(
          (input2?: Dynamic): Dynamic =>
            input2.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        )
        .join("|"),
      value3: Dynamic = new RegExp(
        "(^|[^A-Za-z0-9_./-])((?:[A-Za-z0-9_.-]{1,100}/){0,16})(" +
          value2 +
          ")(?![A-Za-z0-9_-]|\\.[A-Za-z0-9])",
        "g",
      );
    return input.replace(
      value3,
      (
        items?: Dynamic,
        options2?: Dynamic,
        context2?: Dynamic,
        value4?: Dynamic,
      ): Dynamic => {
        let value5: Dynamic = context2.replace(/^\.\//, ""),
          value6: Dynamic =
            value5 !== "" ? options.get(value5 + value4) : undefined,
          value7: Dynamic = value6 !== undefined;
        value6 === undefined &&
          !(value5 !== "" && context.has(value4)) &&
          (value6 = options.get(value4));
        if (value6 === undefined) return items;
        let value8: Dynamic = /^(?:\.{0,2}\/|_blob\/|blob:|data:|https?:)/.test(
          value6,
        )
          ? options2 + value6
          : value7
            ? options2 + (context2.startsWith("./") ? "./" : "") + value6
            : options2 + context2 + value6;
        if (value !== undefined) {
          let value9: Dynamic = value8.length - items.length;
          if (value9 > value.left) return items;
          value9 > 0 && (value.left -= value9);
        }
        return value8;
      },
    );
  }
  function getLinkedProjectFiles(input?: Dynamic, options?: Dynamic): Dynamic {
    let values: Dynamic = new Set();
    for (let value2 of options as Dynamic)
      values.add(value2.split("/").pop() ?? value2);
    let values2: Dynamic = new Set(),
      value: Dynamic = (0, runtime.maskHtmlRawContent)(input, {
        bodies: "keep",
      });
    for (let value2 of value.matchAll(
      /<(?:script|link)\b[^>]{0,1000}?\s(?:src|href)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi,
    ) as Dynamic) {
      let value3: Dynamic =
        decodeHtmlAttributeEntities(
          value2[1] ?? value2[2] ?? value2[3] ?? "",
        ).split(/[?#]/)[0] ?? "";
      if (value3 === "" || /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(value3))
        continue;
      let value4: Dynamic = value3.split("/").pop() ?? value3;
      /\.(css|m?js|jsx|tsx)$/i.test(value4) &&
        !values.has(value4) &&
        values2.add(value4);
    }
    return [...values2];
  }
  bindRuntimeValue(
    runtime,
    "isProjectSourcePath",
    () => isProjectSourcePath,
    (value) => {
      isProjectSourcePath = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PreviewComponentImportsImportPattern",
    () => PreviewComponentImportsImportPattern,
    (value) => {
      PreviewComponentImportsImportPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PreviewComponentImportsHandler",
    () => PreviewComponentImportsHandler,
    (value) => {
      PreviewComponentImportsHandler = value;
    },
  );
  bindRuntimeValue(runtime, "scanComponentImports", () => scanComponentImports);
  bindRuntimeValue(
    runtime,
    "PreviewComponentImportsAmpLtGtConfig",
    () => PreviewComponentImportsAmpLtGtConfig,
    (value) => {
      PreviewComponentImportsAmpLtGtConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "decodeHtmlAttributeEntities",
    () => decodeHtmlAttributeEntities,
  );
  bindRuntimeValue(
    runtime,
    "PreviewComponentImportsReplace",
    () => PreviewComponentImportsReplace,
    (value) => {
      PreviewComponentImportsReplace = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "containsFileReference",
    () => containsFileReference,
  );
  bindRuntimeValue(
    runtime,
    "getProjectFileDependencies",
    () => getProjectFileDependencies,
  );
  bindRuntimeValue(
    runtime,
    "PreviewComponentImportsTest",
    () => PreviewComponentImportsTest,
    (value) => {
      PreviewComponentImportsTest = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "getImportedArtboardNames",
    () => getImportedArtboardNames,
  );
  bindRuntimeValue(
    runtime,
    "renameComponentImports",
    () => renameComponentImports,
  );
  bindRuntimeValue(
    runtime,
    "rewriteProjectReferences",
    () => rewriteProjectReferences,
  );
  bindRuntimeValue(
    runtime,
    "getLinkedProjectFiles",
    () => getLinkedProjectFiles,
  );
  return () => {
    isProjectSourcePath = (input?: Dynamic): Dynamic =>
      /\.(dc\.html|css|m?js|jsx|tsx)$/i.test(input);
    PreviewComponentImportsImportPattern = /<(?:dc|x)-import\b/gi;
    PreviewComponentImportsHandler = (input?: Dynamic): Dynamic =>
      input === " " ||
      input === "	" ||
      input ===
        `
` ||
      input === "\r" ||
      input === "\f";
    PreviewComponentImportsAmpLtGtConfig = {
      amp: "&",
      lt: "<",
      gt: ">",
      quot: '"',
      apos: "'",
    };
    PreviewComponentImportsReplace = (input?: Dynamic): Dynamic =>
      (input.split("/").pop() ?? input).replace(/\.dc\.html$/i, "");
    PreviewComponentImportsTest = (
      input?: Dynamic,
      options?: Dynamic,
    ): Dynamic => /^<dc-import/i.test(input) || /\.dc\.html$/i.test(options);
  };
}
