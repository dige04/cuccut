/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installPreviewDependencyGraph(
  runtime: RuntimeBindings,
): () => void {
  var PreviewDependencyGraphShrefPattern: Dynamic;
  var PreviewDependencyGraphResolvedValue: Dynamic;
  var PreviewDependencyGraphCache: Dynamic;
  var PreviewDependencyGraphResolvedValue_2: Dynamic;
  var PreviewDependencyGraphCache_2: Dynamic;
  var PreviewDependencyGraphLimit: Dynamic;
  function maskNavigationLinks(items?: Dynamic): Dynamic {
    let entry: Dynamic = PreviewDependencyGraphCache.get(items);
    if (entry !== undefined) {
      PreviewDependencyGraphCache.delete(items);
      PreviewDependencyGraphCache.set(items, entry);
      return entry;
    }
    let items2: Dynamic = [];
    for (let value of (0, runtime.scanHtmlTags)(
      items,
      undefined,
      items2,
    ) as Dynamic)
      (value.name === "a" || value.name === "area") &&
        items2.push([
          value.start,
          value.end,
          items
            .slice(value.start, value.end)
            .replace(PreviewDependencyGraphShrefPattern, '$1""'),
        ]);
    items2.sort(
      (input?: Dynamic, options?: Dynamic): Dynamic => input[0] - options[0],
    );
    entry = "";
    let index: Dynamic = 0;
    for (let [value, value2, value3] of items2 as Dynamic)
      value < index ||
        ((entry +=
          items.slice(index, value) + (value3 ?? " ".repeat(value2 - value))),
        (index = value2));
    entry += items.slice(index);
    if (2 * items.length > PreviewDependencyGraphResolvedValue) return entry;
    for (let [value] of PreviewDependencyGraphCache as Dynamic) {
      if (
        PreviewDependencyGraphResolvedValue_2 + 2 * items.length <=
        PreviewDependencyGraphResolvedValue
      )
        break;
      PreviewDependencyGraphCache.delete(value);
      PreviewDependencyGraphResolvedValue_2 -= 2 * value.length;
    }
    PreviewDependencyGraphCache.set(items, entry);
    PreviewDependencyGraphResolvedValue_2 += 2 * items.length;
    return entry;
  }
  function getLinkedArtboards(input?: Dynamic): Dynamic {
    let value: Dynamic = Object.keys(input).filter(
        (input2?: Dynamic): Dynamic => input2.endsWith(".dc.html"),
      ),
      values: Dynamic = new Set();
    for (let value2 of value as Dynamic) {
      let value3: Dynamic = maskNavigationLinks(input[value2]);
      for (let value4 of (0, runtime.getProjectFileDependencies)(
        value3,
        value,
        true,
        (0, runtime.PreviewAssetRewritingSlice)(value2),
      ) as Dynamic)
        value4 !== value2 && values.add(value4);
    }
    return values;
  }
  function cachedProjectDependencies(
    items?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    if (items.length < runtime.PreviewBuildDocumentResolvedValue)
      return (0, runtime.getProjectFileDependencies)(items, options);
    let value: Dynamic = options.join(`
`),
      entry: Dynamic = PreviewDependencyGraphCache_2.get(items);
    entry === undefined
      ? ((entry = new Map()),
        PreviewDependencyGraphCache_2.set(items, entry),
        PreviewDependencyGraphCache_2.size > PreviewDependencyGraphLimit &&
          PreviewDependencyGraphCache_2.delete(
            PreviewDependencyGraphCache_2.keys().next().value,
          ))
      : (PreviewDependencyGraphCache_2.delete(items),
        PreviewDependencyGraphCache_2.set(items, entry));
    let entry2: Dynamic = entry.get(value);
    entry2 === undefined &&
      ((entry2 = (0, runtime.getProjectFileDependencies)(items, options)),
      entry.size >= 8 && entry.delete(entry.keys().next().value),
      entry.set(value, entry2));
    return entry2;
  }
  function collectProjectDependencyFiles(
    input?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    let value: Dynamic = Object.keys(input),
      values: Dynamic = new Set(),
      state: Dynamic = {},
      items: Dynamic = [options];
    for (; items.length > 0; ) {
      let value2: Dynamic = items.shift();
      if (
        values.has(value2) ||
        input[value2] == null ||
        (values.add(value2),
        (state[value2] = input[value2]),
        runtime.PreviewAssetRewritingWebpAvifPattern.test(value2))
      )
        continue;
      let value3: Dynamic = value2.endsWith(".html")
        ? maskNavigationLinks(input[value2])
        : input[value2];
      for (let value4 of cachedProjectDependencies(value3, value) as Dynamic)
        values.has(value4) || items.push(value4);
    }
    return state;
  }
  function resolveComponentFile(input?: Dynamic, source?: Dynamic): Dynamic {
    if (source.kind === "html")
      return source.path != null
        ? input[source.path] != null
          ? source.path
          : undefined
        : Object.keys(input).find(
            (input2?: Dynamic): Dynamic =>
              input2.endsWith(".dc.html") &&
              (0, runtime.PreviewComponentImportsReplace)(input2) ===
                source.name,
          );
  }
  function updateComponentRuntimeScript(
    input?: Dynamic,
    source?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    let path: Dynamic = source.path,
      value: Dynamic =
        path === undefined || !path.endsWith(".dc.html")
          ? source.name
          : path === input
            ? (0, runtime.PreviewComponentImportsReplace)(input)
            : (0, runtime.relativeProjectPath)(
                (0, runtime.PreviewAssetRewritingSlice)(input),
                path,
              ).slice(0, -8);
    return `window.__dcUpdate&&window.__dcUpdate(${JSON.stringify(value)},${JSON.stringify(source.kind)},${JSON.stringify(context)},${source.streaming ? "true" : "false"},${JSON.stringify(source.viewportKey ?? "")});`;
  }
  bindRuntimeValue(
    runtime,
    "PreviewDependencyGraphShrefPattern",
    () => PreviewDependencyGraphShrefPattern,
    (value) => {
      PreviewDependencyGraphShrefPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PreviewDependencyGraphResolvedValue",
    () => PreviewDependencyGraphResolvedValue,
    (value) => {
      PreviewDependencyGraphResolvedValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PreviewDependencyGraphCache",
    () => PreviewDependencyGraphCache,
    (value) => {
      PreviewDependencyGraphCache = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PreviewDependencyGraphResolvedValue_2",
    () => PreviewDependencyGraphResolvedValue_2,
    (value) => {
      PreviewDependencyGraphResolvedValue_2 = value;
    },
  );
  bindRuntimeValue(runtime, "maskNavigationLinks", () => maskNavigationLinks);
  bindRuntimeValue(runtime, "getLinkedArtboards", () => getLinkedArtboards);
  bindRuntimeValue(
    runtime,
    "PreviewDependencyGraphCache_2",
    () => PreviewDependencyGraphCache_2,
    (value) => {
      PreviewDependencyGraphCache_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PreviewDependencyGraphLimit",
    () => PreviewDependencyGraphLimit,
    (value) => {
      PreviewDependencyGraphLimit = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "cachedProjectDependencies",
    () => cachedProjectDependencies,
  );
  bindRuntimeValue(
    runtime,
    "collectProjectDependencyFiles",
    () => collectProjectDependencyFiles,
  );
  bindRuntimeValue(runtime, "resolveComponentFile", () => resolveComponentFile);
  bindRuntimeValue(
    runtime,
    "updateComponentRuntimeScript",
    () => updateComponentRuntimeScript,
  );
  return () => {
    PreviewDependencyGraphShrefPattern =
      /(\shref\s*=\s*)(?:"[^"]*"|'[^']*'|[^\s>]+)/i;
    PreviewDependencyGraphResolvedValue = 8 * 1024 * 1024;
    PreviewDependencyGraphCache = new Map();
    PreviewDependencyGraphResolvedValue_2 = 0;
    PreviewDependencyGraphCache_2 = new Map();
    PreviewDependencyGraphLimit = 32;
  };
}
