/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";
export function installCollaborationSelectionPaths(
  runtime: RuntimeBindings,
): () => void {
  var AZaZ0909AF21200Value: Dynamic;
  var encodedArtboardPathPattern: Dynamic;
  var encodedElementPathPattern: Dynamic;
  var CollaborationSelectionPathsLimit: Dynamic;
  var jsxCollaborationSelectionPaths: Dynamic;
  var CollaborationSelectionPathsConstant: Dynamic;
  var CollaborationSelectionPathsConstant_2: Dynamic;
  var CollaborationSelectionPathsItems: Dynamic;
  var CollaborationSelectionPathsCache: Dynamic;
  var CanvasPeerSelectionRings: Dynamic;
  function parseSelectedElementPath(input?: Dynamic): Dynamic {
    if (!encodedElementPathPattern.test(input)) return null;
    let value: Dynamic = input.indexOf("#");
    return {
      name: input.slice(0, value),
      tid: parseInt(input.slice(value + 1), 10),
    };
  }
  function normalizeSelectedArtboardPaths(input?: Dynamic): Dynamic {
    let items: Dynamic = [];
    for (let value of input as Dynamic) {
      let value2: Dynamic = encodeArtboardSelectionPath(value);
      value2 !== null && items.push(value2);
      if (items.length === 20) break;
    }
    return items;
  }
  function encodeArtboardSelectionPath(input?: Dynamic): Dynamic {
    if (!input.endsWith(".dc.html")) return null;
    let value: Dynamic;
    try {
      value = encodeURIComponent(input.slice(0, -8)) + ".dc.html";
    } catch {
      return null;
    }
    return value.length <= CollaborationSelectionPathsLimit &&
      encodedArtboardPathPattern.test(value)
      ? value
      : null;
  }
  function createPeerSelectionStore(): Dynamic {
    let entries: Dynamic = new Map(),
      values: Dynamic = new Set();
    return {
      get: (): Dynamic => entries,
      set(input: Dynamic): Dynamic {
        entries = input;
        for (let value of [...values] as Dynamic) value();
      },
      subscribe(input: Dynamic): Dynamic {
        values.add(input);
        return (): Dynamic => values.delete(input);
      },
    };
  }
  function resolvePeerElementSelections(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value: Dynamic = null,
  ): Dynamic {
    let entries: Dynamic = new Map();
    for (let value2 of input as Dynamic) {
      let items: Dynamic = [],
        values: Dynamic = new Set();
      for (let value3 of value2.selected as Dynamic) {
        let value4: Dynamic = parseSelectedElementPath(value3),
          value5: Dynamic = value4 ? options.get(value4.name) : undefined;
        if (!value4 || !value5 || (value !== null && value5.file !== value))
          continue;
        let value6: Dynamic = value === null;
        (context.get(value5.file)?.get(value4.tid) ?? []).forEach(
          (input2?: Dynamic, options2?: Dynamic): Dynamic => {
            let value7: Dynamic = value6 ? Math.max(0, input2.x) : input2.x,
              value8: Dynamic = value6 ? Math.max(0, input2.y) : input2.y,
              value9: Dynamic = value6
                ? Math.min(value5.w, input2.x + input2.w)
                : input2.x + input2.w,
              value10: Dynamic = value6
                ? Math.min(value5.h, input2.y + input2.h)
                : input2.y + input2.h;
            if (value9 <= value7 || value10 <= value8) return;
            values.add(value4.name);
            let state: Dynamic = {
              key: value2.peer + "|" + value3 + "|" + String(options2),
              x: value7,
              y: value8,
              w: value9 - value7,
              h: value10 - value8,
              collaborator: value2.collaborator,
            };
            items.push({
              file: value5.file,
              ring: state,
            });
          },
        );
      }
      let items2: Dynamic = [];
      for (let value3 of (value !== null
        ? []
        : (value2.lists.selectedArtboards ?? [])) as Dynamic) {
        let entry: Dynamic = options.get(value3);
        !entry ||
          values.has(value3) ||
          items2.push({
            file: entry.file,
            ring: {
              key: value2.peer + "|" + value3,
              x: 0,
              y: 0,
              w: entry.w,
              h: entry.h,
              collaborator: value2.collaborator,
            },
          });
      }
      for (let { file: value3, ring: value4 } of [
        ...items2,
        ...items,
      ] as Dynamic) {
        let entry: Dynamic = entries.get(value3);
        entry ? entry.push(value4) : entries.set(value3, [value4]);
      }
    }
    return entries;
  }
  function useCanvasPeerSelections({
    pageId: pageId,
    artboards: artboards,
    handlesRef: handlesRef,
    store: store,
    fullFile = null,
  }: Dynamic): Dynamic {
    let value: Dynamic = (0, runtime.usePeerSelectionGroups)(
        {
          page: pageId === "" ? null : pageId,
        },
        ["selectedArtboards"],
      ),
      value2: Dynamic =
        (0, runtime.embedMemoryPrefix)() === ""
          ? value
          : CollaborationSelectionPathsItems,
      value3: Dynamic = (0,
      runtime.reactCollaborationPeerCursors.useMemo)((): Dynamic => {
        let entries2: Dynamic = new Map();
        for (let value15 of artboards as Dynamic) {
          let value16: Dynamic = encodeArtboardSelectionPath(value15.file);
          value16 !== null && entries2.set(value16, value15);
        }
        return entries2;
      }, [artboards]),
      entries: Dynamic = new Map();
    for (let value15 of value2 as Dynamic)
      for (let value16 of value15.selected as Dynamic) {
        let value17: Dynamic = parseSelectedElementPath(value16),
          value18: Dynamic = value17 ? value3.get(value17.name) : undefined;
        if (
          !value17 ||
          !value18 ||
          (fullFile !== null && value18.file !== fullFile)
        )
          continue;
        let value19: Dynamic = entries.get(value18.file) ?? [];
        value19.includes(value17.tid) || value19.push(value17.tid);
        entries.set(value18.file, value19);
      }
    for (let value15 of entries.values() as Dynamic)
      value15.sort(
        (input?: Dynamic, options?: Dynamic): Dynamic => input - options,
      );
    let value4: Dynamic = JSON.stringify([
        fullFile,
        ...[...entries].sort(
          ([input]: Dynamic, [options]: Dynamic): Dynamic =>
            input < options ? -1 : input > options ? 1 : 0,
        ),
      ]),
      value5: Dynamic = (0, runtime.reactCollaborationPeerCursors.useRef)(
        fullFile,
      );
    value5.current = fullFile;
    let value6: Dynamic = (0, runtime.reactCollaborationPeerCursors.useRef)(
      entries,
    );
    value6.current = entries;
    let value7: Dynamic = entries.size > 0,
      [value8, value9]: Dynamic = (0,
      runtime.reactCollaborationPeerCursors.useState)({
        full: null,
        rects: CollaborationSelectionPathsCache,
      }),
      value10: Dynamic =
        value8.full === fullFile
          ? value8.rects
          : CollaborationSelectionPathsCache,
      value11: Dynamic = (0, runtime.reactCollaborationPeerCursors.useRef)(
        (): Dynamic => {},
      );
    (0, runtime.reactCollaborationPeerCursors.useEffect)((): Dynamic => {
      if (!value7) {
        value9(
          (input?: Dynamic): Dynamic =>
            input.rects.size === 0
              ? input
              : {
                  full: input.full,
                  rects: CollaborationSelectionPathsCache,
                },
        );
        return;
      }
      let flag: Dynamic = false,
        flag2: Dynamic = false,
        flag3: Dynamic = false,
        index: Dynamic = 0,
        value15: Dynamic,
        callback: Dynamic = (input?: Dynamic): Dynamic => {
          clearTimeout(value15);
          value15 = setTimeout((): Dynamic => {
            callback2();
          }, input);
        },
        callback2: Dynamic = async (): Promise<Dynamic> => {
          flag2 = true;
          flag3 = false;
          index = Date.now();
          let current: Dynamic = value6.current,
            current2: Dynamic = value5.current,
            entries2: Dynamic = new Map();
          try {
            await Promise.all(
              [...current].map(
                async ([input, input2]: Dynamic): Promise<Dynamic> => {
                  let entry: Dynamic = handlesRef.current.get(input),
                    value16: Dynamic =
                      entry?.isReady() && !entry.isBlocked()
                        ? (0, runtime.createPreviewHandle)(
                            entry.webviewRef.current,
                          )
                        : null;
                  if (!value16) return;
                  let value17: Dynamic = await (0, runtime.pickerPeerRects)(
                    value16,
                    input2,
                    input === current2,
                  );
                  value17 &&
                    entries2.set(
                      input,
                      new Map(
                        value17.map(
                          (input3?: Dynamic, options?: Dynamic): Dynamic => [
                            input2[options],
                            input3,
                          ],
                        ),
                      ),
                    );
                },
              ),
            );
          } finally {
            flag2 = false;
            flag ||
              callback(
                flag3
                  ? CollaborationSelectionPathsConstant_2
                  : CollaborationSelectionPathsConstant,
              );
          }
          flag ||
            current2 !== value5.current ||
            value9((input?: Dynamic): Dynamic => {
              let value16: Dynamic =
                  input.full === current2
                    ? input.rects
                    : CollaborationSelectionPathsCache,
                entries3: Dynamic = new Map();
              for (let value17 of value6.current.keys() as Dynamic) {
                let value18: Dynamic =
                  entries2.get(value17) ?? value16.get(value17);
                value18 && entries3.set(value17, value18);
              }
              return input.full === current2 &&
                JSON.stringify(
                  [...value16].map(
                    ([input2, input3]: Dynamic): Dynamic => [
                      input2,
                      [...input3],
                    ],
                  ),
                ) ===
                  JSON.stringify(
                    [...entries3].map(
                      ([input2, input3]: Dynamic): Dynamic => [
                        input2,
                        [...input3],
                      ],
                    ),
                  )
                ? input
                : {
                    full: current2,
                    rects: entries3,
                  };
            });
        };
      value11.current = (): Dynamic => {
        flag2
          ? (flag3 = true)
          : callback(
              Math.max(
                0,
                Math.min(
                  CollaborationSelectionPathsConstant_2,
                  index + CollaborationSelectionPathsConstant - Date.now(),
                ),
              ),
            );
      };
      callback(0);
      return (): Dynamic => {
        flag = true;
        clearTimeout(value15);
        value11.current = (): Dynamic => {};
      };
    }, [value7]);
    (0, runtime.reactCollaborationPeerCursors.useEffect)(
      (): Dynamic => value11.current(),
      [value4],
    );
    let value12: Dynamic = resolvePeerElementSelections(
        value2,
        value3,
        value10,
        fullFile,
      ),
      value13: Dynamic = JSON.stringify([...value12]),
      value14: Dynamic = (0, runtime.reactCollaborationPeerCursors.useRef)(
        null,
      );
    (0, runtime.reactCollaborationPeerCursors.useLayoutEffect)((): Dynamic => {
      value13 !== value14.current &&
        ((value14.current = value13), store.set(value12));
    });
    (0, runtime.reactCollaborationPeerCursors.useEffect)(
      (): Dynamic => (): Dynamic => store.set(new Map()),
      [store],
    );
    return null;
  }
  function clipPeerRects(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    return input.flatMap((input2?: Dynamic): Dynamic => {
      let value: Dynamic = Math.max(0, input2.x - options.x),
        value2: Dynamic = Math.max(0, input2.y - options.y),
        value3: Dynamic = Math.min(context.w, input2.x - options.x + input2.w),
        value4: Dynamic = Math.min(context.h, input2.y - options.y + input2.h);
      return value3 <= value || value4 <= value2
        ? []
        : [
            {
              ...input2,
              x: value,
              y: value2,
              w: value3 - value,
              h: value4 - value2,
            },
          ];
    });
  }
  function ArtboardPeerSelectionRings({
    store: store,
    file: file,
    box: box,
    scroll: scroll,
  }: Dynamic): Dynamic {
    let entry: Dynamic = (0,
      runtime.reactCollaborationPeerCursors.useSyncExternalStore)(
        store.subscribe,
        store.get,
        store.get,
      ).get(file),
      value: Dynamic = (0,
      runtime.reactCollaborationPeerCursors.useSyncExternalStore)(
        scroll.subscribe,
        (): Dynamic => scroll.get(file),
        (): Dynamic => scroll.get(file),
      ),
      value2: Dynamic = entry ? clipPeerRects(entry, value, box) : [];
    return value2.length > 0 ? (
      <runtime.ViewportScale>
        {(input?: Dynamic): Dynamic => (
          <runtime.PeerSelectionRings rings={value2} scale={input} />
        )}
      </runtime.ViewportScale>
    ) : null;
  }
  bindRuntimeValue(
    runtime,
    "AZaZ0909AF21200Value",
    () => AZaZ0909AF21200Value,
    (value) => {
      AZaZ0909AF21200Value = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "encodedArtboardPathPattern",
    () => encodedArtboardPathPattern,
    (value) => {
      encodedArtboardPathPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "encodedElementPathPattern",
    () => encodedElementPathPattern,
    (value) => {
      encodedElementPathPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "parseSelectedElementPath",
    () => parseSelectedElementPath,
  );
  bindRuntimeValue(
    runtime,
    "normalizeSelectedArtboardPaths",
    () => normalizeSelectedArtboardPaths,
  );
  bindRuntimeValue(
    runtime,
    "CollaborationSelectionPathsLimit",
    () => CollaborationSelectionPathsLimit,
    (value) => {
      CollaborationSelectionPathsLimit = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "encodeArtboardSelectionPath",
    () => encodeArtboardSelectionPath,
  );
  bindRuntimeValue(
    runtime,
    "jsxCollaborationSelectionPaths",
    () => jsxCollaborationSelectionPaths,
    (value) => {
      jsxCollaborationSelectionPaths = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CollaborationSelectionPathsConstant",
    () => CollaborationSelectionPathsConstant,
    (value) => {
      CollaborationSelectionPathsConstant = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CollaborationSelectionPathsConstant_2",
    () => CollaborationSelectionPathsConstant_2,
    (value) => {
      CollaborationSelectionPathsConstant_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CollaborationSelectionPathsItems",
    () => CollaborationSelectionPathsItems,
    (value) => {
      CollaborationSelectionPathsItems = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CollaborationSelectionPathsCache",
    () => CollaborationSelectionPathsCache,
    (value) => {
      CollaborationSelectionPathsCache = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "createPeerSelectionStore",
    () => createPeerSelectionStore,
  );
  bindRuntimeValue(
    runtime,
    "resolvePeerElementSelections",
    () => resolvePeerElementSelections,
  );
  bindRuntimeValue(
    runtime,
    "useCanvasPeerSelections",
    () => useCanvasPeerSelections,
  );
  bindRuntimeValue(runtime, "clipPeerRects", () => clipPeerRects);
  bindRuntimeValue(
    runtime,
    "CanvasPeerSelectionRings",
    () => CanvasPeerSelectionRings,
    (value) => {
      CanvasPeerSelectionRings = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ArtboardPeerSelectionRings",
    () => ArtboardPeerSelectionRings,
  );
  return () => {
    AZaZ0909AF21200Value = "(?:[A-Za-z0-9_.!~*'()-]|%[0-9A-F]{2}){1,200}";
    encodedArtboardPathPattern = new RegExp(
      "^" + AZaZ0909AF21200Value + "\\.dc\\.html$",
    );
    encodedElementPathPattern = new RegExp(
      "^" +
        AZaZ0909AF21200Value +
        "\\.dc\\.html#\\d{1,4}:\\d{1,2}(\\/\\d{1,2}){0,8}(@\\d{1,3})?$",
    );
    CollaborationSelectionPathsLimit = 220;
    jsxCollaborationSelectionPaths = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_jsx_runtime)(),
      1,
    );
    CollaborationSelectionPathsConstant = 1e3;
    CollaborationSelectionPathsConstant_2 = 150;
    CollaborationSelectionPathsItems = [];
    CollaborationSelectionPathsCache = new Map();
    CanvasPeerSelectionRings = (0, runtime.reactCollaborationPeerCursors.memo)(
      function ({ store: store, file: file }: Dynamic): Dynamic {
        let entry: Dynamic = (0,
        runtime.reactCollaborationPeerCursors.useSyncExternalStore)(
          store.subscribe,
          store.get,
          store.get,
        ).get(file);
        return entry && entry.length > 0 ? (
          <runtime.ViewportScale>
            {(input?: Dynamic): Dynamic => (
              <runtime.PeerSelectionRings rings={entry} scale={input} />
            )}
          </runtime.ViewportScale>
        ) : null;
      },
    );
  };
}
