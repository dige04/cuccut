/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installCanvasPageOperations(
  runtime: RuntimeBindings,
): () => void {
  var pluralCanvasObjectCount: Dynamic;
  var otherCanvasObjectWord: Dynamic;
  function canvasPageDeleteSnapshot(
    manifest?: Dynamic,
    pageId?: Dynamic,
  ): Dynamic {
    let value: Dynamic = manifest.pages ?? [],
      value2: Dynamic = value.findIndex(
        (input?: Dynamic): Dynamic => input.id === pageId,
      );
    if (value2 < 0 || value.length < 2) return null;
    let callback: Dynamic = (input?: Dynamic): Dynamic =>
      (0, runtime.designPageId)(input, value) === pageId;
    return {
      spec: value[value2],
      index: value2,
      files: new Set(
        manifest.artboards
          .filter(callback)
          .map((input?: Dynamic): Dynamic => input.file),
      ),
      notes: new Set(
        (manifest.annotations ?? [])
          .filter(callback)
          .map((input?: Dynamic): Dynamic => input.id),
      ),
    };
  }
  function remainingCanvasPageObjects(
    manifest?: Dynamic,
    pageId?: Dynamic,
    deletedFiles?: Dynamic,
    deletedNotes?: Dynamic,
  ): Dynamic {
    let value: Dynamic = canvasPageDeleteSnapshot(manifest, pageId);
    return value
      ? {
          artboards: manifest.artboards.filter(
            (input?: Dynamic): Dynamic =>
              value.files.has(input.file) && !deletedFiles.has(input.file),
          ),
          notes: [...value.notes].filter(
            (input?: Dynamic): Dynamic => !deletedNotes.has(input),
          ),
        }
      : {
          artboards: [],
          notes: [],
        };
  }
  function neighboringCanvasPageId(pages?: Dynamic, pageId?: Dynamic): Dynamic {
    let value: Dynamic = pages.findIndex(
      (input?: Dynamic): Dynamic => input.id === pageId,
    );
    return value < 0 ? undefined : (pages[value - 1] ?? pages[value + 1])?.id;
  }
  function restoreCanvasPageSpec(pages?: Dynamic, snapshot?: Dynamic): Dynamic {
    let items: Dynamic = [...(pages ?? [])];
    items.some((input?: Dynamic): Dynamic => input.id === snapshot.spec.id) ||
      items.splice(Math.min(snapshot.index, items.length), 0, snapshot.spec);
    return items;
  }
  function retargetCanvasPageHistory(
    step?: Dynamic,
    pageId?: Dynamic,
  ): Dynamic {
    if (step.page !== undefined) {
      step.launch?.view === "canvas" &&
        step.launch.page === step.page.spec.id &&
        (step.launch = {
          view: "canvas",
          page: pageId,
        });
      step.page = {
        ...step.page,
        spec: {
          ...step.page.spec,
          id: pageId,
        },
      };
      for (let value of step.entries as Dynamic)
        value.spec = {
          ...value.spec,
          page: pageId,
        };
      for (let value of (step.anns ?? []) as Dynamic)
        value.spec = {
          ...value.spec,
          page: pageId,
        };
    }
  }
  function assignImplicitFirstCanvasPage(
    objects?: Dynamic,
    pages?: Dynamic,
  ): Dynamic {
    let value: Dynamic = pages?.[0]?.id;
    return objects.map(
      (input?: Dynamic): Dynamic =>
        value !== undefined &&
        input.page !== value &&
        (0, runtime.designPageId)(input, pages) === value
          ? {
              ...input,
              page: value,
            }
          : input,
    );
  }
  function isCanvasPageMatch(
    matches?: Dynamic,
    pageId?: Dynamic,
    firstPageId?: Dynamic,
  ): Dynamic {
    return (
      matches(pageId === firstPageId ? "" : pageId) ||
      (pageId !== "" && matches(pageId))
    );
  }
  function nextCanvasPageName(pages?: Dynamic): Dynamic {
    let value: Dynamic = pages.length + 1;
    for (
      ;
      pages.some(
        (input?: Dynamic): Dynamic => input.name === "Page " + String(value),
      );

    )
      value += 1;
    return "Page " + String(value);
  }
  function canvasPageDeleteConfirmation(
    pageName?: Dynamic,
    artboardCount?: Dynamic,
    noteCount?: Dynamic,
    hasOtherObjects?: Dynamic,
  ): Dynamic {
    let value: Dynamic = [
      artboardCount > 0
        ? pluralCanvasObjectCount(artboardCount, "artboard", "artboards")
        : "",
      noteCount > 0
        ? pluralCanvasObjectCount(
            noteCount,
            "one " + otherCanvasObjectWord(artboardCount > 0) + "object",
            otherCanvasObjectWord(artboardCount > 0) + "objects",
          )
        : "",
    ].filter((input?: Dynamic): Dynamic => input !== "");
    return {
      title: "Delete page \u201C" + pageName + "\u201D?",
      message:
        "Its " +
        value.join(" and ") +
        " will be deleted too. Undo (" +
        hasOtherObjects +
        ") brings " +
        (artboardCount + noteCount === 1 ? "it" : "them") +
        " back until the editor reloads.",
      confirmLabel: "Delete page",
      danger: true,
    };
  }
  bindRuntimeValue(
    runtime,
    "canvasPageDeleteSnapshot",
    () => canvasPageDeleteSnapshot,
  );
  bindRuntimeValue(
    runtime,
    "remainingCanvasPageObjects",
    () => remainingCanvasPageObjects,
  );
  bindRuntimeValue(
    runtime,
    "neighboringCanvasPageId",
    () => neighboringCanvasPageId,
  );
  bindRuntimeValue(
    runtime,
    "restoreCanvasPageSpec",
    () => restoreCanvasPageSpec,
  );
  bindRuntimeValue(
    runtime,
    "retargetCanvasPageHistory",
    () => retargetCanvasPageHistory,
  );
  bindRuntimeValue(
    runtime,
    "assignImplicitFirstCanvasPage",
    () => assignImplicitFirstCanvasPage,
  );
  bindRuntimeValue(runtime, "isCanvasPageMatch", () => isCanvasPageMatch);
  bindRuntimeValue(runtime, "nextCanvasPageName", () => nextCanvasPageName);
  bindRuntimeValue(
    runtime,
    "pluralCanvasObjectCount",
    () => pluralCanvasObjectCount,
    (value) => {
      pluralCanvasObjectCount = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "otherCanvasObjectWord",
    () => otherCanvasObjectWord,
    (value) => {
      otherCanvasObjectWord = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "canvasPageDeleteConfirmation",
    () => canvasPageDeleteConfirmation,
  );
  return () => {
    pluralCanvasObjectCount = (
      input?: Dynamic,
      options?: Dynamic,
      context?: Dynamic,
    ): Dynamic => (input === 1 ? options : String(input) + " " + context);
    otherCanvasObjectWord = (input?: Dynamic): Dynamic =>
      input ? "other " : "";
  };
}
