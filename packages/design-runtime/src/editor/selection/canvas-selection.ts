/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorSelectionCanvasSelection(
  runtime: RuntimeBindings,
): () => void {
  var SelectionCanvasSelectionSubscribers: Dynamic;
  var SelectionCanvasSelectionCache: Dynamic;
  var emptyCanvasSelection: Dynamic;
  var emptyBoardSelection: Dynamic;
  var boardSelectionCount: Dynamic;
  var hasBoardSelection: Dynamic;
  var boardSelectionItems: Dynamic;
  var isEmptyCanvasSelection: Dynamic;
  var canvasBoardSelection: Dynamic;
  var canvasElementSelectionCount: Dynamic;
  var HostValue: Dynamic;
  function toggleBoardSelection(selection?: Dynamic, item?: Dynamic): Dynamic {
    let files: Dynamic = new Set(selection.files),
      notes: Dynamic = new Set(selection.notes),
      [value, value2]: Dynamic =
        "file" in item ? [files, item.file] : [notes, item.note];
    value.has(value2) ? value.delete(value2) : value.add(value2);
    return {
      files: files,
      notes: notes,
    };
  }
  function createCanvasSelection(
    artboards?: Dynamic,
    annotations?: Dynamic,
    elements?: Dynamic,
    primary?: Dynamic,
  ): Dynamic {
    if (artboards.size === 0 && annotations.size === 0 && elements.size === 0)
      return emptyCanvasSelection;
    let resolvedPrimary: Dynamic =
      primary != null && elements.has(primary)
        ? primary
        : (elements.keys().next().value ?? null);
    return {
      artboards: artboards,
      notes: annotations,
      elements: elements,
      primary: resolvedPrimary,
    };
  }
  function selectionFromParts(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
  ): Dynamic {
    return createCanvasSelection(input, options, context, value);
  }
  function selectionFromBoards(input?: Dynamic): Dynamic {
    return createCanvasSelection(
      input.files,
      input.notes,
      SelectionCanvasSelectionCache,
      null,
    );
  }
  function selectionFromArtboards(input?: Dynamic): Dynamic {
    return selectionFromBoards({
      files: input,
      notes: SelectionCanvasSelectionSubscribers,
    });
  }
  function toggleCanvasSelection(input?: Dynamic, options?: Dynamic): Dynamic {
    let value: Dynamic = canvasBoardSelection(input);
    for (let value2 of options.files as Dynamic)
      value = toggleBoardSelection(value, {
        file: value2,
      });
    for (let value2 of options.notes as Dynamic)
      value = toggleBoardSelection(value, {
        note: value2,
      });
    let elements: Dynamic = input.elements;
    for (let value2 of value.files as Dynamic)
      if (!input.artboards.has(value2) && elements.has(value2)) {
        let entries: Dynamic = new Map(elements);
        entries.delete(value2);
        elements = entries;
      }
    return createCanvasSelection(
      value.files,
      value.notes,
      elements,
      input.primary,
    );
  }
  function selectionFromElements(file?: Dynamic, entry?: Dynamic): Dynamic {
    return createCanvasSelection(
      SelectionCanvasSelectionSubscribers,
      SelectionCanvasSelectionSubscribers,
      new Map([[file, entry]]),
      file,
    );
  }
  function promoteToArtboardSelection(
    input?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    if (input.artboards.has(options) && !input.elements.has(options))
      return input;
    let value: Dynamic = input.artboards.has(options)
        ? input.artboards
        : new Set([...input.artboards, options]),
      elements: Dynamic = input.elements;
    if (elements.has(options)) {
      let entries: Dynamic = new Map(elements);
      entries.delete(options);
      elements = entries;
    }
    return createCanvasSelection(value, input.notes, elements, input.primary);
  }
  function setCanvasElementSelection(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
  ): Dynamic {
    if (!value)
      return context == null
        ? emptyCanvasSelection
        : selectionFromElements(options, context);
    if (
      context != null &&
      shouldPromoteElementSelection(input, options, context.tids)
    )
      return promoteToArtboardSelection(input, options);
    let entries: Dynamic = new Map(input.elements);
    context == null ? entries.delete(options) : entries.set(options, context);
    return createCanvasSelection(
      input.artboards,
      input.notes,
      entries,
      context != null ? options : input.primary,
    );
  }
  function toggleCanvasElementIds(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
  ): Dynamic {
    let entry: Dynamic = input.elements.get(options),
      value2: Dynamic = entry
        ? entry.tids.filter(
            (input2?: Dynamic): Dynamic => !context.includes(input2),
          )
        : [];
    for (let value3 of context as Dynamic)
      (!entry || !entry.tids.includes(value3)) && value2.push(value3);
    return updateCanvasElementSelection(input, options, value2, value);
  }
  function shouldPromoteElementSelection(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    let value: Dynamic = input.elements.get(options)?.tids ?? [];
    return (
      input.artboards.size > 0 &&
      context.some((input2?: Dynamic): Dynamic => !value.includes(input2))
    );
  }
  function updateCanvasElementSelection(
    input?: Dynamic,
    options?: Dynamic,
    items?: Dynamic,
    value?: Dynamic,
  ): Dynamic {
    if (shouldPromoteElementSelection(input, options, items))
      return promoteToArtboardSelection(input, options);
    let entries: Dynamic = new Map(input.elements);
    items.length === 0
      ? entries.delete(options)
      : entries.set(options, {
          name: value.name,
          tids: [...items],
          rect: value.rect ?? null,
          count: items.length,
        });
    return createCanvasSelection(
      input.artboards,
      input.notes,
      entries,
      items.length > 0 ? options : input.primary,
    );
  }
  function mergeCanvasSelection(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    let value: Dynamic,
      value2: Dynamic,
      entries: Dynamic = new Map();
    if (context) {
      let value3: Dynamic = canvasBoardSelection(input);
      for (let value4 of options.files as Dynamic)
        value3 = toggleBoardSelection(value3, {
          file: value4,
        });
      for (let value4 of options.notes as Dynamic)
        value3 = toggleBoardSelection(value3, {
          note: value4,
        });
      value = new Set(value3.files);
      value2 = new Set(value3.notes);
      for (let [value4, value5] of input.elements as Dynamic) {
        let value6: Dynamic = options.elements.get(value4)?.tids ?? [],
          items: Dynamic = [
            ...value5.tids.filter(
              (input2?: Dynamic): Dynamic => !value6.includes(input2),
            ),
            ...value6.filter(
              (input2?: Dynamic): Dynamic => !value5.tids.includes(input2),
            ),
          ];
        items.length > 0 &&
          entries.set(value4, {
            name: value5.name,
            tids: items,
            rect: null,
            count: items.length,
          });
      }
      for (let [value4, value5] of options.elements as Dynamic)
        !input.elements.has(value4) &&
          value5.tids.length > 0 &&
          entries.set(value4, {
            name: value5.name,
            tids: [...value5.tids],
            rect: null,
            count: value5.tids.length,
          });
    } else {
      value = new Set(options.files);
      value2 = new Set(options.notes);
      for (let [value3, value4] of options.elements as Dynamic)
        value4.tids.length > 0 &&
          entries.set(value3, {
            name: value4.name,
            tids: [...value4.tids],
            rect: null,
            count: value4.tids.length,
          });
    }
    if (value.size > 0)
      for (let [value3, value4] of entries as Dynamic) {
        let value5: Dynamic = context
          ? (input.elements.get(value3)?.tids ?? [])
          : [];
        (value4.tids.some(
          (input2?: Dynamic): Dynamic => !value5.includes(input2),
        ) ||
          value.has(value3)) &&
          (entries.delete(value3), value.add(value3));
      }
    return createCanvasSelection(value, value2, entries, input.primary);
  }
  function filterSelectedArtboards(
    input?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    let values: Dynamic = new Set([...input.artboards].filter(options)),
      entries: Dynamic = new Map(
        [...input.elements].filter(
          ([input2]: Dynamic): Dynamic => options(input2),
        ),
      );
    return values.size === input.artboards.size &&
      entries.size === input.elements.size
      ? input
      : createCanvasSelection(values, input.notes, entries, input.primary);
  }
  function replaceSelectedElements(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    return createCanvasSelection(
      input.artboards,
      input.notes,
      options,
      context,
    );
  }
  function filterSelectedElements(input?: Dynamic, options?: Dynamic): Dynamic {
    let entries: Dynamic = new Map(
      [...input.elements].filter(
        ([input2]: Dynamic): Dynamic => options(input2),
      ),
    );
    return entries.size === input.elements.size
      ? input
      : createCanvasSelection(
          input.artboards,
          input.notes,
          entries,
          input.primary,
        );
  }
  function synchronizeSelectedElementIds(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    let entry: Dynamic = input.elements.get(options);
    if (
      !entry ||
      (entry.name != null &&
        entry.name !== (0, runtime.SelectionActionsReplace)(options))
    )
      return input;
    let value: Dynamic =
      entry.name == null
        ? []
        : context(entry.tids).filter(
            (input2?: Dynamic): Dynamic => input2 != null,
          );
    if (value.length === 0)
      return filterSelectedElements(
        input,
        (input2?: Dynamic): Dynamic => input2 !== options,
      );
    if (
      value.length === entry.tids.length &&
      value.every(
        (input2?: Dynamic, options2?: Dynamic): Dynamic =>
          input2 === entry.tids[options2],
      )
    )
      return input;
    let entries: Dynamic = new Map(input.elements);
    entries.set(options, {
      ...entry,
      tids: value,
      rect: null,
      count: value.length === entry.tids.length ? entry.count : value.length,
    });
    return createCanvasSelection(
      input.artboards,
      input.notes,
      entries,
      input.primary,
    );
  }
  function reconcileSelectedElementIds(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
  ): Dynamic {
    let value2: Dynamic = synchronizeSelectedElementIds(
        input,
        options,
        context ?? ((): Dynamic => []),
      ),
      entry: Dynamic = value2.elements.get(options),
      value3: Dynamic =
        entry != null &&
        entry.name === (0, runtime.SelectionActionsReplace)(options);
    return {
      next: value2,
      tell:
        !value3 || (value2 === input && options === value) ? null : entry.tids,
    };
  }
  function filterSelectedAnnotations(
    input?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    let values: Dynamic = new Set([...input.notes].filter(options));
    return values.size === input.notes.size
      ? input
      : createCanvasSelection(
          input.artboards,
          values,
          input.elements,
          input.primary,
        );
  }
  function clearSelectedBoards(input?: Dynamic): Dynamic {
    return input.artboards.size === 0 && input.notes.size === 0
      ? input
      : createCanvasSelection(
          SelectionCanvasSelectionSubscribers,
          SelectionCanvasSelectionSubscribers,
          input.elements,
          input.primary,
        );
  }
  function applyHostSelectionResponse(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    let { entry: value }: Dynamic = context;
    if (context.re != null && context.re.startsWith(HostValue)) {
      if (
        value == null ||
        !input.elements.has(options) ||
        shouldPromoteElementSelection(input, options, value.tids)
      )
        return {
          kind: "confirm",
        };
      let entries: Dynamic = new Map(input.elements);
      entries.set(options, value);
      return {
        kind: "apply",
        next: createCanvasSelection(
          input.artboards,
          input.notes,
          entries,
          options,
        ),
      };
    }
    return context.additive
      ? value != null &&
        shouldPromoteElementSelection(input, options, value.tids)
        ? {
            kind: "apply",
            next: promoteToArtboardSelection(input, options),
            pushback: "clear",
          }
        : {
            kind: "apply",
            next: setCanvasElementSelection(input, options, value, true),
          }
      : {
          kind: "apply",
          next: setCanvasElementSelection(input, options, value, false),
        };
  }
  bindRuntimeValue(
    runtime,
    "SelectionCanvasSelectionSubscribers",
    () => SelectionCanvasSelectionSubscribers,
    (value) => {
      SelectionCanvasSelectionSubscribers = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SelectionCanvasSelectionCache",
    () => SelectionCanvasSelectionCache,
    (value) => {
      SelectionCanvasSelectionCache = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "emptyCanvasSelection",
    () => emptyCanvasSelection,
    (value) => {
      emptyCanvasSelection = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "emptyBoardSelection",
    () => emptyBoardSelection,
    (value) => {
      emptyBoardSelection = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "boardSelectionCount",
    () => boardSelectionCount,
    (value) => {
      boardSelectionCount = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "hasBoardSelection",
    () => hasBoardSelection,
    (value) => {
      hasBoardSelection = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "boardSelectionItems",
    () => boardSelectionItems,
    (value) => {
      boardSelectionItems = value;
    },
  );
  bindRuntimeValue(runtime, "toggleBoardSelection", () => toggleBoardSelection);
  bindRuntimeValue(
    runtime,
    "isEmptyCanvasSelection",
    () => isEmptyCanvasSelection,
    (value) => {
      isEmptyCanvasSelection = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "canvasBoardSelection",
    () => canvasBoardSelection,
    (value) => {
      canvasBoardSelection = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "canvasElementSelectionCount",
    () => canvasElementSelectionCount,
    (value) => {
      canvasElementSelectionCount = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "createCanvasSelection",
    () => createCanvasSelection,
  );
  bindRuntimeValue(runtime, "selectionFromParts", () => selectionFromParts);
  bindRuntimeValue(runtime, "selectionFromBoards", () => selectionFromBoards);
  bindRuntimeValue(
    runtime,
    "selectionFromArtboards",
    () => selectionFromArtboards,
  );
  bindRuntimeValue(
    runtime,
    "toggleCanvasSelection",
    () => toggleCanvasSelection,
  );
  bindRuntimeValue(
    runtime,
    "selectionFromElements",
    () => selectionFromElements,
  );
  bindRuntimeValue(
    runtime,
    "promoteToArtboardSelection",
    () => promoteToArtboardSelection,
  );
  bindRuntimeValue(
    runtime,
    "setCanvasElementSelection",
    () => setCanvasElementSelection,
  );
  bindRuntimeValue(
    runtime,
    "toggleCanvasElementIds",
    () => toggleCanvasElementIds,
  );
  bindRuntimeValue(
    runtime,
    "shouldPromoteElementSelection",
    () => shouldPromoteElementSelection,
  );
  bindRuntimeValue(
    runtime,
    "updateCanvasElementSelection",
    () => updateCanvasElementSelection,
  );
  bindRuntimeValue(runtime, "mergeCanvasSelection", () => mergeCanvasSelection);
  bindRuntimeValue(
    runtime,
    "filterSelectedArtboards",
    () => filterSelectedArtboards,
  );
  bindRuntimeValue(
    runtime,
    "replaceSelectedElements",
    () => replaceSelectedElements,
  );
  bindRuntimeValue(
    runtime,
    "filterSelectedElements",
    () => filterSelectedElements,
  );
  bindRuntimeValue(
    runtime,
    "synchronizeSelectedElementIds",
    () => synchronizeSelectedElementIds,
  );
  bindRuntimeValue(
    runtime,
    "reconcileSelectedElementIds",
    () => reconcileSelectedElementIds,
  );
  bindRuntimeValue(
    runtime,
    "filterSelectedAnnotations",
    () => filterSelectedAnnotations,
  );
  bindRuntimeValue(runtime, "clearSelectedBoards", () => clearSelectedBoards);
  bindRuntimeValue(
    runtime,
    "HostValue",
    () => HostValue,
    (value) => {
      HostValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "applyHostSelectionResponse",
    () => applyHostSelectionResponse,
  );
  return () => {
    SelectionCanvasSelectionSubscribers = new Set();
    SelectionCanvasSelectionCache = new Map();
    emptyCanvasSelection = {
      artboards: SelectionCanvasSelectionSubscribers,
      notes: SelectionCanvasSelectionSubscribers,
      elements: SelectionCanvasSelectionCache,
      primary: null,
    };
    emptyBoardSelection = {
      files: SelectionCanvasSelectionSubscribers,
      notes: SelectionCanvasSelectionSubscribers,
    };
    boardSelectionCount = (input?: Dynamic): Dynamic =>
      input.files.size + input.notes.size;
    hasBoardSelection = (input?: Dynamic, options?: Dynamic): Dynamic =>
      "file" in options
        ? input.files.has(options.file)
        : input.notes.has(options.note);
    boardSelectionItems = (input?: Dynamic): Dynamic =>
      "file" in input
        ? {
            files: new Set([input.file]),
            notes: SelectionCanvasSelectionSubscribers,
          }
        : {
            files: SelectionCanvasSelectionSubscribers,
            notes: new Set([input.note]),
          };
    isEmptyCanvasSelection = (selection?: Dynamic): Dynamic =>
      selection.artboards.size === 0 &&
      selection.notes.size === 0 &&
      selection.elements.size === 0;
    canvasBoardSelection = (input?: Dynamic): Dynamic => ({
      files: input.artboards,
      notes: input.notes,
    });
    canvasElementSelectionCount = (input?: Dynamic): Dynamic =>
      input.elements.size === 0 && input.artboards.size + input.notes.size > 0;
    HostValue = "host:";
  };
}
